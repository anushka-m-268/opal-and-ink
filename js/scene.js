/* The 3D world: six card tableaux standing in a row, one camera that travels between them,
   and a post pass that turns the render into ink line, watercolour bleed, halftone and paper. */
import * as THREE from '../vendor/three/three.module.js';
import { PAL, cv, rng, drawStar, drawWallpaper, drawCardBack, drawCover, drawEdge, drawPlate, composeBook, emblem, ARCANA, DECK } from './paint.js';
import { PRODUCTS } from './config.js';

THREE.ColorManagement.enabled = false; // every colour in this file is used exactly as written

export const SP = 11;                  // distance between neighbouring cards along x
const FOV = 30, R = Math.PI / 180;
const CARD = { hw: 1.8, hh: 3.2 };    // half size of the area each tableau paints inside its frame
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
uniform vec4 uCard; uniform vec3 uSun; uniform vec2 uUvOff; uniform vec3 uTint; uniform vec4 uAccent;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
${NOISE}
vec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); float e=1e-10; return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)), d/(q.x+e), q.x); }
vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }
vec3 accentShift(vec3 rgb){
  if (uAccent.w < .5) return rgb;
  vec3 h = rgb2hsv(rgb); float d = abs(h.x - .03); d = min(d, 1. - d);
  float w = (1. - smoothstep(.022, .06, d)) * smoothstep(.18, .38, h.y);
  h.x = mix(h.x, uAccent.x, w); h.y = min(1., h.y * mix(1., uAccent.y, w)); h.z = min(1., h.z * mix(1., uAccent.z, w));
  return hsv2rgb(h);
}
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
  if (uHasMap > .5) { base = texture2D(uMap, vUv + uUvOff); base.rgb = accentShift(base.rgb) * uColor * uTint; }
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
      vec2 g = mat2(.7071,-.7071,.7071,.7071) * ((vW.xy + vW.z*.37) * 38.);
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
uniform vec3 uPaper, uInk; uniform float uWipe; varying vec2 vUv;
${NOISE}
float lin(vec2 uv){ float d = texture2D(tDepth, uv).x; return uNear*uFar / (uFar - d*(uFar-uNear)); }
float lum(vec3 c){ return dot(c, vec3(.3,.59,.11)); }
void main(){
  vec2 px = 1. / uRes;
  vec2 w = (vec2(fbm(vUv*uRes/90.), fbm(vUv*uRes/90. + 9.1)) - .5) * 3. * uPix * px;
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
  c += (h21(gl_FragCoord.xy) - .5) * .022;
  vec2 q = (vUv - .5) * vec2(1., .92);
  float v = smoothstep(.62, .95, length(q)*1.35 + (fbm(vUv*6.) - .5)*.2);
  c = mix(c, uPaper, v*.85);
  // ink-wash transition between cards: paper floods in through a noisy front, then drains away
  float wn = fbm(vUv*vec2(2.6, 4.2) + vec2(1.7, .3));
  float cover = smoothstep(wn - .1, wn + .1, uWipe*1.08);
  float rim = smoothstep(.02, .12, cover) * (1. - smoothstep(.12, .4, cover));
  c = mix(c, uInk, rim * .16);
  c = mix(c, uPaper * .985, cover * .94);
  gl_FragColor = vec4(c, 1.);
}`;

/* ---------------- materials ---------------- */
const G = { uAccent: { value: new THREE.Vector4(0, 1, 1, 0) }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uTime: { value: 0 }, uSun: { value: new THREE.Vector3(-0.5, 0.8, 0.7).normalize() }, uDot: { value: 5 } };
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
  let rt = null, simple = mobile, clearHex = PAL.paper;
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: POST_FS,
    uniforms: { tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: camera.near }, uFar: { value: camera.far },
      uTime: G.uTime, uPix: { value: 1 }, uSimple: { value: simple ? 1 : 0 }, uWipe: { value: 0 }, uPaper: { value: new THREE.Color(PAL.paper) }, uInk: { value: new THREE.Color(PAL.ink) } },
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
      const fm = mat(null, { map: art('frame'), transparent: true, alpha: 0 });
      tab.frame = mesh(new THREE.PlaneGeometry(4.55, 8.0), fm, 0, 0, 0.6); g.add(tab.frame);
    }
    scene.add(g); tabs.push(tab); return tab;
  }
  const sprite = (tab, tex, w, h, x, y, z, o = {}) => { const m = mesh(new THREE.PlaneGeometry(w, h), mat(tab, { map: tex, transparent: true, ...o }), x, y, z); tab.g.add(m); return m; };
  const sparkles = [];
  function sparkle(tab, x, y, z, s, col = PAL.verm) {
    const m = sprite(tab, T(drawStar(col), 'star-' + col), s, s, x, y, z); sparkles.push({ m, s, ph: Math.random() * 6 }); return m;
  }
  // illustrated layers (assets/art/*.webp): a plane per layer, scaled so it looks the same size from the nominal camera distance
  const loader = new THREE.TextureLoader(), D = 13;
  const artTex = new Map();
  const art = (n) => { if (!artTex.has(n)) { const t = loader.load(`assets/art/${n}.webp`); t.anisotropy = 4; artTex.set(n, t); } return artTex.get(n); };
  function layer(tab, name, z, { w = 3.6, h = 6.45, x = 0, y = 0 } = {}) {
    const s = (D - z) / D, m = mesh(new THREE.PlaneGeometry(w * s, h * s), mat(tab, { map: art(name), transparent: true }), x * s, y * s, z);
    m.userData.base = m.position.y; tab.g.add(m); return m;
  }

  /* ---- 0 · The Jester ---- */
  const t0 = tableau(0);
  layer(t0, 'hero-bg', -1.2);
  const subject = layer(t0, 'hero-fg', 0.5);
  sparkle(t0, 0.55, 1.65, 0.9, 0.34); sparkle(t0, -0.95, 0.9, 0.9, 0.22, '#ffffff'); sparkle(t0, 1.05, 0.1, 0.9, 0.2);

  /* ---- 1 · The High Priestess: the collection ---- */
  const t1 = tableau(1), g1 = t1.g;
  layer(t1, 'collection', -0.5);
  const books1 = [];
  // [x, y, z] of each book, measured from the six plinth tops (and the dais step) in the artwork
  const slots = [[0, -0.73, 0.1], [-0.373, -0.957, 0.15], [0.398, -1.007, 0.15], [-0.548, -1.207, 0.25], [0.553, -1.357, 0.25], [0, -1.533, 0.3], [-0.848, -1.73, 0.35]];
  PRODUCTS.forEach((p, k) => {
    const [x, y, z] = slots[k], b = makeBook(t1, p, { W: 0.42, H: 0.6, D: 0.16 });
    b.position.set(x, y, z); b.rotation.y = (k % 2 ? -1 : 1) * 0.3; b.userData.index = k; g1.add(b); books1.push(b);
  });
  const hoverFrame = sprite(t1, art('frame'), 0.8, 1.4, 0, 0, 0.8, { alpha: 0 });

  /* ---- 2 · The Magician: the craft ---- */
  const t2 = tableau(2), g2 = t2.g;
  layer(t2, 'craft', -0.5);
  const craftCanvas = cv(512, 768); composeBook(craftCanvas, 0);
  const craftTex = new THREE.CanvasTexture(craftCanvas); craftTex.anisotropy = 4;
  const cb = makeBook(t2, { ...PRODUCTS[0], palette: ['#B4482A', '#6E9C92'] }, { W: 0.9, H: 1.3, D: 0.2, coverTex: craftTex });
  cb.position.set(0.065, -0.15, 0.25); cb.rotation.x = -0.04; g2.add(cb);
  // where each step's tool sits in the artwork: varnish, brushes, palette, gold leaf
  const toolPos = [[1.08, -0.4], [-0.574, -0.1], [0.78, -0.86], [0.72, -0.57]];
  const toolSpark = sparkle(t2, 0, 0, 0.8, 0.3);

  /* ---- 3 · The Empress: commissions ---- */
  const t3 = tableau(3), g3 = t3.g;
  layer(t3, 'empress', -0.5);
  const paintCanvas = cv(512, 768); composeBook(paintCanvas, 1);
  const paintTex = new THREE.CanvasTexture(paintCanvas); paintTex.anisotropy = 4;
  const pb = makeBook(t3, { ...PRODUCTS[6], palette: ['#A33A26', '#6E9C92'] }, { W: 1.0, H: 1.4, D: 0.16, coverTex: paintTex });
  pb.position.set(-0.05, 0.62, 0.3); pb.rotation.x = -0.28; g3.add(pb);
  sparkle(t3, 0.7, 0.9, 0.8, 0.3);

  /* ---- 4 · The Star: about ---- */
  const t4 = tableau(4);
  layer(t4, 'star', -0.3);
  sparkle(t4, 0.15, 2.2, 0.6, 1.1);
  { const r = rng(5); for (let i = 0; i < 9; i++) sparkle(t4, (r() - 0.5) * 2.6, 1.0 + r() * 1.7, 0.5, 0.14 + r() * 0.2, i % 2 ? '#ffffff' : PAL.verm); }

  /* ---- 5 · The World: a spread of cards in a ring ---- */
  const t5 = tableau(5, false), g5 = t5.g;
  t5.uCard.value.set(5 * SP, 0, 11, 6.6);
  const ringR = 4.2;
  g5.add(mesh(new THREE.CircleGeometry(10, 64).rotateX(-Math.PI / 2), mat(t5, { color: '#DEDAD3', lit: 1, marble: 1 }), 0, GROUND, 0));
  const back = T(drawCardBack(), 'cardback');
  const faceArt = { jester: ['hero-bg', 'hero-fg'], collection: ['collection'], craft: ['craft'], commissions: ['empress'], about: ['star'], world: ['star-bg'] };
  function faceTex(a) {
    const c = cv(420, 720), x = c.getContext('2d'), t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    const load = (n) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = `assets/art/${n}.webp`; });
    const paint = (imgs, fr) => {
      x.fillStyle = PAL.paper; x.fillRect(0, 0, 420, 720);
      if (!faceArt[a.id]) { x.fillStyle = PAL.paper; x.fillRect(71, 146, 278, 453); emblem(x, a.motif, 210, 372, 92, { cols: [PAL.rust, PAL.sage, PAL.blush] }); }
      for (const im of imgs) if (im) x.drawImage(im, 53, 92, 314, 562);
      if (fr) x.drawImage(fr, 0, 0, 420, 720);
      x.fillStyle = PAL.ink; x.textAlign = 'center';
      x.font = '700 27px "Dancing Script", cursive'; x.fillText(a.numeral, 210, 128);
      x.font = '700 24px "Dancing Script", cursive'; x.fillText(a.name, 210, 666, 200);
      t.needsUpdate = true;
    };
    const art2 = faceArt[a.id] || [];
    paint([], null);
    Promise.all([...art2.map(load), load('frame')]).then((r) => paint(r.slice(0, -1), r[r.length - 1]));
    return t;
  }
  const ringCards = [];
  ARCANA.forEach((a, k) => {
    const th = (90 + (k - 5) * 60) * R, x = Math.cos(th) * ringR, z = Math.sin(th) * ringR, cg = new THREE.Group();
    const face = mesh(new THREE.PlaneGeometry(2.1, 3.6), mat(t5, { map: faceTex(a) }), 0, 0, 0.012);
    const bk = mesh(new THREE.PlaneGeometry(2.1, 3.6), mat(t5, { map: back }), 0, 0, -0.012); bk.rotation.y = Math.PI;
    cg.add(face, bk); cg.position.set(x, GROUND + 1.8, z); cg.rotation.y = Math.atan2(Math.cos(th), Math.sin(th)); g5.add(cg); ringCards.push(cg);
  });
  const sceneIds = new Set(ARCANA.map((a) => a.id)), outer = DECK.filter((d) => !sceneIds.has(d.id));
  outer.forEach((a, k) => { // the other sixteen cards stand in a wider ring behind
    const th = (k / outer.length) * Math.PI * 2 + 0.1, x = Math.cos(th) * 8.6, z = Math.sin(th) * 8.6, cg = new THREE.Group();
    const face = mesh(new THREE.PlaneGeometry(2.1, 3.6), mat(t5, { map: faceTex(a) }), 0, 0, 0.012);
    const bk = mesh(new THREE.PlaneGeometry(2.1, 3.6), mat(t5, { map: back }), 0, 0, -0.012); bk.rotation.y = Math.PI;
    cg.add(face, bk); cg.position.set(x, GROUND + 1.8, z); cg.rotation.y = Math.atan2(Math.cos(th), Math.sin(th)); cg.scale.setScalar(0.92); g5.add(cg); ringCards.push(cg);
  });
  sprite(t5, art('hero-fg'), 1.9, 3.4, 0, GROUND + 1.7, 0);
  for (let i = 0; i < 10; i++) sparkle(t5, Math.cos(i * 0.9) * 3.2, 0.3 + (i % 4) * 0.8, Math.sin(i * 0.9) * 1.5, 0.22 + (i % 3) * 0.1, i % 2 ? '#ffffff' : PAL.verm);

  /* ---- the two paper-moth familiars: the picture is cut down the middle of the body and each wing half hinges on it, so the wings really beat ---- */
  const MB = 0.45, MW = 0.9, MH = 0.86, MBY = 0.38; // where the body sits across and down the picture, and its size in the world
  const mothMat = mat(null, { map: art('moth-b'), transparent: true, side: THREE.DoubleSide });
  const halfGeo = (w, u0, u1, hinge) => { const g = new THREE.PlaneGeometry(w, MH), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0)); g.translate(hinge * w / 2, 0, 0); return g; };
  const moths = [0, 1].map((i) => {
    const g = new THREE.Group(), y = -(0.5 - MBY) * MH;
    const wl = new THREE.Mesh(halfGeo(MW * MB, 0, MB, -1), mothMat), wr = new THREE.Mesh(halfGeo(MW * (1 - MB), MB, 1, 1), mothMat);
    const body = new THREE.Mesh(halfGeo(MW * 0.1, MB - 0.05, MB + 0.05, 0), mothMat); body.position.z = 0.01;
    for (const m of [wl, wr, body]) m.position.y = y;
    g.add(wl, wr, body); g.scale.setScalar(i ? 0.5 : 0.62); scene.add(g);
    return { g, wl, wr, ph: i * 2.1, pos: new THREE.Vector3(i ? 1 : -1, 1, 3) };
  });

  /* ---- floating objects in the margins of each card: they bob and fade with their card ---- */
  // each card's objects sit on the side away from its text (text is left of 0, 2, 4 and 5, right of 1 and 3)
  const FSIZE = { 'el-book': [1.05, 0.8], 'el-tassel': [0.62, 1.3], 'el-key': [0.42, 1.0], 'el-poppy': [0.48, 1.2], 'el-lantern': [0.6, 1.0], 'el-mirror': [0.54, 1.1], 'el-bow': [0.6, 1.1], 'el-feather': [0.68, 1.1], 'el-moon': [0.75, 0.7] };
  const FSET = [
    [t0, 1, ['el-book', 'el-tassel', 'el-key', 'el-poppy']], [t1, -1, ['el-lantern', 'el-book', 'el-mirror', 'el-bow']],
    [t2, 1, ['el-feather', 'el-key', 'el-lantern', 'el-tassel']], [t3, -1, ['el-poppy', 'el-bow', 'el-mirror', 'el-feather']],
    [t4, 1, ['el-moon', 'el-lantern', 'el-key', 'el-book']], [t5, 1, ['el-moon', 'el-book', 'el-tassel', 'el-bow']],
  ];
  const FX = [2.5, 2.8, 2.5, 2.7], FY = [1.9, 0.6, -0.7, -1.9], FZ = [1.4, 1.1, 1.5, 1.2];
  const floaters = FSET.flatMap(([tab, sg, names]) => names.map((n, i) => {
    const [w, h] = FSIZE[n], m = mesh(new THREE.PlaneGeometry(w, h), mat(null, { map: art(n), transparent: true, side: THREE.DoubleSide, alpha: 0 }), sg * FX[i] * (tab === t5 ? 1.8 : 1), FY[i], FZ[i]);
    tab.g.add(m); return { m, tab, y0: FY[i], ph: i * 1.7 + tab.idx };
  }));

  /* ---- card shuffle between tableaux: card backs sweep across the view while the camera travels ---- */
  const shuffle = Array.from({ length: 12 }, (_, j) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.54), mat(null, { map: back, transparent: true, side: THREE.DoubleSide, alpha: 0 })); scene.add(m);
    return { m, j };
  });
  const vf = new THREE.Vector3(), vr = new THREE.Vector3(), vu = new THREE.Vector3();

  /* ---- camera path ---- */
  let anchors = [], scrollY = 0, smoothY = 0, camCard = 0, speed = 0, lastFocusX = 0;
  const pointer = { x: 0, y: 0 }, state = { craft: 0, paint: 0, lift: 0, hover: -1, tool: -1, prog: 0, moving: false, dir: 1 };
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
    state.prog = e; state.moving = A.card !== B.card; state.dir = B.card >= A.card ? 1 : -1;
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
    subject.position.y = subject.userData.base + state.lift * 0.1; subject.rotation.z = -state.lift * 0.012;
    if (Math.abs(state.craft - lastCraft) > 0.01) { composeBook(craftCanvas, state.craft); craftTex.needsUpdate = true; lastCraft = state.craft; }
    if (Math.abs(state.paint - lastPaint) > 0.01) { composeBook(paintCanvas, 1 + 2.4 * state.paint); paintTex.needsUpdate = true; lastPaint = state.paint; }
    const tp = toolPos[Math.max(0, state.tool)]; toolSpark.position.set(tp[0], tp[1] + 0.45, 0.8); toolSpark.visible = state.tool >= 0;
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
      m.wl.rotation.y = flap * 0.9; m.wr.rotation.y = -flap * 0.9;
    });
    for (const f of floaters) {
      f.m.material.uniforms.uAlpha.value = sstep(0.15, 0.7, f.tab.uReveal.value);
    }
    camera.getWorldDirection(vf); vr.set(1, 0, 0).applyQuaternion(camera.quaternion); vu.set(0, 1, 0).applyQuaternion(camera.quaternion);
    for (const c of shuffle) {
      const u = state.prog * 1.7 - c.j * 0.065, d = 5.5 + (c.j % 4) * 0.9, hh = Math.tan(FOV * 0.5 * R) * d;
      const on = !still && state.moving && u > 0 && u < 1;
      c.m.material.uniforms.uAlpha.value = on ? sstep(0, 0.12, u) * (1 - sstep(0.88, 1, u)) : 0;
      if (!on) continue;
      const x = state.dir * (u * 2 - 1) * 1.35, y = Math.sin(c.j * 2.3) * 0.42 + Math.sin(u * 6 + c.j) * 0.07;
      c.m.position.copy(camera.position).addScaledVector(vf, d).addScaledVector(vr, x * hh * camera.aspect).addScaledVector(vu, y * hh);
      c.m.quaternion.copy(camera.quaternion); c.m.rotateY(u * 7 + c.j); c.m.rotateZ(Math.sin(c.j) * 0.5); c.m.scale.setScalar(d / 8);
    }
    post.material.uniforms.uWipe.value = !still && state.moving ? sstep(0.1, 0.85, Math.sin(Math.PI * state.prog)) : 0;
    // wallpaper: tile it to the view and slide it slightly with the camera for parallax
    bg.scale.set(2 * 60 * tanH * camera.aspect * 1.15, 2 * 60 * tanH * 1.15, 1);
    bgMat.uniforms.uUvOff.value.set(camera.position.x * 0.02, 0);
    const uv = bg.geometry.attributes.uv, rx = bg.scale.x / 3.4, ry = bg.scale.y / 3.4;
    if (bg.userData.rx !== rx || bg.userData.ry !== ry) { uv.setXY(0, 0, ry); uv.setXY(1, rx, ry); uv.setXY(2, 0, 0); uv.setXY(3, rx, 0); uv.needsUpdate = true; bg.userData.rx = rx; bg.userData.ry = ry; }
  }
  function draw() {
    if (!rt) return;
    renderer.setRenderTarget(rt); renderer.setClearColor(clearHex, 1); renderer.clear(); renderer.render(scene, camera);
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

  /* background look: paper shade (also tints the art's paper-white) and wallpaper texture */
  function setTheme({ paper, pattern, line, accent }) {
    const c = new THREE.Color(paper);
    if (accent) G.uAccent.value.set(accent.hue || 0, accent.sat || 1, accent.val || 1, accent.off ? 0 : 1);
    clearHex = paper; post.material.uniforms.uPaper.value.copy(c);
    G.uTint.value.set(c.r / 0.9255, c.g / 0.9216, c.b / 0.9098); // the art is balanced to #ECEBE8
    bgMat.uniforms.uMap.value = T(drawWallpaper(pattern, line), `wall-${pattern}-${line}`, true);
    if (still) { step(0); draw(); }
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  return {
    setTheme, moths,
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
