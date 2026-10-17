// EPISODE 01 — JUST ONE SMALL CHANGE   (26.0 s, 30 fps, 1080x1920)
window.DUR = 26.0;
const SUBS = [
  { t0: 0.4, t1: 2.2, text: 'يوم هادي في الأجنسي…' },
  { t0: 3.0, t1: 4.5, text: 'العميل بعت: تعديل بسيط.' },
  { t0: 7.0, t1: 9.2, text: 'بسيط يعني… كام نسخة؟' },
  { t0: 12.6, t1: 14.6, text: 'والأسبوع كله راح…' },
  { t0: 17.7, t1: 19.1, text: 'وفجأة… هدوء.' },
  { t0: 19.6, t1: 20.9, text: 'تمام. كده ممتاز.' },
  { t0: 21.5, t1: 23.0, text: 'بس آخر حاجة واحدة…' },
];
window.SUBS = SUBS;

// ---- timeline constants ----
const T_MSG1 = 2.4, T_ESC = 3.9, T_VORTEX = 10.5, T_CUT = 17.0, T_CALM = 17.5, T_MSG2 = 19.4, T_TYPE = 20.9, T_MSG3 = 21.3, T_END = 23.3;
const NOTES = ['غيّر اللون', 'كبّر اللوجو', 'لا… رجّعه زي الأول', 'Final_v9', 'ممكن النهاردة؟', 'ده مش اللي قصدته', 'خلّيه Pop أكتر', 'والخط؟', 'قرّب اللوجو', 'بعّد اللوجو', 'عاجل!', 'نسيت أقولك…', 'Final_FINAL', 'بسيط والله'];
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة؟!', 'السبت؟!'];
const NMAX = 560;
function spiral(n) { const out = [[0, 0]]; let x = 0, y = 0, dx = 1, dy = 0, len = 1, sp = 0, pass = 0; for (let i = 1; i < n; i++) { x += dx; y += dy; out.push([x, y]); sp++; if (sp === len) { sp = 0;[dx, dy] = [-dy, dx]; pass++; if (pass % 2 === 0) len++; } } return out; }
const SP = spiral(NMAX);
const TW = 640, TH = 400, PX = 720, PY = 470; // tile size / pitch (world)
const MON = { x: 540, y: 700 }; // main monitor centre (screen coords at zoom 1)
const birth = i => i === 0 ? -1 : T_ESC + (T_CUT - 0.8 - T_ESC) * Math.pow(i / NMAX, 1 / 2.3);
const noteR = rng(77); const NOTE_LIST = [];
for (let i = 0; i < 30; i++) { const t0 = 5.0 + i * 0.42 + noteR() * .2; const ang = noteR() * 6.283; NOTE_LIST.push({ t0, txt: NOTES[i % NOTES.length], fx: 540 + Math.cos(ang) * 900, fy: 900 + Math.sin(ang) * 1000, tx: 140 + noteR() * 800, ty: 380 + noteR() * 760, rot: (noteR() - .5) * .6, col: [C.yl, '#ffffff', C.cy, C.yl][i % 4], sz: 48 + Math.floor(noteR() * 14) }); }
// events for sound design
window.EVENTS = [{ t: T_MSG1, k: 'ding' }, { t: T_MSG2, k: 'ding2' }, { t: T_MSG3, k: 'ding3' }, { t: T_CUT, k: 'cut' }, { t: T_END, k: 'scratch' }, { t: 18.65, k: 'thud' }];
NOTE_LIST.forEach(n => window.EVENTS.push({ t: n.t0 + .85, k: 'slap' }));
for (let i = 1; i < 60; i++) window.EVENTS.push({ t: birth(Math.floor(i * i / 6.3) + 1), k: 'pop' });
for (let i = 0; i < 7; i++) window.EVENTS.push({ t: 8.0 + i * 1.1, k: 'tick' });

