// Gera os PNGs do PWA a partir de app/icon.svg (logo do protótipo: anel + "P").
// Rode de novo se mudar o SVG: npm run icons
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const source = "app/icon.svg";
const outputs = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "app/apple-icon.png", size: 180 },
];

await mkdir("public/icons", { recursive: true });

for (const { file, size } of outputs) {
  await sharp(source, { density: 300 }).resize(size, size).png().toFile(file);
  console.log(`✓ ${file} (${size}×${size})`);
}
