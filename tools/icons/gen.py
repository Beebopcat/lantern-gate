# Original pixel-art interface icons for Lantern Gate (32x32 art, saved at 4x).
# Style matches the code-drawn sprites: hue-shifted 5-step ramps, top-left light, dark tinted outline, small glints.
import colorsys, math, os, sys
import numpy as np
from PIL import Image

N = 32

def hx(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))

def ramp(base, n=5, spread=.30):
    r, g, b = hx(base); h, l, s = colorsys.rgb_to_hls(r, g, b); out = []
    for i in range(n):
        t = i / (n - 1) - .5                      # -0.5 shadow .. +0.5 highlight
        hh = (h + (-.045 * t * 2 if t < 0 else .03 * t * 2 * (1 if .08 < h < .6 else -1))) % 1
        if t < 0: hh = (h + (0.66 - h) * .10 * (-t * 2)) % 1 if s > .08 else h
        ll = min(.95, max(.06, l + t * spread * 2 * (1.0 if t < 0 else .9)))
        ss = min(1, max(0, s * (1.08 - abs(t) * .5)))
        out.append(tuple(round(c * 255) for c in colorsys.hls_to_rgb(hh, ll, ss)))
    return out

class Icon:
    def __init__(s):
        s.c = np.zeros((N, N, 4), np.uint8)
    def put(s, x, y, col, a=255):
        if 0 <= x < N and 0 <= y < N:
            s.c[y, x, :3] = col[:3]; s.c[y, x, 3] = a
    def shade(s, R, l):
        i = int(round((l + .62) / 1.45 * (len(R) - 1))); return R[max(0, min(len(R) - 1, i))]
    def ell(s, cx, cy, rx, ry, R, mode='sphere', clip=None, light=(-.55, -.7)):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry; d = u * u + v * v
                if d > 1 or (clip and not clip(x, y)): continue
                nz = math.sqrt(max(0, 1 - d))
                if mode == 'sphere': l = light[0] * u + light[1] * v + .45 * nz - .1
                elif mode == 'flat': l = .25 - .35 * (u + v) / 2 - .25 * (d > .72)
                else: l = -.6 * u + .3 * nz
                s.put(x, y, s.shade(R, l))
    def rect(s, x0, y0, x1, y1, R, mode='flat'):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                u = (x - x0) / max(1, x1 - x0) * 2 - 1; v = (y - y0) / max(1, y1 - y0) * 2 - 1
                if mode == 'flat': l = .2 - .3 * (u + v) / 2
                elif mode == 'cylx': l = -.65 * u + .35 * math.sqrt(max(0, 1 - u * u)) - .05
                elif mode == 'cyly': l = -.65 * v + .35 * math.sqrt(max(0, 1 - v * v)) - .05
                else: l = mode
                if mode in ('flat', 'cylx', 'cyly') and (x == x1 or y == y1): l -= .35
                if mode in ('flat',) and (x == x0 or y == y0): l += .25
                s.put(x, y, s.shade(R, l))
    def poly(s, pts, R, mode='flat', bevel=True):
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]; x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        def inside(px, py):
            c = False; j = len(pts) - 1
            for i in range(len(pts)):
                xi, yi = pts[i]; xj, yj = pts[j]
                if (yi > py) != (yj > py) and px < (xj - xi) * (py - yi) / (yj - yi) + xi: c = not c
                j = i
            return c
        m = {}
        for y in range(int(y0) - 1, int(y1) + 2):
            for x in range(int(x0) - 1, int(x1) + 2):
                if inside(x + .5, y + .5): m[(x, y)] = 1
        for (x, y) in m:
            u = (x - x0) / max(1, x1 - x0) * 2 - 1; v = (y - y0) / max(1, y1 - y0) * 2 - 1
            l = (.2 - .3 * (u + v) / 2) if mode == 'flat' else (-.65 * u + .2 if mode == 'cylx' else mode if isinstance(mode, float) else -.65 * v + .2)
            if bevel:
                if (x + 1, y) not in m or (x, y + 1) not in m: l -= .35
                elif (x - 1, y) not in m or (x, y - 1) not in m: l += .3
            s.put(x, y, s.shade(R, l))
        return m
    def line(s, x0, y0, x1, y1, col, w=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            t = i / n; x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t
            for dx in range(w):
                for dy in range(w):
                    s.put(int(round(x - (w - 1) / 2 + dx)), int(round(y - (w - 1) / 2 + dy)), col)
    def tline(s, x0, y0, x1, y1, R, w=3):
        """Thick shaded bar along a line (light on the upper-left side)."""
        dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
        if nx + ny > 0: nx, ny = -nx, -ny                     # normal pointing up-left
        n = int(L * 2) + 1
        for i in range(n + 1):
            t = i / n; cx = x0 + dx * t; cy = y0 + dy * t
            for k in range(w):
                o = k - (w - 1) / 2; l = -(o / max(1, (w - 1) / 2)) * .55 + .05
                s.put(int(round(cx + nx * o)), int(round(cy + ny * o)), s.shade(R, l))
    def glint(s, x, y, big=False):
        s.put(x, y, (255, 250, 230))
        if big:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)): s.put(x + dx, y + dy, (255, 236, 190), 255)
    def glow(s, cx, cy, r, col):
        # soft halo behind art (only on transparent pixels), quantised to 3 alpha steps for a pixel look
        for y in range(N):
            for x in range(N):
                if s.c[y, x, 3]: continue
                d = math.hypot(x + .5 - cx, y + .5 - cy) / r
                if d < 1: a = [0, 60, 110, 160][min(3, int((1 - d) * 4))]; s.c[y, x] = (*col, a) if a else s.c[y, x]
    def outline(s, tint=(24, 14, 30)):
        a = s.c[:, :, 3] == 255; out = s.c.copy()
        for y in range(N):
            for x in range(N):
                if a[y, x]: continue
                nb = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + dx < N and 0 <= y + dy < N and a[y + dy, x + dx]]
                if nb:
                    cs = np.mean([s.c[yy, xx, :3] for xx, yy in nb], axis=0)
                    col = (cs * .28 + np.array(tint) * .72).astype(np.uint8)
                    out[y, x, :3] = col; out[y, x, 3] = 255
        s.c = out
    def save(s, path, scale=4):
        Image.fromarray(s.c, 'RGBA').resize((N * scale, N * scale), Image.NEAREST).save(path, lossless=True, quality=100)

