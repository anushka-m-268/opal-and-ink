/* Procedural ink-and-watercolour illustration, drawn with Canvas2D.
   Everything the site paints (the Jester, the paper-moth familiars, flora, frames,
   book covers, card faces) is generated here, so there are no image files. */

export const PAL = {
  paper: '#ECEBE8', warm: '#CFCAC4', stone: '#B8B2AC', ink: '#3A2F2C',
  rust: '#B4482A', verm: '#C9542F', poppy: '#A33A26', blush: '#D9A9A0',
  sage: '#6E9C92', slate: '#4E5F5A', gold: '#B8934A', skin: '#D9D5CF', hair: '#F3F1ED',
};

const R = Math.PI / 180;
const TAU = Math.PI * 2;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const dir = (a) => [Math.cos(a * R), Math.sin(a * R)];
const at = (p, a, l) => { const d = dir(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(clamp(v * (1 + k), 0, 255));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/* ---------- paths ---------- */
const poly = (pts, close = true) => (c) => {
  c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (close) c.closePath();
};
const smooth = (pts, close = true) => (c) => {
  const n = pts.length, m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  c.beginPath();
  if (close) {
    const s = m(pts[n - 1], pts[0]); c.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const e = m(pts[i], pts[(i + 1) % n]); c.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    c.closePath();
  } else {
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) { const e = m(pts[i], pts[i + 1]); c.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    c.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
};
const ell = (x, y, rx, ry, rot = 0) => (c) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); };
const bbox = (pts, pad = 0) => [
  Math.min(...pts.map((p) => p[0])) - pad, Math.min(...pts.map((p) => p[1])) - pad,
  Math.max(...pts.map((p) => p[0])) + pad, Math.max(...pts.map((p) => p[1])) + pad,
];

/* ---------- the two basic strokes: a bleeding wash and a loose ink line ---------- */
export function wash(c, path, col, { a = 0.7, blur = 9, edge = 0.3 } = {}) {
  c.save();
  c.fillStyle = col; c.shadowColor = col; c.shadowBlur = blur;
  c.globalAlpha = a * 0.5; path(c); c.fill();
  c.shadowBlur = 0; c.globalAlpha = a; path(c); c.fill();
  c.globalAlpha = edge; c.strokeStyle = shade(col.startsWith('#') ? col : PAL.rust, -0.3); c.lineWidth = 2; c.stroke();
  c.restore();
}
export function ink(c, path, w = 2.2, a = 0.85) {
  c.save();
  c.strokeStyle = PAL.ink; c.lineCap = 'round'; c.lineJoin = 'round';
  c.globalAlpha = a; c.lineWidth = w; path(c); c.stroke();
  c.globalAlpha = a * 0.3; c.lineWidth = w * 0.6; c.translate(0.9, 0.7); path(c); c.stroke();
  c.restore();
}
function dots(c, path, box, col, { gap = 9, r = 2.4, dx = 0.6, dy = 0.8, a = 0.5 } = {}) {
  c.save(); path(c); c.clip(); c.fillStyle = col; c.globalAlpha = a;
  const [x0, y0, x1, y1] = box; let row = 0;
  for (let y = y0; y < y1; y += gap * 0.7, row++) {
    for (let x = x0 + (row % 2 ? gap / 2 : 0); x < x1; x += gap) {
      const t = clamp((((x - x0) / (x1 - x0)) * dx + ((y - y0) / (y1 - y0)) * dy) / (dx + dy));
      const rr = r * t * t * 1.4;
      if (rr > 0.4) { c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill(); }
    }
  }
  c.restore();
}
function patch(c, path, box, s) {
  const cols = [PAL.rust, PAL.verm, PAL.poppy, PAL.blush, PAL.verm];
  c.save(); path(c); c.clip();
  const cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, rad = Math.hypot(box[2] - box[0], box[3] - box[1]) / 2 + s;
  c.translate(cx, cy); c.rotate(0.5);
  for (let row = 0, y = -rad; y < rad; y += s / 2, row++) {
    for (let i = 0, x = -rad + (row % 2) * (s / 2); x < rad; x += s, i++) {
      c.globalAlpha = 0.82; c.fillStyle = cols[(i + row) % cols.length];
      c.beginPath(); c.moveTo(x, y - s / 2); c.lineTo(x + s / 2, y); c.lineTo(x, y + s / 2); c.lineTo(x - s / 2, y); c.closePath(); c.fill();
      c.globalAlpha = 0.3; c.strokeStyle = PAL.ink; c.lineWidth = 1.1; c.stroke();
    }
  }
  c.restore();
}
function costume(c, path, box, size = 30) {
  wash(c, path, PAL.rust, { a: 0.9, blur: 6 });
  patch(c, path, box, size);
  dots(c, path, box, PAL.ink, { gap: 7, r: 2, dx: 0.2, dy: 1, a: 0.32 });
  ink(c, path, 2.6);
}

/* ---------- the Jester ---------- */
const LEN = { upper: 118, fore: 112, thigh: 150, shin: 146 };
// t/tl: torso angle and length from hip; ha/hl/hr: head direction, distance and tilt; arms and legs are [upper, lower] angles.
export const JESTER_POSES = {
  recline: { hip: [610, 650], t: 198, tl: 250, ha: 252, hl: 92, hr: -10,
    armR: [72, 188], armL: [305, 335], legF: [352, 22], legB: [8, 345], brush: 296, hold: 'L', trail: 150 },
  reclineUp: { hip: [610, 650], t: 198, tl: 250, ha: 252, hl: 92, hr: -6,
    armR: [72, 188], armL: [285, 318], legF: [352, 22], legB: [8, 345], brush: 312, hold: 'L', trail: 150 },
  sit: { hip: [540, 690], t: 268, tl: 235, ha: 266, hl: 92, hr: 3,
    armR: [70, 25], armL: [300, 290], legF: [340, 80], legB: [195, 100], brush: 285, hold: 'L', trail: 150 },
  bow: { hip: [500, 520], t: 300, tl: 235, ha: 305, hl: 92, hr: 32,
    armR: [105, 50], armL: [140, 190], legF: [95, 92], legB: [85, 90], brush: 20, hold: 'R', trail: 115 },
  shrug: { hip: [520, 540], t: 268, tl: 235, ha: 266, hl: 92, hr: 12,
    armR: [20, 300], armL: [160, 240], legF: [97, 90], legB: [83, 91], brush: 330, hold: 'R', trail: 115 },
};

function limbPath(p, q, r1, r2) {
  const a = Math.atan2(q[1] - p[1], q[0] - p[0]), n = [-Math.sin(a), Math.cos(a)], t = [Math.cos(a), Math.sin(a)];
  const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], rm = (r1 + r2) / 2 * 1.06;
  const P = [
    [p[0] - t[0] * r1 * 0.7, p[1] - t[1] * r1 * 0.7],
    [p[0] + n[0] * r1, p[1] + n[1] * r1], [m[0] + n[0] * rm, m[1] + n[1] * rm], [q[0] + n[0] * r2, q[1] + n[1] * r2],
    [q[0] + t[0] * r2 * 0.8, q[1] + t[1] * r2 * 0.8],
    [q[0] - n[0] * r2, q[1] - n[1] * r2], [m[0] - n[0] * rm, m[1] - n[1] * rm], [p[0] - n[0] * r1, p[1] - n[1] * r1],
  ];
  return { path: smooth(P), box: bbox(P) };
}
function paintLimb(c, p, q, r1, r2, size) { const l = limbPath(p, q, r1 * 1.3, r2 * 1.3); costume(c, l.path, l.box, size); }

