// All canvas drawing: background, candies, spiders, bucket, particles
export const CANDY_COLORS = [['#ff8a1f', '#ffd29a'], ['#a64dff', '#e2c2ff'], ['#3ee07a', '#c4ffd8'], ['#ff4f9a', '#ffc3dd'], ['#38c8ff', '#c6f0ff']];
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeBackground(W, H, U, o = {}) {
  const c = document.createElement('canvas'); c.width = Math.ceil(W); c.height = Math.ceil(H);
  const g = c.getContext('2d'); const r = rnd(7);
  let gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#070a1f'); gr.addColorStop(.45, '#16163d'); gr.addColorStop(.8, '#2a1b48'); gr.addColorStop(1, '#120c22');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // moon
  const mx = W * (o.mx || .74), my = H * (o.my || .17), mr = Math.min(W, H) * (o.mr || .11);
  let mg = g.createRadialGradient(mx, my, mr * .5, mx, my, mr * 4.2);
  mg.addColorStop(0, 'rgba(255,236,190,.42)'); mg.addColorStop(.35, 'rgba(190,170,255,.12)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mg; g.fillRect(0, 0, W, H);
  mg = g.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr);
  mg.addColorStop(0, '#fffbea'); mg.addColorStop(.7, '#f6e7bd'); mg.addColorStop(1, '#e2cd98');
  g.fillStyle = mg; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
  g.fillStyle = 'rgba(180,150,100,.18)';
  for (const [dx, dy, s] of [[-.3, -.2, .22], [.25, .1, .16], [-.05, .4, .12], [.35, -.35, .09], [-.45, .25, .08]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, s * mr, 0, 7); g.fill(); }
  // hills
  const hill = (base, amp, col, seed) => { const rr = rnd(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
    const ph = rr() * 6; for (let x = 0; x <= W + 10; x += 10) g.lineTo(x, H * base - Math.sin(x / W * 3.2 + ph) * amp * H - Math.sin(x / W * 7.1 + ph * 2) * amp * .35 * H);
    g.lineTo(W, H); g.fill(); };
  hill(.78, .045, '#1d1638', 3); hill(.86, .03, '#130e26', 5);
  // trees & graves
  g.fillStyle = '#0b0818';
  const tree = (x, y, s) => { g.save(); g.translate(x, y); g.lineCap = 'round'; g.strokeStyle = '#0b0818';
    const br = (len, ang, w, d) => { if (d > 5 || len < 3) return; g.lineWidth = w; g.beginPath(); g.moveTo(0, 0); const ex = Math.sin(ang) * len, ey = -Math.cos(ang) * len; g.lineTo(ex, ey); g.stroke(); g.save(); g.translate(ex, ey); br(len * .72, ang - .45 - r() * .2, w * .68, d + 1); br(len * .66, ang + .4 + r() * .2, w * .65, d + 1); g.restore(); };
    br(s * 60, 0, s * 9, 0); g.restore(); };
  tree(W * .1, H * .86, U * 1.3); tree(W * .93, H * .88, U * 1.0);
  for (let i = 0; i < 9; i++) { const x = W * (.18 + i * .085 + r() * .03), y = H * (.9 + r() * .03), s = U * (14 + r() * 8);
    g.beginPath(); g.moveTo(x - s * .5, y); g.lineTo(x - s * .5, y - s * 1.1); g.arc(x, y - s * 1.1, s * .5, Math.PI, 0); g.lineTo(x + s * .5, y); g.fill(); }
  g.fillStyle = '#0a0716'; g.fillRect(0, H * .93, W, H * .07);
  return { canvas: c, mx, my, mr };
}

export function drawStars(g, stars, t) {
  for (const s of stars) { const a = .35 + .65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
    g.globalAlpha = a * s.b; g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}

export function drawCandy(g, e, U, t) {
  const r = e.r; g.save(); g.translate(e.x, e.y); g.rotate(e.rot);
  if (e.type === 'gold') {
    const gl = g.createRadialGradient(0, 0, r * .3, 0, 0, r * 2.6); gl.addColorStop(0, 'rgba(255,220,120,.55)'); gl.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, r * 2.6, 0, 7); g.fill();
  }
  const [c1, c2] = e.type === 'gold' ? ['#ffb400', '#fff3b0'] : CANDY_COLORS[e.kind];
  const shape = e.type === 'gold' ? 0 : e.shape;
  if (shape === 0) { // wrapped candy
    g.fillStyle = c1;
    for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * r * .7, 0); g.lineTo(sx * r * 1.55, -r * .62); g.quadraticCurveTo(sx * r * 1.75, 0, sx * r * 1.55, r * .62); g.closePath(); g.fill(); }
    const gr = g.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r); gr.addColorStop(0, c2); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * .95, r * .78, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = r * .14; g.beginPath(); g.moveTo(-r * .4, -r * .6); g.lineTo(r * .1, r * .7); g.stroke();
  } else if (shape === 1) { // lollipop
    g.strokeStyle = '#f4ead6'; g.lineWidth = r * .22; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, r * .5); g.lineTo(0, r * 2); g.stroke();
    g.fillStyle = c2; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    g.strokeStyle = c1; g.lineWidth = r * .28; g.beginPath();
    for (let a = 0; a < 14; a += .2) { const rr = a / 14 * r * .85; g.lineTo(Math.cos(a + t * 0) * rr, Math.sin(a) * rr); } g.stroke();
  } else if (shape === 2) { // candy corn
    g.beginPath(); g.moveTo(0, -r * 1.2); g.quadraticCurveTo(r * 1.1, r * .6, r * .8, r * .95); g.quadraticCurveTo(0, r * 1.15, -r * .8, r * .95); g.quadraticCurveTo(-r * 1.1, r * .6, 0, -r * 1.2); g.closePath();
    g.save(); g.clip(); g.fillStyle = '#fff6e6'; g.fillRect(-r * 2, -r * 2, r * 4, r * 1.6); g.fillStyle = '#ff8c1a'; g.fillRect(-r * 2, -r * .4, r * 4, r * .8); g.fillStyle = '#ffd23a'; g.fillRect(-r * 2, r * .4, r * 4, r * 2); g.restore();
  } else { // gumdrop
    const gr = g.createRadialGradient(-r * .3, -r * .4, r * .1, 0, 0, r * 1.1); gr.addColorStop(0, c2); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.beginPath(); g.moveTo(-r, r * .7); g.quadraticCurveTo(-r, -r, 0, -r); g.quadraticCurveTo(r, -r, r, r * .7); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.cos(i * 2.1) * r * .55, Math.sin(i * 1.7) * r * .4, r * .09, 0, 7); g.fill(); }
  }
  if (e.type === 'gold') { const s = .6 + .4 * Math.sin(t * 9 + e.id); g.fillStyle = `rgba(255,255,255,${s})`; star(g, r * .9, -r * .8, r * .38); star(g, -r * 1.0, r * .5, r * .24); }
  g.restore();
}
function star(g, x, y, s) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? s * .25 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }

export function drawSpider(g, e, U, t) {
  g.strokeStyle = 'rgba(220,220,255,.45)'; g.lineWidth = Math.max(1, U * 1.2);
  g.beginPath(); g.moveTo(e.x0, 0); g.quadraticCurveTo(e.x0, e.y * .5, e.x, e.y - e.r); g.stroke();
  const r = e.r; g.save(); g.translate(e.x, e.y);
  g.strokeStyle = '#120d1c'; g.lineWidth = r * .16; g.lineCap = 'round';
  for (let s = -1; s <= 1; s += 2) for (let i = 0; i < 4; i++) {
    const w = Math.sin(t * 14 + i * 1.3 + (s > 0 ? 1 : 0)) * .18, a = (-.6 + i * .42 + w);
    g.beginPath(); g.moveTo(0, 0); const kx = s * r * 1.15, ky = Math.sin(a) * r * 1.1 - r * .5;
    g.quadraticCurveTo(kx, ky - r * .5, s * r * 1.7, ky + r * .55); g.stroke(); }
  const gr = g.createRadialGradient(-r * .3, -r * .4, r * .1, 0, 0, r); gr.addColorStop(0, '#4a3a66'); gr.addColorStop(1, '#120d1c');
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * .85, r * .95, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(0, r * .75, r * .5, 0, 7); g.fill();
  g.fillStyle = '#ff2d4a'; g.shadowColor = '#ff2d4a'; g.shadowBlur = r * .6;
  for (const [x, y, s] of [[-.2, .82, .12], [.2, .82, .12], [-.38, .7, .07], [.38, .7, .07]]) { g.beginPath(); g.arc(x * r, y * r, s * r, 0, 7); g.fill(); }
  g.shadowBlur = 0; g.fillStyle = 'rgba(255,60,90,.65)'; g.beginPath(); g.moveTo(0, -r * .5); g.lineTo(r * .25, -r * .1); g.lineTo(0, r * .3); g.lineTo(-r * .25, -r * .1); g.closePath(); g.fill();
  g.restore();
}