function roomBG(t, o = {}) {
  bgNavy(o.mood || 0, t);
  beam(540, 540, 1400, .16 * (o.lamp == null ? 1 : o.lamp), 1.1);
  // bokeh
  const r = rng(5); g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) { const x = r() * W, y = 120 + r() * 700, rad = 50 + r() * 90; g.globalAlpha = .06 + .04 * Math.sin(t * .8 + i); glowCircle(x, y, rad, 'rgba(60,150,255,A)'); }
  g.restore();
}
function desk(t) {
  // desk surface
  const gr = g.createLinearGradient(0, 1090, 0, 1260); gr.addColorStop(0, '#12315e'); gr.addColorStop(1, '#071735'); g.fillStyle = gr; g.fillRect(0, 1100, W, 170);
  g.fillStyle = 'rgba(0,251,252,.55)'; g.fillRect(0, 1100, W, 3);
  g.fillStyle = '#050f24'; g.fillRect(0, 1270, W, 700);
  floorLine(1285, .85);
  // mug + steam
  g.fillStyle = '#e8f1fb'; rr(150, 1040, 92, 90, 14); g.fill(); g.strokeStyle = '#e8f1fb'; g.lineWidth = 12; g.beginPath(); g.arc(246, 1085, 26, -1.2, 1.2); g.stroke();
  g.save(); g.strokeStyle = 'rgba(207,233,255,.35)'; g.lineWidth = 6; g.lineCap = 'round';
  for (let k = 0; k < 3; k++) { g.beginPath(); for (let y = 0; y < 90; y += 6) { const x = 175 + k * 22 + Math.sin(t * 2.2 + y * .08 + k) * 9; y === 0 ? g.moveTo(x, 1030 - y) : g.lineTo(x, 1030 - y); } g.stroke(); }
  g.restore();
}
function monitorStand() { g.fillStyle = '#0a1224'; g.fillRect(MON.x - 36, MON.y + TH / 2, 72, 1100 - (MON.y + TH / 2)); rr(MON.x - 170, 1084, 340, 22, 10); g.fill(); }

function tilePos(i, t) {
  const gx = MON.x + SP[i][0] * PX, gy = MON.y + SP[i][1] * PY;
  const p = eio(seg(t, T_VORTEX, T_VORTEX + 2.2));
  if (i === 0 || p <= 0) return { x: gx, y: gy, s: 1, d: 0 };
  const th = i * .5 + (t - T_VORTEX) * (.9 + (i % 7) * .05 + .5 * seg(t, T_VORTEX, T_CUT)); const rad = 650 + (i % 90) * 34;
  const ox = MON.x + Math.cos(th) * rad, oy = MON.y + Math.sin(th) * rad * .55, d = Math.sin(th);
  return { x: lerp(gx, ox, p), y: lerp(gy, oy, p), s: lerp(1, 1 + .5 * d, p), d: lerp(0, d, p) };
}

function wallScene(t) {
  // camera zoom follows tile count
  const cnt = 1 + Math.floor(Math.pow(seg(t, T_ESC, T_CUT - .8), 2.3) * (NMAX - 1));
  let z = 1 / (1 + .2 * (Math.sqrt(cnt) - 1));
  if (t > T_VORTEX) z = lerp(z, Math.max(z, .3), eio(seg(t, T_VORTEX, T_VORTEX + 3)));
  // punch on early dings
  for (const b of [T_MSG1, 4.1, 4.5, 4.9]) { const d = t - b; if (d >= 0 && d < .4) z *= 1 + .05 * Math.exp(-d * 9); }
  const sh = shakeAt(t, 6 + 26 * seg(t, T_ESC + 2, T_VORTEX + 2));
  const rot = (t > T_VORTEX ? Math.sin(t * 1.7) * .09 * seg(t, T_VORTEX, T_VORTEX + 1.5) : 0) + sh.rot;
  camBegin({ z, cx: MON.x, cy: MON.y, sx: sh.sx, sy: -260 + sh.sy + 0 + 0, rot });
  // collect tiles
  const list = [];
  for (let i = 0; i < cnt; i++) { const p = tilePos(i, t); list.push({ i, ...p }); }
  list.sort((a, b) => a.d - b.d);
  for (const L of list) {
    const b = birth(L.i); let s = L.i === 0 ? 1 : back(seg(t, b, b + .28)); if (s <= 0) continue;
    s *= L.s;
    // cull
    const sx = (L.x - MON.x) * z + 540, sy = (L.y - MON.y) * z + MON.y;
    if (sx < -300 || sx > W + 300 || sy < -300 || sy > H + 300) continue;
    g.save(); g.translate(L.x, L.y); g.scale(s, s); g.globalAlpha = L.i === 0 ? 1 : clamp(.35 + L.d * .0 + .65);
    const shift = (L.i % 3 === 0 ? 14 : L.i % 3 === 1 ? -10 : 0) * (L.i === 0 ? seg(t, T_MSG1 + .3, T_MSG1 + .6) * (1 - seg(t, 3.6, 3.9)) : 1);
    designTile(0, 0, TW, TH, L.i === 0 ? 1 : L.i + 2, { shift, badge: z > .6 && L.i > 0 ? 'v' + (L.i + 1) : null });
    g.restore();
  }
  camEnd();
  return z;
}

