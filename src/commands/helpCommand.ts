import { Message, EmbedBuilder } from 'discord.js';

export async function handleHelpCommand(message: Message) {
  const embed = new EmbedBuilder()
    .setColor('#3b82f6')
    .setTitle('📖 Beyond The Final Whistle (BTFW) — Master Command Guide')
    .setDescription(
      `Welcome to **Beyond The Final Whistle**, an immersive multiplayer Football Career simulation MMORPG!\n\n` +
      `You are a rising football prodigy called up to the international stage. Train on the spatial campus, sign commercial brand deals, purchase supercars, and dominate AI-simulated matches!`
    )
    .addFields(
      {
        name: '👤 Player Profile & Career Tabs',
        value:
          '• `-profile [@user]` — View complete player card with interactive tab buttons:\n' +
          '  `👤 Main Profile` • `📊 Detailed Stats` • `🎯 Attributes Matrix`\n' +
          '• `-setdesc <text>` — Set your personal bio (up to 100 characters).\n' +
          '• `-lb [category]` — View leaderboards (`goals`, `wealth`, `followers`, `ovr`).\n' +
          '• `-give @user <amount>` — Transfer funds to a teammate.\n' +
          '• `-joinnation <alias>` — Join a National Team (`ger`, `por`, `esp`, `fra`, `eng`, `bra`, etc.) and get a **100k 🪙 + 100k 👤** welcome bonus!'
      },
      {
        name: '🏟️ Spatial Football Campus (-locations)',
        value:
          '• `-travel <alias>` — Move between facilities (20m base cooldown, reduced by cars).\n' +
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
          '  🟢 `⚽ Normal Training` (+1-2 🤹‍♂️ TP, 30m cooldown, 5 ⚡ stamina)\n' +
          '  🔵 `👑 VIP Training` (+6 🤹‍♂️ TP, 6h cooldown, 5 ⚡ stamina)\n' +
          '  🔴 `👑 No Effort Training` (+20 🤹‍♂️ VIP / +50 🤹‍♂️ Premium, 50 ⚡ stamina, 1/day)\n' +
          '  *Training attaches authentic pitch drill photography and updates stats!*\n' +
          '• `-sptrain <attr>` / `-upgrade` — Permanently boost attribute at Research Lab (costs 50 stamina & 3-15 dynamic TP).\n' +
          '• `-convert <playstyle>` — Change tactical role at Research Lab (7-day cooldown).\n' +
          '• `-recovery` — Relax in Sauna to recover +30 stamina (+100 for VIP, 12h cooldown).'
      },
      {
        name: '🛍️ Market & Matchday Gear (-gm, -shop)',
        value:
          '• `-gm` / `-shop` / `-buy` — Open the Global Market catalog with live gear info!\n' +
          '• `-buy sd` — **Sports Drink** (Recovers 50 stamina | 100k 🪙)\n' +
          '• `-buy strika` — **Strika Boots** (+10 Attack for next match | 500k 🪙)\n' +
          '• `-buy passa` — **Passa Boots** (+10 Midfield for next match | 500k 🪙)\n' +
          '• `-buy bully` — **Bully Boots** (+10 Defence for next match | 500k 🪙)\n' +
          '• `-intel` — Claim opposition scouting report at Intel Hub (+1 to +6 match bonus).'
      },
      {
        name: '📸 Sponsorships & Fan Socials',
        value:
          '• `-advert` — Opens interactive Brand Sponsorship Menu with 5 buttons:\n' +
          '  🍺 Heineken (100k 👤) • 👟 Adidas (1M 👤) • 🥤 Coca-Cola (5M 👤) • 🎬 Netflix (6M 👤) • ✔️ Nike (8M 👤)\n' +
          '  *Attaches commercial video GIF inside the result box!*\n' +
          '• `-coaching` — Coach academy youth at Local Club (+50k coins, 2h cooldown).\n' +
          '• `-meetgreet` — Sign autographs at Local Club (+50k followers, 2h cooldown).\n' +
          '• `-tweet <text>` / `-chirp` — Post to TwitFeed with blue bird icon and interactive `👍` / `👎` buttons (👍 +100k fans, 👎 -50k fans + DMs).'
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
          '• `-setup` — Automatically build the 8 Campus channels with bracket logos.\n' +
          '• `-setupemojis` (or `-emojis`) — Auto-upload custom high-definition WITS server emojis (:stamina:, :coin:, :tp:, :worldcup:, :strika:, :passa:, :bully:, :zztick:, :zzcross:).\n' +
          '• `-vip add invite/boost @user` — Grant 30 days of VIP status.\n' +
          '• `-additem <symbol> @user` — Award collectible trophies & symbols (e.g. `-additem :worldcup: @user`).\n' +
          '• `-addvar <var> <val> @user` — Adjust player attributes/coins/stamina.\n' +
          '• `-gitpull` — Hot-pull latest commit from GitHub and reload.\n' +
          '• `-gitpullback` — Emergency restore to previous stable commit.'
      }
    )
    .setFooter({ text: 'Beyond The Final Whistle • Prefix: -' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}
