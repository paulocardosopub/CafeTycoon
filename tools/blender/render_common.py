from pathlib import Path
from math import radians, sin
import tempfile
import bpy
from config.pipeline_config import ANIMATIONS, DIRECTIONS, PALETTE, THUMBNAIL_SIZE
from model_utils import collection_objects_recursive
from setup_camera import setup_camera

DIRECTION_ROTATION = {"sw": 0, "se": 90, "ne": 180, "nw": 270}

def show_only_collection(asset_id):
    root = bpy.data.collections.get("BistroAssets")
    if root:
        for collection in root.children: collection.hide_render = collection.name != asset_id
    collection = bpy.data.collections.get(asset_id)
    if not collection: raise RuntimeError(f"Collection not found: {asset_id}")
    collection.hide_render = False; return collection

def snapshot_transforms(collection):
    return {obj.name: (obj.location.copy(), obj.rotation_euler.copy(), obj.hide_render) for obj in collection_objects_recursive(collection)}

def reset_transforms(collection, snapshot):
    for obj in collection_objects_recursive(collection):
        if obj.name in snapshot:
            location, rotation, hidden = snapshot[obj.name]; obj.location = location; obj.rotation_euler = rotation; obj.hide_render = hidden

def pose_character(asset_id, collection, snapshot, animation, phase, direction):
    reset_transforms(collection, snapshot)
    root = bpy.data.objects.get(f"{asset_id}:root"); root.rotation_euler.z = radians(DIRECTION_ROTATION[direction])
    arm_l = bpy.data.objects.get(f"{asset_id}:arm.L"); arm_r = bpy.data.objects.get(f"{asset_id}:arm.R")
    leg_l = bpy.data.objects.get(f"{asset_id}:leg.L"); leg_r = bpy.data.objects.get(f"{asset_id}:leg.R")
    dish = bpy.data.objects.get(f"{asset_id}:carried-dish"); crate = bpy.data.objects.get(f"{asset_id}:carried-crate")
    wave = .28 if phase else -.28
    if animation == "walk": arm_l.rotation_euler.x = wave; arm_r.rotation_euler.x = -wave; leg_l.rotation_euler.x = -wave; leg_r.rotation_euler.x = wave
    elif animation in ("carry-dish", "carry-ingredients"): arm_l.rotation_euler.x = arm_r.rotation_euler.x = radians(-48); (dish if animation == "carry-dish" else crate).hide_render = False
    elif animation in ("work", "cook"): arm_l.rotation_euler.x = radians(-35 - phase * 18); arm_r.rotation_euler.x = radians(-58 + phase * 18)
    elif animation == "serve": arm_l.rotation_euler.x = arm_r.rotation_euler.x = radians(-48); dish.hide_render = False
    elif animation == "clean": arm_l.rotation_euler.x = radians(-68 + phase * 24); arm_r.rotation_euler.x = radians(-20 - phase * 24)
    elif animation in ("sit", "seated", "eat"):
        root.location.z -= .42 if animation != "sit" else .24; leg_l.rotation_euler.x = leg_r.rotation_euler.x = radians(70)
        if animation == "eat": arm_r.rotation_euler.x = radians(-70 + phase * 15); dish.hide_render = False
    elif animation == "idle": root.location.z += .015 * phase
    elif animation == "stand": root.location.z -= .24 * (1 - phase); leg_l.rotation_euler.x = leg_r.rotation_euler.x = radians(70 * (1 - phase))

