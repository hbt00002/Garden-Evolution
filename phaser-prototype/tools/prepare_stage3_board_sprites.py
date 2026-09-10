from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(r"C:\Projects\garden-evaluation\phaser-prototype")
SOURCE = Path(r"C:\Users\user\.codex\generated_images\01a034cb-5071-77d3-8f54-a1628dddb8e2")
OUT = ROOT / "public" / "assets" / "stage3-board"
OUT.mkdir(parents=True, exist_ok=True)


def crop_and_pixelate(source, target, size, kind):
    image = Image.open(source).convert("RGB")
    pixels = image.load()
    mask = Image.new("L", image.size, 0)
    alpha = mask.load()

    for y in range(image.height):
        for x in range(image.width):
            r, g, b = pixels[x, y]
            if kind == "grass":
                # Reject the generator's dark green glow and retain only the
                # deliberately modeled blade pixels.
                strength = g - max(r * 0.92, b * 1.12)
                value = max(r, g, b)
                alpha[x, y] = 255 if strength > 28 and value > 58 else 0
            else:
                # The tulip was authored in grayscale specifically for tinting.
                # A firm luminance cut removes the unwanted gray backdrop.
                value = (r * 3 + g * 4 + b) // 8
                alpha[x, y] = 255 if value > 108 else 0

    bbox = mask.getbbox()
    if not bbox:
        raise RuntimeError(f"No foreground found in {source}")
    x0, y0, x1, y1 = bbox
    pad = max(4, int(max(x1 - x0, y1 - y0) * 0.018))
    crop_box = (max(0, x0 - pad), max(0, y0 - pad), min(image.width, x1 + pad), min(image.height, y1 + pad))
    image = image.crop(crop_box)
    mask = mask.crop(crop_box)

    # Downsample once to the real in-game pixel density, then scale with
    # nearest-neighbour only. This produces stable intentional pixel clusters.
    image = image.resize(size, Image.Resampling.NEAREST)
    mask = mask.resize(size, Image.Resampling.NEAREST)
    rgba = image.convert("RGBA")
    rgba.putalpha(mask)
    rgba.save(target, optimize=True)


crop_and_pixelate(SOURCE / "exec-016fbee9-bd1f-4e1a-b371-8e1d79f8532f.png", OUT / "grass-blade-a.png", (32, 72), "grass")
crop_and_pixelate(SOURCE / "exec-0b1eb2d2-07fe-488b-882c-ed2e87215a5c.png", OUT / "grass-blade-b.png", (36, 68), "grass")
crop_and_pixelate(SOURCE / "exec-d1f8564b-4dc6-4843-b596-1f1658332ee4.png", OUT / "grass-blade-c.png", (40, 62), "grass")
crop_and_pixelate(SOURCE / "exec-1b71ec92-57af-4733-8a73-a26bbd30ac72.png", OUT / "tulip-neutral.png", (48, 128), "tulip")
