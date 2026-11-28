import { Message, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { CAMPUS_LOCATIONS, ITEM_CATALOG } from '../config/constants.js';
import {
  getAuctionAutomationConfig,
  listConfigurablePriceTargets,
  loadConfigCache,
  resetItemPriceOverrides,
  resolvePriceTargetKeys,
  setItemPriceOverrides,
  updateAuctionAutomationConfig,
} from '../services/configService.js';
import { syncMemberLocationVisibility, lockTwitterFeedChannel } from '../engines/campusEngine.js';
import { syncMemberGameRoles } from '../utils/roleSyncHelper.js';
import { calculateDerivedRatings } from '../engines/matchSimulationEngine.js';
import { installCustomServerEmojis, getEmoji } from '../utils/emojiHelper.js';
import { parseCoinAmount, formatK } from '../utils/formatHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

const MASTER_ADMIN = '478599245276905495';

function isAuthorized(message: Message): boolean {
  if (message.author.id === MASTER_ADMIN) return true;
  if (message.member?.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return false;
}

export async function handleSetupCommand(message: Message) {
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized: Administrator permissions required.');
  }

  const guild = message.guild;
  if (!guild) return;

  const statusMsg = await message.reply('⚙️ **Constructing Beyond The Final Whistle Campus Channels & Permissions...**');

  try {
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && (c.name.includes('FOOTBALL CAMPUS') || c.name.includes('Locations'))
    );
    if (!category) {
      category = await guild.channels.create({
        name: '*- 𝓔𝓼 Locations ໒꒱ -*',
        type: ChannelType.GuildCategory
      });
    }

    const botRole = guild.roles.cache.find(r => r.managed && r.members.has(guild.client.user?.id || '')) ||
      guild.roles.cache.find(r => r.name.toLowerCase().includes('whistle'));
    const vipRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('vip footballer'));
    const staffRoles = guild.roles.cache.filter(r =>
      r.name.includes('Founder') || r.name.includes('Head Administrator')
    );

    const createdList: string[] = [];

    for (const loc of Object.values(CAMPUS_LOCATIONS)) {
      const formattedName = `๑•${loc.emoji}│${loc.channelName}`;
      let channel = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase().includes(loc.channelName));

      const overwrites: any[] = [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        }
      ];
      if (botRole) {
        overwrites.push({
          id: botRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory
          ]
        });
      }

      if (!channel) {
        channel = await guild.channels.create({
          name: formattedName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: `Beyond The Final Whistle: ${loc.name} • ${loc.description}`,
          permissionOverwrites: overwrites
        });
      } else if ('permissionOverwrites' in channel) {
        await channel.permissionOverwrites.set(overwrites).catch(() => {});
      }
      createdList.push(`• **${loc.name}**: <#${channel.id}>`);
    }

    // Re-sync existing registered members so everyone only sees their active location
    const players = await prisma.player.findMany({ select: { id: true, currentLocation: true } });
    for (const p of players) {
      await syncMemberLocationVisibility(guild, p.id, p.currentLocation || 'tc');
    }

    // Private VIP Council Lounge (role-gated + per-user VIP grant)
    let vipChannel = guild.channels.cache.find(c => c.name.toLowerCase().includes('vip-lounge'));
    const vipOverwrites: any[] = [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
    ];
    if (botRole) {
      vipOverwrites.push({
        id: botRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory]
      });
    }
    if (vipRole) {
      vipOverwrites.push({
        id: vipRole.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      });
    }
    for (const sr of staffRoles.values()) {
      vipOverwrites.push({
        id: sr.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      });
    }
    if (!vipChannel) {
      vipChannel = await guild.channels.create({
        name: '๑•👑│vip-lounge',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: 'Private VIP Council — early feature previews, suggestions voting & exhibition friendlies.',
        permissionOverwrites: vipOverwrites
      });
    }
    createdList.push(`• **VIP Council Lounge:** <#${vipChannel.id}>`);

    // Friendly Matches Channel (Open to all members for exhibitions)
    let friendlyChannel = guild.channels.cache.find(c =>
      c.type === ChannelType.GuildText && (c.name.toLowerCase().includes('friendly') || c.name.toLowerCase().includes('exhibition'))
    );
    if (!friendlyChannel) {
      friendlyChannel = await guild.channels.create({
        name: '๑•🤝│friendly-matches',
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '🤝 All-Star Exhibition Matches! Run -friendly [@user] to host zero-risk friendlies with permanent MOTM stat boosts!'
      });
    }
    createdList.push(`• **Friendly Matches:** <#${friendlyChannel.id}>`);

    // Lock #twitter read-only for members (bot posts tweet embeds directly there)
    const lockedTwitterId = await lockTwitterFeedChannel(guild);
    if (lockedTwitterId) {
      createdList.push(`• **TwitFeed (Read-Only):** <#${lockedTwitterId}>`);
    }

    // Auto-install custom emojis
    const emojiResults = await installCustomServerEmojis(guild);
    const emojiSummary = emojiResults.created.length > 0
      ? `\n\n✨ **Custom Emojis Installed (${emojiResults.created.length}):** ${emojiResults.created.join(' ')}`
      : emojiResults.existing.length > 0
      ? `\n\n✨ **Custom Emojis Active:** ${emojiResults.existing.join(' ')}`
      : '';

    await statusMsg.edit(
      `✅ **Beyond The Final Whistle Football Campus Successfully Initialized!**\n\n` +
      createdList.join('\n') +
      emojiSummary +
      `\n\n🔒 All campus hubs are hidden by default — each player only sees their current active location (\`-travel <alias>\`).`
    );
  } catch (err: any) {
    await statusMsg.edit(`❌ Setup failed: ${err.message}`);
  }
}

