import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const EXE = process.env.GEOM_BROWSER_EXE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifact = process.argv[2];
const outJson = process.argv[3];
const shotDir = process.argv[4] || null;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWPORTS = [
  { id: 'v320x568', width: 320, height: 568 },
  { id: 'v390x844', width: 390, height: 844 },
  { id: 'v768x1024', width: 768, height: 1024 },
  { id: 'v1440x1000', width: 1440, height: 1000 },
  { id: 'v1920x1080', width: 1920, height: 1080 },
  { id: 'v2560x1080', width: 2560, height: 1080 },
];

class Client {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = [];
    this.socket = new WebSocket(url);
    this.ready = new Promise((res, rej) => {
      this.socket.addEventListener('open', res, { once: true });
      this.socket.addEventListener('error', () => rej(new Error('ws failed')), { once: true });
    });
    this.socket.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || 'cdp error'));
        else resolve(msg.result || {});
        return;
      }
      if (msg.method) this.handlers.forEach((h) => h(msg));
    });
  }
  on(fn) { this.handlers.push(fn); }
  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket.close(); }
}

const profile = await mkdtemp(path.join(tmpdir(), 'geom-cap-'));
const args = ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
  '--disable-sync', '--allow-file-access-from-files', `--user-data-dir=${profile}`,
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', 'about:blank'];
const chrome = spawn(EXE, args, { stdio: ['ignore', 'ignore', 'pipe'] });
let port = null;
for (let i = 0; i < 120; i += 1) {
  if (chrome.exitCode != null) throw new Error('chrome exited early');
  try {
    const line = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/)[0];
    port = Number(line);
    if (Number.isInteger(port) && port > 0) break;
  } catch (e) { /* not ready yet */ }
  await delay(100);
}
if (!port) throw new Error('no devtools port');
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
const client = new Client(target.webSocketDebuggerUrl);
await client.send('Page.enable');
await client.send('Runtime.enable');
await client.send('Log.enable');

let consoleErrors = 0;
let consoleWarnings = 0;
client.on((msg) => {
  if (msg.method === 'Log.entryAdded') {
    const lvl = msg.params && msg.params.entry ? msg.params.entry.level : null;
    if (lvl === 'error') consoleErrors += 1;
    else if (lvl === 'warning') consoleWarnings += 1;
  }
  if (msg.method === 'Runtime.exceptionThrown') consoleErrors += 1;
});

const fileUrl = pathToFileURL(artifact).toString();
const MEASURE = `(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { left: Math.round(b.left), top: Math.round(b.top), right: Math.round(b.right), bottom: Math.round(b.bottom), width: Math.round(b.width), height: Math.round(b.height) };
  };
  const de = document.documentElement;
  const imgs = Array.from(document.images);
  const vh = window.innerHeight;
  const cta = rect('.hero-actions .btn--primary');
  const media = rect('.phone-mock');
  const next = (() => {
    const nodes = Array.from(document.querySelectorAll('.next-hint'));
    const vis = nodes.find((n) => n.offsetParent !== null || n.getClientRects().length > 0);
    if (!vis) return null;
    const b = vis.getBoundingClientRect();
    return { left: Math.round(b.left), top: Math.round(b.top), right: Math.round(b.right), bottom: Math.round(b.bottom), width: Math.round(b.width), height: Math.round(b.height) };
  })();
  return {
    client_width: de.clientWidth,
    scroll_width: de.scrollWidth,
    scroll_height: de.scrollHeight,
    viewport_height: vh,
    image_count: imgs.length,
    loaded_images: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
    probes: {
      nav_bar: rect('.nav-inner'),
      note_strip: rect('.note-inner'),
      hero_heading: rect('#hero-title'),
      hero_cta: cta,
      hero_media: media,
      hero_next: next,
      works_grid: rect('.grid-works'),
      approach_band: rect('#approach'),
      case_main: rect('#case .case-media img'),
      contact_card: rect('.contact-card'),
      footer: rect('.footer-inner')
    },
    first_viewport: {
      cta_fully_visible: !!cta && cta.bottom <= vh,
      media_visible: !!media && media.top < vh,
      media_fully_visible: !!media && media.bottom <= vh,
      next_section_hint_visible: !!next && next.top < vh
    }
  };
})()`;

