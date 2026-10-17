// EPISODE 02 — THE INVISIBLE BRAND   (30.0 s)
window.DUR = 30.0;
const SUBS = [
  { t0: 0.5, t1: 2.9, text: 'السوق زحمة… وكل براند بيزعق.' },
  { t0: 4.0, t1: 6.7, text: 'وفي النص… براند بينزّل Content كل يوم.' },
  { t0: 8.0, t1: 10.4, text: 'بس مفيش حد واخد باله منه.' },
  { t0: 11.5, t1: 13.5, text: 'لحظة… الاختلاف مش صدفة.' },
  { t0: 14.2, t1: 17.6, text: 'هوية واضحة… رسالة واحدة… واستمرار.' },
  { t0: 18.6, t1: 21.4, text: 'وفجأة… الناس بتشوفه وبتفتكره.' },
  { t0: 22.6, t1: 24.2, text: 'لو محدش فاكرك…', hide: true },
  { t0: 24.5, t1: 26.4, text: 'يبقى إنت فعلاً ظهرت؟', hide: true },
];
window.SUBS = SUBS;
const F = 900, HY = 880, BZ = 7200;      // focal length, horizon, brand-sign depth
const T_FREEZE = 11.0, T_FLIP = 12.7, T_TAKE = 22.5, T_END = 26.8;
const r0 = rng(21);
const TXT = ['الأفضل!', 'عرض!', 'جديد', 'الأقوى', 'خصم النهاردة', 'لا تفوّت', '#1', 'حصري', 'اشترِ دلوقتي', 'أقل سعر', 'تحدّي', 'الأصلي'];
const LOUD = [['#ff2d55', '#ff9500'], ['#ffd60a', '#ff453a'], ['#30d158', '#0a84ff'], ['#bf5af2', '#ff375f'], ['#ff9f0a', '#ffd60a'], ['#64d2ff', '#bf5af2'], ['#ff453a', '#ffffff']];
const SIGNS = [];
for (let i = 0; i < 150; i++) {
  const side = r0() < .5 ? -1 : 1, top = r0() < .22;
  SIGNS.push({ i, x: top ? (r0() - .5) * 1100 : side * (260 + r0() * 520), y: top ? -(520 + r0() * 380) : -(560 * r0() - 120), z0: 500 + (i / 150) * (BZ + 600) + (r0() - .5) * 120, w: 380 + r0() * 240, h: 260 + r0() * 200, kind: Math.floor(r0() * 5), col: LOUD[Math.floor(r0() * LOUD.length)], txt: TXT[Math.floor(r0() * TXT.length)], rot: (r0() - .5) * .16, ph: r0() * 6 });
}
// wall positions that the signs snap into around the brand sign
const WALL = []; for (const gy of [-330, 330]) for (const gx of [-1040, -520, 0, 520, 1040]) if (!(gy === 190 && gx === 0 && false)) WALL.push([gx, gy]);
WALL.splice(WALL.findIndex(w => w[0] === 0 && w[1] === -330), 1); // keep brand centred at (0,-60..)
const near = SIGNS.filter(s => s.z0 > BZ - 1800 && s.z0 < BZ - 150).slice(0, WALL.length);
near.forEach((s, k) => { s.wall = WALL[k]; s.rank = k; });
const PEOPLE = []; const pr = rng(9); for (let i = 0; i < 46; i++) PEOPLE.push({ x: (pr() - .5) * 900, z0: 400 + pr() * 6800, v: (pr() < .5 ? -1 : 1) * (60 + pr() * 90), ph: pr() * 6, gaze: (pr() - .5) * 2, hue: pr(), sz: .9 + pr() * .25 });
window.EVENTS = [{ t: 0.1, k: 'whoosh' }, { t: T_FREEZE, k: 'freeze' }, { t: T_FLIP, k: 'snap' }, { t: T_FLIP + .05, k: 'boom' }, { t: T_TAKE - .1, k: 'hit' }, { t: T_END, k: 'sting' }];
for (let i = 0; i < 12; i++) window.EVENTS.push({ t: 13.1 + i * .22, k: 'flip' });
[19.0, 19.9, 20.8].forEach(t => window.EVENTS.push({ t, k: 'chip' }));

