/* Owner settings. Everything you are likely to edit lives in this file. */

export const CONFIG = {
  brand: 'Thornquill Bindery',
  currency: 'INR',            // one place to change the currency
  locale: 'en-IN',
  // OWNER: replace these placeholder addresses with your own.
  contactEmail: 'hello@thornquill.example',
  orderEmail: 'orders@thornquill.example',
  // Forms: leave '' to open the visitor's email app (mailto). Put a Formspree-style URL here to POST JSON instead.
  formEndpoint: '',
  newsletterEndpoint: '',
  // OWNER: social links. Entries with an empty url are hidden.
  social: [{ label: 'Instagram', url: '' }, { label: 'Pinterest', url: '' }],
  shipping: 'Ships from the studio within 5 to 7 working days in a rigid, acid-free box.',
};

/* PRODUCTS: the whole shop. Every title and author is invented.
   stock 0 shows "Sold". paymentLink is a hosted checkout URL (Razorpay, Stripe, UPI page...);
   leave '' and checkout falls back to a prefilled email. */
export const PRODUCTS = [
  { id: 'lantern', title: "The Lantern Keeper's Daughter", author: 'Isolde Marrow', numeral: 'VI', motif: 'candle', palette: ['#B4482A', '#D9A9A0'], seed: 3,
    edition: 'No. 2 of 5', price: 3400, stock: 3, paymentLink: '', pigments: 'Rust gouache, rose madder wash, gold leaf on the fore-edge',
    blurb: 'A lighthouse, a missing ledger, and a girl who learns the lamp never burned for ships.' },
  { id: 'moons', title: 'A Winter of Small Moons', author: 'Calder Wren', numeral: 'VIII', motif: 'moon', palette: ['#6E9C92', '#CFCAC4'], seed: 8,
    edition: '1 of 1', price: 4200, stock: 1, paymentLink: '', pigments: 'Sage-teal watercolour, pale grey wash, silver-grey sprayed edges',
    blurb: 'Seven villagers each keep one moon in a jar. Only one of them is telling the truth about why.' },
  { id: 'poppy', title: "The Cartographer's Last Poppy", author: 'Maren Ashby', numeral: 'IX', motif: 'poppy', palette: ['#A33A26', '#B8B2AC'], seed: 12,
    edition: 'No. 1 of 8', price: 3800, stock: 5, paymentLink: '', pigments: 'Poppy red gouache, charcoal ink line, blush bleed to the edges',
    blurb: 'A mapmaker walks the edge of her own atlas to find the one flower nobody drew.' },
  { id: 'starlight', title: 'Salt, Bone and Starlight', author: 'Odalys Quill', numeral: 'X', motif: 'star', palette: ['#4E5F5A', '#C9542F'], seed: 17,
    edition: 'No. 4 of 6', price: 4600, stock: 2, paymentLink: '', pigments: 'Slate green wash, vermilion stars, hand-gilded star on the spine',
    blurb: 'A salvage crew finds a ship that sank before the sea existed.' },
  { id: 'hollow', title: 'The Quiet House on Hollow Lane', author: 'Perpetua Hale', numeral: 'XI', motif: 'key', palette: ['#B8934A', '#6E9C92'], seed: 21,
    edition: '1 of 1', price: 2900, stock: 1, paymentLink: '', pigments: 'Antique gold leaf, sage wash, ink-line keyhole on the cover',
    blurb: 'Every door in the house opens onto the same room. Nobody remembers who lives there.' },
  { id: 'swallows', title: 'Swallows Over Saltmarsh', author: 'Ewan Thistlewood', numeral: 'XIV', motif: 'bird', palette: ['#4E5F5A', '#D9A9A0'], seed: 26,
    edition: 'No. 3 of 10', price: 2600, stock: 4, paymentLink: '', pigments: 'Slate wash, blush sky, fine ink swallows along the edges',
    blurb: 'A tide-clock keeper counts the birds each spring and notices one that never leaves.' },
  { id: 'rose', title: 'The Rose That Remembered', author: 'Linnea Vael', numeral: 'XV', motif: 'rose', palette: ['#A33A26', '#6E9C92'], seed: 31,
    edition: 'No. 5 of 5', price: 5200, stock: 0, paymentLink: '', pigments: 'Poppy red and sage gouache, full painted cover, gilded plate',
    blurb: 'A garden that keeps the memories of everyone who ever wept in it.' },
];

/* REVIEWS: ships empty on purpose. OWNER: add only real reviews from real customers, with their permission:
   { name: 'Asha K.', book: 'A Winter of Small Moons', rating: 5, date: '2026-03-14', text: 'What they said.' }
   While the list is empty the Reviews block is hidden. */
export const REVIEWS = [];

export const BOOK_DETAILS = {
  dimensions: 'About 13 x 20 cm, 3 cm spine',
  binding: 'Resewn text block, cloth-cased hardcover, headbands and a ribbon marker',
  care: 'Keep out of direct sun and damp. Dust with a dry soft brush. Painted edges are sealed but not waterproof.',
  shipping: CONFIG.shipping,
  note: 'An unofficial hand-bound edition made from a lawfully purchased copy, with original artwork by the bindery.',
};
