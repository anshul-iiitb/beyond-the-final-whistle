# ⚽ Beyond The Final Whistle (BTFW)

> **Massive Multiplayer Football Career Simulation RPG for Discord**  
> Direct reproduction of WITS mechanics with state-of-the-art AI match simulation and sports journalism.

---

## 🌟 Highlights

- **Spatial Football Campus**: 7 unified facilities connected by spatial travel (`-travel tc`, `rf`, `ch`, `gm`, `ph`, `ih`, `ah`), with all facility commands strictly locked to their respective Discord channel and location (`-tweet` works anywhere and publishes to locked `#twitter`).
- **Vehicle Showroom**: 16 luxury cars and hypercars slashing base travel cooldowns from 20 minutes down to 1 minute.
- **15 Granular Football Attributes**:
  - *Attacking*: Finishing (`FIN`), Shot Power (`POW`), Heading (`HEA`)
  - *Technical*: Passing (`PAS`), Vision (`VIS`), Crossing (`CRO`), Dribbling (`DRI`)
  - *Defending*: Tackling (`TCK`), Interceptions (`INT`), Marking (`MRK`)
  - *Physical & Mental*: Pace (`PAC`), Physicality (`PHY`), Composure (`CMP`), Agility (`AGI`), Work Rate (`WRK`)
  - *Derived Ratings*: `ATK`, `MID`, `DEF`
- **2-Step Mandatory Rookie Onboarding**:
  - Step 1: `-playstyle [choice|list]` chooses tactical role, sets position (`ATT`, `MID`, `DEF`), and unlocks `#training-center` (`tc`).
  - Step 2: `-joinnation <alias>` signs for a National Team, awards **+100,000 coins** and **+100,000 followers**, and unlocks all campus facilities.
- **18 Balanced Tactical Playstyles (6 Strikers, 6 Midfielders, 6 Defenders)**:
  - *Strikers (ATT)*: Poacher (`PCH`), False Nine (`F9`), Target Man (`TGT`), Speedster (`SPD`), Inside Forward (`INF`), Pressing Forward (`PFW`)
  - *Midfielders (MID)*: Enganche (`ENG`), Box-to-Box (`B2B`), Mezzala (`MEZ`), Regista (`REG`), Ball Winner (`BWM`), Anchor Man (`ANC`)
  - *Defenders (DEF)*: No-Nonsense DC (`NND`), Ball Playing DC (`BPD`), Stopper (`STP`), Covering Defender (`COV`), Aerial Titan (`AER`), Wide Centre-Back (`WCB`)
- **Key Stat Mastery & 15% TP Discount**:
  - Each playstyle has 3 Key Stats granting a **15% TP discount** when upgraded at the Biomechanics Lab (`-sptrain`).
  - In-match Key Stat Mastery tiers (`Specialist` 70+, `Elite` 80+, `World Class` 90+) drive duel victory rates, rating floors, and signature traits.
- **AI-Powered Match Engine**:
  - 90-minute narrative tactical commentary with goals, assists, saves, tackles, and cards.
  - Generates sensational newspaper articles with headlines, MOTM, and post-match player quotes.
- **Player Economy & Socials**:
  - Commercial sponsorships: Heineken, Adidas, Coca-Cola, Netflix.
  - Interactive tweet feed with follower shifts via reactions (`👍` +100k, `👎` -50k).
  - 5% Daily Lost Relevancy decay and 5% wealth tax on balances over 1M.

---

## 🚀 Quick Commands Reference

