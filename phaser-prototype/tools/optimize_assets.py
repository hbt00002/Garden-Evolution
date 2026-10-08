#!/usr/bin/env python3
"""Shrink PNGs under public/assets without changing dimensions or file names.

* Fully opaque images larger than 1 MP (the world backgrounds) are reduced to a
  256-colour palette with median-cut + Floyd-Steinberg dithering.
* Every other PNG (sprites, tiles) is re-encoded losslessly and verified to be
  pixel-identical.
* A file is only replaced when the result is smaller.

Usage: python3 tools/optimize_assets.py [assets_dir]   (requires Pillow, numpy)
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "public", "assets")
before = after = 0
for path in sorted(glob.glob(os.path.join(root, "**", "*.png"), recursive=True)):
    rgba = Image.open(path).convert("RGBA")
    pixels = np.asarray(rgba)
    tmp = path + ".tmp"
    if pixels[..., 3].min() == 255 and pixels.shape[0] * pixels.shape[1] > 1_000_000:
        rgba.convert("RGB").quantize(
            colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG
        ).save(tmp, format="PNG", optimize=True)
    else:
        rgba.save(tmp, format="PNG", optimize=True, compress_level=9)
        assert (np.asarray(Image.open(tmp).convert("RGBA")) == pixels).all(), path
    old, new = os.path.getsize(path), os.path.getsize(tmp)
    if new < old:
        os.replace(tmp, path)
    else:
        os.remove(tmp)
        new = old
    before += old
    after += new
print(f"{before // 1024} KB -> {after // 1024} KB")