# ---------------------------------------------------------------- palettes
GOLD = ramp('#c8962e'); BRASS = ramp('#b08a3c'); SILVER = ramp('#9aa6b4', spread=.34); STEEL = ramp('#7d8a98')
WOOD = ramp('#8a5a32'); DWOOD = ramp('#5e3b22'); CRUST = ramp('#b8742f'); PARCH = ramp('#e2cf9c', spread=.22)
RED = ramp('#a8343a'); GREEN = ramp('#4f9a48'); LEAFG = ramp('#5fae6a'); BLUE = ramp('#3d74c8'); GLASS = ramp('#5fa9d8')
STONE = ramp('#7c7f86'); DSTONE = ramp('#55565e'); CLOTH = ramp('#7a5236'); TEAL = ramp('#2f8f86'); ROSE = ramp('#c45a6e')
BRONZE = ramp('#a8672e'); COPPER = ramp('#c7703a'); PEARL = ramp('#e6e1ea', spread=.18); EMBER = ramp('#e8742c'); PURPLE = ramp('#7a58b8')
BRICK = ramp('#9c4c36'); CREAM = ramp('#e9dcc0', spread=.2); LEATHER = ramp('#7b4a2c'); NAVY = ramp('#2e3e6e')
WARM = (255, 200, 110)
I = {}
def icon(name):
    def deco(f): I[name] = f; return f
    return deco

@icon('bread')
def _(k):
    k.ell(16, 18, 12, 8, CRUST)
    k.ell(16, 15, 10, 5.5, ramp('#cf8c3c'), clip=lambda x, y: y < 18)
    for x0 in (9, 14, 19):
        k.line(x0, 17, x0 + 4, 12, ramp('#f0c27a')[3])
    for x, y in ((11, 13), (17, 12), (22, 15)): k.put(x, y, (250, 238, 214))
    k.outline()

@icon('tonic')
def _(k):
    k.rect(13, 3, 18, 6, ramp('#8a5d38'), 'cylx')
    k.rect(12, 7, 19, 8, SILVER, 'cylx')
    k.rect(13, 9, 18, 12, GLASS, 'cylx')
    k.ell(15.5, 20.5, 9, 9, ramp('#7cc0e8', spread=.25))
    k.ell(15.5, 22, 7.5, 6.5, ramp('#2f62c4'), clip=lambda x, y: y >= 18)
    k.line(11, 18, 20, 18, ramp('#8fd4ff')[4])
    k.glint(11, 15, True); k.put(14, 13, (230, 245, 255))
    k.outline()

