// Accessibility pixel audit: pointer target sizes + resolved contrast ratios.
// Read-only against the exported artifact; writes a separate QA file so the
// hash-bound layout-geometry.json is never touched.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const EXE = process.env.GEOM_BROWSER_EXE
  || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const artifact = process.argv[2];
const outJson = process.argv[3];

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

const TAP = `(() => {
  const box = (el) => { const b = el.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; };
  const label = (el) => {
    const cls = (el.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean).join('.');
    const id = el.id ? '#' + el.id : '';
    return el.tagName.toLowerCase() + id + (cls ? '.' + cls : '');
  };
  const context = (el) => {
    let n = el.parentElement;
    while (n && n !== document.body) {
      if (n.tagName === 'P' || n.tagName === 'LI' || n.classList.contains('row') || n.classList.contains('footer')) {
        const c = (n.getAttribute('class') || '').trim().split(/\\s+/).filter(Boolean).join('.');
        return n.tagName.toLowerCase() + c;
      }
      n = n.parentElement;
    }
    return 'body';
  };
  const all = Array.from(document.querySelectorAll('a[href], button, [tabindex]:not([tabindex="-1"])'));
  const visible = all.filter((el) => {
    const s2 = getComputedStyle(el);
    if (s2.display === 'none' || s2.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  });
  const items = visible.map((el) => {
    const { w, h } = box(el);
    const s2 = getComputedStyle(el);
    const inline = s2.display === 'inline';
    const skip = el.classList.contains('visually-hidden');
    return {
      target: label(el),
      text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 28),
      display: s2.display,
      context: context(el),
      w, h,
      pass: skip || (w >= 24 && h >= 24) || inline,
      exemption: skip ? 'visually-hidden-until-focus' : (inline ? 'wcag-2.5.8-inline-text' : null),
    };
  });
  const byMin = items.slice().sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h));
  return {
    total: items.length,
    items,
    violations: items.filter((i) => !i.pass),
    smallest: byMin.slice(0, 4).map((i) => ({ target: i.target, context: i.context, w: i.w, h: i.h, pass: i.pass, exemption: i.exemption })),
  };
})()`;

const contrastProbe = (pairs) => `(() => {
  const parse = (value) => {
    const raw = String(value).trim();
    const m = raw.match(/^rgba?[(]([^)]+)[)]$/);
    if (m) {
      const p = m[1].split(/[ ,]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    const h = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!h) return null;
    const hex = h[1].length === 3 ? h[1].split('').map((c) => c + c).join('') : h[1];
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (fg, bg) => {
    const a = parse(fg); const b = parse(bg);
    if (!a || !b) return null;
    const fl = lum(a); const bl = lum(b);
    const hi = Math.max(fl, bl); const lo = Math.min(fl, bl);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const pairs = ${JSON.stringify(pairs)};
  return pairs.map(([fg, bg, threshold]) => ({ fg, bg, fg_value: token(fg), bg_value: token(bg), ratio: ratio(token(fg), token(bg)), threshold }));
})()`;

const CONTRAST_TEXT = contrastProbe([
  ['--ink', '--canvas', 4.5],
  ['--ink-muted', '--canvas', 4.5],
  ['--ink-subtle', '--canvas', 4.5],
  ['--ink-subtle', '--surface-muted', 4.5],
  ['--ink-subtle', '--surface-sunken', 4.5],
  ['--ink-subtle', '--surface', 4.5],
]);

const CONTRAST_EXTRA = contrastProbe([
  ['--accent-ink', '--accent', 4.5],
  ['--accent-strong', '--accent-soft', 4.5],
  ['--accent', '--canvas', 4.5],
  ['--stage-ink', '--stage', 4.5],
  ['--stage-muted', '--stage', 4.5],
  ['--focus', '--canvas', 4.5],
  ['--border', '--canvas', 3.0],
  ['--border-strong', '--canvas', 3.0],
]);

