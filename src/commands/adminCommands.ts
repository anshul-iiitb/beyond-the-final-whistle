import { Message, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { prisma } from '../database/prisma.js';
import { CAMPUS_LOCATIONS } from '../config/constants.js';
import { installCustomServerEmojis, getEmoji } from '../utils/emojiHelper.js';

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
    let category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.includes('FOOTBALL CAMPUS'));
    if (!category) {
      category = await guild.channels.create({
        name: '🏟️ FOOTBALL CAMPUS',
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionFlagsBits.ViewChannel]
          }
        ]
      });
    }

    const createdList: string[] = [];

    for (const [key, loc] of Object.entries(CAMPUS_LOCATIONS)) {
      const formattedName = `『${loc.emoji}』${loc.channelName}`;
      let channel = guild.channels.cache.find(c => c.parentId === category?.id && c.name.toLowerCase().includes(loc.channelName));

      if (!channel) {
        // Training Center is public entry for rookies; others require travel
        const isEntry = key === 'tc';
        channel = await guild.channels.create({
          name: formattedName,
          type: ChannelType.GuildText,
          parent: category.id,
          topic: `Beyond The Final Whistle: ${loc.name} • ${loc.description}`,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: isEntry ? [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] : [],
              deny: isEntry ? [] : [PermissionFlagsBits.ViewChannel]
            }
          ]
        });
      }
      createdList.push(`• **${loc.name}**: <#${channel.id}>`);
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
      `\n\n📍 Rookies spawn at \`『🏋️』training-center\`. Players unlock other facilities using \`-travel <alias>\`.`
    );
  } catch (err: any) {
    await statusMsg.edit(`❌ Setup failed: ${err.message}`);
  }
}

export async function handleVipCommand(message: Message, args: string[]) {
  if (!isAuthorized(message)) {
    return await message.reply('❌ Unauthorized.');
  }

  const targetUser = message.mentions.users.first();
  if (!targetUser) {
    return await message.reply('❌ Usage: `-vip add invite @user` or `-vip add boost @user`');
  }

  const tier = args.includes('premium') || args.includes('boost') ? 2 : 1;
  const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.player.upsert({
    where: { id: targetUser.id },
    update: { vipTier: tier, vipExpiresAt: expiry },
    create: {
      id: targetUser.id,
      username: targetUser.username,
      vipTier: tier,
      vipExpiresAt: expiry
    }
  });

  const tierName = tier === 2 ? '👑 PREMIUM' : '⭐ VIP';
  await message.reply(`✅ **${tierName} Granted** to <@${targetUser.id}> for 30 days! VIP training drills are now unlocked.`);
}

import { ITEM_CATALOG } from '../config/constants.js';

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
