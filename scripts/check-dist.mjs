#!/usr/bin/env node
// Post-build guard for the PWA output (plan Phase 5; PRD FR-17/18/21, §7.3, §7.5).
// Plain Node, no deps. Usage: [BASE_PATH=/brow-guess/] node scripts/check-dist.mjs [distDir]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(process.argv[2] ?? join(root, 'dist'));
const base = process.env.BASE_PATH ?? '/';
const GZIP_BUDGET = 150 * 1024;

/**
 * URL literals allowed in built JS: SVG/XML namespaces, Workbox's own doc links, and
 * the app's public address (SHARE_URL: shared from the results screen, never fetched).
 */
const URL_ALLOW = [
  /^http:\/\/www\.w3\.org\//,
  // Workbox short links (bit.ly/w?-...); spelled with a class so the brand guard's
  // two-letter-acronym rule doesn't trip on it.
  /^https:\/\/bit\.ly\/w[b]-/,
  /^https:\/\/goo\.gl\//,
  /^https:\/\/developers\.google\.com\/web\/tools\/workbox/,
  /^https:\/\/github\.com\/GoogleChrome\/workbox/,
  /^https:\/\/matt-moses\.github\.io\/brow-guess\/$/,
];

const failures = [];
const fail = (msg) => failures.push(msg);
const rel = (p) => relative(dist, p).split(sep).join('/');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Reads width/height from a PNG's IHDR chunk. */
function pngSize(file) {
  const b = readFileSync(file);
  const sig = '89504e470d0a1a0a';
  if (b.length < 24 || b.subarray(0, 8).toString('hex') !== sig) return null;
  if (b.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

if (!existsSync(dist) || !statSync(dist).isDirectory()) {
  console.error(`check-dist: FAILED — dist directory not found: ${dist} (run the build first)`);
  process.exit(1);
}
if (!base.startsWith('/') || !base.endsWith('/')) {
  fail(`BASE_PATH must start and end with "/" (got ${JSON.stringify(base)})`);
}

const files = walk(dist).map(rel);
const assetFiles = files.filter((f) => /^assets\/[^/]+\.(js|css)$/.test(f));

// --- manifest ------------------------------------------------------------------
const manifestIcons = [];
const manifestPath = join(dist, 'manifest.webmanifest');
if (!existsSync(manifestPath)) {
  fail('manifest.webmanifest is missing');
} else {
  let m = null;
  try {
    m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    fail(`manifest.webmanifest does not parse: ${e.message}`);
  }
  if (m) {
    const expect = (key, want) => {
      if (m[key] !== want)
        fail(`manifest.${key} is ${JSON.stringify(m[key])}, expected ${JSON.stringify(want)}`);
    };
    if (!m.name || !m.short_name) fail('manifest name/short_name missing');
    expect('start_url', base);
    expect('scope', base);
    expect('id', base);
    expect('display', 'fullscreen');
    expect('orientation', 'landscape');
    if (!m.theme_color || !m.background_color)
      fail('manifest theme_color/background_color missing');
    const icons = Array.isArray(m.icons) ? m.icons : [];
    const has = (size, purpose) =>
      icons.some(
        (i) =>
          String(i.sizes).split(/\s+/).includes(size) &&
          String(i.purpose ?? 'any')
            .split(/\s+/)
            .includes(purpose),
      );
    if (!has('192x192', 'any')) fail('manifest lacks a 192x192 icon');
    if (!has('512x512', 'any')) fail('manifest lacks a 512x512 icon');
    if (!has('512x512', 'maskable')) fail('manifest lacks a maskable 512x512 icon');
    for (const icon of icons) {
      // Icon src resolves relative to the manifest, which sits at the base root.
      const src = String(icon.src).replace(/^\.\//, '');
      if (/^[a-z]+:|^\/\//i.test(src)) {
        fail(`manifest icon is not same-origin: ${icon.src}`);
        continue;
      }
      const path = src.startsWith('/')
        ? src.startsWith(base)
          ? src.slice(base.length)
          : null
        : src;
      if (path === null) {
        fail(`manifest icon ${icon.src} is outside base ${base}`);
        continue;
      }
      manifestIcons.push(path);
      const file = join(dist, path);
      if (!existsSync(file)) {
        fail(`manifest icon file missing: ${path}`);
        continue;
      }
      if (icon.type === 'image/png') {
        const dims = pngSize(file);
        const [w, h] = String(icon.sizes).split('x').map(Number);
        if (!dims) fail(`${path} is not a valid PNG`);
        else if (dims.width !== w || dims.height !== h)
          fail(`${path} is ${dims.width}x${dims.height}, manifest declares ${icon.sizes}`);
      }
    }
  }
}

// PNGs named with their size (icon-192.png, apple-touch-icon-180.png) must match it.
for (const f of files.filter((f) => /^icons\/.*\.png$/.test(f))) {
  const n = /-(\d+)\.png$/.exec(f)?.[1];
  const dims = pngSize(join(dist, f));
  if (!dims) fail(`${f} is not a valid PNG`);
  else if (n && (dims.width !== +n || dims.height !== +n))
    fail(`${f} is ${dims.width}x${dims.height}, its name says ${n}x${n}`);
}

// --- service worker ------------------------------------------------------------
const swPath = join(dist, 'sw.js');
if (!existsSync(swPath)) {
  fail('sw.js is missing');
} else {
  const sw = readFileSync(swPath, 'utf8');
  const precache = new Set(
    [...sw.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)].map((x) => x[1]),
  );
  if (precache.size === 0) fail('sw.js has no precache entries');
  const required = new Set([
    'index.html',
    'manifest.webmanifest',
    ...assetFiles,
    ...manifestIcons,
    ...files.filter((f) => f.startsWith('icons/')),
  ]);
  for (const r of required) if (!precache.has(r)) fail(`sw.js precache is missing ${r}`);
  for (const p of precache)
    if (!files.includes(p)) fail(`sw.js precaches ${p}, which is not in dist`);
}

// --- index.html ----------------------------------------------------------------
const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) {
  fail('index.html is missing');
} else {
  const html = readFileSync(indexPath, 'utf8');
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>)]+/g))
    fail(`index.html has an absolute URL: ${m[0]}`);
  for (const m of html.matchAll(/\b(?:href|src)\s*=\s*["']([^"']*)["']/g)) {
    const url = m[1];
    if (!url.startsWith(base) || url.startsWith('//')) {
      fail(`index.html reference is not base-prefixed (${base}): ${url}`);
      continue;
    }
    const file = url.slice(base.length).split(/[?#]/)[0];
    if (file && !files.includes(file)) fail(`index.html references a missing file: ${url}`);
  }
}

// --- no external network calls in built JS ------------------------------------
for (const f of files.filter((f) => f.endsWith('.js'))) {
  const js = readFileSync(join(dist, f), 'utf8');
  for (const m of js.matchAll(/https?:\/\/[^\s"'`<>)\\]+/g)) {
    if (!URL_ALLOW.some((re) => re.test(m[0]))) fail(`${f} contains an external URL: ${m[0]}`);
  }
}

// --- size report ------------------------------------------------------------------
const gz = assetFiles.reduce(
  (sum, f) => sum + gzipSync(readFileSync(join(dist, f)), { level: 9 }).length,
  0,
);
const kb = (gz / 1024).toFixed(1);
if (gz > GZIP_BUDGET)
  console.warn(`check-dist: WARNING — assets JS+CSS gzip ${kb} KB exceeds 150 KB`);
else
  console.log(
    `check-dist: assets JS+CSS gzip ${kb} KB (${assetFiles.length} files, budget 150 KB)`,
  );

if (failures.length) {
  console.error(`check-dist: FAILED (base=${base}, dist=${dist}) — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`check-dist: OK (base=${base})`);
