import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPNG(width, height, drawFn) {
  const rowSize = width * 4;
  const rawData = Buffer.alloc(height * (1 + rowSize));

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + rowSize);
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      let byte = buf[i];
      for (let j = 0; j < 8; j++) {
        if ((crc ^ byte) & 1) {
          crc = (crc >>> 1) ^ 0xedb88320;
        } else {
          crc = crc >>> 1;
        }
        byte = byte >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const chunkData = Buffer.concat([typeBuf, data]);
    crcBuf.writeUInt32BE(crc32(chunkData), 0);
    return Buffer.concat([len, chunkData, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function draw3DWorkSuiteIcon(x, y, w, h, isMaskable = false) {
  const nx = (x / w) * 2 - 1;
  const ny = (y / h) * 2 - 1;
  const dist = Math.hypot(nx, ny);

  // Background dark tech slate #090d16
  let bgR = 9, bgG = 13, bgB = 22;
  const glow = Math.max(0, 1 - dist * 0.95);
  bgR += Math.floor(glow * 18);
  bgG += Math.floor(glow * 40);
  bgB += Math.floor(glow * 75);

  if (!isMaskable) {
    const cornerD = Math.pow(Math.abs(nx), 3.8) + Math.pow(Math.abs(ny), 3.8);
    if (cornerD > 1) {
      return [0, 0, 0, 0];
    }
  }

  const scale = isMaskable ? 0.52 : 0.62;
  const px = nx / scale;
  const py = ny / scale;

  function insidePoly(pts, testX, testY) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1];
      const xj = pts[j][0], yj = pts[j][1];
      const intersect = ((yi > testY) !== (yj > testY)) &&
        (testX < (xj - xi) * (testY - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // 3D Isometric cube geometry with beveled chamfers
  const topFace = [[0, -0.86], [0.76, -0.42], [0, 0.02], [-0.76, -0.42]];
  const leftFace = [[-0.76, -0.42], [0, 0.02], [0, 0.88], [-0.76, 0.44]];
  const rightFace = [[0, 0.02], [0.76, -0.42], [0.76, 0.44], [0, 0.88]];

  let r = bgR, g = bgG, b = bgB, a = 255;

  if (insidePoly(topFace, px, py)) {
    // Electric Cyan & Blue CAD plane
    const factor = (px + 0.76) / 1.52;
    r = Math.floor(6 + factor * 30);
    g = Math.floor(182 - factor * 30);
    b = Math.floor(212 + factor * 35);
    // Grid lines on top face
    const u = (px / 0.76 + (py + 0.42) / 0.44) * 3;
    const v = (-px / 0.76 + (py + 0.42) / 0.44) * 3;
    if (Math.abs(u - Math.round(u)) < 0.1 || Math.abs(v - Math.round(v)) < 0.1) {
      r = 240; g = 250; b = 255;
    }
  } else if (insidePoly(leftFace, px, py)) {
    // Cobalt CAD shade
    const factor = (py - 0.02) / 0.86;
    r = Math.floor(14 + factor * 10);
    g = Math.floor(116 - factor * 40);
    b = Math.floor(200 - factor * 40);
    const u = (px / 0.76 + 1) * 3;
    const v = (py / 0.88) * 3;
    if (Math.abs(u - Math.round(u)) < 0.09 || Math.abs(v - Math.round(v)) < 0.09) {
      r = 180; g = 230; b = 255;
    }
  } else if (insidePoly(rightFace, px, py)) {
    // Dark steel blueprint facet
    const factor = (px) / 0.76;
    r = Math.floor(30 + factor * 20);
    g = Math.floor(58 + factor * 30);
    b = Math.floor(138 + factor * 20);
    const u = (px / 0.76) * 3;
    const v = (py / 0.88) * 3;
    if (Math.abs(u - Math.round(u)) < 0.09 || Math.abs(v - Math.round(v)) < 0.09) {
      r = 160; g = 200; b = 255;
    }
  }

  return [r, g, b, a];
}

const pubDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

console.log('Generating 3D Work Suite icons...');

fs.writeFileSync(path.join(pubDir, 'pwa-192x192.png'), createPNG(192, 192, (x,y,w,h) => draw3DWorkSuiteIcon(x,y,w,h,false)));
fs.writeFileSync(path.join(pubDir, 'pwa-512x512.png'), createPNG(512, 512, (x,y,w,h) => draw3DWorkSuiteIcon(x,y,w,h,false)));
fs.writeFileSync(path.join(pubDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, (x,y,w,h) => draw3DWorkSuiteIcon(x,y,w,h,true)));
fs.writeFileSync(path.join(pubDir, 'apple-touch-icon.png'), createPNG(180, 180, (x,y,w,h) => draw3DWorkSuiteIcon(x,y,w,h,false)));
fs.writeFileSync(path.join(pubDir, 'favicon.ico'), createPNG(64, 64, (x,y,w,h) => draw3DWorkSuiteIcon(x,y,w,h,false)));

// Vector SVG for 3D Work Suite
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16" />
      <stop offset="50%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>
    <linearGradient id="topPlane" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="leftPlane" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0ea5e9" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
    <linearGradient id="rightPlane" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>

  <!-- Background Base -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect width="504" height="504" x="4" y="4" rx="108" fill="none" stroke="#1e293b" stroke-width="2"/>

  <!-- Construction Circles / CAD Grid Guide -->
  <circle cx="256" cy="256" r="185" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="6 6"/>
  <circle cx="256" cy="256" r="130" fill="none" stroke="#334155" stroke-width="1" opacity="0.6"/>

  <g transform="translate(256, 256)">
    <!-- Top Face of 3D Work Suite Cube -->
    <polygon points="0,-140 125,-68 0,4 -125,-68" fill="url(#topPlane)" stroke="#bae6fd" stroke-width="2.5" stroke-linejoin="round" />
    
    <!-- Left Face -->
    <polygon points="-125,-68 0,4 0,146 -125,74" fill="url(#leftPlane)" stroke="#7dd3fc" stroke-width="2.5" stroke-linejoin="round" />
    
    <!-- Right Face -->
    <polygon points="0,4 125,-68 125,74 0,146" fill="url(#rightPlane)" stroke="#93c5fd" stroke-width="2.5" stroke-linejoin="round" />

    <!-- Isometric CAD Subdivisions / Work Lines -->
    <!-- Top Grid Lines -->
    <line x1="-62.5" y1="-104" x2="62.5" y2="-32" stroke="#e0f2fe" stroke-width="1.8" opacity="0.75" />
    <line x1="62.5" y1="-104" x2="-62.5" y2="-32" stroke="#e0f2fe" stroke-width="1.8" opacity="0.75" />

    <!-- Left Grid Lines -->
    <line x1="-125" y1="3" x2="0" y2="75" stroke="#bae6fd" stroke-width="1.8" opacity="0.65" />
    <line x1="-62.5" y1="-32" x2="-62.5" y2="110" stroke="#bae6fd" stroke-width="1.8" opacity="0.65" />

    <!-- Right Grid Lines -->
    <line x1="0" y1="75" x2="125" y2="3" stroke="#dbeafe" stroke-width="1.8" opacity="0.65" />
    <line x1="62.5" y1="-32" x2="62.5" y2="110" stroke="#dbeafe" stroke-width="1.8" opacity="0.65" />

    <!-- Center Coordinate Node & Precision Vertices -->
    <circle cx="0" cy="4" r="7" fill="#38bdf8" stroke="#ffffff" stroke-width="2.5" />
    <circle cx="0" cy="-140" r="5" fill="#ffffff" />
    <circle cx="125" cy="-68" r="5" fill="#ffffff" />
    <circle cx="-125" cy="-68" r="5" fill="#ffffff" />
    <circle cx="0" cy="146" r="5" fill="#ffffff" />
    <circle cx="-125" cy="74" r="5" fill="#ffffff" />
    <circle cx="125" cy="74" r="5" fill="#ffffff" />

    <!-- Technical Work Crosshairs -->
    <line x1="-15" y1="4" x2="-25" y2="4" stroke="#ffffff" stroke-width="2" />
    <line x1="15" y1="4" x2="25" y2="4" stroke="#ffffff" stroke-width="2" />
    <line x1="0" y1="-11" x2="0" y2="-21" stroke="#ffffff" stroke-width="2" />
    <line x1="0" y1="19" x2="0" y2="29" stroke="#ffffff" stroke-width="2" />
  </g>
</svg>`;

fs.writeFileSync(path.join(pubDir, 'icon.svg'), svgContent, 'utf8');

console.log('3D Work Suite icons generated successfully!');
