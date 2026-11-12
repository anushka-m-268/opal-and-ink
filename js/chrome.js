/* Markup shared by every page: the palette button and the cart, product, draw-a-card and policy dialogs.
   main.js adds it to the page, so it is written once. */
export const SHARED_HTML = `
<button id="palBtn" class="palbtn" type="button" aria-expanded="false" aria-controls="palPanel" aria-label="Change the background colour and texture"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M12 3.5c-5 0-8.5 3.4-8.5 7.6 0 4.2 3.3 6.6 6 6.6 1.6 0 2-1 1.6-2-.5-1.2.3-2.4 1.7-2.4h2c2.2 0 3.7-1.4 3.7-3.4C18.5 6 15.6 3.5 12 3.5z"/><circle cx="8" cy="9.5" r="1" fill="currentColor"/><circle cx="12" cy="7.5" r="1" fill="currentColor"/><circle cx="16" cy="9.5" r="1" fill="currentColor"/></svg></button>
<div id="palPanel" class="palpanel ornate" hidden role="group" aria-label="Background">
  <p class="eyebrow">Shade</p><div id="shades" class="swatches"></div>
  <p class="eyebrow">Texture</p><div id="textures" class="chips"></div>
</div>

<!-- cart drawer -->
<dialog id="cart" class="drawer ornate" aria-labelledby="cartTitle">
  <div class="dhead"><h2 id="cartTitle">Your satchel</h2><button class="iconbtn" type="button" data-close aria-label="Close cart"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 5l14 14M19 5L5 19"/></svg></button></div>
  <div id="cartBody"></div>
</dialog>

<!-- product: the card flips to show the 3D book -->
<dialog id="product" class="pdlg" aria-labelledby="pTitle">
  <button class="iconbtn close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
  <div class="flip" id="flip">
    <div class="flip-inner">
      <div class="fface front"><div id="pFront"></div></div>
      <div class="fface back ornate">
        <div class="viewer"><canvas id="pCanvas" aria-label="3D book. Drag to turn it, click to open the cover." role="img"></canvas><p class="hint">Drag to turn. Click to open.</p><div class="vbtns"><button class="btn small" type="button" id="pOpen">Open the cover</button></div></div>
        <div class="details">
          <p class="eyebrow" id="pNum"></p><h2 id="pTitle"></h2><p class="author" id="pAuthor"></p>
          <p id="pBlurb"></p>
          <dl id="pDl"></dl>
          <p class="price" id="pPrice"></p>
          <p class="cta"><button class="btn solid" type="button" id="pAdd">Add to Cart</button></p>
        </div>
      </div>
    </div>
  </div>
</dialog>

<!-- draw a card -->
<dialog id="draw" class="pdlg small ornate" aria-labelledby="dTitle">
  <button class="iconbtn close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
  <h2 id="dTitle">Draw a card</h2>
  <p class="muted">A playful way to pick a book. Not a prediction.</p>
  <div id="deck" class="deck" aria-hidden="true"></div>
  <div id="dResult" class="dresult" aria-live="polite"></div>
  <p class="cta"><button class="btn solid" type="button" id="dGo">Shuffle and draw</button></p>
</dialog>

<dialog id="policy" class="pdlg small ornate" aria-labelledby="polTitle">
  <button class="iconbtn close" type="button" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 5l14 14M19 5L5 19"/></svg></button>
  <h2 id="polTitle"></h2><div id="polBody"></div>
</dialog>
`;
