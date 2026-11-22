import fs from 'fs';
import path from 'path';

const apiKey = process.env.OPENAI_API_KEY || process.env['openai-key'];

const TARGET_DIR = path.resolve('assets/emojis');
const ARTIFACT_DIR = 'C:/Users/darkh/.gemini/antigravity/brain/73951f75-602c-4d1a-b51a-743f374d3ffe';

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

const ITEMS_TO_GENERATE = [
  {
    name: 'coin',
    prompt: '3D golden currency coin with round association football soccer ball pattern embossed, glossy FIFA game UI icon'
  },
  {
    name: 'tp',
    prompt: '3D golden circular target badge with soccer ball bullseye, training points icon, game UI asset'
  },
  {
    name: 'worldcup',
    prompt: '3D golden FIFA World Cup trophy sculpture with two figures lifting globe, shiny polished metal, dark background'
  },
  {
    name: 'strika',
    prompt: '3D red fiery striker soccer cleat football boot with studs and speed trails, game equipment icon'
  },
  {
    name: 'passa',
    prompt: '3D cyan glowing playmaker soccer cleat football boot with magic passing aura, game equipment icon'
  },
  {
    name: 'bully',
    prompt: '3D heavy armored defender soccer cleat football boot with metallic shield plating, game equipment icon'
  },
  {
    name: 'sd',
    prompt: '3D athletic energy sports drink bottle with glowing blue electrolyte liquid, soccer hydration potion'
  },
  {
    name: 'zztick',
    prompt: '3D glossy green checkmark badge icon, rounded game UI verified symbol, dark background'
  },
  {
    name: 'zzcross',
    prompt: '3D glossy red X cross mark badge icon, rounded game UI cancel symbol, dark background'
  },
  {
    name: 'motm',
    prompt: '3D golden royal crown sitting on a round soccer ball, MVP Man of the Match trophy award icon'
  },
  {
    name: 'goldenboot',
    prompt: '3D golden boot soccer cleat trophy award on pedestal, top goalscorer award, shiny gold'
  },
  {
    name: 'goldmedal',
    prompt: '3D shiny gold medal with round soccer ball engraving and red ribbon, champion award icon'
  },
  {
    name: 'silvermedal',
    prompt: '3D shiny silver medal with round soccer ball engraving and blue ribbon, finalist award icon'
  }
];

async function generateImage(item) {
  console.log(`[START] Generating ${item.name}...`);
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: item.prompt,
        n: 1,
        size: '1024x1024',
        quality: 'low'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`[FAIL] ${item.name}:`, data);
      return null;
    }

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      console.error(`[NO DATA] ${item.name}`);
      return null;
    }

    const buffer = Buffer.from(b64, 'base64');
    const outPath = path.join(TARGET_DIR, `${item.name}.png`);
    fs.writeFileSync(outPath, buffer);

    // Also copy to artifact dir if exists
    try {
      const artPath = path.join(ARTIFACT_DIR, `emoji_${item.name}.png`);
      fs.writeFileSync(artPath, buffer);
    } catch {}

    const totalTokens = data.usage?.total_tokens || 214;
    console.log(`[DONE] ${item.name} (${totalTokens} tokens) -> ${outPath}`);
    return { name: item.name, tokens: totalTokens, path: outPath };
  } catch (err) {
    console.error(`[ERROR] ${item.name}:`, err.message);
    return null;
  }
}

async function main() {
  console.log(`Starting generation of ${ITEMS_TO_GENERATE.length} FIFA football images with gpt-image-2...`);
  const results = [];
  let grandTotalTokens = 0;

  for (const item of ITEMS_TO_GENERATE) {
    const res = await generateImage(item);
    if (res) {
      results.push(res);
      grandTotalTokens += res.tokens;
    }
    // Small delay between calls to respect rate limits
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log('====================================');
  console.log(`Generation complete! Successfully created ${results.length}/${ITEMS_TO_GENERATE.length} images.`);
  console.log(`Grand Total Tokens Consumed: ${grandTotalTokens}`);
  console.log('====================================');
}

main();
