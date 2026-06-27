#!/usr/bin/env python3
"""Compose Pasture demo art from Kenney 2D assets and emit demo/pasture-art-bytes.ts."""

from __future__ import annotations

import base64
import math
import os
from io import BytesIO

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART_DIR = os.path.join(ROOT, "demo", "pasture-art")
OUT_TS = os.path.join(ROOT, "demo", "pasture-art-bytes.ts")

SRC_REMASTERED = os.path.join(ROOT, "assets", "kenney_background-elements-remastered")
SRC_REMASTERED_BG = os.path.join(SRC_REMASTERED, "Backgrounds")
SRC_REMASTERED_ELEM = os.path.join(SRC_REMASTERED_BG, "Elements")
SRC_REMASTERED_SPR = os.path.join(SRC_REMASTERED, "PNG", "Default")
SRC_ELEMENTS = os.path.join(ROOT, "assets", "kenney_background-elements", "PNG")
SRC_COW = os.path.join(ROOT, "assets", "kenney_cube-pets_1.0", "Previews", "animal-cow.png")

W, H = 960, 540

ASSET_FILES = [
    "pasture-morning.jpg",
    "pasture-afternoon.jpg",
    "pasture-sunset.jpg",
    "pasture-night.jpg",
    "cow-idle.png",
    "cow-graze.png",
    "cow-walk.png",
    "cow-drink.png",
    "star.png",
]


def fit_cover(img: Image.Image, width: int, height: int) -> Image.Image:
    src = img.convert("RGBA")
    scale = max(width / src.width, height / src.height)
    resized = src.resize((int(src.width * scale), int(src.height * scale)), Image.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def load_rgba(path: str) -> Image.Image:
    return Image.open(path).convert("RGBA")


def paste_sprite(
    canvas: Image.Image,
    sprite: Image.Image,
    x: float,
    y: float,
    scale: float = 1.0,
    opacity: float = 1.0,
    anchor: str = "center",
) -> None:
    s = sprite
    if scale != 1.0:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))), Image.LANCZOS)
    if opacity < 1.0:
        s = s.copy()
        alpha = s.split()[3].point(lambda a: int(a * opacity))
        s.putalpha(alpha)

    if anchor == "center":
        px = int(x - s.width / 2)
        py = int(y - s.height / 2)
    elif anchor == "bottom":
        px = int(x - s.width / 2)
        py = int(y - s.height)
    else:
        px, py = int(x), int(y)
    canvas.alpha_composite(s, (px, py))


def tile_sprite(
    canvas: Image.Image,
    sprite: Image.Image,
    y: float,
    scale: float = 1.0,
    opacity: float = 1.0,
    gap: float = 0.0,
) -> None:
    s = sprite
    if scale != 1.0:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))), Image.LANCZOS)
    step = s.width + int(gap)
    x = step / 2
    while x < W + s.width:
        paste_sprite(canvas, s, x, y, opacity=opacity, anchor="bottom")
        x += step


def overlay_color(rgba: tuple[int, int, int, int]) -> Image.Image:
    return Image.new("RGBA", (W, H), rgba)


def apply_vignette(canvas: Image.Image, strength: float) -> Image.Image:
    if strength <= 0:
        return canvas
    v = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(v)
    d.ellipse([-W * 0.1, -H * 0.05, W * 1.1, H * 1.05], fill=(0, 0, 0, int(255 * strength)))
    return Image.alpha_composite(canvas, v)


def compose_pasture(
    base_name: str,
    *,
    color_overlay: tuple[int, int, int, int] | None = None,
    brightness: float = 1.0,
    saturation: float = 1.0,
    vignette: float = 0.0,
    creek_opacity: float = 1.0,
    add_moon: bool = False,
) -> Image.Image:
    canvas = fit_cover(load_rgba(os.path.join(SRC_REMASTERED_BG, base_name)), W, H)

    # Distant fence line across the mid-field.
    fence = load_rgba(os.path.join(SRC_REMASTERED_SPR, "fence.png"))
    tile_sprite(canvas, fence, H * 0.66, scale=2.4, opacity=0.92, gap=-8)

    # Creek / pond on the right — matches the creek hotspot.
    creek = load_rgba(os.path.join(SRC_REMASTERED_ELEM, "hills.png"))
    paste_sprite(canvas, creek, W * 0.78, H * 0.78, scale=0.42, opacity=creek_opacity, anchor="bottom")

    # Foreground grass fringe — keep subtle so the remastered plate stays readable.
    grass_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for name, x, y, sc, op in [
        ("grass2.png", W * 0.08, H * 0.97, 2.2, 0.75),
        ("grass4.png", W * 0.22, H * 0.98, 2.4, 0.8),
        ("grass5.png", W * 0.38, H * 0.96, 2.1, 0.72),
        ("grass3.png", W * 0.55, H * 0.98, 2.5, 0.78),
        ("grass6.png", W * 0.72, H * 0.97, 2.2, 0.74),
        ("grass1.png", W * 0.9, H * 0.96, 2.3, 0.76),
    ]:
        paste_sprite(grass_layer, load_rgba(os.path.join(SRC_ELEMENTS, name)), x, y, sc, op, anchor="bottom")
    canvas = Image.alpha_composite(canvas, grass_layer)

    # Side bushes for depth — small accents only.
    for spr, x, y, sc, op in [
        ("bushOrange2.png", W * 0.06, H * 0.72, 1.35, 0.7),
        ("bush1.png", W * 0.94, H * 0.74, 1.25, 0.68),
    ]:
        paste_sprite(canvas, load_rgba(os.path.join(SRC_REMASTERED_SPR, spr)), x, y, sc, op, anchor="bottom")

    if brightness != 1.0 or saturation != 1.0:
        rgb = canvas.convert("RGB")
        if saturation != 1.0:
            rgb = ImageEnhance.Color(rgb).enhance(saturation)
        if brightness != 1.0:
            rgb = ImageEnhance.Brightness(rgb).enhance(brightness)
        canvas = Image.merge("RGBA", (*rgb.split(), canvas.split()[3]))

    if color_overlay:
        canvas = Image.alpha_composite(canvas, overlay_color(color_overlay))

    if add_moon:
        moon = load_rgba(os.path.join(SRC_REMASTERED_SPR, "moonFull.png"))
        paste_sprite(canvas, moon, W * 0.78, H * 0.18, scale=1.1, opacity=0.95)

    canvas = apply_vignette(canvas, vignette)
    return canvas


