"""
Portada de la sección «Armas Evo» (mismo formato que la de diamantes: 960 × 1044): el cofre negro de VANTA con bordes
lima y la V, abierto y lleno de fragmentos (tokens) Evo turquesa con el átomo, sobre el fondo de la marca.

Genera el SVG; scripts/portada-armas-evo.cjs lo pasa a public/brand/armas-evo-free-fire(-720|-256).webp.
    python3 scripts/portada-armas-evo.py > /tmp/armas-evo.svg
"""
import math

W, H = 960, 1044
LIME = "#b9f43c"
LIME2 = "#dcff7a"
TEAL = ["#eafeff", "#aef4fb", "#62dcea", "#27b6c8", "#137f92", "#0a4c59", "#05262e"]
out = []
add = out.append


def hexpts(cx, cy, r, rot=0.0):
    return [(cx + r * math.cos(math.radians(a + rot)), cy + r * math.sin(math.radians(a + rot))) for a in (0, 60, 120, 180, 240, 300)]


def poly(pts):
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + "Z"


def token(cx, cy, r, rot=0.0, glow=True):
    """Token Evo: hexágono turquesa con bisel, cara de galaxia y átomo blanco."""
    o = hexpts(cx, cy, r, rot)
    i = hexpts(cx, cy, r * 0.78, rot)
    shade = [TEAL[4], TEAL[5], TEAL[3], TEAL[2], TEAL[0], TEAL[1]]
    g = []
    if glow:
        g.append(f'<path d="{poly(hexpts(cx, cy, r * 1.14, rot))}" fill="{TEAL[2]}" opacity="0.55" filter="url(#blur18)"/>')
    for k in range(6):
        g.append(f'<path d="{poly([o[k], o[(k + 1) % 6], i[(k + 1) % 6], i[k]])}" fill="{shade[(k - int(round(rot / 60))) % 6]}"/>')
    g.append(f'<path d="{poly(i)}" fill="url(#tface)"/>')
    for dx, dy, kk in [(-0.38, -0.3, 0.05), (0.42, 0.18, 0.04), (-0.2, 0.42, 0.035), (0.3, -0.46, 0.03), (0.05, 0.3, 0.025)]:
        g.append(f'<circle cx="{cx + dx * r:.1f}" cy="{cy + dy * r:.1f}" r="{r * kk:.1f}" fill="#fff" opacity="0.55"/>')
    w = r * 0.085
    for color, dx, dy in [(TEAL[6], r * 0.025, r * 0.04), ("#ffffff", 0, 0)]:
        for a in (90, 30, -30):
            g.append(f'<ellipse cx="{cx + dx:.1f}" cy="{cy + dy:.1f}" rx="{r * 0.5:.1f}" ry="{r * 0.2:.1f}" fill="none" stroke="{color}" stroke-width="{w:.1f}" transform="rotate({a + rot:.1f} {cx + dx:.1f} {cy + dy:.1f})"/>')
    g.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 0.1:.1f}" fill="#fff"/>')
    g.append(f'<path d="{poly(i)}" fill="none" stroke="{TEAL[0]}" stroke-opacity="0.55" stroke-width="{max(1.2, r * 0.025):.1f}"/>')
    g.append(f'<path d="{poly(o)}" fill="none" stroke="#04110f" stroke-width="{max(2.5, r * 0.05):.1f}" stroke-linejoin="round"/>')
    # Destello en el vértice de arriba a la derecha
    sx, sy = o[5]
    g.append(f'<path d="M{sx:.1f} {sy - r * 0.16:.1f} L{sx + r * 0.04:.1f} {sy - r * 0.04:.1f} L{sx + r * 0.16:.1f} {sy:.1f} L{sx + r * 0.04:.1f} {sy + r * 0.04:.1f} L{sx:.1f} {sy + r * 0.16:.1f} L{sx - r * 0.04:.1f} {sy + r * 0.04:.1f} L{sx - r * 0.16:.1f} {sy:.1f} L{sx - r * 0.04:.1f} {sy - r * 0.04:.1f}Z" fill="#fff" opacity="0.9"/>')
    add("<g>" + "".join(g) + "</g>")


def star(x, y, s, op=0.9):
    add(f'<path d="M{x} {y - s} L{x + s * 0.22} {y - s * 0.22} L{x + s} {y} L{x + s * 0.22} {y + s * 0.22} L{x} {y + s} L{x - s * 0.22} {y + s * 0.22} L{x - s} {y} L{x - s * 0.22} {y - s * 0.22}Z" fill="#fff" opacity="{op}"/>')


