/* Background shades, wallpaper textures, accent colours and cursive fonts the palette button offers.
   The artwork is painted with orange-red; an accent re-colours just those hues (same maths here and in the shader in scene.js). */

export const SHADES = [
  { id: 'paper', name: 'Paper', paper: '#ECEBE8', line: '#B8B2AC' },
  { id: 'parchment', name: 'Parchment', paper: '#EFE5D3', line: '#BBA98C' },
  { id: 'mist', name: 'Mist', paper: '#E2E9EC', line: '#A5B7BE' },
  { id: 'blush', name: 'Blush', paper: '#F2E3E0', line: '#CBA8A2' },
  { id: 'sage', name: 'Sage', paper: '#E1E8E0', line: '#9FB4A7' },
  { id: 'dusk', name: 'Dusk', paper: '#D9D2CB', line: '#A29890' },
];
export const TEXTURES = [['leaves', 'Leaves'], ['lattice', 'Lattice'], ['dots', 'Dots'], ['linen', 'Linen'], ['plain', 'Plain']];

// hue is 0..1; sat and val scale the re-coloured pixels; main/light/dark are the site's accent shades
export const ACCENTS = [
  { id: 'teal', name: 'Teal', hue: 175 / 360, sat: 0.85, val: 0.95, main: '#3F7B73', light: '#5E9A92', dark: '#2F5E58' },
  { id: 'indigo', name: 'Indigo', hue: 218 / 360, sat: 0.8, val: 0.92, main: '#3F5C8E', light: '#5C79AA', dark: '#2E466F' },
  { id: 'rose', name: 'Rose', hue: 345 / 360, sat: 0.85, val: 1, main: '#B04D6C', light: '#C76A88', dark: '#8E3752' },
  { id: 'forest', name: 'Forest', hue: 135 / 360, sat: 0.75, val: 0.92, main: '#4D7B50', light: '#6C9A6F', dark: '#385C3B' },
  { id: 'rust', name: 'Rust', off: true, main: '#B4482A', light: '#C9542F', dark: '#A33A26' },
];
export const FONTS = [
  { id: 'dancing', name: 'Dancing Script', css: "'Dancing Script'" },
  { id: 'pinyon', name: 'Pinyon Script', css: "'Pinyon Script'" },
  { id: 'vibes', name: 'Great Vibes', css: "'Great Vibes'" },
];
export const accentOf = (id) => ACCENTS.find((a) => a.id === id) || ACCENTS[0];

const KEY = 'opal-ink-look-v1';
export function loadLook() {
  const d = { shade: 'paper', pattern: 'leaves', accent: 'teal', font: 'dancing' };
  try {
    const l = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      shade: SHADES.some((x) => x.id === l.shade) ? l.shade : d.shade, pattern: TEXTURES.some((x) => x[0] === l.pattern) ? l.pattern : d.pattern,
      accent: ACCENTS.some((x) => x.id === l.accent) ? l.accent : d.accent, font: FONTS.some((x) => x.id === l.font) ? l.font : d.font,
    };
  } catch (e) { return d; }
}
export function saveLook(look) { try { localStorage.setItem(KEY, JSON.stringify(look)); } catch (e) { /* storage blocked: the look lasts this visit */ } }

/* ---- pixel version of the shader's accent: only saturated orange-reds change ---- */
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : mx === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
  return [h, mx > 0 ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
}
export function remapCanvas(canvas, acc) {
  if (acc.off) return;
  const ctx = canvas.getContext('2d'), img = ctx.getImageData(0, 0, canvas.width, canvas.height), a = img.data;
  for (let i = 0; i < a.length; i += 4) {
    const [h, s, v] = rgb2hsv(a[i] / 255, a[i + 1] / 255, a[i + 2] / 255);
    let d = Math.abs(h - 0.03); d = Math.min(d, 1 - d);
    const w = (1 - sm(0.022, 0.06, d)) * sm(0.18, 0.38, s);
    if (w < 0.002) continue;
    const o = hsv2rgb(h + (acc.hue - h) * w, Math.min(1, s * (1 + (acc.sat - 1) * w)), Math.min(1, v * (1 + (acc.val - 1) * w)));
    a[i] = o[0] * 255; a[i + 1] = o[1] * 255; a[i + 2] = o[2] * 255;
  }
  ctx.putImageData(img, 0, 0);
}