@icon('salve')
def _(k):
    k.rect(5, 15, 26, 24, BRASS, 'cylx')
    k.ell(15.5, 24.5, 10.5, 3, BRASS, 'cyl', clip=lambda x, y: y >= 24)
    k.ell(15.5, 13, 11, 4.5, ramp('#c9a24a'), 'flat')
    k.ell(15.5, 12.5, 6.5, 2.5, GREEN, 'flat')
    k.line(13, 12, 18, 13, LEAFG[4])
    k.line(5, 17, 26, 17, BRASS[0])
    k.glint(8, 19); k.glint(10, 11)
    k.outline()

@icon('sword')
def _(k):
    k.tline(9, 22, 26, 5, SILVER, 3)
    k.line(10, 21, 25, 6, SILVER[4])
    k.tline(5, 18, 13, 26, GOLD, 3)
    k.tline(5, 26, 9, 22, ramp('#6a3b26'), 3)
    k.ell(4.5, 27.5, 2.5, 2.5, GOLD)
    k.glint(23, 8)
    k.outline()

@icon('armor')
def _(k):
    k.poly([(9, 6), (13, 8), (19, 8), (23, 6), (28, 10), (25, 15), (24, 27), (8, 27), (7, 15), (4, 10)], STEEL)
    k.poly([(13, 8), (16, 13), (19, 8)], LEATHER, 'flat')
    k.line(16, 13, 16, 26, STEEL[1])
    for y in (16, 21):
        for x in (11, 21): k.put(x, y, GOLD[4]); k.put(x + 1, y + 1, GOLD[1])
    k.rect(9, 23, 23, 24, LEATHER, 'cylx'); k.put(16, 23, GOLD[4])
    k.outline()

@icon('bow')
def _(k):
    pts = [(9 + 13 * math.sin(t * math.pi) * .9, 4 + t * 24) for t in [i / 40 for i in range(41)]]
    for i in range(len(pts) - 1):
        k.tline(pts[i][0] + 2, pts[i][1], pts[i + 1][0] + 2, pts[i + 1][1] + .01, WOOD, 3)
    k.line(10, 4, 10, 28, (230, 222, 200))
    k.rect(19, 14, 22, 18, LEATHER, 'cylx')
    k.outline()

@icon('lantern')
def _(k):
    k.glow(16, 18, 14, WARM)
    k.ell(16, 4.5, 3, 2.5, BRASS, 'flat'); k.put(16, 4, (0, 0, 0), 0)
    k.poly([(10, 10), (13, 7), (19, 7), (22, 10)], DSTONE)
    k.rect(10, 11, 21, 23, ramp('#ffcf6a', spread=.2), 'cylx')
    k.ell(16, 18, 3, 4, ramp('#fff3c0', spread=.1))
    for x in (10, 15, 21): k.line(x, 11, x, 23, ramp('#3c3a44')[1])
    k.rect(9, 24, 22, 26, DSTONE, 'cylx')
    k.outline()

@icon('journal')
def _(k):
    k.rect(8, 5, 25, 27, CREAM, 'flat')
    k.rect(6, 4, 23, 26, LEATHER, 'flat')
    k.rect(6, 4, 8, 26, ramp('#5a3420'), 'cylx')
    k.rect(12, 10, 19, 15, GOLD, 'flat'); k.rect(13, 11, 18, 14, LEATHER, 'flat'); k.put(15, 12, GOLD[4]); k.put(16, 13, GOLD[3])
    k.line(23, 14, 26, 14, ramp('#7a2d2a')[2], 1)
    k.outline()

@icon('map')
def _(k):
    k.poly([(4, 8), (11, 5), (20, 8), (28, 5), (28, 25), (20, 28), (11, 25), (4, 28)], PARCH, 'flat', bevel=False)
    k.line(11, 5, 11, 25, PARCH[1]); k.line(20, 8, 20, 28, PARCH[1])
    for i, (x, y) in enumerate([(7, 22), (9, 19), (12, 18), (15, 16), (17, 13), (20, 12)]):
        if i % 1 == 0: k.put(x, y, RED[2])
    k.line(21, 10, 25, 14, RED[3]); k.line(25, 10, 21, 14, RED[3])
    k.ell(8, 11, 2, 1.5, ramp('#6f9a5c'), 'flat')
    k.outline()