export function drawBucket(g, b, U, t, filled) {
  const w = b.w, h = b.h; g.save(); g.translate(b.x, b.y);
  g.scale(1 + b.squash * .12, 1 - b.squash * .12); g.rotate(b.tilt);
  // glow
  const gl = g.createRadialGradient(0, -h * .2, 0, 0, -h * .2, w * 1.1); gl.addColorStop(0, `rgba(255,150,40,${.18 + b.glow * .5})`); gl.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(0, -h * .2, w * 1.1, 0, 7); g.fill();
  // handle
  g.strokeStyle = '#3a2a1a'; g.lineWidth = U * 5; g.beginPath(); g.ellipse(0, -h * .95, w * .42, h * .62, 0, Math.PI, 0); g.stroke();
  // candies peeking out
  for (let i = 0; i < Math.min(filled, 7); i++) { const [c1] = CANDY_COLORS[i % 5]; g.fillStyle = c1; g.beginPath(); g.arc((i - 3) * w * .11, -h * .98 - (i % 2) * U * 6, U * 10, 0, 7); g.fill(); }
  // pumpkin body
  const gr = g.createRadialGradient(-w * .15, -h * .7, h * .1, 0, -h * .45, w * .6); gr.addColorStop(0, '#ffb04a'); gr.addColorStop(.6, '#f07a12'); gr.addColorStop(1, '#a8460a');
  g.fillStyle = gr; g.beginPath(); g.moveTo(-w * .5, -h); g.bezierCurveTo(-w * .62, -h * .4, -w * .42, 0, 0, 0); g.bezierCurveTo(w * .42, 0, w * .62, -h * .4, w * .5, -h); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(120,40,0,.35)'; g.lineWidth = U * 2.2; for (const s of [-.22, .22]) { g.beginPath(); g.moveTo(w * s, -h); g.quadraticCurveTo(w * s * 1.5, -h * .5, w * s * .8, -h * .02); g.stroke(); }
  g.fillStyle = '#5a2a06'; g.beginPath(); g.ellipse(0, -h, w * .5, h * .14, 0, 0, 7); g.fill();
  // face
  const lit = .7 + .3 * Math.sin(t * 5) + b.glow; g.fillStyle = `rgba(255,${200 + 40 * Math.min(1, b.glow)},90,${Math.min(1, lit)})`; g.shadowColor = '#ffcc55'; g.shadowBlur = U * 12;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * w * .27, -h * .7); g.lineTo(s * w * .12, -h * .72); g.lineTo(s * w * .19, -h * .56); g.closePath(); g.fill(); }
  g.beginPath(); g.moveTo(-w * .3, -h * .42); g.quadraticCurveTo(0, -h * (.08 - b.glow * .1), w * .3, -h * .42); g.quadraticCurveTo(0, -h * .28, -w * .3, -h * .42); g.fill();
  g.shadowBlur = 0; g.restore();
}
