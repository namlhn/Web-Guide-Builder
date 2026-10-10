import fs from 'node:fs';
import path from 'node:path';

// Generate raw uncompressed PNG files for 16x16, 48x48, 128x128
// We can use a minimal pure JS PNG encoder
function createPng(size, r, g, b) {
  // Simple PNG creator with a solid or drawn icon
  // Minimal PNG implementation
  const width = size;
  const height = size;
  
  // Create RGBA buffer
  const rgba = Buffer.alloc(width * height * 4);
  const cx = width / 2;
  const cy = width / 2;
  const radius = width * 0.45;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Rounded rectangle / badge icon:
      const rx = Math.abs(x - cx);
      const ry = Math.abs(y - cy);
      const inBox = (rx < width * 0.42 && ry < height * 0.42);
      const inLens = (dist < width * 0.22);
      const inCornerDot = (x > width * 0.65 && x < width * 0.78 && y > height * 0.22 && y < height * 0.35);

      if (inCornerDot) {
        // Red dot
        rgba[idx] = 239;     // R
        rgba[idx + 1] = 68;  // G
        rgba[idx + 2] = 68;  // B
        rgba[idx + 3] = 255; // A
      } else if (inLens) {
        // Lens circle (cyan / blue)
        rgba[idx] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 240;
      } else if (inBox) {
        // Camera / guide body (Indigo / Blue: #4F46E5)
        rgba[idx] = 79;
        rgba[idx + 1] = 70;
        rgba[idx + 2] = 229;
        rgba[idx + 3] = 255;
      } else {
        // Transparent
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      }
    }
  }

  return encodeRawPng(width, height, rgba);
}

// Minimal PNG encoder
import zlib from 'node:zlib';

function encodeRawPng(width, height, rgbaBuffer) {
  // Each scanline starts with filter byte 0
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    rawData[y * scanlineLength] = 0; // Filter: None
    rgbaBuffer.copy(rawData, y * scanlineLength + 1, y * width * 4, (y + 1) * width * 4);
  }

  const deflated = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // Deflate
  ihdr[11] = 0; // No filter
  ihdr[12] = 0; // No interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  // CRC32 of type + data
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const png = createPng(size);
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), png);
  console.log(`Generated icon-${size}.png (${size}x${size})`);
}