function hudRevisions(t) {
  const p = seg(t, T_ESC + .3, T_ESC + .7) * (1 - seg(t, T_CUT - .05, T_CUT)); if (p <= 0) return;
  const n = Math.floor(1 + Math.pow(seg(t, T_ESC, 13.2), 2) * 98); const over = t > 13.2;
  const shk = over ? Math.sin(t * 60) * 4 : 0;
  g.save(); g.globalAlpha *= eo(p); g.translate(540 + shk, 530);
  g.fillStyle = 'rgba(2,8,24,.8)'; rr(-250, -64, 500, 128, 40); g.fill(); g.lineWidth = 3; g.strokeStyle = over ? C.yl : 'rgba(0,251,252,.6)'; g.stroke();
  T('نسخ التعديلات', 90, 0, 36, '#9fc0e6', { w: 700 });
  const txt = t > 16.0 ? '∞' : over ? '99+' : String(n);
  T(txt, -120, 6, 84, over ? C.yl : C.cy, { w: 900, dir: 'ltr', glow: over ? C.yl : C.cy, gb: 24 });
  g.restore();
}
function hudDays(t) {
  if (t < 8.0 || t > T_CUT - .1) return;
  const k = Math.floor((t - 8.0) / .3) % DAYS.length, lt = ((t - 8.0) % .3) / .3;
  g.save(); g.translate(540, 665); const s = .85 + .15 * back(clamp(lt * 3)); g.scale(s, s);
  T(DAYS[k], 0, 0, 70, k >= 5 ? C.yl : '#fff', { w: 900, glow: k >= 5 ? C.yl : 'rgba(0,251,252,.5)', gb: 28, stroke: 'rgba(2,8,24,.85)', sw: 14 }); g.restore();
  // night cycle overlay
  g.save(); g.globalAlpha = .22 * (Math.sin((t - 8) * 5.2) * .5 + .5); g.fillStyle = '#00030c'; g.fillRect(0, 0, W, H); g.restore();
}
function hudClock(t) {
  if (t < 6.0 || t > T_CUT - .1) return; const p = eo(seg(t, 6.0, 6.5));
  g.save(); g.globalAlpha *= p; g.translate(930, 470); g.fillStyle = 'rgba(2,8,24,.85)'; g.beginPath(); g.arc(0, 0, 68, 0, 7); g.fill(); g.strokeStyle = C.cy; g.lineWidth = 5; g.stroke();
  const m = (t - 6) * 9, h = m / 12; g.lineCap = 'round'; g.strokeStyle = '#fff'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(m) * 52, -Math.cos(m) * 52); g.stroke();
  g.lineWidth = 9; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.sin(h) * 34, -Math.cos(h) * 34); g.stroke(); g.restore();
}
function notesLayer(t) {
  for (const n of NOTE_LIST) {
    if (t < n.t0 || t > T_CUT - .02) continue; const p = seg(t, n.t0, n.t0 + .85), e = eo(p);
    const x = lerp(n.fx, n.tx, e), y = lerp(n.fy, n.ty, e) - Math.sin(p * Math.PI) * 120;
    const r = n.rot + (1 - e) * 2.4, sc = .6 + .4 * e + .2 * (1 - e);
    g.save(); g.translate(x, y); g.scale(sc, sc); sticky(0, 0, r, n.txt, n.col, n.sz); g.restore();
  }
}
function sweat(x, y, t, a = 1) { g.save(); g.globalAlpha *= a; for (let k = 0; k < 2; k++) { const ph = (t * 1.6 + k * .5) % 1; g.fillStyle = 'rgba(0,251,252,.9)'; g.beginPath(); const px = x + (k ? 150 : -150) + (k ? 1 : -1) * ph * 30, py = y + ph * 70; g.moveTo(px, py - 24); g.quadraticCurveTo(px + 15, py + 4, px, py + 16); g.quadraticCurveTo(px - 15, py + 4, px, py - 24); g.fill(); } g.restore(); }

