/**
 * optimize-images.ts — resize + compress product images for web.
 * Source images are 1280px JPEGs (100-175KB each).
 * Target: carousel=800px, thumbnails=96px, logo=180px.
 * Quality: 82 (visually identical, ~60% smaller).
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { execSync } from "child_process";

const GALLERY = "/home/z/my-project/public/gallery";
const LOGO = "/home/z/my-project/public/logo.jpg";
const QUALITY = 82;

// Check if sharp or imagemagick is available
function hasTool(tool: string): boolean {
  try {
    execSync(`which ${tool}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const photos = [
  "hero.jpg", "dramatic.jpg", "texture.jpg", "pearl.jpg",
  "lifestyle.jpg", "benefits-banner.jpg", "collage.jpg",
];

console.log("=== Image Optimization ===\n");

// Use ImageMagick (mogrify) if available, otherwise use Python PIL
if (hasTool("mogrify")) {
  console.log("Using ImageMagick (mogrify)...");
  
  for (const photo of photos) {
    const src = `${GALLERY}/${photo}`;
    const backup = `${GALLERY}/${photo}.orig`;
    
    // Backup original
    try { execSync(`cp "${src}" "${backup}"`, { stdio: "ignore" }); } catch {}
    
    // Resize to max 800px wide + compress
    execSync(`mogrify -resize 800x800\\> -quality ${QUALITY} -strip "${src}"`, { stdio: "inherit" });
    
    const newSize = execSync(`stat -c%s "${src}"`).toString().trim();
    console.log(`  ${photo}: ${newSize} bytes`);
  }
  
  // Logo: resize to 200px wide
  try {
    execSync(`cp "${LOGO}" "${LOGO}.orig"`, { stdio: "ignore" });
  } catch {}
  execSync(`mogrify -resize 200x200\\> -quality ${QUALITY} -strip "${LOGO}"`, { stdio: "inherit" });
  const logoSize = execSync(`stat -c%s "${LOGO}"`).toString().trim();
  console.log(`  logo.jpg: ${logoSize} bytes`);
  
} else {
  console.log("ImageMagick not found, using Python PIL...");
  
  const script = `
from PIL import Image
import os

QUALITY = ${QUALITY}
GALLERY = "${GALLERY}"
LOGO = "${LOGO}"
photos = ${JSON.stringify(photos)}

for photo in photos:
    src = os.path.join(GALLERY, photo)
    # Backup
    backup = src + ".orig"
    if not os.path.exists(backup):
        os.system(f'cp "{src}" "{backup}"')
    
    img = Image.open(src)
    # Resize to max 800px
    if max(img.size) > 800:
        ratio = 800 / max(img.size)
        new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
        img = img.resize(new_size, Image.LANCZOS)
    # Save compressed
    img.save(src, "JPEG", quality=QUALITY, optimize=True, progressive=True)
    print(f"  {photo}: {os.path.getsize(src)} bytes")

# Logo
backup = LOGO + ".orig"
if not os.path.exists(backup):
    os.system(f'cp "{LOGO}" "{backup}"')
img = Image.open(LOGO)
if max(img.size) > 200:
    ratio = 200 / max(img.size)
    new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
    img = img.resize(new_size, Image.LANCZOS)
img.save(LOGO, "JPEG", quality=QUALITY, optimize=True, progressive=True)
print(f"  logo.jpg: {os.path.getsize(LOGO)} bytes")
`;
  
  execSync(`python3 -c '${script.replace(/'/g, "'\\''")}'`, { stdio: "inherit" });
}

console.log("\n=== Done ===");
