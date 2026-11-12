# Art prompts

The illustrations in `assets/art/` were generated with Google Gemini (`gemini-3-pro-image`), 2K, 9:16 (moths 1:1). Every prompt is the shared style text followed by one scene text. The hero was generated first, then split into a background-only layer and a figure-only layer by editing that image (same framing, so the layers line up). The seated jester used the hero figure as a character reference. Cut-outs are made with `tools/key_art.py`.

## Shared style text

Original fine-art illustration for a tarot-style card. Fine, slightly loose ink linework in warm charcoal-brown, confident in focal areas and fading to light sketch lines toward the edges. Watercolor and gouache washes that bleed softly past the lines and dissolve into bare off-white paper at the edges, so the scene feels like a painting emerging from the page, with large areas left unpainted. Halftone dot screens (screentone) in shadows and on fabric folds, mixed with soft wash gradients. Rococo and baroque scrollwork (acanthus leaves, C-scrolls, shell motifs) rendered in pale grey wash. White marble arches, columns, urns and plinths with faint cracks and moss. Clusters of poppies and roses in rust red, with sage-grey leaves and tall grasses at the base of the scene. Small four-point stars in vermilion and white scattered sparingly near the focal point. Palette: paper #ECEBE8, warm grey #CFCAC4, stone #B8B2AC, charcoal-brown ink #3A2F2C, rust #B4482A, vermilion #C9542F, poppy red #A33A26, blush #D9A9A0, sage-teal #6E9C92, slate green #4E5F5A. Light, airy, desaturated, with red-orange as the dominant accent. No purple, no neon. Mood: dreamy, languid, elegant, slightly melancholic; refined fine-art illustration, never cartoony. The background is plain flat pale paper (#ECEBE8) with no border, no frame, no text and no watermark; the artwork floats on the paper and nothing touches the canvas edge.

## Scene: hero

Subject: an elegant, slender jester with pale grey skin, soft curly white hair, small feathered wing-ears and half-closed knowing eyes, wearing a harlequin collar of ruffled cloud-like fabric and a flowing rust-and-vermilion patchwork costume with quilted diamond panels and long trailing drapery, holding a paintbrush like a scepter. The jester reclines on a tall stack of hand-painted books on top of a rococo pedestal, between two cracked white marble columns, with poppies spilling from stone urns on both sides. Two tiny paper-moth spirits hover nearby: wings like torn book pages tinted sage-teal, small dark ink bodies, faint glowing amber dot eyes, carrying ribbons. Tall vertical composition, centered, with the whole scene fully inside the canvas.

## Scene: collection

Subject: a tall marble library alcove seen straight on. A high arched niche with a veil of pale sage-grey translucent fabric hanging across the arch, rococo scrollwork and a shell crest at the top, two cracked mossy marble columns on either side, and a low tiered marble dais at the base carrying seven empty round marble plinths arranged in a shallow arc: four lower plinths in front and three taller plinths behind. Poppies and tall grasses at the base. No books, no people; the plinth tops are empty and clearly visible. Tall vertical composition, centered, the whole scene fully inside the canvas.

## Scene: craft

Subject: a magician's painting workbench under a tall marble arch, seen straight on. A wooden workbench with trestle legs. On the left a ceramic jar holding several paintbrushes, on the right a small stack of gold leaf sheets and a jar of amber varnish, and in front a painter's palette with dabs of rust, sage and blush paint. The center of the bench is empty, leaving clear space for a book to be placed later. A stone urn with poppies stands to the left. No people. Tall vertical composition, centered, the whole scene fully inside the canvas.

## Scene: empress

Subject: a lush garden of poppies, roses and tall grasses around an empty marble lectern (a reading stand with a slanted top, clearly visible and with nothing on it), with a trellis arch of roses and cracked marble behind and a few red petals scattered on the ground. No book, no people. Tall vertical composition, centered, the whole scene fully inside the canvas.

## Scene: star_bg

Subject: a still reflecting pool in a marble-rimmed oval basin under a sky of scattered four-point stars, one large vermilion star near the top and several small white and vermilion stars, the water softly mirroring them. Reeds and tall grasses around the pool, a low cracked marble balustrade behind, and a stone urn with poppies on the right. No people. Tall vertical composition, centered, the whole scene fully inside the canvas.

## Scene: star_jester

Using the jester in the reference image as the same character (same face, curly white hair, small feathered wing-ears, ruffled cloud-like collar, rust-and-vermilion patchwork costume with long trailing drapery), draw the same jester sitting on the left edge of a pool with one knee raised, gazing down at the water, holding the paintbrush loosely. Only the seated jester, on a plain flat pale paper background, nothing else at all. Tall vertical composition.

## Scene: moths

Subject: two small paper-moth spirits, shown wings spread and front-facing, well separated from each other: wings like torn book pages tinted sage-teal with faint printed lines of text, small dark ink bodies, faint glowing amber dot eyes, each carrying a thin trailing ribbon. Beneath them in a row, six small four-point stars, alternating vermilion and white. Square composition on plain flat paper.

## Scene: frame

Subject: a tall narrow ornate rococo picture frame in pale grey wash with fine ink linework: acanthus leaves, C-scrolls and a shell crest at the top, matching scrollwork in the corners and a decorative cartouche at the bottom. The entire interior of the frame is empty, plain flat paper. No artwork inside, no text. The frame fills the canvas with a small margin.

## Hero layers (edit prompts, with the hero image as reference)

- Background: remove the jester, book stack, paintbrush, moths and stars; keep columns, pedestal, urns, flowers; same framing and style; plain paper background.
- Figure: keep only the jester with the book stack and brush; remove everything else; plain flat paper background; same position and scale.

## Scene: elements (the nine floating objects, cut out with --crop)

Subject: a sheet of nine separate small decorative objects arranged in a clean 3 by 3 grid on plain paper, each one fully separated from the others with generous empty space around it and nothing touching: a book with small feathered wings in flight; a hanging silk tassel on a twisted cord; an antique ornate key; a quill pen with a long feather; an oil lantern glowing softly; a single poppy flower on a long stem; a trailing rust-red ribbon tied in a bow; a hand mirror with a rococo frame; a crescent moon with one small star. Square composition.