function hand(c, p, ang) {
  c.save(); c.translate(p[0], p[1]); c.rotate(ang * R);
  wash(c, ell(8, 0, 19, 12), PAL.skin, { a: 0.95, blur: 3 }); ink(c, ell(8, 0, 19, 12), 2);
  ink(c, poly([[14, -4], [28, -7]], false), 1.5); ink(c, poly([[14, 3], [29, 5]], false), 1.5);
  c.restore();
}
function shoe(c, p, ang) {
  c.save(); c.translate(p[0], p[1]); c.rotate(ang * R);
  const path = smooth([[-6, -16], [34, -17], [66, -8], [86, -26], [80, -2], [52, 14], [0, 18], [-12, 4]]);
  wash(c, path, PAL.poppy, { a: 0.95, blur: 3 }); ink(c, path, 2.2);
  c.restore();
}
function brushShape(c, base, ang) {
  const a = at(base, ang, 0), b = at(base, ang, 205), tip = at(b, ang, 70);
  c.save(); c.lineCap = 'round';
  c.strokeStyle = PAL.ink; c.lineWidth = 11; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
  c.strokeStyle = '#8B6B55'; c.lineWidth = 7; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
  c.strokeStyle = PAL.stone; c.lineWidth = 12; c.beginPath(); c.moveTo(...at(b, ang, -4)); c.lineTo(...at(b, ang, 26)); c.stroke();
  const n = dir(ang + 90), t0 = at(b, ang, 24);
  const bristles = poly([[t0[0] + n[0] * 12, t0[1] + n[1] * 12], tip, [t0[0] - n[0] * 12, t0[1] - n[1] * 12]]);
  c.restore();
  wash(c, bristles, PAL.verm, { a: 0.95, blur: 4 }); ink(c, bristles, 2);
}

function ruffle(c, ctr, ang, rx = 62) {
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + ang * R, x = ctr[0] + Math.cos(a) * rx * 1.05, y = ctr[1] + Math.sin(a) * rx * 0.7;
    const col = i % 2 ? PAL.hair : PAL.blush;
    wash(c, ell(x, y, 27, 22, a), col, { a: 0.95, blur: 3 }); ink(c, ell(x, y, 27, 22, a), 1.8);
  }
  wash(c, ell(ctr[0], ctr[1], rx * 0.8, rx * 0.5), PAL.hair, { a: 0.95, blur: 2 });
  ink(c, ell(ctr[0], ctr[1], rx * 0.8, rx * 0.5), 1.8);
}
function head(c, ctr, rot) {
  c.save(); c.translate(ctr[0], ctr[1]); c.rotate(rot * R); c.scale(1.3, 1.3);
  const rnd = rng(7);
  // curly white hair behind the face
  for (let i = 0; i < 12; i++) {
    const a = (-200 + i * 20) * R, x = Math.cos(a) * 54, y = Math.sin(a) * 58 - 4, r = 24 + rnd() * 8;
    wash(c, ell(x, y, r, r), PAL.hair, { a: 0.95, blur: 2 }); ink(c, ell(x, y, r, r), 1.6);
    ink(c, poly([[x - r * 0.4, y], [x, y - r * 0.5], [x + r * 0.4, y]], false), 1.2, 0.5);
  }
  // small feathered wing-ears
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const a = (s < 0 ? 190 : -10) - s * 0 + (s < 0 ? -k * 16 : k * 16);
      const base = [s * 44, -6 - k * 6], tip = at(base, a, 62 - k * 8);
      const f = smooth([base, at(base, a + 25, 24), tip, at(base, a - 25, 24)]);
      wash(c, f, '#9DB2AC', { a: 0.9, blur: 2 }); ink(c, f, 1.4);
    }
  }
  const face = ell(0, 0, 46, 58);
  wash(c, face, PAL.skin, { a: 1, blur: 3 });
  dots(c, face, [-46, -58, 46, 58], PAL.ink, { gap: 6, r: 1.8, dx: 1, dy: 0.1, a: 0.28 });
  ink(c, face, 2.2);
  wash(c, ell(-26, 14, 11, 7), PAL.blush, { a: 0.45, blur: 6, edge: 0 });
  wash(c, ell(26, 14, 11, 7), PAL.blush, { a: 0.45, blur: 6, edge: 0 });
  for (const s of [-1, 1]) {
    const ex = s * 18, ey = -6;
    c.save(); c.beginPath(); c.ellipse(ex, ey, 11, 6, 0, 0, TAU); c.clip();
    c.fillStyle = '#5A4A44'; c.beginPath(); c.arc(ex, ey + 2, 6.5, 0, TAU); c.fill();
    c.fillStyle = PAL.hair; c.globalAlpha = 0.9; c.fillRect(ex - 14, ey - 8, 28, 8); c.restore(); // heavy lid
    ink(c, poly([[ex - 12, ey - 1], [ex, ey - 3], [ex + 12, ey - 1]], false), 2.6);
    ink(c, poly([[ex - 10, ey + 3], [ex, ey + 6], [ex + 10, ey + 3]], false), 1.1, 0.5);
    ink(c, poly([[ex - 13, ey - 13], [ex, ey - 17], [ex + 13, ey - 12]], false), 1.4, 0.7);
  }
  ink(c, poly([[-2, 2], [-5, 16], [2, 18]], false), 1.4, 0.6);
  wash(c, smooth([[-9, 30], [0, 27], [9, 30], [0, 35]]), PAL.blush, { a: 0.9, blur: 1 });
  ink(c, poly([[-9, 30], [9, 30]], false), 1.2, 0.7);
  // fringe curls
  for (let i = 0; i < 4; i++) {
    const x = -30 + i * 20, y = -52 + Math.abs(i - 1.5) * 4;
    wash(c, ell(x, y, 15, 13), PAL.hair, { a: 1, blur: 1 }); ink(c, ell(x, y, 15, 13), 1.4);
  }
  c.restore();
}

