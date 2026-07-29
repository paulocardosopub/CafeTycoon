"""Create nearest-neighbor animated GIF previews with only Python stdlib.

The encoder uses a fixed 256-color palette and emits frequent GIF clear codes,
which keeps the implementation deterministic and dependency-free.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

from prototype_config import ACTIVE_DIRECTIONS, OUTPUT_ROOT


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def paeth(a, b, c):
    p = a + b - c
    pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
    return a if pa <= pb and pa <= pc else b if pb <= pc else c


def read_png(path):
    data = Path(path).read_bytes()
    if not data.startswith(PNG_SIGNATURE):
        raise ValueError(f"Not a PNG: {path}")
    cursor = len(PNG_SIGNATURE)
    compressed = bytearray()
    width = height = None
    while cursor < len(data):
        length = struct.unpack(">I", data[cursor:cursor+4])[0]
        kind = data[cursor+4:cursor+8]
        payload = data[cursor+8:cursor+8+length]
        cursor += 12 + length
        if kind == b"IHDR":
            width, height, depth, color_type, _compression, _filter, interlace = struct.unpack(">IIBBBBB", payload)
            if (depth, color_type, interlace) != (8, 6, 0):
                raise ValueError(f"Expected non-interlaced RGBA8 PNG: {path}")
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break
    raw = zlib.decompress(bytes(compressed))
    stride = width * 4
    rows = []
    previous = bytearray(stride)
    cursor = 0
    for _ in range(height):
        filter_type = raw[cursor]
        cursor += 1
        scan = bytearray(raw[cursor:cursor+stride])
        cursor += stride
        for index in range(stride):
            left = scan[index-4] if index >= 4 else 0
            up = previous[index]
            upper_left = previous[index-4] if index >= 4 else 0
            if filter_type == 1: scan[index] = (scan[index] + left) & 255
            elif filter_type == 2: scan[index] = (scan[index] + up) & 255
            elif filter_type == 3: scan[index] = (scan[index] + ((left + up) >> 1)) & 255
            elif filter_type == 4: scan[index] = (scan[index] + paeth(left, up, upper_left)) & 255
            elif filter_type != 0: raise ValueError(f"Unknown PNG filter {filter_type}")
        rows.append(bytes(scan))
        previous = scan
    return width, height, b"".join(rows)


def paste_nearest(canvas, canvas_w, source, source_w, source_h, x0, y0, scale):
    for sy in range(source_h):
        for sx in range(source_w):
            offset = (sy * source_w + sx) * 4
            pixel = source[offset:offset+4]
            if pixel[3] < 16:
                continue
            for oy in range(scale):
                row = ((y0 + sy*scale + oy) * canvas_w + x0 + sx*scale) * 4
                for ox in range(scale):
                    canvas[row+ox*4:row+ox*4+4] = pixel


def composite_frame(animation, frame, scale=2):
    source_w, source_h = 112, 168
    gap = 12
    margin = 16
    width = margin*2 + source_w*scale*2 + gap
    height = margin*2 + source_h*scale*2 + gap
    canvas = bytearray((242, 235, 218, 255)) * (width*height)
    for index, direction in enumerate(ACTIVE_DIRECTIONS):
        w, h, pixels = read_png(OUTPUT_ROOT / "animation_frames" / animation / direction / f"{frame:03d}.png")
        x = margin + (index % 2) * (source_w*scale + gap)
        y = margin + (index // 2) * (source_h*scale + gap)
        paste_nearest(canvas, width, pixels, w, h, x, y, scale)
    return width, height, bytes(canvas)


def palette_bytes():
    colors = [(0, 0, 0)]
    colors += [(r, g, b) for r in (0,51,102,153,204,255) for g in (0,51,102,153,204,255) for b in (0,51,102,153,204,255)]
    colors += [(0, 0, 0)] * (256-len(colors))
    return b"".join(bytes(color) for color in colors)


def palette_indices(rgba):
    result = bytearray(len(rgba)//4)
    for index in range(len(result)):
        r,g,b,a = rgba[index*4:index*4+4]
        if a < 32:
            result[index] = 0
        else:
            result[index] = 1 + min(5, round(r/51))*36 + min(5, round(g/51))*6 + min(5, round(b/51))
    return bytes(result)


def lzw_fixed_9bit(indices):
    clear, end = 256, 257
    codes = []
    for start in range(0, len(indices), 240):
        codes.append(clear)
        codes.extend(indices[start:start+240])
    codes.append(end)
    output = bytearray()
    buffer = bits = 0
    for code in codes:
        buffer |= int(code) << bits
        bits += 9
        while bits >= 8:
            output.append(buffer & 255)
            buffer >>= 8
            bits -= 8
    if bits:
        output.append(buffer & 255)
    return bytes(output)


def subblocks(data):
    return b"".join(bytes((len(data[index:index+255]),)) + data[index:index+255] for index in range(0, len(data), 255)) + b"\x00"


def write_gif(path, frames, delay_cs=12):
    width, height = frames[0][:2]
    output = bytearray(b"GIF89a")
    output.extend(struct.pack("<HHBBB", width, height, 0xF7, 0, 0))
    output.extend(palette_bytes())
    output.extend(b"\x21\xFF\x0BNETSCAPE2.0\x03\x01\x00\x00\x00")
    for frame_w, frame_h, rgba in frames:
        if (frame_w, frame_h) != (width, height):
            raise ValueError("GIF frame size mismatch")
        output.extend(b"\x21\xF9\x04\x09")
        output.extend(struct.pack("<HBB", delay_cs, 0, 0))
        output.extend(b"\x2C" + struct.pack("<HHHHB", 0, 0, width, height, 0))
        output.append(8)
        output.extend(subblocks(lzw_fixed_9bit(palette_indices(rgba))))
    output.append(0x3B)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(output)


def main():
    for animation in ("walk", "walk_tray", "cook"):
        frames = [composite_frame(animation, frame) for frame in range(4)]
        write_gif(OUTPUT_ROOT / "previews" / f"{animation}_4_directions.gif", frames)
        print(f"GIF {animation}: {frames[0][0]}x{frames[0][1]}")


if __name__ == "__main__":
    main()

