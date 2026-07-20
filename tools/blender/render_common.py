from pathlib import Path
from array import array
from math import radians, sin, tau
import tempfile
import bpy
from config.pipeline_config import ANIMATIONS, DIRECTIONS, PALETTE, THUMBNAIL_SIZE
from model_utils import collection_objects_recursive
from setup_camera import setup_camera

DIRECTION_ROTATION = {"sw": 0, "se": 90, "ne": 180, "nw": 270}
_PALETTE_CACHE = {}


def _controlled_render_palette():
    """Material hue ramps preserve facial/clothing shading without uncontrolled blur."""
    colors = []
    for base in PALETTE.values():
        for factor in (.70, .84, 1.0, 1.12):
            candidate = tuple(min(1.0, channel * factor) for channel in base[:3]) + (1.0,)
            if candidate not in colors:
                colors.append(candidate)
    return colors


RENDER_PALETTE = _controlled_render_palette()

def show_only_collection(asset_id):
    root = bpy.data.collections.get("BistroAssets")
    if root:
        for collection in root.children: collection.hide_render = collection.name != asset_id
    collection = bpy.data.collections.get(asset_id)
    if not collection: raise RuntimeError(f"Collection not found: {asset_id}")
    collection.hide_render = False; return collection

def snapshot_transforms(collection):
    return {obj.name: (obj.location.copy(), obj.rotation_euler.copy(), obj.scale.copy(), obj.hide_render) for obj in collection_objects_recursive(collection)}

def reset_transforms(collection, snapshot):
    for obj in collection_objects_recursive(collection):
        if obj.name in snapshot:
            location, rotation, scale, hidden = snapshot[obj.name]; obj.location = location; obj.rotation_euler = rotation; obj.scale = scale; obj.hide_render = hidden

def pose_character(asset_id, collection, snapshot, animation, phase, direction, phase_count=2):
    reset_transforms(collection, snapshot)
    root = bpy.data.objects.get(f"{asset_id}:root"); root.rotation_euler.z = radians(DIRECTION_ROTATION[direction])
    arm_l = bpy.data.objects.get(f"{asset_id}:arm.L"); arm_r = bpy.data.objects.get(f"{asset_id}:arm.R")
    leg_l = bpy.data.objects.get(f"{asset_id}:leg.L"); leg_r = bpy.data.objects.get(f"{asset_id}:leg.R")
    elbow_l = bpy.data.objects.get(f"{asset_id}:arm.L:bend"); elbow_r = bpy.data.objects.get(f"{asset_id}:arm.R:bend")
    knee_l = bpy.data.objects.get(f"{asset_id}:leg.L:bend"); knee_r = bpy.data.objects.get(f"{asset_id}:leg.R:bend")
    dish = bpy.data.objects.get(f"{asset_id}:carried-dish"); crate = bpy.data.objects.get(f"{asset_id}:carried-crate")
    cycle = sin(tau * phase / max(1, phase_count)); wave = .52 * cycle
    if animation == "walk":
        arm_l.rotation_euler.x = wave; arm_r.rotation_euler.x = -wave; leg_l.rotation_euler.x = -wave; leg_r.rotation_euler.x = wave
        elbow_l.rotation_euler.x = radians(-10) - .08 * cycle; elbow_r.rotation_euler.x = radians(-10) + .08 * cycle
        knee_l.rotation_euler.x = max(0, .28 * cycle); knee_r.rotation_euler.x = max(0, -.28 * cycle)
        root.location.z += .035 * abs(cycle); root.rotation_euler.y = radians(1.5) * cycle
    elif animation in ("carry-plate", "carry-ingredients"):
        arm_l.rotation_euler.x = arm_r.rotation_euler.x = radians(-38); elbow_l.rotation_euler.x = elbow_r.rotation_euler.x = radians(-58)
        (dish if animation == "carry-plate" else crate).hide_render = False
    elif animation in ("cook", "use-appliance"):
        arm_l.rotation_euler.x = radians(-36) - .18 * cycle; arm_r.rotation_euler.x = radians(-36) + .18 * cycle
        elbow_l.rotation_euler.x = radians(-55) + .12 * cycle; elbow_r.rotation_euler.x = radians(-55) - .12 * cycle
    elif animation == "serve":
        arm_l.rotation_euler.x = arm_r.rotation_euler.x = radians(-38); elbow_l.rotation_euler.x = elbow_r.rotation_euler.x = radians(-58); dish.hide_render = False
    elif animation == "clean": arm_l.rotation_euler.x = radians(-50) + .35 * cycle; arm_r.rotation_euler.x = radians(-42) - .35 * cycle
    elif animation in ("sit-down", "seated-idle", "seated-waiting", "seated-eating"):
        seated_amount = (phase + 1) / max(1, phase_count) if animation == "sit-down" else 1.0
        root.location.z -= .36 * seated_amount
        root.location.y += .055 * seated_amount
        leg_l.rotation_euler.x = leg_r.rotation_euler.x = radians(78 * seated_amount)
        knee_l.rotation_euler.x = knee_r.rotation_euler.x = radians(-84 * seated_amount)
        if animation == "seated-waiting": root.rotation_euler.y = radians(1.2) * cycle
        if animation == "seated-eating":
            arm_r.rotation_euler.x = radians(-38) + .12 * cycle; elbow_r.rotation_euler.x = radians(-64) + .18 * cycle; dish.hide_render = False
    elif animation == "idle": root.location.z += .018 * phase; root.rotation_euler.y = radians(.8) * phase
    elif animation == "stand-up":
        seated_amount = 1 - (phase + 1) / max(1, phase_count)
        root.location.z -= .36 * seated_amount; root.location.y += .055 * seated_amount
        leg_l.rotation_euler.x = leg_r.rotation_euler.x = radians(78 * seated_amount)
        knee_l.rotation_euler.x = knee_r.rotation_euler.x = radians(-84 * seated_amount)
    elif animation == "receive-payment": arm_l.rotation_euler.x = radians(-42); arm_r.rotation_euler.x = radians(-55) + .12 * cycle

