# Beyond The Final Whistle — Gemini Theme Prompts & Blueprint Pack

All **8 pixel-aligned PNG blueprint templates** sit right in this same folder (`assets/themes/templates/`).
Upload any PNG file from this folder to Gemini alongside its matching prompt below, then save Gemini's generated PNG images into `assets/themes/`.

---

## 1. Universal 20-Theme Frame (`dual_box_universal_grid_template.png` — `1024x764`)
Skins `-lb`, `-showroom`, `-gm`, `-ah`, `-match`, `-intstats`, `-clubstats`, and `-help`.

```text
Using the attached 1024x764 blueprint grid image as an exact pixel-locked layout template, generate a luxury esports / Champions League broadcast glass background frame (same aesthetic quality as dark obsidian marble, metallic rims, volumetric stadium lighting, and translucent frosted glass panels).

THEME TO APPLY:
- Name: [THEME NAME]
- Palette: [bgStart -> bgEnd], metallic accent glow in [ACCENT HEX]
- Outer Border / Environment Motif: [SCENE MOTIF]

STRICT ALIGNMENT & CLEANUP RULES:
1. Keep the exact 1024x764 resolution and preserve the exact pixel positions and sizes of the two glass rectangles from the blueprint: Top Header Glass Bar (x:102, y:112, w:820, h:90) and Main Glass Content Box (x:102, y:238, w:820, h:428), plus subtle circular crest emblem holder at (x:156, y:157) and crown ornament above center.
2. Fill the interior of both boxes with deep dark semi-translucent smoky glass (#070b14 at ~80% opacity) with crisp glowing metallic thin borders so runtime overlay text stays 100% readable.
3. REMOVE all blueprint grid lines, dashed outlines, dimension labels, crosshair markers, and coordinate numbers.
4. ZERO text, letters, numbers, team names, fake scores, watermarks, or logos inside the image.
```

### 20 Profile Theme Swaps (`PROFILE_THEMES` in `src/config/constants.ts`)

| Key | `[THEME NAME]` | `[Palette]` | `[SCENE MOTIF]` |
| :--- | :--- | :--- | :--- |
| `obsidian` | Obsidian Stadium | `#090d16 -> #1e293b`, `#38bdf8` | Midnight Champions stadium bowl, ice-blue LED trim |
| `champions_gold` | Champions Gold | `#0b0904 -> #261b07`, `#f59e0b` | Molten gold trophy rims, falling amber embers, brushed gold filigree |
| `emerald_pitch` | Emerald Pitch | `#04140d -> #0b2e1e`, `#10b981` | Floodlit night pitch haze, emerald LED bevels |
| `crimson_ultras` | Crimson Ultras | `#14060a -> #330b14`, `#ef4444` | Derby flare smoke at outer corners, ruby metallic border |
| `cyber_cyan` | Cyber Telemetry | `#041219 -> #0c2c3d`, `#06b6d4` | Carbon-fiber bevels, cyan telemetry light strips along outer frame |
| `royal_cobalt` | Royal Cobalt | `#060c1f -> #132459`, `#3b82f6` | Regal cobalt searchlights sweeping behind dark stands |
| `midnight_neon` | Midnight Neon | `#090418 -> #1e0b42`, `#a855f7` | Violet/magenta arena neon strips, glossy black obsidian frame |
| `sunset_derby` | Sunset Derby | `#1a0905 -> #3b150c`, `#f97316` | Copper & burnt-orange dusk stadium sky framing outer corners |
| `aurora_nordic` | Nordic Aurora | `#041315 -> #0b2d30`, `#2dd4bf` | Shimmering teal-green northern aurora ribbon along top perimeter |
| `volcanic_flare` | Volcanic Flare | `#140606 -> #380f0f`, `#fb7185` | Cracked dark basalt corner armor with glowing magma-rose veins |
| `arctic_frost` | Arctic Frost | `#0c1524 -> #1e324d`, `#bae6fd` | Frosted steel corner plates, fine silver winter snow mist |
| `galactic_violet` | Galactic Violet | `#12051c -> #2e0d47`, `#d946ef` | Cosmic nebula black-violet backdrop, prism glass shards on edges |
| `brazilian_samba` | Samba Selecao | `#06150a -> #1b3609`, `#facc15` | Rio night floodlights, emerald & gold celebration sparks |
| `tokyo_drift` | Tokyo Night | `#110617 -> #290d2e`, `#ec4899` | Carbon trim with sleek hot-pink & cyan night bokeh streaks |
| `moroccan_atlas` | Atlas Lions | `#170607 -> #072415`, `#22c55e` | Deep burgundy-pine luxury geometric zellige frame border |
| `azteca_jade` | Azteca Jade | `#041612 -> #0c382c`, `#34d399` | Carved obsidian-jade border bevels under night floodlights |
| `wembley_arch` | Wembley Night | `#0c0c14 -> #1f2338`, `#f43f5e` | Crimson-lit sweeping steel arch silhouette behind dark stands |
| `san_siro` | San Siro Derby | `#080e1a -> #260b10`, `#e11d48` | Split twilight blue/crimson stadium flare rim along outer edges |
| `bernabeu_white` | Bernabeu Crown | `#0f131f -> #242b42`, `#fbbf24` | Brushed silver titanium frame louvers with regal gold crown trim |
| `maracana_glow` | Maracana Lights | `#07141f -> #102d47`, `#38bdf8` | Wide saucer stadium rim haloed in sky-blue & gold twilight sparks |

