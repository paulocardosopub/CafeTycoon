"""Build A8 from the literal approved service-counter mesh plus espresso machine."""
from __future__ import annotations

import os
import shutil
import sys
from array import array
from math import cos, radians, sqrt
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT = Path(__file__).resolve().parents[3]
TOOLS = PROJECT / "tools" / "blender"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from build_assets import write_manifests
from exact_service_counter_base import open_exact_service_counter, validate_exact_service_counter


ASSET_ID = os.environ.get("BISTRO_EXACT_COUNTER_ASSET", "a8_coffee_machine")
CATEGORIES = {
    "a1_stove_industrial": "equipment/stoves",
    "a3_griddle": "equipment/griddles",
    "a4_fryer": "equipment/fryers",
    "a5_kettle": "equipment/kettles",
    "a6_grill": "equipment/grills",
    "a8_coffee_machine": "equipment/coffee-machines",
    "b3_preparation_counter": "equipment/preparation",
    "b4_ingredient_station": "equipment/preparation",
    "b5_industrial_sink": "equipment/sinks",
}
if ASSET_ID not in CATEGORIES:
    raise RuntimeError(f"Unsupported exact-counter appliance: {ASSET_ID}")
CATEGORY = CATEGORIES[ASSET_ID]
BLEND = PROJECT / f"assets/blender/equipment/exact-counters/{ASSET_ID}.blend"
SPRITE = PROJECT / f"assets/pixel/rendered/{CATEGORY}/{ASSET_ID}.png"
PUBLIC_SPRITE = PROJECT / f"public/assets/pixel/rendered/{CATEGORY}/{ASSET_ID}.png"
THUMB = PROJECT / f"assets/pixel/rendered/thumbnails/{ASSET_ID}.png"
PUBLIC_THUMB = PROJECT / f"public/assets/pixel/rendered/thumbnails/{ASSET_ID}.png"
PREVIEW = Path(os.environ["BLENDER_CODEX_PREVIEW_PATH"])
PREVIEW_BLEND = Path(os.environ["BLENDER_CODEX_BLEND_PATH"])
FRAME = 192
TILE_WIDTH = 64
ORTHO_SCALE = FRAME * sqrt(2) / TILE_WIDTH
FLOOR_ANCHOR_Y = 174
FOOTPRINT_CENTER_Y = FLOOR_ANCHOR_Y - TILE_WIDTH // 4
DIRECTIONS = (("ne", 180), ("nw", 270), ("se", 90), ("sw", 0))


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def material(name, color, metallic=0.0, roughness=.72):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return mat