add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
add(f"""<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#0f2a12"/><stop offset="0.55" stop-color="#071408"/><stop offset="1" stop-color="#020603"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.55" r="0.5"><stop offset="0" stop-color="{LIME}" stop-opacity="0.38"/><stop offset="0.6" stop-color="{LIME}" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="tglow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{TEAL[2]}" stop-opacity="0.55"/><stop offset="1" stop-color="{TEAL[2]}" stop-opacity="0"/></radialGradient>
<linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8ff48"/><stop offset="1" stop-color="#3c8f12"/></linearGradient>
<linearGradient id="front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#363b3a"/><stop offset="1" stop-color="#0d1010"/></linearGradient>
<linearGradient id="side" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d2221"/><stop offset="1" stop-color="#080a0a"/></linearGradient>
<linearGradient id="lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a403f"/><stop offset="1" stop-color="#111414"/></linearGradient>
<linearGradient id="swirl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{LIME}" stop-opacity="0"/><stop offset="0.25" stop-color="{LIME2}"/><stop offset="0.75" stop-color="{LIME}"/><stop offset="1" stop-color="{LIME}" stop-opacity="0"/></linearGradient>
<radialGradient id="tface" cx="0.42" cy="0.36" r="0.75"><stop offset="0" stop-color="#2cc3d2"/><stop offset="0.55" stop-color="#0f7686"/><stop offset="1" stop-color="#063943"/></radialGradient>
<filter id="blur18" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="blur30" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
</defs>""")

# Fondo, brillo y V gigante de la marca
add(f'<rect width="{W}" height="{H}" fill="url(#bg)"/>')
add(f'<rect width="{W}" height="{H}" fill="url(#glow)"/>')
V = "M220 150 L405 150 L515 420 L650 95 L860 40 L560 640 L450 640Z"
add(f'<path d="{V}" fill="{LIME}" opacity="0.35" filter="url(#blur30)"/>')
add(f'<path d="{V}" fill="url(#vg)" opacity="0.85"/>')
for pts, op in [("700 70 900 0 960 0 960 30 760 110", 0.7), ("780 150 960 70 960 100 820 170", 0.45), ("40 900 230 790 210 830 60 930", 0.5), ("120 1000 330 880 300 930 150 1030", 0.35)]:
    add(f'<polygon points="{pts}" fill="{LIME}" opacity="{op}"/>')

# Avión y paracaidista (siluetas)
add('<g fill="#0a2a0f" opacity="0.95">'
    '<path d="M60 268 C110 258 190 255 250 262 L272 252 L282 262 L250 274 C190 282 110 282 60 276Z"/>'
    '<path d="M150 262 L118 208 L140 208 L196 262Z"/><path d="M150 274 L120 322 L142 322 L196 276Z"/>'
    '<path d="M70 268 L52 238 L66 238 L88 266Z"/></g>')
add('<g fill="none" stroke="#0a2a0f" stroke-width="3" opacity="0.95"><path d="M800 280 L842 392"/><path d="M842 280 L846 392"/><path d="M884 280 L850 392"/><path d="M918 284 L854 392"/></g>')
add('<path d="M790 286 C800 210 930 196 940 290 C915 274 885 272 865 280 C845 272 815 272 790 286Z" fill="#0a2a0f"/>')
add('<g fill="#0a2a0f"><circle cx="846" cy="400" r="11"/><path d="M836 410 L860 410 L866 450 L874 482 L862 484 L850 452 L838 486 L826 482 L834 448Z"/></g>')

