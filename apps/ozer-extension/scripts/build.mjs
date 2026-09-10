import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

await mkdir(join(dist, 'content'), { recursive: true });
await mkdir(join(dist, 'icons'), { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: {
    background: 'src/background.ts',
    popup: 'src/popup.ts',
    options: 'src/options.ts',
    capture: 'src/capture.ts',
    'content/meet': 'src/content/meet.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  logLevel: 'info',
});

await Promise.all([
  cp(join(src, 'manifest.json'), join(dist, 'manifest.json')),
  cp(join(src, 'popup.html'), join(dist, 'popup.html')),
  cp(join(src, 'options.html'), join(dist, 'options.html')),
  cp(join(src, 'capture.html'), join(dist, 'capture.html')),
  cp(join(src, 'shared.css'), join(dist, 'shared.css')),
  cp(join(src, 'content/meet.css'), join(dist, 'content/meet.css')),
]);

function crc32(buf) {
  let crc = ~0;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const dest = y * (size * 4 + 1) + 1 + x * 4;
      raw[dest] = rgba[0];
      raw[dest + 1] = rgba[1];
      raw[dest + 2] = rgba[2];
      raw[dest + 3] = rgba[3];
      const cx = x + 0.5 - size / 2;
      const cy = y + 0.5 - size / 2;
      const r = Math.hypot(cx, cy);
      if (r < size * 0.18) {
        raw[dest] = 251;
        raw[dest + 1] = 246;
        raw[dest + 2] = 236;
      } else if (r > size * 0.46) {
        raw[dest + 3] = 0;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const coral = [255, 92, 52, 255];
await Promise.all(
  [16, 48, 128].map((size) =>
    writeFile(join(dist, 'icons', `icon${size}.png`), png(size, coral)),
  ),
);
