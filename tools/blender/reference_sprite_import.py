"""Build the detailed runtime sheets directly from the supplied visual references.

Blender owns image decoding and PNG output so the reference path remains part of the
same automated asset pipeline as the editable 3D sources.
"""

from array import array
from colorsys import hsv_to_rgb, rgb_to_hsv
from pathlib import Path
import shutil

import bpy

from config.pipeline_config import ANIMATIONS, DIRECTIONS, THUMBNAIL_SIZE
from render_common import blit, save_pixels


REFERENCE_ASSETS = {
    "cook-0": {"source": "assets/blender/references/cook-reference.png", "type": "character"},
    "stove_level_1": {"source": "assets/blender/references/stove-reference.png", "type": "equipment"},
    "refrigerator_level_1": {"source": "assets/blender/references/refrigerator-reference.png", "type": "equipment"},
}
REFERENCE_ASSETS.update({
    f"customer-{index}": {"source": "assets/blender/references/customer-reference.png", "type": "character"}
    for index in range(8)
})
REFERENCE_ASSETS.update({
    asset_id: {"source": "assets/blender/references/customer-reference.png", "type": "character"}
    for asset_id in (
        "player-style-0", "player-style-1", "player-style-2", "player-style-3",
        "cook-1", "waiter-0", "waiter-1", "cleaner-0", "stocker-0",
    )
})

