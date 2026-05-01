/**
 * generate-icons.mjs
 * Generates logo-192.png and logo-512.png from scratch using pure Node.js.
 * No external dependencies — uses only Node built-ins + manual PNG encoding.
 *
 * Logo design matches public/logo.svg:
 *   - Dark (#0d1117) rounded-rect background
 *   - Blue→purple gradient line chart path
 *   - Purple dot at the top-right peak
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../public');

// ─── PNG Encoder ────────────────────────────────────────────────────────────

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uint32BE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return b;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = uint32BE(data.length);
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crc = uint32BE(crc32(crcBuf));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function encodePNG(width, height, pixels) {
  // pixels: Uint8Array of RGBA values, row-major
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (we'll drop alpha for simplicity... actually let's use 6=RGBA)
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data with filter byte per row
  const rowSize = width * 4;
  const rawData = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    rawData[y * (rowSize + 1)] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = y * (rowSize + 1) + 1 + x * 4;
      rawData[dst]     = pixels[src];
      rawData[dst + 1] = pixels[src + 1];
      rawData[dst + 2] = pixels[src + 2];
      rawData[dst + 3] = pixels[src + 3];
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 9 });

  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── Drawing Primitives ──────────────────────────────────────────────────────

function createCanvas(w, h) {
  // RGBA pixel buffer
  const pixels = new Uint8Array(w * h * 4);
  return { pixels, w, h };
}

function setPixel(canvas, x, y, r, g, b, a = 255) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= canvas.w || y < 0 || y >= canvas.h) return;
  const i = (y * canvas.w + x) * 4;
  // Alpha compositing
  const srcA = a / 255;
  const dstA = canvas.pixels[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  canvas.pixels[i]     = Math.round((r * srcA + canvas.pixels[i]     * dstA * (1 - srcA)) / outA);
  canvas.pixels[i + 1] = Math.round((g * srcA + canvas.pixels[i + 1] * dstA * (1 - srcA)) / outA);
  canvas.pixels[i + 2] = Math.round((b * srcA + canvas.pixels[i + 2] * dstA * (1 - srcA)) / outA);
  canvas.pixels[i + 3] = Math.round(outA * 255);
}

function fillRect(canvas, x0, y0, x1, y1, r, g, b, a = 255) {
  for (let y = Math.max(0, y0); y <= Math.min(canvas.h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(canvas.w - 1, x1); x++) {
      setPixel(canvas, x, y, r, g, b, a);
    }
  }
}

function fillRoundedRect(canvas, x0, y0, x1, y1, radius, r, g, b) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      // Check corners
      let inCorner = false;
      const corners = [
        [x0 + radius, y0 + radius],
        [x1 - radius, y0 + radius],
        [x0 + radius, y1 - radius],
        [x1 - radius, y1 - radius],
      ];
      if (x < x0 + radius && y < y0 + radius) { // top-left
        inCorner = true;
        const dx = x - (x0 + radius), dy = y - (y0 + radius);
        if (dx * dx + dy * dy > radius * radius) continue;
      } else if (x > x1 - radius && y < y0 + radius) { // top-right
        inCorner = true;
        const dx = x - (x1 - radius), dy = y - (y0 + radius);
        if (dx * dx + dy * dy > radius * radius) continue;
      } else if (x < x0 + radius && y > y1 - radius) { // bottom-left
        inCorner = true;
        const dx = x - (x0 + radius), dy = y - (y1 - radius);
        if (dx * dx + dy * dy > radius * radius) continue;
      } else if (x > x1 - radius && y > y1 - radius) { // bottom-right
        inCorner = true;
        const dx = x - (x1 - radius), dy = y - (y1 - radius);
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      setPixel(canvas, x, y, r, g, b, 255);
    }
  }
}

// Anti-aliased thick line using Xiaolin Wu's algorithm
function drawThickLine(canvas, x0, y0, x1, y1, thickness, colorFn) {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 4);
  const half = thickness / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x0 + (x1 - x0) * t;
    const cy = y0 + (y1 - y0) * t;
    const [r, g, b] = colorFn(t);
    // Draw circle at each point for rounded caps
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= half) {
          const alpha = dist > half - 1 ? Math.round((half - dist) * 255) : 255;
          setPixel(canvas, Math.round(cx + dx), Math.round(cy + dy), r, g, b, alpha);
        }
      }
    }
  }
}

function fillCircle(canvas, cx, cy, radius, r, g, b) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        const alpha = dist > radius - 1 ? Math.round((radius - dist) * 255) : 255;
        setPixel(canvas, Math.round(cx + dx), Math.round(cy + dy), r, g, b, alpha);
      }
    }
  }
}

// ─── Logo Renderer ───────────────────────────────────────────────────────────

/**
 * Renders the WealthPulse logo at size×size pixels.
 * SVG viewBox is 512×512, so we scale all coordinates by size/512.
 */
function renderLogo(size) {
  const canvas = createCanvas(size, size);
  const s = size / 512;

  // Background: dark rounded rect
  const radius = Math.round(128 * s);
  fillRoundedRect(canvas, 0, 0, size - 1, size - 1, radius, 13, 17, 23);

  // Chart path: M128 320 L224 192 L320 288 L416 128
  // Stroke width 48 in SVG coords → scaled
  const strokeW = Math.max(6, Math.round(48 * s));

  const points = [
    [128, 320],
    [224, 192],
    [320, 288],
    [416, 128],
  ].map(([x, y]) => [x * s, y * s]);

  // Gradient: blue (#3b82f6) → purple (#8b5cf6) over total path
  const totalSegments = points.length - 1;
  for (let seg = 0; seg < totalSegments; seg++) {
    const [x0, y0] = points[seg];
    const [x1, y1] = points[seg + 1];
    drawThickLine(canvas, x0, y0, x1, y1, strokeW, (t) => {
      const globalT = (seg + t) / totalSegments;
      const r = Math.round(59  + (139 - 59)  * globalT); // 3b → 8b
      const g = Math.round(130 + (92  - 130) * globalT); // 82 → 5c
      const b = Math.round(246 + (246 - 246) * globalT); // f6 → f6
      return [r, g, b];
    });
  }

  // Purple dot at peak (416, 128)
  const dotRadius = Math.max(4, Math.round(32 * s));
  fillCircle(canvas, Math.round(416 * s), Math.round(128 * s), dotRadius, 139, 92, 246);

  return canvas;
}

// ─── Main ────────────────────────────────────────────────────────────────────

for (const size of [192, 512]) {
  const canvas = renderLogo(size);
  const png = encodePNG(size, size, canvas.pixels);
  const outPath = path.join(OUTPUT_DIR, `logo-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✅ Generated: ${outPath} (${Math.round(png.length / 1024)}KB)`);
}
