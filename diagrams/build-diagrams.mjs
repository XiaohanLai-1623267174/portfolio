/* Generate the architecture diagrams in two palettes:
   - hard-coded light hex  -> <name>.svg        (standalone preview + geometry probe)
   - page CSS variables    -> <name>.inline.svg (what gets embedded in the page,
     so both light and dark themes are followed instead of pasting a light block
     onto a dark card). Geometry is identical in both; only colours differ. */
import { writeFileSync, mkdirSync } from 'node:fs';

const DIR = 'D:/Documents/deepseek_harness/mana-portfolio/diagrams';
mkdirSync(DIR, { recursive: true });

const PALETTE_HEX = {
  bg: '#FAF8F4', box: '#FFFFFF', line: '#E6E3DC', stroke: '#CFCABF',
  ink: '#15181D', muted: '#575D68', subtle: '#6E7684',
  accent: '#2B5CE6', soft: '#E7EDFF', violet: '#6B4FD8', violetSoft: '#EEEAFB', panel: '#F4F2ED',
  teal: '#0E8F80', tealSoft: '#E2F4F1',
};
const PALETTE_VAR = {
  bg: 'var(--canvas-warm)', box: 'var(--surface)', line: 'var(--border)', stroke: 'var(--border-strong)',
  ink: 'var(--ink)', muted: 'var(--ink-muted)', subtle: 'var(--ink-subtle)',
  accent: 'var(--accent)', soft: 'var(--accent-soft)', violet: 'var(--violet)', violetSoft: 'var(--surface-muted)', panel: 'var(--surface-muted)',
  teal: 'var(--teal)', tealSoft: 'var(--surface-muted)',
};
let C = PALETTE_HEX;
const FONT = 'font-family="Segoe UI, PingFang SC, Microsoft YaHei, system-ui, sans-serif"';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const text = (x, y, str, size, color = C.ink, o = {}) =>
  `<text x="${x}" y="${y}" ${FONT} font-size="${size}" font-weight="${o.weight || 500}" fill="${color}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}>${esc(str)}</text>`;
const box = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r === undefined ? 20 : o.r}" fill="${o.fill || C.box}" stroke="${o.stroke || C.line}" stroke-width="${o.sw || 2.5}"${o.dash ? ' stroke-dasharray="10 8"' : ''}/>`;
const arrowDown = (x, y1, y2, c = C.stroke) => `<path d="M${x} ${y1} V${y2}" stroke="${c}" stroke-width="3.5" marker-end="url(#ah)"/>`;
const arrowRight = (x1, x2, y, c = C.stroke) => `<path d="M${x1} ${y} H${x2}" stroke="${c}" stroke-width="3.5" marker-end="url(#ah)"/>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">\n<defs><marker id="ah" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M1 1 L10 6 L1 11 z" fill="${C.stroke}"/></marker></defs>\n<rect width="${w}" height="${h}" fill="${C.bg}"/>\n${body}\n</svg>`;

/* ---------- A. hero (620x1150, phone screen) ---------- */
function hero() {
  const W = 620, H = 1150, bx = 44, bw = 532, mid = W / 2;
  const out = [];
  out.push(text(44, 76, '一次提问的完整链路', 38, C.ink, { weight: 700 }));

  /* explicit coordinates: each node 146-206 tall, 44 between sub lines, so
     nothing collides and the last node still leaves a 30px bottom margin */
  const card = (y, h, fill, stroke) => out.push(box(bx, y, bw, h, { fill, stroke, sw: 3 }));
  const label = (y, s, fs = 44) => out.push(text(mid, y, s, fs, C.ink, { weight: 700, anchor: 'middle' }));
  const sub = (y, s, fs = 30, color = C.muted) => out.push(text(mid, y, s, fs, color, { anchor: 'middle' }));

  card(104, 146, C.soft, C.accent);
  label(166, '一句提问');
  sub(216, '「综测加分怎么算」', 31);

  out.push(arrowDown(mid, 256, 300));

  card(306, 206, C.box, C.accent);
  label(366, 'Agent 编排');
  sub(416, 'find_pdf · ingest_pdf');
  sub(460, 'search_knowledge');
  sub(500, '步数预算 8 · 超预算中止', 29, C.subtle);

  out.push(arrowDown(mid, 518, 562));

  card(568, 146, C.violetSoft, C.violet);
  label(630, '双路召回');
  sub(680, 'Chroma MMR + BM25');

  out.push(arrowDown(mid, 720, 764));

  card(770, 146, C.violetSoft, C.violet);
  label(832, 'bge 重排');
  sub(882, '取 Top-5 送生成');

  out.push(arrowDown(mid, 922, 966));

  card(972, 146, C.soft, C.accent);
  label(1034, '回答 + [1] [2] 角标', 36);
  sub(1084, 'sources 独立事件（可折叠）');

  return svg(W, H, out.join('\n'));
}

