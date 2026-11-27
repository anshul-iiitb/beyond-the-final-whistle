# Beyond The Final Whistle — Avatar & Banner Gemini Prompts Guide

Attach the corresponding visual wireframe blueprint when generating in **Gemini** (`1:1` for Avatars, `16:9` for Banners), then drop the generated images straight into:
- **Avatars (`512x512` / `1:1`):** `assets/cosmetics/avatars/<alias>.png`
- **Banners (`1000x562` / `16:9`):** `assets/cosmetics/banners/<alias>.png`

Once a file is saved under the matching alias below, `-equip <alias>` automatically displays:
- **Top-right corner** of `-profile` (and `-inv`): your **Avatar**
- **Bottom hero poster** of `-profile`: your **Banner**

---

## 1. Profile Avatars (`512x512` / `1:1` — Attach `avatar_blueprint_template.png`)

### Master Prompt (Copy & Paste for any Avatar)
> Create a square `1:1` collector footballer portrait for a Discord game avatar matching the safe-zone proportions of `avatar_blueprint_template.png` (**REMOVE all wireframe boxes, dashed lines, blueprint text, and labels in the final artwork**).
> Frame **[PLAYER NAME]** from chest-up centered cleanly inside the circular zone, wearing his iconic dark/colored kit and holding/celebrating his signature moment. Lighting should feature dramatic obsidian stadium floodlights, glowing ember particles, crisp rim lighting matching **[ACCENT COLOR]**, painterly digital sports poster finish (no extra text or UI widgets).

### Active Rotation Drop Avatars (`<alias>.png` in `assets/cosmetics/avatars/`)
| Alias | Player | Kit & Vibe |
|---|---|---|
| `rodri.png` | **Rodri (#16)** | Sky-blue kit holding golden Ballon d'Or / World trophy under fiery amber & cyan stadium sparks |
| `bellingham.png` | **Jude Bellingham (#5)** | Crisp white kit arms-wide "Belligol" celebration against dark midnight Bernabeu spotlights |
| `saka.png` | **Bukayo Saka (#7)** | Red & white Starboy portrait with crimson stadium flares & electric sparks |
| `pedri.png` | **Pedri (#8)** | Deep blaugrana blue-red midfield maestro silhouette with neon cyan tactical light trails |
| `vinicius.png` | **Vinicius Jr (#7)** | Electric gold & emerald Brazilian dance/dribble celebration under tropical floodlights |
| `musiala.png` | **Jamal Musiala (#42)** | Crimson velvet night portrait gliding past defenders with rose-gold bokeh streaks |
| `saliba.png` | **William Saliba (#2)** | Rolls-Royce defender icy calm close-up with silver metallic steel rim lighting |
| `valverde.png` | **Federico Valverde (#8)** | Falcon wings & thunderbolt aura behind white kit power-strike pose |

---

## 2. Legend Profile Banners (`1000x562` / `16:9` — Attach `banner_blueprint_template.png`)

### Master Prompt (Copy & Paste for any Banner)
> Create a widescreen `16:9` vintage-modern football collector poster matching `banner_blueprint_template.png` (**REMOVE all wireframe guides, dashed lines, and placeholder labels in the final artwork**).
> Feature **[LEGEND & ICONIC MOMENT]** in the center arena, painted textured sports-poster style with deep obsidian charcoal edges, golden dust sparks, stadium mist, an oversized faint shadowed last name behind the player, a small stylized national crest badge on the upper side, and an authentic gold handwritten signature near the bottom right. Leave the bottom-left 460x40 corner subtle/uncluttered so the bot's small player pill fits cleanly.

### Active Rotation Drop Banners (`<alias>.png` in `assets/cosmetics/banners/`)
| Alias | Legend | Scene & Atmosphere |
|---|---|---|
| `zidane.png` | **Zinedine Zidane (#10)** | White 2006 France kit gliding with the ball past yellow-clad Brazil defenders, faint "ZIDANE" backdrop lettering, French rooster gold crest |
| `maldini.png` | **Paolo Maldini (#3)** | Red & black stripes San Siro night mist, slide-tackle aura, Italian gold crest, crimson dust sparks |
| `cr7.png` | **Cristiano Ronaldo (#7)** | Iconic "Siuuu" Champions night bicycle/leap silhouette, gold crown sparks & stadium beams |
| `messi.png` | **Lionel Messi (#10)** | Sky-blue & white World Cup night magic, golden trophy glow & Camp Nou spotlight beams |
| `r9.png` | **Ronaldo Nazario (#9)** | Yellow & green "O Fenomeno" 2002 step-over blaze, emerald turf mist & gold sparks |
| `henry.png` | **Thierry Henry (#14)** | Invincibles red/gold Highbury knee-slide silhouette, timeless gold embossed signature |
| `ronaldinho.png` | **Ronaldinho (#10)** | "Joga Bonito" violet & gold neon-sparks no-look flick under Maracana floodlights |
| `iniesta.png` | **Andres Iniesta (#8)** | 2010 World Cup Final volley silhouette in dark navy & crimson-gold sparks |
