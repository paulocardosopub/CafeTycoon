"""Normalize the authorized RGBA character sheets into runtime sprite sheets.

The supplied identities remain canonical. Walk cycles use six distinct
nearest-neighbour limb poses so movement reads as a walk rather than sprite sliding.
"""

from array import array
from pathlib import Path
import shutil

import bpy

from config.pipeline_config import ANIMATIONS, DIRECTIONS, THUMBNAIL_SIZE
from render_common import blit, save_pixels


_SOURCE_CACHE = {}


def _blank(width, height):
    return array("f", [0.0]) * (width * height * 4)


def _pixel_top(pixels, width, height, x, y):
    index = ((height - 1 - y) * width + x) * 4
    return pixels[index:index + 4]


def _alpha_top(pixels, width, height, x, y):
    return pixels[((height - 1 - y) * width + x) * 4 + 3]


def _set_top(pixels, width, height, x, y, rgba):
    index = ((height - 1 - y) * width + x) * 4
    pixels[index:index + 4] = array("f", rgba)


def _runs(values, minimum=5):
    result = []
    start = None
    for index, active in enumerate(list(values) + [False]):
        if active and start is None:
            start = index
        elif not active and start is not None:
            if index - start >= minimum:
                result.append((start, index))
            start = None
    return result


def _bbox(pixels, width, height, bounds):
    x0, y0, x1, y1 = bounds
    left, top, right, bottom = x1, y1, x0 - 1, y0 - 1
    for y in range(y0, y1):
        for x in range(x0, x1):
            if _alpha_top(pixels, width, height, x, y) <= .04:
                continue
            left = min(left, x)
            top = min(top, y)
            right = max(right, x)
            bottom = max(bottom, y)
    if right < left or bottom < top:
        raise RuntimeError(f"Empty authorized character cell: {bounds}")
    return left, top, right + 1, bottom + 1


def _load_source(path: Path, expected_rows, expected_columns):
    key = (str(path.resolve()), expected_rows, expected_columns)
    if key in _SOURCE_CACHE:
        return _SOURCE_CACHE[key]

    image = bpy.data.images.load(str(path), check_existing=False)
    width, height = image.size
    pixels = _blank(width, height)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)

    row_bands = _runs(
        [any(_alpha_top(pixels, width, height, x, y) > .04 for x in range(width)) for y in range(height)]
    )
    if len(row_bands) != expected_rows:
        raise RuntimeError(f"Expected {expected_rows} authored rows in {path.name}, found {row_bands}")

    boxes = {}
    for row, (top, bottom) in enumerate(row_bands):
        columns = _runs(
            [any(_alpha_top(pixels, width, height, x, y) > .04 for y in range(top, bottom)) for x in range(width)]
        )
        if len(columns) != expected_columns:
            raise RuntimeError(
                f"Expected {expected_columns} authored columns in {path.name} row {row}, found {columns}"
            )
        boxes[row] = [
            _bbox(pixels, width, height, (max(0, left - 2), top, min(width, right + 2), bottom))
            for left, right in columns
        ]

    result = pixels, width, height, boxes
    _SOURCE_CACHE[key] = result
    return result


def _scaled_frame(source, source_width, source_height, bounds, frame_size, scale, floor_y):
    frame_width, frame_height = frame_size
    left, top, right, bottom = bounds
    source_width_box, source_height_box = right - left, bottom - top
    target_width = max(1, round(source_width_box * scale))
    target_height = max(1, round(source_height_box * scale))
    destination_x = (frame_width - target_width) // 2
    destination_y = floor_y - target_height
    output = _blank(frame_width, frame_height)
    for target_y in range(target_height):
        source_y = top + min(source_height_box - 1, int(target_y / scale))
        for target_x in range(target_width):
            source_x = left + min(source_width_box - 1, int(target_x / scale))
            rgba = _pixel_top(source, source_width, source_height, source_x, source_y)
            if rgba[3] <= .04:
                continue
            _set_top(output, frame_width, frame_height, destination_x + target_x, destination_y + target_y, rgba)
    return output


def _translate(frame, width, height, dx=0, dy=0):
    output = _blank(width, height)
    for y in range(height):
        destination_y = y + dy
        if destination_y < 0 or destination_y >= height:
            continue
        for x in range(width):
            destination_x = x + dx
            if destination_x < 0 or destination_x >= width:
                continue
            rgba = _pixel_top(frame, width, height, x, y)
            if rgba[3] > .04:
                _set_top(output, width, height, destination_x, destination_y, rgba)
    return output


def _walk_pose(frame, width, height, phase):
    """Create one of six walk poses while preserving the authored identity."""
    left, top, right, bottom = _bbox(frame, width, height, (0, 0, width, height))
    center = (left + right) // 2
    hip = top + round((bottom - top) * .58)
    # left dx/dy, right dx/dy, whole-body bob, upper sway
    poses = (
        (-4, 0, 3, -2, 0, -1),
        (-2, -1, 2, -1, -1, 0),
        (0, -2, 0, 0, -2, 1),
        (3, -2, -4, 0, 0, 1),
        (2, -1, -2, -1, -1, 0),
        (0, 0, 0, -2, -2, -1),
    )
    left_dx, left_dy, right_dx, right_dy, bob, sway = poses[phase % len(poses)]
    output = _blank(width, height)
    # Body first, then independently posed legs so the hip seam remains hidden.
    for y in range(top, min(bottom, hip + 3)):
        for x in range(left, right):
            rgba = _pixel_top(frame, width, height, x, y)
            if rgba[3] <= .04:
                continue
            destination_x, destination_y = x + sway, y + bob
            if 0 <= destination_x < width and 0 <= destination_y < height:
                _set_top(output, width, height, destination_x, destination_y, rgba)
    for y in range(max(top, hip - 2), bottom):
        for x in range(left, right):
            rgba = _pixel_top(frame, width, height, x, y)
            if rgba[3] <= .04:
                continue
            dx, dy = (left_dx, left_dy) if x < center else (right_dx, right_dy)
            destination_x, destination_y = x + dx, y + dy
            if 0 <= destination_x < width and 0 <= destination_y < height:
                _set_top(output, width, height, destination_x, destination_y, rgba)
    return output


