#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Spot verticale 1080x1920, 30 fps, 37,5 s - McCormick X7.624 Digital Edition.

Cosa fa questo file (tutto in uno):
  1. prepara l'immagine del trattore (grading scuro cinematografico);
  2. disegna ogni fotogramma in Python (Ken Burns, particelle, testi, grafiche)
     e lo passa a ffmpeg tramite pipe (rawvideo rgb24);
  3. sintetizza la musica in numpy, la mixa con la voce (con ducking);
  4. unisce video + audio (loudnorm -15 LUFS a due passaggi, AAC 256k).

Uso:
  python3 render_spot.py              -> fa tutto e crea spot_mccormick_x7.mp4
  python3 render_spot.py --check      -> solo 9 fotogrammi di prova in check/ (veloce)
  python3 render_spot.py --video      -> solo il video (senza audio)
  python3 render_spot.py --audio      -> solo l'audio (mix_raw.f32)
  python3 render_spot.py --mux        -> solo unione audio+video
Il nome McCormick e' scritto solo come testo: nessun logo viene disegnato.
"""
import os, sys, json, math, subprocess, re
from functools import lru_cache
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ----------------------------------------------------------------------------
# Percorsi e costanti
# ----------------------------------------------------------------------------
S = "/tmp/claude-0/-home-user-Ale/379ec5c7-b0cd-5a3a-a399-050e5f535b30/scratchpad/spot"
BASE = f"{S}/frames/base_1080.png"
VOICE = f"{S}/voce1.mp3"
FONTS = {
    "B": f"{S}/fonts/BarlowCondensed-Bold.ttf",       # titoli e numeri
    "S": f"{S}/fonts/BarlowCondensed-SemiBold.ttf",   # dati
    "L": f"{S}/fonts/Barlow-SemiBold.ttf",            # etichette
}
VIDEO_TMP = f"{S}/video_noaudio.mp4"
MIX_RAW = f"{S}/mix_raw.f32"
FINAL = f"{S}/spot_mccormick_x7.mp4"
CHECK_DIR = f"{S}/check"

W, H, FPS = 1080, 1920, 30
DUR = 37.5
NFRAMES = int(round(DUR * FPS))
RED = np.array([225, 29, 42], np.float32)
WHITE = np.array([246, 246, 246], np.float32)
GREY = np.array([185, 187, 192], np.float32)
BLACK = np.array([0, 0, 0], np.float32)
MARG = 70                     # margine di sicurezza
XL, XR = MARG, W - MARG       # bordi utili (70 .. 1010)
MAXZOOM = 1.7                 # mai oltre questo ingrandimento

# Stacchi tra le scene (tempo video) e finestra della linea rossa (0,42 s)
BOUNDS = [3.1, 8.6, 13.1, 15.6, 20.1, 24.8, 27.5, 32.1]
WIPE_BEFORE, WIPE_AFTER = 0.30, 0.12

# ----------------------------------------------------------------------------
# Funzioni di curva (easing)
# ----------------------------------------------------------------------------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))

def oc(x):          # ease-out cubica
    x = clamp(x)
    return 1 - (1 - x) ** 3

def io(x):          # ease-in-out cubica
    x = clamp(x)
    return 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2

def spring(s):      # molla smorzata: sale, supera un poco e si assesta
    if s <= 0:
        return 0.0
    return 1 - math.exp(-7 * s) * math.cos(16 * s)

# ----------------------------------------------------------------------------
# Immagine di base: grading + maschere fisse
# ----------------------------------------------------------------------------
G = {}   # dati pronti (creati una volta, poi ereditati dai processi figli)

def init_assets():
    if G:
        return
    img = cv2.imread(BASE)[:, :, ::-1].astype(np.float32) / 255.0   # RGB 0-1
    assert img.shape[:2] == (H, W)
    # contrasto in piu' (curva ad S) e un poco piu' scuro
    x = np.clip(0.5 + (img - 0.5) * 1.22, 0, 1)
    x = np.clip(x ** 1.0 * 1.12, 0, 1)
    # saturazione -15% sui colori, rossi vivi (anzi un filo piu' forti)
    hsv = cv2.cvtColor(x, cv2.COLOR_RGB2HSV)
    hue = hsv[:, :, 0]
    red = ((hue < 28) | (hue > 332)).astype(np.float32)
    red = cv2.GaussianBlur(red, (0, 0), 2)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * (0.85 * (1 - red) + 1.08 * red), 0, 1)
    x = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)
    # leggerissima nitidezza (l'originale e' morbido), senza aloni
    bl = cv2.GaussianBlur(x, (0, 0), 1.6)
    x = np.clip(x + 0.45 * (x - bl), 0, 1)
    G["base"] = (x * 255).astype(np.uint8)
    G["lum"] = None

    # vignettatura forte + sfumature nere in alto e in basso (maschera unica)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 * 0.95 + ((yy - H * 0.47) / (H / 2)) ** 2)
    sm = lambda a, b, v: (lambda u: u * u * (3 - 2 * u))(np.clip((v - a) / (b - a), 0, 1))
    vig = 1 - 0.62 * sm(0.30, 1.15, r)
    top = 0.88 * (1 - sm(0, 650, yy))
    bot = 0.92 * sm(1290, 1920, yy)
    G["mask"] = (vig * (1 - top) * (1 - bot)).astype(np.float32)[:, :, None]
    G["yy"], G["xx"] = yy, xx
    # disegno "u" per la linea di stacco (diagonale) e per la luce che passa
    G["u_wipe"] = 0.80 * xx + 0.60 * yy
    G["u_wipe_f"] = 0.80 * (W - xx) + 0.60 * yy
    # grana leggera (evita le bande nei neri dopo la compressione)
    rng = np.random.RandomState(3)
    G["grain"] = rng.normal(0, 1.5, (H + 64, W + 64)).astype(np.float32)
    # particelle
    rng = np.random.RandomState(11)
    n = 85
    G["par"] = dict(
        x0=rng.uniform(0, W, n), y0=rng.uniform(0, H, n),
        v=rng.uniform(22, 85, n), r=rng.choice([1, 1, 2, 2, 3], n),
        ph=rng.uniform(0, 6.28, n), fr=rng.uniform(1.2, 3.5, n),
        sw=rng.uniform(6, 26, n), sf=rng.uniform(0.3, 0.9, n))
    G["scrim"] = {}
    # sagoma approssimata del trattore (per far brillare solo lui con la luce che passa)
    tm = np.zeros((H, W), np.uint8)
    pts = np.array([(40, 1000), (100, 900), (330, 830), (440, 500), (900, 500), (1000, 780),
                    (1045, 1000), (1040, 1250), (790, 1320), (480, 1320), (370, 1250), (100, 1200)], np.int32)
    cv2.fillPoly(tm, [pts], 255)
    G["tmask"] = cv2.GaussianBlur(tm, (0, 0), 25).astype(np.float32) / 255.0

# ----------------------------------------------------------------------------
# Testi: sprite in maschera (L), con ombra morbida
# ----------------------------------------------------------------------------
LOG = []     # riquadri dei testi, per il controllo margini/sovrapposizioni

class Txt:
    pass

@lru_cache(maxsize=4000)
def T(text, fk, size, track=0, maxw=None):
    """Testo -> maschera. Con maxw riduce il corpo finche' sta nella larghezza."""
    pad = 16
    while True:
        font = ImageFont.truetype(FONTS[fk], size)
        if track:
            w = sum(font.getlength(c) + track for c in text) - track
        else:
            w = font.getlength(text)
        asc, desc = font.getmetrics()
        im = Image.new("L", (int(w) + 2 * pad + size, asc + desc + 2 * pad), 0)
        d = ImageDraw.Draw(im)
        if track:
            x = pad
            for c in text:
                d.text((x, pad), c, font=font, fill=255)
                x += font.getlength(c) + track
        else:
            d.text((pad, pad), text, font=font, fill=255)
        a = np.array(im)
        ys, xs = np.nonzero(a > 6)
        ink = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        if maxw is None or ink.shape[1] <= maxw or size <= 20:
            break
        size -= 2
    t = Txt()
    t.mask = np.pad(ink, pad)
    t.shadow = cv2.GaussianBlur(t.mask, (0, 0), 7)
    t.w, t.h, t.pad, t.size = ink.shape[1], ink.shape[0], pad, size
    return t

