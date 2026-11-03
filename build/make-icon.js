// Draws build/icon.png (256x256): a small link chart on a dark rounded tile.
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const S = 256;
const px = Buffer.alloc(S * S * 4);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function blend(x, y, rgb, a) {
  if (x < 0 || y < 0 || x >= S || y >= S || a <= 0) return;
  const i = (y * S + x) * 4, oa = px[i + 3] / 255, na = a + oa * (1 - a);
  for (let k = 0; k < 3; k++) px[i + k] = Math.round((rgb[k] * a + px[i + k] * oa * (1 - a)) / (na || 1));
  px[i + 3] = Math.round(na * 255);
}
// Signed-distance shapes, antialiased over one pixel.
function shape(dist, rgb) {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = dist(x + 0.5, y + 0.5);
    blend(x, y, rgb, Math.max(0, Math.min(1, 0.5 - d)));
  }
}
const roundRect = (x0, y0, x1, y1, r) => (x, y) => {
  const qx = Math.max(x0 + r - x, 0, x - (x1 - r)), qy = Math.max(y0 + r - y, 0, y - (y1 - r));
  return Math.hypot(qx, qy) - r;
};
const circle = (cx, cy, r) => (x, y) => Math.hypot(x - cx, y - cy) - r;
const line = (ax, ay, bx, by, w) => (x, y) => {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) - w / 2;
};

shape(roundRect(8, 8, 248, 248, 48), hex('#1b1f26'));
const N = [[128, 120, 30, '#f0a23b'], [62, 62, 20, '#8f84f0'], [196, 66, 20, '#4b8ff0'], [66, 194, 20, '#2fb38a'], [194, 190, 20, '#e0628f']];
N.slice(1).forEach(([x, y]) => shape(line(128, 120, x, y, 9), hex('#6b7383')));
shape(line(196, 66, 194, 190, 7), hex('#4a5263'));
N.forEach(([x, y, r, c]) => shape(circle(x, y, r), hex(c)));
shape(circle(128, 120, 11), hex('#1b1f26'));

const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) { raw[y * (S * 4 + 1)] = 0; px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4); }
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(path.join(__dirname, 'icon.png'), Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log('wrote build/icon.png');