def link_only(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj


def cube(name, location, dimensions, mat, collection, bevel=.02, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Low-poly bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
    obj.data.materials.append(mat)
    link_only(obj, collection)
    obj.parent = parent
    return obj


def cylinder(name, location, radius, depth, mat, collection, vertices=12, rotation=None, parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    link_only(obj, collection)
    obj.parent = parent
    return obj


def add_espresso_machine(collection, root):
    steel = material("Coffee_Steel", (.38, .41, .40), .55, .42)
    steel_dark = material("Coffee_Steel_Dark", (.09, .105, .105), .48, .48)
    chrome = material("Coffee_Chrome", (.73, .75, .70), .82, .30)
    black = material("Coffee_Black", (.025, .020, .018), .15, .52)
    green = material("Coffee_Ready", (.20, .43, .20), .05, .55)
    red = material("Coffee_Heat", (.64, .13, .06), .05, .55)

    # The approved service counter top is at z=1.10. The machine is compact
    # and stays fully inside the same 1x1 footprint.
    cube(f"{ASSET_ID}:espresso-body", (0, .08, 1.38), (.62, .48, .48), steel, collection, .045, root)
    cube(f"{ASSET_ID}:espresso-top", (0, .08, 1.645), (.66, .52, .07), chrome, collection, .025, root)
    cube(f"{ASSET_ID}:espresso-front", (0, -.175, 1.40), (.56, .035, .27), steel_dark, collection, .012, root)
    cube(f"{ASSET_ID}:control-strip", (0, -.198, 1.535), (.50, .025, .065), chrome, collection, .008, root)
    cube(f"{ASSET_ID}:drip-tray", (0, -.20, 1.155), (.48, .34, .055), steel_dark, collection, .014, root)
    for index, x in enumerate((-.18, .18)):
        cylinder(f"{ASSET_ID}:group:{index}", (x, -.215, 1.40), .075, .08, chrome, collection, 12, (radians(90), 0, 0), root)
        cylinder(f"{ASSET_ID}:group-dark:{index}", (x, -.258, 1.40), .050, .025, black, collection, 10, (radians(90), 0, 0), root)
        cube(f"{ASSET_ID}:portafilter:{index}", (x + (-.13 if index == 0 else .13), -.285, 1.38), (.18, .035, .035), steel_dark, collection, .009, root)
        cylinder(f"{ASSET_ID}:spout:{index}", (x, -.27, 1.30), .014, .12, chrome, collection, 8, None, root)
        cylinder(f"{ASSET_ID}:button:{index}", (x, -.222, 1.535), .024, .025, green if index == 0 else red, collection, 10, (radians(90), 0, 0), root)
    cylinder(f"{ASSET_ID}:steam-wand", (.35, -.23, 1.29), .018, .29, chrome, collection, 9, None, root)


def appliance_materials():
    return {
        "steel": material("Counter_Steel", (.38, .41, .40), .55, .42),
        "steel_dark": material("Counter_Steel_Dark", (.09, .105, .105), .48, .48),
        "chrome": material("Counter_Chrome", (.73, .75, .70), .82, .30),
        "black": material("Counter_Black", (.025, .020, .018), .15, .52),
        "wood": material("Counter_Board", (.55, .29, .13), .0, .78),
        "green": material("Counter_Green", (.20, .43, .20), .05, .58),
        "red": material("Counter_Red", (.68, .13, .055), .05, .58),
        "orange": material("Counter_Orange", (.88, .34, .07), .05, .58),
        "water": material("Counter_Water", (.18, .49, .62), .15, .32),
    }


def paint_counter_shell_silver():
    """Repaint the canonical shell without changing any approved geometry."""
    silver = material("Industrial_Cabinet_Silver", (.47, .51, .52), .62, .38)
    silver_dark = material("Industrial_Cabinet_Trim", (.17, .20, .21), .58, .42)
    for name in ("delivery_counter:body", "delivery_counter:door:0", "delivery_counter:door:1"):
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise RuntimeError(f"Missing exact counter part while painting silver: {name}")
        obj.data.materials.clear()
        obj.data.materials.append(silver)
    for name in ("delivery_counter:plinth", "delivery_counter:trim", "delivery_counter:handle:0", "delivery_counter:handle:1"):
        obj = bpy.data.objects.get(name)
        if obj is None:
            raise RuntimeError(f"Missing exact counter part while painting silver: {name}")
        obj.data.materials.clear()
        obj.data.materials.append(silver_dark)


def add_stove(collection, root, mats):
    cube(f"{ASSET_ID}:cooktop", (0, .02, 1.135), (.78, .66, .055), mats["steel_dark"], collection, .012, root)
    # Controls live on the operator side (-Y). The approved cabinet doors
    # remain the primary front marker; no oversized rear guard is needed.
    cube(f"{ASSET_ID}:front-controls", (0, -.355, 1.205), (.76, .070, .16), mats["steel"], collection, .010, root)
    for index, (x, y) in enumerate(((-.22, -.18), (.22, -.18), (-.22, .18), (.22, .18))):
        cylinder(f"{ASSET_ID}:burner:{index}", (x, y, 1.18), .13, .035, mats["black"], collection, 10, None, root)
        cylinder(f"{ASSET_ID}:knob:{index}", (-.27 + index * .18, -.405, 1.205), .034, .030, mats["black"], collection, 10, (radians(90), 0, 0), root)


def add_griddle(collection, root, mats, rails=False):
    cube(f"{ASSET_ID}:plate", (0, 0, 1.15), (.78, .69, .075), mats["steel_dark"], collection, .014, root)
    if rails:
        for index, x in enumerate((-.30, -.20, -.10, 0, .10, .20, .30)):
            cube(f"{ASSET_ID}:rail:{index}", (x, 0, 1.205), (.022, .62, .025), mats["chrome"], collection, .004, root)
    else:
        cube(f"{ASSET_ID}:splash", (0, .34, 1.25), (.80, .055, .22), mats["steel"], collection, .010, root)


def add_fryer(collection, root, mats):
    for index, x in enumerate((-.22, .22)):
        cube(f"{ASSET_ID}:well:{index}", (x, 0, 1.17), (.36, .54, .12), mats["steel_dark"], collection, .014, root)
        cube(f"{ASSET_ID}:basket:{index}", (x, 0, 1.22), (.29, .44, .08), mats["chrome"], collection, .010, root)
        cube(f"{ASSET_ID}:handle:{index}", (x, -.37, 1.36), (.055, .34, .055), mats["black"], collection, .010, root)


def add_kettle(collection, root, mats):
    cylinder(f"{ASSET_ID}:pot", (0, 0, 1.39), .38, .48, mats["steel_dark"], collection, 14, None, root)
    cylinder(f"{ASSET_ID}:rim", (0, 0, 1.65), .405, .06, mats["chrome"], collection, 14, None, root)
    cylinder(f"{ASSET_ID}:soup", (0, 0, 1.68), .34, .025, mats["orange"], collection, 14, None, root)
    cube(f"{ASSET_ID}:handle:L", (-.45, 0, 1.42), (.18, .065, .065), mats["steel_dark"], collection, .012, root)
    cube(f"{ASSET_ID}:handle:R", (.45, 0, 1.42), (.18, .065, .065), mats["steel_dark"], collection, .012, root)


def add_preparation(collection, root, mats, ingredients=False):
    if not ingredients:
        cube(f"{ASSET_ID}:board", (0, -.02, 1.16), (.62, .48, .065), mats["wood"], collection, .015, root)
        for index, (x, mat) in enumerate(((-.18, mats["green"]), (0, mats["red"]), (.18, mats["orange"]))):
            cube(f"{ASSET_ID}:food:{index}", (x, -.02, 1.225), (.11, .11, .07), mat, collection, .012, root)
    else:
        for index, (x, mat) in enumerate(((-.27, mats["green"]), (0, mats["red"]), (.27, mats["orange"]))):
            cube(f"{ASSET_ID}:bin:{index}", (x, 0, 1.18), (.24, .52, .12), mats["steel_dark"], collection, .012, root)
            cube(f"{ASSET_ID}:ingredient:{index}", (x, 0, 1.245), (.18, .42, .05), mat, collection, .010, root)


def add_sink(collection, root, mats):
    # The basin is pulled toward the operator (-Y); faucet and knobs are fixed
    # at the rear (+Y). The cabinet doors remain the unambiguous front marker.
    cube(f"{ASSET_ID}:basin-rim", (0, -.09, 1.15), (.64, .50, .07), mats["steel_dark"], collection, .020, root)
    cube(f"{ASSET_ID}:basin", (0, -.09, 1.175), (.51, .37, .035), mats["water"], collection, .018, root)
    cylinder(f"{ASSET_ID}:tap", (0, .30, 1.43), .035, .39, mats["chrome"], collection, 10, None, root)
    cube(f"{ASSET_ID}:spout", (0, .18, 1.59), (.07, .24, .07), mats["chrome"], collection, .015, root)
    cylinder(f"{ASSET_ID}:nozzle", (0, .055, 1.515), .028, .15, mats["chrome"], collection, 10, None, root)
    for index, x in enumerate((-.17, .17)):
        cylinder(f"{ASSET_ID}:tap-knob:{index}", (x, .315, 1.38), .045, .045, mats["black"], collection, 10, (radians(90), 0, 0), root)


def add_appliance(collection, root):
    if ASSET_ID == "a8_coffee_machine":
        add_espresso_machine(collection, root)
        return
    mats = appliance_materials()
    if ASSET_ID == "a1_stove_industrial": add_stove(collection, root, mats)
    elif ASSET_ID == "a3_griddle": add_griddle(collection, root, mats, False)
    elif ASSET_ID == "a4_fryer": add_fryer(collection, root, mats)
    elif ASSET_ID == "a5_kettle": add_kettle(collection, root, mats)
    elif ASSET_ID == "a6_grill": add_griddle(collection, root, mats, True)
    elif ASSET_ID == "b3_preparation_counter": add_preparation(collection, root, mats, False)
    elif ASSET_ID == "b4_ingredient_station": add_preparation(collection, root, mats, True)
    elif ASSET_ID == "b5_industrial_sink": add_sink(collection, root, mats)


def configure_scene():
    source_collection, root = open_exact_service_counter(PROJECT, ASSET_ID)
    validate_exact_service_counter(source_collection)
    if ASSET_ID in {"a1_stove_industrial", "b5_industrial_sink"}:
        paint_counter_shell_silver()
    add_appliance(source_collection, root)

    scene = bpy.data.scenes.new("Exact_Service_Coffee_Render")
    bpy.context.window.scene = scene
    engine_ids = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engine_ids else "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"

    camera_data = bpy.data.cameras.new("Exact_Service_Coffee_CameraData")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = ORTHO_SCALE
    camera = bpy.data.objects.new("Exact_Service_Coffee_Camera", camera_data)
    scene.collection.objects.link(camera)
    target_z = ((FOOTPRINT_CENTER_Y - FRAME / 2) / (FRAME / ORTHO_SCALE)) / cos(radians(30))
    camera.location = (6, -6, 4.898979486 + target_z)
    aim(camera, (0, 0, target_z))
    scene.camera = camera
    for name, location, energy, size in (("Key", (-4, -6, 8), 1100, 5.0), ("Fill", (5, -2, 5), 600, 4.0), ("Rim", (2, 5, 6), 850, 3.0)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new(name, data)
        scene.collection.objects.link(light)
        light.location = location
        aim(light, (0, 0, 1.0))
    for collection in bpy.data.collections:
        collection.hide_render = collection != source_collection
        collection.hide_viewport = False
    source_collection.hide_render = False
    instance = bpy.data.objects.new(f"RenderInstance:{ASSET_ID}", None)
    instance.instance_type = "COLLECTION"
    instance.instance_collection = source_collection
    scene.collection.objects.link(instance)
    return scene, source_collection, root


def load_pixels(path):
    image = bpy.data.images.load(str(path), check_existing=False)
    pixels = array("f", [0.0]) * (FRAME * FRAME * 4)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    return pixels


def save_pixels(path, width, height, pixels):
    path.parent.mkdir(parents=True, exist_ok=True)
    image = bpy.data.images.new(path.stem, width, height, alpha=True)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def blit(target, pixels, column, row):
    sheet_width = FRAME
    y_offset = FRAME * len(DIRECTIONS) - (row + 1) * FRAME
    for y in range(FRAME):
        source = y * FRAME * 4
        target_index = ((y_offset + y) * sheet_width + column * FRAME) * 4
        target[target_index:target_index + FRAME * 4] = pixels[source:source + FRAME * 4]


def render(scene, collection, root):
    sheet = array("f", [0.0]) * (FRAME * FRAME * len(DIRECTIONS) * 4)
    representative = None
    frame_dir = PREVIEW.parent / "frames"
    frame_dir.mkdir(parents=True, exist_ok=True)
    for row, (direction, rotation) in enumerate(DIRECTIONS):
        root.rotation_euler.z = radians(rotation)
        path = frame_dir / f"{ASSET_ID}_{direction}.png"
        scene.render.resolution_x = FRAME
        scene.render.resolution_y = FRAME
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        pixels = load_pixels(path)
        blit(sheet, pixels, 0, row)
        if direction == "sw":
            representative = array("f", pixels)
    save_pixels(SPRITE, FRAME, FRAME * len(DIRECTIONS), sheet)
    save_pixels(THUMB, FRAME, FRAME, representative)
    PUBLIC_SPRITE.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_THUMB.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SPRITE, PUBLIC_SPRITE)
    shutil.copy2(THUMB, PUBLIC_THUMB)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(THUMB, PREVIEW)


scene, collection, root = configure_scene()
render(scene, collection, root)
BLEND.parent.mkdir(parents=True, exist_ok=True)
scene["coffeeCounterBase"] = "exact approved service counter"
scene["renderVersion"] = "0.0.8-exact-service-counter-3"
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
PREVIEW_BLEND.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(BLEND, PREVIEW_BLEND)
write_manifests(PROJECT)
print(f"RENDERED {ASSET_ID} from exact service-counter base")
