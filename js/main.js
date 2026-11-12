/* Page behaviour: shop, cart, dialogs, forms, chapter rail, and the scroll-to-camera link. */
import { CONFIG, PRODUCTS, REVIEWS, BOOK_DETAILS } from './config.js';
import { ARCANA, drawCover, drawFrame, drawCardBack, drawCardFace, drawJester, drawMoth, wash, ink, PAL, cv } from './paint.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const qs = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || qs.has('reduced');
const fmt = new Intl.NumberFormat(CONFIG.locale, { style: 'currency', currency: CONFIG.currency, maximumFractionDigits: 0 });
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const live = (msg) => { const l = $('#live'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); };
let world = null;

/* ---------- artwork used by the HTML ---------- */
const frameUrl = drawFrame(420, 720).toDataURL();
const cover = Object.fromEntries(PRODUCTS.map((p) => [p.id, drawCover(p, 320, 480).toDataURL('image/jpeg', 0.88)]));
{
  const corner = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><g fill='none' stroke='#3A2F2C' stroke-width='1' stroke-linecap='round'><path d='M3 3h20M3 3v20' opacity='.6'/><path d='M8 8c0-4 7-5 8-1s-4 6-7 4' /><path d='M8 8c4 0 5 7 1 8s-6-4-4-7'/><path d='M20 12c4 0 9 3 8 8' stroke='#B8B2AC' stroke-width='3'/><path d='M12 20c0 4 3 9 8 8' stroke='#B8B2AC' stroke-width='3'/></g></svg>`;
  document.documentElement.style.setProperty('--c1', `url("data:image/svg+xml,${encodeURIComponent(corner)}")`);
  document.documentElement.style.setProperty('--c-back', `url(${drawCardBack(160, 280).toDataURL()})`);
}
function satchelUrl() {
  const c = cv(360, 300), x = c.getContext('2d'), m = drawMoth();
  x.save(); x.translate(180, 120); x.drawImage(m.wing, 0, -90, 150, 150); x.scale(-1, 1); x.drawImage(m.wing, 0, -90, 150, 150); x.restore();
  x.drawImage(m.body, 140, 52, 80, 80);
  const bag = (g) => { g.beginPath(); g.moveTo(60, 150); g.quadraticCurveTo(180, 126, 300, 150); g.lineTo(286, 268); g.quadraticCurveTo(180, 284, 74, 268); g.closePath(); };
  wash(x, bag, '#9A7E64', { a: 0.95, blur: 4 }); ink(x, bag, 3);
  const flap = (g) => { g.beginPath(); g.moveTo(66, 176); g.quadraticCurveTo(180, 214, 294, 176); };
  ink(x, flap, 2.4);
  wash(x, (g) => { g.beginPath(); g.ellipse(180, 202, 12, 12, 0, 0, 7); }, PAL.gold, { a: 1, blur: 1 });
  return c.toDataURL();
}

/* ---------- headings reveal word by word ---------- */
$$('.reveal').forEach((h) => {
  h.setAttribute('aria-label', h.textContent);
  h.innerHTML = h.textContent.split(' ').map((w, i) => `<span class="w" style="--i:${i}" aria-hidden="true">${esc(w)}</span> `).join('');
});
const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.4 });
$$('.reveal').forEach((h) => io.observe(h));

/* ---------- shop ---------- */
const byId = (id) => PRODUCTS.find((p) => p.id === id);
function tarotFace(p, i, asButton = true) {
  const inner = `<img class="cardart" src="${frameUrl}" alt=""><span class="num">${esc(p.numeral)}</span><img class="cover" src="${cover[p.id]}" alt="Painted cover of ${esc(p.title)}"><span class="banner">${esc(p.title)}</span>`;
  return asButton ? `<button class="tface" type="button" data-open="${i}" aria-label="${esc(p.title)} by ${esc(p.author)}, ${fmt.format(p.price)}. Turn the card over.">${inner}</button>` : `<div class="tface" role="img" aria-label="${esc(p.title)}">${inner}</div>`;
}
$('#grid').innerHTML = PRODUCTS.map((p, i) => `<article class="tcard" data-i="${i}">${tarotFace(p, i)}
  <div class="meta"><span>${fmt.format(p.price)}</span><span class="ed">${esc(p.edition)}</span></div>
  ${p.stock > 0 ? `<button class="btn small solid" type="button" data-add="${p.id}">Add to Cart</button>` : '<span class="sold">Sold</span>'}</article>`).join('');
if (REVIEWS.length) {
  $('#reviews').hidden = false;
  $('#reviewList').innerHTML = REVIEWS.map((r) => `<li><strong>${esc(r.name)}</strong> on <em>${esc(r.book)}</em>, ${'★'.repeat(r.rating || 0)}<br>${esc(r.text)}</li>`).join('');
}

/* ---------- cart ---------- */
const KEY = 'inky-cart-v1';
let cart = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter((l) => byId(l.id) && l.qty > 0).map((l) => ({ id: l.id, qty: Math.min(l.qty, byId(l.id).stock) })).filter((l) => l.qty > 0); } catch (e) { return []; } })();
const saveCart = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* storage blocked: cart lasts this visit */ } };
const count = () => cart.reduce((n, l) => n + l.qty, 0);
const subtotal = () => cart.reduce((n, l) => n + byId(l.id).price * l.qty, 0);
function addToCart(id) {
  const p = byId(id), line = cart.find((l) => l.id === id);
  if (!p || p.stock < 1) return;
  if (line) { if (line.qty >= p.stock) { live(`Only ${p.stock} of ${p.title} available.`); return; } line.qty++; } else cart.push({ id, qty: 1 });
  saveCart(); renderCart(); live(`${p.title} added to your cart.`);
}
function orderText() {
  return `Hello Inky & Co.,\n\nI would like to order:\n` + cart.map((l) => `- ${byId(l.id).title} x ${l.qty} (${fmt.format(byId(l.id).price * l.qty)})`).join('\n') + `\n\nTotal: ${fmt.format(subtotal())}\n\nName:\nDelivery address:\n`;
}
function renderCart() {
  const n = count(), badge = $('#cartCount');
  badge.hidden = n === 0; badge.textContent = n; $('#cartBtn').setAttribute('aria-label', `Open cart, ${n} item${n === 1 ? '' : 's'}`);
  const body = $('#cartBody');
  if (!cart.length) { body.innerHTML = `<div class="empty"><img src="${satchelUrl()}" alt="A paper moth peeking out of an empty satchel"><p>Your satchel is empty.</p><p><button class="btn solid" type="button" data-close data-goto="#shop">Browse the Collection</button></p></div>`; return; }
  const linked = cart.filter((l) => byId(l.id).paymentLink), unlinked = cart.filter((l) => !byId(l.id).paymentLink);
  body.innerHTML = cart.map((l) => { const p = byId(l.id); return `<div class="line"><img src="${cover[p.id]}" alt=""><div><div class="t">${esc(p.title)}</div><div class="qty"><button type="button" data-dec="${p.id}" aria-label="Fewer ${esc(p.title)}">−</button><span aria-label="Quantity">${l.qty}</span><button type="button" data-inc="${p.id}" aria-label="More ${esc(p.title)}">+</button><button type="button" class="link" data-rm="${p.id}" style="margin-left:10px">Remove</button></div></div><div>${fmt.format(p.price * l.qty)}</div></div>`; }).join('')
    + `<div class="total"><span>Subtotal</span><span>${fmt.format(subtotal())}</span></div><div class="stack">`
    + linked.map((l) => `<a class="btn solid" target="_blank" rel="noopener" href="${esc(byId(l.id).paymentLink)}">Pay for ${esc(byId(l.id).title)}</a>`).join('')
    + (unlinked.length || !linked.length ? `<a class="btn solid" href="mailto:${esc(CONFIG.orderEmail)}?subject=${encodeURIComponent('Order from the website')}&body=${encodeURIComponent(orderText())}">Email your order</a>` : `<a class="btn" href="mailto:${esc(CONFIG.orderEmail)}?subject=${encodeURIComponent('Order from the website')}&body=${encodeURIComponent(orderText())}">Or email your order</a>`)
    + `<button class="btn" type="button" id="copyOrder">Copy order text</button></div><p id="copyMsg" class="status" role="status"></p>`;
}
renderCart();

/* ---------- dialogs ---------- */
const dlgs = $$('dialog');
dlgs.forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));
const closeAll = () => dlgs.forEach((d) => d.open && d.close());
const POLICIES = { // OWNER: sensible drafts, not legal advice. Replace with your own policies.
  shipping: ['Shipping', `<p>${esc(CONFIG.shipping)}</p><p>We currently ship within India. Tracking details are emailed once your book leaves the studio.</p>`],
  returns: ['Returns', '<p>Ready-made books can be returned in their original condition within seven days of delivery. Commissions are made for you and cannot be returned, but we will put right anything that is wrong.</p>'],
  privacy: ['Privacy', '<p>This site has no analytics, trackers or accounts. Your cart is stored only in your own browser. If you email us, we use your details only to reply and fulfil your order.</p>'],
};
let viewer = null;
async function openProduct(i) {
  const p = PRODUCTS[i]; if (!p) return;
  closeAll();
  const d = $('#product'), flip = $('#flip');
  $('#pFront').innerHTML = tarotFace(p, i, false);
  $('#pNum').textContent = `${p.numeral} · ${p.edition}`; $('#pTitle').textContent = p.title; $('#pAuthor').textContent = `by ${p.author}`; $('#pBlurb').textContent = p.blurb;
  $('#pDl').innerHTML = [['Pigments', p.pigments], ['Binding', BOOK_DETAILS.binding], ['Size', BOOK_DETAILS.dimensions], ['Shipping', BOOK_DETAILS.shipping], ['Care', BOOK_DETAILS.care], ['Note', BOOK_DETAILS.note]].map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('');
  $('#pPrice').textContent = fmt.format(p.price);
  const add = $('#pAdd'); add.textContent = p.stock > 0 ? 'Add to Cart' : 'Sold'; add.disabled = p.stock < 1; add.dataset.add = p.id;
  flip.classList.remove('flipped'); d.showModal();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  flip.classList.add('flipped');
  try { const { createBookViewer } = await import('./scene.js'); viewer?.dispose(); viewer = createBookViewer($('#pCanvas'), p); } catch (e) { $('.viewer .hint').textContent = '3D view is not available on this device.'; }
  $('#pTitle').focus?.();
}
$('#product').addEventListener('close', () => { viewer?.dispose(); viewer = null; });
$('#pOpen').addEventListener('click', () => { if (viewer) { viewer.toggle(); $('#pOpen').textContent = viewer.isOpen() ? 'Close the cover' : 'Open the cover'; } });

/* draw a card */
const deckEl = $('#deck'); deckEl.innerHTML = '<i></i>'.repeat(6);
function drawCardDialog() { closeAll(); $('#dResult').innerHTML = ''; deckEl.classList.remove('shuffle'); $('#draw').showModal(); }
$('#dGo').addEventListener('click', () => {
  const pool = PRODUCTS.map((p, i) => i).filter((i) => PRODUCTS[i].stock > 0), i = (pool.length ? pool : PRODUCTS.map((p, k) => k))[Math.floor(Math.random() * (pool.length || PRODUCTS.length))];
  deckEl.classList.add('shuffle'); $('#dResult').innerHTML = ''; $('#dGo').disabled = true;
  setTimeout(() => {
    deckEl.classList.remove('shuffle'); $('#dGo').disabled = false; $('#dGo').textContent = 'Draw again';
    const p = PRODUCTS[i];
    $('#dResult').innerHTML = `${tarotFace(p, i, false)}<p><strong>${esc(p.title)}</strong><br><span class="muted">${esc(p.author)}</span></p><p><button class="btn small solid" type="button" data-open="${i}">See this book</button></p>`;
    live(`The deck suggests ${p.title} by ${p.author}.`);
  }, reduced ? 100 : 1900);
});

/* ---------- forms ---------- */
let bowUrl = null;
async function submit(form, statusEl, { endpoint, mailto, okText, required }) {
  const bad = required.map((n) => form.elements[n]).find((el) => !el.value.trim() || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(el.value)));
  statusEl.className = 'status';
  $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  if (bad) { bad.setAttribute('aria-invalid', 'true'); statusEl.textContent = 'Please complete the highlighted field: ' + (bad.labels?.[0]?.textContent || bad.name) + '.'; statusEl.classList.add('err'); bad.focus(); return; }
  const data = Object.fromEntries(new FormData(form));
  const ok = () => { bowUrl ||= drawJester('bow', 300).toDataURL(); statusEl.classList.add('ok'); statusEl.innerHTML = `<span class="okmsg"><img src="${bowUrl}" alt=""><span>${esc(okText)}</span></span>`; form.reset(); };
  if (endpoint) {
    try { const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error(r.status); ok(); }
    catch (e) { statusEl.classList.add('err'); statusEl.textContent = 'That did not send. Please try again, or email us directly at ' + CONFIG.contactEmail + '.'; }
  } else { location.href = mailto(data); ok(); }
}
$('#commissionForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submit(e.target, $('#cStatus'), { endpoint: CONFIG.formEndpoint, required: ['name', 'email', 'message'], okText: 'Thank you. We have opened your email app with the details. Send it and we will reply with a sketch plan.',
    mailto: (d) => `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent('Commission inquiry: ' + (d.book || 'new book'))}&body=${encodeURIComponent(`Name: ${d.name}\nEmail: ${d.email}\nBook: ${d.book}\nStyle notes: ${d.style}\nBudget: ${d.budget}\n\n${d.message}`)}` });
});
$('#newsForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submit(e.target, $('#nStatus'), { endpoint: CONFIG.newsletterEndpoint, required: ['email'], okText: 'Welcome to the deck. We have opened an email to confirm your sign-up.',
    mailto: (d) => `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent('Newsletter sign-up')}&body=${encodeURIComponent('Please add me to the list: ' + d.email)}` });
});

/* ---------- footer, header, rail ---------- */
$('#mailLink').href = 'mailto:' + CONFIG.contactEmail; $('#mailLink').textContent = CONFIG.contactEmail; $('#year').textContent = new Date().getFullYear();
$('#social').innerHTML = CONFIG.social.filter((s) => s.url).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('');
$('#menuBtn').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', o); });
$('#nav').addEventListener('click', (e) => { if (e.target.closest('a')) { $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); } });
const RAIL = [['#hero', 0], ['#collection', 1], ['#craft', 2], ['#commissions', 3], ['#about', 4], ['#world-sec', 5]];
$('#rail').innerHTML = RAIL.map(([sel, k]) => `<button class="rcard" type="button" data-goto="${sel}" aria-label="Chapter ${ARCANA[k].numeral}: ${ARCANA[k].name}"><i class="b"></i><i class="f">${ARCANA[k].numeral}</i></button>`).join('');
function updateRail() {
  const mid = innerHeight / 2; let best = 0, bd = 1e9;
  RAIL.forEach(([sel], i) => { const r = $(sel).getBoundingClientRect(); const d = r.top > mid ? r.top - mid : r.bottom < mid ? mid - r.bottom : 0; if (d < bd) { bd = d; best = i; } });
  $$('.rcard').forEach((b, i) => b.setAttribute('aria-current', i === best ? 'true' : 'false'));
}

/* ---------- one delegated click handler ---------- */
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, a'); if (!t) return;
  if (t.dataset.add) { addToCart(t.dataset.add); return; }
  if (t.dataset.open !== undefined) { openProduct(+t.dataset.open); return; }
  if (t.dataset.inc || t.dataset.dec || t.dataset.rm) {
    const id = t.dataset.inc || t.dataset.dec || t.dataset.rm, l = cart.find((x) => x.id === id); if (!l) return;
    if (t.dataset.inc) l.qty = Math.min(l.qty + 1, byId(id).stock); else if (t.dataset.dec) l.qty--; else l.qty = 0;
    cart = cart.filter((x) => x.qty > 0); saveCart(); renderCart(); return;
  }
  if (t.id === 'copyOrder') { navigator.clipboard?.writeText(orderText()).then(() => { $('#copyMsg').textContent = 'Order text copied.'; }, () => { $('#copyMsg').textContent = 'Copy is blocked here. Use the email button instead.'; }); return; }
  if (t.id === 'cartBtn') { closeAll(); $('#cart').showModal(); return; }
  if (t.dataset.draw !== undefined) { drawCardDialog(); return; }
  if (t.dataset.policy) { const [h, b] = POLICIES[t.dataset.policy]; $('#polTitle').textContent = h; $('#polBody').innerHTML = b; closeAll(); $('#policy').showModal(); return; }
  if (t.dataset.close !== undefined) { t.closest('dialog')?.close(); if (t.dataset.goto) document.querySelector(t.dataset.goto)?.scrollIntoView(); return; }
  if (t.dataset.goto) document.querySelector(t.dataset.goto)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
});
$$('.tcard').forEach((c) => { const i = +c.dataset.i; ['mouseenter', 'focusin'].forEach((ev) => c.addEventListener(ev, () => world?.setHover(i))); ['mouseleave', 'focusout'].forEach((ev) => c.addEventListener(ev, () => world?.setHover(-1))); });

/* ---------- custom cursor ---------- */
if (matchMedia('(pointer: fine)').matches) {
  const cur = $('#cursor'); document.body.classList.add('fine');
  addEventListener('pointermove', (e) => { cur.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`; document.body.classList.toggle('over', !!e.target.closest('a, button, summary, .tface')); }, { passive: true });
}

