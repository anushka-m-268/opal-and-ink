/* The 3D world: six card tableaux standing in a row, one camera that travels between them,
   and a post pass that turns the render into ink line, watercolour bleed, halftone and paper. */
import * as THREE from '../vendor/three/three.module.js';
import { PAL, cv, rng, drawJester, drawMoth, drawFlora, drawStar, drawFrame, drawWallpaper, drawCardFace, drawCardBack,
  drawCover, drawEdge, drawPlate, drawPatchwork, composeBook, ARCANA } from './paint.js';
import { PRODUCTS } from './config.js';

THREE.ColorManagement.enabled = false; // every colour in this file is used exactly as written

export const SP = 11;                  // distance between neighbouring cards along x
const FOV = 30, R = Math.PI / 180;
const CARD = { hw: 1.6, hh: 2.95 };    // half size of the area each tableau paints inside its frame
const GROUND = -2.35;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------- shaders ---------------- */
const NOISE = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }`;

const VS = `
uniform float uTime; uniform float uWave; uniform float uWaveSpeed;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main(){
  vUv = uv; vec3 p = position;
  #ifdef CLOTH
    float k = 1.0 - uv.y;
    p.z += (sin(uv.y*7.0 + uTime*uWaveSpeed + position.x*9.0) + 0.5*sin(position.x*15.0 + uTime*uWaveSpeed*0.6)) * uWave * k;
    p.x += sin(uv.y*4.0 + uTime*uWaveSpeed*0.7) * uWave * 0.4 * k;
  #endif
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FS = `
uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uColor; uniform float uLit, uMarble, uAlpha, uMask, uDot, uTime, uReveal, uOpaque;
uniform vec4 uCard; uniform vec3 uSun; uniform vec2 uUvOff;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
${NOISE}
float cardMask(){
  if (uMask < .5) return 1.;
  vec2 q = (vW.xy - uCard.xy) / uCard.zw;
  float n = fbm(vW.xy*1.5 + 3.)*.35 + vnoise(vW.xy*6.)*.12;
  float T = uReveal*1.75 - .55;
  float bloom = 1. - smoothstep(T-.12, T+.08, length(q*vec2(1.,.62)) + n*.3);
  float edge = 1. - smoothstep(.80, .98, max(abs(q.x), abs(q.y)) + n*.1);
  return bloom*edge;
}
void main(){
  float m = cardMask();
  if (m < .004) discard;
  vec4 base = vec4(uColor, 1.);
  if (uHasMap > .5) { base = texture2D(uMap, vUv + uUvOff); base.rgb *= uColor; }
  vec3 col = base.rgb;
  if (uLit > .5) {
    vec3 N = uLit > 1.5 ? normalize(cross(dFdx(vW), dFdy(vW))) : normalize(vN);
    vec3 V = normalize(cameraPosition - vW);
    if (dot(N, V) < 0.) N = -N;
    float ndl = dot(N, normalize(uSun))*.5 + .5;
    float band = .52 + .24*smoothstep(.34,.40,ndl) + .24*smoothstep(.62,.68,ndl);
    band = mix(band, .5 + .5*ndl, .25);
    col *= band;
    if (uMarble > .5) {
      float cr = 1. - smoothstep(0., .018, abs(fbm(vW.xy*2.1 + vW.z*1.7) - .5));
      col *= 1. - .35*cr*step(.5, vnoise(vW.xy*3.));
      float moss = smoothstep(.55,.75, fbm(vW.xz*2.5 + vW.y)) * smoothstep(-1.0,-2.5, vW.y);
      col = mix(col, vec3(.43,.58,.52)*(.8+.2*band), moss*.75);
    }
    col *= .93 + .14*fbm(vW.xy*18. + vW.z*11.);
    float rim = pow(1. - abs(dot(N, V)), 2.2); col *= 1. - .28*rim;
    float sh = clamp((.5 - ndl)*2.2, 0., 1.);
    if (sh > 0.) {
      vec2 g = mat2(.7071,-.7071,.7071,.7071) * (gl_FragCoord.xy / uDot);
      float d = length(fract(g) - .5), rad = .42*sh;
      col = mix(col, col*.45, (1. - smoothstep(rad-.08, rad+.08, d))*.8);
    }
  }
  float a = base.a * uAlpha;
  if (uOpaque > .5) { if (a < .5 || m < .5 + (vnoise(vW.xy*9.) - .5)*.5) discard; a = 1.; }
  else { a *= m; if (a < .01) discard; }
  gl_FragColor = vec4(col, a);
}`;

const POST_FS = `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes; uniform float uNear, uFar, uTime, uPix, uSimple;
uniform vec3 uPaper, uInk; varying vec2 vUv;
${NOISE}
float lin(vec2 uv){ float d = texture2D(tDepth, uv).x; return uNear*uFar / (uFar - d*(uFar-uNear)); }
float lum(vec3 c){ return dot(c, vec3(.3,.59,.11)); }
void main(){
  vec2 px = 1. / uRes;
  vec2 w = (vec2(fbm(vUv*uRes/90. + uTime*.01), fbm(vUv*uRes/90. + 9.1)) - .5) * 3. * uPix * px;
  if (uSimple > .5) w *= .0;
  vec2 uv = vUv + w;
  vec3 c = texture2D(tColor, uv).rgb;
  vec2 o = px * 2.2 * uPix;
  vec3 b = (texture2D(tColor, uv+vec2(o.x,0.)).rgb + texture2D(tColor, uv-vec2(o.x,0.)).rgb + texture2D(tColor, uv+vec2(0.,o.y)).rgb + texture2D(tColor, uv-vec2(0.,o.y)).rgb) * .25;
  c = mix(c, b, .35);
  float zc = lin(uv);
  float k = mix(1.5, .75, clamp(zc/40., 0., 1.)) * uPix;
  vec2 d = px * k;
  float zl = lin(uv-vec2(d.x,0.)), zr = lin(uv+vec2(d.x,0.)), zu = lin(uv+vec2(0.,d.y)), zd = lin(uv-vec2(0.,d.y));
  float e = max(abs(zl-zr), abs(zu-zd)) / max(zc, .5);
  float line = smoothstep(.02, .055, e);
  float le = abs(lum(texture2D(tColor, uv-vec2(d.x,0.)).rgb) - lum(texture2D(tColor, uv+vec2(d.x,0.)).rgb)) + abs(lum(texture2D(tColor, uv+vec2(0.,d.y)).rgb) - lum(texture2D(tColor, uv-vec2(0.,d.y)).rgb));
  line = max(line, smoothstep(.16, .38, le)*.3);
  c = mix(c, uInk, line * mix(.88, .42, clamp(zc/34., 0., 1.)));
  float g = fbm(uv*uRes/(3.5*uPix));
  c *= .955 + .09*g;
  c += (h21(gl_FragCoord.xy + uTime) - .5) * .022;
  vec2 q = (vUv - .5) * vec2(1., .92);
  float v = smoothstep(.62, .95, length(q)*1.35 + (fbm(vUv*6.) - .5)*.2);
  c = mix(c, uPaper, v*.85);
  gl_FragColor = vec4(c, 1.);
}`;

/* ---------------- materials ---------------- */
const G = { uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-0.5, 0.8, 0.7).normalize() }, uDot: { value: 5 } };
const texCache = new Map();
function T(canvas, key, repeat) {
  if (key && texCache.has(key)) return texCache.get(key);
  const t = new THREE.CanvasTexture(canvas);
  t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (key) texCache.set(key, t);
  return t;
}
/* o: map, color, lit (0 flat, 1 normal-lit, 2 cloth with derivative normals), marble, alpha, transparent, cloth, wave, side */
export function mat(tab, o = {}) {
  const u = {
    ...G,
    uMap: { value: o.map || null }, uHasMap: { value: o.map ? 1 : 0 },
    uColor: { value: new THREE.Color(o.color || '#ffffff') }, uLit: { value: o.lit || 0 }, uMarble: { value: o.marble ? 1 : 0 },
    uAlpha: { value: o.alpha ?? 1 }, uMask: { value: tab ? 1 : 0 }, uWave: { value: o.wave || 0 }, uWaveSpeed: { value: o.waveSpeed || 0.8 },
    uCard: tab ? tab.uCard : { value: new THREE.Vector4() }, uReveal: tab ? tab.uReveal : { value: 1 },
    uOpaque: { value: o.transparent ? 0 : 1 }, uUvOff: { value: new THREE.Vector2() },
  };
  return new THREE.ShaderMaterial({
    uniforms: u, vertexShader: VS, fragmentShader: FS, transparent: !!o.transparent, depthWrite: !o.transparent,
    side: o.side ?? THREE.FrontSide, defines: o.cloth ? { CLOTH: '' } : {},
  });
}
const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };

/* ---------------- geometry kits ---------------- */
function archGeo(w, h, iw, ih, d) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.closePath();
  const hole = new THREE.Path(), r = iw / 2;
  hole.moveTo(-r, 0); hole.lineTo(-r, ih - r); hole.absarc(0, ih - r, r, Math.PI, 0, true); hole.lineTo(r, 0); hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -d / 2); return g;
}
const MARBLE = '#E7E4DF';
function column(tab, x, z, h) {
  const g = new THREE.Group(), m = mat(tab, { color: MARBLE, lit: 1, marble: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.27, h, 24), m, 0, h / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.74, 0.18, 0.74), m, 0, 0.09, 0));
  g.add(mesh(new THREE.BoxGeometry(0.74, 0.16, 0.74), m, 0, h - 0.08, 0));
  const r = mesh(new THREE.TorusGeometry(0.27, 0.05, 8, 24), m, 0, h - 0.22, 0); r.rotation.x = Math.PI / 2; g.add(r);
  g.position.set(x, GROUND, z); return g;
}
function urn(tab, x, z, s = 1) {
  const pts = [[0, 0], [0.22, 0], [0.27, 0.05], [0.2, 0.2], [0.3, 0.45], [0.27, 0.6], [0.34, 0.68], [0.26, 0.7]].map((p) => new THREE.Vector2(p[0], p[1]));
  const o = mesh(new THREE.LatheGeometry(pts, 20), mat(tab, { color: '#DEDAD3', lit: 1, marble: 1, side: THREE.DoubleSide }), x, GROUND, z); o.scale.setScalar(s); return o;
}
function floor(tab, w = 4.2, d = 5, z = 0.3) {
  const c = cv(256, 256), x = c.getContext('2d');
  x.fillStyle = '#E4E1DB'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#D6D2CB'; x.fillRect(0, 0, 128, 128); x.fillRect(128, 128, 128, 128);
  x.strokeStyle = PAL.ink; x.globalAlpha = 0.22; x.lineWidth = 2; x.strokeRect(1, 1, 254, 254); x.strokeRect(1, 1, 128, 128); x.strokeRect(128, 128, 128, 128);
  const t = T(c, 'floor', true); t.repeat.set(w / 1.4, d / 1.4);
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  return mesh(g, mat(tab, { map: t, lit: 1 }), 0, GROUND, z);
}
/* hanging fabric; color 'patch' uses the painted patchwork texture */
function cloth(tab, w, h, color, wave = 0.12, alpha = 1, speed = 0.8) {
  const map = color === 'patch' ? T(drawPatchwork(128, 512), 'patch') : null;
  return mesh(new THREE.PlaneGeometry(w, h, 8, 24), mat(tab, { color: map ? '#ffffff' : color, map, lit: 2, cloth: true, wave, waveSpeed: speed, side: THREE.DoubleSide, transparent: alpha < 1, alpha }));
}

