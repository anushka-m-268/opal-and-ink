"""Turn an illustration drawn on plain paper into a transparent WebP layer for the 3D scene.

    python tools/key_art.py input.jpg assets/art/name.webp [--width 1024]
        [--crop x0,y0,x1,y1] [--erase x0,y0,x1,y1 ...] [--seed x,y ...] [--fade-bottom 0.1]

All coordinates are pixels of the original input image.
- The paper colour is sampled from the four corners and re-balanced to the site's paper (#ECEBE8),
  so paper-white areas inside the artwork match the page.
- Only paper connected to the border (or to a --seed point, e.g. the empty middle of a frame)
  becomes transparent, with a soft edge, so white marble and cloud-white fabric stay opaque.
- --erase paints a rectangle with paper first (to remove stray decoration); --crop keeps one part.
Needs Pillow (pip install pillow).
"""
import argparse
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SITE_PAPER = (0xEC, 0xEB, 0xE8)


def corner_paper(im):
    w, h = im.size
    ps = [im.crop(b).resize((1, 1), Image.BOX).getpixel((0, 0)) for b in
          [(0, 0, 40, 40), (w - 40, 0, w, 40), (0, h - 40, 40, h), (w - 40, h - 40, w, h)]]
    return tuple(sum(p[i] for p in ps) // 4 for i in range(3))


def key(src, dst, width=1024, crop=None, erase=(), seeds=(), fade_bottom=0.0, lo=12, hi=40):
    im = Image.open(src).convert("RGB")
    paper0 = corner_paper(im)
    d0 = ImageDraw.Draw(im)
    for box in erase:
        d0.rectangle(box, fill=paper0)
    ox, oy = 0, 0
    if crop:
        im = im.crop(crop); ox, oy = crop[0], crop[1]
    k = width / im.width
    im = im.resize((width, round(im.height * k)), Image.LANCZOS)
    paper = paper0  # measured on the whole sheet: the corners of a crop may hold artwork
    chans = [c.point(lambda v, g=SITE_PAPER[i] / paper[i]: min(255, int(v * g))) for i, c in enumerate(im.split())]
    im = Image.merge("RGB", chans)
    r, g, b = ImageChops.difference(im, Image.new("RGB", im.size, SITE_PAPER)).split()
    m = ImageChops.lighter(ImageChops.lighter(r, g), b)
    soft = m.point(lambda v: 0 if v <= lo else 255 if v >= hi else int((v - lo) * 255 / (hi - lo)))
    # paper = pixels within `tol` of the site paper (tolerant: the paper grain and tone drift across a sheet)
    tol = 12
    flat = m.point(lambda v: 0 if v <= tol else max(1, v))
    filled = flat.copy()
    w, h = filled.size
    pts = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    pts += [(round((x - ox) * k), round((y - oy) * k)) for x, y in seeds]
    for pt in pts:
        if 0 <= pt[0] < w and 0 <= pt[1] < h and flat.getpixel(pt) == 0 and filled.getpixel(pt) != 128:
            ImageDraw.floodfill(filled, pt, 128, thresh=0)
    reached = filled.point(lambda v: 255 if v == 128 else 0)
    outside = ImageChops.multiply(reached, flat.point(lambda v: 255 if v == 0 else 0))
    zone = outside.filter(ImageFilter.MaxFilter(7))
    alpha = ImageChops.lighter(ImageChops.multiply(soft, zone), ImageChops.invert(zone))
    if fade_bottom:
        n = max(1, round(h * fade_bottom))
        ramp = Image.new("L", (w, h), 255)
        ImageDraw.Draw(ramp).rectangle((0, 0, w, h), fill=255)
        for y in range(h - n, h):
            ImageDraw.Draw(ramp).line((0, y, w, y), fill=int(255 * (h - 1 - y) / n))
        alpha = ImageChops.multiply(alpha, ramp)
    im.putalpha(alpha)
    im.save(dst, "WEBP", quality=88, method=6)
    return paper0


def box(s):
    return tuple(int(float(v)) for v in s.split(","))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("dst")
    ap.add_argument("--width", type=int, default=1024)
    ap.add_argument("--crop", type=box)
    ap.add_argument("--erase", type=box, action="append", default=[])
    ap.add_argument("--seed", type=lambda s: tuple(int(float(v)) for v in s.split(",")), action="append", default=[])
    ap.add_argument("--fade-bottom", type=float, default=0.0)
    a = ap.parse_args()
    print("paper was", key(a.src, a.dst, a.width, a.crop, a.erase, a.seed, a.fade_bottom))
