/**
 * Fetch the CC0 Poly Haven assets used by the app.
 *
 * Usage:
 *   node scripts/fetch-assets.mjs            # models + hdri
 *   node scripts/fetch-assets.mjs models     # models only
 *   node scripts/fetch-assets.mjs hdri       # hdri only
 *
 * Everything Poly Haven ships is CC0 (public domain, no attribution required).
 * We still list every file in `src/data/assetCredits.js` because the app has to
 * be able to answer "where did this come from?" for every single asset.
 *
 * Files land in `.cache/polyhaven/<modelId>/...` (gltf + bin + jpg) and
 * `.cache/polyhaven-hdri/`. `npm run assets:optimize` turns the raw glTF into
 * the compact GLB that ships in `public/assets/`. Raw downloads are gitignored;
 * the optimized GLB and the HDRI are committed, so the app never depends on a
 * third-party server at runtime.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.polyhaven.com';
const CDN = 'https://cdn.polyhaven.com';
const MODEL_RES = '1k';

/** Model id -> why the office needs it. */
const MODELS = {
  classic_laptop: 'Workstation laptop',
  Television_01: 'Desk monitor / wall display',
  office_notepads: 'Desk prop',
  stationery_supplies: 'Desk prop',
  desk_lamp_arm_01: 'Desk lamp',
  drawer_cabinet: 'Under-desk cabinet',
  metal_trash_can: 'Office bin',
  wall_clock: 'Office clock',
  circuit_board: 'Server-room detail',
  power_box_01: 'Infrastructure cabinet',
  projector_screen: 'Meeting-room screen',
};

/** HDRI id -> used as image-based lighting + reflection probe. */
const HDRI = 'studio_small_09';

const TARGETS = new Set(process.argv.slice(2).filter((a) => !a.startsWith('-')));
const wants = (name) => TARGETS.size === 0 || TARGETS.has(name);

const json = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
};

const download = async (url, file) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, buf);
  return buf.length;
};

/** Save a file only when its content changed, so re-runs stay quiet. */
const downloadIfChanged = async (url, file) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const md5 = createHash('md5').update(buf).digest('hex');
  const rel = file.slice(ROOT.length + 1).replace(/[\\/]/g, '_');
  const sumFile = join(ROOT, '.cache', 'md5', `${rel}.md5`);
  try {
    if ((await readFile(sumFile, 'utf8')).trim() === md5) return 'unchanged';
  } catch {
    /* first run */
  }
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, buf);
  await mkdir(dirname(sumFile), { recursive: true });
  await writeFile(sumFile, `${md5}\n`);
  return `${Math.round(buf.length / 1024)} KB`;
};

async function fetchModels() {
  const dest = join(ROOT, '.cache', 'polyhaven');
  for (const [id, purpose] of Object.entries(MODELS)) {
    const files = await json(`${API}/files/${id}`);
    const resolutions = files.gltf ?? {};
    const resolution = resolutions[MODEL_RES] ?? resolutions[Object.keys(resolutions)[0]];
    const file = resolution?.gltf ?? resolution?.glb ?? Object.values(resolution ?? {}).find((f) => f?.url);
    if (!file?.url) {
      console.warn(`! ${id}: no gltf export, skipped (${purpose})`);
      continue;
    }
    const dir = join(dest, id);
    const main = file.url.split('/').pop();
    await downloadIfChanged(file.url, join(dir, main));
    for (const [rel, info] of Object.entries(file.include ?? {})) {
      const relSafe = rel.replace(/^\.\//, '');
      await downloadIfChanged(info.url, join(dir, relSafe));
    }
    const gltf = JSON.parse(await readFile(join(dir, main), 'utf8'));
    console.log(`ok ${id.padEnd(22)} ${main} buffers:${gltf.buffers?.length ?? 0} images:${gltf.images?.length ?? 0}  (${purpose})`);
  }
}

async function fetchHdri() {
  const dest = join(ROOT, 'public', 'assets', 'hdri');
  const files = await json(`${API}/files/${HDRI}`);
  const hdr = files.hdri?.['1k']?.hdr;
  if (!hdr) throw new Error(`${HDRI}: no 1k hdr`);
  console.log(`ok ${HDRI} ${await downloadIfChanged(hdr.url, join(dest, `${HDRI}_1k.hdr`))}`);
}

/**
 * Thumbnails for the in-app Credits modal, so the credits panel can show a real
 * preview of every Poly Haven asset without a runtime round-trip to the CDN.
 */
async function fetchCredits() {
  const dest = join(ROOT, 'public', 'assets', 'credits');
  const ids = [...Object.keys(MODELS), HDRI];
  for (const id of ids) {
    try {
      const size = await downloadIfChanged(`${CDN}/asset_img/thumbs/${id}.png?height=200`, join(dest, `${id}.png`));
      console.log(`ok credit ${id.padEnd(22)} ${size}`);
    } catch (error) {
      console.warn(`! credit ${id}: ${error.message}`);
    }
  }
}

const todo = [];
if (wants('models')) todo.push(fetchModels());
if (wants('hdri')) todo.push(fetchHdri());
if (wants('credits')) todo.push(fetchCredits());
if (!todo.length) todo.push(fetchModels(), fetchHdri(), fetchCredits());
for (const t of todo) await t;
console.log('done');
process.exit(0);
