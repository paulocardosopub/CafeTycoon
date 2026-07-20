"""Align world sprites to one floor line and validate only their physical base.

Furniture may overhang above the floor. Native scale is preserved; only opaque
contact pixels close to the floor are checked against the logical footprint.
"""

from array import array
from pathlib import Path
import shutil

import bpy

from config.pipeline_config import DIRECTIONS, THUMBNAIL_SIZE, WORLD_FLOOR_Y
from render_common import blit, save_pixels


def _blank(width, height):
    return array('f', [0.0]) * (width * height * 4)


def _load(path: Path):
    image = bpy.data.images.load(str(path), check_existing=False)
    width, height = image.size
    pixels = array('f', [0.0]) * (width * height * 4)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    return pixels, width, height


def _extract(sheet, sheet_width, sheet_height, frame_width, frame_height, column, row_from_top):
    frame = _blank(frame_width, frame_height)
    x_offset = column * frame_width
    y_offset = sheet_height - (row_from_top + 1) * frame_height
    for y in range(frame_height):
        source_start = ((y_offset + y) * sheet_width + x_offset) * 4
        target_start = y * frame_width * 4
        frame[target_start:target_start + frame_width * 4] = sheet[source_start:source_start + frame_width * 4]
    return frame


def _pixel_top(frame, width, height, x, y_from_top):
    index = ((height - 1 - y_from_top) * width + x) * 4
    return frame[index:index + 4]


def _set_pixel_top(frame, width, height, x, y_from_top, rgba):
    index = ((height - 1 - y_from_top) * width + x) * 4
    frame[index:index + 4] = array('f', rgba)


def _bbox(frame, width, height):
    points = []
    for y in range(height):
        for x in range(width):
            if _pixel_top(frame, width, height, x, y)[3] > .06:
                points.append((x, y))
    if not points:
        raise RuntimeError("Cannot normalize an empty world frame")
    return min(x for x, _ in points), min(y for _, y in points), max(x for x, _ in points) + 1, max(y for _, y in points) + 1


def _limits(definition):
    width, depth = definition["footprint"]
    projected_width = 32 * (width + depth)
    return projected_width + 10


def _base_bbox(frame, width, height, floor_y):
    points = []
    # Quantized shadows are below .78 alpha; feet, legs and plinths are opaque.
    for y in range(max(0, floor_y - 16), min(height, floor_y + 2)):
        for x in range(width):
            if _pixel_top(frame, width, height, x, y)[3] >= .78:
                points.append((x, y))
    if not points:
        return None
    return min(x for x, _ in points), min(y for _, y in points), max(x for x, _ in points) + 1, max(y for _, y in points) + 1


def _repack(frame, width, height, max_width, max_height, floor_y, allow_upscale=False):
    left, top, right, bottom = _bbox(frame, width, height)
    source_width, source_height = right - left, bottom - top
    scale = min(max_width / source_width, max_height / source_height)
    if not allow_upscale:
        scale = min(1.0, scale)
    target_width = max(1, round(source_width * scale))
    target_height = max(1, round(source_height * scale))
    destination_x = (width - target_width) // 2
    destination_y = floor_y - target_height
    output = _blank(width, height)
    for dy in range(target_height):
        source_y = top + min(source_height - 1, int(dy / scale))
        for dx in range(target_width):
            source_x = left + min(source_width - 1, int(dx / scale))
            rgba = _pixel_top(frame, width, height, source_x, source_y)
            if rgba[3] <= .04:
                continue
            _set_pixel_top(output, width, height, destination_x + dx, destination_y + dy, rgba)
    return output


def _align_native(frame, width, height, floor_y):
    left, top, right, bottom = _bbox(frame, width, height)
    shift_y = floor_y - bottom
    output = _blank(width, height)
    for y in range(top, bottom):
        destination_y = y + shift_y
        if destination_y < 0 or destination_y >= height:
            continue
        for x in range(left, right):
            rgba = _pixel_top(frame, width, height, x, y)
            if rgba[3] > .04:
                _set_pixel_top(output, width, height, x, destination_y, rgba)
    return output


def _thumbnail(frame, width, height):
    return _repack(frame, width, height, min(118, width - 8), min(118, height - 8), min(124, height - 4), allow_upscale=False)


def normalize_world_assets(project_root: Path, definitions, selected=None, category=None, include_authorized=False):
    selected_ids = {selected} if isinstance(selected, str) else set(selected or [])
    normalized = []
    for definition in definitions:
        if definition["kind"] == "character":
            continue
        if definition.get("referenceMode") == "authorized-canonical-chroma-key" and not include_authorized:
            continue
        if selected_ids and definition["assetId"] not in selected_ids:
            continue
        if category and definition["kind"] != category:
            continue
        relative = Path(definition["category"]) / f"{definition['assetId']}.png"
        output = project_root / "assets/pixel/rendered" / relative
        if not output.exists():
            continue
        source, sheet_width, sheet_height = _load(output)
        frame_width, frame_height = definition["frameSize"]
        columns = sum(definition["animations"].values())
        output_width = frame_width * columns
        output_height = frame_height * len(DIRECTIONS)
        sheet = _blank(output_width, output_height)
        base_width_limit = _limits(definition)
        first = None
        for row in range(len(DIRECTIONS)):
            for column in range(columns):
                frame = _extract(source, sheet_width, sheet_height, frame_width, frame_height, column, row)
                packed = _align_native(frame, frame_width, frame_height, WORLD_FLOOR_Y)
                base_box = _base_bbox(packed, frame_width, frame_height, WORLD_FLOOR_Y)
                base_width = 0 if base_box is None else base_box[2] - base_box[0]
                if base_width > base_width_limit:
                    raise RuntimeError(
                        f"{definition['assetId']} base escapes footprint: {base_width}px > {base_width_limit}px"
                    )
                if first is None:
                    first = packed
                blit(sheet, output_width, packed, frame_width, frame_height, column, row, columns, len(DIRECTIONS))
        save_pixels(output, output_width, output_height, sheet)
        deployed = project_root / "public/assets/pixel/rendered" / relative
        deployed.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(output, deployed)

        thumb_output = project_root / "assets/pixel/rendered/thumbnails" / f"{definition['assetId']}.png"
        thumb = _blank(*THUMBNAIL_SIZE)
        first_box = _bbox(first, frame_width, frame_height)
        left, top, right, bottom = first_box
        source_width, source_height = right - left, bottom - top
        scale = min(118 / source_width, 118 / source_height, 1.0)
        target_width, target_height = max(1, round(source_width * scale)), max(1, round(source_height * scale))
        destination_x, destination_y = (THUMBNAIL_SIZE[0] - target_width) // 2, 124 - target_height
        for dy in range(target_height):
            sy = top + min(source_height - 1, int(dy / scale))
            for dx in range(target_width):
                sx = left + min(source_width - 1, int(dx / scale))
                rgba = _pixel_top(first, frame_width, frame_height, sx, sy)
                if rgba[3] > .04:
                    _set_pixel_top(thumb, THUMBNAIL_SIZE[0], THUMBNAIL_SIZE[1], destination_x + dx, destination_y + dy, rgba)
        save_pixels(thumb_output, *THUMBNAIL_SIZE, thumb)
        deployed_thumb = project_root / "public/assets/pixel/rendered/thumbnails" / f"{definition['assetId']}.png"
        deployed_thumb.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(thumb_output, deployed_thumb)
        normalized.append(definition["assetId"])
        print(f"ALIGNED {definition['assetId']} floor={WORLD_FLOOR_Y} base-limit={base_width_limit}px native-scale=preserved")
    return normalized
