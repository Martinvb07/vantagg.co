"""
Portadas de las secciones (960 × 1044): el cofre negro de VANTA con bordes lima y la V, abierto y lleno de lo que se
vende, sobre el fondo de la marca (V gigante, avión, paracaidista, nubes y remolino lima) y una placa con el nombre.
  - «diamantes»: diamantes azules tallados  → public/brand/diamantes-vantagg(-720|-256).webp
  - «fragmentos»: fragmentos (tokens) Evo turquesa y, adelante, la caja Evo gris
                                            → public/brand/fragmentos-evo(-720|-256).webp

    python3 scripts/portada-seccion.py diamantes > /tmp/portada.svg
    node scripts/portada-seccion.cjs /tmp/portada.svg /tmp/portada.png   (luego se pasa a .webp con Pillow)
"""
import math
import sys

VARIANT = sys.argv[1] if len(sys.argv) > 1 else "fragmentos"

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


ICE = ["#e3f9ff", "#98e1ff", "#52bbff", "#2d84f0", "#1a52c4", "#06183f"]


def gem(cx, cy, w, tilt=0.0, glow=True):
    """Diamante tallado azul (centro x, centro y, ancho, giro), como en las portadas de los paquetes."""
    c = ICE
    h = w * 0.86
    y0 = cy - h / 2
    y1 = y0 + h * 0.3
    tip = y0 + h
    t1, t2 = cx - w * 0.27, cx + w * 0.27
    gl, g1, g2, gr = cx - w / 2, cx - w / 6, cx + w / 6, cx + w / 2
    f = lambda pts, fill, op=1: f'<path d="{poly(pts)}" fill="{fill}"' + (f' opacity="{op}"' if op != 1 else "") + "/>"
    g = []
    if glow:
        g.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{w * 0.62:.1f}" ry="{h * 0.6:.1f}" fill="#4fc3ff" opacity="0.4" filter="url(#blur18)"/>')
    g += [
        f([(t1, y0), (gl, y1), (g1, y1)], c[2]),
        f([(t1, y0), (cx, y0), (g1, y1)], c[0]),
        f([(cx, y0), (g1, y1), (g2, y1)], c[1]),
        f([(cx, y0), (t2, y0), (g2, y1)], c[2]),
        f([(t2, y0), (gr, y1), (g2, y1)], c[3]),
        f([(gl, y1), (g1, y1), (cx, tip)], c[2]),
        f([(g1, y1), (g2, y1), (cx, tip)], c[3]),
        f([(g2, y1), (gr, y1), (cx, tip)], c[4]),
        f([(t1 + w * 0.06, y0 + h * 0.05), (cx - w * 0.06, y0 + h * 0.05), (g1 - w * 0.03, y1 - h * 0.05)], "#fff", 0.7),
        f([(gl + w * 0.12, y1 + h * 0.05), (g1 - w * 0.02, y1 + h * 0.05), (cx - w * 0.05, tip - h * 0.22)], "#fff", 0.25),
        f'<path d="M{gl:.1f} {y1:.1f} H{gr:.1f}" stroke="{c[5]}" stroke-opacity="0.45" stroke-width="{max(1, w * 0.012):.1f}"/>',
        f'<path d="M{t1:.1f} {y0:.1f} H{t2:.1f} L{gr:.1f} {y1:.1f} L{cx:.1f} {tip:.1f} L{gl:.1f} {y1:.1f}Z" fill="none" stroke="{c[5]}" stroke-width="{max(2.5, min(7, w * 0.045)):.1f}" stroke-linejoin="round"/>',
    ]
    add(f'<g transform="rotate({tilt:.1f} {cx:.1f} {cy:.1f})">' + "".join(g) + "</g>")


def item(cx, cy, r, rot=0.0):
    """Lo que llena el cofre: token Evo (radio r) o diamante (ancho ≈ 2r)."""
    if VARIANT == "diamantes":
        gem(cx, cy, r * 2.1, rot)
    else:
        token(cx, cy, r, rot)


