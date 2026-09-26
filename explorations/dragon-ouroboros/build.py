"""Cut Danya's Dragão Ouroboros video back into layers and inline them into index.html.

Run:  python build.py        (needs ffmpeg on PATH, Pillow, numpy, scipy)
Input:  source/dragao_ouroboros.mp4  (764x806, 30 fps, 24 s: rigid 360° CCW spin + 7 drifting clouds)
Output: rewrites the @@LAYERS block inside index.html.

Pipeline (numbers measured once; see NOTES.md):
  1. decode at 5 fps -> 120 frames
  2. counter-rotate frame k by 3k degrees about C, per-pixel median -> clean dragon (clouds vanish)
  3. plain median over frames -> static paper (the ring smear in the middle is blanked)
  4. clouds: per-frame darkness vs paper, outside the rotated dragon mask; sprites cut from the
     frame where each is unobstructed, or from a motion-compensated median (drift 41 px/s)
  5. dragon split into layers: body ring, two wings, "flex" (green whiskers/mane + thin tips),
     green-on-body; plus a weight field (distance from the body) that drives secondary motion
"""
import base64, io, json, subprocess
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as nd

HERE = Path(__file__).parent
W, H = 764, 806
C = (383.5, 357.5)            # rotation centre (fit by minimising derotated-frame error)
DEG_PER_FRAME = 3.0           # at 5 fps: 360° / 24 s
PAPER = np.array([251, 251, 236], np.float32)
CLOUD_V = 41.0                # px/s, dominant cloud drift
HEAD = (290, 480)             # eye position in the frame-0 orientation
WING_SEEDS = [(79, 397), (309, 319)]   # outer-left wing, inner wing (inside the ring hole)

# ---- 1. decode ----
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(HERE / 'source/dragao_ouroboros.mp4'),
                      '-vf', 'fps=5', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                     capture_output=True, check=True).stdout
frames = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
N = len(frames)

# ---- 2. clean dragon ----
der = np.stack([np.asarray(Image.fromarray(frames[k]).rotate(-DEG_PER_FRAME * k, resample=Image.BICUBIC,
                center=C, fillcolor=tuple(PAPER.astype(int)))) for k in range(N)])
dragon = np.median(der, 0).astype(np.float32)
del der

# ---- 3. paper ----
paper = np.median(frames, 0).astype(np.float32)
smear = nd.binary_opening(np.abs(paper - PAPER).sum(-1) > 20, iterations=2)
lab, n = nd.label(smear)
if n:
    sz = nd.sum(smear, lab, range(1, n + 1))
    paper[np.isin(lab, 1 + np.nonzero(sz > 5000)[0])] = PAPER

# ---- 4. clouds ----
dm = nd.binary_dilation(np.abs(dragon - PAPER).sum(-1) > 40, iterations=4)
dmi = Image.fromarray((dm * 255).astype(np.uint8))
valid = np.stack([~(np.asarray(dmi.rotate(DEG_PER_FRAME * k, center=C)) > 127) for k in range(N)])
dark = np.clip((paper[None] - frames.astype(np.float32)).sum(-1), 0, 765)

FRAME_SPRITES = [(3, 18, 92, 112, 95), (30, 3, 382, 88, 102), (69, 560, 597, 189, 97), (0, 185, 668, 366, 99)]
PAN_SPRITES = [(395, 395, 160, 80), (1480, 35, 270, 100)]   # (u, y, w, h) in the unwrapped strip
sprites = []
P = 8
for k, x, y, w, h in FRAME_SPRITES:
    sprites.append(dark[k, max(0, y - P):y + h + P, max(0, x - P):x + w + P])  # negative start would wrap
span = int(CLOUD_V * 24) + 2
for u0, y0, w, h in PAN_SPRITES:
    obs = []
    for k in range(N):
        s = int(round(CLOUD_V * k / 5))
        x0 = u0 - span + s
        if x0 < 0 or x0 + w > W:
            continue
        m = valid[k, y0:y0 + h, x0:x0 + w]
        obs.append(np.where(m, dark[k, y0:y0 + h, x0:x0 + w], np.nan))
    sprites.append(np.nan_to_num(np.nanmedian(np.stack(obs), 0)))
inked = (dark > 200) & valid                                # cloud strokes only, never the dragon
ink = frames[inked].mean(0) if inked.any() else np.array([80, 60, 60])

def cloud_png(d):
    a = np.clip((d - 25) / 170, 0, 1) ** .85
    rgba = np.zeros(d.shape + (4,), np.uint8)
    rgba[..., :3] = ink.astype(np.uint8)
    rgba[..., 3] = (a * 255).astype(np.uint8)
    return rgba

# ---- 5. dragon layers ----
dimg = Image.fromarray(dragon.astype(np.uint8))
hsv = np.asarray(dimg.convert('HSV')).astype(np.float32)
Hh, S, V = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255

sil = nd.binary_closing(np.abs(dragon - PAPER).sum(-1) > 36, iterations=3)
holes = nd.binary_fill_holes(sil) & ~sil
lab, n = nd.label(holes); sz = nd.sum(holes, lab, range(1, n + 1))
sil |= np.isin(lab, 1 + np.nonzero(sz < 6000)[0])          # wing interiors become solid
lab, n = nd.label(sil); sz = nd.sum(sil, lab, range(1, n + 1))
sil = np.isin(lab, 1 + np.nonzero(sz > 400)[0])

