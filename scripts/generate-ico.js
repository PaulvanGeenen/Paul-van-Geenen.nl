import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generateFavicons() {
  const svgPath = path.join(process.cwd(), 'public', 'favicon.svg');
  const icoPath = path.join(process.cwd(), 'public', 'favicon.ico');
  const png16Path = path.join(process.cwd(), 'public', 'favicon-16x16.png');
  const png32Path = path.join(process.cwd(), 'public', 'favicon-32x32.png');
  const applePath = path.join(process.cwd(), 'public', 'apple-touch-icon.png');

  console.log('Rendering PNGs from SVG...');

  const sizes = [16, 32, 48, 64];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(svgPath)
      .resize(size, size)
      .toFormat('png')
      .toBuffer();
    pngBuffers.push({ size, buf });
  }

  // Also save standalone PNGs for modern web standards
  await sharp(svgPath).resize(16, 16).toFile(png16Path);
  await sharp(svgPath).resize(32, 32).toFile(png32Path);
  await sharp(svgPath).resize(180, 180).toFile(applePath);

  // Build ICO container from PNG buffers
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const directorySize = 16 * numImages;
  let currentOffset = headerSize + directorySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 (ICO)
  header.writeUInt16LE(numImages, 4); // Number of images

  const dirEntries = [];

  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // Width
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // Height
    entry.writeUInt8(0, 2); // Colors (0 = no palette)
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(buf.length, 8); // Size of PNG
    entry.writeUInt32LE(currentOffset, 12); // Offset in file
    dirEntries.push(entry);

    currentOffset += buf.length;
  }

  const icoBuffer = Buffer.concat([
    header,
    ...dirEntries,
    ...pngBuffers.map(b => b.buf)
  ]);

  fs.writeFileSync(icoPath, icoBuffer);
  console.log(`Successfully generated favicon.ico (${icoBuffer.length} bytes) with sizes [16, 32, 48, 64]!`);
}

generateFavicons().catch(err => {
  console.error('Failed to generate favicons:', err);
  process.exit(1);
});
