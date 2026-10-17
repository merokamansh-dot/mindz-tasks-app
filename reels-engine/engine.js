// MINDz Reels Series — shared canvas engine (deterministic: draw(t) is a pure function of t)
const W = 1080, H = 1920;
const cv = document.getElementById('c'), g = cv.getContext('2d');
const C = { bg0: '#020818', bg1: '#081F3E', bg2: '#0d3a78', blue: '#0D5FB3', cy: '#00FBFC', yl: '#FCFF59', white: '#ffffff', ice: '#cfe0f5' };
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, p) => a + (b - a) * p;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = p => 1 - Math.pow(1 - p, 3);
const ei = p => p * p * p;
const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const back = p => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const elastic = p => p <= 0 ? 0 : p >= 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * (2 * Math.PI) / 3) + 1;
function rng(seed) { let s = (seed * 2654435761) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const hash = n => { const r = rng(n + 7); r(); return r(); };

const IM = {};
window.READY = false;
async function loadAll(list) {
  await document.fonts.load('900 60px CairoBrand'); await document.fonts.load('600 60px CairoBrand');
  await Promise.all(list.map(([k, src]) => new Promise(res => { const i = new Image(); i.onload = () => { IM[k] = i; res(); }; i.onerror = () => { console.log('ERR img', src); res(); }; i.src = src; })));
  window.READY = true;
}
const ASSETS = [['hips', 'assets/mas_hips.png'], ['wave', 'assets/mas_wave.png'], ['think', 'assets/mas_think.png'], ['cheer', 'assets/mas_cheer.png'], ['hipsHD', 'assets/mas_hipsHD.png'], ['logo', 'assets/logo.png']];

// ---------- primitives ----------
function rr(x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function T(str, x, y, size, col = '#fff', o = {}) {
  g.save(); g.font = `${o.w || 800} ${size}px CairoBrand`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle'; g.direction = o.dir || 'rtl';
  if (o.alpha != null) g.globalAlpha *= o.alpha;
  if (o.rot) { g.translate(x, y); g.rotate(o.rot); x = 0; y = 0; }
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.gb || 30; }
  if (o.stroke) { g.lineWidth = o.sw || 8; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(str, x, y); }
  g.fillStyle = col; g.fillText(str, x, y); g.restore();
}
function tw(str, size, w = 800) { g.save(); g.font = `${w} ${size}px CairoBrand`; const m = g.measureText(str).width; g.restore(); return m; }
function glowCircle(x, y, r, col, a = 1) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }

// ---------- backgrounds ----------
function bgNavy(mood = 0, t = 0) {
  const gr = g.createRadialGradient(540, 420, 60, 540, 600, 1500);
  gr.addColorStop(0, mix('#0d3a78', '#3a1230', mood)); gr.addColorStop(.5, mix('#081F3E', '#14061a', mood)); gr.addColorStop(1, '#020818');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
}
function mix(a, b, p) { const pa = hex(a), pb = hex(b); return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], p))).join(',')})`; }
function hex(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
function beam(x0, x1, y1, a = .18, spread = 1) {
  const gr = g.createLinearGradient(0, 0, 0, y1); gr.addColorStop(0, `rgba(219,231,244,${a})`); gr.addColorStop(1, 'rgba(219,231,244,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - 60, 0); g.lineTo(x0 + 60, 0); g.lineTo(x1 + 420 * spread, y1); g.lineTo(x1 - 420 * spread, y1); g.closePath(); g.fill();
}
function floorLine(y, a = 1) {
  g.save(); g.globalAlpha *= a;
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, 'rgba(0,251,252,0)'); gr.addColorStop(.2, '#00FBFC'); gr.addColorStop(.8, '#00FBFC'); gr.addColorStop(1, 'rgba(0,251,252,0)');
  g.shadowColor = '#00FBFC'; g.shadowBlur = 26; g.fillStyle = gr; g.fillRect(0, y, W, 4);
  g.shadowBlur = 0; const gg = g.createRadialGradient(540, y + 2, 0, 540, y + 2, 700); gg.addColorStop(0, 'rgba(0,251,252,.22)'); gg.addColorStop(1, 'rgba(0,251,252,0)');
  g.fillStyle = gg; g.save(); g.scale(1, .32); g.translate(0, (y + 2) / .32 - (y + 2)); g.beginPath(); g.arc(540, y + 2, 700, 0, 7); g.fill(); g.restore(); g.restore();
}
function dust(t, n = 40, seed = 3, a = .5) {
  const r = rng(seed); g.save();
  for (let i = 0; i < n; i++) {
    const x0 = r() * W, y0 = r() * H, sp = 8 + r() * 22, ph = r() * 7, sz = 1.5 + r() * 3.5;
    const x = (x0 + Math.sin(t * .6 + ph) * 30 + t * sp * .4) % W, y = ((y0 - t * sp) % H + H) % H;
    g.globalAlpha = a * (.25 + .75 * (Math.sin(t * 1.3 + ph) * .5 + .5)); g.fillStyle = '#cfe9ff'; g.beginPath(); g.arc(x, y, sz, 0, 7); g.fill();
  } g.restore();
}

// ---------- mascot ----------
function mascot(pose, x, yFeet, h, o = {}) {
  const img = IM[pose]; if (!img) return;
  const base = pose === 'hipsHD' ? 493 * (img.height / (img.height)) : 493; // consistent body scale across poses
  const sc = (pose === 'hipsHD' ? h / img.height * 1.0 : h / 493);
  const w = img.width * sc, hh = img.height * sc;
  const sx = (o.sx || 1) * (o.flip ? -1 : 1), sy = o.sy || 1;
  g.save(); g.globalAlpha *= (o.alpha == null ? 1 : o.alpha);
  if (!o.noShadow) { g.save(); g.globalAlpha *= .55 * (o.shadowA == null ? 1 : o.shadowA); g.fillStyle = '#000'; g.beginPath(); g.ellipse(x, yFeet + 8, w * .42 * (1 - Math.min(.3, (o.lift || 0) / 600)), 18, 0, 0, 7); g.fill(); g.restore(); }
  g.translate(x, yFeet - (o.lift || 0)); g.rotate(o.rot || 0); g.scale(sx, sy);
  if (o.glow !== 0) { g.shadowColor = 'rgba(0,251,252,.35)'; g.shadowBlur = o.glow || 40; }
  g.drawImage(img, -w / 2, -hh, w, hh); g.restore();
}
// idle bob + react helper
function idle(t, amp = 1, speed = 6) { const ph = t * speed; return { lift: Math.abs(Math.sin(ph)) * 14 * amp, sy: 1 - Math.abs(Math.sin(ph)) * .03 * amp + .015, rot: Math.sin(t * 3) * .02 * amp }; }

// ---------- UI parts ----------
const PAL = [['#0D5FB3', '#00c6ff'], ['#081F3E', '#0D5FB3'], ['#ffffff', '#cfe0f5'], ['#FCFF59', '#f4c430'], ['#1a1a3e', '#4a3a8e'], ['#00FBFC', '#0D5FB3'], ['#e8f1fb', '#9fc0e6']];
function designTile(x, y, w, h, seed, o = {}) {
  const r = rng(seed * 13 + 5), p = PAL[Math.floor(r() * PAL.length)];
  g.save(); g.translate(x, y);
  // bezel
  g.fillStyle = '#0a1224'; rr(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16, 14); g.fill();
  g.save(); rr(-w / 2, -h / 2, w, h, 8); g.clip();
  const gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gr.addColorStop(0, p[0]); gr.addColorStop(1, p[1]); g.fillStyle = gr; g.fillRect(-w / 2, -h / 2, w, h);
  const dark = p[0] === '#ffffff' || p[0] === '#e8f1fb' || p[0] === '#FCFF59';
  const ink = dark ? 'rgba(8,31,62,.88)' : 'rgba(255,255,255,.9)';
  const k = o.shift || 0; // "small change" offset
  // circle
  g.fillStyle = dark ? 'rgba(13,95,179,.85)' : 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(-w * .22 + k, -h * .02, h * .24, 0, 7); g.fill();
  // headline bars
  g.fillStyle = ink; rr(w * .02, -h * .22, w * .34, h * .09, 5); g.fill(); rr(w * .02, -h * .06, w * .26, h * .06, 5); g.fill();
  g.globalAlpha *= .55; rr(w * .02, h * .06, w * .30, h * .045, 4); g.fill(); g.globalAlpha /= .55;
  // button
  g.fillStyle = dark ? '#0D5FB3' : '#00FBFC'; rr(w * .02, h * .2, w * .17, h * .1, h * .05); g.fill();
  g.restore();
  if (o.badge) { g.fillStyle = '#FCFF59'; g.beginPath(); g.arc(w / 2 - 6, -h / 2 + 6, Math.max(14, h * .09), 0, 7); g.fill(); T(String(o.badge), w / 2 - 6, -h / 2 + 8, Math.max(16, h * .1), '#081F3E', { w: 900, dir: 'ltr' }); }
  g.restore();
}
function sticky(x, y, rot, txt, col = '#FCFF59', sz = 54, alpha = 1) {
  g.save(); g.globalAlpha *= alpha; g.translate(x, y); g.rotate(rot);
  const w = Math.max(260, tw(txt, sz, 800) + 70), h = sz * 2.3;
  g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 24; g.shadowOffsetY = 12; g.fillStyle = col; rr(-w / 2, -h / 2, w, h, 6); g.fill(); g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(-w / 2, h / 2 - 16, w, 16);
  T(txt, 0, 2, sz, '#081F3E', { w: 800 }); g.restore();
}
function bubble(x, y, txt, o = {}) { // chat bubble, anchored by centre
  const sz = o.sz || 52, side = o.side || 'l', pad = 44, w = Math.max(160, tw(txt, sz, 700) + pad * 2), h = sz * 1.9;
  const p = o.p == null ? 1 : o.p; if (p <= 0) return;
  g.save(); g.globalAlpha *= clamp(p * 3); g.translate(x, y); const s = .6 + .4 * back(p); g.scale(s, s);
  g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
  g.fillStyle = o.col || '#ffffff'; rr(-w / 2, -h / 2, w, h, h / 2.2); g.fill();
  g.shadowBlur = 0; g.shadowOffsetY = 0;
  g.beginPath(); if (side === 'l') { g.moveTo(-w / 2 + 30, h / 2 - 4); g.lineTo(-w / 2 - 6, h / 2 + 30); g.lineTo(-w / 2 + 70, h / 2 - 4); } else { g.moveTo(w / 2 - 30, h / 2 - 4); g.lineTo(w / 2 + 6, h / 2 + 30); g.lineTo(w / 2 - 70, h / 2 - 4); } g.fill();
  T(txt, 0, 4, sz, o.ink || '#081F3E', { w: 700 }); g.restore();
  return { w, h };
}
function typingDots(x, y, t, p = 1) {
  g.save(); g.globalAlpha *= clamp(p * 4); g.translate(x, y); g.fillStyle = '#fff'; rr(-90, -42, 180, 84, 42); g.fill();
  for (let i = 0; i < 3; i++) { g.fillStyle = '#081F3E'; g.globalAlpha *= 1; g.beginPath(); g.arc(-40 + i * 40, 0 - Math.abs(Math.sin(t * 7 - i * .8)) * 12, 11, 0, 7); g.fill(); }
  g.restore();
}
function avatar(x, y, r, letter, col = '#0D5FB3') { g.save(); g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = '#cfe0f5'; g.stroke(); T(letter, x, y + 3, r * 1.1, '#fff', { w: 900 }); g.restore(); }

// ---------- camera / post ----------
function camBegin(o = {}) {
  const z = o.z || 1, cx = o.cx == null ? W / 2 : o.cx, cy = o.cy == null ? H / 2 : o.cy;
  g.save(); g.translate(W / 2 + (o.sx || 0), H / 2 + (o.sy || 0)); g.rotate(o.rot || 0); g.scale(z, z); g.translate(-cx, -cy);
}
function camEnd() { g.restore(); }
function shakeAt(t, amp, f = 38) { return { sx: (Math.sin(t * f) + Math.sin(t * f * 1.7 + 1)) * .5 * amp, sy: (Math.cos(t * f * 1.3) + Math.sin(t * f * .9 + 2)) * .5 * amp, rot: Math.sin(t * f * .7) * amp * .0004 }; }
function post(t, fi, o = {}) {
  // vignette
  const v = g.createRadialGradient(540, 960, 520, 540, 960, 1250); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,3,12,${o.vig == null ? .62 : o.vig})`);
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  // top/bottom cinematic blue grade
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(13,95,179,.10)'); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,251,252,.05)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // grain
  const r = rng(fi * 31 + 11); g.save(); g.globalAlpha = .06; for (let i = 0; i < 260; i++) { g.fillStyle = r() > .5 ? '#fff' : '#000'; g.fillRect(r() * W, r() * H, 2 + r() * 2, 2 + r() * 2); } g.restore();
  if (o.flash) { g.fillStyle = `rgba(255,255,255,${o.flash})`; g.fillRect(0, 0, W, H); }
}
function subtitle(subs, t) {
  const s = subs.find(s => t >= s.t0 && t < s.t1); if (!s || s.hide) return;
  const p = clamp(Math.min((t - s.t0) / .12, (s.t1 - t) / .1));
  const sz = 62, w = Math.min(980, tw(s.text, sz, 800) + 90), y = 1385;
  g.save(); g.globalAlpha *= p; g.fillStyle = 'rgba(2,8,24,.78)'; rr(540 - w / 2, y - 62, w, 124, 34); g.fill();
  g.lineWidth = 2; g.strokeStyle = 'rgba(0,251,252,.35)'; g.stroke(); T(s.text, 540, y + 4, sz, '#fff', { w: 800 }); g.restore();
}
function endCard(t, t0, line, opt = {}) {
  const p = seg(t, t0, t0 + .5), q = seg(t, t0 + .3, t0 + .9);
  bgNavy(0, t); beam(540, 540, 1500, .2); floorLine(1500, 1);
  g.save(); g.globalAlpha = eo(p); const lh = 330, lw = lh * 694 / 700; const bob = Math.sin(t * 2) * 5;
  g.shadowColor = 'rgba(0,251,252,.45)'; g.shadowBlur = 60; g.drawImage(IM.logo, 540 - lw / 2, 520 + bob - (1 - eo(p)) * 40, lw, lh); g.restore();
  const lw0 = tw(line, 76, 900), fs = lw0 > 960 ? 76 * 960 / lw0 : 76;
  g.save(); g.globalAlpha = eo(q); T(line, 540, 1010 + (1 - eo(q)) * 30, fs, '#fff', { w: 900, glow: 'rgba(0,251,252,.4)', gb: 30 });
  if (opt.sub) T(opt.sub, 540, 1120, 46, '#9fc0e6', { w: 700 });
  T('mindz-agency.com', 540, 1250, 46, '#cfe0f5', { w: 600, dir: 'ltr' }); T('info@mindz-agency.com', 540, 1315, 40, '#9fc0e6', { w: 600, dir: 'ltr' }); g.restore();
  dust(t, 30, 9, .5);
}
function badgeEp(n, title, t, a = 1) { // episode tag, kept inside safe area
  g.save(); g.globalAlpha *= a; g.fillStyle = 'rgba(13,95,179,.4)'; rr(70, 255, 330, 62, 31); g.fill(); g.strokeStyle = 'rgba(120,170,230,.6)'; g.lineWidth = 2; g.stroke();
  T(`EP ${n} · ${title}`, 235, 287, 30, '#cfe0f5', { w: 700, dir: 'ltr' }); g.restore();
}

// render entry
window.RENDER = (t, fi) => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0; g.clearRect(0, 0, W, H); window.draw(t, fi); };
