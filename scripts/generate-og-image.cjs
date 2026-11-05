const sharp = require('sharp');
const path = require('path');

async function createOgImage() {
  const width = 1200;
  const height = 630;
  
  // Make the lion emblem MUCH bigger (460x460 instead of 340)
  const emblemPath = path.join(__dirname, '../public/images/lion-books-emblem.png');
  const outputPath = path.join(__dirname, '../public/images/lion-books-og.jpg');
  
  const lionResized = await sharp(emblemPath)
    .resize(460, 460, { fit: 'contain' })
    .toBuffer();

  // Create high-res SVG overlay: clean, uncluttered, pure luxury
  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg-glow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stop-color="#322217" stop-opacity="1" />
          <stop offset="40%" stop-color="#18110d" stop-opacity="1" />
          <stop offset="100%" stop-color="#080706" stop-opacity="1" />
        </radialGradient>
        <linearGradient id="gold-text" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFDF8" />
          <stop offset="45%" stop-color="#F4E4BA" />
          <stop offset="100%" stop-color="#C9A96E" />
        </linearGradient>
      </defs>

      <!-- Deep Charcoal Background with Strong Warm Core Glow -->
      <rect width="${width}" height="${height}" fill="url(#bg-glow)" />

      <!-- Subtle Luxury Frame Border -->
      <rect x="20" y="20" width="1160" height="590" rx="20" fill="none" stroke="#D4AF37" stroke-opacity="0.2" stroke-width="1.5" />

      <!-- Bold, Crystal Clear 'LION BOOKS' text only -->
      <text x="600" y="550" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="52" font-weight="bold" fill="url(#gold-text)" letter-spacing="10">LION BOOKS</text>
    </svg>
  `);

  // Center the 460x460 lion: left = (1200 - 460)/2 = 370, top = 40
  await sharp(svgOverlay)
    .composite([
      { input: lionResized, top: 40, left: 370 }
    ])
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  console.log('Clean bold OG image created successfully at:', outputPath);
}

createOgImage().catch(console.error);
