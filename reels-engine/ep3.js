// EPISODE 03 — VIEWS DON'T PAY THE BILLS   (29.2 s)
window.DUR = 29.2;
const SUBS = [
  { t0: 0.5, t1: 2.8, text: 'أخيرًا… مليون مشاهدة!' },
  { t0: 4.5, t1: 6.5, text: 'والدنيا مولّعة!' },
  { t0: 7.7, t1: 9.5, text: 'طب… فين العملاء؟', hide: true },
  { t0: 10.0, t1: 11.6, text: 'خلّينا نفرّق.' },
  { t0: 12.2, t1: 14.1, text: 'وصول: كام واحد شافك.' },
  { t0: 14.4, t1: 16.3, text: 'تفاعل: كام واحد اتفاعل.' },
  { t0: 16.6, t1: 19.0, text: 'تحويل: كام واحد عمل المطلوب.' },
  { t0: 19.4, t1: 21.0, text: 'كل حملة ليها هدف…' },
  { t0: 21.1, t1: 22.9, text: 'والهدف هو اللي بيحدد المقياس.' },
  { t0: 23.2, t1: 24.9, text: 'ماتجريش ورا المشاهدات بس…', hide: true },
  { t0: 25.0, t1: 26.1, text: 'ابني نتايج.', hide: true },
];
window.SUBS = SUBS;
const T_1M = 4.2, T_STOP = 6.8, T_PAN = 7.2, T_Q = 7.6, T_MAS = 9.8, T_FUN = 11.8, T_PUNCH = 23.0, T_END = 26.3;
const cr = rng(33); const CONF = [];
const CC = ['#00FBFC', '#ffffff', '#FCFF59', '#4aa3ff', '#0D5FB3', '#cfe0f5'];
for (let i = 0; i < 260; i++) { const cannon = i > 120; CONF.push({ ts: cannon ? T_1M + cr() * .25 : .4 + cr() * 5.8, x0: cannon ? (i % 2 ? 40 : 1040) : cr() * W, y0: cannon ? 1500 : -60, vx: cannon ? (i % 2 ? 1 : -1) * (150 + cr() * 600) * (i % 2 ? 1 : -1) * (i % 2 ? 1 : 1) : (cr() - .5) * 120, vy: cannon ? -(1100 + cr() * 900) : 160 + cr() * 220, w: 14 + cr() * 18, h: 8 + cr() * 12, col: CC[Math.floor(cr() * CC.length)], sp: (cr() - .5) * 14, ph: cr() * 6 }); }
CONF.forEach((c, i) => { if (c.ts >= T_1M && c.ts < T_1M + .3 && c.y0 === 1500) c.vx = (i % 2 ? 1 : -1) * (c.x0 < 500 ? 1 : -1) * 0 + (c.x0 < 500 ? 1 : -1) * (150 + cr() * 600); });
const DOTS = []; const dr = rng(55);
for (let i = 0; i < 44; i++) { const f = dr(); DOTS.push({ t0: 12.4 + i * .12, x: (dr() - .5) * 760, f, dir: dr() < .5 ? -1 : 1 }); }
const FY = [430, 700, 960, 1200]; // funnel stage boundaries
const hw = y => y < FY[1] ? lerp(440, 320, (y - FY[0]) / (FY[1] - FY[0])) : y < FY[2] ? lerp(320, 200, (y - FY[1]) / (FY[2] - FY[1])) : lerp(200, 100, clamp((y - FY[2]) / (FY[3] - FY[2])));
window.EVENTS = [{ t: .5, k: 'fan' }, { t: T_1M, k: 'hit' }, { t: T_STOP, k: 'scratch' }, { t: T_STOP + .35, k: 'thud' }, { t: T_PAN, k: 'whoosh' }, { t: T_Q, k: 'ding3' }, { t: 8.4, k: 'chirp' }, { t: 9.0, k: 'chirp' }, { t: T_MAS, k: 'ding' }, { t: 12.2, k: 'ding' }, { t: 14.4, k: 'ding' }, { t: 16.6, k: 'ding2' }, { t: T_PUNCH, k: 'hit2' }, { t: T_END, k: 'sting' }];
for (let t = .5; t < T_STOP - .3; t += .5) window.EVENTS.push({ t, k: 'beat' });
for (let i = 0; i < 14; i++) window.EVENTS.push({ t: T_1M + .05 + i * .12, k: 'pop' });
DOTS.forEach(d => { if (d.f < .16) window.EVENTS.push({ t: d.t0 + (1230 - 380) / 340, k: 'coin' }); });
const fmt = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function confetti(t, alphaMul = 1, frozen = false) {
  const tt = frozen ? Math.min(t, T_STOP) : t;
  for (const c of CONF) {
    if (tt < c.ts) continue; const dt = tt - c.ts; const x = c.x0 + c.vx * dt + Math.sin(dt * 3 + c.ph) * 24, y = c.y0 + c.vy * dt + 520 * dt * dt * (c.y0 === 1500 ? 1 : .15);
    if (y > H + 80 || y < -400) continue;
    g.save(); g.globalAlpha = alphaMul; g.translate(x, y); g.rotate(dt * c.sp + c.ph); g.scale(1, Math.cos(dt * 6 + c.ph)); g.fillStyle = c.col; g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); g.restore();
  }
}
function celebBG(t, kill) {
  bgNavy(0, t); const k = kill ? 0 : 1;
  // sweeping spotlights
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const s of [-1, 1]) { g.save(); g.translate(540 + s * 380, -40); g.rotate(s * (.28 + .3 * Math.sin(t * 2.2 + s))); const gr = g.createLinearGradient(0, 0, 0, 1700); gr.addColorStop(0, `rgba(120,200,255,${.34 * k + .05})`); gr.addColorStop(1, 'rgba(120,200,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-40, 0); g.lineTo(40, 0); g.lineTo(260, 1700); g.lineTo(-260, 1700); g.closePath(); g.fill(); g.restore(); }
  g.restore();
  // flashing screens wall
  const r = rng(14);
  for (let cx = 0; cx < 6; cx++) for (let ry = 0; ry < 12; ry++) {
    const ph = r() * 6, on = Math.sin(t * (5 + r() * 4) + ph) > .35 ? 1 : .0; const x = 90 + cx * 180, y = 330 + ry * 120;
    g.save(); g.globalAlpha = (.07 + .22 * on) * k + .04; g.fillStyle = on ? '#4aa3ff' : '#1b3f73'; rr(x - 60, y - 36, 120, 72, 10); g.fill();
    if (on && k) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 10, y - 14); g.lineTo(x + 16, y); g.lineTo(x - 10, y + 14); g.fill(); } g.restore();
  }
  // rising hearts
  const rh = rng(8); for (let i = 0; i < 26; i++) { const x0 = rh() * W, sp = 120 + rh() * 220, ph = rh() * 6, sz = 22 + rh() * 26; const tt = kill ? Math.min(t, T_STOP) : t; const y = 1600 - ((tt * sp + rh() * 1500) % 1700); const x = x0 + Math.sin(tt * 2 + ph) * 30; g.save(); g.globalAlpha = .75; g.fillStyle = i % 3 ? '#ff5c8a' : '#00FBFC'; heart(x, y, sz); g.restore(); }
}
function heart(x, y, s) { g.beginPath(); g.moveTo(x, y + s * .35); g.bezierCurveTo(x - s, y - s * .4, x - s * .5, y - s, x, y - s * .35); g.bezierCurveTo(x + s * .5, y - s, x + s, y - s * .4, x, y + s * .35); g.fill(); }
function counter(t) {
  const p = eio(seg(t, .3, T_1M)), v = Math.floor(1e6 * p); const punch = t > T_1M ? 1 + .22 * Math.exp(-(t - T_1M) * 7) * Math.cos((t - T_1M) * 20) : 1;
  g.save(); g.translate(540, 560); g.scale(punch, punch);
  g.fillStyle = 'rgba(2,8,24,.72)'; rr(-440, -130, 880, 270, 50); g.fill(); g.lineWidth = 5; g.strokeStyle = t >= T_1M ? C.yl : 'rgba(0,251,252,.7)'; g.stroke();
  T(fmt(v), 0, -22, 170, t >= T_1M ? C.yl : '#fff', { w: 900, dir: 'ltr', glow: t >= T_1M ? C.yl : C.cy, gb: 40 });
  T('مشاهدة', 40, 86, 60, '#cfe0f5', { w: 800 });
  g.fillStyle = '#ff2d55'; rr(-140, 58, 70, 52, 14); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-118, 70); g.lineTo(-90, 84); g.lineTo(-118, 98); g.fill();
  g.restore();
  if (t > T_1M + .2) { const q = eo(seg(t, T_1M + .2, T_1M + .6)); g.save(); g.globalAlpha = q * (1 - seg(t, T_STOP - .4, T_STOP)); g.translate(540, 330); g.rotate(-.04); g.scale(.8 + .2 * q, .8 + .2 * q); g.fillStyle = C.yl; rr(-290, -62, 580, 124, 20); g.fill(); T('مليون مشاهدة!', 0, 4, 78, '#081F3E', { w: 900 }); g.restore(); }
}
function celebScene(t) {
  const frozen = t >= T_STOP;
  celebBG(t, frozen); confetti(t, 1, frozen); counter(Math.min(t, T_STOP + .01) < T_STOP ? t : T_STOP + .0);
  // mascot
  const bt = frozen ? T_STOP : t, hop = Math.abs(Math.sin(bt * Math.PI * 2)) * 150 * (t > 4 ? 1.2 : 1); const fall = frozen ? seg(t, T_STOP + .1, T_STOP + .45) : 0;
  const lift = frozen ? lerp(Math.abs(Math.sin(T_STOP * Math.PI * 2)) * 150, 0, ei(fall)) : hop;
  mascot(frozen && fall >= 1 ? 'hips' : 'cheer', 540 + Math.sin(bt * 3) * 60, 1340, 450, { lift, rot: frozen ? 0 : Math.sin(bt * 6) * .08, sy: frozen && fall >= 1 ? .94 : 1 });
}
function shopScene(t) {
  // coordinates in 0..1920 space
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0a1a3a'); gr.addColorStop(.6, '#0d2a55'); gr.addColorStop(1, '#030a1a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // street floor
  g.fillStyle = '#071427'; g.fillRect(0, 1260, W, 660); floorLine(1262, .6);
  // building
  g.fillStyle = '#10305e'; g.fillRect(110, 520, 860, 740); g.fillStyle = '#0b2447'; g.fillRect(110, 520, 860, 8);
  // awning
  for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#0D5FB3'; g.beginPath(); g.moveTo(90 + k * 112, 560); g.lineTo(202 + k * 112, 560); g.lineTo(202 + k * 112, 700); g.arc(146 + k * 112, 700, 56, 0, Math.PI); g.lineTo(90 + k * 112, 560); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(90, 560, 900, 18);
  // window glass + counter
  const gl = g.createLinearGradient(0, 820, 0, 1260); gl.addColorStop(0, '#173f78'); gl.addColorStop(1, '#0a1f40'); g.fillStyle = gl; rr(190, 820, 700, 440, 16); g.fill();
  g.fillStyle = '#062042'; g.fillRect(190, 1080, 700, 180); g.fillStyle = '#1b4f95'; g.fillRect(190, 1070, 700, 18);
  // OPEN sign (flickers)
  const fl = Math.sin(t * 22) > .88 ? .35 : 1; g.save(); g.globalAlpha = fl; g.shadowColor = C.cy; g.shadowBlur = 30; g.strokeStyle = C.cy; g.lineWidth = 6; rr(740, 850, 130, 64, 18); g.stroke(); T('مفتوح', 805, 884, 38, C.cy, { w: 900 }); g.restore();
  // owner silhouette behind counter
  const bob = Math.sin(t * 1.5) * 4; g.save(); g.translate(540, 1075 + bob);
  g.fillStyle = '#0a1830'; g.beginPath(); g.moveTo(-95, 0); g.lineTo(-70, -190); g.quadraticCurveTo(0, -235, 70, -190); g.lineTo(95, 0); g.closePath(); g.fill();
  g.fillStyle = '#e8f1fb'; g.beginPath(); g.moveTo(-58, 0); g.lineTo(-44, -150); g.lineTo(44, -150); g.lineTo(58, 0); g.closePath(); g.fill(); // apron
  g.fillStyle = '#0a1830'; g.beginPath(); g.arc(0, -262, 58, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,251,252,.55)'; g.lineWidth = 4; g.beginPath(); g.arc(0, -262, 58, -2.5, -.6); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-20, -266, 8, 0, 7); g.arc(24, -266, 8, 0, 7); g.fill(); g.fillStyle = '#0a1830'; g.beginPath(); g.arc(-18, -266, 4, 0, 7); g.arc(26, -266, 4, 0, 7); g.fill();
  // phone in hand showing 1M
  g.save(); g.translate(98, -120); g.rotate(.2); g.fillStyle = '#05101f'; rr(-34, -60, 68, 120, 10); g.fill(); g.fillStyle = '#0D5FB3'; rr(-28, -52, 56, 100, 6); g.fill(); T('1M', 0, -6, 28, '#FCFF59', { w: 900, dir: 'ltr' }); g.restore();
  g.restore();
  // empty queue stanchions + tape
  g.strokeStyle = '#cfe0f5'; g.lineWidth = 6; for (const x of [200, 440, 680, 920]) { g.beginPath(); g.moveTo(x, 1420); g.lineTo(x, 1330); g.stroke(); g.fillStyle = '#cfe0f5'; g.beginPath(); g.arc(x, 1326, 12, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, 1422, 30, 8, 0, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(252,255,89,.6)'; g.lineWidth = 5; g.beginPath(); g.moveTo(200, 1340); g.quadraticCurveTo(320, 1380, 440, 1340); g.quadraticCurveTo(560, 1380, 680, 1340); g.quadraticCurveTo(800, 1380, 920, 1340); g.stroke();
  // tumbleweed paper ball rolling across
  const p = ((t - T_PAN) * .12) % 1.4; const bx = -120 + p * 1400, by = 1500 + Math.abs(Math.sin(t * 5)) * -18; g.save(); g.translate(bx, by); g.rotate(t * 6); g.fillStyle = '#e8f1fb'; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill(); g.strokeStyle = '#8aa0be'; g.lineWidth = 4; g.beginPath(); for (let a = 0; a < 12; a += .4) g.lineTo(Math.cos(a) * a * 3, Math.sin(a) * a * 3); g.stroke(); g.restore();
  // question bubble
  if (t > T_Q) { bubble(540, 470, 'طب… فين العملاء؟', { p: seg(t, T_Q, T_Q + .35), side: 'l', sz: 64, ink: '#081F3E' }); }
}
function funnel(t, k) {
  // k: overall alpha
  g.save(); g.globalAlpha *= k; const hl = t < 14.35 ? 0 : t < 16.55 ? 1 : t < 19.2 ? 2 : -1; const act = t < 12.1 ? -2 : (t < 14.35 ? 0 : t < 16.55 ? 1 : t < 19.2 ? 2 : -1);
  const stages = [['وصول', 'كام واحد شافك', '#0D5FB3', 'هدف الوعي'], ['تفاعل', 'كام واحد اتفاعل', '#1478d4', 'هدف التفاعل'], ['تحويل', 'اشترى · سجّل · اتصل', '#00b8c4', 'هدف المبيعات']];
  for (let s = 0; s < 3; s++) {
    const y0 = FY[s], y1 = FY[s + 1], w0 = hw(y0), w1 = hw(y1 - .01); const on = act === -1 || act === s, shown = t >= 11.9 + s * .25;
    if (!shown) continue; const pe = back(seg(t, 11.9 + s * .25, 12.3 + s * .25));
    g.save(); g.translate(540, (y0 + y1) / 2); g.scale(1, pe); g.translate(-540, -(y0 + y1) / 2);
    g.globalAlpha *= on ? 1 : .38; g.fillStyle = stages[s][2]; g.beginPath(); g.moveTo(540 - w0, y0); g.lineTo(540 + w0, y0); g.lineTo(540 + w1 - 8, y1 - 8); g.lineTo(540 - w1 + 8, y1 - 8); g.closePath();
    if (on && act === s) { g.shadowColor = C.cy; g.shadowBlur = 40; } g.fill(); g.shadowBlur = 0; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.4)'; g.stroke();
    T(stages[s][0], 540, (y0 + y1) / 2 - 18, 76 - s * 6, '#fff', { w: 900 }); T(stages[s][1], 540, (y0 + y1) / 2 + 48, 36, '#e6f3ff', { w: 700 });
    // objective tag
    const tg = seg(t, 19.4 + s * .4, 19.8 + s * .4); if (tg > 0) { g.save(); g.globalAlpha = eo(tg); g.translate(540 + w0 * .0, (y0 + y1) / 2); }
    if (tg > 0) { g.restore(); g.save(); g.globalAlpha *= eo(tg); g.fillStyle = 'rgba(2,8,24,.9)'; rr(70 + (1 - eo(tg)) * -60, (y0 + y1) / 2 - 36, 280 - 30, 72, 36); g.fill(); g.strokeStyle = C.yl; g.lineWidth = 3; g.stroke(); T(stages[s][3], 70 + (1 - eo(tg)) * -60 + 125, (y0 + y1) / 2 + 3, 34, C.yl, { w: 800 }); g.restore(); }
    g.restore();
  }
  // result box
  if (t > 12.6) { const rp = eo(seg(t, 12.6, 13.0)); g.save(); g.globalAlpha *= rp; const pulse = 1 + .06 * Math.sin(t * 7) * (t > 16 ? 1 : 0); g.translate(540, 1262); g.scale(pulse, pulse); g.fillStyle = 'rgba(2,8,24,.9)'; rr(-170, -44, 340, 88, 44); g.fill(); g.strokeStyle = C.yl; g.lineWidth = 4; g.stroke(); T('نتيجة ✓', 0, 4, 46, C.yl, { w: 900 }); g.restore(); }
  // dots
  for (const d of DOTS) {
    if (t < d.t0) continue; const dt = t - d.t0; let y = 380 + dt * 340; const survive1 = d.f < .5, survive2 = d.f < .16; let x = 540 + d.x * (hw(Math.min(y, FY[3])) / 440) * .92, a = 1, col = '#00FBFC';
    const cut1 = (700 - 380) / 340, cut2 = (960 - 380) / 340;
    if (!survive1 && dt > cut1) { const q = dt - cut1; y = 700 + q * 60; x = 540 + d.x * (320 / 440) * .92 + d.dir * q * 420; a = 1 - clamp(q / .7); col = '#7b869c'; }
    else if (!survive2 && dt > cut2) { const q = dt - cut2; y = 960 + q * 60; x = 540 + d.x * (200 / 440) * .92 + d.dir * q * 330; a = 1 - clamp(q / .7); col = '#9fb1c9'; }
    else if (y > 1230) { y = 1230; a = 1 - clamp((dt - (1230 - 380) / 340) / .5); col = C.yl; x = 540 + (x - 540) * .3; }
    if (a <= 0) continue; g.save(); g.globalAlpha *= a; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 12; g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); g.restore();
  }
  g.restore();
  // disclaimer
  if (k > .2) T('رسم توضيحي — مش أرقام حقيقية', 540, 372, 30, '#9fc0e6', { w: 600, alpha: k });
}
window.draw = (t, fi) => {
  const LOOP = .55;
  const render = tt => {
    if (tt >= T_END) { endCard(tt, T_END + .05, 'ابني نتايج… مش بس مشاهدات.', {}); return; }
    // layers
    const pan = eio(seg(tt, T_PAN, T_PAN + 1.0));
    if (tt < T_PAN + 1.05) {
      g.save(); g.translate(0, -H * pan); celebScene(tt); g.restore();
      if (tt > T_PAN - .2) { g.save(); g.translate(0, H * (1 - pan)); shopScene(tt); g.restore(); }
      if (tt >= T_STOP && tt < T_PAN) { g.fillStyle = `rgba(2,8,24,${.35 * seg(tt, T_STOP, T_STOP + .3)})`; g.fillRect(0, 0, W, H); }
    } else if (tt < T_MAS) { shopScene(tt); }
    else if (tt < T_PUNCH) {
      bgNavy(0, tt); beam(540, 540, 1500, .14);
      const sw = seg(tt, T_MAS + 1.6, T_MAS + 2.0); // shop cross-fades into explainer bg
      if (tt < T_MAS + 2.0) { g.save(); g.globalAlpha = 1 - sw; shopScene(tt); g.restore(); }
      funnel(tt, eo(seg(tt, T_FUN - .1, T_FUN + .2)));
    } else {
      bgNavy(0, tt); beam(540, 540, 1500, .2);
      const u = seg(tt, T_PUNCH, T_PUNCH + .5); funnel(tt, .22 * (1 - u) + .0);
    }
    if (tt >= T_PUNCH) { // punchline
      const a = eo(seg(tt, T_PUNCH, T_PUNCH + .4)), b = eo(seg(tt, T_PUNCH + 1.9, T_PUNCH + 2.3));
      T('ماتجريش ورا المشاهدات بس…', 540, 560 + (1 - a) * 30, Math.min(74, 74 * 940 / tw('ماتجريش ورا المشاهدات بس…', 74, 900)), '#fff', { w: 900, alpha: a, glow: 'rgba(0,251,252,.4)', gb: 24 });
      g.save(); g.translate(540, 760); const s = .6 + .4 * back(seg(tt, T_PUNCH + 1.9, T_PUNCH + 2.4)); g.scale(s, s); T('ابني نتايج.', 0, 0, 128, C.cy, { w: 900, alpha: b, glow: C.cy, gb: 50, stroke: 'rgba(2,8,24,.9)', sw: 16 }); g.restore();
      if (tt > T_PUNCH + 1.9) { for (const c of CONF.slice(0, 120)) { const dt = tt - T_PUNCH - 1.9 - (c.ts % 1.2) * .3; if (dt < 0) continue; const x = c.x0 + Math.sin(dt * 2 + c.ph) * 30, y = -40 + dt * (260 + c.vy * .4); if (y > H) continue; g.save(); g.globalAlpha = .9; g.translate(x, y); g.rotate(dt * c.sp); g.fillStyle = c.col; g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); g.restore(); } }
      mascot(tt < T_PUNCH + 1.9 ? 'hips' : 'cheer', 540, 1300, 430, { ...idle(tt, 1), lift: tt >= T_PUNCH + 1.9 ? Math.abs(Math.sin((tt - T_PUNCH - 1.9) * 8)) * 70 : 0 });
    } else if (tt >= T_MAS && tt < T_PUNCH) { // mascot enters (think) and explains
      const pin = eo(seg(tt, T_MAS, T_MAS + .5)), x = lerp(1400, 850, pin);
      mascot('think', lerp(1400, 905, pin), 1330, 300, idle(tt * .7, .5));
    }
    if (tt < 2.6) badgeEp('03', "Views Don't Pay the Bills", tt, 1);
    post(tt, fi, { vig: .6, flash: tt > T_1M && tt < T_1M + .12 ? .85 : 0 });
  };
  render(t);
  if (t > DUR - LOOP) { const a = eo((t - (DUR - LOOP)) / LOOP); g.save(); g.globalAlpha = a; celebScene(0.2); g.restore(); }
  subtitle(SUBS, t);
};