def quantized_render(width, height, palette=True):
    scene = bpy.context.scene; scene.render.resolution_x = width * 2; scene.render.resolution_y = height * 2; scene.render.resolution_percentage = 100
    with tempfile.TemporaryDirectory(prefix="bistro-blender-") as temp_dir:
        render_path = Path(temp_dir) / "frame.png"; scene.render.filepath = str(render_path)
        bpy.ops.render.render(write_still=True)
        rendered = bpy.data.images.load(str(render_path), check_existing=False)
        source = list(rendered.pixels); source_width, source_height = rendered.size
        bpy.data.images.remove(rendered)
    if source_width < width * 2 or source_height < height * 2 or len(source) < source_width * source_height * 4:
        raise RuntimeError(f"Invalid render buffer: {source_width}x{source_height}, {len(source)} values")
    colors = [value for key, value in PALETTE.items() if key != "outline"]
    output = [0.0] * (width * height * 4)
    for y in range(height):
        for x in range(width):
            source_index = ((y * 2) * source_width + x * 2) * 4; target_index = (y * width + x) * 4
            r, g, b, a = source[source_index:source_index + 4]
            if palette and a > .04:
                nearest = min(colors, key=lambda color: (r-color[0])**2 + (g-color[1])**2 + (b-color[2])**2)
                r, g, b = nearest[:3]
            output[target_index:target_index + 4] = (r, g, b, 0.0 if a < .04 else a)
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

def save_thumbnail(path, collection, snapshot, asset_id, character):
    if character: pose_character(asset_id, collection, snapshot, "idle", 0, "sw")
    else:
        reset_transforms(collection, snapshot); bpy.data.objects[f"{asset_id}:root"].rotation_euler.z = 0
    setup_camera(bpy.context.scene, 3.0 if character else 3.35)
    pixels = quantized_render(*THUMBNAIL_SIZE); save_pixels(path, *THUMBNAIL_SIZE, pixels)

def render_character_sheet(definition, output_path: Path, thumbnail_path: Path):
    asset_id = definition["assetId"]; collection = show_only_collection(asset_id); snapshot = snapshot_transforms(collection); setup_camera(bpy.context.scene, 3.0)
    frame_width, frame_height = definition["frameSize"]; columns = sum(ANIMATIONS.values()); rows = len(DIRECTIONS); sheet_width = frame_width * columns
    sheet = [0.0] * (sheet_width * frame_height * rows * 4)
    for row, direction in enumerate(DIRECTIONS):
        column = 0
        for animation, frame_count in ANIMATIONS.items():
            phases = []
            for phase in range(min(2, frame_count)):
                pose_character(asset_id, collection, snapshot, animation, phase, direction); phases.append(quantized_render(frame_width, frame_height))
            for frame_index in range(frame_count):
                blit(sheet, sheet_width, phases[frame_index % len(phases)], frame_width, frame_height, column, row, columns, rows); column += 1
    save_pixels(output_path, sheet_width, frame_height * rows, sheet); save_thumbnail(thumbnail_path, collection, snapshot, asset_id, True); reset_transforms(collection, snapshot)

def render_world_sheet(definition, output_path: Path, thumbnail_path: Path):
    asset_id = definition["assetId"]; collection = show_only_collection(asset_id); snapshot = snapshot_transforms(collection); frame_width, frame_height = definition["frameSize"]
    states = sum(definition["animations"].values()); columns = states; rows = len(DIRECTIONS); sheet_width = frame_width * columns; sheet = [0.0] * (sheet_width * frame_height * rows * 4)
    setup_camera(bpy.context.scene, 3.4 if definition["footprint"][0] <= 2 else 7.0)
    for row, direction in enumerate(DIRECTIONS):
        root = bpy.data.objects[f"{asset_id}:root"]
        for column in range(columns):
            reset_transforms(collection, snapshot); root.rotation_euler.z = radians(DIRECTION_ROTATION[direction])
            active = column in (1, 2)
            for obj in collection_objects_recursive(collection):
                if "glow" in obj.name: obj.hide_render = not active
                if "burner" in obj.name and active: obj.scale.z = 1.0 + .08 * (column % 2)
            frame = quantized_render(frame_width, frame_height); blit(sheet, sheet_width, frame, frame_width, frame_height, column, row, columns, rows)
    save_pixels(output_path, sheet_width, frame_height * rows, sheet); save_thumbnail(thumbnail_path, collection, snapshot, asset_id, False); reset_transforms(collection, snapshot)
