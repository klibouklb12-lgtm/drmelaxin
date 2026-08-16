#!/usr/bin/env node
/**
 * Convert gallery images to WebP (with JPEG fallback for old browsers).
 * Safe: keeps original JPEGs, adds WebP versions alongside.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const galleryDir = './public/gallery';
const images = fs.readdirSync(galleryDir).filter(f => f.endsWith('.jpg') && !f.endsWith('.jpg.orig'));

async function convert() {
  console.log('Converting images to WebP...\n');

  for (const img of images) {
    const input = path.join(galleryDir, img);
    const output = path.join(galleryDir, img.replace('.jpg', '.webp'));

    // Skip if WebP already exists and is newer
    if (fs.existsSync(output)) {
      const jpgStat = fs.statSync(input);
      const webpStat = fs.statSync(output);
      if (webpStat.mtime > jpgStat.mtime) {
        console.log(`  ⏭️  ${img} → WebP already up to date`);
        continue;
      }
    }

    const jpgSize = fs.statSync(input).size;

    // Convert to WebP (quality 80 = good balance, ~60% smaller)
    await sharp(input)
      .webp({ quality: 80 })
      .toFile(output);

    const webpSize = fs.statSync(output).size;
    const savings = Math.round((1 - webpSize / jpgSize) * 100);

    console.log(`  ✅ ${img}: ${Math.round(jpgSize/1024)}KB → ${Math.round(webpSize/1024)}KB (${savings}% smaller)`);
  }

  // Also convert logo.jpg
  const logoInput = './public/logo.jpg';
  const logoOutput = './public/logo.webp';
  if (fs.existsSync(logoInput)) {
    const jpgSize = fs.statSync(logoInput).size;
    await sharp(logoInput).webp({ quality: 85 }).toFile(logoOutput);
    const webpSize = fs.statSync(logoOutput).size;
    const savings = Math.round((1 - webpSize / jpgSize) * 100);
    console.log(`  ✅ logo.jpg: ${Math.round(jpgSize/1024)}KB → ${Math.round(webpSize/1024)}KB (${savings}% smaller)`);
  }

  console.log('\n✅ Done! WebP versions created alongside original JPEGs.');
}

convert().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