function trail(c, from, ang) {
  const pts = [], n = 9;
  for (let i = 0; i <= n; i++) {
    const p = at(from, ang, i * 62), w = Math.sin(i * 0.9) * 22;
    const nn = dir(ang + 90); pts.push([p[0] + nn[0] * w, p[1] + nn[1] * w]);
  }
  const L = pts.map((p, i) => { const nn = dir(ang + 90), w = 36 - i * 2.6; return [p[0] + nn[0] * w, p[1] + nn[1] * w]; });
  const Rr = pts.map((p, i) => { const nn = dir(ang + 90), w = 36 - i * 2.6; return [p[0] - nn[0] * w, p[1] - nn[1] * w]; }).reverse();
  const P = smooth([...L, ...Rr]);
  costume(c, P, bbox([...L, ...Rr]), 34);
}

export function drawJester(poseName = 'recline', size = 1024) {
  const P = JESTER_POSES[poseName], k = size / 1024;
  const cvs = cv(size, size), c = cvs.getContext('2d'); c.scale(k, k);
  const hip = P.hip, neck = at(hip, P.t, P.tl), n = dir(P.t + 90);
  const shF = [neck[0] + n[0] * 20, neck[1] + n[1] * 20], shB = [neck[0] - n[0] * 20, neck[1] - n[1] * 20];
  const chain = (s, a, rA, rB, la, lb) => { const e = at(s, a[0], la), w = at(e, a[1], lb); return { e, w, a }; };
  const armR = chain(shF, P.armR, 0, 0, LEN.upper, LEN.fore), armL = chain(shB, P.armL, 0, 0, LEN.upper, LEN.fore);
  const legF = chain(hip, P.legF, 0, 0, LEN.thigh, LEN.shin), legB = chain(hip, P.legB, 0, 0, LEN.thigh, LEN.shin);
  const holderArm = P.hold === 'L' ? armL : armR;

  trail(c, hip, P.trail);
  // far limbs, then torso
  paintLimb(c, hip, legB.e, 34, 26, 30); paintLimb(c, legB.e, legB.w, 26, 18, 30); shoe(c, legB.w, P.legB[1]);
  paintLimb(c, shB, armL.e, 22, 18, 26); paintLimb(c, armL.e, armL.w, 18, 14, 26);
  const nn = dir(P.t + 90);
  const body = smooth([
    [neck[0] + nn[0] * 58, neck[1] + nn[1] * 58], [(neck[0] + hip[0]) / 2 + nn[0] * 48, (neck[1] + hip[1]) / 2 + nn[1] * 48],
    [hip[0] + nn[0] * 62, hip[1] + nn[1] * 62], [hip[0] - nn[0] * 62, hip[1] - nn[1] * 62],
    [(neck[0] + hip[0]) / 2 - nn[0] * 48, (neck[1] + hip[1]) / 2 - nn[1] * 48], [neck[0] - nn[0] * 58, neck[1] - nn[1] * 58],
  ]);
  costume(c, body, bbox([neck, hip], 62), 34);
  // near leg and arm
  paintLimb(c, hip, legF.e, 36, 27, 30); paintLimb(c, legF.e, legF.w, 27, 19, 30); shoe(c, legF.w, P.legF[1]);
  paintLimb(c, shF, armR.e, 23, 19, 26); paintLimb(c, armR.e, armR.w, 19, 14, 26);
  if (P.brush != null) brushShape(c, at(holderArm.w, P.brush, -90), P.brush);
  hand(c, armR.w, P.armR[1]); hand(c, armL.w, P.armL[1]);
  ruffle(c, neck, P.t);
  head(c, at(neck, P.ha, P.hl), P.hr);
  return cvs;
}