const VIP_AD_GIF = 'https://images-ext-1.discordapp.net/external/WbUdmHYz0aJoSn0OIHn7HlCzc9I9OKdCUO1DZ1_9wn4/https/static.klipy.com/ii/2711dd8a75a85be822d136ec94899b3f/3b/5d/lgwAfIbEGD9B.mp4';

export async function displayVipPerksEmbed(message: Message) {
  const player = await prisma.player.findUnique({
    where: { id: message.author.id }
  });

  const isVip = Boolean(player && player.vipTier >= 1);
  let statusText = '⚪ **Regular Member** *(Non-VIP)*';
  if (isVip && player?.vipExpiresAt) {
    const unixExpiry = Math.floor(player.vipExpiresAt.getTime() / 1000);
    statusText = `👑 **ACTIVE VIP FOOTBALLER** • *Expires:* <t:${unixExpiry}:D> (<t:${unixExpiry}:R>)`;
  } else if (isVip) {
    statusText = '👑 **ACTIVE VIP FOOTBALLER** • *Lifetime Access*';
  }

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle('👑 VIP FOOTBALLER CLUB — PRIVILEGES & SUPER-PERKS')
    .setDescription(
      `> *VIP status accelerates your football career with enhanced training regimens, complete stamina recovery, risk-free exhibition matches, and lucrative commercial deals.*\n\n` +
      `👤 **Your Status:** ${statusText}\n\n` +
      `${UI.DIVIDER}\n` +
      `### 🌟 THE 6 VIP SUPER-PERKS\n\n` +
      `**1️⃣ 🏋️ Bespoke VIP Training Drills (\`-train\`)**\n` +
      `• **VIP 6h Masterclass:** Yields **+6 TP** (6h cooldown, only 5 stamina).\n` +
      `• **VIP 20h Endurance Prep:** Yields **+20 TP** (20h cooldown, 50 stamina).\n\n` +
      `**2️⃣ 🧖 Cryo Sauna Full Recharge (\`-recovery\`)**\n` +
      `• Instantly restores **100% full stamina (100/100)** to maximum capacity (Standard is only +30)!\n\n` +
      `**3️⃣ 🤝 VIP All-Star Exhibitions (\`-friendly\`)**\n` +
      `• Host exhibition friendlies with **Zero Stat Loss Guarantee** on defeat.\n` +
      `• Man of the Match (MOTM) earns a permanent **+1 to +2 attribute boost**!\n` +
      `• Halved match stamina drain (only drains 50% standard match stamina).\n\n` +
      `**4️⃣ 📸 300k Commercial Sponsorship (\`-advert\`)**\n` +
      `• Unlocks the exclusive **VIP 300,000 Coin** signature contract at the Photoshoot Hall.\n\n` +
      `**5️⃣ 🎨 Luxury Gold Dossier & Collector Boutique**\n` +
      `• Golden VIP badge and metallic frame on your \`-profile\` card and neon radar.\n` +
      `• Access to claim and buy monthly VIP Collector Avatars & Banners (\`-avatar\`).\n\n` +
      `**6️⃣ 🏛️ Private VIP Council Lounge (\`#vip-lounge\`)**\n` +
      `• Unlocks access to the private **#vip-lounge** with direct developer suggestions, feature sneak-peeks, and community votes.\n\n` +
      `${UI.DIVIDER}\n` +
      `🎟️ **How to Acquire VIP Status:**\n` +
      `• **Server Booster:** Boost our Discord server for automatic VIP tier.\n` +
      `• **Tournament Rewards & Admin Grants:** Won in official tournaments and granted via \`-vip give @user <days>\`.`
    )
    .setImage(VIP_AD_GIF)
    .setFooter({ text: 'Beyond The Final Whistle • VIP Programme' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

export async function handleVipCommand(message: Message, args: string[]) {
  const rawAction = (args[0] || '').toLowerCase();
  const adminActions = new Set(['give', 'add', 'grant', 'remove', 'revoke', 'del']);

  // If action is perks/info or no admin management action specified, display the VIP Perks Showcase
  if (!adminActions.has(rawAction)) {
    return await displayVipPerksEmbed(message);
  }

  // Admin VIP duration management
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized: Only the Bot Owner or Head Administrator can grant/revoke VIP duration.');
  }

  const isRemove = rawAction === 'remove' || rawAction === 'revoke' || rawAction === 'del';
  const targets = [...message.mentions.users.values()];

  if (targets.length === 0) {
    return await message.reply(
      '❌ **Usage:** `-vip give @user [days]` (e.g. `-vip give @player 28`), `-vip add @user [days]`, or `-vip remove @user`'
    );
  }

  const nonMentionArgs = args.filter(
    a => !a.startsWith('<@') && !['give', 'add', 'grant', 'remove', 'revoke', 'del'].includes(a.toLowerCase())
  );
  const rawDays = nonMentionArgs.find(a => /^\d+$/.test(a));
  const parsedDays = rawDays ? parseInt(rawDays, 10) : 30;
  if (isNaN(parsedDays) || parsedDays < 1 || parsedDays > 3650) {
    return await message.reply('❌ VIP duration must be between `1` and `3650` days (e.g. `-vip give @user 28`).');
  }

  const vipChannel = message.guild?.channels.cache.find(c => c.name.toLowerCase().includes('vip-lounge'));

  if (isRemove) {
    for (const targetUser of targets) {
      const targetMember = message.guild ? await message.guild.members.fetch(targetUser.id).catch(() => null) : null;
      const updated = await prisma.player.upsert({
        where: { id: targetUser.id },
        update: { vipTier: 0, vipExpiresAt: null },
        create: { id: targetUser.id, username: targetUser.username, vipTier: 0 }
      });
      if (vipChannel && 'permissionOverwrites' in vipChannel) {
        await vipChannel.permissionOverwrites.delete(targetUser.id).catch(() => {});
      }
      if (targetMember) {
        const d = calculateDerivedRatings(updated);
        await syncMemberGameRoles(targetMember, {
          ovr: Math.round((d.atk + d.mid + d.def) / 3),
          matchesPlayed: updated.matchesPlayed || 0,
          vipTier: 0
        });
      }
    }
    const mentionList = targets.map(u => `<@${u.id}>`).join(', ');
    return await message.reply(`ℹ️ Removed **VIP** status from ${mentionList}.`);
  }

  const tier = 1;
  const expiry = new Date(Date.now() + parsedDays * 24 * 60 * 60 * 1000);
  const unixExpiry = Math.floor(expiry.getTime() / 1000);

  for (const targetUser of targets) {
    const targetMember = message.guild ? await message.guild.members.fetch(targetUser.id).catch(() => null) : null;
    const updated = await prisma.player.upsert({
      where: { id: targetUser.id },
      update: { vipTier: tier, vipExpiresAt: expiry, referralVipOnly: false },
      create: {
        id: targetUser.id,
        username: targetUser.username,
        vipTier: tier,
        vipExpiresAt: expiry,
        referralVipOnly: false
      }
    });

    if (vipChannel && 'permissionOverwrites' in vipChannel) {
      await vipChannel.permissionOverwrites.create(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true
      }).catch(() => {});
    }
    if (targetMember) {
      const d = calculateDerivedRatings(updated);
      await syncMemberGameRoles(targetMember, {
        ovr: Math.round((d.atk + d.mid + d.def) / 3),
        matchesPlayed: updated.matchesPlayed || 0,
        vipTier: tier
      });
    }
  }

  const mentionList = targets.map(u => `<@${u.id}>`).join(', ');

  const VIP_AD_GIF = 'https://images-ext-1.discordapp.net/external/WbUdmHYz0aJoSn0OIHn7HlCzc9I9OKdCUO1DZ1_9wn4/https/static.klipy.com/ii/2711dd8a75a85be822d136ec94899b3f/3b/5d/lgwAfIbEGD9B.mp4';

  const vipGrantEmbed = new EmbedBuilder()
    .setColor(THEME_COLORS.GOLD)
    .setTitle('👑 VIP ACCESS GRANTED')
    .setDescription(
      `${mentionList} ${targets.length > 1 ? 'have' : 'has'} been elevated to **VIP Footballer** status!\n\n` +
      `### 🏆 Exclusive Unlocks\n` +
      `👑 **VIP Training** — +6 TP Elite Session (6h cooldown)\n` +
      `⚡ **VIP 20h Endurance** — +20 TP overnight grind\n` +
      `💰 **300k Sponsor Advert** — Premium commercial deal\n` +
      `🛁 **Full Sauna Recovery** — 100% stamina restore\n` +
      `🎁 **Monthly Free Cosmetic** — Avatar/banner claim\n` +
      `🎮 **Exhibition Friendlies** — Private match access\n` +
      `🔒 **VIP Lounge** — Private council channel\n\n` +
      `${UI.DIVIDER}\n` +
      subtext(`⏳ Expires: <t:${unixExpiry}:D> • <t:${unixExpiry}:R>`)
    )
    .setImage(VIP_AD_GIF)
    .setFooter({ text: 'Beyond The Final Whistle • VIP Programme' })
    .setTimestamp();

  await message.reply({ embeds: [vipGrantEmbed] });

  // Also announce in VIP lounge if it exists
  if (vipChannel && 'send' in vipChannel) {
    const loungeEmbed = new EmbedBuilder()
      .setColor(THEME_COLORS.GOLD)
      .setTitle('🎉 New VIP Footballer Has Arrived!')
      .setDescription(
        `Welcome ${mentionList} to the **VIP Council**! 👑\n\n` +
        `Your **${parsedDays}-day** VIP pass is active until <t:${unixExpiry}:D>.\n` +
        `Run \`-train\` to access elite sessions, \`-sponsor\` for the 300k deal, and \`-recovery\` for full stamina reset.`
      )
      .setImage(VIP_AD_GIF)
      .setFooter({ text: 'Beyond The Final Whistle • VIP Lounge' })
      .setTimestamp();
    await (vipChannel as any).send({ embeds: [loungeEmbed] }).catch(() => {});
  }
}

export async function handleDevFundCommand(message: Message, args: string[]) {
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized: Master Admin permissions required.');
  }

  const targetUser = message.mentions.users.first() || message.author;
  const amountArg = args.find(a => !a.startsWith('<@')) || '';
  const amount = parseCoinAmount(amountArg);

  if (!amount) {
    return await message.reply('❌ Usage: `-devfund <amount> [@user]` (e.g. `-devfund 5m @user`)');
  }

  const updated = await prisma.player.upsert({
    where: { id: targetUser.id },
    update: { coins: { increment: amount } },
    create: {
      id: targetUser.id,
      username: targetUser.username,
      coins: amount
    }
  });

  const coinEmoji = getEmoji(message.guild, 'coin');
  await message.reply(
    `🏦 **Dev Fund & Event Prize Credited!**\n` +
    `Granted **+${formatK(amount)}** ${coinEmoji} to <@${targetUser.id}> *(New Balance: \`${formatK(updated.coins)}\`)*`
  );
}

