'use strict';
/* Once Upon a Fable: reader app. Runs inside the Android WebView shell (window.Native). */

const SRC = 'rex4ie/once-upon-a-fable';
const MIRRORS = [`https://raw.githubusercontent.com/${SRC}/main/content/`, `https://cdn.jsdelivr.net/gh/${SRC}@main/content/`];
const RELEASES = `https://api.github.com/repos/${SRC}/releases/latest`;
const CONTACT = { name: 'Ali Asghar Rezaie', instagram: 'rez4ie', email: 'rez4ie@gmail.com' };

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const pad = n => String(n).padStart(2, '0');
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const cmpVer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };

/* ---------- Native bridge (with a browser fallback for previews) ---------- */
const HAS_NATIVE = typeof window.Native !== 'undefined';
const Bridge = {
  n: 0, cb: {}, onprogress: null,
  call(fn, ...a) { return new Promise((res, rej) => { const id = ++this.n; this.cb[id] = { res, rej }; Native[fn](id, ...a); }); },
  done(id, ok, v) { const c = this.cb[id]; if (!c) return; delete this.cb[id]; ok ? c.res(v) : c.rej(new Error(v)); },
  progress(id, p) { this.onprogress && this.onprogress(p); },
  ended() { Player.onEnded(); },
};
window.Bridge = Bridge;
if (!HAS_NATIVE) {
  const mem = {};
  window.Native = {
    version: () => '1.0', exists: () => false, readText: r => mem[r] || '', writeText: (r, t) => { mem[r] = t; }, remove() {},
    cacheSize: () => 0, get: (id, url) => fetch(url).then(r => r.ok ? r.text() : Promise.reject(r.status)).then(t => Bridge.done(id, true, t), e => Bridge.done(id, false, String(e))),
    download: (id) => Bridge.done(id, false, 'preview'), play() {}, pause() {}, resume() {}, stop() {}, seek() {}, setSpeed() {},
    position: () => 0, duration: () => 0, playing: () => false, openUrl: u => window.open(u), setBars() {}, installUpdate: id => Bridge.done(id, false, 'preview'),
  };
}
const get = url => Bridge.call('get', url);
const dataUrl = rel => '/data/' + rel.split('/').map(encodeURIComponent).join('/');
const readJSON = rel => { try { const t = Native.readText(rel); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
async function remoteJSON(path) {
  let err;
  for (const base of MIRRORS) { try { return JSON.parse(await get(base + path + '?v=' + Date.now())); } catch (e) { err = e; } }
  throw err || new Error('offline');
}
async function bundledJSON(path) { const r = await fetch('content/' + path); if (!r.ok) throw new Error('missing'); return r.json(); }

/* ---------- Settings ---------- */
const DEF = { theme: 'light', font: 'literata', size: 19, lh: 1.7, margin: 'normal', photos: true, vocab: true, follow: true, livefa: false, accent: 'us', hlword: false, fullfa: false, newPerDay: 10 };
const FONTS = { literata: ['Literata', 'Literata, Georgia, serif'], atkinson: ['Atkinson', 'Atkinson, sans-serif'], serif: ['Serif', 'Georgia, "Noto Serif", serif'], sans: ['Sans', 'system-ui, Roboto, sans-serif'] };
const THEMES = { light: ['White', '#FFFFFF', '#1C1B19', false], paper: ['Reading', '#F6F0E4', '#2E2A24', false], dark: ['Dark', '#1E1F21', '#E6E3DE', true], black: ['Black', '#000000', '#D9D6D0', true] };
const MARGINS = { narrow: 14, normal: 22, wide: 34 };
let S = { ...DEF };
try { Object.assign(S, JSON.parse(localStorage.getItem('settings') || '{}')); } catch (e) {}
function saveSettings() { try { localStorage.setItem('settings', JSON.stringify(S)); } catch (e) {} applySettings(); }
function applySettings() {
  const root = document.documentElement, th = THEMES[S.theme] || THEMES.light;
  root.dataset.theme = S.theme;
  root.style.setProperty('--ff', FONTS[S.font][1]);
  root.style.setProperty('--fs', S.size + 'px');
  root.style.setProperty('--lh', S.lh);
  root.style.setProperty('--pad', MARGINS[S.margin] + 'px');
  document.body.classList.toggle('no-photos', !S.photos);
  document.body.classList.toggle('no-vocab', !S.vocab);
  document.body.classList.toggle('full-fa', !!S.fullfa);
  document.body.classList.toggle('hl-word', !!S.hlword);
  Native.setBars(th[1], th[3]);
}

/* ---------- Content ---------- */
let INDEX = null, BUNDLED = null;
const read = new Set(JSON.parse(localStorage.getItem('read') || '[]'));
async function loadIndex() {
  try { BUNDLED = await bundledJSON('index.json'); } catch (e) { BUNDLED = { version: 0, lessons: [] }; }
  const cached = readJSON('content/index.json');
  INDEX = cached && cached.version >= BUNDLED.version ? cached : BUNDLED;
}
async function refreshIndex() {
  try {
    const remote = await remoteJSON('index.json');
    if (!remote || !(remote.version > INDEX.version)) return false;
    const old = {}; INDEX.lessons.forEach(l => old[l.id] = l);
    remote.lessons.forEach(l => { const o = old[l.id]; if (o && o.rev !== l.rev) Native.remove(`content/lessons/${l.id}.json`); });
    Native.writeText('content/index.json', JSON.stringify(remote));
    INDEX = remote; return true;
  } catch (e) { return false; }
}
async function loadLesson(entry) {
  const c = readJSON(`content/lessons/${entry.id}.json`);
  if (c && c.rev === entry.rev) return c;
  const b = BUNDLED.lessons.find(l => l.id === entry.id);
  if (b && b.rev === entry.rev) { try { return { ...(await bundledJSON(`lessons/${entry.id}.json`)), rev: entry.rev }; } catch (e) {} }
  try {
    const r = { ...(await remoteJSON(`lessons/${entry.id}.json`)), rev: entry.rev };
    Native.writeText(`content/lessons/${entry.id}.json`, JSON.stringify(r)); return r;
  } catch (e) { if (c) return c; if (b) return bundledJSON(`lessons/${entry.id}.json`); throw e; }
}
// Pictures are downloaded once and kept.
const imgJobs = {};
function imageSrc(name) {
  const rel = 'img/' + name;
  if (Native.exists(rel)) return Promise.resolve(dataUrl(rel));
  if (!HAS_NATIVE) return Promise.resolve(location.hostname === 'localhost' ? '/img/' + name : MIRRORS[0] + 'images/' + name);
  return imgJobs[name] || (imgJobs[name] = (async () => {
    for (const base of MIRRORS) { try { await Bridge.call('download', base + 'images/' + encodeURIComponent(name), rel); return dataUrl(rel); } catch (e) {} }
    delete imgJobs[name]; throw new Error('offline');
  })());
}
function fillImages(root) {
  root.querySelectorAll('img[data-img]').forEach(im => {
    if (!S.photos && !im.dataset.force) return;
    if (im.dataset.loaded) return; im.dataset.loaded = '1';
    imageSrc(im.dataset.img).then(src => { if (im.tagName === 'IMG') im.src = src; }, () => { im.dataset.loaded = ''; });
  });
  root.querySelectorAll('[data-bg]').forEach(el => {
    if (!S.photos || el.dataset.loaded) return; el.dataset.loaded = '1';
    imageSrc(el.dataset.bg).then(src => el.style.backgroundImage = `url("${src}")`, () => { el.dataset.loaded = ''; });
  });
}

/* ---------- Text → word tokens (must match tools/make_timings.js) ---------- */
function tokenize(par) {
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g; let plain = '', marks = [], last = 0, m;
  while ((m = re.exec(par))) { plain += par.slice(last, m.index); marks.push([plain.length, plain.length + m[1].length, m[2] || m[1]]); plain += m[1]; last = re.lastIndex; }
  plain += par.slice(last);
  const out = [], wr = /\S+/g;
  while ((m = wr.exec(plain))) { const s = m.index, e = s + m[0].length, mk = marks.find(k => k[0] < e && k[1] > s); out.push({ t: m[0], v: mk ? mk[2] : null }); }
  return out;
}

// Sentences of a paragraph (must match the content tools): split after . ! ? before a capital, merge pieces under 3 words.
function splitSentences(par) {
  const plain = par.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1');
  const a = plain.split(/(?<=[.!?]["”]?)\s+(?=["“]?[A-Z])/).map(x => x.trim()).filter(Boolean), o = [];
  let c = '';
  for (const x of a) { c = c ? c + ' ' + x : x; if (c.split(/\s+/).length >= 3) { o.push(c); c = ''; } }
  if (c) { if (o.length) o[o.length - 1] += ' ' + c; else o.push(c); }
  return o;
}

/* Sentence translation tooltip: sits above (or below) the sentence, never on top of it. */
let tipFor = null;
function showTip(s) {
  hideTip();
  const fa = s.dataset.fa; if (!fa) return;
  tipFor = s; s.classList.add('sel');
  const t = document.createElement('div'); t.className = 'tip fa'; t.id = 'tip'; t.textContent = fa;
  document.body.appendChild(t);
  const rects = [...s.getClientRects()], top = Math.min(...rects.map(r => r.top)), bot = Math.max(...rects.map(r => r.bottom));
  const W = document.documentElement.clientWidth, tw = Math.min(W - 24, 560);
  t.style.width = tw + 'px'; t.style.left = ((W - tw) / 2) + 'px';
  const th = t.offsetHeight, above = top - th - 10 > 64;
  t.style.top = (window.scrollY + (above ? top - th - 10 : bot + 10)) + 'px';
  t.classList.add(above ? 'up' : 'down');
  t.onclick = hideTip;
}
function hideTip() { const t = $('#tip'); if (t) t.remove(); if (tipFor) tipFor.classList.remove('sel'); tipFor = null; }
document.addEventListener('click', e => { if (tipFor && !e.target.closest('.s') && !e.target.closest('#tip')) hideTip(); }, true);

/* ---------- Navigation ---------- */
const stack = [];
const App = {
  go(view, arg) { if (stack.length) stack[stack.length - 1].scroll = window.scrollY; stack.push({ view, arg }); render(); },
  back() {
    if (!$('#sheet-wrap').hidden) { closeSheet(); return true; }
    if (stack.length <= 1) return false;
    leaveView(); stack.pop(); render(stack[stack.length - 1].scroll); return true;
  },
};
window.App = App;
function leaveView() { hideTip(); const cur = stack[stack.length - 1]; if (cur && cur.view === 'lesson') Player.stop(); }
function render(scroll = 0) {
  const { view, arg } = stack[stack.length - 1];
  const app = $('#app'); app.innerHTML = '';
  hideTip();
  ({ home: viewHome, lesson: viewLesson, settings: viewSettings, about: viewAbout, exercises: viewExercises, cards: viewCards })[view](app, arg);
  window.scrollTo(0, scroll);
  onScroll();
}
function onScroll() { const b = $('.bar'); if (b) b.classList.toggle('scrolled', window.scrollY > 40); }
window.addEventListener('scroll', onScroll, { passive: true });
function bar(title, left, right) {
  return `<div class="bar">${left}<div class="t">${esc(title)}</div>${right}</div>`;
}
const btn = (id, icon, label, cls = '') => `<button class="ibtn ${cls}" id="${id}" aria-label="${label}">${icon}</button>`;

/* ---------- Home ---------- */
function viewHome(app) {
  const L = INDEX.lessons;
  app.innerHTML = bar('Once Upon a Fable', '<div style="width:6px"></div>', btn('b-set', I.sliders, 'Settings') + btn('b-about', I.info, 'About')) +
    `<header class="home-head"><h1>Once Upon a Fable</h1><p>${L.length} classic fables to read and listen to</p></header>
     <button class="deck" id="b-cards">${I.cards}<div class="tx">Flashcards<small id="deck-st">Review the new words</small></div>${I.chevron}</button>
     <ul class="list">${L.map((l, i) => `<li class="row" data-id="${l.id}"><span class="n">${pad(i + 1)}</span>
       <div class="tx"><b>${esc(l.title)}</b><span>${esc(l.origin)}${read.has(l.id) ? ' · Read' : ''}</span></div>
       ${S.photos && l.cover ? `<div class="th" data-bg="${esc(l.cover)}"></div>` : ''}</li>`).join('')}</ul>`;
  $('#b-set').onclick = () => App.go('settings');
  $('#b-about').onclick = () => App.go('about');
  $('#b-cards').onclick = () => App.go('cards');
  SRS.counts().then(c => { const el = $('#deck-st'); if (el) el.textContent = c.total ? `${c.due} to review · ${c.fresh} new today` : 'Review the new words'; });
  app.querySelectorAll('.row').forEach(r => r.onclick = () => App.go('lesson', r.dataset.id));
  fillImages(app);
}

/* ---------- Lesson ---------- */
let LESSON = null;
function viewLesson(app, id) {
  const entry = INDEX.lessons.find(l => l.id === id), n = INDEX.lessons.indexOf(entry) + 1;
  app.innerHTML = bar(entry.title, btn('b-back', I.back, 'Back'), btn('b-type', I.type, 'Reading settings') + btn('b-listen', I.headphones, 'Listen', 'accent')) +
    `<article class="reader"><div class="kicker">Lesson ${n} · ${esc(entry.origin)}</div><div id="body"><div class="loading"><div class="spin"></div>Loading the story</div></div></article>`;
  $('#b-back').onclick = () => App.back();
  $('#b-type').onclick = () => openReadingSheet();
  $('#b-listen').onclick = () => openListenSheet(entry);
  loadLesson(entry).then(les => {
    if (stack[stack.length - 1].arg !== id) return;
    LESSON = { entry, les, title: [], words: [] };
    const tt = les.title.split(/\s+/).map((w, i) => `<span class="w" data-t="${i}">${esc(w)}</span>`).join(' ');
    let k = 0;
    const pages = les.pages.map((p, pi) => (p.images || []).map(im => `<figure><img data-img="${esc(im)}" alt=""></figure>`).join('') +
      p.text.map((par, qi) => {
        const toks = tokenize(par), sents = splitSentences(par), fa = (p.fa && p.fa[qi]) || [];
        let ti = 0;
        const html = sents.map((s, si) => { const n = s.split(/\s+/).length, part = toks.slice(ti, ti + n); ti += n;
          return `<span class="s" data-fa="${esc(fa[si] || '')}">` + part.map(t => `<span class="w${t.v ? ' v' : ''}" data-k="${k++}"${t.v ? ` data-v="${esc(t.v)}"` : ''}>${esc(t.t)}</span>`).join(' ') + '</span>'; }).join(' ');
        const rest = toks.slice(ti).map(t => `<span class="w" data-k="${k++}">${esc(t.t)}</span>`).join(' ');
        return `<p>${html}${rest ? ' ' + rest : ''}</p>` + (fa.length ? `<p class="fa tr">${esc(fa.join(' '))}</p>` : '');
      }).join('')).join('');
    const hasFa = les.pages.some(p => p.fa);
    $('#body').innerHTML = `<h1>${tt}</h1>
      ${hasFa ? `<div class="pills"><button class="pill ${S.fullfa ? 'on' : ''}" id="t-full">${I.translate}Show translation</button></div>` : ''}
      <div class="story">${pages}</div>
      <div class="moral"><small>Moral</small><p>${esc(les.moral)}</p></div>
      <div class="vocab-list"><h2>New words</h2>${les.vocab.map((v, i) => `<button class="vrow" data-vi="${i}"><b>${esc(v.w)}</b><span class="fa">${esc(v.fa)}</span></button>`).join('')}</div>
      ${les.ex ? `<button class="practice" id="b-ex">${I.pencil}<div class="tx">Practice<small>Exercises for this story</small></div>${I.chevron}</button>` : ''}`;
    LESSON.title = [...app.querySelectorAll('h1 .w')];
    LESSON.words = [...app.querySelectorAll('.story .w')];
    fillImages(app);
    if (hasFa) {
      $('#t-full').onclick = () => { S.fullfa = !S.fullfa; saveSettings(); $('#t-full').classList.toggle('on', S.fullfa); };
    }
    if ($('#b-ex')) $('#b-ex').onclick = () => App.go('exercises', id);
    $('.story').onclick = e => {
      const w = e.target.closest('.w');
      if (!w) return;
      if (w.dataset.v) return showWord(les.vocab, w.dataset.v);
      if (Player.active()) Player.seekToWord(+w.dataset.k);
    };
    app.querySelectorAll('.vrow').forEach(b => b.onclick = () => showWord(les.vocab, null, +b.dataset.vi));
    const markRead = () => { if (window.innerHeight + window.scrollY > document.body.scrollHeight - 300 && !read.has(id)) { read.add(id); localStorage.setItem('read', JSON.stringify([...read])); } };
    window.addEventListener('scroll', markRead, { passive: true });
  }, () => { $('#body').innerHTML = `<div class="empty">This story could not be loaded. Check your internet connection and try again.</div>`; });
}
function showWord(vocab, key, idx) {
  const k = (key || '').toLowerCase();
  const v = idx != null ? vocab[idx] : vocab.find(x => x.w.toLowerCase() === k) || vocab.find(x => k.startsWith(x.w.toLowerCase()));
  if (!v) return;
  openSheet(`<div class="vsheet"><div class="w1">${esc(v.w)}</div><div class="en">${esc(v.en)}</div><div class="fa">${esc(v.fa)}</div>
    <blockquote>${esc(v.s)}<div class="fa">${esc(v.sfa)}</div></blockquote></div>`);
}

/* ---------- Sheets ---------- */
function openSheet(html, onClose) {
  const w = $('#sheet-wrap'); $('#sheet').innerHTML = html; w.hidden = false;
  w._onClose = onClose; $('.sheet-scrim').onclick = closeSheet;
  return $('#sheet');
}
function closeSheet() { const w = $('#sheet-wrap'); if (w.hidden) return; w.hidden = true; w._onClose && w._onClose(); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(() => t.hidden = true, 2600); }

function openListenSheet(entry) {
  const opt = (acc, name, sub) => {
    const a = entry.audio && entry.audio[acc];
    const saved = a && !window.IS_WEB && Native.exists(`audio/${entry.id}-${acc}-${a.post}.ogg`);
    return `<button class="choice" data-acc="${acc}" ${a ? '' : 'disabled style="opacity:.4"'}>${I.headphones}<div class="tx">${name}<small>${sub}${saved ? ' · Saved on this phone' : ''}</small></div>${S.accent === acc ? I.check : ''}</button>`;
  };
  const sh = openSheet(`<h3>Listen to the story</h3><p class="sub">Choose a voice. The words light up as the narrator reads.</p>
    ${opt('us', 'American English', 'US accent')}${opt('br', 'British English', 'UK accent')}`);
  sh.querySelectorAll('.choice').forEach(b => b.onclick = () => { S.accent = b.dataset.acc; saveSettings(); closeSheet(); Player.start(entry, b.dataset.acc); });
}

/* ---------- Player ---------- */
const SPEEDS = [0.8, 0.9, 1, 1.1, 1.25];
const Player = {
  st: null, timer: 0, seq: [], cur: null, lastTouch: 0,
  active() { return !!(this.st && this.st.ready); },
  async start(entry, acc) {
    this.stop();
    const a = entry.audio[acc], rel = `audio/${entry.id}-${acc}-${a.post}.ogg`;
    const st = this.st = { id: entry.id, acc, ready: false, speed: +(localStorage.getItem('speed') || 1) };
    this.mount(`<div class="loading"><div class="spin"></div><span id="pl-msg">Getting the ${acc === 'us' ? 'American' : 'British'} narration</span></div>`);
    const timing = this.loadTiming(entry, acc, a.post);
    try {
      if (!Native.exists(rel)) {
        const html = await get(`https://t.me/${INDEX.channel}/${a.post}?embed=1`);
        const m = html.match(/<audio[^>]*\ssrc="([^"]+)"/);
        if (!m) throw new Error('no audio');
        await Bridge.call('download', m[1].replace(/&amp;/g, '&'), rel);
      }
    } catch (e) {
      if (this.st !== st) return;
      this.mount(`<div class="loading" style="justify-content:space-between"><span>Could not get the audio. Check your internet connection.</span>${btn('pl-x', I.close, 'Close')}</div>`);
      $('#pl-x').onclick = () => this.stop(); return;
    }
    if (this.st !== st) return;
    const t = await timing;
    if (this.st !== st) return;
    this.buildSeq(t);
    Native.setSpeed(st.speed);
    Native.play(rel, 0);
    st.ready = true;
    this.mount(`<div class="top">${btn('pl-rw', I.rewind, 'Back 5 seconds')}<button class="main" id="pl-pp" aria-label="Play or pause">${I.pause}</button>${btn('pl-ff', I.forward, 'Forward 5 seconds')}
      <div class="lbl">${acc === 'us' ? 'American' : 'British'}</div><button class="spd" id="pl-sp">${st.speed}×</button>${btn('pl-x', I.close, 'Close')}</div>
      <div class="prog" id="pl-pr"><i></i><b></b><u></u></div><div class="times"><span id="pl-t">0:00</span><span id="pl-d">0:00</span></div>
      <div class="pl-tg"><button class="pill ${S.follow ? 'on' : ''}" id="pl-fo">Scroll with narration</button>${LESSON && LESSON.les.pages.some(p => p.fa) ? `<button class="pill ${S.livefa ? 'on' : ''}" id="pl-fa">${I.translate}Translate with narration</button>` : ''}</div>`);
    $('#pl-fo').onclick = () => { S.follow = !S.follow; saveSettings(); $('#pl-fo').classList.toggle('on', S.follow); this.lastTouch = 0; this.tick(true); };
    if ($('#pl-fa')) $('#pl-fa').onclick = () => { S.livefa = !S.livefa; saveSettings(); $('#pl-fa').classList.toggle('on', S.livefa); if (this.curS) this.showLive(this.curS); };
    $('#pl-pp').onclick = () => { if (Native.playing()) { Native.pause(); } else { Native.resume(); } this.tick(true); };
    $('#pl-rw').onclick = () => Native.seek(Math.max(0, Native.position() - 5000));
    $('#pl-ff').onclick = () => Native.seek(Math.min(Native.duration(), Native.position() + 5000));
    $('#pl-x').onclick = () => this.stop();
    $('#pl-sp').onclick = () => { st.speed = SPEEDS[(SPEEDS.indexOf(st.speed) + 1) % SPEEDS.length] || 1; localStorage.setItem('speed', st.speed); Native.setSpeed(st.speed); $('#pl-sp').textContent = st.speed + '×'; };
    const pr = $('#pl-pr');
    const seekAt = e => { const r = pr.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); Native.seek(Math.round(f * Native.duration())); this.tick(true); };
    pr.onpointerdown = e => { pr.setPointerCapture(e.pointerId); seekAt(e); pr.onpointermove = seekAt; };
    pr.onpointerup = () => { pr.onpointermove = null; };
    this.timer = setInterval(() => this.tick(), 60);
  },
  async loadTiming(entry, acc, post) {
    const rel = `timing/${entry.id}-${acc}.json`;
    let t = null;
    try { t = await remoteJSON(`timing/${entry.id}-${acc}.json`); Native.writeText(rel, JSON.stringify(t)); }
    catch (e) { t = readJSON(rel); }
    return t && t.post === post ? t : null;
  },
  buildSeq(t) {
    this.seq = [];
    if (!t || !LESSON) return;
    (t.title || []).forEach((x, i) => x && LESSON.title[i] && this.seq.push([x[0], x[1], LESSON.title[i]]));
    (t.words || []).forEach((x, i) => x && LESSON.words[i] && this.seq.push([x[0], x[1], LESSON.words[i], i]));
    this.seq.sort((a, b) => a[0] - b[0]);
  },
  seekToWord(k) { const s = this.seq.find(x => x[3] === k); if (s) { Native.seek(s[0]); if (!Native.playing()) Native.resume(); this.tick(true); } },
  tick(force) {
    if (!this.active()) return;
    const pos = Native.position(), dur = Native.duration(), playing = Native.playing();
    const pp = $('#pl-pp'); if (pp && pp._p !== playing) { pp._p = playing; pp.innerHTML = playing ? I.pause : I.play; }
    if (dur) { const f = pos / dur * 100; $('#pl-pr b').style.width = f + '%'; $('#pl-pr u').style.left = f + '%'; $('#pl-t').textContent = fmt(pos); $('#pl-d').textContent = fmt(dur); }
    // highlight the word being read
    let lo = 0, hi = this.seq.length - 1, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (this.seq[mid][0] <= pos + 40) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    let el = idx >= 0 && pos <= this.seq[idx][1] + 700 ? this.seq[idx][2] : null;
    if (el !== this.cur) {
      if (this.cur) this.cur.classList.remove('on');
      this.cur = el;
      if (el) el.classList.add('on');
    }
    const sent = el && el.closest('.s');
    if (sent !== this.curS) { if (this.curS) this.curS.classList.remove('on'); this.curS = sent; if (sent) { sent.classList.add('on'); this.showLive(sent); } }
    if (el && S.follow && Date.now() - this.lastTouch > 3500) {
      const r = (sent || el).getBoundingClientRect(), w = el.getBoundingClientRect(), h = window.innerHeight, pb = ($('#player') || {}).offsetHeight || 0;
      // keep the sentence being read a little above the middle; move only when it drifts away
      const anchor = r.height > h * 0.45 ? w : r, target = window.scrollY + anchor.top - h * 0.3;
      if (w.top < 80 || w.bottom > h - pb - 60 || Math.abs(anchor.top - h * 0.3) > h * 0.22) smoothTo(target);
    }
  },
  showLive(sent) {
    let box = $('#live-fa');
    if (!S.livefa || !sent.dataset.fa) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('span'); box.id = 'live-fa'; box.className = 'fa live-fa'; }
    box.textContent = sent.dataset.fa;
    sent.after(box);
    box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
  },
  mount(html) { let p = $('#player'); if (!p) { p = document.createElement('div'); p.id = 'player'; p.className = 'player'; document.body.appendChild(p); } p.innerHTML = html; },
  onEnded() { this.tick(true); if (this.curS) this.curS.classList.remove('on'); this.curS = null; if (this.cur) { this.cur.classList.remove('on'); this.cur = null; } const pp = $('#pl-pp'); if (pp) { pp._p = false; pp.innerHTML = I.play; } },
  stop() { clearInterval(this.timer); if (this.curS) this.curS.classList.remove('on'); this.curS = null; const lf = $('#live-fa'); if (lf) lf.remove(); Native.stop(); if (this.cur) this.cur.classList.remove('on'); this.cur = null; this.st = null; this.seq = []; const p = $('#player'); if (p) p.remove(); },
};
let scrollAnim = null;
function smoothTo(y) {
  y = Math.max(0, Math.min(y, document.documentElement.scrollHeight - window.innerHeight));
  if (scrollAnim && Math.abs(scrollAnim.to - y) < 4) return;
  const from = window.scrollY, d = y - from; if (Math.abs(d) < 2) return;
  const dur = Math.min(900, 350 + Math.abs(d) * 0.6), t0 = performance.now(), me = scrollAnim = { to: y };
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const step = now => { if (scrollAnim !== me) return; const t = Math.min(1, (now - t0) / dur); window.scrollTo(0, from + d * ease(t)); if (t < 1) requestAnimationFrame(step); else scrollAnim = null; };
  requestAnimationFrame(step);
}
['touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, () => { scrollAnim = null; }, { passive: true }));
['touchstart', 'wheel'].forEach(ev => window.addEventListener(ev, () => Player.lastTouch = Date.now(), { passive: true }));

/* ---------- Settings ---------- */
function controls(onChange) {
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${Object.entries(opts).map(([v, l]) => `<button data-v="${v}" class="${String(S[key]) === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const tog = (key, name, sub) => `<button class="toggle" data-tog="${key}"><span>${name}${sub ? `<small>${sub}</small>` : ''}</span><span class="sw ${S[key] ? 'on' : ''}"></span></button>`;
  const html = `
    <div class="grp"><div class="gl">Theme</div><div class="swatches">${Object.entries(THEMES).map(([k, t]) => `<button class="swatch ${S.theme === k ? 'on' : ''}" data-theme-v="${k}" style="background:${t[1]};color:${t[2]}">${t[0]}</button>`).join('')}</div></div>
    <div class="grp"><div class="gl">Font</div>${seg('font', Object.fromEntries(Object.entries(FONTS).map(([k, f]) => [k, `<span style="font-family:${f[1].replace(/"/g, "'")}">${f[0]}</span>`])))}</div>
    <div class="grp"><label>Text size</label><div class="range"><input type="range" min="14" max="28" step="1" value="${S.size}" data-r="size"><span>${S.size}</span></div></div>
    <div class="grp"><label>Line spacing</label><div class="range"><input type="range" min="1.3" max="2.3" step="0.1" value="${S.lh}" data-r="lh"><span>${S.lh}</span></div></div>
    <div class="grp"><div class="gl">Margins</div>${seg('margin', { narrow: 'Narrow', normal: 'Normal', wide: 'Wide' })}</div>
    <div class="grp">${tog('photos', 'Pictures', 'Show the pictures in the stories')}${tog('vocab', 'Underline new words', 'Tap an underlined word to see its meaning')}${tog('hlword', 'Highlight word by word', 'Off: the whole sentence is highlighted while it is read')}${tog('follow', 'Scroll with narration', 'Scroll the page along with the audio')}${tog('livefa', 'Translate with narration', 'Show each sentence in Persian as it is read')}</div>`;
  const wire = root => {
    root.querySelectorAll('[data-theme-v]').forEach(b => b.onclick = () => { S.theme = b.dataset.themeV; root.querySelectorAll('[data-theme-v]').forEach(x => x.classList.toggle('on', x === b)); saveSettings(); onChange && onChange(); });
    root.querySelectorAll('.seg').forEach(sg => sg.querySelectorAll('button').forEach(b => b.onclick = () => { S[sg.dataset.key] = b.dataset.v; sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); saveSettings(); onChange && onChange(); }));
    root.querySelectorAll('[data-r]').forEach(r => r.oninput = () => { S[r.dataset.r] = +r.value; r.nextElementSibling.textContent = r.value; saveSettings(); onChange && onChange(); });
    root.querySelectorAll('[data-tog]').forEach(b => b.onclick = () => { const k = b.dataset.tog; S[k] = !S[k]; b.querySelector('.sw').classList.toggle('on', S[k]); saveSettings(); if (k === 'photos') fillImages(document); onChange && onChange(); });
  };
  return { html, wire };
}
function openReadingSheet() { const c = controls(); const sh = openSheet(`<h3>Reading settings</h3><p class="sub">Changes apply right away.</p>${c.html}`); c.wire(sh); }
function viewSettings(app) {
  const c = controls(() => fillImages(app));
  app.innerHTML = bar('Settings', btn('b-back', I.back, 'Back'), '') +
    `<div class="page"><h1>Settings</h1><div class="preview reader" style="padding:14px 16px;margin:0 0 26px"><div class="story"><p>Long ago, in a green <span class="w v">meadow</span>, there lived a hare. He was the fastest animal in the forest.</p></div></div>${c.html}</div>`;
  $('#b-back').onclick = () => App.back();
  c.wire(app);
}

/* ---------- About + updates ---------- */
let UPDATE = null;
async function checkUpdate() {
  if (window.IS_WEB) return null;
  const r = JSON.parse(await get(RELEASES));
  const v = String(r.tag_name || '').replace(/^v/i, ''), apk = (r.assets || []).find(a => /\.apk$/i.test(a.name));
  UPDATE = v && apk && cmpVer(v, Native.version()) > 0 ? { v, url: apk.browser_download_url, notes: (r.body || '').trim() } : null;
  return UPDATE;
}
function openUpdateSheet(u) {
  const sh = openSheet(`<h3>Version ${esc(u.v)} is available</h3><p class="sub">You have version ${esc(Native.version())}.</p>
    ${u.notes ? `<div class="notes">${esc(u.notes)}</div>` : ''}
    <div class="btns"><button class="btn ghost" id="u-later">Later</button><button class="btn" id="u-go">${I.download}Update</button></div>`);
  $('#u-later').onclick = closeSheet;
  $('#u-go').onclick = async () => {
    const go = $('#u-go'); go.disabled = true; go.textContent = 'Downloading';
    Bridge.onprogress = p => { go.textContent = `Downloading ${p}%`; };
    try { await Bridge.call('installUpdate', u.url); closeSheet(); }
    catch (e) {
      go.disabled = false; go.innerHTML = I.download + 'Update';
      toast(e.message === 'permission' ? 'Allow installing updates for this app, then tap Update again.' : 'The download failed. Check your internet connection.');
    }
  };
}
function viewAbout(app) {
  const size = Native.cacheSize();
  app.innerHTML = bar('About', btn('b-back', I.back, 'Back'), '') +
    `<div class="page"><div class="about-mark">${I.book}</div><h1 style="margin-bottom:6px">Once Upon a Fable</h1>
     <p style="margin:0 0 24px;color:var(--muted)">Classic fables for English learners, with Persian meanings and narration in American and British English.</p>
     <div class="grp"><div class="gl">Author</div>
       <div style="font:600 18px Literata,Georgia,serif;margin-bottom:6px">${esc(CONTACT.name)}</div>
       <button class="link" id="c-ig">${I.camera}<div class="tx">Instagram<small>@${esc(CONTACT.instagram)}</small></div>${I.chevron}</button>
       <button class="link" id="c-mail">${I.mail}<div class="tx">Email<small>${esc(CONTACT.email)}</small></div>${I.chevron}</button></div>
     <div class="grp"><div class="gl">App</div>
       <button class="link" id="c-up">${I.refresh}<div class="tx">Check for updates<small id="up-st">Version ${esc(Native.version())} · Stories ${INDEX.version}</small></div></button>
       <button class="link" id="c-clr">${I.trash}<div class="tx">Remove downloaded audio and pictures<small>${(size / 1048576).toFixed(1)} MB on this phone</small></div></button></div></div>`;
  $('#b-back').onclick = () => App.back();
  $('#c-ig').onclick = () => Native.openUrl('https://instagram.com/' + CONTACT.instagram);
  $('#c-mail').onclick = () => Native.openUrl('mailto:' + CONTACT.email);
  $('#c-up').onclick = async () => {
    const st = $('#up-st'); st.textContent = 'Checking';
    try {
      const changed = await refreshIndex();
      const u = await checkUpdate();
      if (u) { st.textContent = `Version ${u.v} is available`; openUpdateSheet(u); }
      else st.textContent = changed ? 'Stories updated. The app is up to date.' : `You have the latest version (${Native.version()})`;
    } catch (e) { st.textContent = 'Could not check. Check your internet connection.'; }
  };
  $('#c-clr').onclick = () => { Native.remove('audio'); Native.remove('img'); Object.keys(imgJobs).forEach(k => delete imgJobs[k]); toast('Downloads removed'); render(window.scrollY); };
}

/* ---------- Exercises (checked on the spot) ---------- */
function seeded(seed) { let s = (Math.imul(seed >>> 0 || 1, 2654435761) >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function shuffled(a, seed) { const r = seeded(seed), b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function shuffledDiff(a, seed) { let b, k = 0; do { b = shuffled(a, seed + k * 101); k++; } while (k < 20 && a.length > 1 && b.join('|') === a.join('|')); return b; }
const fb = (ok, right) => `<div class="fb ${ok ? 'ok' : 'bad'}">${ok ? I.check + 'Correct' : I.x + 'Correct answer: ' + esc(right)}</div>`;

function viewExercises(app, id) {
  const entry = INDEX.lessons.find(l => l.id === id), seed = parseInt(id, 10) * 7919;
  app.innerHTML = bar('Practice', btn('b-back', I.back, 'Back'), '') + `<div class="page ex"><div class="kicker">${esc(entry.title)}</div><h1>Practice</h1><div id="ex-body"><div class="loading"><div class="spin"></div>Loading</div></div></div>`;
  $('#b-back').onclick = () => App.back();
  loadLesson(entry).then(les => {
    const ex = les.ex, B = $('#ex-body');
    const score = { right: 0, total: 0 };
    const tally = ok => { score.total++; if (ok) score.right++; const s = $('#ex-score'); if (s) s.textContent = `${score.right} of ${score.total} correct`; };
    const sec = (L, title, help, body) => `<section class="exs"><div class="exh"><span>${L}</span><div><b>${title}</b><small>${help}</small></div></div>${body}</section>`;
    const order = shuffledDiff(ex.order, seed + 1);
    const defs = shuffled(ex.match, seed + 2);
    const vfor = w => les.vocab.find(v => v.w === w) || { w, en: w };
    B.innerHTML = `<p class="sub" id="ex-score">Answer the questions. Each answer is checked right away.</p>` +
      sec('A', 'True or false', 'Is each sentence true or false for the story?', ex.tf.map((q, i) => `<div class="q" data-tf="${i}"><p>${esc(q[0])}</p><div class="opts"><button data-a="1">True</button><button data-a="0">False</button></div></div>`).join('')) +
      sec('B', 'Put in order', 'Tap the events in the order they happened.', `<div class="ord">${order.map(s => `<button class="oi" data-s="${esc(s)}"><span class="num"></span><span>${esc(s)}</span></button>`).join('')}</div><div class="ord-fb"></div><button class="btn ghost sm" id="ord-reset">${I.refresh}Start again</button>`) +
      sec('C', 'Make the sentence', 'Tap the words in the right order.', ex.scramble.map((s, i) => { const words = s.replace(/[.!?]$/, '').split(/\s+/);
        return `<div class="q scr" data-sc="${i}"><div class="built"></div><div class="chips">${shuffledDiff(words, seed + 10 + i).map((w, j) => `<button class="chip" data-j="${j}">${esc(w)}</button>`).join('')}</div><div class="scr-fb"></div></div>`; }).join('')) +
      sec('D', 'Fill the gap', 'Choose the word that fits.', ex.gap.items.map((q, i) => `<div class="q" data-gap="${i}"><p>${esc(q).replace('___', '<span class="gap">______</span>')}</p><div class="opts wrap">${ex.gap.bank.slice().sort().map(w => `<button data-a="${esc(w)}">${esc(w)}</button>`).join('')}</div></div>`).join('')) +
      sec('E', 'Match the meaning', 'Choose the meaning of each word.', ex.match.map((w, i) => `<div class="q" data-m="${i}"><p><b>${esc(w)}</b></p><div class="opts col">${defs.map(d => `<button data-a="${esc(d)}">${esc(vfor(d).en)}</button>`).join('')}</div></div>`).join('')) +
      sec('F', 'Right or wrong', 'Is the word in bold used correctly?', ex.spot.map((q, i) => `<div class="q" data-sp="${i}"><p>${esc(q[0]).replace(/\*([^*]+)\*/, '<b>$1</b>')}</p><div class="opts"><button data-a="1">Right</button><button data-a="0">Wrong</button></div></div>`).join(''));

    // single-choice questions: lock after the first answer, show feedback
    const single = (sel, rightOf, label) => B.querySelectorAll(sel).forEach(q => q.querySelectorAll('.opts button').forEach(b => b.onclick = () => {
      if (q.dataset.done) return; q.dataset.done = 1;
      const right = rightOf(q), ok = b.dataset.a === right;
      q.querySelectorAll('.opts button').forEach(x => { x.disabled = true; if (x.dataset.a === right) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      const g = q.querySelector('.gap'); if (g) { g.textContent = right; g.classList.add(ok ? 'right' : 'wrong'); }
      q.insertAdjacentHTML('beforeend', fb(ok, label(q, right))); tally(ok);
    }));
    single('[data-tf]', q => ex.tf[q.dataset.tf][1] ? '1' : '0', (q, r) => r === '1' ? 'True' : 'False');
    single('[data-gap]', q => ex.gap.bank[q.dataset.gap], (q, r) => r);
    single('[data-m]', q => ex.match[q.dataset.m], (q, r) => vfor(r).en);
    single('[data-sp]', q => ex.spot[q.dataset.sp][1] ? '1' : '0', (q, r) => r === '1' ? 'Right' : 'Wrong');

    // ordering
    let picked = [];
    const ordItems = [...B.querySelectorAll('.oi')];
    const ordReset = () => { picked = []; ordItems.forEach(b => { b.className = 'oi'; b.disabled = false; b.querySelector('.num').textContent = ''; b.querySelector('.cor') && b.querySelector('.cor').remove(); }); B.querySelector('.ord-fb').innerHTML = ''; };
    ordItems.forEach(b => b.onclick = () => {
      if (b.classList.contains('picked')) return;
      picked.push(b); b.classList.add('picked'); b.querySelector('.num').textContent = picked.length;
      if (picked.length < ordItems.length) return;
      let good = 0;
      picked.forEach((x, i) => { const ri = ex.order.indexOf(x.dataset.s), ok = ri === i; if (ok) good++;
        x.classList.add(ok ? 'right' : 'wrong'); x.disabled = true;
        if (!ok) x.insertAdjacentHTML('beforeend', `<small class="cor">Should be ${ri + 1}</small>`); });
      B.querySelector('.ord-fb').innerHTML = fb(good === ordItems.length, ex.order.map((s, i) => `${i + 1}. ${s}`).join('  '));
      tally(good === ordItems.length);
    });
    $('#ord-reset').onclick = ordReset;

    // scrambled sentences
    B.querySelectorAll('[data-sc]').forEach(q => {
      const target = ex.scramble[q.dataset.sc].replace(/[.!?]$/, ''), built = q.querySelector('.built'), out = [];
      const check = () => {
        if (out.length !== q.querySelectorAll('.chip').length) return;
        const ok = out.map(b => b.textContent).join(' ').toLowerCase() === target.toLowerCase();
        q.querySelectorAll('.chip').forEach(c => c.disabled = true);
        built.classList.add(ok ? 'right' : 'wrong');
        q.querySelector('.scr-fb').innerHTML = fb(ok, ex.scramble[q.dataset.sc]); tally(ok);
      };
      q.querySelectorAll('.chip').forEach(c => c.onclick = () => {
        if (c.disabled) return;
        if (c.parentNode === built) { out.splice(out.indexOf(c), 1); q.querySelector('.chips').appendChild(c); }
        else { out.push(c); built.appendChild(c); check(); }
      });
    });
  }, () => { $('#ex-body').innerHTML = `<div class="empty">The exercises could not be loaded. Check your internet connection.</div>`; });
}

/* ---------- Flashcards: spaced repetition in the style of Anki (SM-2) ---------- */
const MIN = 60000, DAY = 86400000;
const SRS = {
  words: null,
  load() { try { return JSON.parse(localStorage.getItem('srs') || '{}'); } catch (e) { return {}; } },
  save(d) { localStorage.setItem('srs', JSON.stringify(d)); },
  today() { const d = new Date(); d.setHours(4, 0, 0, 0); if (Date.now() < d) d.setDate(d.getDate() - 1); return d.getTime(); }, // a new day starts at 4am
  dayLog() { let l = {}; try { l = JSON.parse(localStorage.getItem('srsday') || '{}'); } catch (e) {} if (l.day !== this.today()) l = { day: this.today(), fresh: 0 }; return l; },
  async all() {
    if (this.words) return this.words;
    const out = [];
    for (const [i, e] of INDEX.lessons.entries()) { try { const les = await loadLesson(e); les.vocab.forEach(v => out.push({ key: e.id + ':' + v.w, n: i + 1, ...v })); } catch (err) {} }
    return (this.words = out);
  },
  async counts() {
    const W = await this.all(), d = this.load(), now = Date.now(), end = this.today() + DAY, log = this.dayLog();
    let due = 0, seen = 0;
    W.forEach(w => { const c = d[w.key]; if (c) { seen++; if (c.due < (c.s === 'review' ? end : now + 20 * MIN)) due++; } });
    return { total: W.length, due, fresh: Math.max(0, Math.min(S.newPerDay - log.fresh, W.length - seen)) };
  },
  async next() {
    const W = await this.all(), d = this.load(), now = Date.now(), end = this.today() + DAY, log = this.dayLog();
    const learn = W.filter(w => d[w.key] && d[w.key].s !== 'review' && d[w.key].due <= now).sort((a, b) => d[a.key].due - d[b.key].due);
    if (learn.length) return learn[0];
    const rev = W.filter(w => d[w.key] && d[w.key].s === 'review' && d[w.key].due < end).sort((a, b) => d[a.key].due - d[b.key].due);
    if (rev.length) return rev[0];
    if (log.fresh < S.newPerDay) { const n = W.find(w => !d[w.key]); if (n) return n; }
    const ahead = W.filter(w => d[w.key] && d[w.key].s !== 'review' && d[w.key].due <= now + 20 * MIN).sort((a, b) => d[a.key].due - d[b.key].due);
    return ahead[0] || null;
  },
  // what each button would do: returns the new card state
  schedule(c, g) {
    const now = Date.now(), STEPS = [1, 10], RELEARN = [10];
    c = c ? { ...c } : { s: 'new', step: 0, ease: 2.5, ivl: 0, reps: 0, lapses: 0 };
    const grad = days => Object.assign(c, { s: 'review', ivl: days, due: this.today() + days * DAY, step: 0 });
    if (c.s === 'new' || c.s === 'learn') {
      c.s = 'learn';
      if (g === 1) { c.step = 0; c.due = now + STEPS[0] * MIN; }
      else if (g === 2) { c.due = now + (c.step === 0 ? (STEPS[0] + STEPS[1]) / 2 : STEPS[c.step]) * MIN; }
      else if (g === 3) { c.step++; if (c.step >= STEPS.length) grad(1); else c.due = now + STEPS[c.step] * MIN; }
      else grad(4);
    } else if (c.s === 'relearn') {
      if (g <= 2) c.due = now + RELEARN[0] * MIN; else grad(Math.max(1, c.ivl));
    } else {
      if (g === 1) { c.lapses++; c.ease = Math.max(1.3, c.ease - 0.2); c.ivl = Math.max(1, Math.round(c.ivl * 0.2)); c.s = 'relearn'; c.due = now + RELEARN[0] * MIN; }
      else if (g === 2) { c.ease = Math.max(1.3, c.ease - 0.15); grad(Math.max(c.ivl + 1, Math.round(c.ivl * 1.2))); }
      else if (g === 3) grad(Math.max(c.ivl + 1, Math.round(c.ivl * c.ease)));
      else { c.ease += 0.15; grad(Math.max(c.ivl + 1, Math.round(c.ivl * c.ease * 1.3))); }
    }
    c.reps++; return c;
  },
  label(c) { const ms = c.due - Date.now(); if (c.s === 'review') return c.ivl >= 30 ? Math.round(c.ivl / 30 * 10) / 10 + ' mo' : c.ivl + ' d'; return ms < 60 * MIN ? Math.max(1, Math.round(ms / MIN)) + ' min' : Math.round(ms / 3600000) + ' h'; },
  answer(w, g) {
    const d = this.load(), isNew = !d[w.key];
    d[w.key] = this.schedule(d[w.key], g); this.save(d);
    if (isNew) { const l = this.dayLog(); l.fresh++; localStorage.setItem('srsday', JSON.stringify(l)); }
  },
};

function viewCards(app) {
  app.innerHTML = bar('Flashcards', btn('b-back', I.back, 'Back'), btn('b-opt', I.sliders, 'Flashcard settings')) + `<div class="page cards"><h1>Flashcards</h1><div id="cd"><div class="loading"><div class="spin"></div>Preparing your cards</div></div></div>`;
  $('#b-back').onclick = () => App.back();
  $('#b-opt').onclick = () => {
    const sh = openSheet(`<h3>Flashcards</h3><p class="sub">How many new words to learn each day.</p>
      <div class="seg" id="npd">${[5, 10, 15, 20, 30].map(n => `<button data-v="${n}" class="${S.newPerDay === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <button class="link" id="srs-reset" style="margin-top:18px">${I.trash}<div class="tx">Reset progress<small>Start all flashcards from the beginning</small></div></button>`);
    sh.querySelectorAll('#npd button').forEach(b => b.onclick = () => { S.newPerDay = +b.dataset.v; saveSettings(); closeSheet(); show(); });
    $('#srs-reset').onclick = () => { localStorage.removeItem('srs'); localStorage.removeItem('srsday'); closeSheet(); toast('Progress reset'); show(); };
  };
  const show = async () => {
    const box = $('#cd'); if (!box) return;
    const w = await SRS.next(), c = await SRS.counts();
    if (!w) { box.innerHTML = `<div class="done-card">${I.check}<h2>All done for now</h2><p>${c.total ? 'Come back tomorrow for more reviews and new words.' : 'No words yet.'}</p></div>`; return; }
    const st = SRS.load()[w.key];
    const sent = esc(w.s).replace(new RegExp('\\b(' + w.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*)', 'i'), '<b>$1</b>');
    box.innerHTML = `<div class="cstat"><span>${c.due} to review</span><span>${c.fresh} new</span></div>
      <div class="card"><small>${st ? 'Review' : 'New word'} · Lesson ${w.n}</small><div class="cw">${esc(w.w)}</div><p class="cs">${sent}</p>
        <div class="back" hidden><div class="ce">${esc(w.en)}</div><div class="fa cf">${esc(w.fa)}</div><div class="fa cfs">${esc(w.sfa)}</div></div></div>
      <button class="btn wide" id="c-show">Show answer</button>
      <div class="grades" hidden>${[['Again', 1], ['Hard', 2], ['Good', 3], ['Easy', 4]].map(([l, g]) => `<button data-g="${g}"><b>${l}</b><small>${SRS.label(SRS.schedule(st, g))}</small></button>`).join('')}</div>`;
    $('#c-show').onclick = () => { box.querySelector('.back').hidden = false; $('#c-show').hidden = true; box.querySelector('.grades').hidden = false; };
    box.querySelectorAll('.grades button').forEach(b => b.onclick = () => { SRS.answer(w, +b.dataset.g); show(); });
  };
  show();
}

/* ---------- Start ---------- */
(async function start() {
  applySettings();
  await loadIndex();
  App.go('home');
  if (await refreshIndex()) { if (stack.length === 1) render(window.scrollY); }
  setTimeout(async () => { try { const u = await checkUpdate(); if (u && $('#sheet-wrap').hidden) openUpdateSheet(u); } catch (e) {} }, 1200);
})();
