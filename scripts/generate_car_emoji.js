import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.OPENAI_API_KEY || process.env['openai-key'];
const TARGET_PATH = path.resolve('assets/emojis/car.png');

async function generateCar() {
  console.log('Generating 3D supercar car emoji using gpt-image-2...');
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt: '3D glossy luxury red and black exotic supercar hypercar, football player lifestyle garage vehicle icon, stylized 3D game UI badge, front three-quarter view, pure solid black background',
        n: 1,
        size: '1024x1024',
        quality: 'low'
      })
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Failed to generate car emoji:', data);
      process.exit(1);
    }

    const b64 = data.data?.[0]?.b64_json;
    if (b64) {
      fs.writeFileSync(TARGET_PATH, Buffer.from(b64, 'base64'));
      console.log(`Successfully generated car.png (${fs.statSync(TARGET_PATH).size} bytes)!`);
    } else {
      console.error('No image b64 received in response:', data);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error generating car emoji:', err.message);
    process.exit(1);
  }
}

generateCar();
