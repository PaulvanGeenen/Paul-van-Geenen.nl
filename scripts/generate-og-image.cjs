const sharp = require('sharp');
const path = require('path');

async function createOgImage() {
  const width = 1200;
  const height = 630;
  
  // Resize lion emblem to 340x340
  const emblemPath = path.join(__dirname, '../public/images/lion-books-emblem.png');
  const outputPath = path.join(__dirname, '../public/images/lion-books-og.jpg');
  
  const lionResized = await sharp(emblemPath)
    .resize(340, 340, { fit: 'contain' })
    .toBuffer();

  // Create high-res SVG overlay
  const svgOverlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bg-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stop-color="#2c1e15" stop-opacity="1" />
          <stop offset="45%" stop-color="#140f0c" stop-opacity="1" />
          <stop offset="100%" stop-color="#080706" stop-opacity="1" />
        </radialGradient>
        <linearGradient id="gold-text" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFDF8" />
          <stop offset="45%" stop-color="#F4E4BA" />
          <stop offset="100%" stop-color="#C9A96E" />
        </linearGradient>
        <linearGradient id="line-gold" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#C9A96E" stop-opacity="0" />
          <stop offset="50%" stop-color="#D4AF37" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#C9A96E" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Rich Charcoal Background with Warm Radial Core -->
      <rect width="${width}" height="${height}" fill="url(#bg-glow)" />

      <!-- Outer Subtle Gold Border -->
      <rect x="24" y="24" width="1152" height="582" rx="18" fill="none" stroke="#D4AF37" stroke-opacity="0.25" stroke-width="1.5" />
      <rect x="32" y="32" width="1136" height="566" rx="14" fill="none" stroke="#D4AF37" stroke-opacity="0.1" stroke-width="1" />

      <!-- Typography -->
      <text x="600" y="440" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="46" font-weight="bold" fill="url(#gold-text)" letter-spacing="8">LION BOOKS</text>
      <text x="600" y="482" text-anchor="middle" font-family="Arial, 'Helvetica Neue', sans-serif" font-size="18" font-weight="300" fill="#E8C872" letter-spacing="14">PUBLISHING</text>

      <line x1="440" y1="510" x2="760" y2="510" stroke="url(#line-gold)" stroke-width="1.5" />

      <text x="600" y="546" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="17" font-style="italic" fill="#E8D5B7" fill-opacity="0.85" letter-spacing="3">Uitgeversfonds van Paul van Geenen</text>
      <text x="600" y="582" text-anchor="middle" font-family="Arial, 'Helvetica Neue', sans-serif" font-size="13" font-weight="500" fill="#D4AF37" fill-opacity="0.7" letter-spacing="4">WWW.LIONBOOKS.NL</text>
    </svg>
  `);

  await sharp(svgOverlay)
    .composite([
      { input: lionResized, top: 50, left: 430 }
    ])
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  console.log('OG image created successfully at:', outputPath);
}

createOgImage().catch(console.error);