/* ---------- B. works card (4:3, 1200x900) ---------- */
function works() {
  const W = 1200, H = 900;
  const out = [];
  out.push(text(60, 104, '检索链路', 50, C.ink, { weight: 700 }));
  out.push(text(60, 150, '一句提问 → 一次可核对的工具调用', 30, C.muted));

  const y = 206, h = 236;
  const stages = [
    { x: 56, w: 170, idx: '01', t: '提问', subs: ['一句话'], fill: C.soft, stroke: C.accent },
    { x: 250, w: 232, idx: '02', t: 'Agent 编排', subs: ['3 个工具', '步数预算 8'], fill: C.box, stroke: C.accent },
    { x: 506, w: 180, idx: '03', t: '双路召回', subs: ['Chroma', 'BM25'], fill: C.violetSoft, stroke: C.violet },
    { x: 710, w: 180, idx: '04', t: 'bge 重排', subs: ['取 Top-5'], fill: C.violetSoft, stroke: C.violet },
    { x: 914, w: 230, idx: '05', t: '回答', subs: ['[n] 角标', 'sources'], fill: C.soft, stroke: C.accent },
  ];
  stages.forEach((s) => {
    out.push(box(s.x, y, s.w, h, { fill: s.fill, stroke: s.stroke, sw: 3 }));
    out.push(text(s.x + 22, y + 48, s.idx, 28, C.subtle, { weight: 600 }));
    out.push(text(s.x + s.w / 2, y + 126, s.t, 40, C.ink, { weight: 700, anchor: 'middle' }));
    s.subs.forEach((line, i) => out.push(text(s.x + s.w / 2, y + 178 + i * 40, line, 30, C.muted, { anchor: 'middle' })));
  });
  for (let i = 0; i < 4; i++) out.push(arrowRight(stages[i].x + stages[i].w + 5, stages[i + 1].x - 6, y + h / 2));

  const gy = 512;
  out.push(box(56, gy, 1088, 128, { fill: C.tealSoft, stroke: C.teal, r: 24 }));
  out.push(text(88, gy + 48, '治理管线（上传即跑）', 32, C.ink, { weight: 700 }));
  const items = ['PDF', '表格抽取', 'Markdown', '6 类元数据', '切片缓存'];
  let x = 88;
  items.forEach((it, i) => {
    out.push(text(x, gy + 100, it, 30, C.teal, { weight: 600 }));
    x += it.length * (it === 'PDF' || it === 'Markdown' ? 17 : 30) + 24;
    if (i < items.length - 1) { out.push(text(x - 12, gy + 100, '→', 30, C.teal)); x += 20; }
  });

  const fy = 686;
  const facts = ['缓存命中跳过解析', '追问误判 4/7 → 0/7', 'sources 独立事件'];
  let cx = 56;
  facts.forEach((f) => {
    const w = Math.round(f.length * 26 + 56);
    out.push(box(cx, fy, w, 66, { fill: C.box, stroke: C.line, r: 33 }));
    out.push(text(cx + w / 2, fy + 43, f, 28, C.muted, { anchor: 'middle' }));
    cx += w + 18;
  });
  return svg(W, H, out.join('\n'));
}

