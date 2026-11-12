# Opal & Ink: the tarot deck

A scroll-driven 3D storefront for hand-painted novels. Each section is a major-arcana card (0 The Jester, II The High Priestess, I The Magician, III The Empress, XVII The Star, XXI The World) and one camera travels through the whole deck. Plain HTML, CSS and JavaScript with no build step. Three.js r160 (MIT) is bundled in `vendor/three/`. No frameworks, trackers or remote fonts (the cursive font, Dancing Script, is bundled under the SIL OFL). The scene art is a set of AI-generated illustrations in `assets/art/` (see Art below); book covers, plates and edges are drawn in the browser by `js/paint.js`.

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

- `js/paint.js`: ink line, watercolour wash and halftone drawn on canvases. It paints the book covers, plates, page edges, the book that repaints itself and the card back. It also holds the earlier code-drawn Jester and flora, which `sheet.html` still shows.
- `js/scene.js`: six tableaux, each a few illustrated layers on planes at different depths plus live 3D books and sparkles. Every material shares one shader, including a noisy fade-to-paper mask that blooms outward as the camera arrives, and books get a three-band wash with halftone in shadow. A post pass adds ink outlines (thinner and lighter with distance), watercolour bleed, paper grain and a paper vignette.
- `js/main.js`: shop, cart (localStorage), dialogs (native `<dialog>`, so focus is trapped and Esc closes), forms, chapter rail, custom cursor, and the link from scroll position to camera shots.

## Background palette

The round palette button (bottom left, top left on phones) lets a visitor pick a paper shade and a wallpaper texture; the choice is remembered in their browser. It recolours the page, the 3D backdrop and the paper-white of the artwork together. Add or change options in `SHADES` and `TEXTURES` in `js/main.js`; new textures are drawn in `drawWallpaper` in `js/paint.js`.

## Art

The illustrations were generated with Google Gemini (`gemini-3-pro-image`) from the prompts in `tools/art-prompts.md`, in an original composition (they are not copies of any existing artwork). Images made this way carry an invisible SynthID watermark, and you should check the terms for commercial use before relying on them. Each tableau is built from layers on planes at different depths, so the camera drifts past them with parallax: `hero-bg` and `hero-fg`, `collection`, `craft`, `empress`, `star`, plus the `frame` around every card, two moth sprites and nine floating objects (`el-*`, cut from one sheet) that drift in the margins. The 3D books, the book that repaints itself on the workbench and lectern, and the tool highlights are live objects placed on top at positions read off the artwork.

To change a picture: generate a new one on plain paper, then cut it out and drop the result into `assets/art/`:

```bash
python tools/key_art.py generated.jpg assets/art/collection.webp --width 1024
```

`key_art.py` makes the paper transparent (only paper connected to the border, so white marble stays solid), balances the paper colour to the site's, and also takes `--crop`, `--erase` and `--seed` to cut a piece out of a busier sheet. If you change an illustration, re-read the positions of the plinths, bench and lectern in `js/scene.js` (`slots`, `toolPos`, the lectern book) so the live objects still line up.

## Accessibility and performance

- Semantic landmarks, skip link, keyboard-operable cards, dialogs, cart and accordion, live-region announcements, visible focus.
- `prefers-reduced-motion` (or `?reduced`): no camera travel, no flips, no cloth or particles; each section shows a still tableau and the canvas crossfades between them. The shop works as normal.
- Pixel ratio is capped (1.75 desktop, 1.25 phone), the simpler bleed pass is used on phones, and rendering pauses when the tab is hidden. If WebGL is unavailable the page falls back to paper with all content and the shop intact.

## Before you launch

- Replace the placeholder email addresses, the About story, FAQ answers and policies. They are drafts, not legal advice.
- Replace the sample books in `PRODUCTS`.
- Every book is described as an unofficial hand-bound edition made from a lawfully purchased copy with original artwork. Keep that wording, avoid official cover art, logos and quotations, and consider a short IP lawyer review.