/* ---------- the 3D world and the camera path ---------- */
const DEF = { fitW: 3.9, fitH: 8.0, dist: 1, lift: 1 };
const ANCH = [
  ['#hero', { card: 0, side: 'left', lift: 0 }],
  ['#collection', { card: 1, side: 'right', yaw: -0.07 }],
  ['#step1', { card: 2, side: 'left', craft: 0.5, tool: 0, dist: 1.04, yaw: 0.05 }],
  ['#step2', { card: 2, side: 'left', craft: 1.5, tool: 1, dist: 0.98 }],
  ['#step3', { card: 2, side: 'left', craft: 2.5, tool: 2, dist: 0.92, yaw: -0.05 }],
  ['#step4', { card: 2, side: 'left', craft: 3.6, tool: 3, dist: 0.86 }],
  ['#commIntro', { card: 3, side: 'right', paint: 0, yaw: 0.05 }],
  ['#commForm', { card: 3, side: 'right', paint: 1, dist: 0.96 }],
  ['#about', { card: 4, side: 'left', yaw: 0.05 }],
  ['#worldClose', { card: 5, side: 'left', focusZ: 4.2, fitW: 2.9, fitH: 5.2, yaw: 0 }],
  ['#worldFar', { card: 5, side: 'center', pitch: 0.42, fitW: 11.5, fitH: 8.4 }],
];
let anchors = [], snapIdx = -1;
function measure() {
  anchors = ANCH.map(([sel, p]) => { const r = $(sel).getBoundingClientRect(); return { ...DEF, ...p, y: r.top + scrollY + r.height / 2 - innerHeight / 2 }; }).sort((a, b) => a.y - b.y);
  world?.setAnchors(anchors);
}
let ticking = false;
function onScroll() {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    ticking = false; updateRail();
    if (!world) return;
    if (reduced) {
      let k = 0, best = 1e9; anchors.forEach((a, i) => { const d = Math.abs(a.y - scrollY); if (d < best) { best = d; k = i; } });
      if (k !== snapIdx) { snapIdx = k; $('#world').classList.add('dim'); setTimeout(() => { world.setScroll(anchors[k].y, true); $('#world').classList.remove('dim'); }, 350); }
    } else world.setScroll(scrollY);
  });
}
async function boot() {
  const loader = $('#loading'), canvas = $('#world');
  await new Promise((r) => setTimeout(r, 40));
  try {
    const { createWorld } = await import('./scene.js');
    world = createWorld(canvas, { mobile: matchMedia('(max-width: 899px)').matches || matchMedia('(pointer: coarse)').matches, reduced });
    measure();
    if (reduced) { world.still(true); world.setScroll(anchors[0].y, true); snapIdx = 0; onScroll(); } else { world.setScroll(scrollY, true); world.start(); }
    canvas.addEventListener('pointermove', (e) => { const i = world.pick(e.clientX, e.clientY); world.setHover(i); canvas.style.cursor = i >= 0 ? 'pointer' : ''; document.body.classList.toggle('over', i >= 0); });
    canvas.addEventListener('click', (e) => { const i = world.pick(e.clientX, e.clientY); if (i >= 0) openProduct(i); });
    addEventListener('pointermove', (e) => world.setPointer((e.clientX / innerWidth - 0.5) * 2, -(e.clientY / innerHeight - 0.5) * 2), { passive: true });
    // the canvas is the full viewport, so this also covers window resizes and a pane that was hidden at load
    let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { world.resize(); measure(); onScroll(); }, 120); }).observe(canvas);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.body.classList.add('nogl'); });
    if (qs.has('debug')) window.__tq = { world, anchors: () => anchors, jump: (i) => { scrollTo({ top: anchors[i].y, behavior: 'instant' }); world.setScroll(anchors[i].y, true); } };
  } catch (err) {
    console.info('3D scene unavailable, showing the page without it:', err.message);
    document.body.classList.add('nogl');
  }
  loader.classList.add('done');
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('load', () => { measure(); onScroll(); });
updateRail();
boot();
