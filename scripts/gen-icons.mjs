import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [0x3a, 0x2e, 0x26]; // dark warm brown, like a wooden table
const PAPER = [0xf3, 0xe9, 0xd8]; // cut paper strip color
const PAPER2 = [0xe8, 0xdc, 0xc4];

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size, draw) {
  const raw = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const i = (y * size + x) * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const rows = [];
  for (let y = 0; y < size; y++) {
    rows.push(Buffer.from([0]));
    rows.push(raw.subarray(y * size * 4, (y + 1) * size * 4));
  }
  const rawData = Buffer.concat(rows);
  const compressed = deflateSync(rawData);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function paperStripIcon(size, pad = 0) {
  const inner = size - pad * 2;
  return (x, y, s) => {
    if (x < pad || y < pad || x >= s - pad || y >= s - pad) return BG.concat(255);
    const nx = (x - pad) / inner;
    const ny = (y - pad) / inner;

    let r = BG[0], g = BG[1], b = BG[2];

    const strips = [
      { yc: 0.30, h: 0.13, tilt: -0.035, cutAt: 0.55, gap: 0.03 },
      { yc: 0.52, h: 0.13, tilt: 0.02, cutAt: 0.4, gap: 0.03 },
      { yc: 0.74, h: 0.13, tilt: -0.015, cutAt: 0.68, gap: 0.03 },
    ];

    for (const st of strips) {
      const localY = ny - st.yc - st.tilt * (nx - 0.5);
      if (Math.abs(localY) < st.h / 2) {
        const inGap = Math.abs(nx - st.cutAt) < st.gap;
        if (!inGap) {
          const shade = (Math.abs(localY) > st.h / 2 - 0.015) ? PAPER2 : PAPER;
          r = shade[0]; g = shade[1]; b = shade[2];
        }
      }
    }

    return [r, g, b, 255];
  };
}

mkdirSync('public', { recursive: true });

writeFileSync('public/pwa-192.png', makePng(192, paperStripIcon(192, 0)));
writeFileSync('public/pwa-512.png', makePng(512, paperStripIcon(512, 0)));
writeFileSync('public/pwa-maskable-512.png', makePng(512, paperStripIcon(512, 70)));
writeFileSync('public/apple-touch-icon.png', makePng(180, paperStripIcon(180, 0)));

console.log('icons written');
