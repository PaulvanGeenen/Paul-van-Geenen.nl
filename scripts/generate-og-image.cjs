const sharp = require('sharp');
const path = require('path');

async function createOgImage() {
  const width = 1200;
  const height = 630;
  
  // The user's new natural wide artwork
  const sourceImage = path.join('C:/Users/Gebruiker/.gemini/antigravity/brain/6aaffb43-2315-4015-af6e-c5d0f4ee8eb5/.user_uploaded/media_1793904747823_55714634.jpg');
  const outputPath = path.join(__dirname, '../public/images/lion-books-og.jpg');

  // Resize seamlessly to 1200x630 (fit: cover) with 0 sidebars or artificial borders
  await sharp(sourceImage)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 92 })
    .toFile(outputPath);

  console.log('Created 100% seamless wide OG image at:', outputPath);
}

createOgImage().catch(console.error);
