from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "design-candidates" / "stage3-board"
OUT = ROOT / "public" / "assets" / "stage3-board-approved"
OUT.mkdir(parents=True, exist_ok=True)


def largest_component(mask):
    width, height = mask.size
    src = mask.load()
    seen = bytearray(width * height)
    best = []
    for y in range(height):
        for x in range(width):
            idx = y * width + x
            if seen[idx] or not src[x, y]:
                continue
            seen[idx] = 1
            queue = deque([(x, y)])
            component = []
            while queue:
                px, py = queue.popleft()
                component.append((px, py))
                for nx, ny in ((px - 1, py), (px + 1, py), (px, py - 1), (px, py + 1)):
                    if 0 <= nx < width and 0 <= ny < height:
                        ni = ny * width + nx
                        if not seen[ni] and src[nx, ny]:
                            seen[ni] = 1
                            queue.append((nx, ny))
            if len(component) > len(best):
                best = component
    out = Image.new("L", mask.size, 0)
    dst = out.load()
    for x, y in best:
        dst[x, y] = 255
    return out


def prepare(source_name, output_name, target_size, kind):
    image = Image.open(SOURCE / source_name).convert("RGB")
    mask = Image.new("L", image.size, 0)
    src = image.load()
    dst = mask.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b = src[x, y]
            if kind == "grass":
                keep = g > 55 and g > r * 1.08 and g > b * 1.12
            else:
                luminance = (r * 3 + g * 4 + b) // 8
                keep = luminance < 226
            dst[x, y] = 255 if keep else 0

    mask = largest_component(mask)
    # Close tiny checkerboard cuts while retaining the deliberately blocky edge.
    mask = mask.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError(f"No foreground extracted from {source_name}")
    x0, y0, x1, y1 = bbox
    pad = max(4, round(max(x1 - x0, y1 - y0) * .012))
    box = (max(0, x0 - pad), max(0, y0 - pad), min(image.width, x1 + pad), min(image.height, y1 + pad))
    image = image.crop(box)
    mask = mask.crop(box)

    image = image.resize(target_size, Image.Resampling.LANCZOS)
    # A small fixed palette keeps the 2–3 tone pixel shading crisp at runtime.
    palette_colors = 12 if kind == "grass" else 10
    image = image.quantize(colors=palette_colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    mask = mask.resize(target_size, Image.Resampling.NEAREST)
    rgba = image.convert("RGBA")
    rgba.putalpha(mask)
    rgba.save(OUT / output_name, optimize=True)


prepare("grass-tuft-candidate-02.png", "grass-tuft-approved.png", (112, 84), "grass")
prepare("tulip-neutral-candidate-01.png", "tulip-neutral-approved.png", (48, 128), "tulip")