| Category | Command | Description |
| :--- | :--- | :--- |
| **Onboarding** | `-playstyle [choice]` | Step 1/2: Choose tactical role & unlock Training Center (`tc`) |
| | `-joinnation <alias>` | Step 2/2: Sign for national squad (+100k coins & followers) & unlock campus |
| **Profile** | `-profile [@user]` | View complete player card, attributes, and garage |
| | `-theme [alias]` | Browse and apply 20 custom stadium backdrop themes |
| | `-referral [@user]` | Credit recruiter at 50 TP to award 7 days VIP / view referral status |
| | `-daily` | Claim daily matchday check-in stipend (streak rewards & 7-day bonus) |
| | `-cd` / `-cooldowns` | Unified personal countdowns dashboard across all facilities |
| | `-setdesc <text>` | Set personal profile bio (up to 100 chars) |
| | `-lb [category]` | Server leaderboards (`goals`, `wealth`, `followers`, `ovr`) |
| | `-give @user <amount>` | Wire transfer coins to another player |
| **Campus** | `-locations` | View campus facilities directory |
| | `-travel <alias>` | Travel to facility (`tc`, `rf`, `ch`, `gm`, `ph`, `ih`, `ah`) |
| | `-showroom` | Inspect exotic vehicles catalog (`gm`) |
| | `-vehiclebuy <alias>` | Buy vehicle to slash travel cooldown (`gm`) |
| **Training** | `-train [vip/noeffort]` | Run pitch drills at Training Center (`tc`, Normal: 1h, +2-4 TP) |
| | `-sptrain <attr>` | Boost attribute with TP at Research Lab (`rf`, 50 stamina & 3-15 TP) |
| | `-convert <playstyle>` | Convert tactical role at Research Lab (`rf`, 7-day cooldown) |
| | `-recovery` | Restore stamina at Player Clubhouse (`ch`, +30/+100, 12h cooldown) |
| **Market** | `-buy sd [qty]` / `-use sd` | Buy and consume stackable Energy Drinks (+50 stamina) |
| | `-buy <strika/passa/bully>` | Position-matched boots at Global Market (`gm`, +10 ATK/MID/DEF) |
| | `-intel` | Opposition tactical scouting dossier at Intel Hub (`ih`, +1 to +6 boost) |
| **Sportsbook** | `-fixtures` | View upcoming official matches calendar |
| | `-odds [fixture#]` | Algorithmic multipliers based on OVR, boots, TP, and stadiums |
| | `-bet <#>` `<pick>` `<amt>` | Place matchday wager (Strict 50k limit, closes 30m prior to match) |
| | `-bets` | Inspect active and settled betting slips |
| **Nations & Clubs** | `-joinnation <alias>` | Sign for a National Team (enforces squad roster capacity) |
| | `-joinclub <alias>` | Sign for a Football Club (enforces squad roster capacity) |
| | `-intteam [alias]` | National Team starting lineup, specialists & tactical playbook |
| | `-teamlimits` | View squad roster counts and maximum capacity limits across all teams |
| | `-intset <role> @user` | Designate starting lineup slots and set-piece specialists |
| | `-stadium [upgrade/name]` | Upgrade club stadium (Levels 1-5, up to 90,000 capacity) |
| | `-potw` | Player of the Week race tracked from live matchday telemetry |
| **Socials** | `-advert [brand]` | Sign commercial brand deal at Photoshoot Hall (`ph`) |
| | `-coaching` | Coach academy youth at Player Clubhouse (`ch`, +50k coins, 2h cooldown) |
| | `-meetgreet` | Autograph signing session at Player Clubhouse (`ch`, +50k followers, 2h cooldown) |
| | `-chirp <text>` / `-tweet` | Post to locked `#twitter` w/ 👍/👎 votes + 👥 `Voters` inspector |
| **Auctions** | `-ah` / `-bid <amt> [lot#]` | View or bid on collectible auctions (`ah`) |
| **Matches** | `-match [@user]` | Simulate 90-minute match with AI commentary & newspaper |
| | `-friendly [@user]` | 👑 VIP All-Star Exhibition (zero stat loss, +1-2 MOTM boost, challenge button) |
| | `-intstats [@user]` | International tournament statistics |
| | `-clubstats [@user]` | Franchise club career stats |
| | `-roster <alias>` | View national team squad lineup |
| **Admin & VIP** | `-vip [perks]` | View full VIP Privileges & Super-Perks or manage duration |
| | `-setup` | Automatically build campus channels, friendly ground & VIP lounge |
| | `-setlimit <nation\|club> <alias\|all> <limit>` | Set maximum squad roster player limits |
| | `-locknation <alias>` / `-unlocknation <alias>` | Lock or unlock nations from player registration |
| | `-teamlimits` | View squad roster counts and capacity limits across all teams |
| | `-vip give @user <days>` | Grant timed VIP status |
| | `-auctionhalt` / `-auctionresume` | Pause active auctions (freezing time left) and resume later |
| | `-testmatch <o1> <o2> <on\|off> <on\|off>` | Simulate a controlled OVR/boot test match in `#live-match` |
| | `-additem <item> @user` | Award collectible trophies |
| | `-addvar <var> <val> @user` | Adjust attributes or currency |