/* ---------- A2. hero, second slide: the agent loop (620x1150) ---------- */
function agentChain() {
  const W = 620, H = 1150, bx = 44, bw = 532, mid = W / 2;
  const out = [];
  out.push(text(44, 76, 'Agent 怎么跑', 38, C.ink, { weight: 700 }));

  const card = (y, h, fill, stroke) => out.push(box(bx, y, bw, h, { fill, stroke, sw: 3 }));
  const label = (y, s, fs = 42) => out.push(text(mid, y, s, fs, C.ink, { weight: 700, anchor: 'middle' }));
  const sub = (y, s, fs = 30, color = C.muted) => out.push(text(mid, y, s, fs, color, { anchor: 'middle' }));

  card(104, 130, C.soft, C.accent);
  label(166, '用户一句话');
  sub(212, '「帮我找去年的评奖办法」');

  out.push(arrowDown(mid, 240, 282));

  card(286, 130, C.box, C.accent);
  label(348, '意图识别');
  sub(394, '查知识库 / 闲聊');

  out.push(arrowDown(mid, 422, 464));

  card(468, 332, C.violetSoft, C.violet);
  label(522, 'ReAct 循环', 42);
  const rows = [
    ['①', '思考：这问题要查库吗'],
    ['②', '选工具：定位 / 入库 / 检索'],
    ['③', '观察：结果回到下一轮'],
  ];
  rows.forEach((r, i) => {
    const y = 578 + i * 58;
    out.push(`<circle cx="${bx + 40}" cy="${y - 11}" r="15" fill="${C.violet}" opacity="0.16"/>`);
    out.push(text(bx + 40, y - 1, r[0], 27, C.violet, { weight: 700, anchor: 'middle' }));
    out.push(text(bx + 72, y, r[1], 29, C.ink));
  });
  out.push(text(bx + 72, 740, 'find_pdf · ingest_pdf', 27, C.muted));
  out.push(text(bx + 72, 776, 'search_knowledge', 27, C.muted));
  out.push(`<path d="M${bx + bw - 26} 726 V566" stroke="${C.violet}" stroke-width="3" fill="none" stroke-dasharray="9 8" marker-end="url(#ah)"/>`);

  out.push(arrowDown(mid, 806, 838));

  card(842, 116, C.box, C.accent);
  label(892, '预算守卫', 38);
  sub(940, '第 n/8 步 · 超预算中止', 29, C.subtle);

  out.push(arrowDown(mid, 966, 1006));

  card(1010, 120, C.soft, C.accent);
  label(1052, 'answer + sources', 34);
  sub(1098, '幂等覆盖 · 防重复', 29, C.muted);

  return svg(W, H, out.join('\n'));
}

/* ---------- C. case main (3:2, 1200x800) ---------- */
function pipeline() {
  const W = 1200, H = 800;
  const out = [];
  out.push(text(56, 88, '从 PDF 到可核对的回答', 46, C.ink, { weight: 700 }));

  out.push(text(56, 158, '① 治理（上传即跑）', 30, C.teal, { weight: 700 }));
  const rowY = 182, rowH = 112, iw = 196, gap = 25;
  const ingest = ['PDF', '表格抽取', 'Markdown', '6 类元数据', '切片 + 缓存'];
  let ix = 56;
  ingest.forEach((label, i) => {
    out.push(box(ix, rowY, iw, rowH, { fill: C.tealSoft, stroke: C.teal }));
    out.push(text(ix + iw / 2, rowY + 70, label, 30, C.ink, { weight: 600, anchor: 'middle' }));
    if (i < ingest.length - 1) out.push(arrowRight(ix + iw + 4, ix + iw + gap - 4, rowY + rowH / 2, C.teal));
    ix += iw + gap;
  });

  out.push(`<path d="M104 310 V372" stroke="${C.stroke}" stroke-width="3.5" marker-end="url(#ah)"/>`);
  out.push(text(122, 350, '入库', 26, C.subtle));

  out.push(text(56, 424, '② 问答（一句话触发）', 30, C.accent, { weight: 700 }));
  const askY = 448, askH = 140;
  const ask = [
    { t: '提问', s: 'ReAct', fill: C.soft, stroke: C.accent },
    { t: 'Agent', s: '3 工具 / 预算 8', fill: C.box, stroke: C.accent },
    { t: '双路召回', s: 'MMR + BM25', fill: C.violetSoft, stroke: C.violet },
    { t: 'bge 重排', s: '取 Top-5', fill: C.violetSoft, stroke: C.violet },
    { t: '回答', s: '[n] + sources', fill: C.soft, stroke: C.accent },
  ];
  let ax = 56;
  ask.forEach((a, i) => {
    out.push(box(ax, askY, iw, askH, { fill: a.fill, stroke: a.stroke, sw: 3 }));
    out.push(text(ax + iw / 2, askY + 64, a.t, 36, C.ink, { weight: 700, anchor: 'middle' }));
    out.push(text(ax + iw / 2, askY + 108, a.s, 27, C.muted, { anchor: 'middle' }));
    if (i < ask.length - 1) out.push(arrowRight(ax + iw + 4, ax + iw + gap - 4, askY + askH / 2));
    ax += iw + gap;
  });

  out.push(text(56, H - 62, '「有依据」= 可核对的事实：来源独立成事件，与正文解耦', 28, C.muted));
  return svg(W, H, out.join('\n'));
}