@icon('fish')
def _(k):
    k.ell(14, 16, 10, 6, ramp('#7f9fa8', spread=.32))
    k.ell(14, 18.5, 8.5, 3, ramp('#d9d2bc', spread=.2), clip=lambda x, y: y >= 18)
    k.poly([(22, 16), (29, 10), (27, 16), (29, 22)], ramp('#6b8790'))
    k.poly([(11, 10), (16, 7), (18, 11)], ramp('#6b8790'))
    for x, y in ((12, 14), (15, 13), (17, 15)): k.put(x, y, ramp('#c96a6a')[3])
    k.put(8, 15, (20, 20, 26)); k.put(7, 14, (240, 240, 240))
    k.outline()

@icon('leaf')
def _(k):
    k.poly([(5, 27), (8, 15), (16, 7), (27, 4), (25, 15), (18, 23)], LEAFG)
    k.line(5, 27, 24, 6, ramp('#e3f1ec')[4])
    for (a, b, c, d) in ((10, 20, 9, 15), (14, 16, 13, 11), (18, 12, 19, 8), (12, 19, 17, 21), (16, 15, 21, 16), (20, 11, 24, 11)):
        k.line(a, b, c, d, ramp('#cfe6e0')[3])
    k.outline()

@icon('ore')
def _(k):
    k.poly([(4, 24), (6, 15), (12, 9), (19, 10), (25, 7), (29, 15), (27, 25), (16, 28)], DSTONE)
    k.poly([(12, 9), (19, 10), (16, 17), (8, 18)], STONE)
    for (a, b, c, d) in ((9, 22, 14, 19), (14, 19, 19, 22), (21, 13, 25, 18), (17, 14, 20, 15)):
        k.line(a, b, c, d, EMBER[3])
    k.put(14, 19, (255, 230, 150)); k.put(25, 18, (255, 220, 140))
    k.outline()

@icon('wood')
def _(k):
    for (y, x0) in ((20, 4), (12, 8)):
        k.rect(x0, y - 4, x0 + 18, y + 4, WOOD, 'cyly')
        k.ell(x0 + 19, y + .5, 3.5, 4.5, ramp('#d8b07a', spread=.2), 'flat')
        k.ell(x0 + 19, y + .5, 1.5, 2, ramp('#a8763e'), 'flat')
        k.line(x0 + 3, y - 1, x0 + 12, y - 1, WOOD[1])
    k.outline()

@icon('coil')
def _(k):
    for i in range(6):
        x = 7 + i * 3.6
        k.ell(x, 16, 3, 9, COPPER, 'cyl', clip=lambda xx, yy, x=x: (xx + .5 - x) > -1.2 or abs(yy - 16) > 6)
    k.tline(3, 24, 7, 22, COPPER, 2); k.tline(25, 9, 29, 7, COPPER, 2)
    k.glint(8, 10)
    k.outline()

@icon('lens')
def _(k):
    k.glow(16, 16, 15, (170, 220, 255))
    k.ell(16, 16, 12, 12, BRASS)
    k.ell(16, 16, 9, 9, ramp('#9fd6f0', spread=.22), 'flat')
    k.ell(13, 13, 3.5, 2.5, ramp('#f2fbff', spread=.08), 'flat')
    k.glint(21, 20)
    for a in range(0, 360, 45):
        r = math.radians(a); k.put(int(16 + 10.6 * math.cos(r)), int(16 + 10.6 * math.sin(r)), GOLD[4])
    k.outline()

@icon('medallion')
def _(k):
    k.line(10, 3, 13, 9, BLUE[2], 2); k.line(22, 3, 19, 9, BLUE[2], 2)
    k.ell(16, 18, 10, 10, GOLD)
    k.ell(16, 18, 7, 7, ramp('#b58a2e'), 'flat')
    for x in range(11, 22):
        k.put(x, int(18 + 2 * math.sin((x - 11) / 2)), GOLD[4])
    k.glint(12, 13)
    k.outline()

