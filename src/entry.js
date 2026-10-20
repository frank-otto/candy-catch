import { T } from './i18n.js';
import * as A from './audio.js';
import { makeBackground, drawStars, drawCandy, drawSpider, drawBucket } from './draw.js';

const ROUND = 50, LIVES = 3, URL_TXT = '@Frank_AI_Lab';
const $ = id => document.getElementById(id);
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let seed = (window.__ccSeed || (Date.now() & 0xffffff)) >>> 0;
function rng() { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const cv = $('game'), g = cv.getContext('2d');
let W = 0, H = 0, U = 1, DPR = 1, BG = null, stars = [], bandL = 0, bandR = 0;
const S = {
  state: 'menu', lang: ls.get('cc-lang', 'en'), kids: ls.get('cc-kids', '0') === '1',
  score: 0, time: ROUND, el: 0, combo: 0, maxCombo: 0, caught: 0, golds: 0, lives: LIVES, gt: 0, spawnT: 0.4, shake: 0, flash: 0, newBest: false,
  best: +ls.get('cc-best', '0') || 0, name: ls.get('cc-name', 'Player') || 'Player', endT: 0, endReason: ''
};
A.setClock(() => S.gt);
const ents = [], parts = [], pops = [], rings = [], bats = [];
let nid = 1;
const bucket = { x: 0, y: 0, w: 0, h: 0, tx: 0, squash: 0, tilt: 0, glow: 0, filled: 0, vx: 0 };
const keys = { l: false, r: false };

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2); W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  U = Math.min(W * 1.25, H * .8) / 600;
  const band = Math.min(W, H * 1.05); bandL = Math.max((W - band) / 2 + 30 * U, 70 * U); bandR = Math.min((W + band) / 2 - 30 * U, W - 70 * U);
  BG = makeBackground(W, H, U);
  const r = mkr(11); stars = []; for (let i = 0; i < 140; i++) stars.push({ x: r() * W, y: r() * H * .7, r: (.4 + r() * 1.3) * Math.max(.7, U), b: .3 + r() * .7, sp: .6 + r() * 2.5, ph: r() * 7 });
  bucket.w = 128 * U; bucket.h = 86 * U; bucket.y = H * .9 - 4 * U;
  if (!bucket.x) bucket.x = bucket.tx = W / 2; bucket.x = bucket.tx = clamp(bucket.x, bandL, bandR);
}
function mkr(s) { let a = s; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }

// ---------------- i18n / UI ----------------
function t(k) { return T[S.lang][k] || T.en[k] || k; }
function applyLang() {
  document.documentElement.lang = S.lang;
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  $('h3').textContent = S.kids ? t('h3k') : t('h3');
  $('btnLang').textContent = S.lang === 'en' ? 'DE' : 'EN';
  $('btnKids').classList.toggle('on', S.kids); $('btnKids').setAttribute('aria-pressed', S.kids);
  $('btnSound').classList.toggle('on', !A.isMuted());
  hud(true);
}
function hud(force) {
  $('hScore').textContent = S.score; $('hTime').textContent = Math.ceil(S.time);
  $('hTimeBox').classList.toggle('warn', S.state === 'play' && S.time <= 10);
  const m = mult(); $('hCombo').textContent = S.combo > 1 ? `${S.combo} · ×${m}` : '—';
  $('hLives').textContent = S.kids ? '🍬' : '🎃'.repeat(Math.max(0, S.lives)) + '🕸️'.repeat(LIVES - Math.max(0, S.lives));
}
function mult() { return Math.min(5, 1 + Math.floor(S.combo / 8)); }
function show(id) { for (const s of ['menu', 'end']) $(s).classList.toggle('show', s === id); document.body.dataset.state = S.state; }