---

## 2. Profile Studio Banner (`profile_banner_grid_template.png` — `800x240`)
For `-profile` Overview Card & 3M Monthly Legend Banners (`zidane`, `maldini`, `cr7`, `messi`, `r9`, `henry`, `ronaldinho`, `iniesta`).

```text
Using the attached 800x240 blueprint image as an exact pixel guide, design a luxury wide football trading-card / player banner frame (800x240 PNG).

STYLE / EDITION:
- Theme or Legend Edition: [e.g., "Champions Gold" OR "Zidane Legend #10 - Royal Navy & Gold"]
- Accent Color: [HEX]

LAYOUT & ALIGNMENT RULES:
1. Keep the circular avatar socket cleanly clear at center (x:86, y:112, radius:54) with a sleek glowing metallic ring border around it, plus a small dark badge pill slot directly beneath it at (x:42, y:170, w:88, h:22).
2. Keep the center identity area (x:168..568, y:28..212) smooth, deep dark obsidian glass so crisp white overlaid typography, rank pills, and milestone badges stand out clearly.
3. Keep the right OVR rating shield panel at (x:590, y:28, w:186, h:184) styled as a bevelled dark glass stat housing with a thin metallic accent border.
4. Remove all dashed blueprint guides, coordinate labels, and grid lines. Include ZERO baked text, letters, faces, numbers, or brand logos.
```

---

## 3. Global Leaderboard Card (`leaderboard_grid_template.png` — `1000x1100`)
For `-lb ovr`, `-lb goals`, `-lb wealth`, `-lb followers`.

```text
Using the attached 1000x1100 blueprint image as a pixel-exact template, design a championship Top-10 Football Leaderboard poster frame in obsidian black silk, dark marble, volumetric floodlights, and brushed gold metallic bevels.

CATEGORY LOOK:
- Board Theme: [OVR Ratings Trophy / Golden Boot Goals / Net Worth Wealth Vault / Global Fans Clout]
- Primary Accent: [Gold #facc15 / Emerald #10b981 / Sky Cyan #38bdf8 / Royal Purple #a855f7]

STRICT LAYOUT RULES:
1. Match the exact positions of the Category Header Zone (70, 50, 860x110), 10-Row Table Arena (60, 176, 880x836), column separators (RANK 120w | PLAYER 580w | METRIC 180w), 10 rows (75px height each), circular avatar sockets at (x:215, r:25), and bottom Caller Rank Footer Bar (60, 1028, 880x46).
2. Give Rows 1, 2, and 3 subtle metallic Gold, Silver, and Bronze podium row highlights respectively; keep Rows 4-10 clean alternating dark smoky glass strips.
3. Add dramatic thematic trophy / matchball / floodlight artwork strictly in the outer corners and header backdrop — never covering row text areas.
4. Remove all blueprint grid lines, dashed outlines, coordinates, and placeholder labels. Include ZERO baked text, numbers, or player names.
```

---

## 4. Player Career & Full Telemetry Card (`player_stat_card_grid_template.png` — `1000x550`)
For `-profile stats`, `-intstats`, `-clubstats`.