const FOCUS_PROBE = `(() => {
  const el = document.querySelector('a.visually-hidden');
  if (!el) return null;
  el.focus();
  const b = el.getBoundingClientRect();
  const s2 = getComputedStyle(el);
  const w = Math.round(b.width); const h = Math.round(b.height);
  return {
    target: 'a.visually-hidden',
    focused: document.activeElement === el,
    w, h,
    meets_target: w >= 24 && h >= 24,
    position: s2.position,
    clip: s2.clip,
    overflow: s2.overflow,
    outline: s2.outlineStyle,
  };
})()`;

const profile = await mkdtemp(path.join(tmpdir(), 'a11y-audit-'));
const chrome = spawn(EXE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
  '--disable-sync', '--allow-file-access-from-files', `--user-data-dir=${profile}`,
  '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });

let port = null;
for (let i = 0; i < 120; i += 1) {
  if (chrome.exitCode != null) throw new Error('browser exited early');
  try {
    port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/)[0]);
    if (Number.isInteger(port) && port > 0) break;
  } catch (e) { /* not ready */ }
  await delay(100);
}
if (!port) throw new Error('no devtools port');

const target = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
const client = new Client(target.webSocketDebuggerUrl);
await client.send('Page.enable');
await client.send('Runtime.enable');
await client.send('Emulation.setFocusEmulationEnabled', { enabled: true });

const evaluate = async (expression) => {
  const res = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.text || 'evaluate failed');
  return res.result.value;
};

const fileUrl = pathToFileURL(artifact).toString();
const captured = [];
const themes = [];

for (const vp of VIEWPORTS) {
  await client.send('Emulation.setDeviceMetricsOverride', { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.width < 768 });
  await client.send('Page.navigate', { url: fileUrl });
  for (let i = 0; i < 200; i += 1) {
    await delay(50);
    const ready = await evaluate('document.readyState');
    if (ready === 'complete') break;
  }
  await evaluate('(() => { const n = document.querySelectorAll("[data-reveal],.reveal"); n.forEach((e) => e.classList.add("is-visible")); document.querySelectorAll(".reveal").forEach((e) => { e.style.opacity = 1; e.style.transform = "none"; }); return true; })()');
  await delay(250);
  const tap = await evaluate(TAP);
  const focusProbe = await evaluate(FOCUS_PROBE);
  captured.push({ id: vp.id, width: vp.width, height: vp.height, tap_targets: tap, skip_link_focus: focusProbe });
  if (themes.length === 0) {
    for (const mode of ['light', 'dark']) {
      await evaluate(`(() => { document.documentElement.setAttribute('data-theme','${mode}'); return true; })()`);
      await delay(80);
      themes.push({ theme: mode, ratios: await evaluate(CONTRAST_TEXT), extra: await evaluate(CONTRAST_EXTRA) });
    }
    await evaluate('(() => { document.documentElement.setAttribute("data-theme","light"); return true; })()');
  }
}

client.close();
await delay(200);
try { chrome.kill(); } catch (e) { /* ignore */ }

const fmt = (r) => `${r.fg}/${r.bg}=${r.ratio}${r.ratio >= r.threshold ? '' : ' FAIL'}`;
const payload = {
  audit_type: 'interactive-accessibility-audit/v1',
  generator: 'tools/interactive_audit.mjs',
  browser: EXE,
  artifact: path.resolve(artifact),
  captured_at: new Date().toISOString(),
  min_target_px: 24,
  viewports: captured,
  themes,
};
await writeFile(path.resolve(outJson), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
for (const v of captured) {
  console.log(`${v.id} interactive=${v.tap_targets.total} under24=${v.tap_targets.violations.length} smallest=${JSON.stringify(v.tap_targets.smallest)}`);
  console.log(`   skip-link focus: ${JSON.stringify(v.skip_link_focus)}`);
}
for (const t of themes) {
  console.log(`theme=${t.theme} text  `, t.ratios.map(fmt).join('  '));
  console.log(`theme=${t.theme} extra `, t.extra.map((r) => `${fmt(r)}@${r.threshold}`).join('  '));
}
console.log(`WROTE ${outJson}`);