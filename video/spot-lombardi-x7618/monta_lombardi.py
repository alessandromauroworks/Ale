#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Spot verticale 30 s per Lombardi Group S.R.L. - McCormick X7.618 P6-Drive.

Come funziona (in breve):
  1. audio()  -> sintetizza la musica (numpy), l'ambiente, mette la voce nei punti giusti,
                 abbassa la musica quando parla, fa il mix e porta tutto a -15 LUFS.
  2. video()  -> legge le 3 clip, le porta a 1080x1920 / 30 fps, corregge il colore,
                 disegna testi e grafiche, manda i fotogrammi a ffmpeg (rawvideo).
  3. unisci() -> mette audio e video insieme (AAC 256k).
  4. controllo() -> estrae i fotogrammi di verifica e misura durata e loudness.

Uso:  python3 monta_lombardi.py            (fa tutto)
      python3 monta_lombardi.py audio      (solo audio)
      python3 monta_lombardi.py video      (solo video)
      python3 monta_lombardi.py unisci     (solo unione)
      python3 monta_lombardi.py controllo  (solo controllo)
"""
import os, sys, re, json, subprocess
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------- percorsi
S = "/tmp/claude-0/-home-user-Ale/379ec5c7-b0cd-5a3a-a399-050e5f535b30/scratchpad/spot2"
CLIP = [f"{S}/clip{i}.mp4" for i in (1, 2, 3)]
VOCE = f"{S}/voce.mp3"
LOGO_L = f"{S}/logo_lombardi.png"
LOGO_M = f"{S}/logo_mccormick.png"
LOCANDINA = "/root/.claude/uploads/379ec5c7-b0cd-5a3a-a399-050e5f535b30/603ba308-image.jpg"
FONT = f"{S}/fonts/Montserrat.ttf"
TMP = f"{S}/tmp"
VIDEO_TMP = f"{TMP}/video_senza_audio.mp4"
MIX_RAW = f"{TMP}/mix.f32"
AUDIO_NORM = f"{TMP}/audio_norm.wav"
USCITA = f"{S}/spot_lombardi_x7618_9x16.mp4"
CHECK = f"{S}/check"
os.makedirs(TMP, exist_ok=True)
os.makedirs(CHECK, exist_ok=True)

W, H, FPS = 1080, 1920, 30
DUR = 30.0
NF = int(DUR * FPS)  # 900 fotogrammi

# Aree sicure social (testo SOLO qui dentro, tranne la schermata finale)
SIC_X0, SIC_X1 = 70, W - 170       # 70 .. 910
SIC_Y0, SIC_Y1 = 260, H - 420      # 260 .. 1500


# ================================================================== COLORI
def campiona_colori():
    """Prende i colori dalla locandina del cliente. Se il file manca usa i valori gia' campionati."""
    c = dict(verde=(54, 109, 69), bianco=(243, 243, 235), antracite=(42, 55, 43),
             rosso=(214, 43, 38))
    try:
        a = np.array(Image.open(LOCANDINA).convert("RGB")).astype(int)
        c["verde"] = tuple(int(v) for v in a[1596:1604, 696:704].reshape(-1, 3).mean(0))   # fascia in basso
        c["bianco"] = tuple(int(v) for v in a[1096:1104, 996:1004].reshape(-1, 3).mean(0))  # sfondo
        r = a[1050:1120, 50:780].reshape(-1, 3)                                              # testo X7.618
        c["antracite"] = tuple(int(v) for v in r[r.sum(1).argsort()[:30]].mean(0))
        r = a[1300:1380, 930:1220].reshape(-1, 3)                                            # logo rosso
        s = r[:, 0] - r[:, 1:].max(1)
        c["rosso"] = tuple(int(v) for v in r[s.argsort()[-60:]].mean(0))
    except Exception as e:
        print("Locandina non leggibile, uso colori di riserva:", e)
    return c


COL = campiona_colori()
VERDE, BIANCO, ANTRA, ROSSO = COL["verde"], COL["bianco"], COL["antracite"], COL["rosso"]
VERDE_SCURO = tuple(int(v * 0.66) for v in VERDE)       # derivato dal verde aziendale
VERDE_CHIARO = (70, 150, 93)                            # verde "175 CV" della locandina
GRIGIO = (118, 118, 110)
print("Colori:", COL)


# ================================================================== FONT E TESTO
_font_cache = {}


def fnt(peso, size):
    """Montserrat variabile con il peso scelto (500 Medium, 600 SemiBold, 700 Bold)."""
    k = (peso, size)
    if k not in _font_cache:
        f = ImageFont.truetype(FONT, int(size))
        f.set_variation_by_axes([peso])
        _font_cache[k] = f
    return _font_cache[k]


def fnt_fit(peso, testo, larg_max, size_max):
    """Il font piu' grande possibile che sta dentro la larghezza data."""
    for s in range(int(size_max), 10, -1):
        f = fnt(peso, s)
        if f.getlength(testo) <= larg_max:
            return f
    return fnt(peso, 10)


def maschera_testo(testo, font):
    """Maschera 0..1 del testo (solo inchiostro, senza margini inutili)."""
    bb = font.getbbox(testo)
    w, h = bb[2] - bb[0] + 4, bb[3] - bb[1] + 4
    im = Image.new("L", (w, h), 0)
    ImageDraw.Draw(im).text((2 - bb[0], 2 - bb[1]), testo, font=font, fill=255)
    return np.asarray(im, np.float32) / 255.0


