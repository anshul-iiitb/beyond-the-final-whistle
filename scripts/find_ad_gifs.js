import fs from 'fs';
import path from 'path';

const ADVERTS_DIR = path.resolve('assets/adverts');
if (!fs.existsSync(ADVERTS_DIR)) {
  fs.mkdirSync(ADVERTS_DIR, { recursive: true });
}

// Reliable direct commercial football / brand GIFs
const SPONSOR_GIF_URLS = {
  heineken: 'https://media.giphy.com/media/26AHG5K9uTXG0mbUA/giphy.gif', // Heineken Cheers / Champions League
  adidas: 'https://media.giphy.com/media/l41lO26Uu4Qv3Z6kE/giphy.gif',    // Adidas football / player skills
  cocacola: 'https://media.giphy.com/media/xT1R9Qx1w0h4cK8q1a/giphy.gif',  // Coca-Cola chilled bottle
  netflix: 'https://media.giphy.com/media/oEI9uBYSzLpBK/giphy.gif'         // Netflix Intro
};

async function testDownload() {
  for (const [key, url] of Object.entries(SPONSOR_GIF_URLS)) {
    try {
      console.log(`Checking ${key} -> ${url}`);
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log(`${key} status:`, res.status, res.headers.get('content-type'));
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const filePath = path.join(ADVERTS_DIR, `${key}.gif`);
        fs.writeFileSync(filePath, buffer);
        console.log(`Saved ${key}.gif (${(buffer.length / 1024).toFixed(1)} KB)`);
      }
    } catch (e) {
      console.error(`Failed ${key}:`, e.message);
    }
  }
}

testDownload();
