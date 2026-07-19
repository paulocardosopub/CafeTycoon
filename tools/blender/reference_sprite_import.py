"""Build the four canonical runtime sheets directly from the supplied visual references.

Blender owns image decoding and PNG output so the reference path remains part of the
same automated asset pipeline as the editable 3D sources.
"""

from array import array
from pathlib import Path
import shutil

import bpy

from config.pipeline_config import ANIMATIONS, DIRECTIONS, THUMBNAIL_SIZE
from render_common import blit, save_pixels


REFERENCE_ASSETS = {
    "cook-0": {"source": "assets/blender/references/cook-reference.png", "type": "character"},
    "customer-0": {"source": "assets/blender/references/customer-reference.png", "type": "character"},
    "stove_level_1": {"source": "assets/blender/references/stove-reference.png", "type": "equipment"},
    "refrigerator_level_1": {"source": "assets/blender/references/refrigerator-reference.png", "type": "equipment"},
}

CHARACTER_ROW_MAP = (3, 2, 0, 1)  # runtime ne,nw,se,sw -> supplied sheet rows
EQUIPMENT_COLUMN_MAP = (3, 2, 1, 0)
ANIMATION_OFFSETS = {
    "idle": 0,
    "walk": 0,
    "carry-dish": 1,
    "carry-ingredients": 2,
    "work": 2,
    "cook": 2,
    "serve": 3,
    "clean": 4,
    "sit": 5,
    "seated": 5,
    "eat": 4,
    "stand": 0,
}


def _load(path: Path):
    image = bpy.data.images.load(str(path), check_existing=False)
    width, height = image.size
    pixels = list(image.pixels)
    bpy.data.images.remove(image)
    return pixels, width, height


def _pixel(pixels, width, height, x, y_from_top):
    index = ((height - 1 - y_from_top) * width + x) * 4
    return pixels[index:index + 4]


def _is_background(rgba):
    r, g, b, a = rgba
    return a < .05 or (r > .70 and b > .62 and g < .38)


def _bbox(pixels, width, height, bounds):
    x0, y0, x1, y1 = bounds
    left, top, right, bottom = x1, y1, x0 - 1, y0 - 1
    for y in range(y0, y1):
        for x in range(x0, x1):
            if _is_background(_pixel(pixels, width, height, x, y)):
                continue
            left = min(left, x); top = min(top, y); right = max(right, x); bottom = max(bottom, y)
    if right < left or bottom < top:
        raise RuntimeError(f"Reference cell is empty: {bounds}")
    return left, top, right + 1, bottom + 1


def _character_row_bands(pixels, width, height, expected=4):
    occupied = []
    for y in range(height):
        occupied.append(any(
            not _is_background(_pixel(pixels, width, height, x, y))
            for x in range(width)
        ))

    bands = []
    start = None
    for y, active in enumerate(occupied + [False]):
        if active and start is None:
            start = y
        elif not active and start is not None:
            if y - start >= 8:
                bands.append((start, y))
            start = None
    if len(bands) != expected:
        raise RuntimeError(f"Expected {expected} character rows, found {len(bands)}: {bands}")
    return bands


def _character_row_boxes(pixels, width, height, band, expected=6):
    """Find supplied character frames by foreground islands, not equal-width cells.

    The reference sheets use generous, uneven horizontal spacing and several figures
    cross the mathematical 1/6-cell boundaries.  A horizontal foreground projection
    keeps each complete silhouette together while still preserving the four authored
    direction rows.
    """
    y0, y1 = band
    occupied = []
    for x in range(width):
        occupied.append(any(
            not _is_background(_pixel(pixels, width, height, x, y))
            for y in range(y0, y1)
        ))

    runs = []
    start = None
    for x, active in enumerate(occupied + [False]):
        if active and start is None:
            start = x
        elif not active and start is not None:
            if x - start >= 8:
                runs.append((start, x))
            start = None

    if len(runs) != expected:
        raise RuntimeError(
            f"Expected {expected} character silhouettes in reference band {band}, found {len(runs)}: {runs}"
        )

    boxes = []
    for left, right in runs:
        padded = (max(0, left - 2), y0, min(width, right + 2), y1)
        boxes.append(_bbox(pixels, width, height, padded))
    return boxes


def _blank(width, height):
    return array('f', [0.0]) * (width * height * 4)


def _set_pixel(target, width, height, x, y_from_top, rgba):
    index = ((height - 1 - y_from_top) * width + x) * 4
    target[index:index + 4] = array('f', rgba)


def _scaled_frame(source, source_width, source_height, bbox, frame_size, max_size, bottom, scale=None):
    frame_width, frame_height = frame_size
    left, top, right, lower = bbox
    source_box_width, source_box_height = right - left, lower - top
    if scale is None:
        scale = min(max_size[0] / source_box_width, max_size[1] / source_box_height)
    target_width = max(1, round(source_box_width * scale))
    target_height = max(1, round(source_box_height * scale))
    target = _blank(frame_width, frame_height)
    destination_x = (frame_width - target_width) // 2
    destination_y = bottom - target_height
    for dy in range(target_height):
        source_y = top + min(source_box_height - 1, int(dy / scale))
        for dx in range(target_width):
            source_x = left + min(source_box_width - 1, int(dx / scale))
            rgba = _pixel(source, source_width, source_height, source_x, source_y)
            if _is_background(rgba):
                continue
            _set_pixel(target, frame_width, frame_height, destination_x + dx, destination_y + dy, (rgba[0], rgba[1], rgba[2], 1.0))
    return target


