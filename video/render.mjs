// Rendu de la vidéo : la page index.html est positionnée image par image, capturée par Chromium,
// puis assemblée par ffmpeg (flou de mouvement par sur-échantillonnage temporel) avec la musique.
//
//   node render.mjs                         vidéo complète → out/happi-competence.mp4
//   node render.mjs --stills 4,8.2,20       images fixes → out/stills/
//   node render.mjs --sheet 1               planche contact (une image par seconde)
//   node render.mjs --from 18 --to 28       extrait
//   node render.mjs --page pn.html --music music-pn.wav --out passeport-numerique.mp4   autre vidéo (Passeport Numérique)
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] == null ? true : all[i + 1]]] : acc), []),
);
const FPS = Number(args.fps ?? 30);
const SUB = Number(args.sub ?? 4);
const SHUTTER = Number(args.shutter ?? 0.5);
const PAGE = String(args.page ?? 'index.html');
const MUSIC = String(args.music ?? 'music.wav');

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.jpg': 'image/jpeg' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const file = join(root, path);
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(4173, '127.0.0.1', r));

const browser = await chromium.launch({ args: ['--disable-web-security', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`http://127.0.0.1:4173/video/${PAGE}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).catch(() => {});
if (errors.length) console.log(errors.join('\n'));
const ready = await page.evaluate(() => window.__ready === true);
if (!ready) {
  console.error('La page ne s’est pas initialisée.');
  process.exit(1);
}
const duration = await page.evaluate(() => window.__video.duration);
const cdp = await page.context().newCDPSession(page);

async function grab(t, format = 'jpeg') {
  await page.evaluate((x) => window.__video.seek(x), t);
  const { data } = await cdp.send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 93 : undefined, optimizeForSpeed: true, captureBeyondViewport: false });
  return Buffer.from(data, 'base64');
}

const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });

if (args.stills || args.sheet) {
  const dir = join(outDir, 'stills');
  mkdirSync(dir, { recursive: true });
  const times = args.stills ? String(args.stills).split(',').map(Number) : Array.from({ length: Math.floor(duration / Number(args.sheet)) }, (_, i) => i * Number(args.sheet) + 0.5);
  for (const t of times) writeFileSync(join(dir, `t${t.toFixed(2).padStart(6, '0')}.png`), await grab(t, 'png'));
  console.log(`${times.length} image(s) → ${dir}`);
} else {
  const from = Number(args.from ?? 0);
  const to = Number(args.to ?? duration);
  const frames = Math.round((to - from) * FPS);
  const name = args.out ?? (from === 0 && to === duration ? 'happi-competence.mp4' : `extrait-${from}-${to}.mp4`);
  const music = join(outDir, MUSIC);
  const workers = Math.max(1, Number(args.workers ?? 3));
  const per = Math.ceil(frames / workers);
  const started = Date.now();
  let done = 0;
  const encode = (file) => [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
    '-filter_complex', `[0:v]tmix=frames=${SUB}:weights='${Array(SUB).fill(1).join(' ')}',select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${FPS}*TB),format=yuv420p[v]`,
    '-map', '[v]', '-r', String(FPS), '-c:v', 'libx264', '-preset', args.preset ?? 'slow', '-crf', String(args.crf ?? 16),
    '-profile:v', 'high', '-pix_fmt', 'yuv420p', file,
  ];
  async function worker(w) {
    const f0 = w * per;
    const f1 = Math.min(frames, f0 + per);
    if (f0 >= f1) return null;
    const p = w === 0 ? page : await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    if (w !== 0) {
      await p.goto(`http://127.0.0.1:4173/video/${PAGE}`);
      await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
    }
    const session = w === 0 ? cdp : await p.context().newCDPSession(p);
    const file = join(outDir, `segment-${w}.mp4`);
    const ff = spawn('ffmpeg', encode(file), { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = f0; f < f1; f++) {
      for (let k = 0; k < SUB; k++) {
        const t = from + f / FPS + (k * SHUTTER) / (FPS * SUB);
        await p.evaluate((x) => window.__video.seek(x), t);
        const { data } = await session.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true });
        if (!ff.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
      }
      done++;
      if (done % 90 === 0) {
        const el = (Date.now() - started) / 1000;
        process.stdout.write(`${done}/${frames} images · ${el.toFixed(0)} s · reste ~${((el / done) * (frames - done)).toFixed(0)} s\n`);
      }
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    return file;
  }
  const segments = (await Promise.all(Array.from({ length: workers }, (_, w) => worker(w)))).filter(Boolean);
  const list = join(outDir, 'segments.txt');
  writeFileSync(list, segments.map((f) => `file '${f}'`).join('\n'));
  const mux = [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    ...(existsSync(music) ? ['-ss', String(from), '-t', String(to - from), '-i', music, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k'] : []),
    '-c:v', 'copy', '-movflags', '+faststart', '-shortest', join(outDir, name),
  ];
  await new Promise((r) => spawn('ffmpeg', mux, { stdio: 'inherit' }).on('close', r));
  console.log(`→ ${join(outDir, name)} (${((Date.now() - started) / 60000).toFixed(1)} min)`);
}
if (errors.length) console.log(`Avertissements de la page :\n${[...new Set(errors)].slice(0, 20).join('\n')}`);
await browser.close();
server.close();