// ---------------- game flow ----------------
function start() {
  A.unlock().then(() => { if (S.state === 'play') A.startMusic(); });
  ents.length = 0; S.state = 'play'; S.score = 0; S.time = ROUND; S.el = 0; S.combo = 0; S.maxCombo = 0; S.caught = 0; S.golds = 0; S.lives = LIVES; S.spawnT = .3; S.newBest = false;
  bucket.filled = 0; A.sfx.start(S.kids); A.startMusic(); show(null); hud(); pop(W / 2, H * .45, S.kids ? t('kids') : t('title'), '#ffd27a', 1.6);
}
function end(reason) {
  S.state = 'end'; S.endReason = reason; S.endT = 0; A.stopMusic();
  if (S.score > S.best) { S.best = S.score; S.newBest = S.score > 0; ls.set('cc-best', S.best); }
  A.sfx.end(S.newBest);
  $('eTitle').textContent = reason === 'spiders' ? t('over') : t('timeUp');
  $('eScore').textContent = S.score; $('eBest').textContent = (S.newBest ? t('newBest') : t('best') + ': ' + S.best);
  $('eStats').textContent = `${S.caught} ${t('caught')} · ${S.golds} ${t('golden')} · ${t('maxCombo')} ${S.maxCombo}`;
  $('eName').value = S.name; show('end'); hud();
}
function spawn() {
  const k = S.state === 'play' ? clamp(S.el / ROUND, 0, 1) : .2, kids = S.kids || S.state !== 'play';
  const r = 24 * U, x = lerp(bandL + r, bandR - r, rng());
  let type = 'candy'; const q = rng();
  if (q < (S.kids ? .08 : .065)) type = 'gold'; else if (!kids && q < .065 + lerp(.13, .27, k)) type = 'spider';
  const sp = H * lerp(.27, .55, k) * (S.kids ? .62 : 1) * (S.state === 'play' ? 1 : .7) * (type === 'spider' ? .85 : 1) * (.9 + rng() * .2);
  const e = { id: nid++, type, x, x0: x, y: -r * 2, vy: sp, r: type === 'spider' ? r * 1.05 : type === 'gold' ? r * 1.1 : r, rot: rng() * 6, vr: (rng() - .5) * 4, kind: Math.floor(rng() * 5), shape: Math.floor(rng() * 4), sway: rng() * 6, on: true };
  ents.push(e);
  // tempo: spawn interval shrinks over the round
  S.spawnT += lerp(.82, .34, k) * (S.kids ? 1.45 : 1) * (S.state === 'play' ? 1 : 1.6) * (.75 + rng() * .5);
}
function burst(x, y, cols, n, sp, size) {
  for (let i = 0; i < n; i++) { const a = rng() * Math.PI * 2, v = sp * (.3 + rng() * .9);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * .4, life: 1, d: .6 + rng() * .6, s: size * (.5 + rng()), c: cols[i % cols.length], star: rng() < .35 }); }
}
function pop(x, y, txt, col, big = 1) { pops.push({ x, y, txt, col, life: 1, big }); }
function catchIt(e) {
  e.on = false; bucket.squash = 1; bucket.glow = Math.min(1.2, bucket.glow + .5);
  if (e.type === 'spider') {
    S.lives--; S.combo = 0; S.shake = 1; S.flash = 1; A.sfx.spider();
    burst(e.x, e.y, ['#2a1f3a', '#ff2d4a', '#7d6aa0'], 26, 420 * U, 7 * U); pop(e.x, e.y - 40 * U, t('ouch'), '#ff5a6e', 1.3);
    if (S.lives <= 0) end('spiders'); return;
  }
  S.combo++; S.maxCombo = Math.max(S.maxCombo, S.combo); S.caught++; bucket.filled++;
  const m = mult(), pts = (e.type === 'gold' ? 50 : 10) * m; S.score += pts;
  if (e.type === 'gold') { S.golds++; A.sfx.gold(); burst(e.x, e.y, ['#fff3b0', '#ffc400', '#fff'], 46, 560 * U, 7 * U); rings.push({ x: e.x, y: e.y, r: 10 * U, life: 1, c: '255,210,90' }); pop(e.x, e.y - 50 * U, t('gold') + ' +' + pts, '#ffd84a', 1.5); S.flash = .35; }
  else { A.sfx.catch(S.combo); const c = ['#ff8a1f', '#a64dff', '#3ee07a', '#ff4f9a', '#38c8ff'][e.kind]; burst(e.x, e.y, [c, '#fff', '#ffe0a0'], 18, 330 * U, 5 * U); rings.push({ x: e.x, y: e.y, r: 8 * U, life: 1, c: '255,190,120' }); pop(e.x, e.y - 40 * U, '+' + pts, '#fff', 1); }
  if (S.combo > 0 && S.combo % 8 === 0 && m > 1) { A.sfx.combo(S.combo); pop(W / 2, H * .3, `COMBO ×${m}`, '#c58cff', 1.8); rings.push({ x: bucket.x, y: bucket.y - bucket.h * .6, r: 20 * U, life: 1, c: '200,140,255' }); }
  hud();
}

