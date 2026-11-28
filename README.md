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
- **9 Tactical Playstyles**:
  - Attacker: Poacher (`PCH`), Speedster (`SPD`), Target Man (`TGT`)
  - Midfielder: Playmaker (`PLM`), Box-to-Box (`B2B`), Anchor (`ANC`)
  - Defender: Stopper (`STP`), Sweeper (`SWP`), Ball-Playing Defender (`BPD`)
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
| **Profile** | `-profile [@user]` | View complete player card, attributes, and garage |
| | `-theme [alias]` | Browse and apply 20 custom stadium backdrop themes |
| | `-daily` | Claim daily matchday check-in stipend (streak rewards & 7-day bonus) |
| | `-cd` / `-cooldowns` | Unified personal countdowns dashboard across all facilities |
| | `-setdesc <text>` | Set personal profile bio (up to 100 chars) |
| | `-lb [category]` | Server leaderboards (`goals`, `wealth`, `followers`, `ovr`) |
| | `-give @user <amount>` | Wire transfer coins to another player |
| | `-joinnation <alias>` | Pledge loyalty to national squad (locked after 3 official caps) |
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
| **Nations & Clubs** | `-intteam [alias]` | National Team starting lineup, specialists & tactical playbook |
| | `-intset <role> @user` | Designate starting lineup slots and set-piece specialists |
| | `-stadium [upgrade/name]` | Upgrade club stadium (Levels 1-5, up to 90,000 capacity) |
| | `-potw` | Player of the Week race tracked from live matchday telemetry |
| **Socials** | `-advert [brand]` | Sign commercial brand deal at Photoshoot Hall (`ph`) |
| | `-coaching` | Coach academy youth at Player Clubhouse (`ch`, +50k coins, 2h cooldown) |
| | `-meetgreet` | Autograph signing session at Player Clubhouse (`ch`, +50k followers, 2h cooldown) |
| | `-chirp <text>` / `-tweet` | Post to locked `#twitter` w/ 👍/👎 votes + 👥 `Voters` inspector |
| **Auctions** | `-ah` / `-bid <amt> [lot#]` | View or bid on collectible auctions (`ah`) |
| **Matches** | `-match [@user]` | Simulate 90-minute match with AI commentary & newspaper |
| | `-intstats [@user]` | International tournament statistics |
| | `-clubstats [@user]` | Franchise club career stats |
| | `-roster <alias>` | View national team squad lineup |
| **Admin** | `-setup` | Automatically build 7 campus channels & VIP lounge |
| | `-vip give @user <days>` | Grant timed VIP status |
| | `-auctionhalt` / `-auctionresume` | Pause active auctions (freezing time left) and resume later |
| | `-testmatch <o1> <o2> <on\|off> <on\|off>` | Simulate a controlled OVR/boot test match in `#live-match` |
| | `-additem <item> @user` | Award collectible trophies |
| | `-addvar <var> <val> @user` | Adjust attributes or currency |
