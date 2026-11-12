# Thornquill Bindery: the tarot deck

A scroll-driven 3D storefront for hand-painted novels. Each section is a major-arcana card (0 The Jester, II The High Priestess, I The Magician, III The Empress, XVII The Star, XXI The World) and one camera travels through the whole deck. Plain HTML, CSS and JavaScript with no build step. Three.js r160 (MIT) is bundled in `vendor/three/`. No frameworks, trackers, remote fonts or image files: every illustration is drawn in the browser by `js/paint.js`.

## Run it

ES modules need a web server (opening `index.html` from disk will not work):

```bash
python serve.py
```

Open <http://localhost:8766/>. Any static host works, and every path is relative, so it also runs from a GitHub Pages subpath. `404.html` works out the site root itself.

Preview helpers: `?reduced` shows reduced-motion mode, `?debug` exposes `window.__tq.jump(n)` to snap the camera to shot 0 to 10. `sheet.html` is the model sheet: the Jester in five poses, the paper-moth familiar, flora, frame, covers and card faces.

## What you edit

Everything lives in `js/config.js`:

| What | Where |
| --- | --- |
| Currency, contact emails, form endpoints, social links, shipping note | `CONFIG` |
| The books for sale (title, invented author, numeral, motif, edition, price, stock, payment link) | `PRODUCTS` |
| Customer reviews (ships empty, the block stays hidden until you add real ones) | `REVIEWS` |

Page copy, the FAQ and the maker story are in `index.html` (look for `OWNER` comments); policies are in `POLICIES` in `js/main.js`.

- **Checkout.** A product with a `paymentLink` gets a pay button in the cart. Without one, checkout falls back to a prefilled email plus a Copy order text button. `stock: 0` shows Sold.
- **Forms.** With `formEndpoint` and `newsletterEndpoint` empty, forms open the visitor's email app. Put a Formspree-style URL there to POST JSON instead, with success and error messages on the page.
- **Covers and plates** are generated from each product's `motif`, `palette` and `seed`. Add real photographs later by showing them in `index.html` or `js/main.js`.

## How it is built

- `js/paint.js`: ink line, watercolour wash, halftone and patchwork drawn on canvases. Model-sheet poses for the Jester are in `JESTER_POSES`.
- `js/scene.js`: six tableaux as real geometry plus layered painted planes. All materials share one shader: three-band wash with pigment pooling, screen-space halftone in shadow, marble cracks and moss, cloth waves, and a noisy fade-to-paper mask that blooms outward as the camera arrives. A post pass adds ink outlines (thinner and lighter with distance), watercolour bleed, paper grain and a paper vignette.
- `js/main.js`: shop, cart (localStorage), dialogs (native `<dialog>`, so focus is trapped and Esc closes), forms, chapter rail, custom cursor, and the link from scroll position to camera shots.

## Accessibility and performance

- Semantic landmarks, skip link, keyboard-operable cards, dialogs, cart and accordion, live-region announcements, visible focus.
- `prefers-reduced-motion` (or `?reduced`): no camera travel, no flips, no cloth or particles; each section shows a still tableau and the canvas crossfades between them. The shop works as normal.
- Pixel ratio is capped (1.75 desktop, 1.25 phone), the simpler bleed pass is used on phones, and rendering pauses when the tab is hidden. If WebGL is unavailable the page falls back to paper with all content and the shop intact.

## Before you launch

- Replace the placeholder email addresses, the About story, FAQ answers and policies. They are drafts, not legal advice.
- Replace the sample books in `PRODUCTS`.
- Every book is described as an unofficial hand-bound edition made from a lawfully purchased copy with original artwork. Keep that wording, avoid official cover art, logos and quotations, and consider a short IP lawyer review.