// ---------------- simulation ----------------
function step(dt) {
  dt = Math.min(dt, 1 / 20); S.gt += dt;
  if (S.state === 'play') {
    S.el += dt; S.time = Math.max(0, ROUND - S.el);
    if (S.time <= 0) { end('time'); }
  } else if (S.state === 'end') S.endT += dt;
  if (S.state !== 'end') { S.spawnT -= dt; while (S.spawnT <= 0) spawn(); }
  // bucket
  if (S.state === 'menu') bucket.tx = W / 2 + Math.sin(S.gt * .9) * (bandR - bandL) * .3;
  if (keys.l || keys.r) bucket.tx = clamp(bucket.x + ((keys.r ? 1 : 0) - (keys.l ? 1 : 0)) * (bandR - bandL) * 1.5 * dt * 3, bandL, bandR);
  bucket.tx = clamp(bucket.tx, bandL, bandR);
  const px = bucket.x; bucket.x += (bucket.tx - bucket.x) * (1 - Math.exp(-dt * 20));
  bucket.vx = (bucket.x - px) / Math.max(dt, 1e-4); bucket.tilt = clamp(bucket.vx / (3000 * U), -.25, .25);
  bucket.squash *= Math.exp(-dt * 9); bucket.glow *= Math.exp(-dt * 3);
  const top = bucket.y - bucket.h;
  for (const e of ents) {
    if (!e.on) continue;
    const yPrev = e.y; e.y += e.vy * dt; e.rot += e.vr * dt;
    if (e.type === 'spider') { e.x = e.x0 + Math.sin(S.gt * 2 + e.sway) * 22 * U; e.rot = 0; }
    if (S.state === 'play' && yPrev + e.r * .4 < top + 6 * U && e.y + e.r * .4 >= top - 4 * U && Math.abs(e.x - bucket.x) < bucket.w * .5 + e.r * .35) { catchIt(e); if (S.state !== 'play') break; continue; }
    if (e.y - e.r > H) { e.on = false; if (S.state === 'play' && e.type !== 'spider') { if (S.combo >= 3) pop(e.x, H - 70 * U, t('miss'), '#9aa0c8', .9); S.combo = 0; A.sfx.miss(); hud(); } }
  }
  for (let i = ents.length - 1; i >= 0; i--) if (!ents[i].on) ents.splice(i, 1);
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * U * dt; p.vx *= Math.exp(-dt * 2); p.life -= dt / p.d; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
  for (const p of pops) { p.y -= 60 * U * dt; p.life -= dt / 1.1; } for (let i = pops.length - 1; i >= 0; i--) if (pops[i].life <= 0) pops.splice(i, 1);
  for (const r of rings) { r.r += 260 * U * dt; r.life -= dt / .55; } for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life <= 0) rings.splice(i, 1);
  if (bats.length < 3 && rng() < dt * .25) bats.push({ x: -40, y: H * (.12 + rng() * .3), v: (60 + rng() * 80) * U, ph: rng() * 6, s: (10 + rng() * 8) * U });
  for (const b of bats) b.x += b.v * dt; for (let i = bats.length - 1; i >= 0; i--) if (bats[i].x > W + 60) bats.splice(i, 1);
  S.shake *= Math.exp(-dt * 8); S.flash *= Math.exp(-dt * 6);
  if (S.state === 'play') hudTime();
}
let lastSec = -1;
function hudTime() { const s = Math.ceil(S.time); if (s !== lastSec) { lastSec = s; hud(); } }