def quantized_render(width, height, palette=True):
    scene = bpy.context.scene; scene.render.resolution_x = width; scene.render.resolution_y = height; scene.render.resolution_percentage = 100
    with tempfile.TemporaryDirectory(prefix="bistro-blender-") as temp_dir:
        render_path = Path(temp_dir) / "frame.png"; scene.render.filepath = str(render_path)
        bpy.ops.render.render(write_still=True)
        rendered = bpy.data.images.load(str(render_path), check_existing=False)
        source = list(rendered.pixels); source_width, source_height = rendered.size
        bpy.data.images.remove(rendered)
    if source_width != width or source_height != height or len(source) < source_width * source_height * 4:
        raise RuntimeError(f"Invalid render buffer: {source_width}x{source_height}, {len(source)} values")
    colors = RENDER_PALETTE
    output = array('f', [0.0]) * (width * height * 4)
    for y in range(height):
        for x in range(width):
            source_index = (y * source_width + x) * 4; target_index = (y * width + x) * 4
            r, g, b, a = source[source_index:source_index + 4]
            if palette and a > .04:
                key = (round(r * 31), round(g * 31), round(b * 31))
                nearest = _PALETTE_CACHE.get(key)
                if nearest is None:
                    nearest = min(colors, key=lambda color: (r-color[0])**2 + (g-color[1])**2 + (b-color[2])**2)
                    _PALETTE_CACHE[key] = nearest
                r, g, b = nearest[:3]
            crisp_alpha = 0.0 if a < .06 else .18 if a < .36 else .55 if a < .78 else 1.0
            output[target_index] = r; output[target_index + 1] = g; output[target_index + 2] = b; output[target_index + 3] = crisp_alpha
    return output

def save_pixels(path: Path, width, height, pixels):
    path.parent.mkdir(parents=True, exist_ok=True)
    image = bpy.data.images.new(f"render:{path.stem}", width=width, height=height, alpha=True)
    image.pixels.foreach_set(pixels); image.filepath_raw = str(path); image.file_format = "PNG"; image.save(); bpy.data.images.remove(image)

def blit(target, target_width, frame, frame_width, frame_height, column, row_from_top, columns, rows):
    target_height = frame_height * rows; x_offset = column * frame_width; y_offset = target_height - (row_from_top + 1) * frame_height
    for y in range(frame_height):
        source_start = y * frame_width * 4; target_start = ((y_offset + y) * target_width + x_offset) * 4
        target[target_start:target_start + frame_width * 4] = frame[source_start:source_start + frame_width * 4]