```text
Using the attached 1000x550 blueprint image as an exact pixel layout guide, design a sleek futuristic football telemetry & player dossier card frame in obsidian dark glass with crisp electric cyan & gold metallic accents.

STRICT LAYOUT RULES:
1. Preserve exact zones: Player Header Box (45, 45, 560x110), 12-Stat Telemetry Matrix (45, 170, 560x320), Right Showcase Panel (625, 45, 330x445) with circular avatar frame centered at (790, 145, r:70), radar/triad housing (650, 255, 280x165), form strip (650, 430, 280x46), and bottom status bar (45, 500, 910x28).
2. Inside the panels, use deep matte charcoal-navy glass (#070d18) with subtle hairline bevel dividers so tabular stats render sharply.
3. Remove all dashed blueprint lines, grid squares, text labels, and coordinates. ZERO baked text or fake stats.
```

---

## 5. Dealership, Global Market & Avatar Boutique (`showroom_grid_template.png` — `1024x764`)
For `-showroom`, `-gm`, `-avatar`.

```text
Using the attached 1024x764 blueprint image as an exact layout template, design an upscale dark motorsport showroom & luxury boutique catalog frame (sleek carbon fiber perimeter, crimson/emerald/gold LED showroom floor reflections, dark frosted glass cards).

STRICT LAYOUT RULES:
1. Keep the exact Top Header Bar (102, 112, 820x90) and Bottom Footer Strip (102, 682, 820x42).
2. Render 6 matching individual dark smoky glass showcase tiles inside the main arena at exact coordinates: Row 1 (122,254 & 520,254), Row 2 (122,392 & 520,392), Row 3 (122,530 & 520,530) — each 382x120px with subtle metallic rim lighting and clean left-side display bay for vehicle/avatar sprites.
3. Remove all blueprint grid lines, dashed outlines, text labels, and coordinates. ZERO text, letters, car logos, or numbers.
```

---

## 6. Automated Auction House Vault (`auction_house_grid_template.png` — `1024x764`)
For `-ah`.

```text
Using the attached 1024x764 blueprint image as an exact layout template, design a dark museum vault & luxury auction house showcase frame with obsidian velvet, brass/gold museum glass casing, and dramatic gallery spotlights.

STRICT LAYOUT RULES:
1. Preserve exact Header Zone (102, 112, 820x90), two side-by-side Collector Showcase Pedestal Panels at (122, 256, 380x392) and (522, 256, 380x392), circular relic spotlight domes centered at (312, 350, r:58) and (712, 350, r:58), and Footer Command Bar (102, 682, 820x42).
2. Keep the lower half of each lot panel smooth dark smoky glass for bid totals, high-bidder tags, and countdown text.
3. Remove all blueprint grids, dashed outlines, labels, and coordinates. ZERO baked text or numbers.
```

---

## 7. Standings Table (`points_table_grid_template.png` — `1200x900`)
For League & National Team standings tables.

```text
Using the attached 1200x900 blueprint image as an exact pixel layout guide, design a Champions League broadcast Standings / Points Table frame with dark stadium depth, gold & sky-blue metallic trim, and crisp translucent table glass.

STRICT LAYOUT RULES:
1. Preserve exact zones: Competition Header (60, 44, 1080x96), Table Arena (60, 160, 1080x640) with 10 column dividers (POS | TEAM | P | W | D | L | GF | GA | GD | PTS), 8 alternating dark glass team rows (65px height each, subtle top-3 qualification accent glow on left edge), and Bottom Qualification Footer Bar (60, 824, 1080x46).
2. Keep row surfaces dark and low-noise for crisp numeric alignment.
3. Remove all blueprint grid lines, dashed outlines, labels, and coordinates. ZERO baked text, club names, or numbers.
```

---

## 8. Matchday Gazette Scorecard (`match_scorecard_grid_template.png` — `800x410`)
For `-match`, `-friendly`, `-livematch` broadcast scorecards.

```text
Using the attached 800x410 blueprint image as an exact pixel guide, design a live broadcast football Match Scorecard frame in obsidian stadium night lighting with gold, emerald, and sky-blue metallic accents.

STRICT LAYOUT RULES:
1. Preserve exact zones: Top Header Bar (40, 24, 720x50), Scoreline Strip with Home Team (48, 94, 260x96), Center Score Box (318, 94, 164x96), Away Team (492, 94, 260x96), Dual Possession Bar (48, 202, 704x72), MOTM Spotlight Row (48, 286, 704x78), and Footer (40, 380, 720x20).
2. Keep team/score/MOTM interiors dark matte glass (#070b14) with crisp subtle glowing trim so scores and badges stand out cleanly.
3. Remove all dashed blueprint lines, grid lines, coordinate numbers, and labels. ZERO baked text or team names.
```