function mascotTimeline(t) {
  const B = idle(t, 1);
  let pose = 'hips', x = 540, h = 470, o = { ...B }, y = 1560;
  if (t >= T_MSG1 && t < T_MSG1 + .5) { const d = t - T_MSG1; o.lift = Math.abs(Math.sin(d * 14)) * 90 * Math.exp(-d * 4); }
  if (t >= 3.0 && t < T_ESC) pose = 'think';
  if (t >= T_ESC && t < T_VORTEX) { pose = 'wave'; const s = seg(t, T_ESC, T_VORTEX); o.rot = Math.sin(t * 9) * (.03 + .08 * s); x = 540 + Math.sin(t * 3.1) * 40 * s; o.lift = Math.abs(Math.sin(t * 8)) * (14 + 40 * s); }
  if (t >= T_VORTEX && t < T_CUT) {
    pose = 'cheer'; const s = seg(t, T_VORTEX, T_CUT); x = 540 + Math.sin(t * 2.3) * 160 * Math.min(1, s * 2); o.lift = 40 + Math.abs(Math.sin(t * 5)) * 120 * s + 60 * Math.sin(t * 1.6);
    o.rot = Math.sin(t * 4) * (.25 + .5 * s) + (t > 16.0 ? (t - 16) * 5 : 0); h = 470 * (1 + .18 * s + (t > 16.2 ? (t - 16.2) * 1.4 : 0));
  }
  if (t >= T_CALM && t < T_END) { pose = 'hips'; o = { ...idle(t * .5, .35), sy: .965 }; x = 540; if (t >= T_MSG2 + .3 && t < T_MSG3 - .2) { pose = 'wave'; o = { ...idle(t, .8) }; } if (t >= T_MSG3) { pose = 'hips'; o = { sy: 1, rot: 0, lift: 0 }; } }
  return { pose, x, h, o, y };
}

function chat(t) {
  // client chat bubbles (top, safe zone)
  const cx = 540, by = 400;
  const stackShift = 0;
  const show = (t0, t1, txt, y, tp) => {
    if (t < t0 || t > t1) return; const p = seg(t, t0, t0 + .35), out = 1 - seg(t, t1 - .25, t1);
    g.save(); g.globalAlpha *= out; avatar(110, y, 44, 'ع'); bubble(550, y, txt, { p, side: 'l' }); g.restore();
  };
  show(T_MSG1, 6.2, 'هو تعديل بسيط جدًا…', by);
  // calm phase conversation
  const calm = (t0, txt, y, tt) => { if (t < t0 || t > T_END - .05) return; const p = seg(t, t0, t0 + .35); avatar(110, y, 44, 'ع'); bubble(550, y, txt, { p, side: 'l' }); };
  if (t > T_TYPE - .3 && t < T_MSG3) typingDots(300, 530, t, seg(t, T_TYPE - .3, T_TYPE));
  if (t > T_MSG2 - 1.4 && t < T_MSG2) typingDots(300, 400, t, seg(t, T_MSG2 - 1.4, T_MSG2 - 1.2));
  calm(T_MSG2, 'تمام. كده ممتاز.', 400);
  calm(T_MSG3, 'بس آخر حاجة واحدة…', 530);
}

function closeUp(t) {
  // extreme push-in on the sunglasses (hipsHD)
  const p = seg(t, T_MSG3 + .1, T_END), z = lerp(1.0, 5.2, ei(p));
  const img = IM.hipsHD; const sc = 1500 / img.height; const w = img.width * sc, hh = img.height * sc;
  bgNavy(0, t); beam(540, 540, 1500, .2);
  g.save(); g.translate(540 + Math.sin(t * 40) * 6 * p, 960 + Math.cos(t * 37) * 6 * p);
  g.scale(z, z); g.translate(-(w * .5), -(hh * .27)); // anchor on glasses
  g.shadowColor = 'rgba(0,251,252,.4)'; g.shadowBlur = 60; g.drawImage(img, 0, 0, w, hh); g.restore();
  // lens flare on glasses
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .25 * p; glowCircle(540 - 60, 960 - 20, 420 * p + 80, 'rgba(0,251,252,A)'); g.restore();
}