function camZ(t) { return t < T_FREEZE ? 6000 * (1 - Math.pow(1 - seg(t, 0, T_FREEZE), 1.9)) : t < T_FLIP ? 6000 + 6 * (t - T_FREEZE) : 6000 + 560 * eio(seg(t, T_FLIP + .5, T_TAKE)); }
function camH(t) { return 330 + 160 * eio(seg(t, T_FLIP + 1, 18)); }  // camera rises → hero view
function cam(t) { return { z: camZ(t), y: -160 + 0 * t, hy: HY + 120 * eio(seg(t, T_FLIP + 1, 18)), fh: camH(t) }; }
function pj(X, Y, Z, c) { const z = Z - c.z; if (z < 70) return null; const s = F / z; return { x: 540 + X * s, y: c.hy + (Y - 0) * s, s, z }; }

function floor(t, c, post) {
  g.save(); const y0 = c.hy;
  const gr = g.createLinearGradient(0, y0, 0, H); gr.addColorStop(0, post ? 'rgba(13,95,179,.35)' : 'rgba(40,50,80,.5)'); gr.addColorStop(1, 'rgba(2,8,24,.95)'); g.fillStyle = gr; g.fillRect(0, y0, W, H - y0);
  g.strokeStyle = post ? 'rgba(0,251,252,.45)' : 'rgba(150,170,210,.18)'; g.lineWidth = 2;
  for (let k = -9; k <= 9; k++) { const p = pj(k * 180, c.fh, c.z + 3000, c), q = pj(k * 180, c.fh, c.z + 120, c); if (p && q) { g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); } }
  for (let z = 0; z < 8000; z += 260) { const zz = z - (c.z % 260) + c.z; const p = pj(-1800, c.fh, zz, c), q = pj(1800, c.fh, zz, c); if (p && q) { g.globalAlpha = clamp(1 - (zz - c.z) / 3500); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); } }
  g.restore();
}
function person(P, t, c, post) {
  const zz = P.z0 + (post ? 0 : P.v * t) ; const z = zz - c.z; if (z < 160 || z > 5200) return null;
  const s = F / z, fx = 540 + P.x * s, fy = c.hy + c.fh * s; return { s, fx, fy, z };
}
function drawPerson(P, t, c, p) {
  // p: 0 before / 1 after (crowd turns to the brand)
  const px = P.x * (1 - .35 * p); const zz = lerp(P.z0 + P.v * t, c.z + 700 + ((P.ph * 211) % 950), p); const z = zz - c.z;
  if (z < 420 || z > 5200) return; const s = F / z; const fx = 540 + px * s, fy = c.hy + c.fh * s; const hgt = 270 * P.sz * s, wd = 100 * P.sz * s;
  g.save(); g.translate(fx, fy); const step = Math.sin(t * 6 + P.ph) * .05;
  // body
  g.fillStyle = `hsl(${215 + P.hue * 30},40%,${14 + 24 * p}%)`; g.beginPath(); g.moveTo(-wd * .5, 0); g.lineTo(-wd * .38, -hgt * .62); g.quadraticCurveTo(0, -hgt * .78, wd * .38, -hgt * .62); g.lineTo(wd * .5, 0); g.closePath(); g.fill();
  // head
  g.beginPath(); g.arc(0, -hgt * .82, wd * .3, 0, 7); g.fill();
  g.strokeStyle = `rgba(0,251,252,${.25 + .65 * p})`; g.lineWidth = Math.max(1, 3 * s); g.beginPath(); g.arc(0, -hgt * .82, wd * .3, -2.4, -.7); g.stroke();
  // gaze: before = random sign/away, after = straight at the brand (centre/up)
  const gz = lerp(P.gaze * 1, -px * .004 * 0, p); const ex = lerp(P.gaze * wd * .2, 0, p), ey = lerp(0, -wd * .12, p);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-wd * .09 + ex, -hgt * .82 + ey, wd * .045, 0, 7); g.arc(wd * .09 + ex, -hgt * .82 + ey, wd * .045, 0, 7); g.fill();
  if (p > .5) { const k = seg(t, 18.4 + P.ph * .1, 19.0 + P.ph * .1); if (k > 0 && k < 1) { g.globalAlpha = Math.sin(k * Math.PI); star(0, -hgt * 1.05 - k * 30 * s * 3, wd * .22, C.cy); } }
  g.restore();
}
function star(x, y, r, col) { g.save(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 16; g.translate(x, y); g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rad = i % 2 ? r * .3 : r; g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath(); g.fill(); g.restore(); }

function loudSign(S, t, alpha = 1) {
  const { w, h } = S, a = S.col; g.save(); g.globalAlpha *= alpha;
  const gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gr.addColorStop(0, a[0]); gr.addColorStop(1, a[1]); g.fillStyle = gr;
  if (S.kind === 0) { g.beginPath(); for (let k = 0; k < 24; k++) { const an = k * Math.PI / 12, rad = (k % 2 ? .38 : .5) * Math.min(w, h * 1.3); g.lineTo(Math.cos(an) * rad * (w / h > 1.4 ? 1.25 : 1), Math.sin(an) * rad * .8); } g.closePath(); g.fill(); }
  else if (S.kind === 1) { rr(-w / 2, -h / 2, w, h, h / 2); g.fill(); g.lineWidth = 12; g.strokeStyle = '#fff'; rr(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32, h / 2 - 16); g.stroke(); }
  else if (S.kind === 2) { rr(-w / 2, -h / 2, w, h, 20); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; for (let k = -4; k < 6; k++) { g.save(); rr(-w / 2, -h / 2, w, h, 20); g.clip(); g.translate(k * 90 + (t * 40 % 90), 0); g.rotate(.5); g.fillRect(-20, -h, 40, h * 2); g.restore(); } }
  else if (S.kind === 3) { g.beginPath(); g.moveTo(0, -h / 2); g.lineTo(w / 2, h / 2); g.lineTo(-w / 2, h / 2); g.closePath(); g.fill(); }
  else { rr(-w / 2, -h / 2, w, h, 40); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); for (let x = -w / 2 + 30; x < w / 2 - 30; x += 8) { const y = Math.sin(x * .05 + t * 4 + S.ph) * 18 - h * .3; x === -w / 2 + 30 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
  T(S.txt, 0, S.kind === 3 ? h * .2 : 0, Math.min(86, w * .17), '#fff', { w: 900, stroke: 'rgba(0,0,0,.35)', sw: 12 }); g.restore();
}
function brandMark(x, y, r, col = '#00FBFC') { // original geometric mark
  g.save(); g.translate(x, y); g.fillStyle = col; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 6; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.fillStyle = '#081F3E'; g.beginPath(); g.arc(0, 0, r * .38, 0, 7); g.fill(); g.restore();
}
function identityTile(w, h, big = false) {
  const gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gr.addColorStop(0, '#0D5FB3'); gr.addColorStop(1, '#00c6ff'); g.fillStyle = gr; rr(-w / 2, -h / 2, w, h, 30); g.fill();
  g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.55)'; rr(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 20); g.stroke();
  brandMark(-w * .28, 0, h * .22); T('براندنا', w * .12, -h * .06, h * .26, '#fff', { w: 900 }); g.fillStyle = 'rgba(255,255,255,.8)'; rr(w * .12 - w * .2, h * .16, w * .4, h * .05, h * .025); g.fill();
}
function greySign(w, h, t, vis = 1) {
  g.save(); g.globalAlpha *= vis * (.7 + .3 * Math.sin(t * 5)); g.fillStyle = '#3b4658'; rr(-w / 2, -h / 2, w, h, 26); g.fill(); g.strokeStyle = '#566178'; g.lineWidth = 6; rr(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 16); g.stroke();
  g.strokeStyle = '#6b7690'; g.lineWidth = 8; g.beginPath(); g.arc(-w * .27, 0, h * .17, 0, 7); g.stroke(); T('براندنا', w * .1, 0, h * .24, '#76819a', { w: 700 }); g.restore();
}

function scene(t) {
  const c = cam(t), post = t > T_FLIP + .3, pf = eio(seg(t, T_FLIP + 2.5, T_FLIP + 5.5));
  // sky
  const sk = g.createLinearGradient(0, 0, 0, c.hy); sk.addColorStop(0, post ? '#06142e' : '#14173a'); sk.addColorStop(1, post ? '#0d3a78' : '#3a2a58'); g.fillStyle = sk; g.fillRect(0, 0, W, c.hy + 2);
  floor(t, c, post);
  const sh = shakeAt(t, t < T_FREEZE ? 5 + 7 * (1 - seg(t, 0, 3)) * 0 + 3 * Math.sin(t * .8) + 4 : 0);
  g.save(); g.translate(sh.sx, sh.sy); g.rotate(sh.rot);
  // collect signs
  const list = [];
  for (const S of SIGNS) {
    let z0 = S.z0, x = S.x, y = S.y, al = 1, flip = 0, sc = 1;
    if (S.wall) { const d = 12.9 + S.rank * .18, p = eio(seg(t, d, d + 1.3)); if (p > 0) { z0 = lerp(S.z0, BZ, p); x = lerp(S.x, S.wall[0], p); y = lerp(S.y, S.wall[1], p); flip = p; } }
    else { const d = 12.9 + (S.i % 10) * .1, p = eio(seg(t, d, d + 1.6)); if (p > 0) { z0 += p * 2500; al = 1 - p; sc = 1 - .4 * p; } }
    if (al <= .01) continue; const P = pj(x, y, z0, c); if (!P || P.s > 3.2 || P.s < .05) continue;
    list.push({ S, P, al, flip, sc });
  }
  list.sort((a, b) => b.P.z - a.P.z);
  const ident = [];
  for (const L of list) {
    const { S, P } = L; if (P.x < -1200 || P.x > W + 1200 || P.y < -1200 || P.y > H + 1200) continue;
    const fadeNear = clamp((P.z - 70) / 360);
    if (L.flip > .5) { ident.push(L); continue; }
    g.save(); g.translate(P.x, P.y); const sx = L.flip > 0 ? Math.abs(Math.cos(Math.PI * L.flip)) : 1; g.scale(P.s * L.sc * sx, P.s * L.sc); g.rotate(S.rot);
    loudSign(S, t, L.al * fadeNear); g.restore();
  }
  // crowd
  const pp = eio(seg(t, 15.5, 18.5));
  if (pp < .01) PEOPLE.slice().sort((a, b) => (b.z0 + b.v * t) - (a.z0 + a.v * t)).forEach(P => drawPerson(P, t, c, pp));
  g.restore();
  // desaturate everything noisy once the story turns
  const ds = eio(seg(t, T_FREEZE - .2, T_FREEZE + .5)); const dsAfter = ds * (post ? .92 : 1);
  if (ds > 0) { g.save(); g.globalCompositeOperation = 'saturation'; g.fillStyle = `rgba(128,128,128,${dsAfter})`; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(2,8,24,${.35 * ds})`; g.fillRect(0, 0, W, H); g.restore(); }
  // identity tiles + brand sign (drawn after desaturation so they stay in colour)
  g.save(); g.translate(sh.sx, sh.sy);
  for (const L of ident) { const P = L.P; g.save(); g.translate(P.x, P.y); const sx = Math.abs(Math.cos(Math.PI * L.flip)); g.scale(P.s * sx, P.s); g.globalAlpha = .96; identityTile(L.S.w, L.S.h); g.restore(); }
  const bp = pj(0, -60, BZ, c);
  if (bp) {
    const fp = seg(t, T_FLIP, T_FLIP + 1.0), ew = lerp(460, 560, fp), eh = lerp(300, 360, fp);
    g.save(); g.translate(bp.x, bp.y);
    if (fp > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = .55 * eo(fp); glowCircle(0, 0, 900 * bp.s, 'rgba(0,251,252,A)'); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    g.scale(bp.s, bp.s);
    if (fp < .5) greySign(460, 300, t, 1); else { const sx = Math.abs(Math.cos(Math.PI * fp)); g.scale(sx, 1); }
    if (fp >= .5) { g.shadowColor = '#00FBFC'; g.shadowBlur = 50; identityTile(ew, eh, true); }
    g.restore();
    // call-out before the turn
    if (t > 8.3 && t < T_FREEZE + .6) { const p = eo(seg(t, 8.3, 8.8)) * (1 - seg(t, T_FREEZE + .2, T_FREEZE + .6)); g.save(); g.globalAlpha = p; g.strokeStyle = C.yl; g.lineWidth = 6; g.setLineDash([16, 12]); g.beginPath(); g.arc(bp.x, bp.y, 260 * bp.s + 30 + Math.sin(t * 6) * 6, 0, 7); g.stroke(); g.setLineDash([]); T('ده براندنا…', bp.x, bp.y - 300 * bp.s - 90, 64, C.yl, { w: 900, stroke: 'rgba(2,8,24,.85)', sw: 14 }); g.restore(); }
    // crowd gathers in front of the identity wall (drawn last so it stays visible)
    if (pp > .01) PEOPLE.slice().sort((a, b) => b.ph - a.ph).forEach(P => drawPerson(P, t, c, pp));
    // shock ring on the turn
    const rp = seg(t, T_FLIP, T_FLIP + 1.1); if (rp > 0 && rp < 1) { g.save(); g.globalAlpha = (1 - rp) * .9; g.strokeStyle = C.cy; g.lineWidth = 14 * (1 - rp) + 2; g.beginPath(); g.arc(bp.x, bp.y, 80 + rp * 1300, 0, 7); g.stroke(); g.restore(); }
  }
  g.restore();
}

function chips(t) {
  const words = ['مميّز', 'ثابت', 'واضح'], t0 = [19.0, 19.9, 20.8];
  words.forEach((w, i) => { const p = seg(t, t0[i], t0[i] + .35); if (p <= 0 || t > 22.3) return; const out = 1 - seg(t, 22.0, 22.3); g.save(); g.globalAlpha = clamp(p * 3) * out; g.translate(540, 360 + i * 120); const s = .6 + .4 * back(p); g.scale(s, s);
    g.fillStyle = 'rgba(2,8,24,.82)'; rr(-230, -50, 460, 100, 50); g.fill(); g.lineWidth = 4; g.strokeStyle = C.cy; g.stroke(); T(w, 0, 4, 62, '#fff', { w: 900, glow: C.cy, gb: 22 }); g.restore(); });
}
function title(t, t0, t1, txt, y = 520, sz = 78, col = '#fff') {
  if (t < t0 || t > t1) return; const p = eo(seg(t, t0, t0 + .3)), o = 1 - seg(t, t1 - .25, t1);
  g.save(); g.globalAlpha = p * o; T(txt, 540, y + (1 - p) * 30, sz, col, { w: 900, stroke: 'rgba(2,8,24,.9)', sw: 16, glow: 'rgba(0,251,252,.35)', gb: 26 }); g.restore();
}
function mascotCameo(t) {
  const t0 = T_FREEZE + .3, t1 = 15.4; if (t < t0 || t > t1) return;
  const pin = eo(seg(t, t0, t0 + .5)), pout = eo(seg(t, t1 - .6, t1)); const pose = t < T_FLIP ? 'think' : 'hips';
  const x = lerp(-300, 330, pin) + pout * 700, hop = t >= T_FLIP && t < T_FLIP + .5 ? Math.abs(Math.sin((t - T_FLIP) * 12)) * 80 * Math.exp(-(t - T_FLIP) * 3) : 0;
  mascot(pose, x, 1590, 430, { ...idle(t * .8, .5), lift: hop });
}
window.draw = (t, fi) => {
  const LOOP = .55;
  const render = tt => {
    if (tt >= T_END) { endCard(tt, T_END + .05, 'خلّي براندك يتفكّر.', { sub: 'التميّز بيبني الذكرى… مش بيضمن المبيعات لوحده' }); return; }
    scene(tt);
    title(tt, 0.25, 2.4, 'السوق زحمة', 560, 96); title(tt, 4.0, 6.7, 'بينزّل Content… ومفيش حد شايفه', 540, 62, '#cfe0f5');
    chips(tt);
    if (tt >= T_TAKE) { const p = eo(seg(tt, T_TAKE, T_TAKE + .4)); g.fillStyle = `rgba(2,8,24,${.3 * p})`; g.fillRect(0, 0, W, H); }
    title(tt, T_TAKE + .1, T_END - .2, tt < 24.4 ? 'لو محدش فاكرك…' : 'يبقى إنت فعلاً ظهرت؟', 430, 92, tt < 24.4 ? '#fff' : C.cy);
    mascotCameo(tt);
    if (tt < 2.6) badgeEp('02', 'The Invisible Brand', tt, 1);
    post(tt, fi, { vig: .6, flash: Math.abs(tt - T_FLIP) < .06 ? .55 : 0 });
  };
  render(t);
  if (t > DUR - LOOP) { const a = eo((t - (DUR - LOOP)) / LOOP); g.save(); g.globalAlpha = a; g.save(); scene(0); title(0, -1, 0, ''); g.restore(); title(.3, .25, 2.4, 'السوق زحمة', 560, 96); g.restore(); }
  subtitle(SUBS, t);
};