@icon('bell')
def _(k):
    k.ell(16, 5, 2.5, 2, BRONZE, 'flat')
    k.poly([(10, 21), (11, 11), (14, 7), (18, 7), (21, 11), (22, 21), (26, 25), (6, 25)], BRONZE, 'cylx')
    k.ell(16, 25, 10, 2, ramp('#7a4a22'), 'flat')
    k.ell(16, 27, 2.5, 2.5, BRONZE)
    k.line(12, 12, 12, 20, BRONZE[4]); k.line(8, 23, 24, 23, BRONZE[1])
    k.outline()

@icon('pearl')
def _(k):
    k.poly([(3, 22), (8, 15), (16, 13), (24, 15), (29, 22), (24, 27), (8, 27)], ramp('#d9a6a0', spread=.25))
    for x in (8, 12, 16, 20, 24): k.line(16, 26, x, 16, ramp('#b8807c')[1])
    k.ell(16, 16, 6, 6, PEARL)
    k.glow(16, 16, 10, (230, 220, 255))
    k.glint(14, 13)
    k.put(19, 18, ramp('#c8b8f0')[3]); k.put(18, 19, ramp('#c8e0f0')[3])
    k.outline()

@icon('ledger')
def _(k):
    k.rect(6, 6, 26, 9, CREAM, 'flat')
    k.rect(5, 9, 26, 27, RED, 'flat')
    k.rect(5, 9, 8, 27, ramp('#7a2228'), 'cylx')
    k.rect(12, 13, 22, 17, PARCH, 'flat')
    for y in (14, 16): k.line(13, y, 21, y, PARCH[1])
    k.rect(19, 22, 26, 24, GOLD, 'cylx')
    k.outline()

@icon('locket')
def _(k):
    for i in range(10):
        t = i / 9; k.put(int(8 + 16 * t), int(4 + 6 * (1 - (2 * t - 1) ** 2) * -1 + 6), SILVER[3] if i % 2 else SILVER[1])
    k.ell(16, 19, 8, 9, SILVER)
    k.ell(16, 19, 5, 6, ramp('#8892a6'), 'flat')
    k.poly([(13, 18), (16, 15), (19, 18), (16, 22)], ROSE)
    k.ell(16, 9.5, 2, 2, SILVER)
    k.glint(12, 14)
    k.outline()

@icon('verse')
def _(k):
    k.rect(8, 6, 24, 25, PARCH, 'flat')
    k.rect(6, 4, 26, 7, ramp('#c9b07c'), 'cyly')
    k.rect(6, 24, 26, 27, ramp('#c9b07c'), 'cyly')
    for i, y in enumerate((10, 13, 16, 19)): k.line(11, y, 21 - (i % 2) * 3, y, ramp('#6a4a3a')[2])
    k.ell(21, 21, 2, 2, RED)
    k.outline()

@icon('seed')
def _(k):
    k.glow(15, 19, 11, (220, 230, 255))
    k.poly([(15, 9), (21, 16), (21, 23), (15, 28), (9, 23), (9, 16)], SILVER)
    k.line(15, 12, 15, 25, SILVER[1])
    k.tline(15, 9, 17, 4, LEAFG, 2)
    k.poly([(17, 6), (23, 3), (24, 7), (19, 8)], LEAFG)
    k.glint(12, 15)
    k.outline()

@icon('crown')
def _(k):
    k.poly([(5, 24), (5, 11), (10, 17), (16, 8), (22, 17), (27, 11), (27, 24)], GOLD)
    k.rect(5, 21, 27, 25, ramp('#b07d26'), 'cyly')
    for x, y in ((5, 10), (16, 7), (27, 10)): k.ell(x + .5, y + .5, 1.6, 1.6, GOLD)
    k.put(11, 23, ramp('#2f8f86')[3]); k.put(16, 23, RED[3]); k.put(21, 23, ramp('#2f8f86')[3])
    k.outline()

@icon('heart')
def _(k):
    k.glow(16, 17, 15, (255, 150, 90))
    k.poly([(16, 27), (5, 16), (5, 10), (9, 6), (13, 6), (16, 9), (19, 6), (23, 6), (27, 10), (27, 16)], ramp('#e2563c'))
    k.poly([(16, 22), (10, 15), (11, 11), (16, 14)], ramp('#ffb070'), .3, bevel=False)
    k.glint(10, 10, True)
    k.outline()

