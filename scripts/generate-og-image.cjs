const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function createOgImage() {
  const width = 1200;
  const height = 630;
  const squareSize = 630;
  
  const sourceImage = path.join('C:/Users/Gebruiker/.gemini/antigravity/brain/6aaffb43-2315-4015-af6e-c5d0f4ee8eb5/.user_uploaded/media_1793903769818_992983fa.jpg');
  const outputPath = path.join(__dirname, '../public/images/lion-books-og.jpg');
  const squarePath = path.join(__dirname, '../public/images/lion-books-square.jpg');

  // Copy square source directly to public images
  fs.copyFileSync(sourceImage, squarePath);

  // Resize the perfect square artwork to 630x630 so it fills 100% of the vertical space
  const centerArtwork = await sharp(sourceImage)
    .resize(squareSize, squareSize, { fit: 'cover' })
    .toBuffer();

  // Create 1200x630 canvas with matching background color rgb(24, 22, 27)
  const bgCanvas = await sharp({
    create: {
      width: width,
      height: height,
      channels: 3,
      background: { r: 24, g: 22, b: 27 }
    }
  }).jpeg().toBuffer();

  // Composite center square artwork at left = (1200 - 630) / 2 = 285
  await sharp(bgCanvas)
    .composite([
      { input: centerArtwork, left: 285, top: 0 }
    ])
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  console.log('Generated perfect OG image based on user artwork at:', outputPath);
}

createOgImage().catch(console.error);