def _synthetic_seated(frame, width, height, floor_y):
    """Fallback only for staff/player semantics; customers use authored seated art."""
    output = _blank(width, height)
    cutoff = round(height * .66)
    shift = floor_y - cutoff
    for y in range(cutoff):
        destination_y = y + shift
        if destination_y < 0 or destination_y >= height:
            continue
        for x in range(width):
            rgba = _pixel_top(frame, width, height, x, y)
            if rgba[3] > .04:
                _set_top(output, width, height, x, destination_y, rgba)
    return output


def _animation_frames(poses, animation, frame_count, width, height):
    idle = poses["idle"]
    walk = poses.get("walk", idle)
    action = poses.get("action", walk)
    seated = poses.get("seated") or _synthetic_seated(idle, width, height, 136)

    if animation == "idle":
        authored = [idle, _translate(idle, width, height, 0, -1)]
    elif animation == "walk":
        authored = [_walk_pose(walk, width, height, phase) for phase in range(6)]
    elif animation == "sit-down":
        authored = [idle, seated]
    elif animation in ("seated-idle", "seated-waiting"):
        authored = [seated, _translate(seated, width, height, 0, -1)]
    elif animation == "seated-eating":
        authored = [seated, _translate(seated, width, height, 0, -1), seated, _translate(seated, width, height, 1, 0)]
    elif animation == "stand-up":
        authored = [seated, idle]
    elif animation in ("cook", "use-appliance", "clean"):
        authored = [action, _translate(action, width, height, 0, -1), action, _translate(action, width, height, 1, 0)]
    elif animation in ("carry-plate", "carry-ingredients", "serve"):
        authored = [walk, _translate(walk, width, height, 0, -1)]
    else:
        authored = [idle, _translate(idle, width, height, 0, -1)]
    return [authored[index % len(authored)] for index in range(frame_count)]


def _paths(project_root: Path, definition):
    relative = Path(definition["category"]) / f"{definition['assetId']}.png"
    output = project_root / "assets/pixel/rendered" / relative
    deployed = project_root / "public/assets/pixel/rendered" / relative
    thumbnail = project_root / "assets/pixel/rendered/thumbnails" / f"{definition['assetId']}.png"
    deployed_thumbnail = project_root / "public/assets/pixel/rendered/thumbnails" / f"{definition['assetId']}.png"
    return output, deployed, thumbnail, deployed_thumbnail


def render_authorized_character(project_root: Path, definition):
    layout = definition["referenceLayout"]
    source, source_width, source_height, boxes = _load_source(
        project_root / definition["referenceSource"], layout["rows"], layout["columns"]
    )
    pose_rows = layout["poseRows"]
    column_offset = layout.get("columnOffset", 0)
    direction_map = layout["directionMap"]
    selected_boxes = [
        boxes[row][column_offset + source_column]
        for row in pose_rows.values()
        for source_column in direction_map
    ]
    max_source_width = max(right - left for left, top, right, bottom in selected_boxes)
    max_source_height = max(bottom - top for left, top, right, bottom in selected_boxes)
    max_width, max_height = layout["maxSize"]
    shared_scale = min(max_width / max_source_width, max_height / max_source_height)

    frame_width, frame_height = definition["frameSize"]
    sheet_columns = sum(ANIMATIONS.values())
    sheet = _blank(frame_width * sheet_columns, frame_height * len(DIRECTIONS))
    representative = None
    for runtime_row, source_column in enumerate(direction_map):
        poses = {
            pose: _scaled_frame(
                source, source_width, source_height,
                boxes[source_row][column_offset + source_column],
                (frame_width, frame_height), shared_scale, layout["floorY"],
            )
            for pose, source_row in pose_rows.items()
        }
        if representative is None or runtime_row == 2:
            representative = poses["idle"]
        column = 0
        for animation, frame_count in ANIMATIONS.items():
            for frame in _animation_frames(poses, animation, frame_count, frame_width, frame_height):
                blit(
                    sheet, frame_width * sheet_columns, frame, frame_width, frame_height,
                    column, runtime_row, sheet_columns, len(DIRECTIONS),
                )
                column += 1

    output, deployed, thumbnail, deployed_thumbnail = _paths(project_root, definition)
    save_pixels(output, frame_width * sheet_columns, frame_height * len(DIRECTIONS), sheet)

    representative_box = _bbox(representative, frame_width, frame_height, (0, 0, frame_width, frame_height))
    rep_width = representative_box[2] - representative_box[0]
    rep_height = representative_box[3] - representative_box[1]
    thumb_scale = min(100 / rep_width, 120 / rep_height, 1.0)
    thumb = _scaled_frame(
        representative, frame_width, frame_height, representative_box,
        THUMBNAIL_SIZE, thumb_scale, 124,
    )
    save_pixels(thumbnail, *THUMBNAIL_SIZE, thumb)
    deployed.parent.mkdir(parents=True, exist_ok=True)
    deployed_thumbnail.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(output, deployed)
    shutil.copy2(thumbnail, deployed_thumbnail)
    return output, thumbnail