/* ---------- paper-moth familiars (body + one wing; the scene mirrors and flaps it) ---------- */
export function drawMoth() {
  const wing = cv(256, 256), w = wing.getContext('2d'), rnd = rng(11);
  const mk = (a0, a1, rmax, col) => {
    const pts = [[8, 128]];
    for (let a = a0; a <= a1; a += 7) {
      const r = rmax * (0.72 + 0.28 * Math.cos((a - (a0 + a1) / 2) * R * 1.4)) + (rnd() - 0.5) * 16;
      pts.push(at([8, 128], a, r));
    }
    const path = poly(pts);
    wash(w, path, PAL.paper, { a: 1, blur: 2, edge: 0 });
    wash(w, path, col, { a: 0.55, blur: 2, edge: 0.5 });
    w.save(); path(w); w.clip(); w.strokeStyle = PAL.ink; w.globalAlpha = 0.22; w.lineWidth = 1.2;
    for (let y = 30; y < 230; y += 9) { w.beginPath(); w.moveTo(20, y); w.lineTo(20 + 60 + rnd() * 140, y); w.stroke(); }
    w.restore();
    ink(w, path, 1.8, 0.8);
  };
  mk(-95, 25, 220, PAL.sage); mk(30, 118, 150, '#8FB3AA');
  const body = cv(128, 128), b = body.getContext('2d');
  const glow = b.createRadialGradient(64, 40, 0, 64, 40, 30);
  glow.addColorStop(0, 'rgba(240,170,60,.5)'); glow.addColorStop(1, 'rgba(240,170,60,0)');
  b.fillStyle = glow; b.fillRect(0, 0, 128, 128);
  wash(b, ell(64, 80, 15, 40), PAL.ink, { a: 1, blur: 1, edge: 0 });
  wash(b, ell(64, 42, 16, 15), PAL.ink, { a: 1, blur: 1, edge: 0 });
  b.fillStyle = '#F2B24C'; for (const x of [57, 71]) { b.beginPath(); b.arc(x, 42, 3.8, 0, TAU); b.fill(); }
  b.strokeStyle = PAL.ink; b.lineWidth = 2.5; b.lineCap = 'round';
  for (const s of [-1, 1]) { b.beginPath(); b.moveTo(64 + s * 6, 29); b.quadraticCurveTo(64 + s * 16, 10, 64 + s * 30, 12); b.stroke(); }
  return { wing, body };
}

/* ---------- flora ---------- */
function poppy(c, x, y, s, rnd) {
  const cols = [PAL.rust, PAL.poppy, PAL.verm];
  for (let i = 0; i < 5; i++) {
    const a = i * 72 * R + rnd() * 0.4, px = x + Math.cos(a) * s * 0.42, py = y + Math.sin(a) * s * 0.42 * 0.8;
    const p = ell(px, py, s * 0.52, s * 0.4, a);
    wash(c, p, cols[i % 3], { a: 0.82, blur: 6 }); ink(c, p, 1.6, 0.7);
  }
  wash(c, ell(x, y, s * 0.16, s * 0.16), PAL.ink, { a: 0.95, blur: 1, edge: 0 });
  c.save(); c.fillStyle = PAL.ink; for (let i = 0; i < 9; i++) { const a = i * 40 * R; c.beginPath(); c.arc(x + Math.cos(a) * s * 0.26, y + Math.sin(a) * s * 0.26, 1.6, 0, TAU); c.fill(); } c.restore();
}
function rose(c, x, y, s) {
  for (let i = 0; i < 4; i++) {
    const r = s * (0.5 - i * 0.1), p = ell(x, y, r, r * 0.92);
    wash(c, p, i % 2 ? PAL.poppy : PAL.rust, { a: 0.85, blur: 5 }); ink(c, p, 1.4, 0.7);
  }
  const sp = []; for (let t = 0; t < 14; t += 0.5) sp.push([x + Math.cos(t * 1.2) * (3 + t * 1.6), y + Math.sin(t * 1.2) * (3 + t * 1.6)]);
  ink(c, poly(sp, false), 1.4, 0.7);
}
function stem(c, x0, y0, x1, y1, rnd) {
  const p = smooth([[x0, y0], [(x0 + x1) / 2 + (rnd() - 0.5) * 30, (y0 + y1) / 2], [x1, y1]], false);
  c.save(); c.strokeStyle = '#7E9890'; c.lineWidth = 4; c.lineCap = 'round'; p(c); c.stroke(); c.restore();
  ink(c, p, 1.2, 0.5);
  const ly = y0 + (y1 - y0) * 0.45, lx = x0 + (x1 - x0) * 0.45;
  for (const s of [-1, 1]) { const lf = smooth([[lx, ly], [lx + s * 30, ly - 14], [lx + s * 58, ly - 4], [lx + s * 30, ly + 8]]); wash(c, lf, '#8AA39C', { a: 0.85, blur: 3 }); ink(c, lf, 1.2, 0.6); }
}
export function drawFlora(kind = 'poppies', seed = 1) {
  const cvs = cv(512, 640), c = cvs.getContext('2d'), rnd = rng(seed * 97 + 3);
  for (let i = 0; i < 26; i++) { // tall grasses
    const x = 20 + rnd() * 470, h = 140 + rnd() * 260, lean = (rnd() - 0.5) * 90;
    const g = smooth([[x, 640], [x + lean * 0.4, 640 - h * 0.55], [x + lean, 640 - h]], false);
    c.save(); c.strokeStyle = i % 3 ? '#9DB0A8' : '#7E9890'; c.globalAlpha = 0.85; c.lineWidth = 2 + rnd() * 3; c.lineCap = 'round'; g(c); c.stroke(); c.restore();
    ink(c, g, 0.9, 0.35);
  }
  const heads = kind === 'roses' ? [[150, 300, 'r'], [340, 210, 'r'], [260, 380, 'p']] : kind === 'grass' ? [] : [[130, 280, 'p'], [270, 170, 'p'], [390, 320, 'p'], [200, 420, 'r']];
  for (const [x, y, t] of heads) { stem(c, x + (rnd() - 0.5) * 40, 640, x, y, rnd); if (t === 'p') poppy(c, x, y, 78 + rnd() * 24, rnd); else rose(c, x, y, 66 + rnd() * 16); }
  return cvs;
}
export function drawStar(col = PAL.verm, size = 128) {
  const cvs = cv(size, size), c = cvs.getContext('2d'), m = size / 2;
  const g = c.createRadialGradient(m, m, 0, m, m, m); g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00');
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  const pts = []; for (let i = 0; i < 8; i++) { const a = i * 45 * R - Math.PI / 2, r = i % 2 ? m * 0.14 : m * 0.82; pts.push([m + Math.cos(a) * r, m + Math.sin(a) * r]); }
  wash(c, poly(pts), col, { a: 1, blur: 3, edge: 0.4 }); return cvs;
}

