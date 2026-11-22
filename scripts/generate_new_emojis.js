import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.OPENAI_API_KEY || process.env['openai-key'];
const TARGET_DIR = path.resolve('assets/emojis');

const ITEMS = [
  {
    name: 'stamina',
    prompt: '3D glowing neon green and gold stamina energy bar battery with soccer ball emblem, vibrant game UI icon, pure black background'
  },
  {
    name: 'followers',
    prompt: '3D golden crowd fans silhouette with star and soccer ball, reputation followers badge icon, pure black background'
  },
  {
    name: 'heineken_badge',
    prompt: '3D glossy green circular bottle cap with red star, Heineken sponsor emblem icon, pure black background'
  },
  {
    name: 'adidas_badge',
    prompt: '3D white metallic three stripes logo on sleek dark circle badge, Adidas sponsor icon, pure black background'
  },
  {
    name: 'cocacola_badge',
    prompt: '3D glossy red circular bottle cap with white wave swirl, Coca Cola sponsor emblem icon, pure black background'
  },
  {
    name: 'netflix_badge',
    prompt: '3D red ribbon N lettermark logo on sleek round badge, Netflix sponsor emblem icon, pure black background'
  },
  {
    name: 'nike_badge',
    prompt: '3D shiny metallic gold swoosh checkmark on sleek round badge, Nike sponsor emblem icon, pure black background'
  }
];

async function generate(item) {
  console.log(`Generating ${item.name}...`);
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
      console.error(`Fail ${item.name}:`, data);
      return;
    }
    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      const p = path.join(TARGET_DIR, `${item.name}.png`);
      fs.writeFileSync(p, Buffer.from(b64, 'base64'));
      console.log(`Saved ${item.name}.png (${data.usage?.total_tokens || 214} tokens)`);
    }
  } catch (e) {
    console.error(item.name, e.message);
  }
}

async function run() {
  for (const item of ITEMS) {
    await generate(item);
    await new Promise(r => setTimeout(r, 1200));
  }
  console.log('Batch done!');
}

run();