CHARACTER_VARIANTS = {
    "customer-0": {"skin": (0.70, 0.38, 0.19), "hair": (0.12, 0.055, 0.035), "outfit": (0.94, 0.62, 0.08), "pants": (0.13, 0.28, 0.45), "accent": (0.96, 0.89, 0.72), "detail": "none"},
    "customer-1": {"skin": (0.82, 0.49, 0.29), "hair": (0.16, 0.075, 0.045), "outfit": (0.10, 0.46, 0.55), "pants": (0.12, 0.19, 0.27), "accent": (0.96, 0.90, 0.74), "detail": "crop"},
    "customer-2": {"skin": (0.37, 0.19, 0.10), "hair": (0.045, 0.028, 0.022), "outfit": (0.55, 0.12, 0.17), "pants": (0.11, 0.26, 0.44), "accent": (0.94, 0.84, 0.64), "detail": "bun"},
    "customer-3": {"skin": (0.92, 0.67, 0.49), "hair": (0.39, 0.16, 0.065), "outfit": (0.34, 0.54, 0.30), "pants": (0.18, 0.30, 0.40), "accent": (0.98, 0.92, 0.76), "detail": "glasses"},
    "customer-4": {"skin": (0.64, 0.35, 0.21), "hair": (0.095, 0.047, 0.032), "outfit": (0.44, 0.24, 0.56), "pants": (0.16, 0.18, 0.24), "accent": (0.94, 0.80, 0.58), "detail": "braid"},
    "customer-5": {"skin": (0.30, 0.15, 0.075), "hair": (0.075, 0.055, 0.045), "outfit": (0.16, 0.34, 0.66), "pants": (0.13, 0.17, 0.22), "accent": (0.96, 0.91, 0.78), "detail": "moustache"},
    "customer-6": {"skin": (0.78, 0.44, 0.25), "hair": (0.57, 0.31, 0.10), "outfit": (0.80, 0.25, 0.15), "pants": (0.12, 0.31, 0.51), "accent": (0.98, 0.86, 0.66), "detail": "ponytail"},
    "customer-7": {"skin": (0.89, 0.60, 0.41), "hair": (0.22, 0.095, 0.045), "outfit": (0.16, 0.42, 0.24), "pants": (0.42, 0.27, 0.15), "accent": (0.95, 0.87, 0.66), "detail": "hat"},
    "player-style-0": {"skin": (0.70, 0.38, 0.19), "hair": (0.10, 0.045, 0.03), "outfit": (0.18, 0.36, 0.22), "pants": (0.12, 0.24, 0.34), "accent": (0.96, 0.91, 0.74), "detail": "apron"},
    "player-style-1": {"skin": (0.91, 0.66, 0.48), "hair": (0.32, 0.14, 0.07), "outfit": (0.12, 0.35, 0.52), "pants": (0.12, 0.20, 0.29), "accent": (0.96, 0.89, 0.70), "detail": "crop"},
    "player-style-2": {"skin": (0.35, 0.17, 0.09), "hair": (0.045, 0.025, 0.02), "outfit": (0.93, 0.88, 0.75), "pants": (0.10, 0.24, 0.35), "accent": (0.50, 0.12, 0.10), "detail": "bun"},
    "player-style-3": {"skin": (0.77, 0.43, 0.25), "hair": (0.50, 0.21, 0.08), "outfit": (0.68, 0.39, 0.12), "pants": (0.22, 0.18, 0.22), "accent": (0.94, 0.84, 0.66), "detail": "ponytail"},
    "cook-1": {"skin": (0.90, 0.63, 0.45), "hair": (0.24, 0.10, 0.045), "outfit": (0.94, 0.91, 0.82), "pants": (0.08, 0.24, 0.32), "accent": (0.16, 0.38, 0.22), "detail": "headband"},
    "waiter-0": {"skin": (0.88, 0.59, 0.40), "hair": (0.08, 0.04, 0.03), "outfit": (0.30, 0.12, 0.08), "pants": (0.10, 0.20, 0.28), "accent": (0.96, 0.91, 0.76), "detail": "vest"},
    "waiter-1": {"skin": (0.30, 0.14, 0.07), "hair": (0.04, 0.025, 0.02), "outfit": (0.12, 0.30, 0.36), "pants": (0.09, 0.16, 0.22), "accent": (0.96, 0.90, 0.73), "detail": "glasses"},
    "cleaner-0": {"skin": (0.64, 0.34, 0.19), "hair": (0.06, 0.035, 0.03), "outfit": (0.30, 0.48, 0.28), "pants": (0.12, 0.23, 0.30), "accent": (0.92, 0.84, 0.66), "detail": "braid"},
    "stocker-0": {"skin": (0.91, 0.65, 0.46), "hair": (0.30, 0.13, 0.06), "outfit": (0.12, 0.31, 0.50), "pants": (0.16, 0.25, 0.34), "accent": (0.92, 0.68, 0.22), "detail": "cap"},
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

_CHARACTER_SOURCE_CACHE = {}


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


def _shade_to_target(rgba, target, reference_value):
    r, g, b, _ = rgba
    _, source_saturation, source_value = rgb_to_hsv(r, g, b)
    target_hue, target_saturation, target_value = rgb_to_hsv(*target)
    light_ratio = max(.34, min(1.52, source_value / reference_value))
    saturation = max(.12, min(1.0, target_saturation * (.78 + .22 * source_saturation)))
    value = max(.025, min(1.0, target_value * light_ratio))
    return (*hsv_to_rgb(target_hue, saturation, value), 1.0)


def _variant_pixel(asset_id, rgba, nx, ny):
    profile = CHARACTER_VARIANTS.get(asset_id)
    if not profile or asset_id == "customer-0":
        return rgba
    r, g, b, _ = rgba
    hue, saturation, value = rgb_to_hsv(r, g, b)
    if value < .11 or (.76 < hue < .94 and saturation > .40):
        return rgba  # contact shadows are neutralized after placement on the shared floor line
    warm = hue < .16 or hue > .97
    face = ny < .36 and .16 < nx < .84 and warm and saturation > .28
    hands = .34 < ny < .64 and (nx < .30 or nx > .70) and warm and saturation > .30
    if face or hands:
        return _shade_to_target(rgba, profile["skin"], .72)
    if ny < .34 and value < .48 and warm:
        return _shade_to_target(rgba, profile["hair"], .24)
    if .23 < ny < .69 and warm and saturation > .34:
        return _shade_to_target(rgba, profile["outfit"], .88)
    if ny > .50 and .48 < hue < .72 and saturation > .18:
        return _shade_to_target(rgba, profile["pants"], .45)
    if .25 < ny < .64 and saturation < .38 and value > .52:
        return _shade_to_target(rgba, profile["accent"], .92)
    return rgba


def _is_reference_contact_shadow(rgba):
    hue, saturation, value = rgb_to_hsv(rgba[0], rgba[1], rgba[2])
    return .76 < hue < .94 and saturation > .40 and value > .18


def _neutralized_contact_shadow(rgba):
    """Turn the reference sheet's purple staging shadow into a subtle in-game shadow."""
    return (.20, .105, .085, min(.52, rgba[3]))


def _paint_rect(frame, frame_width, frame_height, x, y, width, height, color):
    for py in range(max(0, y), min(frame_height, y + height)):
        for px in range(max(0, x), min(frame_width, x + width)):
            _set_pixel(frame, frame_width, frame_height, px, py, (*color, 1.0))


def _paint_circle(frame, frame_width, frame_height, cx, cy, radius, color):
    for py in range(cy - radius, cy + radius + 1):
        for px in range(cx - radius, cx + radius + 1):
            if (px - cx) ** 2 + (py - cy) ** 2 <= radius ** 2:
                if 0 <= px < frame_width and 0 <= py < frame_height:
                    _set_pixel(frame, frame_width, frame_height, px, py, (*color, 1.0))


def _dark(color, amount=.44):
    return tuple(channel * amount for channel in color)


def _apply_variant_detail(frame, frame_width, frame_height, asset_id, direction, geometry):
    profile = CHARACTER_VARIANTS.get(asset_id)
    if not profile or profile["detail"] in ("none", "crop"):
        return
    x, y, width, height = geometry
    side = 1 if direction in ("ne", "se") else -1
    face_x = x + round(width * (.57 if side > 0 else .43))
    hair = profile["hair"]
    ink = (0.055, 0.032, 0.028)
    detail = profile["detail"]
    if detail == "bun":
        cx, cy = x + round(width * (.70 if side > 0 else .30)), y + round(height * .11)
        _paint_circle(frame, frame_width, frame_height, cx, cy, 7, ink)
        _paint_circle(frame, frame_width, frame_height, cx, cy, 5, hair)
    elif detail == "glasses" and direction in ("se", "sw"):
        eye_y = y + round(height * .235)
        _paint_rect(frame, frame_width, frame_height, face_x - 8, eye_y, 6, 2, ink)
        _paint_rect(frame, frame_width, frame_height, face_x + 2, eye_y, 6, 2, ink)
        _paint_rect(frame, frame_width, frame_height, face_x - 2, eye_y, 4, 1, ink)
    elif detail == "braid":
        bx = x + round(width * (.79 if side > 0 else .17))
        for segment in range(4):
            _paint_circle(frame, frame_width, frame_height, bx + side * (segment % 2), y + round(height * (.28 + segment * .055)), 3, ink)
            _paint_circle(frame, frame_width, frame_height, bx + side * (segment % 2), y + round(height * (.28 + segment * .055)), 2, hair)
    elif detail == "moustache" and direction in ("se", "sw"):
        mouth_y = y + round(height * .295)
        _paint_rect(frame, frame_width, frame_height, face_x - 5, mouth_y, 4, 2, ink)
        _paint_rect(frame, frame_width, frame_height, face_x + 1, mouth_y, 4, 2, ink)
    elif detail == "ponytail":
        px, py = x + round(width * (.79 if side > 0 else .21)), y + round(height * .24)
        _paint_circle(frame, frame_width, frame_height, px, py, 5, ink)
        _paint_circle(frame, frame_width, frame_height, px, py, 3, hair)
        _paint_rect(frame, frame_width, frame_height, px - 2, py + 3, 4, 8, hair)
    elif detail == "hat":
        brim_y = y + round(height * .105)
        hat = profile["outfit"]
        _paint_rect(frame, frame_width, frame_height, x + round(width * .24), brim_y, round(width * .52), 4, ink)
        _paint_rect(frame, frame_width, frame_height, x + round(width * .28), brim_y - 8, round(width * .44), 8, _dark(hat, .72))
        _paint_rect(frame, frame_width, frame_height, x + round(width * .31), brim_y - 6, round(width * .38), 5, hat)
    elif detail == "headband":
        band_y = y + round(height * .13)
        _paint_rect(frame, frame_width, frame_height, x + round(width * .23), band_y, round(width * .54), 3, ink)
        _paint_rect(frame, frame_width, frame_height, x + round(width * .27), band_y, round(width * .46), 2, profile["accent"])
    elif detail == "cap":
        cap_y = y + round(height * .10)
        _paint_rect(frame, frame_width, frame_height, x + round(width * .22), cap_y, round(width * .54), 4, ink)
        _paint_rect(frame, frame_width, frame_height, x + round(width * .25), cap_y - 6, round(width * .46), 7, profile["accent"])
        brim_x = face_x if side > 0 else face_x - 10
        _paint_rect(frame, frame_width, frame_height, brim_x, cap_y + 2, 10, 2, profile["accent"])
    elif detail in ("apron", "vest"):
        torso_y = y + round(height * .37)
        torso_h = round(height * .24)
        center_x = x + round(width * .5)
        if detail == "apron":
            _paint_rect(frame, frame_width, frame_height, center_x - 7, torso_y, 2, torso_h - 3, profile["accent"])
            _paint_rect(frame, frame_width, frame_height, center_x + 5, torso_y, 2, torso_h - 3, profile["accent"])
            _paint_rect(frame, frame_width, frame_height, center_x - 8, torso_y + torso_h - 4, 16, 2, ink)
        else:
            _paint_rect(frame, frame_width, frame_height, center_x - 1, torso_y, 2, torso_h - 2, ink)
            _paint_rect(frame, frame_width, frame_height, center_x - 7, torso_y + 3, 2, torso_h - 7, profile["accent"])
            _paint_rect(frame, frame_width, frame_height, center_x + 5, torso_y + 3, 2, torso_h - 7, profile["accent"])


def _scaled_frame(source, source_width, source_height, bbox, frame_size, max_size, bottom, scale=None, asset_id=None, direction=None):
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
            authored_shadow = _is_reference_contact_shadow(rgba)
            if asset_id:
                rgba = _variant_pixel(asset_id, rgba, dx / max(1, target_width - 1), dy / max(1, target_height - 1))
            if authored_shadow:
                rgba = _neutralized_contact_shadow(rgba)
            _set_pixel(target, frame_width, frame_height, destination_x + dx, destination_y + dy, rgba)
    if asset_id and direction:
        _apply_variant_detail(target, frame_width, frame_height, asset_id, direction, (destination_x, destination_y, target_width, target_height))
    return target


def _seated_frame(source, frame_width, frame_height, bottom=136):
    """Keep the detailed upper body while placing the hips on the chair anchor."""
    cutoff = round(frame_height * .67)
    shift = bottom - cutoff
    target = _blank(frame_width, frame_height)
    for y in range(cutoff):
        destination_y = y + shift
        if destination_y < 0 or destination_y >= frame_height:
            continue
        for x in range(frame_width):
            rgba = _pixel(source, frame_width, frame_height, x, y)
            if rgba[3] < .05:
                continue
            hue, saturation, _ = rgb_to_hsv(rgba[0], rgba[1], rgba[2])
            if .76 < hue < .94 and saturation > .40:
                continue
            _set_pixel(target, frame_width, frame_height, x, destination_y, rgba)
    return target


def _paths(project_root: Path, definition):
    relative = Path(definition["category"]) / f"{definition['assetId']}.png"
    output = project_root / "assets/pixel/rendered" / relative
    public = project_root / "public/assets/pixel/rendered" / relative
    thumbnail = project_root / "assets/pixel/rendered/thumbnails" / f"{definition['assetId']}.png"
    public_thumbnail = project_root / "public/assets/pixel/rendered/thumbnails" / f"{definition['assetId']}.png"
    return output, public, thumbnail, public_thumbnail


def _character_source_data(source_path: Path):
    cache_key = str(source_path.resolve())
    cached = _CHARACTER_SOURCE_CACHE.get(cache_key)
    if cached:
        return cached
    source, width, height = _load(source_path)
    row_bands = _character_row_bands(source, width, height)
    boxes_by_row = {
        source_row: _character_row_boxes(source, width, height, row_bands[source_row], 6)
        for source_row in range(len(row_bands))
    }
    all_boxes = [box for boxes in boxes_by_row.values() for box in boxes]
    max_width = max(box[2] - box[0] for box in all_boxes)
    max_height = max(box[3] - box[1] for box in all_boxes)
    cached = (source, width, height, boxes_by_row, min(84 / max_width, 128 / max_height))
    _CHARACTER_SOURCE_CACHE[cache_key] = cached
    return cached


def _character_sheet(project_root: Path, definition):
    source_path = project_root / definition["referenceSource"]
    source, width, height, boxes_by_row, shared_scale = _character_source_data(source_path)
    frame_width, frame_height = definition["frameSize"]
    source_columns = 6
    sheet_columns = sum(ANIMATIONS.values())
    sheet = _blank(frame_width * sheet_columns, frame_height * len(DIRECTIONS))
    representative = None
    for runtime_row, source_row in enumerate(CHARACTER_ROW_MAP):
        direction = DIRECTIONS[runtime_row]
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
                definition["assetId"],
                direction,
            )
            for box in boxes
        ]
        seated_frames = [_seated_frame(frame, frame_width, frame_height) for frame in frames]
        if representative is None:
            representative = frames[0]
        column = 0
        for animation, frame_count in ANIMATIONS.items():
            offset = ANIMATION_OFFSETS[animation]
            for frame_index in range(frame_count):
                source_index = frame_index if animation == "walk" else offset + frame_index
                source_frames = seated_frames if animation in ("sit", "seated", "eat") else frames
                blit(sheet, frame_width * sheet_columns, source_frames[source_index % source_columns], frame_width, frame_height, column, runtime_row, sheet_columns, len(DIRECTIONS))
                column += 1
    output, public, thumbnail, public_thumbnail = _paths(project_root, definition)
    save_pixels(output, frame_width * sheet_columns, frame_height * len(DIRECTIONS), sheet)
    thumbnail_box = boxes_by_row[0][0]
    thumbnail_pixels = _scaled_frame(source, width, height, thumbnail_box, THUMBNAIL_SIZE, (92, 120), 124, asset_id=definition["assetId"], direction="se")
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