/* patchwork cloth for banners, ribbons and trains */
export function drawPatchwork(w = 128, h = 512) {
  const cvs = cv(w, h), c = cvs.getContext('2d');
  const r = (cc) => { cc.beginPath(); cc.rect(0, 0, w, h); };
  wash(c, r, PAL.rust, { a: 1, blur: 0, edge: 0 });
  patch(c, r, [0, 0, w, h], 46);
  dots(c, r, [0, 0, w, h], PAL.ink, { gap: 8, r: 2, dx: 0.1, dy: 1, a: 0.22 });
  return cvs;
}

/* ---------- rococo frame, wallpaper, card back ---------- */
function spiral(c, cx, cy, r0, turns, flip) {
  const pts = []; for (let t = 0; t <= turns * 14; t++) { const a = t / 14 * TAU * flip; const r = r0 * (1 - t / (turns * 14) * 0.88); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return smooth(pts, false);
}
function leaf(c, x, y, l, a, col = PAL.warm) {
  const p = smooth([[x, y], at([x, y], a + 28, l * 0.5), at([x, y], a, l), at([x, y], a - 28, l * 0.5)]);
  wash(c, p, col, { a: 0.8, blur: 3, edge: 0.4 }); ink(c, p, 1.2, 0.55);
  ink(c, poly([[x, y], at([x, y], a, l * 0.85)], false), 0.9, 0.4);
}
function scrollMotif(c, x, y, s, flip) {
  c.save(); c.translate(x, y); c.scale(flip * s, s);
  const p = spiral(c, 0, 0, 34, 1.6, 1);
  c.lineCap = 'round'; c.strokeStyle = PAL.stone; c.globalAlpha = 0.9; c.lineWidth = 9; p(c); c.stroke();
  c.globalAlpha = 1; ink(c, p, 1.4, 0.6);
  const tail = smooth([[30, 8], [62, 40], [38, 78], [60, 112]], false); c.strokeStyle = PAL.stone; c.lineWidth = 7; tail(c); c.stroke(); ink(c, tail, 1.2, 0.55);
  leaf(c, 36, 60, 44, 20); leaf(c, 44, 96, 40, 40);
  c.restore();
}
export function drawFrame(w = 700, h = 1200) {
  const cvs = cv(w, h), c = cvs.getContext('2d');
  const band = (inset, wd) => (cc) => { cc.beginPath(); cc.rect(inset, inset, w - inset * 2, h - inset * 2); cc.rect(inset + wd, inset + wd, w - 2 * (inset + wd), h - 2 * (inset + wd)); };
  c.save(); band(10, 66)(c); c.fillStyle = PAL.warm; c.globalAlpha = 0.72; c.shadowColor = PAL.warm; c.shadowBlur = 10; c.fill('evenodd'); c.restore();
  ink(c, (cc) => { cc.beginPath(); cc.rect(10, 10, w - 20, h - 20); }, 1.6, 0.55);
  ink(c, (cc) => { cc.beginPath(); cc.rect(76, 76, w - 152, h - 152); }, 1.6, 0.6);
  ink(c, (cc) => { cc.beginPath(); cc.rect(28, 28, w - 56, h - 56); }, 0.9, 0.35);
  // scrolls down both sides, mirrored
  for (let y = 190; y < h - 260; y += 170) { scrollMotif(c, 43, y, 0.5, 1); scrollMotif(c, w - 43, y, 0.5, -1); }
  // corners
  for (const [x, y, fx, fy] of [[42, 42, 1, 1], [w - 42, 42, -1, 1], [42, h - 42, 1, -1], [w - 42, h - 42, -1, -1]]) {
    c.save(); c.translate(x, y); c.scale(fx, fy);
    wash(c, ell(0, 0, 44, 44), PAL.warm, { a: 0.95, blur: 4 }); ink(c, ell(0, 0, 44, 44), 1.6, 0.7);
    ink(c, spiral(c, 0, 0, 30, 1.8, 1), 1.4, 0.7); leaf(c, 8, 12, 52, 50); leaf(c, 12, 8, 52, 40);
    c.restore();
  }
  // shell crest on top
  const sx = w / 2, sy = 44;
  for (let i = -5; i <= 5; i++) { const a = -90 + i * 15; leaf(c, sx, sy + 26, 66, a, i % 2 ? PAL.warm : PAL.stone); }
  wash(c, ell(sx, sy + 28, 24, 16), PAL.warm, { a: 1, blur: 2 }); ink(c, ell(sx, sy + 28, 24, 16), 1.4, 0.7);
  // cartouche at the bottom
  const by = h - 44;
  wash(c, smooth([[sx - 120, by], [sx - 70, by - 26], [sx + 70, by - 26], [sx + 120, by], [sx + 70, by + 26], [sx - 70, by + 26]]), PAL.warm, { a: 1, blur: 3 });
  ink(c, smooth([[sx - 120, by], [sx - 70, by - 26], [sx + 70, by - 26], [sx + 120, by], [sx + 70, by + 26], [sx - 70, by + 26]]), 1.4, 0.6);
  leaf(c, sx - 124, by, 50, 180); leaf(c, sx + 124, by, 50, 0);
  return cvs;
}
export function drawWallpaper(s = 256) {
  const cvs = cv(s, s), c = cvs.getContext('2d');
  c.strokeStyle = PAL.stone; c.globalAlpha = 0.4; c.lineWidth = 1.2; c.lineCap = 'round';
  const L = (x, y, a, l) => {
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
      const X = x + ox, Y = y + oy, e = at([X, Y], a, l), m1 = at([X, Y], a + 22, l * 0.5), m2 = at([X, Y], a - 22, l * 0.5);
      c.beginPath(); c.moveTo(X, Y); c.quadraticCurveTo(...m1, ...e); c.quadraticCurveTo(...m2, X, Y); c.stroke();
      c.beginPath(); c.moveTo(X, Y); c.lineTo(...at([X, Y], a, l * 0.9)); c.stroke();
    }
  };
  L(60, 70, -50, 70); L(60, 70, 40, 58); L(190, 190, 130, 70); L(190, 190, 220, 58); L(200, 60, 200, 42); L(40, 200, 20, 42);
  return cvs;
}
export function drawCardBack(w = 280, h = 480) {
  const cvs = cv(w, h), c = cvs.getContext('2d');
  c.fillStyle = PAL.paper; c.fillRect(0, 0, w, h);
  c.save(); c.beginPath(); c.rect(18, 18, w - 36, h - 36); c.clip();
  for (let y = 0; y < h; y += 30) for (let x = (y / 30) % 2 ? 0 : 30; x < w + 30; x += 60) {
    c.fillStyle = ((x + y) / 30) % 4 ? PAL.rust : PAL.blush; c.globalAlpha = 0.5;
    c.beginPath(); c.moveTo(x, y - 15); c.lineTo(x + 30, y); c.lineTo(x, y + 15); c.lineTo(x - 30, y); c.closePath(); c.fill();
  }
  c.restore();
  ink(c, (cc) => { cc.beginPath(); cc.rect(10, 10, w - 20, h - 20); }, 2, 0.8);
  ink(c, (cc) => { cc.beginPath(); cc.rect(18, 18, w - 36, h - 36); }, 1, 0.6);
  wash(c, ell(w / 2, h / 2, 54, 54), PAL.paper, { a: 1, blur: 2 }); ink(c, ell(w / 2, h / 2, 54, 54), 1.6);
  c.drawImage(drawStar(PAL.verm, 128), w / 2 - 44, h / 2 - 44, 88, 88);
  return cvs;
}