const viewports = [];
for (const vp of VIEWPORTS) {
  consoleErrors = 0;
  consoleWarnings = 0;
  await client.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: false });
  await client.send('Page.navigate', { url: 'about:blank' });
  await client.send('Page.navigate', { url: fileUrl });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await delay(100);
    const r = await client.send('Runtime.evaluate', {
      expression: `({ ready: document.readyState, state: document.documentElement.dataset.designSuiteStaticState || null })`,
      returnByValue: true,
    });
    const v = r.result ? r.result.value : null;
    if (v && v.ready === 'complete' && v.state) break;
  }
  const measured = await client.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
  const value = measured.result.value;
  viewports.push({
    id: vp.id,
    width: vp.width,
    height: vp.height,
    client_width: value.client_width,
    scroll_width: value.scroll_width,
    console_errors: consoleErrors,
    console_warnings: consoleWarnings,
    image_count: value.image_count,
    loaded_images: value.loaded_images,
    probes: value.probes,
    first_viewport: value.first_viewport,
    page_height: value.scroll_height,
  });
  const p = value.probes;
  console.log(vp.id, 'client=' + value.client_width, 'scroll=' + value.scroll_width,
    'imgs=' + value.loaded_images + '/' + value.image_count,
    'console=' + consoleErrors + '/' + consoleWarnings,
    'ctaVisible=' + value.first_viewport.cta_fully_visible,
    'mediaVisible=' + value.first_viewport.media_visible,
    'nextVisible=' + value.first_viewport.next_section_hint_visible,
    '| ctaTop=' + (p.hero_cta ? p.hero_cta.top : 'n/a'),
    'mediaTop=' + (p.hero_media ? p.hero_media.top : 'n/a'),
    'mediaW=' + (p.hero_media ? p.hero_media.width : 'n/a'),
    'mediaH=' + (p.hero_media ? p.hero_media.height : 'n/a'),
    'pageH=' + value.scroll_height);

  if (shotDir && ['v320x568', 'v390x844', 'v768x1024', 'v1440x1000'].indexOf(vp.id) >= 0) {
    await mkdir(shotDir, { recursive: true });
    const shot = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(path.join(shotDir, `site-${vp.id}-viewport.png`), Buffer.from(shot.data, 'base64'));
    await client.send('Runtime.evaluate', {
      expression: `(async () => {
        const total = document.documentElement.scrollHeight;
        const step = Math.max(200, Math.round(window.innerHeight * 0.8));
        for (let y = 0; y <= total; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 70));
        }
        window.scrollTo(0, 0);
        await new Promise((r) => setTimeout(r, 600));
      })()`,
      awaitPromise: true,
    });
    const full = await client.send('Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: true });
    await writeFile(path.join(shotDir, `site-${vp.id}-full.jpg`), Buffer.from(full.data, 'base64'));
  }
}

const geometry = {
  artifact_type: 'website-layout-geometry/v1',
  generator: 'geometry_capture.mjs (Chrome DevTools Protocol)',
  source: path.basename(artifact),
  capture_method: 'headless Chrome + Emulation.setDeviceMetricsOverride against the exported single-file artifact (file://)',
  notes: [
    'Every number is measured in a real browser run; none is estimated.',
    'probe values are element bounding boxes in the coordinate space of the current viewport, rounded to whole pixels.',
    'first_viewport records whether the hero primary action, the hero media and the next-section hint reach the first viewport at each size.',
  ],
  required_viewports: VIEWPORTS.map((v) => ({ id: v.id, width: v.width, height: v.height })),
  probe_invariants: [
    { probe: 'hero_media', viewports: ['v320x568', 'v390x844', 'v768x1024'], max_shrink_px: 0 },
    { probe: 'hero_media', viewports: ['v1440x1000', 'v1920x1080', 'v2560x1080'], max_shrink_px: 0 },
    { probe: 'works_grid', viewports: ['v320x568', 'v390x844', 'v768x1024'], max_shrink_px: 0, min_width: 260 },
    { probe: 'contact_card', viewports: ['v390x844', 'v768x1024'], max_shrink_px: 0 },
  ],
  viewports,
};
await writeFile(outJson, JSON.stringify(geometry, null, 2) + '\n', 'utf8');
client.close();
chrome.kill('SIGKILL');
await delay(300);
await rm(profile, { recursive: true, force: true }).catch(() => {});
console.log('WROTE ' + outJson);
process.exit(0);