/* ---------- C2. case main, supersedes the pipeline sketch (3:2, 1200x800)
   The case section used to repeat the works-card pipeline node for node.
   This shows something the page says nowhere else: the multi-turn follow-up
   bug, the fix, and the measurement around it (4/7 -> 0/7). ---------- */
function caseGap() {
  const W = 1200, H = 800;
  const out = [];
  out.push(text(56, 88, '同一条追问，改造前后', 46, C.ink, { weight: 700 }));
  out.push(text(56, 136, '7 条人工追问样本，同一套装置前后各测一次；句式为例示', 28, C.muted));

  out.push(box(56, 184, 500, 520, { fill: C.box, stroke: C.stroke, sw: 3, r: 24 }));
  out.push(box(644, 184, 500, 520, { fill: C.box, stroke: C.accent, sw: 3, r: 24 }));
  out.push(text(88, 232, '改造前', 32, C.subtle, { weight: 700 }));
  out.push(text(676, 232, '改造后', 32, C.accent, { weight: 700 }));

  /* the same utterance in both columns: only the handling changes */
  for (const x of [88, 676]) {
    out.push(box(x, 256, 456, 96, { fill: C.panel, stroke: C.line, r: 20 }));
    out.push(text(x + 228, 316, '「那第二条呢？」', 34, C.ink, { weight: 600, anchor: 'middle' }));
    out.push(arrowDown(x + 228, 360, 404));
  }

  const rows = (x, items, color) =>
    items.forEach((s, i) => out.push(text(x, 444 + i * 48, s, 28, color)));
  rows(88, ['① 当成一个全新问题', '② 检索到另一份文件', '③ 答非所问'], C.ink);
  rows(676, ['① 带上上一轮问答 + 工具结果', '② 改写成完整问句', '③ 命中同一份文件，答对'], C.ink);

  const chip = (x, s, color) => {
    out.push(box(x, 580, 336, 64, { fill: C.panel, stroke: C.line, r: 32 }));
    out.push(text(x + 168, 622, s, 32, color, { weight: 700, anchor: 'middle' }));
  };
  chip(88, '7 条里误判 4 条', C.ink);
  chip(676, '7 条里误判 0 条', C.accent);

  out.push(arrowRight(566, 634, 304));

  out.push(text(56, 760, '误判样本只有 7 条，结论只覆盖这一组样本', 26, C.subtle));
  return svg(W, H, out.join('\n'));
}