/* ---------- emblems: one small painted motif per idea, used on covers and card faces ---------- */
function emblem(c, motif, cx, cy, r, o = {}) {
  const P = (path, col, w = 2.4) => { if (o.wash !== false) wash(c, path, col, { a: 0.85, blur: 5 }); if (o.ink !== false) ink(c, path, w, o.inkA ?? 0.85); };
  const col = o.cols || [PAL.rust, PAL.sage, PAL.blush];
  switch (motif) {
    case 'moon': {
      const crescent = (cc) => { cc.beginPath(); cc.arc(cx, cy, r, -57.8 * R, -302.2 * R, true); cc.arc(cx + r * 0.45, cy, r * 0.85, 84.4 * R, 275.6 * R, false); cc.closePath(); };
      P(crescent, PAL.hair, 2.6); for (const [dx, dy, s] of [[0.7, -0.5, 0.18], [0.9, 0.3, 0.12], [0.4, 0.7, 0.1]]) emblemStar(c, cx + dx * r, cy + dy * r, r * s, col[0], o);
      break;
    }
    case 'poppy': for (let i = 0; i < 5; i++) { const a = i * 72 * R - 1.2; P(ell(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, r * 0.55, r * 0.42, a), i % 2 ? PAL.poppy : PAL.rust, 2); } P(ell(cx, cy, r * 0.17, r * 0.17), PAL.ink, 1); break;
    case 'key': P(ell(cx, cy - r * 0.55, r * 0.32, r * 0.32), PAL.gold, 3); P(poly([[cx - 5, cy - r * 0.25], [cx + 5, cy - r * 0.25], [cx + 5, cy + r * 0.75], [cx - 5, cy + r * 0.75]]), PAL.gold, 2.4);
      P(poly([[cx + 5, cy + r * 0.45], [cx + r * 0.3, cy + r * 0.45], [cx + r * 0.3, cy + r * 0.6], [cx + 5, cy + r * 0.6]]), PAL.gold, 2); P(poly([[cx + 5, cy + r * 0.65], [cx + r * 0.22, cy + r * 0.65], [cx + r * 0.22, cy + r * 0.75], [cx + 5, cy + r * 0.75]]), PAL.gold, 2); break;
    case 'star': emblemStar(c, cx, cy, r, col[0], o); emblemStar(c, cx - r * 0.7, cy - r * 0.5, r * 0.28, PAL.hair, o); emblemStar(c, cx + r * 0.75, cy + r * 0.45, r * 0.22, col[0], o); break;
    case 'bird': P(smooth([[cx - r, cy - r * 0.1], [cx - r * 0.4, cy - r * 0.55], [cx, cy - r * 0.05], [cx + r * 0.4, cy - r * 0.55], [cx + r, cy - r * 0.1], [cx + r * 0.3, cy + r * 0.1], [cx + r * 0.15, cy + r * 0.7], [cx, cy + r * 0.15], [cx - r * 0.15, cy + r * 0.7], [cx - r * 0.3, cy + r * 0.1]]), PAL.slate, 2.4); break;
    case 'rose': for (let i = 0; i < 4; i++) P(ell(cx, cy, r * (0.9 - i * 0.2), r * (0.84 - i * 0.2)), i % 2 ? PAL.poppy : PAL.blush, 1.8); break;
    case 'candle': P(poly([[cx - r * 0.22, cy - r * 0.1], [cx + r * 0.22, cy - r * 0.1], [cx + r * 0.25, cy + r * 0.85], [cx - r * 0.25, cy + r * 0.85]]), PAL.hair, 2.4); P(smooth([[cx, cy - r * 0.75], [cx + r * 0.16, cy - r * 0.35], [cx, cy - r * 0.15], [cx - r * 0.16, cy - r * 0.35]]), PAL.verm, 2); break;
    case 'tower': P(poly([[cx - r * 0.3, cy + r * 0.9], [cx - r * 0.3, cy - r * 0.5], [cx - r * 0.45, cy - r * 0.5], [cx - r * 0.45, cy - r * 0.8], [cx - r * 0.2, cy - r * 0.8], [cx - r * 0.2, cy - r * 0.65], [cx + r * 0.2, cy - r * 0.65], [cx + r * 0.2, cy - r * 0.8], [cx + r * 0.45, cy - r * 0.8], [cx + r * 0.45, cy - r * 0.5], [cx + r * 0.3, cy - r * 0.5], [cx + r * 0.3, cy + r * 0.9]]), PAL.stone, 2.4); P(smooth([[cx - r * 0.1, cy + r * 0.9], [cx - r * 0.1, cy + r * 0.45], [cx + r * 0.1, cy + r * 0.45], [cx + r * 0.1, cy + r * 0.9]]), PAL.slate, 1.6); break;
    case 'quill': P(smooth([[cx - r * 0.5, cy + r * 0.9], [cx - r * 0.35, cy - r * 0.1], [cx + r * 0.45, cy - r * 0.9], [cx + r * 0.2, cy + r * 0.05]]), PAL.hair, 2.4); ink(c, poly([[cx - r * 0.5, cy + r * 0.9], [cx + r * 0.3, cy - r * 0.6]], false), 1.4); break;
    case 'eye': P(smooth([[cx - r, cy], [cx, cy - r * 0.55], [cx + r, cy], [cx, cy + r * 0.55]]), PAL.hair, 2.4); P(ell(cx, cy, r * 0.3, r * 0.3), PAL.sage, 2); break;
    case 'wreath': for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; leaf(c, cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8, r * 0.5, a / R + 70, i % 2 ? PAL.sage : '#8AA39C'); } break;
    default: emblemStar(c, cx, cy, r, col[0], o);
  }
}
function emblemStar(c, x, y, r, col, o = {}) {
  const pts = []; for (let i = 0; i < 8; i++) { const a = i * 45 * R - Math.PI / 2, rr = i % 2 ? r * 0.16 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  if (o.wash !== false) wash(c, poly(pts), col, { a: 0.9, blur: 3 }); if (o.ink !== false) ink(c, poly(pts), 1.8, o.inkA ?? 0.85);
}

/* ---------- books: cover, fore-edge, plate, and the layered cover used by the craft steps ---------- */
function wrap(c, text, x, y, maxW, lh) {
  const words = text.split(' '); let line = ''; const out = [];
  for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  out.push(line); out.forEach((l, i) => c.fillText(l, x, y + i * lh)); return out.length;
}
const SERIF = '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';
export function drawCover(p, w = 512, h = 768) {
  const cvs = cv(w, h), c = cvs.getContext('2d'), rnd = rng(p.seed || 5), [c1, c2] = p.palette;
  c.fillStyle = PAL.paper; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 7; i++) wash(c, smooth(Array.from({ length: 7 }, (_, k) => { const a = k / 7 * TAU, r = 120 + rnd() * 120; return [rnd() * w * 0.6 + w * 0.2 + Math.cos(a) * r, rnd() * h * 0.6 + h * 0.2 + Math.sin(a) * r]; })), i % 2 ? c1 : c2, { a: 0.4, blur: 28, edge: 0 });
  const edge = (cc) => { cc.beginPath(); cc.rect(24, 24, w - 48, h - 48); };
  ink(c, edge, 2, 0.7);
  emblem(c, p.motif, w / 2, h * 0.4, 118, { cols: [c1, c2, PAL.blush] });
  c.fillStyle = PAL.paper; c.globalAlpha = 0.9; c.fillRect(44, h * 0.66, w - 88, h * 0.26); c.globalAlpha = 1;
  ink(c, (cc) => { cc.beginPath(); cc.rect(44, h * 0.66, w - 88, h * 0.26); }, 1.4, 0.7);
  c.fillStyle = PAL.ink; c.textAlign = 'center'; c.font = `600 40px ${SERIF}`;
  const n = wrap(c, p.title, w / 2, h * 0.66 + 58, w - 130, 44);
  c.font = `500 20px ${SERIF}`; c.fillStyle = PAL.slate; c.fillText(p.author.toUpperCase().split('').join(' '), w / 2, h * 0.66 + 58 + n * 44 + 14);
  scrollMotif(c, 50, 60, 0.4, 1); scrollMotif(c, w - 50, 60, 0.4, -1);
  return cvs;
}
export function drawEdge(p) {
  const cvs = cv(128, 512), c = cvs.getContext('2d'), rnd = rng((p.seed || 5) + 40);
  c.fillStyle = PAL.paper; c.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 18; i++) wash(c, ell(rnd() * 128, rnd() * 512, 60, 40 + rnd() * 50, rnd() * 3), [p.palette[0], p.palette[1], PAL.blush][i % 3], { a: 0.55, blur: 18, edge: 0 });
  c.strokeStyle = PAL.ink; c.globalAlpha = 0.12; for (let y = 0; y < 512; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(128, y); c.stroke(); }
  return cvs;
}
export function drawPlate(p, w = 512, h = 680) {
  const cvs = cv(w, h), c = cvs.getContext('2d');
  c.fillStyle = '#EFEAE0'; c.fillRect(0, 0, w, h);
  wash(c, ell(w / 2, h * 0.44, 200, 170), p.palette[1], { a: 0.35, blur: 30, edge: 0 });
  emblem(c, p.motif, w / 2, h * 0.44, 130, { cols: [p.palette[0], p.palette[1], PAL.blush] });
  ink(c, (cc) => { cc.beginPath(); cc.rect(34, 34, w - 68, h - 68); }, 1.6, 0.6);
  c.fillStyle = PAL.ink; c.textAlign = 'center'; c.font = `500 18px ${SERIF}`;
  c.fillText('PLATE I', w / 2, h - 80); c.font = `italic 22px ${SERIF}`; c.fillText(p.title, w / 2, h - 52, w - 90);
  return cvs;
}
let _layers;
export function bookLayers(w = 512, h = 768) {
  if (_layers) return _layers;
  const mk = () => cv(w, h), prime = mk(), sketch = mk(), paint = mk(), gild = mk();
  const pc = prime.getContext('2d'); pc.fillStyle = '#C9C2B8'; pc.fillRect(0, 0, w, h);
  for (let i = 0; i < 80; i++) { pc.globalAlpha = 0.06; pc.fillStyle = i % 2 ? '#fff' : PAL.stone; pc.fillRect(0, (i * 53) % h, w, 14); }
  const sc = sketch.getContext('2d'); sc.fillStyle = 'rgba(0,0,0,0)';
  const drawFrameLines = (c, o) => { ink(c, (cc) => { cc.beginPath(); cc.rect(36, 36, w - 72, h - 72); }, 2, o); ink(c, (cc) => { cc.beginPath(); cc.rect(52, 52, w - 104, h - 104); }, 1, o * 0.7); };
  drawFrameLines(sc, 0.8); emblem(sc, 'rose', w / 2, h * 0.42, 130, { wash: false, inkA: 0.75 });
  const cols = { cols: [PAL.rust, PAL.sage, PAL.blush] }; const ptc = paint.getContext('2d');
  wash(ptc, ell(w / 2, h * 0.42, 190, 190), PAL.sage, { a: 0.45, blur: 30, edge: 0 }); emblem(ptc, 'rose', w / 2, h * 0.42, 130, { ...cols, ink: false });
  const gc = gild.getContext('2d'); gc.strokeStyle = PAL.gold; gc.lineWidth = 5; gc.strokeRect(36, 36, w - 72, h - 72); gc.lineWidth = 2; gc.strokeRect(52, 52, w - 104, h - 104);
  gc.fillStyle = PAL.gold; gc.font = `600 44px ${SERIF}`; gc.textAlign = 'center'; gc.fillText('THORNQUILL', w / 2, h * 0.82);
  for (let i = 0; i < 4; i++) emblemStar(gc, 96 + (i % 2) * (w - 192), 96 + Math.floor(i / 2) * (h - 192), 16, PAL.gold, { ink: false });
  return (_layers = { prime, sketch, paint, gild, w, h });
}
/* t: 0 bare board, 1 primed, 2 sketched, 3 painted, 4 gilded */
export function composeBook(out, t) {
  const L = bookLayers(), c = out.getContext('2d');
  c.clearRect(0, 0, out.width, out.height); c.fillStyle = '#9A9087'; c.fillRect(0, 0, out.width, out.height);
  c.globalAlpha = clamp(t); c.drawImage(L.prime, 0, 0, out.width, out.height);
  const s = clamp(t - 1); if (s > 0) { c.save(); c.beginPath(); c.rect(0, 0, out.width, out.height * s); c.clip(); c.globalAlpha = 1; c.drawImage(L.sketch, 0, 0, out.width, out.height); c.restore(); }
  const p = clamp(t - 2); if (p > 0) { c.globalAlpha = p; c.drawImage(L.paint, 0, 0, out.width, out.height); }
  const g = clamp(t - 3); if (g > 0) { c.globalAlpha = g; c.drawImage(L.gild, 0, 0, out.width, out.height); }
  c.globalAlpha = 1;
}