def maschera_rrect(w, h, r):
    """Rettangolo con angoli arrotondati, bordi morbidi (disegnato a 4x)."""
    k = 4
    im = Image.new("L", (w * k, h * k), 0)
    ImageDraw.Draw(im).rounded_rectangle([0, 0, w * k - 1, h * k - 1], radius=r * k, fill=255)
    return np.asarray(im.resize((w, h), Image.LANCZOS), np.float32) / 255.0


class Tela:
    """Livello trasparente: colore + trasparenza, con composizione 'sopra' corretta."""

    def __init__(s, w, h, ox, oy):
        s.rgb = np.zeros((h, w, 3), np.float32)
        s.a = np.zeros((h, w), np.float32)
        s.ox, s.oy = ox, oy       # posizione del livello sullo schermo

    def sopra(s, x, y, mask, colore, op=1.0):
        """Appoggia una maschera di colore pieno; x,y sono coordinate SCHERMO."""
        x -= s.ox
        y -= s.oy
        h, w = mask.shape
        ms = mask * op
        ad = s.a[y:y + h, x:x + w]
        rd = s.rgb[y:y + h, x:x + w]
        oa = ms + ad * (1 - ms)
        num = np.array(colore, np.float32) * ms[..., None] + rd * (ad * (1 - ms))[..., None]
        rd[:] = num / np.maximum(oa, 1e-6)[..., None]
        ad[:] = oa

    def rett(s, x, y, w, h, colore, op=1.0, raggio=0):
        m = maschera_rrect(w, h, raggio) if raggio else np.ones((h, w), np.float32)
        s.sopra(x, y, m, colore, op)


def sicuro(nome, x, y, w, h):
    """Controllo aree sicure social: se un testo esce, il montaggio si ferma."""
    ok = x >= SIC_X0 and x + w <= SIC_X1 and y >= SIC_Y0 and y + h <= SIC_Y1
    if not ok:
        raise SystemExit(f"TESTO FUORI AREA SICURA: {nome} x={x}..{x+w} y={y}..{y+h}")


def testo_sicuro(tela, nome, x, y, testo, font, colore, op=1.0):
    m = maschera_testo(testo, font)
    sicuro(nome, x, y, m.shape[1], m.shape[0])
    tela.sopra(x, y, m, colore, op)
    return m.shape[1], m.shape[0]


# ================================================================== LOGHI
def logo_su_bianco(path):
    """
    Porta il logo originale su un fondo bianco caldo UGUALE a quello della schermata finale,
    cosi' il bordo del ritaglio non si vede. Non ridisegna nulla: toglie solo la differenza
    di fondo (grana, ombreggiature) e tiene tutto l'inchiostro del logo.
    """
    a = np.asarray(Image.open(path).convert("RGB"), np.float32)
    # fondo locale stimato = massimo (cioe' il piu' chiaro) in un intorno grande
    fondo = cv2.dilate(a, np.ones((61, 61), np.uint8))
    fondo = cv2.GaussianBlur(fondo, (0, 0), 12)
    diff = np.abs(fondo - a).max(2)
    gate = np.clip((diff - 26.0) / 30.0, 0, 1)     # 0 = solo fondo/grana, 1 = logo
    gate = gate * gate * (3 - 2 * gate)
    nuovo = np.array(BIANCO, np.float32) + (a - fondo) * gate[..., None]
    return Image.fromarray(np.clip(nuovo, 0, 255).astype(np.uint8))


# ================================================================== ANIMAZIONI
def ease(x):
    """Entrata morbida (ease-out cubico) da 0 a 1."""
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def prog(t, t0, d):
    return ease((t - t0) / d)


def fuori(t, t1, d):
    """Uscita morbida: 1 prima di t1, 0 dopo t1+d."""
    x = min(max((t - t1) / d, 0.0), 1.0)
    return 1 - x * x * (3 - 2 * x)


