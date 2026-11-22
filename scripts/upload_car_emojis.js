import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const APP_ID = '1574055032054096002';
const token = process.env.DISCORD_TOKEN;
const emojisDir = path.resolve('assets/emojis');

const CAR_EMOJI_NAMES = [
  'hcfront', 'hcback',
  'tsfront', 'tsback',
  'p911front', 'p911back',
  'ngtrfront', 'ngtrback',
  'ar8front', 'ar8back',
  'lhfront', 'lhback',
  'rrgfront', 'rrgback',
  'ffront', 'fback',
  'bcfront', 'bcback'
];

async function uploadCarEmojis() {
  console.log('Fetching existing application emojis...');
  const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
    headers: { 'Authorization': `Bot ${token}` }
  });
  const data = await res.json();
  const existingMap = new Map();
  for (const item of (data.items || [])) {
    existingMap.set(item.name.toLowerCase(), item.id);
  }

  const uploadedEmojis = {};

  for (const name of CAR_EMOJI_NAMES) {
    const filePath = path.join(emojisDir, `${name}.png`);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      continue;
    }

    if (existingMap.has(name)) {
      const existingId = existingMap.get(name);
      console.log(`[REPLACING] Deleting existing ${name} (${existingId})...`);
      await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis/${existingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bot ${token}` }
      });
      await new Promise(r => setTimeout(r, 600));
    }

    const b64 = fs.readFileSync(filePath).toString('base64');
    try {
      const upRes = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          image: `data:image/png;base64,${b64}`
        })
      });
      const upData = await upRes.json();
      if (upRes.ok) {
        console.log(`[SUCCESS] ${name} -> <:${name}:${upData.id}>`);
        uploadedEmojis[name] = `<:${name}:${upData.id}>`;
      } else {
        console.error(`[ERROR] ${name}:`, upData);
      }
    } catch (e) {
      console.error(`[EXCEPTION] ${name}:`, e.message);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n--- UPLOAD COMPLETE ---');
  console.log(JSON.stringify(uploadedEmojis, null, 2));
}

uploadCarEmojis();
