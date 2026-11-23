import { Message, EmbedBuilder } from 'discord.js';
import { getEmoji } from '../utils/emojiHelper.js';
import { THEME_COLORS, UI, subtext } from '../utils/themeHelper.js';

export async function handleHelpCommand(message: Message) {
  const guild = message.guild;
  const coin = getEmoji(guild, 'coin');
  const tp = getEmoji(guild, 'tp');
  const stamina = getEmoji(guild, 'stamina');
  const followers = getEmoji(guild, 'followers');
  const sd = getEmoji(guild, 'sd');
  const strika = getEmoji(guild, 'strika');
  const passa = getEmoji(guild, 'passa');
  const bully = getEmoji(guild, 'bully');
  const worldcup = getEmoji(guild, 'worldcup');
  const heineken = getEmoji(guild, 'heineken');
  const adidas = getEmoji(guild, 'adidas');
  const cocacola = getEmoji(guild, 'cocacola');
  const netflix = getEmoji(guild, 'netflix');
  const nike = getEmoji(guild, 'nike');

  const embed = new EmbedBuilder()
    .setColor(THEME_COLORS.COBALT)
    .setTitle('📖 Beyond The Final Whistle (BTFW) — Master Command Directory')
    .setDescription(
      `> *Multiplayer football career MMORPG! Train on the spatial campus, sign lucrative commercial brand sponsorships, collect supercars, and dominate AI-simulated matches!*\n\n` +
      `**Prefix:** \`-\` • **Target Server:** Beyond The Final Whistle\n` +
      `${UI.DIVIDER}`
    )
    .addFields(
      {
        name: '👤 Player Profile & Career Dossier',
        value:
          '• `-profile [@user]` — View complete player card with interactive tabs:\n' +
          '  `👤 Overview` • `📊 Match Telemetry` • `🎯 Biomechanics Matrix`\n' +
          '• `-setdesc <text>` — Set your personal bio (up to 100 characters).\n' +
          '• `-lb [category]` — View leaderboards (`goals`, `wealth`, `followers`, `ovr`).\n' +
          '• `-give @user <amount>` — Transfer funds to a teammate.\n' +
          `• \`-joinnation <alias>\` — Join a National Team (\`ger\`, \`por\`, \`esp\`, \`fra\`, \`eng\`, \`bra\`, etc.) and get a **100k ${coin} + 100k ${followers}** welcome bonus!`
      },
      {
        name: '🏟️ Spatial Football Campus (-locations)',
        value:
          '• `-travel <alias>` — Fast-travel between facilities (20m base cooldown, reduced by cars).\n' +
          '  `tc`: Training Center • `rf`: Research Facility • `gm`: Global Market\n' +
          '  `ph`: Photoshoot Hall • `ps`: Player Sauna • `lc`: Local Club\n' +
          '  `vs`: Showroom • `ih`: Intel Hub\n' +
          '• `-showroom` — Inspect exotic vehicles catalog with side-view sprites.\n' +
          '• `-vehiclebuy <alias>` — Purchase vehicles (`basic`, `honda`, `toyota`, `porsche`, `nissan`, `audi`, `lamborghini`, `rollsroyce`, `ferrari`, `bugatti`). Slashes cooldowns down to 1 min ⏱️.'
      },
      {
        name: '🏋️ Training & Biomechanics Development',
        value:
          '• `-train` — Opens interactive Training Method picker with 3 buttons:\n' +
          `  🟢 \`⚽ Normal Training\` (+1-2 ${tp} TP, 30m cooldown, 5 ${stamina} stamina)\n` +
          `  🔵 \`👑 VIP Training\` (+6 ${tp} TP, 6h cooldown, 5 ${stamina} stamina)\n` +
          `  🔴 \`👑 No Effort Training\` (+20 ${tp} VIP, 50 ${stamina} stamina, 1/day)\n` +
          '  *Training attaches authentic pitch drill photography and updates stats!*\n' +
          `• \`-sptrain <attr>\` / \`-upgrade\` — Permanently boost attribute at Research Lab (costs 50 ${stamina} & 3-15 dynamic ${tp}).\n` +
          '• `-convert <playstyle>` — Change tactical role at Research Lab (7-day cooldown).\n' +
          `• \`-recovery\` — Relax in Sauna to recover +30 ${stamina} (+100 for VIP, 12h cooldown).`
      },
      {
        name: '🛍️ Market & Matchday Gear (-gm, -shop)',
        value:
          '• `-gm` / `-shop` / `-buy` — Open the Global Market catalog with live gear info!\n' +
          `• \`-buy sd\` — **Sports Drink** (Recovers 50 stamina ${stamina} | 100k ${coin})\n` +
          `• \`-buy strika\` — **Strika Boots** (+10 Attack for next match | 500k ${coin})\n` +
          `• \`-buy passa\` — **Passa Boots** (+10 Midfield for next match | 500k ${coin})\n` +
          `• \`-buy bully\` — **Bully Boots** (+10 Defence for next match | 500k ${coin})\n` +
          '• `-intel` — Claim opposition scouting report at Intel Hub (+1 to +6 match bonus).'
      },
      {
        name: '📸 Sponsorships & Fan Socials',
        value:
          '• `-advert` — Opens interactive Brand Sponsorship Menu with 5 buttons:\n' +
          `  ${heineken} Heineken (100k ${followers}) • ${adidas} Adidas (1M ${followers}) • ${cocacola} Coca-Cola (5M ${followers}) • ${netflix} Netflix (6M ${followers}) • ${nike} Nike (8M ${followers})\n` +
          '  *Attaches commercial video GIF inside the result box!*\n' +
          `• \`-coaching\` — Coach academy youth at Local Club (+50k ${coin}, 10 ${stamina}, 2h cooldown).\n` +
          `• \`-meetgreet\` — Sign autographs at Local Club (+50k ${followers}, 10 ${stamina}, 2h cooldown).\n` +
          `• \`-tweet <text>\` / \`-chirp\` — Post to TwitFeed with interactive \`👍\` / \`👎\` buttons (👍 +100k ${followers}, 👎 -50k ${followers} + DMs).`
      },
      {
        name: '⚽ AI Match Simulations & Newspaper',
        value:
          '• `-match [@user]` — Triggers 90-minute AI-simulated match with commentary & sports newspaper report.\n' +
          '  *Mentions `@News Ping` and attaches full matchday telemetry infographic!*\n' +
          '• `-intstats [@user]` — View full international caps, goals, and cards.\n' +
          '• `-clubstats [@user]` — View franchise club record.\n' +
          '• `-roster <alias>` — Inspect team squad lineups.'
      },
      {
        name: '👑 Admin & Server Management',
        value:
          '• `-setup` — Automatically build the Campus channels.\n' +
          '• `-setupemojis` (or `-emojis`) — Auto-upload custom high-definition server emojis.\n' +
          '• `-vip add invite/boost @user` — Grant 30 days of VIP status.\n' +
          `• \`-additem <symbol> @user\` — Award collectible trophies & symbols (e.g. \`-additem worldcup @user\` ${worldcup}).\n` +
          '• `-addvar <var> <val> @user` — Adjust player attributes/coins/stamina.\n' +
          '• `-gitpull` — Hot-pull latest commit from GitHub and reload.\n' +
          '• `-gitpullback` — Emergency restore to previous stable commit.'
      }
    )
    .setFooter({ text: 'Beyond The Final Whistle • Complete Player Guide' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
