"""Generate PWA icons (WC26 key-art style) into public/."""
from PIL import Image, ImageDraw, ImageFont


def font(size):
    for name in ("segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def rounded_block(img, box, radius, color):
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(overlay).rounded_rectangle(box, radius=radius, fill=color)
    img.alpha_composite(overlay)


def make(size, path):
    img = Image.new("RGBA", (size, size), (12, 10, 18, 255))
    s = size / 512
    # WC26 color blocks
    rounded_block(img, (-60 * s, 40 * s, 300 * s, 470 * s), int(90 * s), (124, 58, 237, 235))
    rounded_block(img, (250 * s, 120 * s, 600 * s, 560 * s), int(90 * s), (225, 29, 72, 220))
    rounded_block(img, (60 * s, 300 * s, 470 * s, 600 * s), int(90 * s), (132, 204, 22, 200))
    rounded_block(img, (-40 * s, 360 * s, 320 * s, 600 * s), int(90 * s), (5, 150, 105, 220))
    # dark wash for contrast
    wash = Image.new("RGBA", img.size, (12, 10, 18, 150))
    img.alpha_composite(wash)
    # white 26 badge with centered text (anchor="mm" = middle/middle)
    cx, cy = size / 2, size / 2
    f = font(int(215 * s))
    text = "26"
    d = ImageDraw.Draw(img)
    bb = d.textbbox((cx, cy), text, font=f, anchor="mm")
    pad_x, pad_y = 55 * s, 28 * s
    badge = (bb[0] - pad_x, bb[1] - pad_y, bb[2] + pad_x, bb[3] + pad_y)
    rounded_block(img, badge, int(40 * s), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((cx, cy), text, font=f, anchor="mm", fill=(12, 10, 18, 255))
    img.convert("RGB").save(path)
    print("wrote", path)


make(192, "public/icon-192.png")
make(512, "public/icon-512.png")