def _paths(project_root: Path, definition):
    relative = Path(definition["category"]) / f"{definition['assetId']}.png"
    output = project_root / "assets/pixel/rendered" / relative
    public = project_root / "public/assets/pixel/rendered" / relative
    thumbnail = project_root / "assets/pixel/rendered/thumbnails" / f"{definition['assetId']}.png"
    public_thumbnail = project_root / "public/assets/pixel/rendered/thumbnails" / f"{definition['assetId']}.png"
    return output, public, thumbnail, public_thumbnail


def _character_sheet(project_root: Path, definition):
    source_path = project_root / definition["referenceSource"]
    source, width, height = _load(source_path)
    frame_width, frame_height = definition["frameSize"]
    source_columns = 6
    sheet_columns = sum(ANIMATIONS.values())
    sheet = _blank(frame_width * sheet_columns, frame_height * len(DIRECTIONS))
    representative = None
    row_bands = _character_row_bands(source, width, height)
    boxes_by_row = {
        source_row: _character_row_boxes(source, width, height, row_bands[source_row], source_columns)
        for source_row in range(len(row_bands))
    }
    all_boxes = [box for boxes in boxes_by_row.values() for box in boxes]
    max_width = max(box[2] - box[0] for box in all_boxes)
    max_height = max(box[3] - box[1] for box in all_boxes)
    shared_scale = min(84 / max_width, 128 / max_height)
    for runtime_row, source_row in enumerate(CHARACTER_ROW_MAP):
        boxes = boxes_by_row[source_row]
        frames = [
            _scaled_frame(
                source,
                width,
                height,
                box,
                (frame_width, frame_height),
                (84, 128),
                136,
                shared_scale,
            )
            for box in boxes
        ]
        if representative is None:
            representative = frames[0]
        column = 0
        for animation, frame_count in ANIMATIONS.items():
            offset = ANIMATION_OFFSETS[animation]
            for frame_index in range(frame_count):
                source_index = frame_index if animation == "walk" else offset + frame_index
                blit(sheet, frame_width * sheet_columns, frames[source_index % source_columns], frame_width, frame_height, column, runtime_row, sheet_columns, len(DIRECTIONS))
                column += 1
    output, public, thumbnail, public_thumbnail = _paths(project_root, definition)
    save_pixels(output, frame_width * sheet_columns, frame_height * len(DIRECTIONS), sheet)
    thumbnail_box = boxes_by_row[0][0]
    thumbnail_pixels = _scaled_frame(source, width, height, thumbnail_box, THUMBNAIL_SIZE, (92, 120), 124)
    save_pixels(thumbnail, *THUMBNAIL_SIZE, thumbnail_pixels)
    public.parent.mkdir(parents=True, exist_ok=True); public_thumbnail.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(output, public); shutil.copy2(thumbnail, public_thumbnail)
    return output, thumbnail


def _equipment_sheet(project_root: Path, definition):
    source_path = project_root / definition["referenceSource"]
    source, width, height = _load(source_path)
    frame_width, frame_height = definition["frameSize"]
    state_columns = sum(definition["animations"].values())
    sheet = _blank(frame_width * state_columns, frame_height * len(DIRECTIONS))
    first_off = None
    for runtime_row, source_column in enumerate(EQUIPMENT_COLUMN_MAP):
        state_boxes = []
        for source_row in range(2):
            bounds = (
                round(source_column * width / 4),
                round(source_row * height / 2),
                round((source_column + 1) * width / 4),
                round((source_row + 1) * height / 2),
            )
            state_boxes.append(_bbox(source, width, height, bounds))
        max_width = max(box[2] - box[0] for box in state_boxes)
        max_height = max(box[3] - box[1] for box in state_boxes)
        shared_scale = min(180 / max_width, 170 / max_height)
        off = _scaled_frame(source, width, height, state_boxes[0], (frame_width, frame_height), (180, 170), 178, shared_scale)
        active = _scaled_frame(source, width, height, state_boxes[1], (frame_width, frame_height), (180, 170), 178, shared_scale)
        if first_off is None:
            first_off = off
        for column, frame in enumerate((off, active, active, off)):
            blit(sheet, frame_width * state_columns, frame, frame_width, frame_height, column, runtime_row, state_columns, len(DIRECTIONS))
    output, public, thumbnail, public_thumbnail = _paths(project_root, definition)
    save_pixels(output, frame_width * state_columns, frame_height * len(DIRECTIONS), sheet)
    # The canonical first frame is already transparent and can be scaled down by Blender.
    thumb = _blank(*THUMBNAIL_SIZE)
    for y in range(THUMBNAIL_SIZE[1]):
        for x in range(THUMBNAIL_SIZE[0]):
            sx = min(frame_width - 1, round(x * frame_width / THUMBNAIL_SIZE[0]))
            sy = min(frame_height - 1, round(y * frame_height / THUMBNAIL_SIZE[1]))
            source_index = (sy * frame_width + sx) * 4
            target_index = (y * THUMBNAIL_SIZE[0] + x) * 4
            thumb[target_index:target_index + 4] = first_off[source_index:source_index + 4]
    save_pixels(thumbnail, *THUMBNAIL_SIZE, thumb)
    public.parent.mkdir(parents=True, exist_ok=True); public_thumbnail.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(output, public); shutil.copy2(thumbnail, public_thumbnail)
    return output, thumbnail


def render_reference_assets(project_root: Path, definitions, selected=None):
    selected_ids = {selected} if isinstance(selected, str) else set(selected or [])
    rendered = []
    for definition in definitions:
        if definition["assetId"] not in REFERENCE_ASSETS or (selected_ids and definition["assetId"] not in selected_ids):
            continue
        if definition["kind"] == "character":
            output, thumbnail = _character_sheet(project_root, definition)
        else:
            output, thumbnail = _equipment_sheet(project_root, definition)
        rendered.append((definition, output, thumbnail))
        print(f"REFERENCE {definition['assetId']} -> {output}")
    return rendered