export async function handleAddItemCommand(message: Message, args: string[]) {
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized.');
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return await message.reply('❌ Usage: `-additem <itemSymbol/alias> @user`');
  }

  const rawItem = args[0] || ':worldcup:';
  const cleanKey = rawItem.replace(/[:<>0-9]/g, '').trim().toLowerCase();
  const knownItem = ITEM_CATALOG[cleanKey];
  const customEmoji = getEmoji(message.guild, cleanKey);

  const symbol = (customEmoji && customEmoji !== '⚽')
    ? customEmoji
    : (rawItem.startsWith('<') ? rawItem : rawItem.startsWith(':') ? rawItem : knownItem?.symbol || '🏆');
  const itemName = knownItem?.name || cleanKey.toUpperCase();

  const playerBefore = await prisma.player.upsert({
    where: { id: targetUser.id },
    update: {},
    create: { id: targetUser.id, username: targetUser.username },
    include: { inventory: true, vehicles: true }
  });

  const beforeItems = [...playerBefore.inventory.map(i => i.emoji), ...playerBefore.vehicles.map(() => '🏎️')];
  const beforeText = beforeItems.length > 0 ? beforeItems.join(' ') : '(empty)';

  await prisma.inventoryItem.create({
    data: {
      playerId: targetUser.id,
      itemKey: cleanKey,
      name: itemName,
      emoji: symbol
    }
  });

  const playerAfter = await prisma.player.findUnique({
    where: { id: targetUser.id },
    include: { inventory: true, vehicles: true }
  });

  const afterItems = [...(playerAfter?.inventory.map(i => i.emoji) || [symbol]), ...(playerAfter?.vehicles.map(() => '🏎️') || [])];
  const afterText = afterItems.join(' ');

  await message.reply(
    `Added ${rawItem} to <@${targetUser.id}>'s inventory!\n` +
    `(collectables: ${beforeText} → ${afterText})`
  );
}

