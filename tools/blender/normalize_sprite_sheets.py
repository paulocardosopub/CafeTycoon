"""Repack world sprites around one shared floor baseline without blurring pixels."""

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
    if definition["assetId"] == "pickup_counter":
        return 232, 170
    if definition["assetId"] in ("stove_level_1", "refrigerator_level_1"):
        return 180, 170
    if definition["footprint"][0] >= 2:
        return 174, 166
    return 132, 158


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


def _thumbnail(frame, width, height):
    return _repack(frame, width, height, min(118, width - 8), min(118, height - 8), min(124, height - 4), allow_upscale=False)


def normalize_world_assets(project_root: Path, definitions, selected=None, category=None):
    selected_ids = {selected} if isinstance(selected, str) else set(selected or [])
    normalized = []
    for definition in definitions:
        if definition["kind"] == "character":
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
        sheet = _blank(sheet_width, sheet_height)
        max_width, max_height = _limits(definition)
        first = None
        for row in range(len(DIRECTIONS)):
            for column in range(columns):
                frame = _extract(source, sheet_width, sheet_height, frame_width, frame_height, column, row)
                packed = _repack(frame, frame_width, frame_height, max_width, max_height, WORLD_FLOOR_Y)
                if first is None:
                    first = packed
                blit(sheet, sheet_width, packed, frame_width, frame_height, column, row, columns, len(DIRECTIONS))
        save_pixels(output, sheet_width, sheet_height, sheet)
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
        print(f"NORMALIZED {definition['assetId']} floor={WORLD_FLOOR_Y} limits={max_width}x{max_height}")
    return normalized
