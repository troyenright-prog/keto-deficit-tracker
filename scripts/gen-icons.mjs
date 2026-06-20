// Generates pwa-192.png and pwa-512.png in public/ using only Node built-ins.
import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dir, '../public');

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

function makePNG(size) {
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);   // width
  ihdr.writeUInt32BE(size, 4);   // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Build raw pixel rows (filter byte 0 = None prepended per row)
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.42;
  const rows = [];

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let pr, pg, pb;
      if (dist <= r) {
        // Blue circle
        pr = 0x25; pg = 0x63; pb = 0xeb;
      } else {
        // Dark background
        pr = 0x11; pg = 0x18; pb = 0x27;
      }
      const off = 1 + x * 3;
      row[off] = pr; row[off + 1] = pg; row[off + 2] = pb;
    }
    rows.push(row);
  }

  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync(resolve(publicDir, 'pwa-192.png'), makePNG(192));
writeFileSync(resolve(publicDir, 'pwa-512.png'), makePNG(512));
console.log('Icons written: pwa-192.png, pwa-512.png');
