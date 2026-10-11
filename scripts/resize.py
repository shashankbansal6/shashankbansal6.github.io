"""Helper for add-photos.mjs: turn one image (jpg/png, already converted from HEIC by
sips) into the two web sizes, upright and with all metadata (including GPS) stripped.
usage: python3 -I scripts/resize.py <in.jpg> <out-1100.jpg> <out-2000.jpg>
prints: <width> <height> <YYYY-MM-DD or ->   (size of the 1100 version)"""
import sys
from PIL import Image, ImageOps

src, out1, out2 = sys.argv[1:4]
im = Image.open(src)
ex = im.getexif()
taken = (ex.get_ifd(0x8769).get(36867) or ex.get(306) or '')[:10].replace(':', '-') or '-'
im = ImageOps.exif_transpose(im).convert('RGB')
for size, out in ((1100, out1), (2000, out2)):
    c = im.copy()
    c.thumbnail((size, size), Image.LANCZOS)  # never upscales
    c.save(out, 'JPEG', quality=82, optimize=True, progressive=True)
    if size == 1100:
        w, h = c.size
print(w, h, taken)