def fit_size(texts, fk, maxw, start, track=0):
    """Corpo unico per piu' righe (la piu' larga decide)."""
    return min(T(s, fk, start, track, maxw).size for s in texts)

# ----------------------------------------------------------------------------
# Disegno sul fotogramma (float32, RGB 0-255)
# ----------------------------------------------------------------------------
def blit_mask(f, mask, x, y, color, alpha):
    h, w = mask.shape
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x1 <= x0 or y1 <= y0 or alpha <= 0:
        return
    m = mask[y0 - y:y1 - y, x0 - x:x1 - x].astype(np.float32)[:, :, None] * (alpha / 255.0)
    reg = f[y0:y1, x0:x1]
    reg += (color - reg) * m

def fill_rect(f, x0, y0, x1, y1, color, alpha):
    x0, y0, x1, y1 = max(int(x0), 0), max(int(y0), 0), min(int(x1), W), min(int(y1), H)
    if x1 <= x0 or y1 <= y0 or alpha <= 0:
        return
    reg = f[y0:y1, x0:x1]
    reg += (np.asarray(color, np.float32) - reg) * alpha

def scrim(f, x0, y0, x1, y1, alpha, feather=90):
    """Alone scuro morbido dietro un blocco di testo (per leggere meglio)."""
    if alpha <= 0:
        return
    w, h = int(x1 - x0), int(y1 - y0)
    key = (w, h, feather)
    if key not in G["scrim"]:
        a = np.minimum(np.arange(w), np.arange(w)[::-1]) / feather
        b = np.minimum(np.arange(h), np.arange(h)[::-1]) / feather
        a, b = np.clip(a, 0, 1), np.clip(b, 0, 1)
        a, b = a * a * (3 - 2 * a), b * b * (3 - 2 * b)
        G["scrim"][key] = (b[:, None] * a[None, :]).astype(np.float32)
    m = G["scrim"][key]
    xa, ya = int(x0), int(y0)
    xb, yb = min(xa + w, W), min(ya + h, H)
    xa2, ya2 = max(xa, 0), max(ya, 0)
    if xb <= xa2 or yb <= ya2:
        return
    mm = m[ya2 - ya:yb - ya, xa2 - xa:xb - xa][:, :, None] * alpha
    f[ya2:yb, xa2:xb] *= (1 - mm)

def put(f, tx, x, y, t, t0, color=WHITE, dur=0.5, align="l", op=1.0, shadow=0.55, log=True):
    """Testo che entra dal basso con maschera (rivela da una linea di taglio)."""
    if t < t0:
        return None
    p = oc((t - t0) / dur)
    a = min(1.0, (t - t0) / 0.18) * op
    x0 = int(x - tx.w / 2) if align == "c" else int(x - tx.w) if align == "r" else int(x)
    dy = int(round((1 - p) * (tx.h + tx.pad + 12)))
    m, sh = tx.mask, tx.shadow
    if dy > 0:
        m2 = np.zeros_like(m); m2[dy:] = m[:m.shape[0] - dy] if dy < m.shape[0] else 0
        s2 = np.zeros_like(sh); s2[dy:] = sh[:sh.shape[0] - dy] if dy < sh.shape[0] else 0
        m, sh = m2, s2
    px, py = x0 - tx.pad, int(y) - tx.pad
    if shadow > 0:
        blit_mask(f, sh, px, py + 3, BLACK, a * shadow)
    blit_mask(f, m, px, py, color, a)
    if log and a > 0.5:
        LOG.append(("text", x0, int(y), tx.w, tx.h))
    return (x0, int(y), tx.w, tx.h)

def label(f, text, t, t0, x, y, align="l"):
    """Etichetta rossa piccola in alto: la barra rossa si apre, poi il testo."""
    tx = T(text, "L", 27, 5)
    bw, bh = tx.w + 44, tx.h + 26
    p = oc((t - t0) / 0.5)
    if p <= 0:
        return
    x0 = int(x if align == "l" else x - bw / 2)
    fill_rect(f, x0, y, x0 + bw * p, y + bh, RED, 1.0)
    put(f, tx, x0 + 22, y + 13, t, t0 + 0.2, WHITE, dur=0.3, shadow=0, log=False)
    if p > .9:
        LOG.append(("text", x0, y, bw, bh))

def rule(f, x0, y, w, t, t0, dur=0.6, h=4, color=RED):
    """Linea rossa che scorre da sinistra."""
    p = oc((t - t0) / dur)
    if p > 0:
        fill_rect(f, x0, y, x0 + w * p, y + h, color, 1.0)

def bar_v(f, x, y, h, t, t0, w=8, dur=0.45):
    """Barretta rossa verticale che cresce."""
    p = oc((t - t0) / dur)
    if p > 0:
        fill_rect(f, x, y, x + w, y + h * p, RED, 1.0)