function calmOffice(t, o = {}) {
  roomBG(t, { lamp: o.lamp }); desk(t);
  const z = o.z || 1; camBegin({ z, cx: 540, cy: 900, sy: -60 });
  monitorStand(); designTile(MON.x, MON.y, TW, TH, 1, { shift: o.shift || 0 });
  camEnd();
}

window.draw = (t, fi) => {
  const LOOP = 0.55;
  const render = (tt) => {
    if (tt >= T_END) { // end card
      endCard(tt, T_END + .05, 'حياة الأجنسي… وإحنا لسه واقفين.'); return;
    }
    if (tt >= T_MSG3 + .1) { closeUp(tt); post(tt, fi, { vig: .75 }); chat(tt); return; }
    if (tt >= T_CUT && tt < T_CALM) { // silence beat: black
      g.fillStyle = '#00030c'; g.fillRect(0, 0, W, H); return;
    }
    if (tt >= T_CALM) {
      calmOffice(tt, { z: 1.0 + .02 * (tt - T_CALM), lamp: .8 });
      // stray sticky falls onto the head
      const fp = seg(tt, 17.9, 18.65); if (tt > 17.9) { const y = lerp(-100, 1090, fp * fp), sw = Math.sin(tt * 4) * 40 * (1 - fp); if (fp < 1) { sticky(540 + sw, y, Math.sin(tt * 3) * .35, 'Final_FINAL', C.yl, 52); } else { sticky(520, 1090, -.18, 'Final_FINAL', C.yl, 52); } }
      const m = mascotTimeline(tt); mascot(m.pose, m.x, m.y, m.h, m.o);
      if (tt >= 18.65) { sticky(528, 1086, -.2, 'Final_FINAL', C.yl, 52); }
      chat(tt); post(tt, fi, { vig: .7 }); return;
    }
    // calm intro + escalation
    if (tt < T_ESC) {
      calmOffice(tt, { z: 1 + .035 * seg(tt, 0, T_ESC), shift: 14 * seg(tt, T_MSG1 + .3, T_MSG1 + .6) * (1 - seg(tt, 3.6, 3.9)) });
      // main tile gets the "small change" nudge handled in wall scene; reuse tile
    }
    if (tt >= T_ESC - .0) {
      roomBG(tt, { mood: seg(tt, T_VORTEX, T_CUT) * .55, lamp: 1 });
      // flicker lights in the vortex
      wallScene(tt);
      if (tt > T_VORTEX) { const f = Math.sin(tt * 18) > .55 ? .12 : 0; g.fillStyle = `rgba(0,251,252,${f})`; g.fillRect(0, 0, W, H); }
    }
    notesLayer(tt); hudDays(tt); hudClock(tt); hudRevisions(tt);
    const m = mascotTimeline(tt); mascot(m.pose, m.x, m.y, m.h, m.o);
    if (tt > T_ESC + 1.5 && tt < T_CUT) sweat(m.x, m.y - m.h * .86 - (m.o.lift || 0), tt, seg(tt, T_ESC + 1.5, T_ESC + 2.2));
    chat(tt);
    if (tt < 2.6) badgeEp('01', 'Just One Small Change', tt, 1);
    post(tt, fi, { vig: .62, flash: tt > T_CUT - .12 && tt < T_CUT ? .8 : 0 });
  };
  render(t);
  // seamless-loop crossfade: last frames dissolve back into frame 0
  if (t > DUR - LOOP) { const a = eo((t - (DUR - LOOP)) / LOOP); g.save(); g.globalAlpha = a; render0(); g.restore(); }
  subtitle(SUBS, t);
};
function render0() { calmOffice(0, { z: 1 }); const m = mascotTimeline(0); mascot(m.pose, m.x, m.y, m.h, m.o); }