def save_background(filename: str, canvas: Image.Image) -> None:
    canvas.convert("RGB").save(os.path.join(ART_DIR, filename), "JPEG", quality=90, optimize=True)


def build_cow_sprite(filename: str, flip: bool = False, size: int = 256, y_offset: int = 0) -> None:
    im = load_rgba(SRC_COW)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if y_offset:
        padded = Image.new("RGBA", (im.width, im.height + abs(y_offset)), (0, 0, 0, 0))
        padded.alpha_composite(im, (0, max(0, y_offset)))
        im = padded
    im.resize((size, size), Image.LANCZOS).save(os.path.join(ART_DIR, filename), "PNG")


def build_star() -> None:
    """Evening star — soft glow derived from the remastered moon palette."""
    star = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    d = ImageDraw.Draw(star)
    cx, cy, r = 64, 64, 28
    points = []
    for i in range(10):
        ang = math.pi / 2 + i * math.pi / 5
        rad = r if i % 2 == 0 else r * 0.4
        points.append((cx + rad * math.cos(ang), cy - rad * math.sin(ang)))
    d.polygon(points, fill=(255, 245, 180, 240))
    d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(255, 255, 220, 255))
    star = star.filter(ImageFilter.GaussianBlur(radius=0.6))
    star.save(os.path.join(ART_DIR, "star.png"), "PNG")


def emit_typescript_bytes() -> None:
    lines = [
        "/** Auto-generated by scripts/build-pasture-art.py — do not edit by hand. */",
        "",
        "function decodeBase64(base64: string): Uint8Array {",
        "  if (typeof globalThis.atob === 'function') {",
        "    const binary = globalThis.atob(base64);",
        "    const bytes = new Uint8Array(binary.length);",
        "    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);",
        "    return bytes;",
        "  }",
        "  throw new Error('Base64 decoding is unavailable in this runtime.');",
        "}",
        "",
        "const PASTURE_ART_BASE64: Record<string, string> = {",
    ]

    for name in ASSET_FILES:
        path = os.path.join(ART_DIR, name)
        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("ascii")
        lines.append(f"  '{name}': '{encoded}',")

    lines.extend([
        "};",
        "",
        "export const PASTURE_ART_BYTES: Readonly<Record<string, Uint8Array>> = Object.fromEntries(",
        "  Object.entries(PASTURE_ART_BASE64).map(([name, data]) => [name, decodeBase64(data)]),",
        ");",
        "",
        "export function getPastureArtBytes(name: string): Uint8Array | undefined {",
        "  return PASTURE_ART_BYTES[name];",
        "}",
        "",
        "export const PASTURE_ART_SIZES: Readonly<Record<string, number>> = Object.fromEntries(",
        "  Object.entries(PASTURE_ART_BYTES).map(([name, bytes]) => [name, bytes.length]),",
        ");",
        "",
    ])

    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main() -> None:
    os.makedirs(ART_DIR, exist_ok=True)

    save_background(
        "pasture-morning.jpg",
        compose_pasture(
            "backgroundColorGrass.png",
            color_overlay=(255, 235, 190, 45),
            brightness=1.05,
            saturation=1.08,
        ),
    )
    save_background(
        "pasture-afternoon.jpg",
        compose_pasture(
            "backgroundColorGrass.png",
            color_overlay=(255, 248, 210, 25),
            brightness=1.0,
            saturation=1.12,
        ),
    )
    save_background(
        "pasture-sunset.jpg",
        compose_pasture(
            "backgroundColorFall.png",
            color_overlay=(255, 120, 40, 40),
            brightness=0.98,
            saturation=1.15,
            vignette=0.1,
        ),
    )
    save_background(
        "pasture-night.jpg",
        compose_pasture(
            "backgroundColorGrass.png",
            color_overlay=(15, 25, 70, 130),
            brightness=0.42,
            saturation=0.55,
            creek_opacity=0.65,
            vignette=0.22,
            add_moon=True,
        ),
    )

    build_cow_sprite("cow-idle.png")
    build_cow_sprite("cow-graze.png", size=240, y_offset=12)
    build_cow_sprite("cow-walk.png", flip=True)
    build_cow_sprite("cow-drink.png", flip=True, size=240, y_offset=16)
    build_star()
    emit_typescript_bytes()
    print(f"Wrote {len(ASSET_FILES)} art files and {OUT_TS}")


if __name__ == "__main__":
    main()