# Nubes oscuras
for cx, cy, r in [(40, 470, 90), (150, 520, 80), (60, 600, 70), (910, 500, 90), (820, 560, 70), (930, 620, 80), (480, 1010, 160), (200, 1000, 130), (780, 1010, 140)]:
    add(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#0c2a10" opacity="0.6"/>')

# Remolino lima detrás del cofre (mitad de atrás)
add(f'<ellipse cx="480" cy="790" rx="430" ry="95" fill="none" stroke="{LIME}" stroke-width="30" opacity="0.4" filter="url(#blur18)" transform="rotate(-7 480 790)"/>')
add(f'<path d="M70 800 C120 690 820 640 900 740" fill="none" stroke="url(#swirl)" stroke-width="20" stroke-linecap="round" transform="rotate(-7 480 790)"/>')

# Token grande flotando a la izquierda (como el diamante de la portada de diamantes)
token(150, 470, 80, -12)

# Cofre: tapa abierta
add(f'<path d="M296 572 L320 318 L812 342 L794 596Z" fill="{LIME}" opacity="0.35" filter="url(#blur18)"/>')
add('<path d="M296 572 L320 318 L812 342 L794 596Z" fill="url(#lid)" stroke="#020403" stroke-width="7" stroke-linejoin="round"/>')
add(f'<path d="M330 548 L348 352 L784 374 L768 572Z" fill="#141817" stroke="{LIME}" stroke-width="7" stroke-linejoin="round"/>')
add(f'<path d="M346 360 L784 382" stroke="{LIME}" stroke-width="5" opacity="0.5"/>')
# V pequeña en la tapa
add(f'<path d="M520 344 L560 344 L568 372 L590 344 L630 344 L580 402 L556 402Z" fill="{LIME}" stroke="#020403" stroke-width="5" stroke-linejoin="round"/>')
# Boca del cofre (adentro)
add('<path d="M214 612 L290 566 L796 592 L724 632Z" fill="#06120b" stroke="#020403" stroke-width="6" stroke-linejoin="round"/>')
add(f'<ellipse cx="510" cy="560" rx="270" ry="120" fill="url(#tglow)"/>')

# Tokens dentro del cofre (de atrás hacia adelante)
for cx, cy, r, rot in [(430, 500, 52, 10), (590, 488, 56, -8), (700, 548, 50, 18), (330, 560, 58, -14), (510, 530, 88, 4), (640, 590, 70, 14), (390, 612, 64, -6), (250, 616, 40, -24)]:
    token(cx, cy, r, rot)

# Cuerpo del cofre: frente y costado
add(f'<path d="M214 612 L724 632 L716 850 L234 832Z" fill="{LIME}" opacity="0.35" filter="url(#blur18)"/>')
add('<path d="M724 632 L796 592 L788 800 L716 850Z" fill="url(#side)" stroke="#020403" stroke-width="7" stroke-linejoin="round"/>')
add('<path d="M214 612 L724 632 L716 850 L234 832Z" fill="url(#front)" stroke="#020403" stroke-width="7" stroke-linejoin="round"/>')
add('<path d="M214 612 L724 632 L723 660 L215 640Z" fill="#454b4a" stroke="#020403" stroke-width="5" stroke-linejoin="round"/>')
# Bordes lima
add(f'<g fill="none" stroke="{LIME}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round">'
    '<path d="M222 650 L716 670"/>'
    '<path d="M228 690 L238 818 L330 822"/><path d="M710 700 L704 838 L612 836"/>'
    '<path d="M733 650 L780 622 L774 770"/></g>')
add(f'<path d="M222 650 L716 670" stroke="{LIME2}" stroke-width="3" opacity="0.9"/>')
# V grande al frente
add(f'<path d="M378 702 L440 704 L470 770 L506 706 L566 708 L498 816 L444 814Z" fill="{LIME}" opacity="0.5" filter="url(#blur8)"/>')
add(f'<path d="M378 702 L440 704 L470 770 L506 706 L566 708 L498 816 L444 814Z" fill="{LIME}" stroke="#020403" stroke-width="7" stroke-linejoin="round"/>')
add(f'<path d="M392 712 L434 713 L470 790" fill="none" stroke="{LIME2}" stroke-width="4" opacity="0.8"/>')

# Remolino lima delante (mitad de adelante)
add(f'<path d="M60 790 C80 900 860 900 905 760" fill="none" stroke="{LIME}" stroke-width="26" stroke-linecap="round" opacity="0.5" filter="url(#blur8)" transform="rotate(-7 480 790)"/>')
add(f'<path d="M60 790 C80 900 860 900 905 760" fill="none" stroke="url(#swirl)" stroke-width="16" stroke-linecap="round" transform="rotate(-7 480 790)"/>')
add(f'<path d="M140 860 C260 930 700 930 820 850" fill="none" stroke="{LIME}" stroke-width="6" stroke-linecap="round" opacity="0.6" transform="rotate(-7 480 790)"/>')

# Tokens flotando a la derecha y destellos
token(852, 640, 44, 16)
token(818, 778, 30, -10)
token(118, 690, 28, 20)
token(196, 566, 18, -8)
for x, y, s in [(300, 470, 22), (128, 560, 14), (880, 520, 16), (612, 420, 12), (760, 300, 10), (420, 900, 12)]:
    star(x, y, s)

# Placa «ARMAS EVO» arriba a la izquierda (en la de diamantes va el nombre del juego)
add('<g transform="translate(58 70)">'
    '<rect x="0" y="0" width="404" height="104" rx="22" fill="#0b1606" opacity="0.6" transform="translate(6 8)"/>'
    f'<rect x="0" y="0" width="404" height="104" rx="22" fill="{LIME}" stroke="#0b1606" stroke-width="6"/>'
    '<text x="202" y="72" text-anchor="middle" font-family="Sora, sans-serif" font-weight="800" font-size="52" fill="#0b1006" transform="skewX(-10) translate(12 0)" letter-spacing="0.5">ARMAS EVO</text>'
    '</g>')
add("</svg>")
print("\n".join(out))