/* a book that can open: spine at -x, fore-edge at +x, front cover toward +z */
function makeBook(tab, p, { W = 1, H = 1.4, D = 0.26, coverTex = null, withPlate = false } = {}) {
  const g = new THREE.Group(), cov = 0.035, [c1] = p.palette;
  const cream = mat(tab, { color: '#EFEAE0', lit: 1 });
  const edge = mat(tab, { map: T(drawEdge(p), 'edge-' + p.id), lit: 1 });
  const cover = mat(tab, { map: coverTex || T(drawCover(p), 'cover-' + p.id), lit: 1 });
  const solid = mat(tab, { color: c1, lit: 1 });
  const pages = new THREE.BoxGeometry(W - 0.05, H - 0.07, D - cov * 2 - 0.01);
  g.add(mesh(pages, [edge, cream, edge, edge, cream, cream], 0.012, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(W, H, cov), [solid, solid, solid, solid, solid, solid], 0, 0, -D / 2 + cov / 2));
  g.add(mesh(new THREE.BoxGeometry(cov * 1.6, H, D), solid, -W / 2 + cov * 0.3, 0, 0));
  const pivot = new THREE.Group(); pivot.position.set(-W / 2, 0, D / 2 - cov / 2);
  pivot.add(mesh(new THREE.BoxGeometry(W, H, cov), [solid, solid, solid, solid, cover, cream], W / 2, 0, 0));
  g.add(pivot);
  if (withPlate) g.add(mesh(new THREE.PlaneGeometry(W - 0.12, H - 0.12), mat(tab, { map: T(drawPlate(p), 'plate-' + p.id), lit: 1 }), 0.01, 0, D / 2 - cov - 0.004));
  g.userData.setOpen = (t) => { pivot.rotation.y = -t * 2.6; };
  return g;
}