def data_bar(f, t, t0, lab, dat, y=1698, h=152):
    """Barra dati in basso: fondo nero 70%, barretta rossa, etichetta + dato."""
    p = oc((t - t0) / 0.6)
    if p <= 0:
        return
    yo = int((1 - p) * 50)
    x0, x1 = XL, XR
    fill_rect(f, x0, y + yo, x1, y + h + yo, BLACK, 0.70 * min(1, p * 1.5))
    fill_rect(f, x0, y + yo, x0 + 10, y + yo + h * p, RED, 1.0)
    # linea rossa sottile che scorre lungo il bordo alto
    fill_rect(f, x0 + 10, y + yo, x1, y + yo + 3, RED, 0.30 * p)
    pos = ((t - t0) * 520) % (940 + 320) - 320
    xa, xb = int(max(x0 + 10, x0 + pos)), int(min(x1, x0 + pos + 320))
    if xb > xa:
        al = np.linspace(0, 1, 320)[xa - (x0 + int(pos)): xb - (x0 + int(pos))]
        reg = f[y + yo:y + yo + 3, xa:xb]
        reg += (RED - reg) * al[None, :, None].astype(np.float32) * 0.95
    tl = T(lab, "L", 28, 4)
    td = T(dat, "S", 68)
    put(f, tl, x0 + 42, y + yo + 24, t, t0 + 0.15, GREY, dur=0.4, shadow=0)
    put(f, td, x0 + 42, y + yo + 24 + tl.h + 20, t, t0 + 0.25, WHITE, dur=0.45, shadow=0)
    if p > .9:
        LOG.append(("bar", x0, y, x1 - x0, h))