@icon('ring')
def _(k):
    k.ell(16, 19, 10, 8, GOLD)
    k.ell(16, 19.5, 6.5, 4.5, GOLD, 'flat')
    k.c[16:23, 11:22] = 0
    k.ell(16, 19.5, 6, 4, GOLD, 'flat', clip=lambda x, y: False)
    for y in range(16, 23):
        for x in range(10, 23):
            u = (x + .5 - 16) / 6.5; v = (y + .5 - 19.5) / 4.6
            if u * u + v * v < 1: k.c[y, x] = 0
    k.poly([(12, 11), (16, 7), (20, 11), (16, 15)], ramp('#3fb7c6'))
    k.glint(14, 10)
    k.outline()

# ------------------------------------------------------------- places, furniture, UI
@icon('home')
def _(k):
    k.rect(7, 15, 25, 27, CREAM, 'flat')
    k.poly([(4, 16), (16, 5), (28, 16)], BRICK)
    k.rect(14, 19, 18, 27, WOOD, 'flat'); k.put(17, 23, GOLD[4])
    k.rect(9, 18, 12, 21, ramp('#ffd27a'), 'flat'); k.rect(20, 18, 23, 21, ramp('#ffd27a'), 'flat')
    k.rect(21, 7, 23, 11, DSTONE, 'cylx')
    k.outline()

@icon('cave')
def _(k):
    k.poly([(2, 28), (5, 14), (11, 6), (20, 5), (27, 11), (30, 28)], STONE)
    k.poly([(9, 28), (11, 18), (16, 13), (21, 18), (23, 28)], ramp('#191626'), .0, bevel=False)
    k.line(6, 20, 9, 15, STONE[4]); k.line(22, 9, 26, 13, STONE[1])
    k.outline()

@icon('town')
def _(k):
    k.rect(12, 6, 18, 27, STONE, 'cylx'); k.poly([(11, 7), (15, 1), (19, 7)], NAVY)
    k.rect(14, 10, 16, 13, ramp('#ffd27a'), 'flat')
    k.rect(3, 17, 12, 27, CREAM, 'flat'); k.poly([(2, 18), (7, 12), (13, 18)], BRICK)
    k.rect(18, 15, 28, 27, CREAM, 'flat'); k.poly([(17, 16), (23, 10), (29, 16)], BRICK)
    k.rect(6, 21, 8, 27, WOOD, 'flat'); k.rect(22, 20, 24, 27, WOOD, 'flat')
    k.outline()

@icon('notice')
def _(k):
    k.rect(8, 22, 10, 29, DWOOD, 'cylx'); k.rect(22, 22, 24, 29, DWOOD, 'cylx')
    k.rect(4, 5, 27, 23, WOOD, 'flat')
    k.rect(6, 7, 13, 15, PARCH, 'flat'); k.rect(15, 8, 24, 14, CREAM, 'flat'); k.rect(9, 16, 18, 21, PARCH, 'flat')
    for x, y in ((9, 7), (19, 8), (13, 16)): k.put(x, y, RED[3])
    k.line(8, 11, 11, 11, PARCH[1]); k.line(17, 11, 22, 11, CREAM[1]); k.line(11, 18, 16, 18, PARCH[1])
    k.outline()

@icon('well')
def _(k):
    k.poly([(5, 10), (16, 3), (27, 10)], BRICK)
    k.rect(8, 10, 9, 20, WOOD, 'cylx'); k.rect(23, 10, 24, 20, WOOD, 'cylx')
    k.line(9, 13, 23, 13, DWOOD[2]); k.line(16, 13, 16, 18, (200, 190, 170))
    k.rect(14, 17, 18, 20, WOOD, 'flat')
    k.rect(5, 20, 27, 28, STONE, 'cylx')
    k.ell(16, 20, 11, 2, ramp('#2b4e7a'), 'flat')
    for x in (9, 15, 21): k.line(x, 23, x + 3, 23, STONE[1])
    k.outline()

@icon('anvil')
def _(k):
    k.poly([(3, 11), (11, 11), (11, 9), (28, 9), (28, 14), (21, 16), (19, 20), (11, 20), (9, 16), (5, 14)], STEEL)
    k.rect(9, 20, 21, 23, DSTONE, 'flat'); k.rect(7, 23, 23, 27, DSTONE, 'cyly')
    k.line(11, 10, 27, 10, STEEL[4])
    k.outline()

