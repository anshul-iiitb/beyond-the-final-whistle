const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  AttachmentBuilder 
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const token = process.env.DISCORD_TOKEN;
const GUILD_ID = '1574068651915743272';
const CHANNEL_ID = '1574439115783409845'; // #live-match

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

function makeDualProgressBar(valA, valB, length = 10, fillA = '▰', fillB = '▱') {
  const total = valA + valB;
  if (total <= 0) return fillA.repeat(5) + fillB.repeat(5);
  const ratioA = valA / total;
  const countA = Math.round(ratioA * length);
  const countB = Math.max(0, length - countA);
  return `${fillA.repeat(countA)}${fillB.repeat(countB)}`;
}

client.once('clientReady', async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found!');
    process.exit(1);
  }

  const channel = guild.channels.cache.get(CHANNEL_ID);
  if (!channel || !channel.isTextBased()) {
    console.error('❌ Target #live-match channel not found!');
    process.exit(1);
  }

  console.log(`🏟️ Starting live match simulation in #${channel.name}...`);

  // Fetch emojis
  const finalEmojis = await guild.emojis.fetch();
  const getGuildEmoji = (name, fallback = '') => {
    const found = finalEmojis.find(e => e.name?.toLowerCase() === name.toLowerCase());
    return found ? found.toString() : fallback;
  };

  const E = {
    coin: getGuildEmoji('coin', '🪙'),
    stamina: getGuildEmoji('stamina', '⚡'),
    tp: getGuildEmoji('tp', '🤹‍♂️'),
    motm: getGuildEmoji('motm', '👑'),
    worldcup: getGuildEmoji('worldcup', '🏆'),
    strika: getGuildEmoji('strika', '⚡'),
    passa: getGuildEmoji('passa', '👟'),
    bully: getGuildEmoji('bully', '🛡️'),
  };

  const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  const SUB_DIVIDER = '───────────────────────────';

  // ==========================================
  // 1. PRE-MATCH LINEUPS & TACTICAL BRIEFING
  // ==========================================
  const previewEmbed = new EmbedBuilder()
    .setColor('#16a34a') // Pitch Green
    .setTitle('🏟️ MATCHDAY BROADCAST — LIVE STADIUM PREVIEW & TACTICS')
    .setDescription(
      `> *Welcome to the International Stadium! Today's exhibition clash features a battle of tactical philosophies: Tactical Prodigies XI vs Base 50 Rookies XI.*\n\n` +
      `### 🔵 TACTICAL PRODIGIES XI (OVR: 85)\n` +
      `• 🎯 **K. Vance** \`[ PCH — Poacher ]\` — FIN: \`88\` • CMP: \`86\` • AGI: \`84\` • PAC: \`86\`\n` +
      `• 🔋 **M. Silva** \`[ ANC — Anchor ]\` — TCK: \`86\` • WRK: \`88\` • PAS: \`82\` • PHY: \`84\`\n` +
      `• 🧠 **L. De Jong** \`[ BPD — Ball-Playing Def ]\` — INT: \`88\` • PAS: \`85\` • CMP: \`86\` • DEF: \`85\`\n` +
      `⚙️ **Tactical Setup:** \`Attacking\` • \`Through The Middle\` • \`Short (Tiki-Taka)\` • \`High Press\` • \`Hard Tackling\` • \`Offside Trap ON\`\n\n` +
      `### 🔴 BASE 50 ROOKIES XI (OVR: 50)\n` +
      `• ⚽ **Rookie Striker** \`[ ATT: 50 ]\` — FIN: \`50\` • PAC: \`50\` • CMP: \`50\`\n` +
      `• 🏃 **Rookie Midfielder** \`[ MID: 50 ]\` — PAS: \`50\` • VIS: \`50\` • DRI: \`50\`\n` +
      `• 🛑 **Rookie Defender** \`[ DEF: 50 ]\` — TCK: \`50\` • INT: \`50\` • PHY: \`50\`\n` +
      `⚙️ **Tactical Setup:** \`Defensive\` • \`Mixed Focus\` • \`Long Ball\` • \`Low Block\` • \`Normal Tackling\` • \`Offside Trap OFF\`\n\n` +
      `${DIVIDER}\n` +
      `📢 **Referee signals captains to the center circle... Kickoff in 5 seconds!**`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Matchday Telemetry' })
    .setTimestamp();

  await channel.send({ embeds: [previewEmbed] });
  await sleep(4000);

  // ==========================================
  // 2. LIVE MATCH SIMULATION LOOP
  // ==========================================
  let homeScore = 0;
  let awayScore = 0;
  let homePossession = 64;
  let awayPossession = 36;
  const commentaryLog = [];

  const initialMatchEmbed = new EmbedBuilder()
    .setColor('#0ea5e9') // Sky Blue
    .setTitle(`⚽ LIVE: Tactical Prodigies ${homeScore} – ${awayScore} Base 50 Rookies [0']`)
    .setDescription(
      `📊 **Live Possession:**\n` +
      `**Tactical Prodigies** \`${homePossession}%\` ${makeDualProgressBar(homePossession, awayPossession, 10)} \`${awayPossession}%\` **Base 50 Rookies**\n\n` +
      `${DIVIDER}\n` +
      `### ⚡ LIVE COMMENTARY FEED\n` +
      `**[0'] 🏟️ KICKOFF AT THE STADIUM!**\n` +
      `The referee blows the opening whistle! Tactical Prodigies in their deep blue strip get the match underway, immediately circulating short tiki-taka passes from the back.`
    )
    .setFooter({ text: 'Live Match Broadcast • Beyond The Final Whistle' })
    .setTimestamp();

  const liveMessage = await channel.send({ embeds: [initialMatchEmbed] });
  await sleep(3500);

  const incidents = [
    {
      minute: 14,
      header: '🪄 SLICED THROUGH THE MIDDLE',
      text: 'Leo De Jong (BPD) reads the play beautifully with an interception, advances into midfield, and threads a laser-guided 35-yard vertical through-ball past the rookie midfield line into Vance\'s path! The rookie goalkeeper scurries off his line to parry!',
      scoreChange: false
    },
    {
      minute: 27,
      header: '💥 CRUNCHING HARD TACKLE',
      text: 'Mateo Silva (Anchor) flies into a fierce, perfectly timed challenge on the halfway line! The hard tackling tactic rattles the rookie playmaker, dispossessing them cleanly and sparking another wave of possession!',
      scoreChange: false
    },
    {
      minute: 38,
      header: '⚽ GOAL! TACTICAL PRODIGIES BREAK THE DEADLOCK!',
      text: 'Mateo Silva slides a clever disguised pass into the penalty box. Marcus Vance (Poacher) spins on a sixpence, shows ice-cold composure, and drives a low finish right into the bottom left corner! The striker wheeling away in celebration! (1 – 0)',
      scoreChange: true,
      homeDelta: 1
    },
    {
      minute: 45,
      header: '⏸️ HALF TIME WHISTLE BLOWN',
      text: 'Tactical Prodigies dominate the opening 45 minutes! Their 65% possession, crisp short passing, and suffocating high press have starved Base 50 Rookies of any service in the attacking third.',
      scoreChange: false
    },
    {
      minute: 59,
      header: '🚩 OFFSIDE TRAP TRIGGERED!',
      text: 'Base 50 Rookies attempt a desperate route-one long ball forward. But De Jong and the backline step up in complete synchronization! The assistant referee instantly raises the flag — offside! Tactical discipline on full display.',
      scoreChange: false
    },
    {
      minute: 73,
      header: '🔥 HIGH-PRESS TURNOVER & GOAL! VANCE BRACE!',
      text: 'Tactical Prodigies\' relentless high press bears fruit! Silva and Vance aggressively swarm the rookie defender near their own penalty box, winning the ball back in seconds. Vance looks up and lashes an unstoppable strike into the top postage stamp! (2 – 0)',
      scoreChange: true,
      homeDelta: 1
    },
    {
      minute: 85,
      header: '⚡ LIGHTNING COUNTER-ATTACK TRANSITION',
      text: 'Base 50 attempt a rare set-piece cross, but De Jong rises majestically to head clear. Within three touches, Silva initiates a blistering 3-on-2 counter-attack down the middle! Vance forces a diving fingertip save from the keeper!',
      scoreChange: false
    },
    {
      minute: 90,
      header: '🏁 FULL TIME WHISTLE — TACTICAL MASTERCLASS!',
      text: 'The referee blows for full time! A comprehensive 2 – 0 victory for Tactical Prodigies XI. Complete dominance in possession, zero shots conceded, and clinical finishing from Marcus Vance!',
      scoreChange: false
    }
  ];

  for (const inc of incidents) {
    if (inc.scoreChange && inc.homeDelta) {
      homeScore += inc.homeDelta;
    }

    commentaryLog.push(`**[${inc.minute}'] ${inc.header}**\n${inc.text}`);

    const isFullTime = inc.minute === 90;
    const embedColor = isFullTime ? '#16a34a' : inc.scoreChange ? '#f59e0b' : '#0ea5e9';

    const updatedEmbed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(`⚽ ${isFullTime ? 'FULL TIME' : 'LIVE'}: Tactical Prodigies ${homeScore} – ${awayScore} Base 50 Rookies [${inc.minute}']`)
      .setDescription(
        `📊 **Match Possession:**\n` +
        `**Tactical Prodigies** \`${homePossession}%\` ${makeDualProgressBar(homePossession, awayPossession, 10)} \`${awayPossession}%\` **Base 50 Rookies**\n\n` +
        (isFullTime ? `${E.motm} **Player of the Match:** **Marcus Vance (PCH)** \`[ 8.9 Rating • 2 Goals ]\` 🌟\n\n` : '') +
        `${DIVIDER}\n` +
        `### ⚡ LIVE MATCH HIGHLIGHTS\n\n` +
        commentaryLog.slice(-4).join('\n\n')
      )
      .setFooter({ text: 'Beyond The Final Whistle • Match Engine' })
      .setTimestamp();

    await liveMessage.edit({ embeds: [updatedEmbed] });
    console.log(`  ✓ Updated match minute [${inc.minute}'] Score: ${homeScore} - ${awayScore}`);
    await sleep(3500);
  }

  // ==========================================
  // 3. POST-MATCH TELEMETRY & PLAYER RATINGS CARD
  // ==========================================
  const telemetryEmbed = new EmbedBuilder()
    .setColor('#16a34a')
    .setTitle('📊 OFFICIAL MATCH TELEMETRY & PERFORMANCE RATINGS')
    .setDescription(
      `> *Comprehensive post-match biometric and positional analytics for Tactical Prodigies vs Base 50 Rookies.*\n\n` +
      `### 🌟 TACTICAL PRODIGIES PLAYER RATINGS\n` +
      `• 🎯 **Marcus Vance** \`[ PCH — Poacher ]\` — **Rating: 8.9** ${E.motm}\n` +
      `  Stats: \`2 Goals\` ⚽ • \`5 Shots (4 on Target)\` • \`2 Dribbles Won\`\n` +
      `• 🔋 **Mateo Silva** \`[ ANC — Anchor ]\` — **Rating: 8.3**\n` +
      `  Stats: \`1 Assist\` 👟 • \`6 Tackles Won (100%)\` 🛑 • \`4 Interceptions\` • \`1 Foul\` 🟨\n` +
      `• 🧠 **Leo De Jong** \`[ BPD — Ball-Playing Def ]\` — **Rating: 8.5**\n` +
      `  Stats: \`52/55 Passes Completed (95%)\` 🪄 • \`7 Interceptions\` • \`Clean Sheet\` 🧤\n\n` +
      `### 🔴 BASE 50 ROOKIES PLAYER RATINGS\n` +
      `• ⚽ **Rookie Striker:** \`Rating: 6.0\` — 0 Shots, 3 Times Caught Offside 🚩\n` +
      `• 🏃 **Rookie Midfielder:** \`Rating: 6.1\` — 18/25 Passes, Dispossessed 5 times\n` +
      `• 🛑 **Rookie Defender:** \`Rating: 5.8\` — 2 Tackles, 1 Critical Turnover Conceded\n\n` +
      `${DIVIDER}\n` +
      `*Tactical Takeaway: Short Passing (Tiki-Taka) and High Pressing completely neutralized the opposition's long-ball strategy while the Poacher-Anchor-BPD spine executed with 100% tactical efficiency.*`
    )
    .setFooter({ text: 'Beyond The Final Whistle • Federation Analytics' })
    .setTimestamp();

  await channel.send({ embeds: [telemetryEmbed] });
  await sleep(1500);

  // ==========================================
  // 4. SENSATIONAL AI SPORTS GAZETTE NEWSPAPER
  // ==========================================
  const newspaperEmbed = new EmbedBuilder()
    .setColor('#f59e0b')
    .setTitle('📰 THE DAILY WHISTLE — MATCHDAY GAZETTE & REPORT')
    .setDescription(
      `>>> **TACTICAL MASTERCLASS: VANCE BRACE POWERS PRODIGIES TO CRUSHING VICTORY**\n\n` +
      `*By Chief Football Correspondent | Beyond The Final Whistle Press Bureau*\n\n` +
      `**THE STADIUM** — In an exhilarating demonstration of tactical superiority, Tactical Prodigies XI dismantle Base 50 Rookies in a commanding 2–0 triumph that underlined the sheer importance of tactical synergy.\n\n` +
      `From the opening whistle, the contrast in philosophy was stark. Tactical Prodigies deployed a suffocating high-pressing block coupled with short, incisive tiki-taka passing through the middle. Anchored by the impenetrable Mateo Silva and directed from deep by the cultured vision of Leo De Jong, the Prodigies suffocated the pitch.\n\n` +
      `The breakthrough arrived in the 38th minute when Marcus Vance showed why he is considered one of the deadliest poachers in the federation, latching onto Silva's delicate vertical ball to slot home. Vance doubled the advantage in the 73rd minute with a thunderous effort following a turnover forced by their relentless pressing.\n\n` +
      `Base 50 Rookies sought relief with long aerial punts, but De Jong stepped up to execute the offside trap with mathematical precision, completely extinguishing their forward threat.\n\n` +
      `*"Our tactical discipline was flawless today,"* declared Man of the Match Marcus Vance in the post-match press conference. *"When our Ball-Playing Defender steps up and our Anchor breaks up play, my job in the box becomes pure instinct."*\n\n` +
      `${SUB_DIVIDER}\n` +
      `-# 📡 Published by the AI Sports Journalism Bureau • Beyond The Final Whistle`
    )
    .setFooter({ text: 'AI Sports Journalism Engine • Beyond The Final Whistle' })
    .setTimestamp();

  const newsFiles = [];
  const newsImgPath = path.resolve(process.cwd(), 'assets/match_news.png');
  if (fs.existsSync(newsImgPath)) {
    newsFiles.push(new AttachmentBuilder(newsImgPath, { name: 'match_news.png' }));
    newspaperEmbed.setImage('attachment://match_news.png');
  }

  await channel.send({
    content: '📢 **@News Ping**',
    embeds: [newspaperEmbed],
    files: newsFiles
  });

  console.log('\n🎉 LIVE MATCH SIMULATION COMPLETED IN #live-match!');
  process.exit(0);
});

client.login(token);