def liscia(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def metti(frame, L, op=1.0, dy=0, dx=0):
    """Compone un livello (Tela) sul fotogramma uint8 con opacita' e spostamento."""
    if op <= 0.003:
        return
    h, w = L.a.shape
    x = L.ox + int(round(dx))
    y = L.oy + int(round(dy))
    x0, y0, x1, y1 = max(x, 0), max(y, 0), min(x + w, W), min(y + h, H)
    if x1 <= x0 or y1 <= y0:
        return
    a = L.a[y0 - y:y1 - y, x0 - x:x1 - x] * op
    rgb = L.rgb[y0 - y:y1 - y, x0 - x:x1 - x]
    reg = frame[y0:y1, x0:x1].astype(np.float32)
    reg += (rgb - reg) * a[..., None]
    frame[y0:y1, x0:x1] = np.clip(reg + 0.5, 0, 255).astype(np.uint8)


# ================================================================== GRAFICHE
def crea_grafiche():
    G = {}
    SL = 30  # scivolata breve (px)

    # ---- 1) Titolo (da 4.6 s): sfumatura scura + barretta verde + due righe
    gr = Tela(W, 920, 0, 1000)
    yy = np.arange(920, dtype=np.float32)[:, None] / 650.0
    ramp = np.clip(yy, 0, 1)
    ramp = ramp * ramp * (3 - 2 * ramp)
    gr.a[:] = (0.58 * ramp) * np.ones((1, W), np.float32)
    gr.rgb[:] = (10, 18, 12)
    G["sfumatura"] = gr

    f_grande = fnt_fit(700, "X7.618 P6-DRIVE", 820, 130)
    f_picc = fnt(600, int(f_grande.size * 0.50))
    m_gr = maschera_testo("X7.618 P6-DRIVE", f_grande)
    m_pi = maschera_testo("McCormick", f_picc)
    x_t = 80
    y_gr = 1465 - m_gr.shape[0]
    y_pi = y_gr - 30 - m_pi.shape[0]
    y_bar = y_pi - 34
    t = Tela(900, 1500 - (y_bar - 12), 60, y_bar - 12)
    t.rett(x_t, y_bar, 130, 12, VERDE)
    sicuro("barretta titolo", x_t, y_bar, 130, 12)
    G["t_barra"] = t
    t = Tela(900, m_pi.shape[0] + 10, 60, y_pi - 5)
    testo_sicuro(t, "titolo McCormick", x_t, y_pi, "McCormick", f_picc, (255, 255, 255))
    G["t_mc"] = t
    t = Tela(900, m_gr.shape[0] + 10, 60, y_gr - 5)
    testo_sicuro(t, "titolo X7.618", x_t, y_gr, "X7.618 P6-DRIVE", f_grande, (255, 255, 255))
    G["t_x7"] = t

    # ---- 2) Etichette clip2: pannello antracite 85% + barretta verde a sinistra
    def etichetta(nome, testo, peso, size_max, larg_max):
        f = fnt_fit(peso, testo, larg_max, size_max)
        m = maschera_testo(testo, f)
        padx, pady, barra = 36, 28, 14
        pw, ph = m.shape[1] + padx * 2 + barra, m.shape[0] + pady * 2
        x0, y0 = 80, 1450 - ph
        tt = Tela(pw + 8, ph + 8, x0 - 4, y0 - 4)
        tt.rett(x0, y0, pw, ph, ANTRA, 0.85)
        tt.rett(x0, y0, barra, ph, VERDE)
        testo_sicuro(tt, nome, x0 + barra + padx, y0 + pady, testo, f, (255, 255, 255))
        sicuro(nome + " pannello", x0, y0, pw, ph)
        return tt

    G["motore"] = etichetta("etichetta motore", "MOTORE FPT 6,7 L · 6 CILINDRI", 600, 44, 720)
    G["cv"] = etichetta("etichetta 175 CV", "175 CV", 700, 150, 560)

    # ---- 3) Etichetta rossa PRONTA CONSEGNA (piccola, solida)
    f = fnt(700, 40)
    m = maschera_testo("PRONTA CONSEGNA", f)
    pw, ph = m.shape[1] + 56, m.shape[0] + 34
    x0, y0 = SIC_X1 - pw, 300
    t = Tela(pw + 8, ph + 8, x0 - 4, y0 - 4)
    t.rett(x0, y0, pw, ph, ROSSO, 1.0, raggio=10)
    testo_sicuro(t, "PRONTA CONSEGNA", x0 + 28, y0 + 17, "PRONTA CONSEGNA", f, (255, 255, 255))
    sicuro("etichetta rossa", x0, y0, pw, ph)
    G["pronta"] = t

    # ---- 4) Fascia verde dal basso (da 22.0 s): il trattore resta visibile sopra
    top = 1235
    t = Tela(W, H - top, 0, top)
    t.rett(0, top, W, H - top, VERDE)
    t.rett(0, top, W, 6, VERDE_CHIARO)
    f = fnt_fit(700, "SCOPRI IL McCORMICK", 830, 62)
    f2 = fnt(700, f.size)
    f3 = fnt(500, 40)
    y = top + 50
    _, h1 = testo_sicuro(t, "fascia riga1", 80, y, "SCOPRI IL McCORMICK", f, (255, 255, 255))
    y += h1 + 22
    _, h2 = testo_sicuro(t, "fascia riga2", 80, y, "X7.618 P6-DRIVE", f2, (255, 255, 255))
    y += h2 + 34
    testo_sicuro(t, "fascia sotto", 80, y, "Contattaci o passa a trovarci", f3, (235, 242, 236))
    G["fascia"] = t
    return G


# ================================================================== SCHERMATA FINALE
CX = (SIC_X0 + SIC_X1) // 2   # 490: centro dell'area sicura


def crea_finale():
    """Ritorna (immagine fissa RGB uint8, dizionario di livelli animati)."""
    bg = np.empty((H, W, 3), np.float32)
    bg[:] = BIANCO

    # decorazioni diagonali (come la locandina), disegnate a 2x per bordi puliti
    k = 2
    def maschera_poly(punti, spess=0, linea=False):
        im = Image.new("L", (W * k, H * k), 0)
        d = ImageDraw.Draw(im)
        if linea:
            d.line([(x * k, y * k) for x, y in punti], fill=255, width=spess * k)
        else:
            d.polygon([(x * k, y * k) for x, y in punti], fill=255)
        return np.asarray(im.resize((W, H), Image.LANCZOS), np.float32) / 255.0

    def applica(mask, colore, op=1.0):
        m = (mask * op)[..., None]
        bg[:] = bg * (1 - m) + np.array(colore, np.float32) * m

    # angolo in alto a destra con righine
    for i in range(1, 5):
        applica(maschera_poly([(700 - i * 60, 0), (1080 - i * 60 + 0, 300)], 3, True), VERDE, 0.28)
    applica(maschera_poly([(700, 0), (W, 0), (W, 300)]), VERDE)
    # fascia in basso
    applica(maschera_poly([(0, 1700), (W, 1585), (W, 1690), (0, 1805)]), VERDE)
    applica(maschera_poly([(0, 1832), (W, 1717), (W, 1729), (0, 1844)]), VERDE_CHIARO)

    img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))

    # logo Lombardi in alto-centro, grande (1,9x, sotto il massimo 2x)
    lg = logo_su_bianco(LOGO_L)
    lw, lh = int(lg.width * 1.9), int(lg.height * 1.9)
    lg = lg.resize((lw, lh), Image.LANCZOS)
    img.paste(lg, (CX - lw // 2, 330))
    sicuro("logo Lombardi", CX - lw // 2, 330, lw, lh)

    # logo McCormick, piu' piccolo, in basso (1,3x)
    lm = logo_su_bianco(LOGO_M)
    mw, mh = int(lm.width * 1.3), int(lm.height * 1.3)
    lm = lm.resize((mw, mh), Image.LANCZOS)
    img.paste(lm, (CX - mw // 2, 1330))
    sicuro("logo McCormick", CX - mw // 2, 1330, mw, mh)

    arr = np.asarray(img, np.float32)

    def testo_su(arr, nome, cx, y, testo, font, colore, sicura=True):
        m = maschera_testo(testo, font)
        h, w = m.shape
        x = cx - w // 2
        if sicura:
            sicuro(nome, x, y, w, h)
        reg = arr[y:y + h, x:x + w]
        reg[:] = reg + (np.array(colore, np.float32) - reg) * m[..., None]
        return h

    # nome azienda, fermo
    testo_su(arr, "nome azienda", CX, 565, "LOMBARDI GROUP S.R.L.", fnt_fit(700, "LOMBARDI GROUP S.R.L.", 780, 60), ANTRA)

    # telefono GRANDE in una pillola verde, fermo
    px, py, pw, ph = SIC_X0, 930, SIC_X1 - SIC_X0, 170
    pm = maschera_rrect(pw, ph, 30)
    reg = arr[py:py + ph, px:px + pw]
    reg[:] = reg + (np.array(VERDE, np.float32) - reg) * pm[..., None]
    sicuro("pillola telefono", px, py, pw, ph)
    ft = fnt_fit(700, "0885 796 316", 700, 120)
    mt = maschera_testo("0885 796 316", ft)
    tx, ty = CX - mt.shape[1] // 2, py + (ph - mt.shape[0]) // 2
    sicuro("telefono", tx, ty, mt.shape[1], mt.shape[0])
    reg = arr[ty:ty + mt.shape[0], tx:tx + mt.shape[1]]
    reg[:] = reg + (np.array((255, 255, 255), np.float32) - reg) * mt[..., None]

    # minuscolo grigio in fondo
    testo_su(arr, "avviso IA", W // 2, 1868, "Immagini realizzate con IA a scopo dimostrativo",
             fnt(500, 27), GRIGIO, sicura=False)

    fisso = np.clip(arr + 0.5, 0, 255).astype(np.uint8)

    # livelli che entrano con scivolata morbida (payoff, invito, sito)
    L = {}
    m = maschera_testo("La forza del tuo lavoro.", fnt_fit(600, "La forza del tuo lavoro.", 800, 64))
    t = Tela(900, m.shape[0] + 10, 40, 695)
    testo_sicuro(t, "payoff", CX - m.shape[1] // 2, 700, "La forza del tuo lavoro.", fnt_fit(600, "La forza del tuo lavoro.", 800, 64), VERDE)
    L["payoff"] = t

    t = Tela(900, 70, 40, 835)
    fc = fnt(500, 46)
    m = maschera_testo("Contattaci o passa a trovarci", fc)
    testo_sicuro(t, "invito", CX - m.shape[1] // 2, 845, "Contattaci o passa a trovarci", fc, ANTRA)
    L["invito"] = t

    t = Tela(900, 70, 40, 1155)
    fw = fnt_fit(500, "www.lombardigroupsrl.com", 800, 46)
    m = maschera_testo("www.lombardigroupsrl.com", fw)
    testo_sicuro(t, "sito", CX - m.shape[1] // 2, 1165, "www.lombardigroupsrl.com", fw, ANTRA)
    L["sito"] = t
    return fisso, L


# ================================================================== LETTORE CLIP
LUT = None


def crea_lut():
    """Correzione colore uniforme per tutte le clip: leggermente calda, contrasto moderato."""
    x = np.arange(256, dtype=np.float32) / 255.0
    s = x * x * (3 - 2 * x)
    base = x + 0.22 * (s - x)                       # contrasto moderato
    lut = np.zeros((256, 1, 3), np.uint8)
    for c, g in enumerate((1.025, 1.0, 0.965)):     # R, G, B (caldo, il rosso del trattore non cambia di tono)
        lut[:, 0, c] = np.clip(base * g * 255 + 0.5, 0, 255).astype(np.uint8)
    return lut


class Lettore:
    """Legge una clip gia' portata a 1080x1920, 30 fps, lanczos + nitidezza, con colore corretto."""

    def __init__(self, path):
        vf = "scale=1080:1920:flags=lanczos,unsharp=5:5:0.6:5:5:0.0,fps=30"
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf", vf, "-f", "rawvideo",
                                   "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=10 ** 8)
        self.i = -1
        self.last = None
        self.fine = False
        self.n = W * H * 3

    def _leggi(self):
        buf = bytearray()
        while len(buf) < self.n:
            b = self.p.stdout.read(self.n - len(buf))
            if not b:
                return None
            buf += b
        fr = np.frombuffer(bytes(buf), np.uint8).reshape(H, W, 3)
        return cv2.LUT(fr, LUT)

    def get(self, k):
        k = max(k, 0)
        while self.i < k and not self.fine:
            fr = self._leggi()
            if fr is None:
                self.fine = True
                break
            self.last = fr
            self.i += 1
        return self.last

    def chiudi(self):
        try:
            self.p.stdout.close()
            self.p.terminate()
        except Exception:
            pass


def mescola(a, b, w):
    """Dissolvenza: w=0 -> a, w=1 -> b."""
    return cv2.addWeighted(a, 1 - w, b, w, 0)


# ================================================================== VIDEO
def video():
    global LUT
    LUT = crea_lut()
    G = crea_grafiche()
    fisso, LF = crea_finale()
    r1, r2, r3 = Lettore(CLIP[0]), Lettore(CLIP[1]), Lettore(CLIP[2])

    enc = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
         "-i", "-", "-vf", "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
         "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
         "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
         "-r", str(FPS), "-movflags", "+faststart", VIDEO_TMP],
        stdin=subprocess.PIPE)

    for f in range(NF):
        t = f / FPS

        # ---------- fondo: le tre clip con dissolvenze incrociate di 0,4 s
        if t < 9.0:
            img = r1.get(f)
        elif t < 16.0:
            img = r2.get(f - 270)
            if t < 9.4:
                img = mescola(r1.get(f), img, liscia((t - 9.0) / 0.4))
        else:
            img = r3.get(f - 480)
            if t < 16.4:
                img = mescola(r2.get(f - 270), img, liscia((t - 16.0) / 0.4))
        img = img.copy()

        # ---------- apertura dal nero in 0,5 s
        if t < 0.5:
            img = (img.astype(np.float32) * liscia(t / 0.5)).astype(np.uint8)

        # ---------- 1) titolo (4.6 -> 9.0)
        if 4.6 <= t < 9.0:
            u = fuori(t, 8.55, 0.4)
            metti(img, G["sfumatura"], prog(t, 4.6, 0.6) * u)
            for nome, ritardo in (("t_barra", 0.0), ("t_mc", 0.12), ("t_x7", 0.24)):
                p = prog(t, 4.6 + ritardo, 0.45)
                metti(img, G[nome], p * u, dy=(1 - p) * 30)

        # ---------- 2) etichette clip2: motore (10.2), poi 175 CV (12.9)
        if 10.2 <= t < 12.9:
            p = prog(t, 10.2, 0.4)
            metti(img, G["motore"], p * fuori(t, 12.5, 0.3), dy=(1 - p) * 30)
        if 12.9 <= t < 16.0:
            p = prog(t, 12.9, 0.4)
            metti(img, G["cv"], p * fuori(t, 15.5, 0.35), dy=(1 - p) * 30)

        # ---------- 3) clip3: etichetta rossa (18.8) e fascia verde (22.0)
        if 18.8 <= t < 26.6:
            p = prog(t, 18.8, 0.4)
            metti(img, G["pronta"], p, dy=(1 - p) * 24)
        if 22.0 <= t < 26.6:
            p = prog(t, 22.0, 0.55)
            metti(img, G["fascia"], 1.0, dy=(1 - p) * (H - 1235))

        # ---------- 4) chiusura: dissolvenza di 0,5 s verso la schermata bianca
        if t >= 26.0:
            card = fisso.copy()
            for nome, t0 in (("payoff", 26.45), ("invito", 26.8), ("sito", 27.15)):
                p = prog(t, t0, 0.45)
                metti(card, LF[nome], p, dy=(1 - p) * 26)
            w = liscia((t - 26.0) / 0.5)
            img = mescola(img, card, w) if w < 1.0 else card

        enc.stdin.write(np.ascontiguousarray(img).tobytes())
        if f % 90 == 0:
            print(f"  video {f}/{NF}", flush=True)

    enc.stdin.close()
    enc.wait()
    for r in (r1, r2, r3):
        r.chiudi()
    print("Video senza audio:", VIDEO_TMP)


# ================================================================== AUDIO
SR = 48000
NS = int(SR * DUR)
BPM = 90.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)

# Voce: (nome, inizio nella voce, fine nella voce, posizione nello spot)
SEGMENTI = [
    ("A", 0.00, 3.02, 0.50),
    ("C", 3.40, 8.40, 4.30),
    ("D", 8.90, 13.30, 9.80),
    ("E", 13.60, 17.50, 16.40),
    ("F", 17.70, 20.10, 22.30),
    ("G", 20.60, 24.40, 26.10),
]


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def fft_filtro(x, lo=None, hi=None):
    """Filtro passa-banda con la FFT (basta per rumori e riverbero)."""
    X = np.fft.rfft(x)
    fr = np.fft.rfftfreq(len(x), 1.0 / SR)
    m = np.ones_like(fr)
    if lo:
        m *= 1 / (1 + (lo / np.maximum(fr, 1e-3)) ** 4)
    if hi:
        m *= 1 / (1 + (fr / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def aggiungi(bus, x, t0, pan=0.0):
    i = int(round(t0 * SR))
    if i < 0 or i >= NS:
        return
    n = min(len(x), NS - i)
    gl = np.cos((pan + 1) * np.pi / 4)
    gr = np.sin((pan + 1) * np.pi / 4)
    bus[0, i:i + n] += x[:n] * gl
    bus[1, i:i + n] += x[:n] * gr


def inviluppo(n, att, rel):
    tt = np.arange(n) / SR
    a = np.sin(np.clip(tt / att, 0, 1) * np.pi / 2) ** 2
    r = np.sin(np.clip((n / SR - tt) / rel, 0, 1) * np.pi / 2) ** 2
    return np.minimum(a, r)


def tono_pad(f, dur):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.zeros(n)
    for det in (-0.0035, 0.0035):
        for k in range(1, 6):
            s += np.sin(2 * np.pi * f * (1 + det) * k * tt + rng.uniform(0, 6.28)) / k ** 1.4
    return s * inviluppo(n, 1.0, 1.2)


def pizzico(f, dur=1.0):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(4 * np.pi * f * tt) + 0.2 * np.sin(6 * np.pi * f * tt)
    return s * np.exp(-tt * 6.5) * (1 - np.exp(-tt * 900))


def cassa(dur=0.55):
    tt = np.arange(int(dur * SR)) / SR
    fr = 42 + 110 * np.exp(-tt * 28)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt * 7.5) * (1 - np.exp(-tt * 600))


def taiko(dur=1.4):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    fr = 62 + 70 * np.exp(-tt * 14)
    corpo = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-tt * 3.0) * (1 - np.exp(-tt * 400))
    colpo = fft_filtro(rng.normal(size=n), 200, 1800) * np.exp(-tt * 40) * 0.25
    return corpo + colpo


def shaker(dur=0.09):
    n = int(dur * SR)
    tt = np.arange(n) / SR
    return fft_filtro(rng.normal(size=n), 5000, 12000) * np.exp(-tt * 55) * (1 - np.exp(-tt * 1500))


def riverbero(x2):
    """Riverbero a convoluzione (coda di 2,6 s, un poco diversa a sinistra e a destra)."""
    n_ir = int(2.6 * SR)
    tt = np.arange(n_ir) / SR
    out = np.zeros_like(x2)
    L = NS + n_ir
    nfft = 1 << int(np.ceil(np.log2(L)))
    for c in range(2):
        ir = rng.normal(size=n_ir) * np.exp(-tt * 2.4)
        ir = fft_filtro(ir, 150, 5500)
        ir = np.concatenate([np.zeros(int(0.02 * SR)), ir])[:n_ir]
        y = np.fft.irfft(np.fft.rfft(x2[c], nfft) * np.fft.rfft(ir, nfft), nfft)[:NS]
        out[c] = y / np.sqrt(np.sum(ir ** 2))
    return out


def rms_db(x, a, b):
    seg = x[..., int(a * SR):int(b * SR)]
    return 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-12)


def silenzi_voce():
    """Cerca i silenzi della voce (-32 dB, 0,18 s)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", VOCE, "-af", "silencedetect=n=-32dB:d=0.18", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r)]
    return list(zip(st, en))


def taglio_in_silenzio(t, sil, durata):
    """
    Il taglio deve stare DENTRO un silenzio, a almeno 0,10 s dai bordi (o 0,03 s se il silenzio e' corto).
    Se non ci sta, lo porta al punto piu' vicino che ci sta. Ritorna (tempo, era_gia_ok).
    """
    if t <= 0.0:
        return t, True
    for a, b in sil:
        m = 0.10 if (b - a) >= 0.5 else 0.06
        if a + m <= t <= b - m:
            return t, True
    best = None
    for a, b in sil:
        m = 0.10 if (b - a) >= 0.5 else 0.06
        lo, hi = a + m, b - m
        c = min(max(t, lo), hi)
        if best is None or abs(c - t) < abs(best - t):
            best = c
    return best, False


def costruisci_voce():
    """Mette i segmenti della voce nello spot, con tagli dentro i silenzi e dissolvenze di 20 ms."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", VOCE, "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"],
                         capture_output=True).stdout
    v = np.frombuffer(raw, np.float32).astype(np.float64)
    durata = len(v) / SR
    sil = silenzi_voce()
    print("Silenzi voce:", [(round(a, 2), round(b, 2)) for a, b in sil])
    # il silenzio finale arriva fino a fine file
    traccia = np.zeros(NS)
    usati = []
    for nome, a, b, dove in SEGMENTI:
        a2, okA = taglio_in_silenzio(a, sil, durata)
        b2, okB = taglio_in_silenzio(b, sil, durata)
        if not okA or not okB:
            print(f"  ATTENZIONE segmento {nome}: taglio {a}->{a2:.2f} / {b}->{b2:.2f} spostato dentro il silenzio")
        seg = v[int(a2 * SR):int(b2 * SR)].copy()
        fd = int(0.020 * SR)
        seg[:fd] *= np.linspace(0, 1, fd)
        seg[-fd:] *= np.linspace(1, 0, fd)
        i = int(dove * SR)
        n = min(len(seg), NS - i)
        traccia[i:i + n] += seg[:n]
        usati.append((nome, round(a2, 3), round(b2, 3), dove, round(dove + (b2 - a2), 3)))
    print("Segmenti usati (nome, voce da, voce a, spot da, spot a):")
    for u in usati:
        print("  ", u)
    return traccia, usati


def audio():
    tt = np.arange(NS) / SR
    inten = np.interp(tt, [0, 4, 9, 16, 22, 26, 26.67, 30], [0.30, 0.50, 0.65, 0.85, 1.0, 1.0, 0.9, 0.7])

    # ---------- progressione in Re maggiore, 11 battute: D A Bm G | D A Bm G | G A | D (risolve a 26,67 s)
    acc = {
        "D": (38, [62, 66, 69]), "A": (33, [61, 64, 69]), "Bm": (35, [62, 66, 71]), "G": (43, [62, 67, 71]),
    }
    prog_acc = ["D", "A", "Bm", "G", "D", "A", "Bm", "G", "G", "A"]
    n_bar = len(prog_acc)          # 10 battute (0 .. 26,67 s), poi la battuta finale in Re
    t_fin = n_bar * BAR            # 26,67 s

    pad = np.zeros((2, NS))
    bass = np.zeros((2, NS))
    arp = np.zeros((2, NS))
    perc_sec = np.zeros((2, NS))   # percussioni asciutte (cassa, shaker)
    perc_rev = np.zeros((2, NS))   # percussioni con riverbero (taiko, piatto)

    for b, nome in enumerate(prog_acc):
        t0 = b * BAR
        radice, triade = acc[nome]
        for j, m in enumerate(triade):
            aggiungi(pad, tono_pad(midi(m), BAR + 1.4), t0 - 0.2 if b else t0, pan=(-0.45, 0.0, 0.45)[j])
        # basso: lungo all'inizio, poi ritmico
        fb = midi(radice)
        def nota_basso(t, durata, g=1.0):
            n = int(durata * SR)
            x = (np.sin(2 * np.pi * fb * np.arange(n) / SR) + 0.35 * np.sin(4 * np.pi * fb * np.arange(n) / SR))
            aggiungi(bass, x * inviluppo(n, 0.03, 0.15) * g, t)
        if b == 0:
            continue
        if t0 < 5.4:
            nota_basso(t0, BAR * 0.95, 0.8)
        else:
            for beat, d, g in ((0, 1.4, 1.0), (1.5, 0.45, 0.6), (2, 1.2, 0.85), (3.5, 0.45, 0.55)):
                nota_basso(t0 + beat * BEAT, d * BEAT, g)
        # arpeggio a pizzico: croma, dalla battuta 2
        if b >= 2:
            seq = [0, 1, 2, 1, 2, 1, 0, 1]
            for k in range(8):
                nota = triade[seq[k]] + 12
                aggiungi(arp, pizzico(midi(nota)), t0 + k * BEAT / 2, pan=(-0.5 if k % 2 == 0 else 0.5))
        # percussioni
        if b >= 1:
            aggiungi(perc_rev, taiko() * 0.8, t0, pan=0.0)
        if b >= 2:
            aggiungi(perc_sec, cassa(), t0)
            aggiungi(perc_sec, cassa() * 0.8, t0 + 2 * BEAT)
        if b >= 3:
            aggiungi(perc_sec, cassa() * 0.5, t0 + BEAT)
            aggiungi(perc_sec, cassa() * 0.5, t0 + 3 * BEAT)
        if b >= 4:
            for k in range(8):
                aggiungi(perc_sec, shaker() * (0.5 if k % 2 else 0.8), t0 + k * BEAT / 2 + BEAT / 2 * (k % 2 == 1) * 0,
                         pan=0.3 if k % 2 else -0.3)
        if b >= 6:
            aggiungi(perc_rev, taiko() * 0.55, t0 + 2 * BEAT)
            aggiungi(perc_rev, taiko() * 0.4, t0 + 3.5 * BEAT)
        if b == 9:   # ultima battuta prima della chiusura: i colpi crescono
            for k in range(1, 4):
                aggiungi(perc_rev, taiko() * (0.4 + 0.15 * k), t0 + k * BEAT)

    # ---------- chiusura risolta: accordo di Re pieno, colpo grosso, arpeggio finale
    for j, m in enumerate([50, 57, 62, 66, 69, 74]):
        n = int((DUR - t_fin + 0.2) * SR)
        x = tono_pad(midi(m), DUR - t_fin + 0.2)
        aggiungi(pad, x, t_fin, pan=(-0.5, -0.3, -0.1, 0.1, 0.3, 0.5)[j])
    nb = int((DUR - t_fin) * SR)
    xb = np.sin(2 * np.pi * midi(38) * np.arange(nb) / SR) + 0.3 * np.sin(4 * np.pi * midi(38) * np.arange(nb) / SR)
    aggiungi(bass, xb * inviluppo(nb, 0.05, 1.0), t_fin)
    aggiungi(perc_sec, cassa() * 1.1, t_fin)
    aggiungi(perc_rev, taiko() * 1.3, t_fin)
    for j, m in enumerate([62, 66, 69, 74, 78]):
        aggiungi(arp, pizzico(midi(m), 2.5) * 0.9, t_fin + 0.05 + j * 0.09, pan=-0.4 + 0.2 * j)
    # piatto morbido finale + salita di rumore prima
    nc = int(3.0 * SR)
    piatto = fft_filtro(rng.normal(size=nc), 3500, 11000) * np.exp(-np.arange(nc) / SR * 1.6)
    aggiungi(perc_rev, piatto * 0.18, t_fin, pan=0.2)
    nr = int((t_fin - 22.0) * SR)
    rr = fft_filtro(rng.normal(size=nr), 1500, 7000) * (np.arange(nr) / nr) ** 2.2
    aggiungi(perc_rev, rr * 0.10, 22.0, pan=-0.1)

    # ---------- livelli: il pad cresce con l'intensita'
    pad *= inten * 0.55
    arp *= 0.42 * np.clip((inten - 0.3) * 1.4, 0, 1.1)
    bass *= 0.75 * inten
    perc_sec *= inten
    perc_rev *= inten
    secco = bass + perc_sec
    effetti = pad + arp + perc_rev
    musica = secco + 0.8 * effetti + 0.40 * riverbero(effetti)
    # fine pulita: ultimi 0,4 s a zero
    fine = np.ones(NS)
    fine[-int(0.4 * SR):] = np.linspace(1, 0, int(0.4 * SR)) ** 2
    musica *= fine
    musica *= 10 ** ((-21.0 - rms_db(musica, 16, 24)) / 20)   # tra 16 e 24 s: -21 dBFS RMS

    # ---------- ambiente: vento morbido all'inizio, sfuma sotto la musica
    vento = fft_filtro(rng.normal(size=NS), 180, 1100)
    lfo = 0.65 + 0.35 * np.sin(2 * np.pi * 0.17 * tt + 1.0) * np.sin(2 * np.pi * 0.071 * tt)
    amb_inv = np.interp(tt, [0, 3.0, 8.5, 9.5], [1.0, 1.0, 0.0, 0.0]) * np.clip(tt / 0.3, 0, 1)
    vento = vento * lfo * amb_inv
    vento *= 10 ** ((-31.0 - rms_db(vento, 0.3, 3.0)) / 20)
    vento2 = fft_filtro(rng.normal(size=NS), 300, 1500) * lfo * amb_inv   # un poco diverso a destra
    vento2 *= 10 ** ((-31.0 - rms_db(vento2, 0.3, 3.0)) / 20)
    amb = np.stack([vento, vento2])
    # rombo bassissimo, appena percepibile, solo durante la clip2 (9-16 s)
    rombo = fft_filtro(np.cumsum(rng.normal(size=NS)), 25, 75)
    rombo *= np.interp(tt, [8.8, 10, 15, 16.6], [0, 1, 1, 0])
    rombo *= 10 ** ((-46.0 - rms_db(rombo, 10, 15)) / 20)
    amb += rombo[None, :]

    # ---------- voce
    voce, usati = costruisci_voce()
    # normalizza la voce sulla parte parlata
    parlato = voce[np.abs(voce) > 0.01]
    liv = 20 * np.log10(np.sqrt(np.mean(parlato ** 2)))
    voce *= 10 ** ((-19.0 - liv) / 20)
    voce2 = np.stack([voce, voce])

    # ---------- musica abbassata di circa 10 dB mentre parla (attacco 80 ms, rilascio 450 ms)
    ctrl_sr = 1000
    nc_ = int(DUR * ctrl_sr)
    env = np.convolve(np.abs(voce), np.ones(int(0.04 * SR)) / int(0.04 * SR), "same")
    env_c = env[:nc_ * (SR // ctrl_sr)].reshape(nc_, SR // ctrl_sr).max(1)
    parla = (env_c > 0.004).astype(float)
    # tiene l'abbassamento anche nelle micro-pause dentro la frase (0,35 s)
    k = int(0.35 * ctrl_sr)
    parla = np.convolve(parla, np.ones(k), "same") > 0
    parla = np.roll(parla, -60)               # la musica scende 60 ms prima della voce
    target = np.where(parla, 10 ** (-10 / 20), 1.0)
    g = np.empty(nc_)
    cur = 1.0
    ca, cr = np.exp(-1 / (0.08 * ctrl_sr)), np.exp(-1 / (0.45 * ctrl_sr))
    for i in range(nc_):
        c = ca if target[i] < cur else cr
        cur = target[i] + (cur - target[i]) * c
        g[i] = cur
    duck = np.interp(tt, np.arange(nc_) / ctrl_sr, g)

    mix = musica * duck[None, :] + amb + voce2
    mix = np.tanh(mix / 0.95) * 0.95          # limitatore morbido di sicurezza
    mix.T.astype(np.float32).tofile(MIX_RAW)
    print("Mix scritto:", MIX_RAW, "picco", float(np.abs(mix).max()))

    # ---------- loudnorm a due passaggi: -15 LUFS, picco vero <= -1,5 dBTP
    catena_pre = "acompressor=threshold=-20dB:ratio=3:attack=15:release=250:makeup=1"
    base = ["ffmpeg", "-hide_banner", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", MIX_RAW, "-af"]
    r = subprocess.run(base + [catena_pre + ",loudnorm=I=-15:TP=-1.8:LRA=9:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    m = json.loads(r[r.rfind("{"):r.rfind("}") + 1])
    print("Misura 1:", m["input_i"], m["input_tp"], m["input_lra"])
    ln = (f"loudnorm=I=-15:TP=-1.8:LRA=9:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    subprocess.run(base + [f"{catena_pre},{ln},aresample={SR},alimiter=limit=0.80:level=disabled:attack=3:release=50",
                           "-ar", str(SR), "-c:a", "pcm_f32le", AUDIO_NORM], check=True, capture_output=True)
    print("Audio normalizzato:", AUDIO_NORM)


# ================================================================== UNIONE E CONTROLLO
def unisci():
    subprocess.run(["ffmpeg", "-hide_banner", "-y", "-v", "error", "-i", VIDEO_TMP, "-i", AUDIO_NORM,
                    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
                    "-t", f"{DUR:.3f}", "-movflags", "+faststart", USCITA], check=True)
    print("Creato:", USCITA)


def controllo():
    """Estrae i fotogrammi dal FILE FINALE, fa il foglio 4x2 e misura durata e loudness."""
    tempi = [3.0, 6.5, 11.5, 14.5, 20.0, 24.5, 28.0, 29.9]
    ims = []
    for t in tempi:
        p = f"{CHECK}/f_{t:.1f}.png"
        subprocess.run(["ffmpeg", "-hide_banner", "-y", "-v", "error", "-ss", f"{t}", "-i", USCITA,
                        "-frames:v", "1", p], check=True)
        ims.append(Image.open(p).convert("RGB").resize((360, 640), Image.LANCZOS))
    foglio = Image.new("RGB", (360 * 4, 640 * 2), (30, 30, 30))
    for i, im in enumerate(ims):
        foglio.paste(im, ((i % 4) * 360, (i // 4) * 640))
    foglio.save(f"{CHECK}/sheet.jpg", quality=90)
    print("Foglio:", f"{CHECK}/sheet.jpg")
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                          "stream=codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels,bit_rate,duration",
                          "-show_entries", "format=duration,size", "-of", "default=nw=1", USCITA],
                         capture_output=True, text=True).stdout
    print(out)
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", USCITA, "-af", "ebur128=peak=true", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    print(r[r.rfind("Summary"):])


if __name__ == "__main__":
    fasi = sys.argv[1:] or ["audio", "video", "unisci", "controllo"]
    if "audio" in fasi:
        audio()
    if "video" in fasi:
        video()
    if "unisci" in fasi:
        unisci()
    if "controllo" in fasi:
        controllo()
