// Rasterise the source artwork in assets/ into public/icons/ (plan Phase 5, FR-22).
// Run with `npm run gen:icons`; the PNGs are committed so CI never needs sharp.
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'assets');
const out = join(root, 'public', 'icons');

const icon = join(assets, 'icon.svg');
const maskable = join(assets, 'icon-maskable.svg');

/** [source, output file, size]. iOS rounds its own corners, so it gets the full-bleed art. */
const targets = [
  [icon, 'icon-192.png', 192],
  [icon, 'icon-512.png', 512],
  [icon, 'favicon-48.png', 48],
  [maskable, 'maskable-512.png', 512],
  [maskable, 'apple-touch-icon-180.png', 180],
];

await mkdir(out, { recursive: true });
for (const [src, file, size] of targets) {
  await sharp(src, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(out, file));
  console.log(`gen-icons: ${file} (${size}x${size})`);
}
await copyFile(icon, join(out, 'favicon.svg'));
console.log('gen-icons: favicon.svg');
