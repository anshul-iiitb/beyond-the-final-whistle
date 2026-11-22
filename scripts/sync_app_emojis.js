import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const APP_ID = '1574055032054096002';
const token = process.env.DISCORD_TOKEN;
const emojisDir = path.resolve('assets/emojis');

async function syncAppEmojis() {
  console.log('Fetching existing application emojis...');
  const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
    headers: { 'Authorization': `Bot ${token}` }
  });
  const data = await res.json();
  const existingMap = new Map();
  for (const item of (data.items || [])) {
    existingMap.set(item.name.toLowerCase(), item.id);
  }

  const files = fs.readdirSync(emojisDir).filter(f => f.endsWith('.png') && !f.startsWith('test_') && !f.startsWith('openai_'));
  console.log(`Found ${files.length} main emojis in assets/emojis to sync to Application Emojis...`);

  for (const file of files) {
    const emojiName = path.basename(file, '.png').toLowerCase();
    const filePath = path.join(emojisDir, file);
    const b64 = fs.readFileSync(filePath).toString('base64');
    const dataUri = `data:image/png;base64,${b64}`;

    if (existingMap.has(emojiName)) {
      const existingId = existingMap.get(emojiName);
      console.log(`[DELETE] Replacing existing App Emoji ${emojiName} (${existingId})...`);
      await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis/${existingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bot ${token}` }
      });
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      const uploadRes = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/emojis`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: emojiName,
          image: dataUri
        })
      });
      const uploadData = await uploadRes.json();
      if (uploadRes.ok) {
        console.log(`[CREATED APP EMOJI] ${emojiName} -> <:${emojiName}:${uploadData.id}>`);
      } else {
        console.error(`[FAIL] ${emojiName}:`, uploadData);
      }
    } catch (err) {
      console.error(`[ERROR] ${emojiName}:`, err.message);
    }

    await new Promise(r => setTimeout(r, 600));
  }

  console.log('All Application Emojis synced successfully!');
}

syncAppEmojis();