def evo_box(cx, cy, s):
    """Caja de fragmentos Evo (gris, tapa acolchada, luces turquesa y emblema del átomo), como la portada del paquete.
    Se dibuja en coordenadas de 200 × 200 centradas en (100, 100) y se escala `s` veces en (cx, cy)."""
    ink = "#04110f"
    g = [f'<ellipse cx="100" cy="139" rx="66" ry="9" fill="{TEAL[2]}" opacity="0.6" filter="url(#soft)"/>',
         f'<circle cx="100" cy="100" r="62" fill="{TEAL[3]}" opacity="0.16" filter="url(#soft)"/>',
         f'<rect x="50" y="90" width="100" height="46" rx="5" fill="url(#cbody)" stroke="{ink}" stroke-width="2.8"/>',
         '<rect x="62" y="96" width="76" height="33" rx="3" fill="#1e282a" stroke="#0b1213" stroke-width="1.4"/>']
    for x in (54, 142):
        g += [f'<rect x="{x}" y="94" width="4" height="38" rx="2" fill="{TEAL[2]}" filter="url(#soft)"/>', f'<rect x="{x}" y="94" width="4" height="38" rx="2" fill="{TEAL[1]}"/>']
    g += [f'<rect x="62" y="131" width="76" height="2.6" rx="1.3" fill="{TEAL[2]}" filter="url(#soft)"/>', f'<rect x="62" y="131" width="76" height="2.2" rx="1.1" fill="{TEAL[1]}"/>']
    for i in range(6):
        x0 = 50 + i * 16.67 + 1
        x1 = x0 + 14.7
        b0 = 100 + (x0 - 100) * 0.84
        b1 = 100 + (x1 - 100) * 0.84
        g.append(f'<path d="M{x0:.1f} 75 L{b0:.1f} 61 C{b0:.1f} 55 {b1:.1f} 55 {b1:.1f} 61 L{x1:.1f} 75Z" fill="url(#crib)" stroke="#18232a" stroke-width="1.5" stroke-linejoin="round"/>')
    g += [f'<rect x="46" y="74" width="108" height="19" rx="4" fill="url(#clid2)" stroke="{ink}" stroke-width="2.8"/>',
          '<path d="M52 78 H148" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1.6" stroke-linecap="round"/>',
          f'<rect x="52" y="88.6" width="96" height="2.2" rx="1.1" fill="{TEAL[1]}" opacity="0.95"/>',
          f'<rect x="94" y="87" width="12" height="9" rx="2" fill="#111a1b" stroke="{TEAL[2]}" stroke-width="1.2"/>',
          f'<circle cx="100" cy="113" r="13" fill="{TEAL[2]}" opacity="0.5" filter="url(#soft)"/>',
          f'<circle cx="100" cy="113" r="11.5" fill="#0c1517" stroke="{TEAL[1]}" stroke-width="2"/>']
    g += [f'<ellipse cx="100" cy="113" rx="7.2" ry="2.7" fill="none" stroke="{TEAL[0]}" stroke-width="1.5" transform="rotate({a} 100 113)"/>' for a in (90, 30, -30)]
    g.append(f'<circle cx="100" cy="113" r="1.6" fill="{TEAL[0]}"/>')
    add(f'<g transform="translate({cx - 100 * s:.1f} {cy - 100 * s:.1f}) scale({s})">' + "".join(g) + "</g>")


def star(x, y, s, op=0.9):
    add(f'<path d="M{x} {y - s} L{x + s * 0.22} {y - s * 0.22} L{x + s} {y} L{x + s * 0.22} {y + s * 0.22} L{x} {y + s} L{x - s * 0.22} {y + s * 0.22} L{x - s} {y} L{x - s * 0.22} {y - s * 0.22}Z" fill="#fff" opacity="{op}"/>')


