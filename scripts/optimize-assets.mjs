/**
 * Turn the raw Poly Haven glTF files in `.cache/polyhaven` into the compact GLBs
 * that ship in `public/assets/polyhaven`.
 *
 * Why: the raw exports are 1-5 MB each (dense geometry, 1k PBR maps). The app
 * shows dozens of desk props at once, so every model is flattened, welded,
 * simplified, texture-capped at 512 px and quantized with KHR_mesh_quantization
 * (supported natively by three.js - no Draco/Meshopt decoder needed at runtime).
 *
 * Run `npm run assets:fetch` first. Output is deterministic, so re-running only
 * reports the sizes.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, '.cache', 'polyhaven');
const OUT = join(ROOT, 'public', 'assets', 'polyhaven');
const TEXTURE_SIZE = 512;

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

async function main() {
  const entries = await readdir(SRC, { withFileTypes: true }).catch(() => []);
  const models = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  if (!models.length) {
    console.error('No raw models in .cache/polyhaven - run `npm run assets:fetch` first.');
    process.exit(1);
  }
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  for (const id of models.sort()) {
    const dir = join(SRC, id);
    const gltf = (await readdir(dir)).find((f) => f.endsWith('.gltf'));
    if (!gltf) {
      console.warn(`! ${id}: no .gltf, skipped`);
      continue;
    }
    const target = join(OUT, `${id}.glb`);
    const result = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      [
        'gltf-transform', 'optimize',
        join(dir, gltf), target,
        '--compress', 'quantize',
        '--texture-size', String(TEXTURE_SIZE),
        '--simplify-ratio', '0.6',
        '--palette', 'false',
      ],
      { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], shell: process.platform === 'win32' },
    );
    if (result.status !== 0) {
      console.error(`! ${id}: gltf-transform failed\n${result.stderr?.toString().trim()}`);
      process.exit(result.status ?? 1);
    }
    const before = await dirSize(dir);
    const after = (await stat(target)).size;
    console.log(`ok ${id.padEnd(22)} ${kb(before).padStart(8)} -> ${kb(after).padStart(8)}`);
  }
  console.log(`done - ${OUT}`);
}

async function dirSize(path) {
  let total = 0;
  for (const e of await readdir(path, { withFileTypes: true })) {
    const p = join(path, e.name);
    if (e.isDirectory()) total += await dirSize(p);
    else if (!e.name.endsWith('.md5')) total += (await stat(p)).size;
  }
  return total;
}

await main();
