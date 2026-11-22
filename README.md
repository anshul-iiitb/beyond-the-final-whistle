# ⚽ Beyond The Final Whistle (BTFW)

> **Massive Multiplayer Football Career Simulation RPG for Discord**  
> Direct reproduction of WITS mechanics with state-of-the-art AI match simulation and sports journalism.

---

## 🌟 Highlights

- **Spatial Football Campus**: 8 distinct facilities connected by spatial travel (`-travel tc`, `rf`, `gm`, `ph`, `ps`, `lc`, `vs`, `ih`).
- **Vehicle Showroom**: 10 luxury cars and hypercars slashing base travel cooldowns from 20 minutes down to 1 minute.
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
| | `-setdesc <text>` | Set personal profile bio (up to 100 chars) |
| | `-lb [category]` | Server leaderboards (`goals`, `assists`, `motm`, `coins`, `followers`, `tp`) |
| | `-give @user <amount>` | Wire transfer coins to another player |
| | `-joinnation <alias>` | Pledge loyalty to national squad (`ger`, `por`, `esp`, `fra`, etc.) |
| **Campus** | `-locations` | View campus facilities directory |
| | `-travel <alias>` | Travel to facility (`tc`, `rf`, `gm`, `ph`, `ps`, `lc`, `vs`, `ih`) |
| | `-showroom` | Inspect exotic vehicles catalog |
| | `-vehiclebuy <alias>` | Buy vehicle to slash travel cooldown |
| **Training** | `-train [vip/noeffort]` | Run pitch drills at Training Center |
| | `-sptrain <attr>` | Boost attribute with TP at Research Lab (costs 50 stamina & 3-15 dynamic TP) |
| | `-convert <playstyle>` | Convert tactical role at Research Lab (7-day cooldown) |
| | `-recovery` | Restore stamina at Player Sauna (+30 normal, +100 premium, 12h cooldown) |
| **Market** | `-buy sd` | Buy Sports Drink (+50 stamina, 100k coins) |
| | `-buy <strika/passa/bully>` | Matchday performance boots (+10 ATK/MID/DEF, 500k coins) |
| | `-intel` | Opposition tactical scouting dossier (+1 to +6 match bonus) |
| **Socials** | `-advert [brand]` | Sign commercial brand deal at Photoshoot Hall |
| | `-coaching` | Coach academy youth at Local Club (+50k coins, 2h cooldown) |
| | `-meetgreet` | Autograph signing session at Local Club (+50k followers, 2h cooldown) |
| | `-chirp <text>` | Post tweet to TwitFeed (👍 +100k, 👎 -50k) |
| **Matches** | `-match [@user]` | Simulate 90-minute match with AI commentary & newspaper |
| | `-intstats [@user]` | International tournament statistics |
| | `-clubstats [@user]` | Franchise club career stats |
| | `-roster <alias>` | View national team squad lineup |
| **Admin** | `-setup` | Automatically build 8 campus channels with bracket icons |
| | `-vip add invite/boost @user` | Grant 30 days of VIP status |
| | `-additem <item> @user` | Award collectible trophies |
| | `-addvar <var> <val> @user` | Adjust attributes or currency |