@lru_cache(maxsize=1)
def pill_sprite():
    """Pillola rossa 'DIGITAL EDITION' (RGBA), con un bagliore leggero attorno."""
    tx = T("DIGITAL EDITION", "L", 36, 6)
    pw, ph, g = tx.w + 80, tx.h + 50, 44
    sw, sh = pw + 2 * g, ph + 2 * g
    body = Image.new("L", (sw, sh), 0)
    ImageDraw.Draw(body).rounded_rectangle([g, g, g + pw, g + ph], radius=ph // 2, fill=255)
    glow = body.filter(ImageFilter.GaussianBlur(16))
    bodyn = np.array(body, np.float32) / 255
    glown = np.array(glow, np.float32) / 255 * 0.55
    alpha = np.maximum(bodyn, glown)
    rgb = np.ones((sh, sw, 3), np.float32) * RED
    tm = np.zeros((sh, sw), np.float32)
    ty, tx_ = g + (ph - tx.h) // 2, g + (pw - tx.w) // 2
    tm[ty:ty + tx.h, tx_:tx_ + tx.w] = tx.mask[tx.pad:tx.pad + tx.h, tx.pad:tx.pad + tx.w] / 255.0
    rgb = rgb * (1 - tm[:, :, None]) + WHITE * tm[:, :, None]
    return rgb, alpha, pw, ph, g

def pill(f, t, t0, x, y, align="l"):
    """Pillola che entra a molla (overshoot smorzato). (x,y) = angolo/centro alto."""
    if t < t0:
        return
    rgb, alpha, pw, ph, g = pill_sprite()
    s = 0.55 + 0.45 * spring(t - t0)
    a = clamp((t - t0) / 0.12)
    cx = (x + pw / 2) if align == "l" else x
    cy = y + ph / 2
    sw, sh = int(rgb.shape[1] * s), int(rgb.shape[0] * s)
    if sw < 4 or sh < 4:
        return
    r2 = cv2.resize(rgb, (sw, sh), interpolation=cv2.INTER_LINEAR)
    a2 = cv2.resize(alpha, (sw, sh), interpolation=cv2.INTER_LINEAR)
    x0, y0 = int(cx - sw / 2), int(cy - sh / 2)
    xa, ya, xb, yb = max(x0, 0), max(y0, 0), min(x0 + sw, W), min(y0 + sh, H)
    reg = f[ya:yb, xa:xb]
    m = a2[ya - y0:yb - y0, xa - x0:xb - x0][:, :, None] * a
    reg += (r2[ya - y0:yb - y0, xa - x0:xb - x0] - reg) * m
    LOG.append(("text", int(cx - pw / 2), int(cy - ph / 2), pw, ph))

def gauge(f, t, t0, cx, cy, r, p):
    """Indicatore ad arco con lancetta (p = 0..1)."""
    if t < t0:
        return
    a = oc((t - t0) / 0.5)
    size = 2 * (r + 40)
    ox, oy = int(cx - size / 2), int(cy - size / 2)
    c = size // 2
    tr = np.zeros((size, size), np.uint8)
    va = np.zeros((size, size), np.uint8)
    tk = np.zeros((size, size), np.uint8)
    nd = np.zeros((size, size), np.uint8)
    S0, SW = 135, 270
    cv2.ellipse(tr, (c, c), (r, r), 0, S0, S0 + SW, 255, 12, cv2.LINE_AA)
    if p > 0.003:
        cv2.ellipse(va, (c, c), (r, r), 0, S0, S0 + SW * p, 255, 12, cv2.LINE_AA)
    for i in range(13):
        ang = math.radians(S0 + SW * i / 12)
        r0, r1 = r + 14, r + (28 if i % 3 == 0 else 22)
        cv2.line(tk, (int(c + r0 * math.cos(ang)), int(c + r0 * math.sin(ang))),
                 (int(c + r1 * math.cos(ang)), int(c + r1 * math.sin(ang))), 255, 3, cv2.LINE_AA)
    ang = math.radians(S0 + SW * p)
    cv2.line(nd, (c, c), (int(c + (r - 22) * math.cos(ang)), int(c + (r - 22) * math.sin(ang))), 255, 6, cv2.LINE_AA)
    hub = np.zeros_like(nd); cv2.circle(hub, (c, c), 15, 255, -1, cv2.LINE_AA)
    blit_mask(f, tr, ox, oy, GREY, 0.28 * a)
    blit_mask(f, va, ox, oy, RED, 1.0 * a)
    blit_mask(f, tk, ox, oy, GREY, 0.75 * a)
    blit_mask(f, nd, ox, oy, WHITE, 1.0 * a)
    blit_mask(f, hub, ox, oy, RED, 1.0 * a)
    LOG.append(("gauge", int(cx - r - 28), int(cy - r - 28), 2 * r + 56, 2 * r + 56 - 40))

# ----------------------------------------------------------------------------
# Sfondo: Ken Burns, tremolio di luce, particelle
# ----------------------------------------------------------------------------
def kb_frame(kb0, kb1, p):
    """Fotogramma dell'immagine con zoom/pan dolci (p = 0..1, ease-in-out)."""
    e = io(p)
    cx = kb0[0] + (kb1[0] - kb0[0]) * e
    cy = kb0[1] + (kb1[1] - kb0[1]) * e
    z = math.exp(math.log(kb0[2]) + (math.log(kb1[2]) - math.log(kb0[2])) * e)
    z = min(max(z, 1.0), MAXZOOM)
    w, h = W / z, H / z
    cx = clamp(cx, w / 2, W - w / 2)
    cy = clamp(cy, h / 2, H - h / 2)
    M = np.array([[z, 0, -(cx - w / 2) * z], [0, z, -(cy - h / 2) * z]], np.float32)
    G["lastM"] = M
    out = cv2.warpAffine(G["base"], M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    return out.astype(np.float32)

def flicker(t, i):
    rng = np.random.RandomState(i * 7 + 1)
    return 1 + 0.020 * math.sin(t * 7.3) + 0.012 * math.sin(t * 17.1 + 1) + 0.008 * rng.uniform(-1, 1)

def sparks(f, t):
    """Scintille/particelle rosse che salgono piano."""
    P = G["par"]
    layer = np.zeros((H // 2, W // 2), np.uint8)
    for k in range(len(P["x0"])):
        y = (P["y0"][k] - P["v"][k] * t) % (H + 40) - 20
        x = P["x0"][k] + P["sw"][k] * math.sin(t * P["sf"][k] + P["ph"][k])
        tw = 0.45 + 0.55 * math.sin(t * P["fr"][k] + P["ph"][k]) ** 2
        cv2.circle(layer, (int(x / 2), int(y / 2)), int(P["r"][k]), int(255 * tw), -1, cv2.LINE_AA)
    glow = cv2.GaussianBlur(layer, (0, 0), 4).astype(np.float32)
    sp = np.clip(layer.astype(np.float32) + 2.4 * glow, 0, 255)
    sp = cv2.resize(sp, (W, H), interpolation=cv2.INTER_LINEAR)[:, :, None] / 255.0
    f += sp * np.array([255, 75, 70], np.float32) * 0.80

def light_sweep(f, t, ta, tb):
    """Luce chiara diagonale che passa sulla carrozzeria."""
    if not (ta - 0.3 < t < tb + 0.3):
        return
    p = clamp((t - ta) / (tb - ta))
    c = -200 + (2016 + 400) * io(p)
    g = np.exp(-((G["u_wipe"] - c) / 95.0) ** 2)
    tm = cv2.warpAffine(G["tmask"], G["lastM"], (W, H), flags=cv2.INTER_LINEAR)
    lum = f.mean(axis=2) / 255.0
    w = g * (0.05 + tm * (0.55 + 1.6 * lum ** 1.1))
    f += (w * 200.0)[:, :, None] * np.array([1.0, 0.97, 0.95], np.float32)

# ----------------------------------------------------------------------------
# Scene (tempo VIDEO). Ogni scena disegna sfondo + grafiche.
# kb = (centro x, centro y, zoom) di partenza e di arrivo nell'immagine 1080x1920.
# ----------------------------------------------------------------------------
def background(t, i, t0, t1, kb0, kb1):
    f = kb_frame(kb0, kb1, (t - t0) / (t1 - t0))
    f *= G["mask"]
    f *= flicker(t, i)
    sparks(f, t)
    return f

# --- 1 Apertura -------------------------------------------------------------
def scene1(t, i):
    f = background(t, i, 0.0, 3.1, (540, 900, 1.18), (540, 900, 1.02))
    label(f, "SERIE SPECIALE", t, 0.45, 540, 100, "c")
    sz = fit_size(["VISIONARIO.", "ESCLUSIVO."], "B", 940, 260)
    a, b = T("VISIONARIO.", "B", sz), T("ESCLUSIVO.", "B", sz)
    y1 = 190; y2 = y1 + a.h + 36
    scrim(f, 20, 150, 1060, y2 + b.h + 60, 0.35 * oc((t - 0.7) / 0.6), 120)
    put(f, a, 540, y1, t, 0.78, WHITE, align="c", dur=0.55)
    put(f, b, 540, y2, t, 1.98, WHITE, align="c", dur=0.55)
    rule(f, 540 - b.w // 2, y2 + b.h + 28, b.w, t, 2.35, 0.7, 5)
    return f

# --- 2 Nome -----------------------------------------------------------------
def scene2(t, i):
    f = background(t, i, 3.1, 8.6, (540, 900, 1.0), (540, 900, 1.07))
    label(f, "NUOVO", t, 3.30, XL, 90)
    sz = fit_size(["McCORMICK", "X7.624"], "B", 900, 230)
    a, b = T("McCORMICK", "B", sz), T("X7.624", "B", sz)
    y1 = 175; y2 = y1 + a.h + 30
    scrim(f, 20, 130, 1060, y2 + b.h + 50, 0.40 * oc((t - 3.4) / 0.6), 110)
    put(f, a, XL, y1, t, 3.62, WHITE, dur=0.6)
    put(f, b, XL, y2, t, 4.44, RED, dur=0.6)
    # VT-DRIVE in basso, con barretta rossa
    v = T("VT-DRIVE", "B", 150)
    vy = 1450
    scrim(f, 20, vy - 40, 1060, vy + v.h + 190, 0.40 * oc((t - 6.0) / 0.6), 100)
    bar_v(f, XL, vy, v.h, t, 6.1)
    put(f, v, XL + 28, vy, t, 6.1, WHITE, dur=0.55)
    pill(f, t, 7.32, XL, vy + v.h + 50)
    return f

# --- 3 Motore ---------------------------------------------------------------
def scene3(t, i):
    f = background(t, i, 8.6, 13.1, (480, 640, 1.45), (470, 610, 1.60))
    label(f, "MOTORE", t, 8.70, XL, 90)
    sz = fit_size(["6 CILINDRI", "6,7 L"], "B", 560, 160)
    a, b = T("6 CILINDRI", "B", sz), T("6,7 L", "B", sz)
    y1 = 170; y2 = y1 + a.h + 36
    scrim(f, 20, 130, 1060, 700, 0.38 * oc((t - 8.7) / 0.6), 120)
    put(f, a, XL, y1, t, 8.76, WHITE, dur=0.55)
    put(f, b, XL, y2, t, 10.06, RED, dur=0.55)
    # arco con lancetta + 240 CV che conta da 0 (arriva a 240 quando la voce lo dice, 11.58)
    cnt = 240 * oc((t - 10.45) / 1.13)
    gauge(f, t, 10.4, 800, 335, 135, cnt / 240.0)
    if t >= 10.4:
        n = T(f"{int(round(cnt))}", "B", 170)
        nf = T("240", "B", 170)
        cvt = T("CV", "B", 74)
        total = nf.w + 20 + cvt.w
        xs = int(800 - total / 2)
        ytop = 530
        put(f, n, xs + nf.w, ytop, t, 10.4, WHITE, dur=0.01, align="r", log=False)
        put(f, cvt, xs + nf.w + 20, ytop + nf.h - cvt.h, t, 10.4, RED, dur=0.4, log=False)
        LOG.append(("text", xs, ytop, total, nf.h))
    data_bar(f, t, 9.0, "MOTORE", "6 cilindri · 6,7 l · 240 CV")
    return f

# --- 4 Assale ---------------------------------------------------------------
def scene4(t, i):
    f = background(t, i, 13.1, 15.6, (600, 1010, 1.40), (640, 1010, 1.65))
    sz = fit_size(["ASSALE SOSPESO"], "B", 940, 220)
    a = T("ASSALE SOSPESO", "B", sz)
    sub = T("a ruote indipendenti", "S", 74)
    y1 = 120; y2 = y1 + a.h + 28
    scrim(f, 20, 80, 1060, y2 + sub.h + 70, 0.40 * oc((t - 13.2) / 0.6), 110)
    put(f, a, XL, y1, t, 13.24, WHITE, dur=0.55)
    put(f, sub, XL, y2, t, 13.85, RED, dur=0.5)
    data_bar(f, t, 14.1, "GOMME TRELLEBORG", "VF 600/60R30 – 710/60R42")
    return f

# --- 5 Cabina ---------------------------------------------------------------
def scene5(t, i):
    f = background(t, i, 15.6, 20.1, (660, 700, 1.50), (670, 666, 1.65))
    a = T("CABINA", "B", 200)
    sub = T("sospensione idraulica semi-attiva", "S", 62, maxw=940)
    y1 = 120; y2 = y1 + a.h + 26
    scrim(f, 20, 80, 1060, y2 + sub.h + 70, 0.40 * oc((t - 15.7) / 0.6), 110)
    put(f, a, XL, y1, t, 15.66, WHITE, dur=0.55)
    put(f, sub, XL, y2, t, 15.86, WHITE, dur=0.5)
    l1, l2 = T("SEDILI GIREVOLI", "B", 96), T("IN ALCANTARA", "B", 96)
    by = y2 + sub.h + 70
    scrim(f, 20, by - 40, 1060, by + l1.h + l2.h + 80, 0.40 * oc((t - 18.3) / 0.6), 100)
    bar_v(f, XL, by, l1.h + 22 + l2.h, t, 18.26)
    put(f, l1, XL + 28, by, t, 18.26, WHITE, dur=0.5)
    put(f, l2, XL + 28, by + l1.h + 22, t, 18.42, RED, dur=0.5)
    return f

# --- 6 Tecnologia -----------------------------------------------------------
def scene6(t, i):
    f = background(t, i, 20.1, 24.8, (540, 900, 1.0), (540, 900, 1.06))
    label(f, "A BORDO", t, 20.15, XL, 90)
    a = T("TECNOLOGIA", "B", 230, maxw=940)
    scrim(f, 20, 130, 1060, 175 + a.h + 60, 0.38 * oc((t - 20.2) / 0.6), 100)
    put(f, a, XL, 175, t, 20.2, WHITE, dur=0.55)
    # lista che si costruisce una voce alla volta, ognuna con barretta rossa
    scrim(f, 20, 1400, 1060, 1870, 0.45 * oc((t - 20.2) / 0.8), 90)
    rows = [
        (20.2, "GUIDA SATELLITARE RTK", None, 1458),
        (22.42, "ISOBUS", None, 1540),
        (23.28, "INGRASSAGGIO AUTOMATICO", "Automatic Grease System", 1622),
        (23.90, "McCORMICK FLEET E FARM · 1 anno", None, 1742),
    ]
    for t0, main, sub, y in rows:
        tm = T(main, "B", 58, maxw=900)
        hh = tm.h + (14 + T(sub, "S", 36).h if sub else 0)
        bar_v(f, XL, y - 4, hh + 8, t, t0)
        put(f, tm, XL + 28, y, t, t0, WHITE, dur=0.5)
        if sub:
            put(f, T(sub, "S", 36), XL + 28, y + tm.h + 14, t, t0 + 0.12, GREY, dur=0.5)
    return f

# --- 7 Zavorra --------------------------------------------------------------
def scene7(t, i):
    f = background(t, i, 24.8, 27.5, (330, 1000, 1.40), (318, 992, 1.65))
    sz = 270
    nf = T("1.400", "B", sz)
    kg = T("KG", "B", 120)
    scrim(f, 20, 100, 1060, 700, 0.40 * oc((t - 24.9) / 0.6), 120)
    cnt = int(round(1400 * oc((t - 24.95) / 1.05)))
    txt = f"{cnt:,}".replace(",", ".")
    n = T(txt, "B", sz)
    ytop = 150
    if t >= 24.9:
        put(f, n, XL + nf.w, ytop, t, 24.9, WHITE, dur=0.01, align="r", log=False)
        put(f, kg, XL + nf.w + 26, ytop + nf.h - kg.h, t, 24.9, RED, dur=0.45, log=False)
        LOG.append(("text", XL, ytop, nf.w + 26 + kg.w, nf.h))
    s1, s2 = T("Zavorra anteriore", "S", 64), T("con cassetta porta attrezzi", "S", 64)
    sy = ytop + nf.h + 50
    bar_v(f, XL, sy, s1.h + 18 + s2.h, t, 25.1)
    put(f, s1, XL + 28, sy, t, 25.1, WHITE, dur=0.5)
    put(f, s2, XL + 28, sy + s1.h + 18, t, 25.25, WHITE, dur=0.5)
    return f

# --- 8 Livrea ---------------------------------------------------------------
def scene8(t, i):
    f = background(t, i, 27.5, 32.1, (500, 900, 1.04), (580, 900, 1.12))
    light_sweep(f, t, 27.75, 30.6)
    sz = fit_size(["LIVREA", "ESCLUSIVA"], "B", 940, 250)
    a, b = T("LIVREA", "B", sz), T("ESCLUSIVA", "B", sz)
    y1 = 125; y2 = y1 + a.h + 30
    scrim(f, 20, 85, 1060, y2 + b.h + 60, 0.40 * oc((t - 27.6) / 0.6), 110)
    put(f, a, XL, y1, t, 27.56, WHITE, dur=0.55)
    put(f, b, XL, y2, t, 27.90, RED, dur=0.55)
    lines = ["Una serie speciale pensata", "per chi va oltre l’ordinario", "e la convenzione."]
    tl = [T(s, "S", 66) for s in lines]
    py = 1500
    scrim(f, 20, py - 60, 1060, py + 3 * 80 + 40, 0.45 * oc((t - 28.9) / 0.6), 100)
    bar_v(f, XL, py, 3 * 80 - 20, t, 28.98, dur=0.8)
    for k, (tt, t0) in enumerate(zip(tl, [28.98, 29.90, 30.80])):
        put(f, tt, XL + 28, py + k * 80, t, t0, WHITE, dur=0.55)
    return f

# --- 9 Chiusura -------------------------------------------------------------
def scene9(t, i):
    f = background(t, i, 32.1, 37.5, (540, 900, 1.0), (540, 900, 1.10))
    small = T("Visionario. Esclusivo.", "L", 36, 4)
    sz = fit_size(["McCORMICK", "X7"], "B", 900, 250)
    a, b = T("McCORMICK", "B", sz), T("X7", "B", sz)
    y1 = 175; y2 = y1 + a.h + 30
    scrim(f, 20, 70, 1060, y2 + b.h + 50, 0.40 * oc((t - 32.1) / 0.6), 110)
    put(f, small, 540, 100, t, 32.12, GREY, align="c", dur=0.5)
    put(f, a, 540, y1, t, 32.16, WHITE, align="c", dur=0.6)
    put(f, b, 540, y2, t, 32.28, RED, align="c", dur=0.6)
    pw = pill_sprite()[2]
    scrim(f, 20, 1480, 1060, 1850, 0.40 * oc((t - 33.9) / 0.6), 100)
    pill(f, t, 34.0, 540, 1520, "c")
    g = T("X7.624 VT-DRIVE · 240 CV", "L", 32, 5)
    put(f, g, 540, 1720, t, 34.4, GREY, align="c", dur=0.5, shadow=0.4)
    return f

SCENES = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8, scene9]
SC_START = [0.0] + BOUNDS

def scene_index(t):
    k = 0
    for b in BOUNDS:
        if t >= b:
            k += 1
    return k

# ----------------------------------------------------------------------------
# Un fotogramma completo: scena (o due, durante lo stacco) + fade + grana
# ----------------------------------------------------------------------------
def render_frame(i, keep_log=False):
    init_assets()
    t = i / FPS
    LOG.clear()
    k = scene_index(t)
    wipe = None
    for n, b in enumerate(BOUNDS):
        if b - WIPE_BEFORE <= t <= b + WIPE_AFTER:
            wipe = n
    if wipe is None:
        f = SCENES[k](t, i)
    else:
        old = SCENES[wipe](t, i)
        new = SCENES[wipe + 1](t, i)
        p = io((t - (BOUNDS[wipe] - WIPE_BEFORE)) / (WIPE_BEFORE + WIPE_AFTER))
        u = G["u_wipe"] if wipe % 2 == 0 else G["u_wipe_f"]
        c = -260 + (2016 + 520) * p
        du = u - c
        m = (du < 0).astype(np.float32)[:, :, None]
        f = old * (1 - m) + new * m
        glow = np.exp(-(du / 55.0) ** 2) * 1.5 + np.exp(-(du / 150.0) ** 2) * 0.35
        core = np.exp(-(du / 3.2) ** 2)
        f += glow[:, :, None] * RED * 0.9 + core[:, :, None] * np.array([255, 205, 205], np.float32)
    # dissolvenze: da nero all'inizio, a nero negli ultimi 0,6 s
    g = oc(t / 1.3) if t < 1.3 else 1.0
    if t > DUR - 0.6:
        g *= clamp((DUR - t) / 0.6)
    f *= g
    # grana leggera
    rng = np.random.RandomState(i)
    oy, ox = rng.randint(0, 64), rng.randint(0, 64)
    f += G["grain"][oy:oy + H, ox:ox + W][:, :, None]
    out = np.clip(f, 0, 255).astype(np.uint8)
    return out

def render_bytes(i):
    return render_frame(i).tobytes()

# ----------------------------------------------------------------------------
# Controllo margini e sovrapposizioni dei testi (a testi completi)
# ----------------------------------------------------------------------------
def check_layout(i):
    render_frame(i)
    probs = []
    items = list(LOG)
    for kind, x, y, w, h in items:
        if x < XL - 1 or x + w > XR + 1 or y < MARG - 1 or y + h > H - MARG + 1:
            probs.append(f"fuori margine: {kind} x={x} y={y} w={w} h={h}")
    texts = [r for r in items if r[0] in ("text", "gauge")]
    for a in range(len(texts)):
        for b in range(a + 1, len(texts)):
            _, x1, y1, w1, h1 = texts[a]; _, x2, y2, w2, h2 = texts[b]
            if x1 < x2 + w2 and x2 < x1 + w1 and y1 < y2 + h2 and y2 < y1 + h1:
                probs.append(f"sovrapposti: {texts[a]} e {texts[b]}")
    return probs

CHECK_TIMES = [2.7, 7.95, 12.7, 15.25, 19.7, 24.45, 27.1, 31.7, 35.0]

def do_check():
    os.makedirs(CHECK_DIR, exist_ok=True)
    init_assets()
    tiles = []
    for n, tt in enumerate(CHECK_TIMES):
        i = int(round(tt * FPS))
        pr = check_layout(i)
        img = render_frame(i)
        p = f"{CHECK_DIR}/prova_{n + 1}.png"
        Image.fromarray(img).save(p)
        print(f"scena {n + 1} t={tt}: {'OK' if not pr else pr}")
        tiles.append(Image.fromarray(img))
    make_sheet(tiles)

def make_sheet(tiles):
    tw, th = 540, 960
    sheet = Image.new("RGB", (tw * 3, th * 3))
    for n, im in enumerate(tiles):
        sheet.paste(im.resize((tw, th), Image.LANCZOS), ((n % 3) * tw, (n // 3) * th))
    sheet = sheet.resize((tw * 3 * 2 // 3, th * 3 * 2 // 3), Image.LANCZOS)
    sheet.save(f"{CHECK_DIR}/sheet.jpg", quality=88)

# ----------------------------------------------------------------------------
# Video: fotogrammi -> pipe -> ffmpeg (H.264 CRF 16)
# ----------------------------------------------------------------------------
def do_video():
    import multiprocessing as mp
    init_assets()
    cmd = ["/usr/bin/ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-vf", "scale=in_range=full:out_range=tv:out_color_matrix=bt709",
           "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
           "-movflags", "+faststart", VIDEO_TMP]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    with mp.Pool(4) as pool:
        for n, b in enumerate(pool.imap(render_bytes, range(NFRAMES), chunksize=2)):
            ff.stdin.write(b)
            if n % 100 == 0:
                print(f"  fotogramma {n}/{NFRAMES}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("video senza audio pronto:", VIDEO_TMP)

# ----------------------------------------------------------------------------
# Audio: musica sintetizzata (numpy) + voce + ducking
# ----------------------------------------------------------------------------
SR = 44100
NS = int(SR * DUR)
BEAT = 0.6                      # 100 bpm

def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.ones_like(fr)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(fr, 1e-3)) ** 4)
    if hi:
        m *= 1 / (1 + (fr / hi) ** 4)
    return np.fft.irfft(X * m, len(x))

def add(buf, sig, start, gain=1.0, pan=0.0):
    """Somma un suono mono nel buffer stereo a 'start' secondi (pan -1..1)."""
    s0 = int(start * SR)
    if s0 >= NS or s0 + len(sig) <= 0:
        return
    a, b = max(0, -s0), min(len(sig), NS - s0)
    gl, gr = math.sqrt((1 - pan) / 2) * gain, math.sqrt((1 + pan) / 2) * gain
    buf[0, s0 + a:s0 + b] += sig[a:b] * gl
    buf[1, s0 + a:s0 + b] += sig[a:b] * gr

def reverb(sig, rt=2.8, wet=0.7, seed=5):
    """Riverbero sintetico: coda di rumore che decade, convoluzione via FFT."""
    rng = np.random.RandomState(seed)
    n = int(rt * SR)
    t = np.arange(n) / SR
    out = []
    for ch in range(2):
        ir = rng.normal(0, 1, n) * np.exp(-t * 6.9 / rt)
        ir = fft_filter(ir, 80, 4500)
        ir[0:int(0.015 * SR)] *= np.linspace(0, 1, int(0.015 * SR))
        L = 1 << int(np.ceil(np.log2(len(sig) + n)))
        y = np.fft.irfft(np.fft.rfft(sig, L) * np.fft.rfft(ir, L), L)[:len(sig) + n]
        out.append(y / (np.abs(ir).sum() ** 0.5 * 3))
    return np.stack(out) * wet

def saw_add(t, f, nh=10, fmax=2500):
    y = np.zeros_like(t)
    for k in range(1, nh + 1):
        if k * f > fmax:
            break
        y += np.sin(2 * np.pi * f * k * t + k * 1.7) / k
    return y

def kick(n=0.42):
    t = np.arange(int(n * SR)) / SR
    ph = 2 * np.pi * (46 * t + 95 * 0.035 * (1 - np.exp(-t / 0.035)))
    y = np.sin(ph) * np.exp(-t / 0.15) * (1 - np.exp(-t / 0.002))
    click = np.random.RandomState(1).normal(0, 1, len(t)) * np.exp(-t / 0.004) * 0.25
    return np.tanh((y + click) * 1.5)

def hat(n=0.09, open_=False, seed=2):
    t = np.arange(int(n * SR)) / SR
    x = np.random.RandomState(seed).normal(0, 1, len(t))
    x = fft_filter(x, 6500, None)
    return x * np.exp(-t / (0.05 if open_ else 0.018))

def clap(seed=3):
    t = np.arange(int(0.28 * SR)) / SR
    x = fft_filter(np.random.RandomState(seed).normal(0, 1, len(t)), 900, 5500)
    e = np.exp(-t / 0.09)
    for d in (0.0, 0.012, 0.025):
        e += np.where(t > d, np.exp(-(t - d) / 0.01), 0) * 0.8
    return x * e * np.exp(-t / 0.12)

def boom(seed=9):
    n = int(4.5 * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * (28 * t + 42 * 0.5 * (1 - np.exp(-t / 0.5)))
    sub = np.sin(ph) * np.exp(-t / 1.25)
    noi = fft_filter(np.random.RandomState(seed).normal(0, 1, n), 40, 500) * np.exp(-t / 0.35)
    imp = np.sin(2 * np.pi * 70 * t) * np.exp(-t / 0.12)
    dry = np.tanh((sub * 1.3 + noi * 0.9 + imp * 0.6) * 1.2)
    return dry

def swoosh(dur=0.95, seed=4):
    """Rumore filtrato che sale (da grave ad acuto) e poi si spegne di colpo."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.random.RandomState(seed).normal(0, 1, n)
    bands = [(150, 700), (600, 2200), (1800, 5200), (4000, 11000)]
    y = np.zeros(n)
    for j, (lo, hi) in enumerate(bands):
        c = 0.12 + 0.62 * j / (len(bands) - 1)
        y += fft_filter(x, lo, hi) * np.exp(-((t / dur - c) / 0.20) ** 2) * (1.0 + 0.3 * j)
    env = np.sin(np.clip(t / (dur * 0.78), 0, 1) * np.pi / 2) ** 2
    env *= np.where(t > dur * 0.78, np.exp(-(t - dur * 0.78) / 0.05), 1)
    return y * env

def load_voice():
    raw = subprocess.run(["/usr/bin/ffmpeg", "-loglevel", "error", "-i", VOICE, "-ac", "1",
                          "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
    v = np.frombuffer(raw, np.float32).astype(np.float64)
    v = fft_filter(v, 70, None)
    act = v[np.abs(v) > 0.02 * np.abs(v).max()]
    v *= 10 ** (-19 / 20) / np.sqrt(np.mean(act ** 2))        # voce a circa -19 dBFS
    return v

def build_audio():
    print("audio: sintesi musica...", flush=True)
    t = np.arange(NS) / SR
    music = np.zeros((2, NS))      # letto musicale (con ducking)
    fx = np.zeros((2, NS))         # boom e swoosh (fuori dal ducking)

    # accordi (Am - F - Dm - E), uno per battuta (4 battiti = 2,4 s)
    chords = [([110, 130.81, 164.81, 220.0], 55.0), ([87.31, 110, 130.81, 174.61], 43.65),
              ([146.83, 174.61, 220, 293.66], 73.42), ([164.81, 207.65, 246.94, 329.63], 82.41)]
    bar = 4 * BEAT
    pad = np.zeros((2, NS))
    for b in range(int(DUR / bar) + 2):
        notes, _ = chords[b % 4]
        st = b * bar
        n = int((bar + 0.9) * SR)
        tt = np.arange(n) / SR
        env = np.minimum(tt / 0.6, 1) * np.where(tt > bar, np.exp(-(tt - bar) / 0.3), 1)
        for ni, f in enumerate(notes):
            for cents, pan in ((-8, -0.5), (0, 0.0), (8, 0.5)):
                ff = f * 2 ** (cents / 1200)
                sig = saw_add(tt, ff, 9, 1800) * env * 0.05
                add(pad, sig, st, 1.0, pan * (0.4 + 0.1 * ni))
        # sub pad
        add(pad, np.sin(2 * np.pi * chords[b % 4][1] * tt) * env * 0.16, st)
    # respiro lento del pad
    music += pad * (0.8 + 0.2 * np.sin(2 * np.pi * t / (bar * 2)))[None, :]

    # basso pulsante a ottavi + cassa + hi-hat + battito
    kk = kick()
    hh = hat()
    ho = hat(0.18, True, 7)
    cl = clap()
    drums = np.zeros((2, NS))
    bass = np.zeros((2, NS))
    nb = int(DUR / BEAT) + 1

    def playing(tb):
        return 3.0 <= tb < 31.5 or 32.1 <= tb < 35.4
    for b in range(nb):
        tb = b * BEAT
        if not playing(tb):
            continue
        late = tb >= 8.4
        add(drums, kk, tb, 0.95)
        add(drums, hh, tb + BEAT / 2, 0.22)                        # contrattempo
        if late:
            add(drums, hh, tb + BEAT / 4, 0.10)
            add(drums, hh, tb + 3 * BEAT / 4, 0.12, 0.2)
            if b % 2 == 1:
                add(drums, cl, tb, 0.30)
            if b % 8 == 7:
                add(drums, ho, tb + BEAT / 2, 0.18)
    # basso a ottavi
    for b in range(nb * 2):
        tb = b * BEAT / 2
        if not playing(tb):
            continue
        root = chords[int(tb // bar) % 4][1]
        n = int(0.30 * SR)
        tt = np.arange(n) / SR
        sig = (saw_add(tt, root * 2, 8, 700) * 0.5 + np.sin(2 * np.pi * root * tt)) * np.exp(-tt / 0.2)
        sig *= np.minimum(tt / 0.004, 1)
        add(bass, sig, tb, 0.30 * (1.0 if b % 2 == 0 else 0.75))
    # intro: battito sordo prima dell'ingresso della cassa
    for tb in np.arange(1.2, 3.0, BEAT * 2):
        add(drums, kk, tb, 0.45)
    # pompaggio (sidechain) di pad e basso sulla cassa
    pump = np.ones(NS)
    for b in range(nb):
        tb = b * BEAT
        if playing(tb):
            s0 = int(tb * SR); n = int(0.30 * SR)
            seg = 1 - 0.50 * np.exp(-np.arange(min(n, NS - s0)) / SR / 0.11)
            pump[s0:s0 + len(seg)] = np.minimum(pump[s0:s0 + len(seg)], seg)
    music = music * pump[None, :] + bass * pump[None, :] + drums
    # riser prima della chiusura (31.5 -> 32.1, il vuoto prima del colpo)
    rs = swoosh(1.3, 12)
    add(fx, rs, 32.1 - 1.3 + 0.1, 0.22, 0)
    # dissolvenza musicale finale
    music *= np.clip((DUR - t) / 1.6, 0, 1)[None, :]

    # colpi "boom" con riverbero: apertura e chiusura
    bm = boom()
    wet = reverb(bm, 2.8, 0.55)
    for st in (0.0, 32.1):
        add(fx, bm, st, 0.95)
        n = wet.shape[1]
        for ch in range(2):
            s0 = int(st * SR)
            e = min(NS - s0, n)
            fx[ch, s0:s0 + e] += wet[ch, :e] * 0.9
    # swoosh a ogni stacco
    for k, b in enumerate(BOUNDS):
        sw = swoosh(0.95, 20 + k)
        add(fx, sw, b + WIPE_AFTER - 0.95 + 0.04, 0.34, -0.6 if k % 2 == 0 else 0.6)

    # voce con 0,6 s di ritardo + ducking del letto musicale (circa -9 dB)
    print("audio: voce e ducking...", flush=True)
    v = load_voice()
    voice = np.zeros(NS)
    s0 = int(0.6 * SR)
    voice[s0:s0 + len(v)] = v[:NS - s0]
    win = int(0.05 * SR)
    rms = np.sqrt(np.convolve(voice ** 2, np.ones(win) / win, "same"))
    ctrl = 200
    step = SR // ctrl
    act = (rms[::step] > 0.02 * rms.max()).astype(float)
    sm = np.zeros_like(act)
    cur = 0.0
    for j, a_ in enumerate(act):
        k_ = 1 - math.exp(-1 / (ctrl * (0.08 if a_ > cur else 0.45)))
        cur += (a_ - cur) * k_
        sm[j] = cur
    sm_full = np.interp(np.arange(NS), np.arange(len(sm)) * step, sm)
    duck = 1 - sm_full * (1 - 10 ** (-9 / 20))
    # livello del letto musicale prima del ducking: circa -21 dBFS RMS
    rm = np.sqrt(np.mean(music ** 2))
    music *= 10 ** (-21 / 20) / rm
    fxg = 10 ** (-21 / 20) / rm
    mix = music * duck[None, :] + fx * fxg * (0.7 + 0.3 * duck[None, :]) + voice[None, :]
    mix = np.tanh(mix * 0.9) / 0.9 * 0.9          # morbido limitatore, niente clipping
    print(f"audio: picco {np.abs(mix).max():.2f}")
    mix.T.astype("<f4").tofile(MIX_RAW)
    print("audio pronto:", MIX_RAW)

# ----------------------------------------------------------------------------
# Unione audio+video con loudnorm a due passaggi (-15 LUFS)
# ----------------------------------------------------------------------------
def do_mux():
    src = ["-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", MIX_RAW]
    ln = "loudnorm=I=-15:TP=-2:LRA=11"
    r = subprocess.run(["/usr/bin/ffmpeg", "-hide_banner", "-nostats"] + src +
                       ["-af", ln + ":print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    js = json.loads(re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", r.stderr, re.S).group(0))
    print("misura primo passaggio:", {k: js[k] for k in ("input_i", "input_tp", "input_lra")})
    ln2 = (f"{ln}:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}"
           f":measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    subprocess.run(["/usr/bin/ffmpeg", "-y", "-loglevel", "error", "-i", VIDEO_TMP] + src +
                   ["-map", "0:v", "-map", "1:a", "-af", ln2 + ",aresample=48000", "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-t", str(DUR),
                    "-movflags", "+faststart", FINAL], check=True)
    print("file finale:", FINAL)

def extract_checks():
    """Estrae 9 fotogrammi dal file finale e il foglio 3x3."""
    os.makedirs(CHECK_DIR, exist_ok=True)
    tiles = []
    for n, tt in enumerate(CHECK_TIMES):
        p = f"{CHECK_DIR}/scena_{n + 1}.png"
        subprocess.run(["/usr/bin/ffmpeg", "-y", "-loglevel", "error", "-ss", str(tt), "-i", FINAL,
                        "-frames:v", "1", p], check=True)
        tiles.append(Image.open(p).convert("RGB"))
    make_sheet(tiles)

# ----------------------------------------------------------------------------
if __name__ == "__main__":
    a = set(sys.argv[1:])
    if "--check" in a:
        do_check()
    elif "--audio" in a:
        build_audio()
    elif "--video" in a:
        do_video()
    elif "--mux" in a:
        do_mux()
        extract_checks()
    else:
        do_video(); build_audio(); do_mux(); extract_checks()
