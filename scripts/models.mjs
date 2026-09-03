// Download the CC0 furniture models named in models.manifest.json from Poly Haven and
// compress them into the .glb files the 3D view loads.
//
//   npm run models            # skip anything already built
//   npm run models -- --force # rebuild every model
//   npm run models -- bed sofa
//
// Writes public/models/<name>.glb and public/models/LICENSES.md, and prints a size table.
// Every asset on Poly Haven is CC0, so the licence file is attribution, not obligation.
//
// The pipeline per model is: fetch the asset's file index, pull the 1k glTF and its textures,
// then hand the lot to gltf-transform to weld and dedup the geometry, drop the textures to 512
// px WebP, and pack it all as meshopt-compressed .glb. That is what turns a 4 MB studio asset
// into something a browser can pull down alongside twenty others.
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'models');
const API = 'https://api.polyhaven.com';
/** Poly Haven's own cap, and well above what we ask of it: be a polite client anyway. */
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = new Set(args.filter((a) => !a.startsWith('--')));

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url} — ${r.status} ${r.statusText}`);
  return r.json();
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GET ${url} — ${r.status} ${r.statusText}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
}

/** gltf-transform as a child process: the CLI carries its own sharp and meshoptimizer builds. */
function gltfTransform(argv) {
  return new Promise((ok, fail) => {
    const p = spawn('npx', ['--no-install', 'gltf-transform', ...argv], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stdout.on('data', () => {});
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', fail);
    p.on('close', (code) => (code === 0 ? ok() : fail(new Error(`gltf-transform ${argv[0]} failed (${code})\n${err.trim()}`))));
  });
}

/**
 * One model, start to finish.
 *
 * Returns the row it contributes to the size table, plus the credit line for LICENSES.md.
 * The size cap is not advisory: a model that will not fit is retried at half the texture
 * resolution, and only then given up on, because one 3 MB sofa costs more than every
 * procedural fallback in the app put together.
 */
async function build(entry, defaults) {
  const out = join(outDir, `${entry.name}.glb`);
  const info = await getJson(`${API}/info/${entry.slug}`);
  const credit = {
    name: entry.name,
    slug: entry.slug,
    title: info.name ?? entry.slug,
    authors: Object.keys(info.authors ?? {}),
    keys: entry.keys ?? [],
  };

  if (existsSync(out) && !force) {
    return { ...credit, bytes: (await stat(out)).size, skipped: true };
  }

  const files = await getJson(`${API}/files/${entry.slug}`);
  const gltf = files.gltf?.[entry.res ?? '1k']?.gltf;
  if (!gltf) throw new Error(`${entry.slug}: no glTF at ${entry.res ?? '1k'}`);

  const work = await mkdtemp(join(tmpdir(), `floorplay-${entry.name}-`));
  try {
    const src = join(work, `${entry.slug}.gltf`);
    await download(gltf.url, src);
    // The include map is keyed by the path the .gltf expects, so the tree has to be rebuilt
    // exactly: textures/<name>.jpg next to the model, the .bin beside it.
    await Promise.all(Object.entries(gltf.include ?? {}).map(([rel, f]) => download(f.url, join(work, rel))));

    let size = entry.textureSize ?? defaults.textureSize;
    for (let attempt = 0; ; attempt++) {
      await gltfTransform([
        'optimize', src, out,
        '--compress', 'meshopt',
        '--texture-compress', 'webp',
        '--texture-size', String(size),
        // Palette textures merge materials, and the renderer tints wood and fabric separately.
        '--palette', 'false',
        // Instancing needs the clone to carry EXT_mesh_gpu_instancing through; a room holds a
        // handful of any one model, so there is nothing to win and a clone bug to lose.
        '--instance', 'false',
        '--join', 'true',
        '--weld', 'true',
        '--simplify', 'true',
        '--simplify-ratio', String(entry.simplifyRatio ?? 0),
        '--simplify-error', String(entry.simplifyError ?? 0.001),
      ]);
      const bytes = (await stat(out)).size;
      if (bytes <= defaults.maxBytes || attempt >= 1) {
        if (bytes > defaults.maxBytes) throw new Error(`${entry.name}: ${fmt(bytes)} exceeds the ${fmt(defaults.maxBytes)} cap even at ${size} px`);
        return { ...credit, bytes, textureSize: size };
      }
      size = Math.max(128, Math.round(size / 2));
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const fmt = (b) => `${(b / 1024).toFixed(0)} KB`;

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

async function main() {
  const manifest = JSON.parse(await readFile(join(root, 'scripts', 'models.manifest.json'), 'utf8'));
  const defaults = { textureSize: manifest.textureSize ?? 512, maxBytes: manifest.maxBytes ?? 1258291 };
  const wanted = manifest.models.filter((m) => only.size === 0 || only.has(m.name));
  if (wanted.length === 0) throw new Error(`nothing matched ${[...only].join(', ')}`);
  await mkdir(outDir, { recursive: true });

  const rows = await pool(wanted, CONCURRENCY, (m) => build(m, defaults));
  rows.sort((a, b) => b.bytes - a.bytes);

  const pad = Math.max(...rows.map((r) => r.name.length));
  console.log(`\n  ${'model'.padEnd(pad)}  ${'size'.padStart(8)}  source`);
  for (const r of rows) {
    console.log(`  ${r.name.padEnd(pad)}  ${fmt(r.bytes).padStart(8)}  ${r.slug}${r.skipped ? '  (cached)' : ''}`);
  }
  console.log(`  ${'total'.padEnd(pad)}  ${fmt(rows.reduce((s, r) => s + r.bytes, 0)).padStart(8)}  ${rows.length} models\n`);

  const all = JSON.parse(await readFile(join(root, 'scripts', 'models.manifest.json'), 'utf8')).models;
  if (wanted.length === all.length) await writeLicenses(rows);
}

async function writeLicenses(rows) {
  const lines = [
    '# 3D model credits',
    '',
    'Every model in this folder comes from [Poly Haven](https://polyhaven.com/models) and is',
    'published under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/): free to use,',
    'modify and redistribute, commercially or otherwise, with no attribution required. The credits',
    'below are given because the people who made these spent real time on them.',
    '',
    'The files here are not the originals. Each was downloaded at 1k, then welded, deduplicated,',
    'resized to 512 px WebP textures and packed as meshopt-compressed glTF by `npm run models`.',
    '',
    '| File | Poly Haven asset | Author | Stands in for |',
    '| --- | --- | --- | --- |',
  ];
  for (const r of [...rows].sort((a, b) => a.name.localeCompare(b.name))) {
    const keys = r.keys.length ? r.keys.map((k) => `\`${k}\``).join(', ') : '—';
    lines.push(`| \`${r.name}.glb\` | [${r.title}](https://polyhaven.com/a/${r.slug}) | ${r.authors.join(', ')} | ${keys} |`);
  }
  lines.push('');
  await writeFile(join(outDir, 'LICENSES.md'), lines.join('\n'));
}

main().catch((e) => { console.error(`\n  ${e.message}\n`); process.exit(1); });