/* ---------------- the world ---------------- */
export function createWorld(canvas, opts = {}) {
  const mobile = !!opts.mobile;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 needed');
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 80);
  scene.add(camera);
  let rt = null, simple = mobile;
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: POST_FS,
    uniforms: { tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: camera.near }, uFar: { value: camera.far },
      uTime: G.uTime, uPix: { value: 1 }, uSimple: { value: simple ? 1 : 0 }, uPaper: { value: new THREE.Color(PAL.paper) }, uInk: { value: new THREE.Color(PAL.ink) } },
    depthTest: false, depthWrite: false,
  }));
  const postScene = new THREE.Scene(); postScene.add(post);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // wallpaper backdrop that rides with the camera, drifting a little for parallax
  const wallTex = T(drawWallpaper(), 'wall', true);
  const bgMat = mat(null, { map: wallTex, transparent: true });
  bgMat.depthTest = false;
  const bg = mesh(new THREE.PlaneGeometry(1, 1), bgMat, 0, 0, -60); bg.renderOrder = -10; camera.add(bg);

  /* ---- tableau bookkeeping ---- */
  const tabs = [];
  function tableau(idx, frame = true) {
    const g = new THREE.Group(); g.position.x = idx * SP;
    const tab = { idx, g, uCard: { value: new THREE.Vector4(idx * SP, 0, CARD.hw, CARD.hh) }, uReveal: { value: 0 }, upd: [], frame: null };
    if (frame) {
      const fm = mat(null, { map: T(drawFrame(), 'frame'), transparent: true, alpha: 0 });
      tab.frame = mesh(new THREE.PlaneGeometry(3.85, 6.6), fm, 0, 0, 0.6); g.add(tab.frame);
    }
    scene.add(g); tabs.push(tab); return tab;
  }
  const flora = (k, seed) => T(drawFlora(k, seed), `flora-${k}-${seed}`);
  const sprite = (tab, tex, w, h, x, y, z, o = {}) => { const m = mesh(new THREE.PlaneGeometry(w, h), mat(tab, { map: tex, transparent: true, ...o }), x, y, z); tab.g.add(m); return m; };
  const sparkles = [];
  function sparkle(tab, x, y, z, s, col = PAL.verm) {
    const m = sprite(tab, T(drawStar(col), 'star-' + col), s, s, x, y, z); sparkles.push({ m, s, ph: Math.random() * 6 }); return m;
  }
  const jesterTex = (k) => T(drawJester(k, 1024), 'jester-' + k);

  /* ---- 0 · The Jester ---- */
  const t0 = tableau(0), g0 = t0.g;
  g0.add(mesh(archGeo(3.2, 5.1, 2.4, 3.9, 0.35), mat(t0, { color: '#DAD7D2', lit: 1, marble: 1 }), 0, GROUND, -2.4));
  g0.add(floor(t0)); g0.add(column(t0, -1.2, -0.7, 4.6)); g0.add(column(t0, 1.2, -0.7, 4.6));
  const ped = mat(t0, { color: MARBLE, lit: 1, marble: 1 });
  g0.add(mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.55, 28), ped, 0, GROUND + 0.28, 0.2));
  const ring = mesh(new THREE.TorusGeometry(0.98, 0.06, 8, 32), ped, 0, GROUND + 0.58, 0.2); ring.rotation.x = Math.PI / 2; g0.add(ring);
  const stack = [[0, 1.7, 2.0, 0.28, -6], [1, 1.5, 1.8, 0.26, 9], [2, 1.6, 1.9, 0.26, -4], [3, 1.35, 1.6, 0.24, 11], [4, 1.2, 1.5, 0.22, -8]];
  let sy = GROUND + 0.6;
  stack.forEach(([pi, w, h, d, yaw]) => {
    const b = makeBook(t0, PRODUCTS[pi], { W: w, H: h, D: d }); b.rotation.x = -Math.PI / 2; b.rotation.z = yaw * R;
    b.position.set(0, sy + d / 2, 0.2); sy += d; g0.add(b);
  });
  const hopen = new THREE.Group(); g0.add(hopen);
  const jr = sprite(t0, jesterTex('recline'), 3.9, 3.9, -0.3, sy + 0.62, 1.3, { alpha: 1 });
  const jl = sprite(t0, jesterTex('reclineUp'), 3.9, 3.9, -0.3, sy + 0.62, 1.32, { alpha: 0 });
  for (const x of [0.95, 1.2]) { const cl = cloth(t0, 0.24, 1.5, 'patch', 0.09); cl.position.set(x, sy - 0.75, 1.1); g0.add(cl); }
  for (const x of [-1.25, 1.25]) { g0.add(urn(t0, x, 1.0)); sprite(t0, flora('poppies', x < 0 ? 1 : 4), 1.5, 1.9, x, GROUND + 1.25, 1.05); }
  sprite(t0, flora('grass', 3), 1.8, 1.4, -0.4, GROUND + 0.6, 1.8); sprite(t0, flora('grass', 6), 1.8, 1.4, 0.6, GROUND + 0.6, 1.9);
  sparkle(t0, 0.5, 1.5, 0.8, 0.4); sparkle(t0, -1.0, 1.1, 0.7, 0.25, '#ffffff'); sparkle(t0, 1.1, 0.4, 0.8, 0.22);

  /* ---- 1 · The High Priestess: the collection ---- */
  const t1 = tableau(1), g1 = t1.g;
  g1.add(mesh(archGeo(3.3, 5.4, 2.7, 4.6, 0.45), mat(t1, { color: '#DAD7D2', lit: 1, marble: 1 }), 0, GROUND, -1.6));
  g1.add(floor(t1)); g1.add(column(t1, -1.42, -0.8, 4.4)); g1.add(column(t1, 1.42, -0.8, 4.4));
  const veil = cloth(t1, 2.7, 3.9, '#A9C2BB', 0.1, 0.6, 0.6); veil.position.set(0, 0.4, -1.1); g1.add(veil);
  g1.add(mesh(new THREE.BoxGeometry(3.3, 0.18, 2.1), mat(t1, { color: MARBLE, lit: 1, marble: 1 }), 0, GROUND + 0.09, 0.15));
  const books1 = [], plinthMat = mat(t1, { color: MARBLE, lit: 1, marble: 1 });
  const slots = [[-0.95, 0.9, 0], [-0.32, 0.9, 0], [0.32, 0.9, 0], [0.95, 0.9, 0], [-0.62, -0.2, 1], [0, -0.2, 1], [0.62, -0.2, 1]]; // [x, z, row]
  PRODUCTS.forEach((p, k) => {
    const [x, z, row] = slots[k], ph = row ? 1.05 : 0.5;
    g1.add(mesh(new THREE.CylinderGeometry(0.27, 0.31, ph, 20), plinthMat, x, GROUND + 0.18 + ph / 2, z));
    const b = makeBook(t1, p, { W: 0.6, H: 0.86, D: 0.15 });
    b.position.set(x, GROUND + 0.18 + ph + 0.43, z); b.rotation.y = -x * 0.18; b.rotation.x = -0.05; b.userData.index = k; g1.add(b); books1.push(b);
  });
  const hoverFrame = sprite(t1, T(drawFrame(), 'frame'), 1.0, 1.72, 0, 0, 1.2, { alpha: 0 });
  sprite(t1, flora('grass', 8), 1.8, 1.3, -1.1, GROUND + 0.5, 1.6); sprite(t1, flora('grass', 9), 1.8, 1.3, 1.1, GROUND + 0.5, 1.7);
  sparkle(t1, 0, 2.1, 0, 0.35, '#ffffff'); sparkle(t1, 1.0, 1.4, 0.2, 0.2);

  /* ---- 2 · The Magician: the craft ---- */
  const t2 = tableau(2), g2 = t2.g;
  g2.add(mesh(archGeo(3.0, 5.0, 2.3, 3.9, 0.35), mat(t2, { color: '#DAD7D2', lit: 1, marble: 1 }), 0, GROUND, -2.2));
  g2.add(floor(t2));
  const wood = mat(t2, { color: '#B9A58F', lit: 1 });
  g2.add(mesh(new THREE.BoxGeometry(2.9, 0.16, 1.2), wood, 0, -1.4, 0.3));
  for (const x of [-1.2, 1.2]) g2.add(mesh(new THREE.BoxGeometry(0.14, 1.0, 1.0), wood, x, -1.92, 0.3));
  const craftCanvas = cv(512, 768); composeBook(craftCanvas, 0);
  const craftTex = new THREE.CanvasTexture(craftCanvas); craftTex.anisotropy = 4;
  const bookP = { ...PRODUCTS[0], palette: ['#B4482A', '#6E9C92'] };
  const cb = makeBook(t2, bookP, { W: 1.15, H: 1.65, D: 0.24, coverTex: craftTex }); cb.position.set(0, -0.48, 0.35); cb.rotation.x = -0.1; g2.add(cb);
  const ceramic = mat(t2, { color: '#E3DFD8', lit: 1, marble: 1 });
  const tools = [new THREE.Group(), new THREE.Group(), new THREE.Group(), new THREE.Group()];
  // 0 varnish jar (priming)
  tools[0].add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.4, 20), mat(t2, { color: '#C08A3E', lit: 1 }), 0, 0.2, 0));
  tools[0].add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), mat(t2, { color: '#8B6B55', lit: 1 }), 0, 0.45, 0)); tools[0].position.set(0.75, -1.32, 0.9);
  // 1 brushes in a jar (sketching)
  tools[1].add(mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.34, 18), ceramic, 0, 0.17, 0));
  [-0.07, 0, 0.07].forEach((dx, i) => { const br = new THREE.Group(); br.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.8, 8), mat(t2, { color: '#8B6B55', lit: 1 }), 0, 0.4, 0)); br.add(mesh(new THREE.ConeGeometry(0.028, 0.14, 8), mat(t2, { color: i === 1 ? PAL.ink : PAL.verm, lit: 1 }), 0, 0.84, 0)); br.position.set(dx, 0.2, 0); br.rotation.z = (i - 1) * 0.22; tools[1].add(br); });
  tools[1].position.set(-1.05, -1.32, 0.55);
  // 2 palette (painting)
  const pal = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 28), mat(t2, { color: '#D8C7AE', lit: 1 }), 0, 0.02, 0); pal.scale.z = 0.7; tools[2].add(pal);
  [PAL.rust, PAL.sage, PAL.blush, PAL.verm, PAL.slate].forEach((c, i) => tools[2].add(mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(t2, { color: c, lit: 1 }), -0.22 + i * 0.11, 0.06, -0.08 + (i % 2) * 0.12)));
  tools[2].position.set(-0.5, -1.32, 0.95);
  // 3 gold leaf (gilding)
  for (let i = 0; i < 4; i++) tools[3].add(mesh(new THREE.BoxGeometry(0.46, 0.015, 0.46), mat(t2, { color: '#C9A55A', lit: 1 }), (i % 2) * 0.03, 0.01 + i * 0.016, (i % 3) * 0.02));
  tools[3].position.set(1.05, -1.3, 0.35);
  tools.forEach((t) => { t.scale.setScalar(1.4); g2.add(t); });
  g2.add(urn(t2, -1.35, -0.4)); sprite(t2, flora('poppies', 12), 1.4, 1.8, -1.35, GROUND + 1.2, -0.35);
  const toolSpark = sparkle(t2, 0, 0, 1.2, 0.3);

  /* ---- 3 · The Empress: commissions ---- */
  const t3 = tableau(3), g3 = t3.g;
  g3.add(mesh(archGeo(2.7, 4.8, 1.9, 4.0, 0.25), mat(t3, { color: '#DAD7D2', lit: 1, marble: 1 }), 0, GROUND, -1.9));
  [[-0.95, 1.4], [0.9, 1.7], [-0.7, 2.4], [0.75, 2.7], [0, 3.2]].forEach(([x, y], i) => sprite(t3, flora('roses', 20 + i), 1.1, 1.4, x, y - 2.4, -1.7));
  const lec = mat(t3, { color: MARBLE, lit: 1, marble: 1 });
  g3.add(mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 14), lec, 0, GROUND + 0.55, 0.3));
  g3.add(mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), lec, 0, GROUND + 0.06, 0.3));
  const slab = mesh(new THREE.BoxGeometry(1.5, 0.1, 1.1), lec, 0, GROUND + 1.12, 0.3); slab.rotation.x = 0.9; g3.add(slab);
  const paintCanvas = cv(512, 768); composeBook(paintCanvas, 1);
  const paintTex = new THREE.CanvasTexture(paintCanvas); paintTex.anisotropy = 4;
  const pb = makeBook(t3, { ...PRODUCTS[6], palette: ['#A33A26', '#6E9C92'] }, { W: 1.15, H: 1.6, D: 0.2, coverTex: paintTex });
  pb.rotation.x = -Math.PI / 2 + 0.9; pb.position.set(0, GROUND + 1.55, 0.58); g3.add(pb);
  [[-1.05, 1.0, 'poppies', 31], [-0.2, 1.0, 'poppies', 32], [0.6, 1.1, 'poppies', 33], [1.15, 0.9, 'roses', 34]].forEach(([x, z, k, s]) => sprite(t3, flora(k, s), 1.5, 1.9, x, GROUND + 1.0, -z + 0.4));
  [[-0.9, 0.9, 'roses', 35], [1.0, 1.1, 'poppies', 36]].forEach(([x, z, k, s]) => sprite(t3, flora(k, s), 1.4, 1.75, x, GROUND + 0.85, z + 0.3));
  [-1.0, -0.2, 0.7].forEach((x, i) => sprite(t3, flora('grass', 40 + i), 1.8, 1.3, x, GROUND + 0.5, 1.7));
  sparkle(t3, 0.7, 0.7, 1.0, 0.3);

  /* ---- 4 · The Star: about ---- */
  const t4 = tableau(4), g4 = t4.g;
  g4.add(mesh(new THREE.BoxGeometry(3.2, 0.5, 0.3), mat(t4, { color: MARBLE, lit: 1, marble: 1 }), 0, GROUND + 0.55, -1.5));
  const poolC = cv(1024, 560), pc = poolC.getContext('2d');
  { const gr = pc.createRadialGradient(512, 280, 40, 512, 280, 520); gr.addColorStop(0, '#C9D8D3'); gr.addColorStop(1, '#8FB0A7'); pc.fillStyle = gr; pc.fillRect(0, 0, 1024, 560);
    pc.save(); pc.globalAlpha = 0.4; pc.translate(300, 420); pc.scale(0.5, -0.5); pc.drawImage(drawJester('sit', 1024), -512, -1024, 1024, 1024); pc.restore();
    pc.strokeStyle = PAL.paper; pc.globalAlpha = 0.5; pc.lineWidth = 2; for (let i = 0; i < 12; i++) { pc.beginPath(); pc.ellipse(512, 280, 120 + i * 38, 50 + i * 16, 0, 0, 7); pc.stroke(); }
    for (let i = 0; i < 9; i++) { const sx = 200 + (i * 97) % 640, sy = 120 + (i * 61) % 300; pc.globalAlpha = 0.7; pc.drawImage(drawStar(i % 2 ? PAL.verm : '#ffffff', 64), sx - 16, sy - 16, 32, 32); } }
  const poolG = new THREE.CircleGeometry(1.5, 48); poolG.scale(1, 0.56, 1); poolG.rotateX(-Math.PI / 2);
  const pool = mesh(poolG, mat(t4, { map: new THREE.CanvasTexture(poolC), lit: 1 }), 0, GROUND + 0.5, 0.4); g4.add(pool);
  const rimG = new THREE.TorusGeometry(1.5, 0.1, 8, 48); rimG.scale(1, 0.56, 1); rimG.rotateX(Math.PI / 2);
  const rim = mesh(rimG, mat(t4, { color: MARBLE, lit: 1, marble: 1 }), 0, GROUND + 0.52, 0.4); g4.add(rim);
  sprite(t4, jesterTex('sit'), 3.1, 3.1, -0.9, GROUND + 0.55 + 1.05, 0.5);
  [[-1.2, -1.0, 8], [1.2, -0.9, 9], [0.2, -1.2, 10]].forEach(([x, z, s]) => sprite(t4, flora('grass', s), 1.6, 1.3, x, GROUND + 1.05, z));
  g4.add(urn(t4, 1.25, 0.3, 1.1)); sprite(t4, flora('poppies', 50), 1.2, 1.5, 1.25, GROUND + 1.5, 0.3);
  [-1.1, 0.0, 1.0].forEach((x, i) => sprite(t4, flora('grass', 60 + i), 1.8, 1.3, x, GROUND + 0.5, 1.8));
  const big = sparkle(t4, 0.35, 1.9, -0.6, 1.0);
  { const r = rng(5); for (let i = 0; i < 14; i++) sparkle(t4, (r() - 0.5) * 2.7, 0.3 + r() * 2.3, -0.9 + r() * 0.6, 0.16 + r() * 0.26, i % 2 ? '#ffffff' : PAL.verm); }

  /* ---- 5 · The World: a spread of cards in a ring ---- */
  const t5 = tableau(5, false), g5 = t5.g;
  t5.uCard.value.set(5 * SP, 0, 6.6, 4.6);
  const ringR = 4.2;
  g5.add(mesh(new THREE.CircleGeometry(5.8, 48).rotateX(-Math.PI / 2), mat(t5, { color: '#DEDAD3', lit: 1, marble: 1 }), 0, GROUND, 0));
  const back = T(drawCardBack(), 'cardback');
  const ringCards = [];
  ARCANA.forEach((a, k) => {
    const th = (90 + (k - 5) * 60) * R, x = Math.cos(th) * ringR, z = Math.sin(th) * ringR, cg = new THREE.Group();
    const face = mesh(new THREE.PlaneGeometry(2.1, 3.6), mat(t5, { map: T(drawCardFace(a), 'face-' + a.id) }), 0, 0, 0.012);
    const bk = mesh(new THREE.PlaneGeometry(2.1, 3.6), mat(t5, { map: back }), 0, 0, -0.012); bk.rotation.y = Math.PI;
    cg.add(face, bk); cg.position.set(x, GROUND + 1.8, z); cg.rotation.y = Math.atan2(Math.cos(th), Math.sin(th)); g5.add(cg); ringCards.push(cg);
  });
  sprite(t5, jesterTex('bow'), 3.4, 3.4, 0, GROUND + 1.0, 0, {});
  for (let i = 0; i < 10; i++) sparkle(t5, Math.cos(i * 0.9) * 3.2, 0.3 + (i % 4) * 0.8, Math.sin(i * 0.9) * 1.5, 0.22 + (i % 3) * 0.1, i % 2 ? '#ffffff' : PAL.verm);

  /* ---- the two familiars ---- */
  const mothArt = drawMoth(), wingTex = T(mothArt.wing, 'mothwing'), bodyTex = T(mothArt.body, 'mothbody');
  const moths = [0, 1].map((i) => {
    const g = new THREE.Group(), ws = 0.8;
    const wg = new THREE.PlaneGeometry(ws, ws); wg.translate(ws / 2 - 0.02, 0, 0);
    const wm = mat(null, { map: wingTex, transparent: true, side: THREE.DoubleSide });
    const wr = new THREE.Mesh(wg, wm), wl = new THREE.Mesh(wg, wm); wl.scale.x = -1;
    const body = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), mat(null, { map: bodyTex, transparent: true, side: THREE.DoubleSide })); body.position.z = 0.03;
    const rib = cloth(null, 0.08, 0.7, i ? PAL.verm : PAL.rust, 0.06, 1, 1.4); rib.position.set(0, -0.5, -0.02);
    g.add(wr, wl, body, rib); g.scale.setScalar(0.45); scene.add(g);
    return { g, wr, wl, ph: i * 2.1, pos: new THREE.Vector3(i ? 1 : -1, 1, 3), land: 0 };
  });

  /* ---- camera path ---- */
  let anchors = [], scrollY = 0, smoothY = 0, camCard = 0, speed = 0, lastFocusX = 0;
  const pointer = { x: 0, y: 0 }, state = { craft: 0, paint: 0, lift: 0, hover: -1, tool: -1 };
  let size = { w: 1, h: 1, aspect: 1 }, time = 0, still = !!opts.reduced;
  const tanH = Math.tan(FOV * 0.5 * R);
  function poseCam(p) {
    const a = size.aspect, d = Math.max((p.fitH / 2) / tanH, (p.fitW / 2) / (tanH * a)) * (p.dist || 1);
    const W = 2 * d * tanH * a, H = 2 * d * tanH, wide = a > 1.15;
    // text on the left puts the card right of centre, so the camera looks left of the card
    const fx = p.card * SP + (wide ? (p.side === 'left' ? -1 : p.side === 'right' ? 1 : 0) * 0.19 * W : 0);
    const fy = (p.lookY || 0) - (wide ? 0 : 0.2 * H);
    const f = new THREE.Vector3(fx, fy, p.focusZ || 0), yaw = p.yaw || 0, pit = p.pitch || 0;
    const pos = new THREE.Vector3(f.x + Math.sin(yaw) * Math.cos(pit) * d, f.y + Math.sin(pit) * d, f.z + Math.cos(yaw) * Math.cos(pit) * d);
    return { f, pos, card: p.card };
  }
  const tmpF = new THREE.Vector3(), tmpP = new THREE.Vector3();
  function updateCamera(dt) {
    if (!anchors.length) return;
    let i = 0; while (i < anchors.length - 1 && smoothY > anchors[i + 1].y) i++;
    const A = anchors[i], B = anchors[Math.min(i + 1, anchors.length - 1)];
    const span = Math.max(1, B.y - A.y), t = Math.min(1, Math.max(0, (smoothY - A.y) / span)), e = sstep(0.18, 0.82, t);
    const a = poseCam(A), b = poseCam(B), travel = A.card !== B.card ? Math.sin(Math.PI * e) : 0;
    tmpF.lerpVectors(a.f, b.f, e); tmpP.lerpVectors(a.pos, b.pos, e);
    const dir = new THREE.Vector3().subVectors(tmpP, tmpF), len = dir.length();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), travel * 0.22 * (B.card > A.card ? 1 : -1));
    dir.multiplyScalar(1 + travel * 0.45);
    if (!still) { tmpF.x += pointer.x * 0.25; tmpF.y += pointer.y * 0.15; dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), pointer.x * 0.05 + Math.sin(time * 0.17) * 0.025); }
    camera.position.copy(tmpF).add(dir); camera.lookAt(tmpF);
    camCard = lerp(A.card, B.card, e);
    const fx = tmpF.x; speed = lerp(speed, dt > 0 ? (fx - lastFocusX) / dt : 0, 0.08); lastFocusX = fx;
    state.lift = lerp(A.lift ?? 0, B.lift ?? 0, e);
    state.craft = lerp(A.craft ?? 0, B.craft ?? 0, e);
    state.paint = lerp(A.paint ?? 0, B.paint ?? 0, e);
    state.tool = (A.tool ?? -1) >= 0 && e < 0.5 ? A.tool : (B.tool ?? -1);
  }

  /* ---- per-frame work ---- */
  const bookWorld = new THREE.Vector3();
  let lastCraft = -1, lastPaint = -1, hoverA = 0;
  function step(dt) {
    time += dt; G.uTime.value = still ? 0 : time;
    smoothY = still ? scrollY : lerp(smoothY, scrollY, 1 - Math.exp(-dt * 5));
    updateCamera(dt);
    for (const tab of tabs) {
      const rev = 1 - sstep(0.3, 0.95, Math.abs(camCard - tab.idx)); tab.uReveal.value = rev;
      if (tab.frame) { const e = sstep(0, 1, rev); tab.frame.material.uniforms.uAlpha.value = sstep(0.1, 0.6, rev); tab.frame.scale.set(0.74 + 0.26 * e, 0.88 + 0.12 * e, 1); }
    }
    jr.material.uniforms.uAlpha.value = 1 - state.lift; jl.material.uniforms.uAlpha.value = state.lift;
    if (Math.abs(state.craft - lastCraft) > 0.01) { composeBook(craftCanvas, state.craft); craftTex.needsUpdate = true; lastCraft = state.craft; }
    if (Math.abs(state.paint - lastPaint) > 0.01) { composeBook(paintCanvas, 1 + 2.4 * state.paint); paintTex.needsUpdate = true; lastPaint = state.paint; }
    tools.forEach((t, i) => { const base = [ -1.32, -1.32, -1.32, -1.3 ][i], want = state.tool === i ? 0.28 : 0; t.position.y = lerp(t.position.y, base + want, 0.1); });
    const tl = tools[Math.max(0, state.tool)]; toolSpark.position.set(tl.position.x, tl.position.y + 0.8, 1.2); toolSpark.visible = state.tool >= 0;
    ringCards.forEach((c, k) => { c.position.y = GROUND + 1.8 + (still ? 0 : Math.sin(time * 0.6 + k) * 0.06); });
    for (const s of sparkles) s.m.scale.setScalar(still ? 1 : 0.75 + 0.25 * Math.sin(time * 1.6 + s.ph));
    hoverA = lerp(hoverA, state.hover >= 0 ? 1 : 0, 0.12);
    hoverFrame.material.uniforms.uAlpha.value = hoverA * 0.9;
    if (state.hover >= 0) { books1[state.hover].getWorldPosition(bookWorld); hoverFrame.position.set(bookWorld.x - g1.position.x, bookWorld.y, bookWorld.z + 0.5); }
    moths.forEach((m, i) => {
      const land = i === 0 && state.hover >= 0;
      let tx, ty, tz;
      if (land) { books1[state.hover].getWorldPosition(bookWorld); tx = bookWorld.x; ty = bookWorld.y + 0.55; tz = bookWorld.z + 0.2; }
      else {
        const fx = camCard * SP, a = time * 0.5 + m.ph;
        tx = fx + Math.max(-4, Math.min(4, speed * 0.35)) + Math.cos(a) * (1.4 + i * 0.25); ty = 0.7 + Math.sin(time * 0.8 + m.ph * 2) * 0.9; tz = 1.6 + Math.sin(time * 0.45 + m.ph) * 0.6;
      }
      m.pos.x = lerp(m.pos.x, tx, still ? 1 : 0.05); m.pos.y = lerp(m.pos.y, ty, still ? 1 : 0.05); m.pos.z = lerp(m.pos.z, tz, still ? 1 : 0.05);
      m.g.position.copy(m.pos); m.g.rotation.set(0, Math.sin(time * 0.6 + m.ph) * 0.4, Math.sin(time * 0.9 + m.ph) * 0.1);
      const flap = still ? 0.4 : land && m.pos.distanceTo(new THREE.Vector3(tx, ty, tz)) < 0.2 ? 0.2 + Math.sin(time * 2) * 0.15 : Math.abs(Math.sin(time * 7 + m.ph)) * 1.0;
      m.wr.rotation.set(0, -flap, 0.35); m.wl.rotation.set(0, flap, -0.35);
    });
    // wallpaper: tile it to the view and slide it slightly with the camera for parallax
    bg.scale.set(2 * 60 * tanH * camera.aspect * 1.15, 2 * 60 * tanH * 1.15, 1);
    bgMat.uniforms.uUvOff.value.set(camera.position.x * 0.02, 0);
    const uv = bg.geometry.attributes.uv, rx = bg.scale.x / 3.4, ry = bg.scale.y / 3.4;
    if (bg.userData.rx !== rx || bg.userData.ry !== ry) { uv.setXY(0, 0, ry); uv.setXY(1, rx, ry); uv.setXY(2, 0, 0); uv.setXY(3, rx, 0); uv.needsUpdate = true; bg.userData.rx = rx; bg.userData.ry = ry; }
  }
  function draw() {
    if (!rt) return;
    renderer.setRenderTarget(rt); renderer.setClearColor(PAL.paper, 1); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(postScene, postCam);
  }

  /* ---- sizing and loop ---- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight, pr = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75);
    if (w < 2 || h < 2) { rt = null; return; } // hidden or not laid out yet: wait for the next resize
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    const bw = Math.floor(w * pr), bh = Math.floor(h * pr);
    if (rt) { rt.dispose(); rt.depthTexture.dispose(); }
    rt = new THREE.WebGLRenderTarget(bw, bh, { depthTexture: new THREE.DepthTexture(bw, bh), minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    post.material.uniforms.tColor.value = rt.texture; post.material.uniforms.tDepth.value = rt.depthTexture;
    post.material.uniforms.uRes.value.set(bw, bh); post.material.uniforms.uPix.value = pr; G.uDot.value = 5 * pr;
    camera.aspect = w / h; camera.updateProjectionMatrix(); size = { w, h, aspect: w / h };
    if (still) { step(0); draw(); }
  }
  let raf = 0, last = 0, running = false;
  function frame(now) { if (!running) return; raf = requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; step(dt); draw(); }
  function start() { if (running || still) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  resize();

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  return {
    start, stop, resize, state, still: (v) => { still = v; if (v) { stop(); step(0); draw(); } else start(); },
    setAnchors: (a) => { anchors = a; },
    setScroll: (y, snap) => { scrollY = y; if (snap || still) { smoothY = y; } if (still) { step(0); draw(); } },
    setPointer: (x, y) => { pointer.x = x; pointer.y = y; },
    setHover: (i) => { state.hover = i; },
    pick: (cx, cy) => {
      if (tabs[1].uReveal.value < 0.5) return -1;
      const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); const hit = ray.intersectObjects(books1, true)[0];
      if (!hit) return -1; let o = hit.object; while (o && o.userData.index === undefined) o = o.parent; return o ? o.userData.index : -1;
    },
    renderNow: () => { step(0); draw(); },
    ok: () => renderer.getContext() && !renderer.getContext().isContextLost(),
    camera, SP,
  };
}

/* ---------------- the product viewer: one book you can turn and open ---------------- */
export function createBookViewer(canvas, product) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30); cam.position.set(0, 0.1, 5.2);
  const book = makeBook(null, product, { W: 1.3, H: 1.85, D: 0.3, withPlate: true }); scene.add(book);
  // ink outline: a slightly inflated copy of every mesh, drawn inside-out behind it
  const hullMat = new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal*0.012, 1.); }', fragmentShader: 'void main(){ gl_FragColor = vec4(.227,.184,.173,1.); }' });
  const meshes = []; book.traverse((o) => { if (o.isMesh) meshes.push(o); });
  meshes.forEach((o) => o.add(new THREE.Mesh(o.geometry, hullMat)));
  let ry = -0.5, rx = 0.12, open = 0, openT = 0, drag = null, raf = 0, dirty = true;
  const draw = () => { open = lerp(open, openT, 0.12); book.userData.setOpen(open); book.rotation.set(rx, ry + open * 0.5, 0); book.position.x = open * 0.35; renderer.render(scene, cam); };
  const loop = () => { raf = requestAnimationFrame(loop); if (!drag && Math.abs(open - openT) < 0.002 && !dirty && openT === 0) ry += 0.003; draw(); dirty = false; };
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); dirty = true; };
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY; ry += dx * 0.01; rx = Math.max(-0.5, Math.min(0.5, rx + dy * 0.006)); dirty = true; });
  canvas.addEventListener('pointerup', () => { if (drag && drag.moved < 5) openT = openT ? 0 : 1; drag = null; });
  resize(); loop();
  return { resize, toggle: () => { openT = openT ? 0 : 1; }, isOpen: () => openT === 1, rotate: (d) => { ry += d; dirty = true; }, dispose: () => { cancelAnimationFrame(raf); renderer.dispose(); } };
}