/* ---------- D. case detail (1:1, 1000x1000) ---------- */
function timeline() {
  const W = 1000, H = 1000;
  const out = [];
  out.push(text(60, 94, 'SSE 事件流', 50, C.ink, { weight: 700 }));
  out.push(text(60, 142, '同一条流里，token 与工具事件分帧', 30, C.muted));

  const events = [
    { t: 'token', n: '逐字推送 · 首帧 0.97s', c: C.accent },
    { t: 'token_reset', n: '撤回工具轮前的模型前言', c: C.violet },
    { t: 'tool_call', n: '带「第 n/8 步」进度', c: C.teal },
    { t: 'sources', n: '来源清单单独事件', c: C.violet },
    { t: 'answer', n: '终态幂等覆盖，防重复', c: C.accent },
  ];
  const x0 = 150, y0 = 232, gap = 146;
  out.push(`<path d="M${x0} ${y0 - 46} V${y0 + gap * (events.length - 1) + 46}" stroke="${C.line}" stroke-width="3.5"/>`);
  events.forEach((e, i) => {
    const y = y0 + i * gap;
    out.push(`<circle cx="${x0}" cy="${y - 12}" r="13" fill="${e.c}"/>`);
    out.push(text(94, y + 2, String(i + 1), 28, C.subtle, { weight: 700, anchor: 'end' }));
    out.push(text(x0 + 42, y, e.t, 44, C.ink, { weight: 700 }));
    out.push(text(x0 + 42, y + 48, e.n, 34, C.muted));
  });

  out.push(text(60, H - 62, 'token_reset 解决「模型先答一半又去调工具」的错位', 30, C.subtle));
  return svg(W, H, out.join('\n'));
}

/* ---------- negative control: must FAIL the checker ---------- */
function control() {
  const W = 1200, H = 900;
  const out = [];
  out.push(box(56, 200, 200, 100, { fill: C.box, stroke: C.line }));
  out.push(text(70, 262, '这段文字明显超出方框宽度', 30, C.ink));            // overflow
  out.push(text(60, 420, '重叠文字甲', 34, C.ink));                            // overlap
  out.push(text(64, 430, '重叠文字乙', 34, C.ink));                            // overlap
  out.push(text(1000, 880, '越界文字越界文字越界文字', 34, C.ink));            // outside viewBox
  return svg(W, H, out.join('\n'));
}

/* two passes over the same generators: hex for standalone files, CSS vars for
   the version that is embedded in the page */
function buildAll() {
  return {
    'hero-chain': hero(),
    'hero-agent': agentChain(),
    'works-chain': works(),
    'case-pipeline': pipeline(),
    'case-gap': caseGap(),
    'sse-timeline': timeline(),
    '_negative-control': control(),
  };
}

C = PALETTE_HEX;
const hexPass = buildAll();
C = PALETTE_VAR;
const varPass = buildAll();
C = PALETTE_HEX;

for (const [name, content] of Object.entries(hexPass)) {
  writeFileSync(`${DIR}/${name}.svg`, content, 'utf8');
  console.log(`${name}.svg: ${Buffer.byteLength(content, 'utf8')} bytes`);
}
for (const [name, content] of Object.entries(varPass)) {
  /* each inline <svg> lives in one document, so marker ids must not collide */
  const inline = content
    .replace(/id="ah"/g, `id="ah-${name}"`)
    .replace(/url\(#ah\)/g, `url(#ah-${name})`);
  writeFileSync(`${DIR}/${name}.inline.svg`, inline, 'utf8');
}

const preview = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<style>
body{background:#FAF8F4;font-family:Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;margin:0;padding:20px;color:#15181D}
h2{font-size:14px;margin:18px 0 8px;color:#575D68}
.phone{width:250px;height:520px;border:9px solid #15181D;border-radius:32px;overflow:hidden;background:#FAF8F4}
.phone img{width:100%;height:100%;object-fit:contain}
img{display:block}
</style></head><body>
<h2>A 首屏手机 250×520</h2><div class="phone"><img src="hero-chain.svg"></div>
<div class="phone" style="margin-top:12px"><img src="hero-agent.svg"></div>
<h2>B 项目卡 540px</h2><img src="works-chain.svg" style="width:540px">
<h2>C 案例主视觉 540px（新版）</h2><img src="case-gap.svg" style="width:540px">
<h2>C0 旧版流水线（已不用于页面）540px</h2><img src="case-pipeline.svg" style="width:540px">
<h2>D 案例细节 400px</h2><img src="sse-timeline.svg" style="width:400px">
</body></html>`;
writeFileSync(`${DIR}/preview.html`, preview, 'utf8');
console.log('preview.html written');