/* ---------- tarot card faces (the closing spread and the draw-a-card reveal) ---------- */
export function drawCardFace({ numeral, name, motif }, w = 420, h = 720) {
  const cvs = cv(w, h), c = cvs.getContext('2d');
  c.fillStyle = PAL.paper; c.fillRect(0, 0, w, h);
  wash(c, ell(w / 2, h * 0.47, 150, 200), PAL.blush, { a: 0.3, blur: 30, edge: 0 });
  emblem(c, motif, w / 2, h * 0.47, 100, { cols: [PAL.rust, PAL.sage, PAL.blush] });
  c.save(); c.globalAlpha = 0.9; c.drawImage(drawFrame(700, 1200), 0, 0, w, h); c.restore();
  c.fillStyle = PAL.ink; c.textAlign = 'center'; c.font = `600 30px ${SERIF}`; c.fillText(numeral.split('').join(' '), w / 2, 126);
  c.font = `600 26px ${SERIF}`; c.fillText(name.toUpperCase(), w / 2, h - 64, w - 150);
  return cvs;
}
export const ARCANA = [
  { id: 'jester', numeral: '0', name: 'The Jester', motif: 'star' },
  { id: 'collection', numeral: 'II', name: 'The High Priestess', motif: 'moon' },
  { id: 'craft', numeral: 'I', name: 'The Magician', motif: 'quill' },
  { id: 'commissions', numeral: 'III', name: 'The Empress', motif: 'poppy' },
  { id: 'about', numeral: 'XVII', name: 'The Star', motif: 'star' },
  { id: 'world', numeral: 'XXI', name: 'The World', motif: 'wreath' },
];
