// One-off icon generator. Run with: node scripts/generate-icons.mjs
// Produces placeholder PaddleHub icons in public/icons. Replace with real art
// when you have it — the manifest filenames are the contract.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = path.resolve(process.cwd(), "public/icons");
await mkdir(outDir, { recursive: true });

const bg = "#0f172a";
const fg = "#f8fafc";
const accent = "#22d3ee";

function svgFor(size, { maskable = false } = {}) {
  // Maskable icons need a "safe zone" — keep content within the centre 80%.
  const inset = maskable ? size * 0.1 : 0;
  const inner = size - inset * 2;
  const cx = size / 2;
  const cy = size / 2;
  const paddleR = inner * 0.32;
  const handleW = inner * 0.08;
  const handleH = inner * 0.22;
  const ballR = inner * 0.08;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <g transform="translate(${cx} ${cy})">
    <rect x="${-handleW / 2}" y="${paddleR * 0.7}" width="${handleW}" height="${handleH}" rx="${handleW / 2}" fill="${fg}"/>
    <circle cx="0" cy="${-paddleR * 0.1}" r="${paddleR}" fill="${fg}"/>
    <circle cx="0" cy="${-paddleR * 0.1}" r="${paddleR * 0.78}" fill="${bg}" opacity="0.08"/>
    <circle cx="${paddleR * 0.95}" cy="${paddleR * 0.55}" r="${ballR}" fill="${accent}"/>
  </g>
</svg>`;
}

const targets = [
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
  { size: 512, name: "icon-maskable-512.png", maskable: true },
  { size: 180, name: "apple-touch-icon.png" },
];

for (const t of targets) {
  const svg = svgFor(t.size, { maskable: t.maskable });
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await writeFile(path.join(outDir, t.name), png);
  console.log(`wrote ${t.name} (${t.size}x${t.size}${t.maskable ? ", maskable" : ""})`);
}

// Also write a favicon.ico-equivalent PNG at 32 for browser tabs.
await writeFile(
  path.join(outDir, "icon-32.png"),
  await sharp(Buffer.from(svgFor(32))).png().toBuffer(),
);
console.log("wrote icon-32.png");