@icon('bed')
def _(k):
    k.rect(3, 9, 6, 27, WOOD, 'cylx')
    k.rect(6, 16, 28, 22, ramp('#7f4a86'), 'cyly')
    k.rect(7, 14, 13, 17, CREAM, 'cyly')
    k.rect(6, 22, 28, 24, WOOD, 'flat'); k.rect(26, 15, 28, 27, WOOD, 'cylx')
    k.line(14, 16, 27, 16, ramp('#a874ae')[4])
    k.outline()

@icon('flowers')
def _(k):
    for (x0, y0, x1, y1) in ((16, 22, 16, 11), (16, 22, 10, 13), (16, 22, 22, 12)): k.line(x0, y0, x1, y1, GREEN[2])
    k.ell(16, 9, 3, 3, ROSE); k.ell(10, 11, 2.6, 2.6, ramp('#e7c24a')); k.ell(22, 10, 2.6, 2.6, ramp('#7f8fe0'))
    k.put(16, 9, GOLD[4]); k.put(10, 11, (255, 250, 220))
    k.poly([(9, 21), (23, 21), (21, 29), (11, 29)], ramp('#b06a3c'))
    k.outline()

@icon('pet')
def _(k):
    k.ell(16, 21, 7, 6, ramp('#d39a5c'))
    for x, y in ((8, 13), (13, 9), (19, 9), (24, 13)): k.ell(x, y, 2.8, 3.2, ramp('#d39a5c'))
    k.outline()

@icon('bag')
def _(k):
    k.line(10, 12, 13, 5, LEATHER[1], 2); k.line(22, 12, 19, 5, LEATHER[1], 2); k.line(13, 5, 19, 5, LEATHER[1], 2)
    k.poly([(5, 14), (8, 11), (24, 11), (27, 14), (26, 27), (6, 27)], LEATHER)
    k.poly([(5, 14), (8, 11), (24, 11), (27, 14), (25, 19), (7, 19)], ramp('#8f5a34'))
    k.rect(14, 17, 18, 21, GOLD, 'flat'); k.put(16, 19, GOLD[0])
    k.outline()

@icon('settings')
def _(k):
    for a in range(0, 360, 45):
        r = math.radians(a); x, y = 16 + 10 * math.cos(r), 16 + 10 * math.sin(r)
        k.ell(x, y, 2.6, 2.6, STEEL, 'flat')
    k.ell(16, 16, 9, 9, STEEL)
    k.ell(16, 16, 3.5, 3.5, ramp('#202534'), 'flat')
    k.glint(12, 11)
    k.outline()

@icon('compass')
def _(k):
    k.ell(16, 16, 13, 13, BRASS)
    k.ell(16, 16, 10.5, 10.5, CREAM, 'flat')
    k.poly([(16, 6), (19, 16), (13, 16)], RED, bevel=False); k.poly([(16, 26), (19, 16), (13, 16)], ramp('#506078'), bevel=False)
    k.ell(16, 16, 1.5, 1.5, GOLD, 'flat')
    for x, y in ((16, 4), (16, 27), (4, 16), (27, 16)): k.put(x, y, BRASS[4])
    k.outline()

@icon('interact')
def _(k):
    k.poly([(4, 6), (28, 6), (28, 21), (14, 21), (8, 27), (9, 21), (4, 21)], CREAM)
    k.rect(15, 9, 17, 15, ramp('#c98a2c'), 'flat'); k.rect(15, 17, 17, 18, ramp('#c98a2c'), 'flat')
    k.outline()

@icon('person')
def _(k):
    k.poly([(5, 29), (7, 22), (12, 19), (20, 19), (25, 22), (27, 29)], TEAL)
    k.ell(16, 12, 6, 7, ramp('#e0a37c'))
    k.poly([(9, 11), (10, 6), (16, 4), (22, 6), (23, 11), (20, 8), (12, 8)], ramp('#5a3a28'))
    k.put(14, 13, (40, 28, 30)); k.put(18, 13, (40, 28, 30))
    k.outline()

@icon('chest')
def _(k):
    k.rect(4, 15, 27, 27, WOOD, 'flat')
    k.poly([(4, 15), (5, 9), (9, 6), (22, 6), (26, 9), (27, 15)], ramp('#9a6638'), 'cyly')
    for x in (7, 24): k.rect(x, 7, x + 1, 27, GOLD, 'cylx')
    k.line(4, 15, 27, 15, GOLD[2]); k.rect(14, 13, 17, 18, GOLD, 'flat'); k.put(15, 16, (30, 20, 20))
    k.outline()

