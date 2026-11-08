# Crea le icone PNG (16/32/48/128). Uso: python3 strumenti/crea_icone.py
from PIL import Image, ImageDraw
import os

G = 512  # disegno grande, poi ridotto
img = Image.new("RGBA", (G, G), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# sfondo con sfumatura verde
for y in range(G):
    t = y / G
    col = (int(16 + 20 * t), int(185 - 40 * t), int(129 - 20 * t), 255)
    d.line([(0, y), (G, y)], fill=col)
mask = Image.new("L", (G, G), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, G - 1, G - 1], radius=110, fill=255)
img.putalpha(mask)
d = ImageDraw.Draw(img)
# simbolo %
bianco = (255, 255, 255, 255)
d.ellipse([110, 100, 230, 220], outline=bianco, width=38)
d.ellipse([282, 292, 402, 412], outline=bianco, width=38)
d.line([(370, 110), (142, 402)], fill=bianco, width=46)
# punta del segno
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icons")
os.makedirs(out, exist_ok=True)
for s in (16, 32, 48, 128):
    img.resize((s, s), Image.LANCZOS).save(os.path.join(out, f"icon{s}.png"))
print("icone create")