export async function handleAddVarCommand(message: Message, args: string[]) {
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized.');
  }

  const targetUser = message.mentions.users.first() || message.author;
  const varName = args[0]?.toLowerCase();
  const valStr = args[1];

  if (!varName || !valStr) {
    return await message.reply('❌ Usage: `-addvar <attribute/tp/coins/stamina> <amount> [@user]`');
  }

  const numVal = parseInt(valStr, 10);
  if (isNaN(numVal)) {
    return await message.reply('❌ Value must be a valid number.');
  }

  const validVars: Record<string, string> = {
    tp: 'trainingPoints',
    trainingpoints: 'trainingPoints',
    coins: 'coins',
    stamina: 'stamina',
    fin: 'fin',
    pow: 'pow',
    hea: 'hea',
    pas: 'pas',
    vis: 'vis',
    cro: 'cro',
    dri: 'dri',
    tck: 'tck',
    int: 'int',
    mrk: 'mrk',
    pac: 'pac',
    phy: 'phy',
    cmp: 'cmp',
    agi: 'agi',
    wrk: 'wrk'
  };

  const dbField = validVars[varName];
  if (!dbField) {
    return await message.reply(`❌ Unknown variable \`${varName}\`. Valid: ${Object.keys(validVars).join(', ')}`);
  }

  const dataUpdate = dbField === 'coins' ? { [dbField]: { increment: BigInt(numVal) } } : { [dbField]: { increment: numVal } };

  await prisma.player.upsert({
    where: { id: targetUser.id },
    update: dataUpdate as any,
    create: {
      id: targetUser.id,
      username: targetUser.username,
      [dbField]: dbField === 'coins' ? BigInt(numVal) : numVal
    } as any
  });

  await message.reply(`✅ Updated **${dbField}** by \`${numVal >= 0 ? '+' : ''}${numVal}\` for <@${targetUser.id}>.`);
}