@icon('check')
def _(k):
    k.tline(5, 17, 12, 24, GREEN, 4); k.tline(12, 24, 27, 8, GREEN, 4)
    k.outline()

@icon('table')
def _(k):
    k.poly([(3, 12), (29, 12), (27, 16), (5, 16)], WOOD)
    for x in (6, 24): k.rect(x, 16, x + 2, 27, DWOOD, 'cylx')
    k.ell(12, 10, 2.5, 2, CREAM, 'flat'); k.rect(19, 7, 21, 11, GLASS, 'cylx')
    k.outline()

@icon('chair')
def _(k):
    k.rect(9, 4, 11, 27, WOOD, 'cylx'); k.rect(20, 4, 22, 14, WOOD, 'cylx')
    k.rect(9, 6, 22, 8, WOOD, 'cyly'); k.rect(9, 10, 22, 11, WOOD, 'cyly')
    k.poly([(8, 16), (24, 16), (26, 19), (6, 19)], ramp('#9a6638'))
    k.rect(22, 19, 24, 27, WOOD, 'cylx')
    k.outline()

@icon('oven')
def _(k):
    k.poly([(4, 28), (4, 16), (9, 8), (16, 6), (23, 8), (28, 16), (28, 28)], BRICK)
    for y in (12, 18, 24):
        for x in range(6 + (y % 12 == 0) * 3, 27, 6): k.put(x, y, BRICK[1])
    k.poly([(10, 28), (10, 21), (16, 16), (22, 21), (22, 28)], ramp('#26161a'), .0, bevel=False)
    k.ell(16, 25, 4, 3, EMBER, 'flat'); k.put(16, 24, (255, 230, 150))
    k.outline()

@icon('bookcase')
def _(k):
    k.rect(4, 3, 27, 28, DWOOD, 'flat')
    k.rect(6, 5, 25, 26, ramp('#2a1a14'), .0)
    cols = [RED, BLUE, GREEN, GOLD, PURPLE, TEAL, ROSE]
    for row, y in enumerate((5, 14)):
        x = 6
        for i in range(6):
            w = 2 + (i + row) % 2; h = 7 + (i * 3 + row) % 3
            k.rect(x, y + 8 - h, x + w - 1, y + 7, cols[(i + row * 3) % 7], 'cylx'); x += w + (1 if i % 3 == 2 else 0)
    k.rect(5, 13, 26, 14, WOOD, 'cyly'); k.rect(5, 22, 26, 23, WOOD, 'cyly')
    k.outline()

@icon('stall')
def _(k):
    for x in (5, 25): k.rect(x, 10, x + 1, 28, WOOD, 'cylx')
    for i in range(6):
        k.poly([(3 + i * 4.5, 6), (7.5 + i * 4.5, 6), (7.5 + i * 4.5, 12), (3 + i * 4.5, 12)], RED if i % 2 == 0 else CREAM, 'cyly', bevel=False)
    k.rect(3, 19, 29, 22, WOOD, 'cyly')
    k.ell(10, 17.5, 2.5, 2, ramp('#d8823a')); k.ell(16, 17.5, 2.5, 2, LEAFG); k.ell(22, 17.5, 2.5, 2, RED)
    k.outline()

@icon('grave')
def _(k):
    k.poly([(8, 27), (8, 11), (11, 6), (16, 4), (21, 6), (24, 11), (24, 27)], STONE)
    k.rect(15, 9, 17, 20, STONE, .3); k.rect(12, 12, 20, 14, STONE, .3)
    k.rect(4, 26, 28, 28, ramp('#4f7a3c'), 'cyly')
    k.outline()

@icon('cart')
def _(k):
    k.poly([(4, 10), (24, 10), (23, 20), (5, 20)], WOOD)
    k.line(5, 13, 23, 13, WOOD[1]); k.line(5, 16, 23, 16, WOOD[1])
    k.line(24, 16, 30, 13, DWOOD[2], 2)
    for cx in (9, 20):
        k.ell(cx, 23, 5, 5, DWOOD); k.ell(cx, 23, 3, 3, ramp('#c09a6a'), 'flat'); k.put(cx, 23, DWOOD[0])
    k.outline()

if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for name, f in I.items():
        k = Icon(); f(k); k.save(os.path.join(out, name + '.webp'))
        k.save(os.path.join(out, name + '.png'), 1)
    print(len(I), 'icons')
