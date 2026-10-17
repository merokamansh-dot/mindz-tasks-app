// MINDz Reels — "Measure Twice. Build Once." (extended, 128 bpm, client logos from real footage)
const KN = [[1, 860, 665], [20, 790, 690], [40, 630, 615], [60, 445, 565], [72, 400, 560]]; // privacy blur track on the kneel shot
const S = id => SCN.find(s => s.id === id);
const MK = ['mk1', 'mk2', 'mk3', 'mk4', 'mk5', 'mk6', 'mk7', 'mk8'], MW = ['MARK.', 'WIRE.', 'WRAP.', 'LIFT.', 'FIT.', 'LIGHT.', 'LOCK.', 'DONE.'];
const MA = S('mk1').a, MB = S('mk8').b, VA = S('void').a, VB = S('void').b;
window.SECT = { mont: MA, void: VA, drop: VB, end: END };
const FR = {};
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => { console.log('ERR frame', src); r(null); }; i.src = src; });
const key = (id, a, t, n) => { const k = Math.min(n, Math.max(0, Math.floor((t - a) * 30 + 1e-6))) + 1; return id + '/' + String(k).padStart(4, '0'); };
const sceneAt = t => SCN.find(s => t >= s.a && t < s.b) || null;
function needKeys(t) {
  const out = ['wire/0001'], s = sceneAt(t); if (!s) return out;
  if (s.type === 'full' || s.type === 'card') out.push(key(s.id, s.a, t, s.n - 1));
  if (s.type === 'stack') { out.push(key('stk1', s.a, t, s.n - 1)); out.push(key('stk2', s.a, t, s.n - 1)); }
  return out;
}
window.PRE = async t => { const nk = needKeys(t); for (const k of nk) if (!FR[k]) FR[k] = await loadImg('frames/' + k + '.jpg'); const ks = Object.keys(FR); if (ks.length > 14) for (const k of ks.slice(0, ks.length - 8)) if (!nk.includes(k)) delete FR[k]; };
const NAVY = 'rgba(2,8,24,';
function scrim(a = .72) {
  let gr = g.createLinearGradient(0, 0, 0, 760); gr.addColorStop(0, NAVY + a + ')'); gr.addColorStop(1, NAVY + '0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 760);
  gr = g.createLinearGradient(0, 1150, 0, 1750); gr.addColorStop(0, NAVY + '0)'); gr.addColorStop(1, NAVY + a + ')'); g.fillStyle = gr; g.fillRect(0, 1150, W, 600);
}
function big(txt, t, t0, t1, x, y, size, col = '#fff', o = {}) {
  const p = seg(t, t0, t0 + .2); if (p <= 0 || t > t1) return; const s = lerp(1.4, 1, eo(p)), fit = Math.min(1, 960 / tw(txt, size, 900));
  g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha *= eo(seg(t, t0, t0 + .07)) * (1 - seg(t, t1 - .1, t1));
  T(txt, 0, 0, size * fit, col, { dir: 'ltr', w: 900, stroke: NAVY + '.92)', sw: size * .17, glow: o.glow || 'rgba(0,0,0,.6)', gb: 26 }); g.restore();
}
function tag(txt, t, t0, t1, y = 1385, sz = 50) {
  const p = Math.min(seg(t, t0, t0 + .15), 1 - seg(t, t1 - .12, t1)); if (p <= 0) return; const w = Math.min(1000, tw(txt, sz, 800) + 90);
  g.save(); g.globalAlpha *= p; g.fillStyle = 'rgba(2,8,24,.82)'; rr(540 - w / 2, y - 55, w, 110, 32); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(0,251,252,.45)'; g.stroke();
  T(txt, 540, y + 3, sz, '#fff', { dir: 'ltr', w: 800 }); g.restore();
}
function chip(t) {
  const p = eo(seg(t, .15, .5)) * (1 - seg(t, END - .3, END)); if (p <= 0) return; g.save(); g.globalAlpha *= p; g.fillStyle = 'rgba(13,95,179,.45)'; rr(70, 255, 450, 62, 31); g.fill(); g.strokeStyle = 'rgba(120,170,230,.6)'; g.lineWidth = 2; g.stroke();
  const bp = (t / BEAT) % 1; g.fillStyle = '#00FBFC'; g.beginPath(); g.arc(106, 286, 8 + 4 * Math.exp(-bp * 6), 0, 7); g.fill();
  T('MINDz  ·  BEHIND THE SCENES', 306, 287, 27, '#cfe0f5', { w: 800, dir: 'ltr' }); g.restore();
}
const pulse = t => Math.exp(-(((t / BEAT) % 1)) * 7);
const bar = t => Math.floor(t / BEAT) % 4 === 0 ? pulse(t) : 0;
function cutPunch(s, t) { const lt = t - s.a; return { z: 1 + .06 * (1 - eo(seg(lt, 0, .14))), fl: .2 * (1 - seg(lt, 0, .1)) }; }
function drawFull(s, t) {
  const img = FR[key(s.id, s.a, t, s.n - 1)]; const p = seg(t, s.a, s.b), cp = cutPunch(s, t), zz = s.id.startsWith('mk') ? [1, 1.05] : [1, 1.07];
  g.fillStyle = '#020818'; g.fillRect(0, 0, W, H);
  if (img) {
    camBegin({ z: lerp(zz[0], zz[1], p) * cp.z * (1 + .014 * pulse(t)) }); g.drawImage(img, 0, 0, W, H);
    if (s.id === 'kneel') { const fk = Math.min(72, Math.max(1, Math.floor((t - s.a) * 30) + 1)); let i = 0; while (i < KN.length - 2 && fk > KN[i + 1][0]) i++; const A = KN[i], Bn = KN[i + 1], q = clamp((fk - A[0]) / (Bn[0] - A[0])), x = lerp(A[1], Bn[1], q), y = lerp(A[2], Bn[2], q);
      for (let r = 0; r < 2; r++) { g.save(); g.beginPath(); g.ellipse(x, y, r ? 100 : 125, r ? 125 : 150, 0, 0, 7); g.clip(); g.filter = r ? 'blur(30px)' : 'blur(16px)'; g.drawImage(img, 0, 0, W, H); g.restore(); } g.filter = 'none'; }
    camEnd();
  }
  const fl = cp.fl + .06 * bar(t); if (fl > 0) { g.fillStyle = `rgba(255,255,255,${fl})`; g.fillRect(0, 0, W, H); }
}
function drawStack(s, t) {
  bgNavy(0, t); beam(540, 540, 1500, .14); const p = seg(t, s.a, s.b), cp = cutPunch(s, t);
  [{ k: 'stk1', y: 440, lab: 'CHECK' }, { k: 'stk2', y: 968, lab: 'MARK' }].forEach((q, i) => {
    const img = FR[key(q.k, s.a, t, s.n - 1)]; const sl = eo(seg(t, s.a + i * .08, s.a + .3 + i * .08)); g.save(); g.globalAlpha *= sl;
    g.translate((i ? 1 : -1) * (1 - sl) * 220, 0); rr(90, q.y, 900, 506, 26); g.save(); g.clip();
    if (img) { g.translate(540, q.y + 253); const z = lerp(1, 1.07, p) * (1 + .012 * pulse(t)); g.scale(z, z); g.drawImage(img, -450, -253, 900, 506); } g.restore();
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,251,252,.65)'; rr(90, q.y, 900, 506, 26); g.stroke();
    g.fillStyle = 'rgba(2,8,24,.82)'; rr(118, q.y + 24, 170, 54, 27); g.fill(); T(q.lab, 203, q.y + 52, 28, '#00FBFC', { dir: 'ltr', w: 900 }); g.restore();
  });
  floorLine(1500, 1); if (cp.fl > 0) { g.fillStyle = `rgba(255,255,255,${cp.fl})`; g.fillRect(0, 0, W, H); }
}
function drawCard(s, t) {
  bgNavy(0, t); beam(540, 540, 1500, .18); const p = seg(t, s.a, s.b), cp = cutPunch(s, t), sl = eo(seg(t, s.a, s.a + .3));
  const img = FR[key(s.id, s.a, t, s.n - 1)]; g.save(); g.globalAlpha *= sl; const y0 = 690, x0 = 60, w = 960, h = 540;
  g.shadowColor = 'rgba(0,251,252,.4)'; g.shadowBlur = 50; g.fillStyle = '#000'; rr(x0, y0, w, h, 28); g.fill(); g.shadowBlur = 0; g.save(); rr(x0, y0, w, h, 28); g.clip();
  if (img) { g.translate(540, y0 + h / 2); const z = lerp(1, 1.06, p) * (1 + .01 * pulse(t)); g.scale(z, z); g.drawImage(img, -w / 2, -h / 2, w, h); } g.restore();
  g.lineWidth = 3; g.strokeStyle = 'rgba(0,251,252,.7)'; rr(x0, y0, w, h, 28); g.stroke(); g.restore(); floorLine(1500, 1);
  if (cp.fl > 0) { g.fillStyle = `rgba(255,255,255,${cp.fl})`; g.fillRect(0, 0, W, H); }
}
function drawVoid(s, t) {
  bgNavy(0, t); beam(540, 540, 1500, .2); floorLine(1500, 1);
  const L1 = 'THEN THE DOORS', L2 = 'OPEN.'; const n = Math.floor(seg(t, s.a + .04, s.a + .5) * (L1.length + L2.length)); const a = L1.slice(0, n), b = L2.slice(0, Math.max(0, n - L1.length));
  T(a, 540, 860, 92, '#fff', { dir: 'ltr', w: 900, glow: 'rgba(0,251,252,.35)', gb: 24 }); T(b, 540, 990, 118, '#00FBFC', { dir: 'ltr', w: 900, glow: 'rgba(0,251,252,.6)', gb: 34 }); dust(t, 26, 5, .5);
}
function hud(t) {
  if (t < MA - .05 || t >= MB) return; const p = seg(t, MA, MB);
  g.save(); T('INSTALLATION', 90, 1300, 30, '#cfe0f5', { dir: 'ltr', w: 800, align: 'left' });
  g.fillStyle = 'rgba(2,8,24,.7)'; rr(90, 1330, 900, 18, 9); g.fill(); g.strokeStyle = 'rgba(0,251,252,.4)'; g.lineWidth = 2; g.stroke();
  g.shadowColor = '#00FBFC'; g.shadowBlur = 18; g.fillStyle = '#00FBFC'; rr(90, 1330, Math.max(18, 900 * p), 18, 9); g.fill(); g.shadowBlur = 0;
  g.fillStyle = 'rgba(2,8,24,.9)'; for (let i = 1; i < 8; i++) g.fillRect(90 + 900 * i / 8 - 2, 1326, 4, 26); g.restore();
}
const A = id => S(id).a, Bz = id => S(id).b, Q = BEAT, CY = { glow: 'rgba(0,251,252,.5)' };
function copy(t) {
  big('NOBODY CLAPS', t, A('wire') + .1, Bz('wire'), 540, 410, 124); big('FOR THIS.', t, A('wire') + 2 * Q, Bz('wire'), 540, 550, 138, '#00FBFC', CY); tag('Wiring. Behind a wall. Done right.', t, A('wire') + 3 * Q, Bz('wire'));
  big('TWO PEOPLE.', t, A('arch') + .08, Bz('arch2'), 540, 410, 124); big('ONE ARCH.', t, A('arch2') + .05, Bz('arch2'), 540, 550, 138, '#00FBFC', CY);
  big('MEASURE TWICE.', t, A('stk') + .1, Bz('stk'), 540, 372, 94);
  big('BUILD ONCE.', t, A('kneel') + .08, Bz('kneel'), 540, 410, 140, '#00FBFC', CY); tag('Built to carry the show.', t, A('kneel') + 2 * Q, Bz('kneel'));
  big('PRINT. WRAP.', t, A('wrap') + .08, Bz('wrap'), 540, 410, 124); big('PERFECT.', t, A('wrap') + 2 * Q, Bz('wrap'), 540, 550, 140, '#00FBFC', CY); tag('Nexicure & Vonseca stand', t, A('wrap') + 3 * Q, Bz('wrap'));
  big('EVERY LOGO', t, A('banner') + .08, Bz('banner'), 540, 410, 124); big('ON THE LINE.', t, A('banner') + Q, Bz('banner'), 540, 550, 130, '#00FBFC', CY);
  big('EVERY CURVE', t, A('curve') + .08, Bz('curve'), 540, 410, 124); big('MEASURED.', t, A('curve') + Q, Bz('curve'), 540, 550, 140, '#00FBFC', CY);
  big('SCREENS.', t, A('ladder') + .05, Bz('ladder'), 540, 400, 124); big('SIGNS.', t, A('ladder') + Q, Bz('ladder'), 540, 540, 124); big('LIGHTS.', t, A('ladder') + 2 * Q, Bz('ladder'), 540, 680, 136, '#00FBFC', CY);
  MK.forEach((id, i) => big(MW[i], t, A(id) + .02, Bz(id), 540, 1110, 200, i % 2 ? '#fff' : '#00FBFC', CY)); hud(t);
  big('YOU SEE', t, A('r1') + .1, Bz('r2'), 540, 400, 118); big('THE RESULT.', t, A('r1') + Q, Bz('r2'), 540, 540, 126, '#00FBFC', CY);
  tag('J&J · HIO Psychiatrists Forum', t, A('r1') + 2.5 * Q, Bz('r5') - .05);
  big('WE BUILD', t, A('r5') + .1, Bz('r5'), 540, 380, 118); big('EVERYTHING', t, A('r5') + 2 * Q, Bz('r5'), 540, 520, 118); big('BEFORE IT.', t, A('r5') + 3.5 * Q, Bz('r5'), 540, 665, 140, '#00FBFC', CY);
  tag('Dawah Egypt × Bateel Holding', t, A('r6') + .4, Bz('r8') - .1);
  big('ONE TEAM.', t, A('r7') + .05, Bz('r7'), 540, 410, 130); big('START TO FINISH.', t, A('r7') + Q, Bz('r7'), 540, 550, 112, '#00FBFC', CY);
  big('NEXT STAGE:', t, A('r8') + .05, Bz('r8'), 540, 410, 124); big('YOURS.', t, A('r8') + Q, Bz('r8'), 540, 560, 170, '#00FBFC', CY);
  chip(t);
}
function drawScene(t) {
  const s = sceneAt(t); if (!s) return;
  if (s.type === 'full') { drawFull(s, t); scrim(.7); } else if (s.type === 'stack') drawStack(s, t); else if (s.type === 'card') drawCard(s, t); else drawVoid(s, t);
  copy(t);
}
window.draw = (t, fi) => {
  g.fillStyle = '#020818'; g.fillRect(0, 0, W, H);
  if (t < END) { drawScene(t); const dip = seg(t, END - .22, END); if (dip > 0) { g.fillStyle = NAVY + dip + ')'; g.fillRect(0, 0, W, H); } }
  else endCard(t, END, 'Think it. Design it. Build it.', { sub: 'Planning an event? Send us the brief.', ltr: true });
  const lp = seg(t, window.DUR - .55, window.DUR);
  if (lp > 0) { g.save(); g.globalAlpha = eo(lp); const im = FR['wire/0001']; if (im) g.drawImage(im, 0, 0, W, H); scrim(.72); g.restore(); }
  post(t, fi, { vig: .5 });
};
// ---- sound cues / subtitles ----
const EV = []; const ev = (t, k) => EV.push({ t: +t.toFixed(3), k });
SCN.forEach(s => { if (s.type === 'void') return; ev(s.a, 'cut'); });
[['wire', .1], ['wire', 2 * Q], ['arch', .08], ['arch2', .05], ['stk', .1], ['kneel', .08], ['wrap', .08], ['wrap', 2 * Q], ['banner', .08], ['banner', Q], ['curve', .08], ['curve', Q], ['ladder', .05], ['ladder', Q], ['ladder', 2 * Q], ['r5', .1], ['r5', 2 * Q], ['r7', .05], ['r7', Q], ['r8', .05]].forEach(([id, o]) => ev(A(id) + o, 'slam'));
MK.forEach(id => ev(A(id), 'mont')); ev(VA, 'silence'); ev(VB, 'boom'); ev(A('r1') + .1, 'hit'); ev(A('r5') + 3.5 * Q, 'hit'); ev(A('r8') + Q, 'hit'); ev(END, 'sting');
window.EVENTS = EV.sort((a, b) => a.t - b.t);
window.SUBS = [];