add(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
add(f"""<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stop-color="#0f2a12"/><stop offset="0.55" stop-color="#071408"/><stop offset="1" stop-color="#020603"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.55" r="0.5"><stop offset="0" stop-color="{LIME}" stop-opacity="0.38"/><stop offset="0.6" stop-color="{LIME}" stop-opacity="0.08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="tglow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="{TEAL[2]}" stop-opacity="0.55"/><stop offset="1" stop-color="{TEAL[2]}" stop-opacity="0"/></radialGradient>
<radialGradient id="dglow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#4fc3ff" stop-opacity="0.6"/><stop offset="1" stop-color="#4fc3ff" stop-opacity="0"/></radialGradient>
<linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8ff48"/><stop offset="1" stop-color="#3c8f12"/></linearGradient>
<linearGradient id="front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#363b3a"/><stop offset="1" stop-color="#0d1010"/></linearGradient>
<linearGradient id="side" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d2221"/><stop offset="1" stop-color="#080a0a"/></linearGradient>
<linearGradient id="lid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a403f"/><stop offset="1" stop-color="#111414"/></linearGradient>
<linearGradient id="swirl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="{LIME}" stop-opacity="0"/><stop offset="0.25" stop-color="{LIME2}"/><stop offset="0.75" stop-color="{LIME}"/><stop offset="1" stop-color="{LIME}" stop-opacity="0"/></linearGradient>
<radialGradient id="tface" cx="0.42" cy="0.36" r="0.75"><stop offset="0" stop-color="#2cc3d2"/><stop offset="0.55" stop-color="#0f7686"/><stop offset="1" stop-color="#063943"/></radialGradient>
<filter id="blur18" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
<filter id="blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="blur30" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="30"/></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.6"/></filter>
<linearGradient id="cbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#415254"/><stop offset="1" stop-color="#192224"/></linearGradient>
<linearGradient id="clid2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#566a6c"/><stop offset="1" stop-color="#2a3537"/></linearGradient>
<linearGradient id="crib" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ecf8f8"/><stop offset="1" stop-color="#86a4a6"/></linearGradient>
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

# Uno grande flotando a la izquierda
item(150, 470, 80, -12)

# Cofre: tapa abierta
add(f'<path d="M296 572 L320 318 L812 342 L794 596Z" fill="{LIME}" opacity="0.35" filter="url(#blur18)"/>')
add('<path d="M296 572 L320 318 L812 342 L794 596Z" fill="url(#lid)" stroke="#020403" stroke-width="7" stroke-linejoin="round"/>')
add(f'<path d="M330 548 L348 352 L784 374 L768 572Z" fill="#141817" stroke="{LIME}" stroke-width="7" stroke-linejoin="round"/>')
add(f'<path d="M346 360 L784 382" stroke="{LIME}" stroke-width="5" opacity="0.5"/>')
# V pequeña en la tapa
add(f'<path d="M520 344 L560 344 L568 372 L590 344 L630 344 L580 402 L556 402Z" fill="{LIME}" stroke="#020403" stroke-width="5" stroke-linejoin="round"/>')
# Boca del cofre (adentro)
add('<path d="M214 612 L290 566 L796 592 L724 632Z" fill="#06120b" stroke="#020403" stroke-width="6" stroke-linejoin="round"/>')
add(f'<ellipse cx="510" cy="560" rx="270" ry="120" fill="url(#{"dglow" if VARIANT == "diamantes" else "tglow"})"/>')

# Dentro del cofre (de atrás hacia adelante)
for cx, cy, r, rot in [(430, 500, 52, 10), (590, 488, 56, -8), (700, 548, 50, 18), (330, 560, 58, -14), (510, 530, 88, 4), (640, 590, 70, 14), (390, 612, 64, -6), (250, 616, 40, -24)]:
    item(cx, cy, r, rot)

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

# Flotando a la derecha y destellos; en «fragmentos», la caja Evo adelante a la derecha.
if VARIANT == "diamantes":
    item(852, 640, 44, 16)
    item(818, 778, 30, -10)
else:
    item(880, 600, 40, 16)
    evo_box(778, 846, 2.35)
item(118, 690, 28, 20)
item(196, 566, 18, -8)
for x, y, s in [(300, 470, 22), (128, 560, 14), (880, 520, 16), (612, 420, 12), (760, 300, 10), (420, 900, 12)]:
    star(x, y, s)

# Placa con el nombre de la sección, arriba a la izquierda
if VARIANT == "diamantes":
    add('<g transform="translate(58 70)">'
        '<rect x="0" y="0" width="404" height="104" rx="22" fill="#0b1606" opacity="0.6" transform="translate(6 8)"/>'
        f'<rect x="0" y="0" width="404" height="104" rx="22" fill="{LIME}" stroke="#0b1606" stroke-width="6"/>'
        '<text x="202" y="72" text-anchor="middle" font-family="Sora, sans-serif" font-weight="800" font-size="52" fill="#0b1006" transform="skewX(-10) translate(12 0)" letter-spacing="0.5">DIAMANTES</text>'
        '</g>')
else:
    # «FRAGMENTOS» y «EVO» debajo, en la misma placa lima.
    add('<g transform="translate(58 62)">'
        '<rect x="0" y="0" width="440" height="160" rx="24" fill="#0b1606" opacity="0.6" transform="translate(6 8)"/>'
        f'<rect x="0" y="0" width="440" height="160" rx="24" fill="{LIME}" stroke="#0b1606" stroke-width="6"/>'
        '<text x="220" y="74" text-anchor="middle" font-family="Sora, sans-serif" font-weight="800" font-size="54" fill="#0b1006" transform="skewX(-10) translate(14 0)" letter-spacing="0.5">FRAGMENTOS</text>'
        '<text x="220" y="134" text-anchor="middle" font-family="Sora, sans-serif" font-weight="800" font-size="50" fill="#0b1006" transform="skewX(-10) translate(24 0)" letter-spacing="4">EVO</text>'
        '</g>')
add("</svg>")
print("\n".join(out))