// ---------------- render ----------------
function render() {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const sh = S.shake * 14 * U; g.save(); if (sh > .3) g.translate((rng() - .5) * sh, (rng() - .5) * sh);
  g.drawImage(BG.canvas, 0, 0, W, H);
  drawStars(g, stars, S.gt);
  // drifting cloud wisps across the moon
  for (let i = 0; i < 3; i++) { const x = ((S.gt * (12 + i * 7) * U + i * 400) % (W + 600)) - 300, y = BG.my + (i - 1) * BG.mr * .7;
    g.save(); g.translate(x, y); g.scale(2.4, .45); const gr = g.createRadialGradient(0, 0, 0, 0, 0, BG.mr); gr.addColorStop(0, 'rgba(160,150,210,.16)'); gr.addColorStop(1, 'rgba(160,150,210,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, BG.mr, 0, 7); g.fill(); g.restore(); }
  g.fillStyle = '#07050f';
  for (const b of bats) { const f = Math.sin(S.gt * 16 + b.ph); g.beginPath(); g.moveTo(b.x, b.y); g.quadraticCurveTo(b.x - b.s, b.y - b.s * f, b.x - b.s * 1.8, b.y + b.s * .2); g.quadraticCurveTo(b.x - b.s * .8, b.y + b.s * .2, b.x, b.y + b.s * .35); g.quadraticCurveTo(b.x + b.s * .8, b.y + b.s * .2, b.x + b.s * 1.8, b.y + b.s * .2); g.quadraticCurveTo(b.x + b.s, b.y - b.s * f, b.x, b.y); g.fill(); }
  for (const r of rings) { g.strokeStyle = `rgba(${r.c},${r.life * .8})`; g.lineWidth = 5 * U * r.life; g.beginPath(); g.arc(r.x, r.y, r.r, 0, 7); g.stroke(); }
  for (const e of ents) { if (e.type === 'spider') drawSpider(g, e, U, S.gt); }
  for (const e of ents) { if (e.type !== 'spider') drawCandy(g, e, U, S.gt); }
  drawBucket(g, bucket, U, S.gt, bucket.filled);
  g.globalCompositeOperation = 'lighter';
  for (const p of parts) { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.c; g.beginPath();
    if (p.star) { const s = p.s * 1.4; g.moveTo(p.x, p.y - s); g.lineTo(p.x + s * .3, p.y); g.lineTo(p.x, p.y + s); g.lineTo(p.x - s * .3, p.y); } else g.arc(p.x, p.y, p.s * (.4 + p.life * .6), 0, 7); g.fill(); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  // ground fog
  const fg = g.createLinearGradient(0, H * .82, 0, H); fg.addColorStop(0, 'rgba(120,110,180,0)'); fg.addColorStop(1, 'rgba(120,110,180,.28)'); g.fillStyle = fg; g.fillRect(0, H * .82, W, H * .18);
  for (const p of pops) { const a = Math.min(1, p.life * 2.2), s = (1 + (1 - p.life) * .15) * p.big;
    g.globalAlpha = a; g.font = `700 ${Math.round(30 * U * s)}px Fredoka, "Arial Rounded MT Bold", sans-serif`; g.textAlign = 'center'; g.lineWidth = 6 * U; g.strokeStyle = 'rgba(20,10,40,.85)'; g.strokeText(p.txt, p.x, p.y); g.fillStyle = p.col; g.fillText(p.txt, p.x, p.y); }
  g.globalAlpha = 1; g.restore();
  // vignette + flash
  const vg = g.createRadialGradient(W / 2, H * .5, Math.min(W, H) * .35, W / 2, H * .5, Math.max(W, H) * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  if (S.flash > .02) { g.fillStyle = S.lives < LIVES && S.shake > .3 ? `rgba(255,40,70,${S.flash * .25})` : `rgba(255,220,120,${S.flash * .25})`; g.fillRect(0, 0, W, H); }
}

// ---------------- end card (1080x1350 PNG) ----------------
function makeCard() {
  const CW = 1080, CH = 1350, c = document.createElement('canvas'); c.width = CW; c.height = CH; const k = c.getContext('2d');
  const bg = makeBackground(CW, CH, 1.8, { mx: .82, my: .1, mr: .085 }); k.drawImage(bg.canvas, 0, 0); drawStars(k, stars.map(s => ({ ...s, x: s.x / W * CW, y: s.y / H * CH, r: s.r * 1.4 })), 1.3);
  const name = (S.name || 'Player').slice(0, 18);
  const F = (w, s) => `${w} ${s}px Fredoka, "Arial Rounded MT Bold", sans-serif`;
  k.textAlign = 'center'; k.fillStyle = '#ffd27a'; k.font = F(700, 104); k.shadowColor = 'rgba(255,150,40,.6)'; k.shadowBlur = 30; k.fillText('Candy Catch', CW / 2, 300); k.shadowBlur = 0;
  k.fillStyle = 'rgba(255,255,255,.85)'; k.font = F(500, 44); k.fillText(name, CW / 2, 420);
  k.fillStyle = '#fff'; k.font = F(700, 230); k.shadowColor = 'rgba(190,140,255,.7)'; k.shadowBlur = 40; k.fillText(String(S.score), CW / 2, 650); k.shadowBlur = 0;
  k.fillStyle = '#c9c2ff'; k.font = F(500, 40); k.fillText(t('score').toUpperCase() + (S.newBest ? ' · ' + t('newBest') : ''), CW / 2, 720);
  k.fillStyle = 'rgba(255,255,255,.8)'; k.font = F(400, 36); k.fillText(`${S.caught} ${t('caught')} · ${S.golds} ${t('golden')} · ${t('maxCombo')} ${S.maxCombo}`, CW / 2, 790);
  const ec = [{ type: 'candy', kind: 0, shape: 0 }, { type: 'gold', kind: 0, shape: 0 }, { type: 'candy', kind: 1, shape: 1 }, { type: 'candy', kind: 2, shape: 3 }];
  ec.forEach((e, i) => drawCandy(k, { ...e, id: i, x: CW / 2 + (i - 1.5) * 150, y: 900, r: 40, rot: (i - 1.5) * .3 }, 1.8, 1));
  drawBucket(k, { x: CW / 2, y: 1150, w: 210, h: 140, squash: 0, tilt: 0, glow: .6 }, 1.8, 0, 7);
  k.fillStyle = '#ffd27a'; k.font = F(600, 46); k.fillText(t('cardLine'), CW / 2, 1240);
  k.fillStyle = 'rgba(255,255,255,.75)'; k.font = F(400, 34); k.fillText(t('cardCta') + ' · ' + URL_TXT, CW / 2, 1300);
  return c;
}
async function saveCard(share) {
  S.name = ($('eName').value || '').trim() || 'Player'; ls.set('cc-name', S.name);
  try { await document.fonts.load('700 40px Fredoka'); } catch (e) {}
  const c = makeCard(); window.__ccLastCard = { w: c.width, h: c.height };
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const file = new File([blob], 'candy-catch-highscore.png', { type: 'image/png' });
  if (share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text: `Candy Catch: ${S.score} — ${t('cardLine')} ${URL_TXT}` }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'candy-catch-highscore.png'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

// ---------------- input ----------------
function pointer(e) { const r = cv.getBoundingClientRect(); bucket.tx = clamp(e.clientX - r.left, bandL, bandR); }
cv.addEventListener('pointerdown', e => { pointer(e); A.unlock(); });
cv.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) pointer(e); });
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft' || e.key === 'a') { keys.l = true; e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'd') { keys.r = true; e.preventDefault(); }
  if ((e.key === 'Enter' || e.key === ' ') && S.state === 'menu') { e.preventDefault(); start(); }
});
window.addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'a') keys.l = false; if (e.key === 'ArrowRight' || e.key === 'd') keys.r = false; });
$('btnPlay').onclick = () => start();
$('btnAgain').onclick = () => start();
$('btnMenu').onclick = () => { S.state = 'menu'; A.sfx.ui(); show('menu'); };
$('btnCard').onclick = () => saveCard(false);
$('btnShare').onclick = () => saveCard(true);
$('btnLang').onclick = () => { S.lang = S.lang === 'en' ? 'de' : 'en'; ls.set('cc-lang', S.lang); applyLang(); A.sfx.ui(); };
$('btnKids').onclick = () => { S.kids = !S.kids; ls.set('cc-kids', S.kids ? '1' : '0'); applyLang(); A.unlock(); A.sfx.ui(); };
$('btnSound').onclick = () => { A.setMuted(!A.isMuted()); applyLang(); };
$('eName').addEventListener('keydown', e => e.stopPropagation());
window.addEventListener('resize', resize);

// ---------------- loop + test/video hooks ----------------
resize(); applyLang(); show('menu');
let last = performance.now();
function loop(now) { const dt = (now - last) / 1000; last = now; if (!window.__ccManual) { step(dt); render(); } requestAnimationFrame(loop); }
requestAnimationFrame(loop);
window.__cc = { S, ents: () => ents.map(e => ({ id: e.id, type: e.type, x: e.x, y: e.y, r: e.r, vy: e.vy })), bucket, start, end, step: (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); render(); },
  log: A.log, card: () => { const c = makeCard(); return c.toDataURL('image/png'); }, spawnAt(type, x, y) { spawn(); const e = ents[ents.length - 1]; e.type = type; e.x = e.x0 = x; e.y = y; e.r = 24 * U; return e.id; }, U: () => U, band: () => [bandL, bandR] };
document.body.classList.add('ready');
