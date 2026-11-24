// Génère les icônes PNG de l'application sans dépendance (encodeur PNG minimal).
// Usage : node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [24, 95, 165]; // bleu
const BALL = [200, 212, 0]; // jaune balle
const SEAM = [255, 255, 255];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // RVB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Couleur d'un point (coordonnées normalisées -1..1) : fond, balle et coutures. */
function color(u, v) {
  const R = 0.62; // rayon de la balle (dans la zone sûre des icônes masquables)
  const d = Math.hypot(u, v);
  if (d > R) return BG;
  // Deux coutures : arcs de cercles centrés hors de la balle, à gauche et à droite.
  const c = 1.05;
  const seamR = 0.78;
  const w = 0.045;
  const left = Math.abs(Math.hypot(u + c, v) - seamR);
  const right = Math.abs(Math.hypot(u - c, v) - seamR);
  if (left < w || right < w) return SEAM;
  return BALL;
}

function icon(size) {
  const S = 4; // suréchantillonnage pour l'anticrénelage
  return png(size, (x, y) => {
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < S; i++) {
      for (let j = 0; j < S; j++) {
        const u = ((x + (i + 0.5) / S) / size) * 2 - 1;
        const v = ((y + (j + 0.5) / S) / size) * 2 - 1;
        const [cr, cg, cb] = color(u, v);
        r += cr; g += cg; b += cb;
      }
    }
    const n = S * S;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

mkdirSync('public', { recursive: true });
for (const [file, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/${file}`, icon(size));
  console.log(`public/${file}`);
}