export async function handleSetupEmojisCommand(message: Message) {
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized.');
  }

  const guild = message.guild;
  if (!guild) {
    return await message.reply('❌ This command must be executed within a Discord server.');
  }

  const loading = await message.reply('✨ **Uploading and initializing custom Beyond The Final Whistle emojis...**');

  const result = await installCustomServerEmojis(guild);
  const createdMsg = result.created.length > 0 ? `• **New Emojis Created (${result.created.length}):** ${result.created.join(' ')}\n` : '';
  const existingMsg = result.existing.length > 0 ? `• **Already Installed (${result.existing.length}):** ${result.existing.join(' ')}\n` : '';
  const failedMsg = result.failed.length > 0 ? `• ⚠️ Failed to upload: ${result.failed.join(', ')}\n` : '';

  await loading.edit(
    `✨ **Custom Server Emojis Operational!**\n\n` +
    createdMsg +
    existingMsg +
    failedMsg +
    `\nAll bot embeds, buttons, and notifications will now use these custom emojis!`
  );
}

/**
 * Displays all configurable live prices across Market Gear, Vehicles, Cosmetics, and Auction Relics.
 */
export async function handlePricesCommand(message: Message) {
  await loadConfigCache();
  const coinEmoji = getEmoji(message.guild, 'coin');
  const targets = listConfigurablePriceTargets();
  const ahCfg = getAuctionAutomationConfig();

  const categories: Array<'Market Gear' | 'Vehicles' | 'Avatars' | 'Banners' | 'Auction Relics'> = [
    'Market Gear',
    'Vehicles',
    'Avatars',
    'Banners',
    'Auction Relics'
  ];

  const blocks = categories.map(cat => {
    const items = targets.filter(t => t.category === cat);
    const lines = items.map(t =>
      `• \`${t.key}\` — **${formatK(t.effectivePrice)}** ${coinEmoji}${t.isOverridden ? ' *(🔧 Custom)*' : ''}`
    );
    return `### 🏷️ ${cat}\n${lines.join('\n')}`;
  });

  blocks.push(
    `### 🏛️ Auction Settings\n` +
    `• \`auction_inc\` (Min Bid Step) — **${formatK(ahCfg.minBidIncrement)}** ${coinEmoji}`
  );

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.EMERALD)
    .setTitle('💰 Live Shop & Economy Pricing Directory')
    .setDescription(
      [
        ...blocks,
        `${UI.DIVIDER}\n` +
        subtext('Admins: `-setprice <key|boots|avatars|banners|auction_inc> <amount>` or `-setprice reset <key|all>`')
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • Live Pricing Directory' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

/**
 * Admin command: -setprice <alias|boots|avatars|banners|cars|auction_inc> <amount>
 * Or: -setprice reset <alias|all>
 */
export async function handleSetPriceCommand(message: Message, args: string[]) {
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized.');
  }

  await loadConfigCache();
  const targetRaw = (args[0] || '').toLowerCase().trim();
  const valRaw = (args[1] || '').toLowerCase().trim();

  if (!targetRaw || !valRaw) {
    return await message.reply(
      '❌ **Usage:**\n' +
      '• `-setprice <alias> <amount>` (e.g. `-setprice sd 80k`, `-setprice mini 3m`, `-setprice messi_av 1m`)\n' +
      '• `-setprice boots <amount>` / `avatars <amount>` / `banners <amount>` / `cars <amount>`\n' +
      '• `-setprice auction_inc <amount>` (sets min bid increment)\n' +
      '• `-setprice reset <alias|all>` (restores default pricing)\n' +
      'View all price keys via `-prices`.'
    );
  }

  if (targetRaw === 'reset' || targetRaw === 'clear') {
    if (valRaw === 'all') {
      const count = await resetItemPriceOverrides();
      return await message.reply(`✅ Reset **${count} custom price override(s)** back to catalog defaults.`);
    }
    const resolved = resolvePriceTargetKeys(valRaw);
    if (!resolved) {
      return await message.reply(`❌ Unknown item/group \`${valRaw}\`. Run \`-prices\` to inspect valid keys.`);
    }
    const count = await resetItemPriceOverrides(resolved.keys);
    return await message.reply(`✅ Restored default pricing for **${resolved.label}** (${count} override cleared).`);
  }

  const parsedPrice = parseCoinAmount(valRaw);
  if (!parsedPrice || parsedPrice <= 0n) {
    return await message.reply('❌ Invalid coin amount. Examples: `50k`, `750k`, `2.5m`.');
  }

  const coinEmoji = getEmoji(message.guild, 'coin');
  if (targetRaw === 'auction_inc' || targetRaw === 'minbid' || targetRaw === 'increment') {
    const next = await updateAuctionAutomationConfig({ minBidIncrement: parsedPrice });
    return await message.reply(`✅ Set **Auction Minimum Bid Increment** to **\`${formatK(next.minBidIncrement)}\`** ${coinEmoji}.`);
  }

  const resolved = resolvePriceTargetKeys(targetRaw);
  if (!resolved) {
    return await message.reply(`❌ Unknown item or group \`${targetRaw}\`. Run \`-prices\` to view all keys.`);
  }

  await setItemPriceOverrides(resolved.keys, parsedPrice);
  await message.reply(
    `✅ Updated live price for **${resolved.label}** to **\`${formatK(parsedPrice)}\`** ${coinEmoji}!`
  );
}

/**
 * Display current squad roster capacity limits across all National Teams and Football Clubs
 */
export async function displayTeamLimitsOverview(message: Message) {
  const [nations, clubs] = await Promise.all([
    prisma.nationalTeam.findMany({
      include: { _count: { select: { players: true } } },
      orderBy: { name: 'asc' }
    }),
    prisma.footballClub.findMany({
      include: { _count: { select: { players: true } } },
      orderBy: { name: 'asc' }
    })
  ]);

  const nationLines = nations.map(n => {
    const cap = n.maxPlayers || 23;
    const count = n._count.players;
    const isFull = count >= cap;
    const status = n.isLocked ? '🔒 `[LOCKED]`' : isFull ? '🔴 `[FULL]`' : '🟢 `[OPEN]`';
    return `• **${n.name}** ${n.flag} (\`${n.alias.toUpperCase()}\`): **${count}/${cap}** ${status}`;
  });

  const clubLines = clubs.length > 0
    ? clubs.map(c => {
        const cap = c.maxPlayers || 23;
        const count = c._count.players;
        const isFull = count >= cap;
        const status = c.isLocked ? '🔒 `[LOCKED]`' : isFull ? '🔴 `[FULL]`' : '🟢 `[OPEN]`';
        return `• **${c.name}** ${c.badge} (\`${c.alias.toUpperCase()}\`): **${count}/${cap}** ${status}`;
      })
    : ['*No registered football clubs yet.*'];

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.PRIMARY)
    .setTitle('📋 Squad Roster Capacities & Team Limits')
    .setDescription(
      [
        `Current squad capacities and active limits for International Federations & Football Clubs.`,
        `### 🌍 National Teams (${nations.length})\n` + (nationLines.length ? nationLines.join('\n') : '*None*'),
        `### 🛡️ Football Clubs (${clubs.length})\n` + clubLines.join('\n'),
        `${UI.DIVIDER}\n` +
        subtext('⚙️ **Admin Commands:**\n• `-setlimit <nation|club> <alias|all> <limit>`\n• `-locknation <alias>` / `-unlocknation <alias>`\n• `-teamlimits` to refresh this list')
      ].join(UI.SPACER)
    )
    .setFooter({ text: 'Beyond The Final Whistle • Squad Governance' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

/**
 * Admin command to set squad roster limits for National Teams and Football Clubs
 * Usage:
 * -setlimit nation <alias|all> <limit>
 * -setlimit club <alias|all> <limit>
 * -teamlimits / -setlimit list
 */
export async function handleSetLimitCommand(message: Message, args: string[]) {
  const sub = (args[0] || '').toLowerCase().trim();

  // If no args or "list" / "view", display the limits overview embed
  if (!sub || sub === 'list' || sub === 'view') {
    return await displayTeamLimitsOverview(message);
  }

  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized: Administrator permissions required.');
  }

  if (sub !== 'nation' && sub !== 'national' && sub !== 'club' && sub !== 'teams') {
    return await message.reply(
      '❌ **Invalid Syntax!**\n' +
      '• `-setlimit nation <alias|all> <limit>` — e.g. `-setlimit nation eng 25` or `-setlimit nation all 23`\n' +
      '• `-setlimit club <alias|all> <limit>` — e.g. `-setlimit club rma 25` or `-setlimit club all 23`\n' +
      '• `-teamlimits` or `-setlimit list` — View all current roster capacities & limits'
    );
  }

  const targetAlias = (args[1] || '').toLowerCase().trim();
  const limitRaw = args[2]?.trim();

  if (!targetAlias || !limitRaw) {
    return await message.reply(
      '❌ **Missing arguments!**\n' +
      '• `-setlimit nation <alias|all> <limit>` (e.g. `-setlimit nation eng 25`, `-setlimit nation all 23`)\n' +
      '• `-setlimit club <alias|all> <limit>` (e.g. `-setlimit club rma 25`, `-setlimit club all 23`)\n' +
      '• Run `-teamlimits` to view current team squad counts and limits.'
    );
  }

  const limit = parseInt(limitRaw, 10);
  if (isNaN(limit) || limit < 1 || limit > 100) {
    return await message.reply('❌ Limit must be a valid integer between **1** and **100** players.');
  }

  const isNation = sub === 'nation' || sub === 'national';

  if (targetAlias === 'all') {
    if (isNation) {
      const res = await prisma.nationalTeam.updateMany({
        data: { maxPlayers: limit }
      });
      return await message.reply(
        `✅ Successfully set squad limit to **${limit} players** across **ALL ${res.count} National Teams**! 🌍`
      );
    } else {
      const res = await prisma.footballClub.updateMany({
        data: { maxPlayers: limit }
      });
      return await message.reply(
        `✅ Successfully set squad limit to **${limit} players** across **ALL ${res.count} Football Clubs**! 🛡️`
      );
    }
  }

  if (isNation) {
    const nation = await prisma.nationalTeam.findUnique({
      where: { alias: targetAlias },
      include: { _count: { select: { players: true } } }
    });
    if (!nation) {
      return await message.reply(`❌ National team with alias \`${targetAlias}\` not found. Run \`-joinnation\` or \`-teamlimits\` to view valid aliases.`);
    }

    await prisma.nationalTeam.update({
      where: { id: nation.id },
      data: { maxPlayers: limit }
    });

    return await message.reply(
      `✅ Updated squad roster capacity for **${nation.name}** ${nation.flag} (\`${nation.alias.toUpperCase()}\`) to **${limit} players** (Current: ${nation._count.players}/${limit})!`
    );
  } else {
    const club = await prisma.footballClub.findUnique({
      where: { alias: targetAlias },
      include: { _count: { select: { players: true } } }
    });
    if (!club) {
      return await message.reply(`❌ Football club with alias \`${targetAlias}\` not found. Run \`-teamlimits\` to view registered clubs.`);
    }

    await prisma.footballClub.update({
      where: { id: club.id },
      data: { maxPlayers: limit }
    });

    return await message.reply(
      `✅ Updated squad roster capacity for **${club.name}** ${club.badge} (\`${club.alias.toUpperCase()}\`) to **${limit} players** (Current: ${club._count.players}/${limit})!`
    );
  }
}

/**
 * Admin command to lock a National Team or Football Club from new registrations
 * Usage:
 * -locknation <alias>
 * -lockclub <alias>
 * -lock <nation|club> <alias>
 */
export async function handleLockTeamCommand(message: Message, args: string[], defaultType?: 'nation' | 'club') {
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized: Administrator permissions required.');
  }

  let type = defaultType;
  let alias = args[0]?.toLowerCase().trim();

  if (!defaultType) {
    if (alias === 'nation' || alias === 'club') {
      type = alias;
      alias = args[1]?.toLowerCase().trim();
    } else {
      type = 'nation';
    }
  }

  if (!alias) {
    return await message.reply(
      `❌ **Usage:** \`-locknation <alias>\` or \`-lock <nation|club> <alias>\`\n*Example:* \`-locknation ita\`, \`-locknation bel\``
    );
  }

  if (type === 'nation') {
    const nation = await prisma.nationalTeam.findUnique({ where: { alias } });
    if (!nation) {
      return await message.reply(`❌ National team with alias \`${alias}\` not found.`);
    }
    if (nation.isLocked) {
      return await message.reply(`ℹ️ **${nation.name}** ${nation.flag} is already locked!`);
    }

    await prisma.nationalTeam.update({
      where: { id: nation.id },
      data: { isLocked: true }
    });

    return await message.reply(
      `🔒 **National Team Locked:** **${nation.name}** ${nation.flag} (\`${nation.alias.toUpperCase()}\`) is now **LOCKED**. Players cannot join until unlocked (\`-unlocknation ${nation.alias}\`).`
    );
  } else {
    const club = await prisma.footballClub.findUnique({ where: { alias } });
    if (!club) {
      return await message.reply(`❌ Football club with alias \`${alias}\` not found.`);
    }
    if (club.isLocked) {
      return await message.reply(`ℹ️ **${club.name}** ${club.badge} is already locked!`);
    }

    await prisma.footballClub.update({
      where: { id: club.id },
      data: { isLocked: true }
    });

    return await message.reply(
      `🔒 **Football Club Locked:** **${club.name}** ${club.badge} (\`${club.alias.toUpperCase()}\`) is now **LOCKED**. Players cannot join until unlocked (\`-unlockclub ${club.alias}\`).`
    );
  }
}

/**
 * Admin command to unlock a National Team or Football Club for player registrations
 * Usage:
 * -unlocknation <alias>
 * -unlockclub <alias>
 * -unlock <nation|club> <alias>
 */
export async function handleUnlockTeamCommand(message: Message, args: string[], defaultType?: 'nation' | 'club') {
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized: Administrator permissions required.');
  }

  let type = defaultType;
  let alias = args[0]?.toLowerCase().trim();

  if (!defaultType) {
    if (alias === 'nation' || alias === 'club') {
      type = alias;
      alias = args[1]?.toLowerCase().trim();
    } else {
      type = 'nation';
    }
  }

  if (!alias) {
    return await message.reply(
      `❌ **Usage:** \`-unlocknation <alias>\` or \`-unlock <nation|club> <alias>\`\n*Example:* \`-unlocknation ita\`, \`-unlocknation bel\``
    );
  }

  if (type === 'nation') {
    const nation = await prisma.nationalTeam.findUnique({ where: { alias } });
    if (!nation) {
      return await message.reply(`❌ National team with alias \`${alias}\` not found.`);
    }
    if (!nation.isLocked) {
      return await message.reply(`ℹ️ **${nation.name}** ${nation.flag} is already unlocked!`);
    }

    await prisma.nationalTeam.update({
      where: { id: nation.id },
      data: { isLocked: false }
    });

    return await message.reply(
      `🔓 **National Team Unlocked:** **${nation.name}** ${nation.flag} (\`${nation.alias.toUpperCase()}\`) is now **UNLOCKED**! Players may now join using \`-joinnation ${nation.alias}\`.`
    );
  } else {
    const club = await prisma.footballClub.findUnique({ where: { alias } });
    if (!club) {
      return await message.reply(`❌ Football club with alias \`${alias}\` not found.`);
    }
    if (!club.isLocked) {
      return await message.reply(`ℹ️ **${club.name}** ${club.badge} is already unlocked!`);
    }

    await prisma.footballClub.update({
      where: { id: club.id },
      data: { isLocked: false }
    });

    return await message.reply(
      `🔓 **Football Club Unlocked:** **${club.name}** ${club.badge} (\`${club.alias.toUpperCase()}\`) is now **UNLOCKED**! Players may now join using \`-joinclub ${club.alias}\`.`
    );
  }
}