green = (Hh > 55) & (Hh < 175) & (S > .12) & (V < .95) & sil
lab, n = nd.label(green); sz = nd.sum(green, lab, range(1, n + 1))
green = np.isin(lab, 1 + np.nonzero(sz >= 4)[0])

warm = ((Hh < 45) | (Hh > 290)) & (S > .22) & sil
body = nd.binary_opening(warm, iterations=4)
lab, n = nd.label(body); sz = nd.sum(body, lab, range(1, n + 1))
body = lab == (1 + np.argmax(sz))
body = nd.binary_closing(body, iterations=6)
holes = nd.binary_fill_holes(body) & ~body
lab, n = nd.label(holes); sz = nd.sum(holes, lab, range(1, n + 1))
ring_hole = lab == (1 + np.argmax(sz))
body |= np.isin(lab, 1 + np.nonzero(sz < 8000)[0])
yy, xx = np.nonzero(ring_hole)
RC = (float(xx.mean()), float(yy.mean()))                   # ring centre (for the body wave)

outside = sil & ~nd.binary_dilation(body, iterations=2)
lab, n = nd.label(outside)
greenish = nd.binary_dilation(green, iterations=2)
# a seed is a centroid, which can fall outside a curvy shape: take the nearest big component
sizes = nd.sum(outside, lab, range(1, n + 1))
big = [i for i in range(1, n + 1) if sizes[i - 1] > 3000]
def nearest(x, y):
    return min(big, key=lambda i: np.min(np.hypot(*(np.nonzero(lab == i)[::-1] - np.array([[x], [y]])))))
wing_ids = [nearest(x, y) for x, y in WING_SEEDS]
wings, flex = [lab == i for i in wing_ids], np.zeros_like(sil)
for i in range(1, n + 1):
    m = lab == i; a = int(sizes[i - 1])
    if a < 30 or i in wing_ids:
        continue
    if (m & greenish).sum() / a >= .1 or a < 3000:
        flex |= m
body_layer = sil & ~flex & ~wings[0] & ~wings[1]
green_on_body = green & body_layer & body

# wing hinges: nearest body pixel to each wing's centroid; axis points outward along the wing
dist_b, (iy, ix) = nd.distance_transform_edt(~body, return_indices=True)
wing_params = []
for m in wings:
    ys, xs = np.nonzero(m)
    cx, cy = xs.mean(), ys.mean()
    hx, hy = ix[int(cy), int(cx)], iy[int(cy), int(cx)]
    ax, ay = cx - hx, cy - hy; L = np.hypot(ax, ay) or 1
    wing_params.append(dict(hinge=[float(hx), float(hy)], axis=[float(ax / L), float(ay / L)]))

# flex weight: 0 at the body, 1 about 70 px out; smooth so displaced lookups stay coherent
weight = nd.gaussian_filter(np.clip(dist_b / 70, 0, 1), 4)

def layer(mask, rgb, fill_from=None):
    """Straight-alpha RGBA; RGB bled outward so bilinear filtering has no dark fringe."""
    rgb = rgb.copy()
    if fill_from is not None:                                 # inpaint holes left by removed pixels
        _, (fy, fx) = nd.distance_transform_edt(~fill_from, return_indices=True)
        hole = mask & ~fill_from
        rgb[hole] = nd.gaussian_filter(rgb[fy, fx], (1.5, 1.5, 0))[hole]
    _, (by, bx) = nd.distance_transform_edt(~mask, return_indices=True)
    rgb = rgb[by, bx]
    a = np.clip(nd.gaussian_filter(mask.astype(np.float32), .7) * 1.4, 0, 1)
    return np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)

def png_uri(arr, mode=None):
    b = io.BytesIO(); Image.fromarray(arr, mode).save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def jpg_uri(arr):
    b = io.BytesIO(); Image.fromarray(arr).save(b, 'JPEG', quality=90)
    return 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()

layers = {
    'W': W, 'H': H, 'C': C, 'RC': RC, 'HEAD': HEAD, 'wings': wing_params, 'cloudV': CLOUD_V,
    'paper': jpg_uri(paper.astype(np.uint8)),
    'body': png_uri(layer(body_layer, dragon, fill_from=body_layer & ~green_on_body)),
    'greenBody': png_uri(layer(green_on_body, dragon)),
    'flex': png_uri(layer(flex, dragon)),
    'wing0': png_uri(layer(wings[0], dragon)),
    'wing1': png_uri(layer(wings[1], dragon)),
    'weight': png_uri((weight * 255).astype(np.uint8), 'L'),
    'clouds': [png_uri(cloud_png(s)) for s in sprites],
}

page = HERE / 'index.html'
html = page.read_text(encoding='utf-8')
b, e = '// @@LAYERS-BEGIN (generated by build.py, do not edit)\n', '// @@LAYERS-END'
i, j = html.index(b) + len(b), html.index(e)
html = html[:i] + 'window.LAYERS = ' + json.dumps(layers) + ';\n' + html[j:]
page.write_text(html, encoding='utf-8', newline='\n')
print(f'ring centre {RC[0]:.1f},{RC[1]:.1f}  wings {wing_params}')
print(f'px: body {int(body_layer.sum())} green-on-body {int(green_on_body.sum())} flex {int(flex.sum())} '
      f'wings {[int(w.sum()) for w in wings]}  -> index.html {page.stat().st_size // 1024} KB')