def save_thumbnail(path, collection, snapshot, asset_id, character, world_scale=3.15, world_target_z=1.0):
    if character: pose_character(asset_id, collection, snapshot, "idle", 0, "sw", 2)
    else:
        reset_transforms(collection, snapshot); bpy.data.objects[f"{asset_id}:root"].rotation_euler.z = 0
    setup_camera(bpy.context.scene, 3.0 if character else world_scale, 1.25 if character else world_target_z)
    pixels = quantized_render(*THUMBNAIL_SIZE); save_pixels(path, *THUMBNAIL_SIZE, pixels)

def render_character_sheet(definition, output_path: Path, thumbnail_path: Path):
    asset_id = definition["assetId"]; collection = show_only_collection(asset_id); snapshot = snapshot_transforms(collection); setup_camera(bpy.context.scene, 3.0, 1.25)
    frame_width, frame_height = definition["frameSize"]; columns = sum(ANIMATIONS.values()); rows = len(DIRECTIONS); sheet_width = frame_width * columns
    sheet = array('f', [0.0]) * (sheet_width * frame_height * rows * 4)
    for row, direction in enumerate(DIRECTIONS):
        column = 0
        for animation, frame_count in ANIMATIONS.items():
            phases = []; unique_phases = frame_count if animation in ("walk", "cook", "use-appliance", "seated-eating", "clean") else min(2, frame_count)
            for phase in range(unique_phases):
                pose_character(asset_id, collection, snapshot, animation, phase, direction, unique_phases); phases.append(quantized_render(frame_width, frame_height))
            for frame_index in range(frame_count):
                blit(sheet, sheet_width, phases[frame_index % len(phases)], frame_width, frame_height, column, row, columns, rows); column += 1
    save_pixels(output_path, sheet_width, frame_height * rows, sheet); save_thumbnail(thumbnail_path, collection, snapshot, asset_id, True); reset_transforms(collection, snapshot)

def world_camera(definition):
    asset_id = definition["assetId"]
    if asset_id.startswith("pickup_counter"): return 5.60, .92
    if asset_id == "stove_level_1": return 2.82, 1.08
    if asset_id == "refrigerator_level_1": return 3.18, 1.18
    if definition["footprint"][0] == 2: return 2.95, 1.02
    return 2.72, 1.0

def render_world_sheet(definition, output_path: Path, thumbnail_path: Path):
    asset_id = definition["assetId"]; collection = show_only_collection(asset_id); snapshot = snapshot_transforms(collection); frame_width, frame_height = definition["frameSize"]
    states = sum(definition["animations"].values()); columns = states; rows = len(DIRECTIONS); sheet_width = frame_width * columns; sheet = array('f', [0.0]) * (sheet_width * frame_height * rows * 4)
    camera_scale, camera_target_z = world_camera(definition)
    setup_camera(bpy.context.scene, camera_scale, camera_target_z)
    for row, direction in enumerate(DIRECTIONS):
        root = bpy.data.objects[f"{asset_id}:root"]
        for column in range(columns):
            reset_transforms(collection, snapshot); root.rotation_euler.z = radians(DIRECTION_ROTATION[direction])
            active = column in (1, 2); refrigerator = definition.get("equipmentFamilyId") == "refrigerator"
            for obj in collection_objects_recursive(collection):
                if ":state-active:" in obj.name: obj.hide_render = not active
                if ":state-open:" in obj.name: obj.hide_render = not (refrigerator and active)
                if "door-pivot.L" in obj.name and refrigerator and active: obj.rotation_euler.z = radians(-68 - 7 * (column % 2))
                if "door-pivot.R" in obj.name and refrigerator and active: obj.rotation_euler.z = radians(68 + 7 * (column % 2))
                if ":flame-" in obj.name and active: obj.scale.z = 1.0 + .16 * (column % 2)
                if ":steam" in obj.name and active: obj.location.z += .05 * (column % 2)
            frame = quantized_render(frame_width, frame_height); blit(sheet, sheet_width, frame, frame_width, frame_height, column, row, columns, rows)
    save_pixels(output_path, sheet_width, frame_height * rows, sheet); save_thumbnail(thumbnail_path, collection, snapshot, asset_id, False, camera_scale, camera_target_z); reset_transforms(collection, snapshot)
