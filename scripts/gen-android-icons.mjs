import { deflateSync } from 'zlib';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const resDir = resolve(__dir, '../android/app/src/main/res');

const densities = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
];

const colors = {
  green: [18, 128, 92, 255],
  lightGreen: [34, 197, 94, 255],
  white: [255, 255, 255, 255],
};

function crc32(buf) {
  let crc = -1;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function put(row, x, rgba) {
  const off = 1 + x * 4;
  row[off] = rgba[0];
  row[off + 1] = rgba[1];
  row[off + 2] = rgba[2];
  row[off + 3] = rgba[3];
}

function makeIcon(size) {
  const rows = [];
  const center = size / 2;
  const whiteRadius = size * 0.33;
  const leafCx = size * 0.53;
  const leafCy = size * 0.55;

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const circle = Math.sqrt(dx * dx + dy * dy) <= whiteRadius;
      const leaf =
        ((x - leafCx) ** 2) / (size * size * 0.09) +
        ((y - leafCy) ** 2) / (size * size * 0.025) <= 1 &&
        x > size * 0.3 &&
        y > size * 0.3;
      const smallLeaf =
        ((x - size * 0.35) ** 2) / (size * size * 0.028) +
        ((y - size * 0.59) ** 2) / (size * size * 0.065) <= 1 &&
        y > size * 0.38;
      put(row, x, smallLeaf ? colors.lightGreen : leaf ? colors.green : circle ? colors.white : colors.green);
    }
    rows.push(row);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [dir, size] of densities) {
  const outDir = resolve(resDir, dir);
  mkdirSync(outDir, { recursive: true });
  const icon = makeIcon(size);
  writeFileSync(resolve(outDir, 'ic_launcher.png'), icon);
  writeFileSync(resolve(outDir, 'ic_launcher_round.png'), icon);
}

console.log('Android launcher icons written.');
