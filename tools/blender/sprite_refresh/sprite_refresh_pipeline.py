"""Build and render the isolated Cafe Tycoon sprite-refresh approval package.

All delivered PNGs are produced from editable Blender geometry in this scene.
References are never loaded as textures or composited into a render.
"""

from __future__ import annotations

import json
import math
import os
import shutil
from array import array
from pathlib import Path

import bpy
from mathutils import Vector

from prototype_config import (
    ACTIVE_DIRECTIONS,
    ANIMATION_SPECS,
    CAMERA_AZIMUTH_DEGREES,
    CAMERA_ELEVATION_DEGREES,
    CHARACTER_ORTHO_SCALE,
    COUNTER,
    DEFAULT_BLEND,
    DEFAULT_PREVIEW,
    DIRECTION_ROTATION,
    FAMILY_CHARACTERS,
    FEET_ANCHOR,
    FRAME_SIZE,
    FURNITURE_ASSETS,
    FURNITURE_DIRECTIONS,
    HAIR_COLORS,
    ISO_TILE_PIXELS,
    OUTPUT_ROOT,
    PLAYER_PRESETS,
    PROJECT_ROOT,
    SKIN_TONES,
    SOURCE_ROOT,
    WORLD_FRAME_SIZE,
    WORLD_FLOOR_Y,
    WORLD_ORTHO_SCALE,
)


MATERIALS = {}
ASSET_COLLECTIONS = {}
ASSET_ROOTS = {}
ASSET_RIGS = {}
ASSET_PROXIES = {}
ASSET_KINDS = {}
TECH_COLLECTIONS = {}
SHARED_ARMATURE_DATA = None
COUNTER_MASTER_COLLECTION = None


def move_to_collection(obj, target):
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    target.objects.link(obj)


def collection(name, parent=None, link_scene=False):
    result = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if parent is not None and result.name not in parent.children:
        parent.children.link(result)
    elif link_scene and result.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(result)
    return result


def new_empty(name, target_collection, parent=None):
    obj = bpy.data.objects.new(name, None)
    target_collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def material(name, color, *, roughness=0.48, metallic=0.0, emission=None, emission_strength=0.0):
    if name in MATERIALS:
        return MATERIALS[name]
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = color
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if emission is not None:
        emission_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        if emission_input is not None:
            emission_input.default_value = emission
        strength_input = shader.inputs.get("Emission Strength")
        if strength_input is not None:
            strength_input.default_value = emission_strength
    MATERIALS[name] = result
    return result


def build_materials():
    for name, color in SKIN_TONES.items():
        material(f"Skin_{name}", color, roughness=0.58)
    for name, color in HAIR_COLORS.items():
        material(f"Hair_{name}", color, roughness=0.72)
    palette = {
        "Cream": (0.94, 0.90, 0.78, 1), "White": (0.98, 0.97, 0.91, 1),
        "Green": (0.055, 0.25, 0.13, 1), "GreenLight": (0.14, 0.43, 0.27, 1),
        "Gold": (0.88, 0.55, 0.08, 1), "Wine": (0.34, 0.035, 0.05, 1),
        "Teal": (0.03, 0.33, 0.34, 1), "Red": (0.55, 0.06, 0.045, 1),
        "Blue": (0.055, 0.20, 0.36, 1), "GoldCloth": (0.68, 0.31, 0.04, 1),
        "Denim": (0.08, 0.17, 0.27, 1), "Pants": (0.105, 0.105, 0.12, 1),
        "Leather": (0.20, 0.065, 0.025, 1), "LeatherLight": (0.43, 0.16, 0.045, 1),
        "Eye": (0.025, 0.018, 0.014, 1), "EyeGlint": (1, 0.96, 0.78, 1),
        "Mouth": (0.30, 0.055, 0.035, 1), "SteelDark": (0.10, 0.13, 0.15, 1),
        "Steel": (0.34, 0.39, 0.41, 1), "SteelLight": (0.65, 0.69, 0.68, 1),
        "Chrome": (0.82, 0.84, 0.80, 1), "CounterBody": (0.075, 0.26, 0.17, 1),
        "CounterPanel": (0.11, 0.36, 0.23, 1), "CounterTop": (0.70, 0.55, 0.34, 1),
        "CounterTopLight": (0.86, 0.73, 0.50, 1), "Wood": (0.38, 0.17, 0.07, 1),
        "WoodLight": (0.67, 0.36, 0.14, 1), "Black": (0.018, 0.021, 0.024, 1),
        "Water": (0.10, 0.55, 0.85, 0.92), "Steam": (0.84, 0.91, 0.90, 0.62),
        "Grid": (0.13, 0.38, 0.34, 1), "GridAccent": (0.88, 0.49, 0.10, 1),
        "Ground": (0.78, 0.73, 0.62, 1), "Label": (0.10, 0.20, 0.18, 1),
    }
    for name, color in palette.items():
        metallic = 0.72 if name in {"Steel", "SteelLight", "Chrome"} else 0.0
        roughness = 0.27 if metallic else 0.52
        if name in {"Water", "Steam"}:
            mat = material(name, color, roughness=0.22)
            mat.surface_render_method = "DITHERED"
        else:
            material(name, color, roughness=roughness, metallic=metallic)
    material("Flame", (1.0, 0.18, 0.015, 1), roughness=0.2, emission=(1.0, 0.08, 0.005, 1), emission_strength=7.0)
    material("HotOrange", (1.0, 0.34, 0.025, 1), roughness=0.25, emission=(1.0, 0.12, 0.01, 1), emission_strength=4.0)
    material("IndicatorGreen", (0.12, 0.85, 0.25, 1), roughness=0.2, emission=(0.03, 1.0, 0.08, 1), emission_strength=5.0)


def bind_scene_assets():
    """Rebuild transient Python indexes after opening the editable .blend."""
    global SHARED_ARMATURE_DATA, COUNTER_MASTER_COLLECTION
    MATERIALS.clear()
    MATERIALS.update({item.name: item for item in bpy.data.materials})
    ASSET_COLLECTIONS.clear(); ASSET_ROOTS.clear(); ASSET_RIGS.clear(); ASSET_PROXIES.clear(); ASSET_KINDS.clear()
    for root in (obj for obj in bpy.data.objects if obj.get("assetId") and obj.name.endswith(":root")):
        asset_id = root.get("assetId")
        source = bpy.data.collections.get(f"SRC_{asset_id}")
        proxy = bpy.data.objects.get(f"PROXY_{asset_id}")
        if source is None or proxy is None:
            continue
        ASSET_COLLECTIONS[asset_id] = source
        ASSET_ROOTS[asset_id] = root
        ASSET_PROXIES[asset_id] = proxy
        rig = bpy.data.objects.get(f"{asset_id}:rig")
        if rig is not None:
            ASSET_RIGS[asset_id] = rig
            ASSET_KINDS[asset_id] = "character"
            SHARED_ARMATURE_DATA = rig.data
        else:
            ASSET_KINDS[asset_id] = "furniture"
    COUNTER_MASTER_COLLECTION = bpy.data.collections.get("COUNTER_BASE_MASTER_1x1")
    TECH_COLLECTIONS.clear()
    if bpy.data.collections.get("TECH_COUNTER_ALIGNMENT"):
        TECH_COLLECTIONS["counter"] = bpy.data.collections["TECH_COUNTER_ALIGNMENT"]
    if bpy.data.collections.get("TECH_FURNITURE_SCALE"):
        TECH_COLLECTIONS["scale"] = bpy.data.collections["TECH_FURNITURE_SCALE"]


def assign_material(obj, mat):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.append(mat)


def cube(name, location, dimensions, mat, target_collection, *, bevel=0.035, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Soft square bevel", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.22)
        modifier.segments = 2
    assign_material(obj, mat)
    move_to_collection(obj, target_collection)
    return obj


def cylinder(name, location, radius, depth, mat, target_collection, *, vertices=12, rotation=(0, 0, 0), bevel=0.018):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    if bevel:
        modifier = obj.modifiers.new("Edge bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    assign_material(obj, mat)
    move_to_collection(obj, target_collection)
    return obj


def torus(name, location, major_radius, minor_radius, mat, target_collection, *, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=16, minor_segments=4, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, mat)
    move_to_collection(obj, target_collection)
    return obj


def preserve_parent(obj, parent, *, bone=None):
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    if bone is not None:
        obj.parent_type = "BONE"
        obj.parent_bone = bone
    obj.matrix_world = matrix


def state_object(obj, *states):
    obj["visibleStates"] = list(states)
    return obj


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    scene.render.use_file_extension = True
    scene.render.filter_size = 0.35
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("SpriteRefresh_World")
    scene.world.color = (0.035, 0.045, 0.04)
    scene["prototype"] = "Cafe Tycoon sprite refresh approval"
    scene["sourceIdentity"] = "Original editable Blender geometry; references never rendered into sprites"
    scene["gridContract"] = "64x32 pixels; 1 Blender unit per 1x1 logical cell"
    scene["activeCharacterContract"] = "112x168; feet=(56,158); directions=SW,NW,NE,SE"
    build_materials()
    setup_camera((0, 0, 1.31), CHARACTER_ORTHO_SCALE, FRAME_SIZE, True)
    setup_lighting()


def setup_camera(target, ortho_scale, resolution, transparent=True):
    scene = bpy.context.scene
    data = bpy.data.cameras.get("SpriteRefresh_MasterCamera_Data") or bpy.data.cameras.new("SpriteRefresh_MasterCamera_Data")
    camera = bpy.data.objects.get("SpriteRefresh_MasterCamera") or bpy.data.objects.new("SpriteRefresh_MasterCamera", data)
    if not camera.users_collection:
        scene.collection.objects.link(camera)
    horizontal = 9.0
    azimuth = math.radians(-CAMERA_AZIMUTH_DEGREES)
    elevation = math.radians(CAMERA_ELEVATION_DEGREES)
    camera.location = (
        target[0] + horizontal * math.cos(azimuth),
        target[1] + horizontal * math.sin(azimuth),
        target[2] + horizontal * math.tan(elevation),
    )
    data.type = "ORTHO"
    data.ortho_scale = ortho_scale
    data.shift_x = 0
    data.shift_y = 0
    aim(camera, target)
    camera["projection"] = "orthographic 2:1 isometric equivalent"
    camera["azimuthDegrees"] = CAMERA_AZIMUTH_DEGREES
    camera["elevationDegrees"] = CAMERA_ELEVATION_DEGREES
    camera["tilePixels"] = list(ISO_TILE_PIXELS)
    camera["feetAnchor"] = list(FEET_ANCHOR)
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.film_transparent = transparent
    return camera


def setup_lighting():
    scene = bpy.context.scene
    lights = collection("SPRITE_REFRESH_LIGHTS", link_scene=True)
    for name, location, energy, size, color in (
        ("Key_Warm", (-4.0, -5.5, 8.0), 820, 4.5, (1.0, 0.78, 0.59)),
        ("Fill_Cool", (5.5, -1.0, 5.0), 470, 4.0, (0.58, 0.76, 1.0)),
        ("Rim_Soft", (1.0, 6.0, 7.0), 390, 3.2, (0.73, 1.0, 0.78)),
    ):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        obj.location = location
        lights.objects.link(obj)
        aim(obj, (0, 0, 1.0))
    scene.world.color = (0.055, 0.06, 0.052)


def create_shared_armature_data():
    global SHARED_ARMATURE_DATA
    data = bpy.data.armatures.new("SpriteRefresh_Humanoid_Shared")
    rig = bpy.data.objects.new("_armature_template", data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {
        "root": ((0, 0, 0), (0, 0, 0.18), None),
        "pelvis": ((0, 0, 0.62), (0, 0, 0.86), "root"),
        "torso": ((0, 0, 0.86), (0, 0, 1.48), "pelvis"),
        "head": ((0, 0, 1.48), (0, 0, 2.10), "torso"),
        "thigh.L": ((0.16, 0, 0.67), (0.16, 0, 0.40), "pelvis"),
        "shin.L": ((0.16, 0, 0.40), (0.16, -0.02, 0.10), "thigh.L"),
        "thigh.R": ((-0.16, 0, 0.67), (-0.16, 0, 0.40), "pelvis"),
        "shin.R": ((-0.16, 0, 0.40), (-0.16, -0.02, 0.10), "thigh.R"),
        "upper_arm.L": ((0.35, 0, 1.39), (0.42, -0.015, 1.16), "torso"),
        "forearm.L": ((0.42, -0.015, 1.16), (0.42, -0.11, 0.96), "upper_arm.L"),
        "upper_arm.R": ((-0.35, 0, 1.39), (-0.42, -0.015, 1.16), "torso"),
        "forearm.R": ((-0.42, -0.015, 1.16), (-0.42, -0.11, 0.96), "upper_arm.R"),
    }
    edit = {}
    for name, (head, tail, parent_name) in bones.items():
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        edit[name] = bone
        if parent_name:
            bone.parent = edit[parent_name]
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.scene.collection.objects.unlink(rig)
    bpy.data.objects.remove(rig)
    SHARED_ARMATURE_DATA = data
    return data


def create_source_asset(asset_id, kind):
    source = bpy.data.collections.new(f"SRC_{asset_id}")
    root = new_empty(f"{asset_id}:root", source)
    root["assetId"] = asset_id
    root["pivot"] = [0.0, 0.0, 0.0]
    proxy = bpy.data.objects.new(f"PROXY_{asset_id}", None)
    proxy.instance_type = "COLLECTION"
    proxy.instance_collection = source
    proxy.hide_render = True
    bpy.context.scene.collection.objects.link(proxy)
    ASSET_COLLECTIONS[asset_id] = source
    ASSET_ROOTS[asset_id] = root
    ASSET_PROXIES[asset_id] = proxy
    ASSET_KINDS[asset_id] = kind
    return source, root


def char_part(name, location, dimensions, mat, target_collection, rig, bone, *, bevel=0.035, rotation=(0, 0, 0)):
    obj = cube(name, location, dimensions, mat, target_collection, bevel=bevel, rotation=rotation)
    preserve_parent(obj, rig, bone=bone)
    return obj


def hair_blocks(style, asset_id, hair_mat, target_collection, rig):
    pieces = []
    def block(suffix, loc, dims, rot=(0, 0, 0), bevel=0.035):
        pieces.append(char_part(f"{asset_id}:hair:{suffix}", loc, dims, hair_mat, target_collection, rig, "head", bevel=bevel, rotation=rot))
    block("cap", (0, 0.025, 2.045), (0.60, 0.50, 0.18))
    if style == "short":
        for index, x in enumerate((-0.22, -0.075, 0.075, 0.22)):
            block(f"ridge{index}", (x, -0.18, 2.145 + 0.015 * (1 - abs(x) / .22)), (0.14, 0.22, 0.12), (0, 0.10, -0.10 * x))
        block("sideL", (0.285, 0.01, 1.99), (0.09, 0.38, 0.20))
        block("sideR", (-0.285, 0.01, 1.99), (0.09, 0.38, 0.20))
    elif style == "bun":
        block("crown", (0, 0.02, 2.16), (0.48, 0.42, 0.13))
        block("bun", (0, 0.33, 2.08), (0.34, 0.30, 0.32), bevel=0.06)
        block("sideL", (0.28, 0.01, 1.97), (0.10, 0.38, 0.26))
        block("sideR", (-0.28, 0.01, 1.97), (0.10, 0.38, 0.26))
    elif style == "coily":
        points = [(-.23,-.16,2.13),(-.08,-.20,2.18),(.08,-.20,2.18),(.23,-.16,2.13),(-.26,.0,2.13),(0,.0,2.21),(.26,.0,2.13),(-.2,.17,2.10),(0,.20,2.16),(.2,.17,2.10)]
        for index, point in enumerate(points):
            block(f"coil{index}", point, (.19,.19,.18), bevel=.055)
    elif style == "curls":
        points = [(-.24,-.16,2.13),(-.08,-.2,2.18),(.10,-.2,2.18),(.25,-.12,2.12),(-.29,.03,2.05),(.29,.04,2.05),(-.30,.13,1.91),(.30,.14,1.91),(-.22,.28,1.98),(0,.31,2.10),(.22,.28,1.98)]
        for index, point in enumerate(points):
            block(f"curl{index}", point, (.20,.20,.22), bevel=.06)
    elif style == "wave":
        for index, (x, y, z, rz) in enumerate(((-.22,-.17,2.13,.22),(-.07,-.20,2.18,.12),(.09,-.19,2.18,-.04),(.23,-.13,2.13,-.20),(-.18,.03,2.18,.10),(.02,.04,2.20,-.10),(.21,.05,2.15,-.22))):
            block(f"wave{index}", (x,y,z), (.22,.20,.14), (0,.08,rz), .045)
        block("back", (0, .23, 2.04), (.50,.16,.23))
    return pieces


def outfit_materials(outfit):
    if outfit in {"apron_green", "barista"}:
        return MATERIALS["White"], MATERIALS["Green"], MATERIALS["Gold"]
    if outfit == "attendant":
        return MATERIALS["Cream"], MATERIALS["Wine"], MATERIALS["Gold"]
    mapping = {
        "customer_red": ("Red", "Cream"), "customer_gold": ("GoldCloth", "Denim"),
        "customer_teal": ("Teal", "Cream"), "customer_blue": ("Blue", "Cream"),
    }
    shirt, accent = mapping.get(outfit, ("Cream", "Green"))
    return MATERIALS[shirt], MATERIALS[accent], MATERIALS["Cream"]


def build_character(spec):
    asset_id = spec["id"]
    source, root = create_source_asset(asset_id, "character")
    body_collection = bpy.data.collections.new(f"{asset_id}_BODY")
    head_collection = bpy.data.collections.new(f"{asset_id}_HEAD")
    hair_collection = bpy.data.collections.new(f"{asset_id}_HAIR_{spec['hair']}")
    outfit_collection = bpy.data.collections.new(f"{asset_id}_OUTFIT_{spec['outfit']}")
    accessory_collection = bpy.data.collections.new(f"{asset_id}_ACCESSORIES")
    for child in (body_collection, head_collection, hair_collection, outfit_collection, accessory_collection):
        source.children.link(child)
    rig = bpy.data.objects.new(f"{asset_id}:rig", SHARED_ARMATURE_DATA)
    source.objects.link(rig)
    rig.parent = root
    rig.show_in_front = True
    rig["sharedSkeleton"] = SHARED_ARMATURE_DATA.name
    rig["gameplayHeight"] = 2.20
    rig["feetPivot"] = [0.0, 0.0, 0.0]
    ASSET_RIGS[asset_id] = rig

    profile_width = {"slim": .54, "average": .61, "athletic": .65, "curvy": .66, "broad": .71}.get(spec["body"], .61)
    hip_width = profile_width * (1.02 if spec["presentation"] == "female" else .92)
    head_width = {"square": .58, "oval": .54, "broad": .61, "heart": .56, "long": .53}.get(spec["face"], .56)
    skin = MATERIALS[f"Skin_{spec['skin']}"]
    hair = MATERIALS[f"Hair_{spec['hair_color']}"]
    shirt, accent, trim = outfit_materials(spec["outfit"])

    torso = char_part(f"{asset_id}:torso", (0, 0, 1.18), (profile_width, .38, .58), shirt, body_collection, rig, "torso", bevel=.055)
    char_part(f"{asset_id}:hips", (0, .005, .78), (hip_width, .34, .23), MATERIALS["Pants"], body_collection, rig, "pelvis", bevel=.035)
    for side, x in (("L", .16), ("R", -.16)):
        char_part(f"{asset_id}:leg:{side}:upper", (x, 0, .52), (.24, .28, .32), MATERIALS["Pants"], body_collection, rig, f"thigh.{side}", bevel=.035)
        char_part(f"{asset_id}:leg:{side}:lower", (x, -.005, .24), (.22, .26, .31), MATERIALS["Pants"], body_collection, rig, f"shin.{side}", bevel=.03)
        char_part(f"{asset_id}:shoe:{side}", (x, -.085, .075), (.27, .38, .15), MATERIALS["Leather"], body_collection, rig, f"shin.{side}", bevel=.045)
        char_part(f"{asset_id}:shoe-cap:{side}", (x, -.255, .09), (.25, .13, .11), MATERIALS["LeatherLight"], body_collection, rig, f"shin.{side}", bevel=.025)
    for side, x in (("L", .39), ("R", -.39)):
        char_part(f"{asset_id}:arm:{side}:upper", (x, -.015, 1.27), (.22, .27, .34), shirt, body_collection, rig, f"upper_arm.{side}", bevel=.055)
        char_part(f"{asset_id}:arm:{side}:lower", (x, -.075, 1.055), (.20, .24, .30), skin, body_collection, rig, f"forearm.{side}", bevel=.065)
        char_part(f"{asset_id}:hand:{side}", (x, -.16, .925), (.20, .23, .18), skin, body_collection, rig, f"forearm.{side}", bevel=.07)

    char_part(f"{asset_id}:head", (0, -.005, 1.79), (head_width, .49, .56), skin, head_collection, rig, "head", bevel=.075)
    char_part(f"{asset_id}:ear:L", (.5 * head_width + .025, 0, 1.78), (.09, .13, .16), skin, head_collection, rig, "head", bevel=.04)
    char_part(f"{asset_id}:ear:R", (-.5 * head_width - .025, 0, 1.78), (.09, .13, .16), skin, head_collection, rig, "head", bevel=.04)
    char_part(f"{asset_id}:nose", (0, -.267, 1.735), (.10, .09, .14), skin, head_collection, rig, "head", bevel=.028)
    for side, x in (("L", .135), ("R", -.135)):
        char_part(f"{asset_id}:eye:{side}", (x, -.258, 1.835), (.075, .035, .075), MATERIALS["Eye"], head_collection, rig, "head", bevel=.012)
        char_part(f"{asset_id}:glint:{side}", (x-.012, -.279, 1.855), (.019, .012, .019), MATERIALS["EyeGlint"], head_collection, rig, "head", bevel=.004)
        brow = char_part(f"{asset_id}:brow:{side}", (x, -.275, 1.925), (.15, .035, .035), hair, head_collection, rig, "head", bevel=.008)
        brow.rotation_euler.y = -.08 if side == "L" else .08
    char_part(f"{asset_id}:mouth", (0, -.277, 1.625), (.16, .028, .035), MATERIALS["Mouth"], head_collection, rig, "head", bevel=.009)
    if spec["presentation"] == "male" and spec["face"] in {"square", "broad", "long"}:
        char_part(f"{asset_id}:beard:chin", (0, -.258, 1.58), (head_width*.68, .045, .13), hair, head_collection, rig, "head", bevel=.03)
        char_part(f"{asset_id}:beard:L", (.5*head_width-.035, -.245, 1.68), (.075,.06,.22), hair, head_collection, rig, "head", bevel=.025)
        char_part(f"{asset_id}:beard:R", (-.5*head_width+.035, -.245, 1.68), (.075,.06,.22), hair, head_collection, rig, "head", bevel=.025)
        char_part(f"{asset_id}:moustache", (0, -.283, 1.675), (.19,.03,.04), hair, head_collection, rig, "head", bevel=.01)
    hair_blocks(spec["hair"], asset_id, hair, hair_collection, rig)

    if spec["outfit"] in {"apron_green", "barista", "attendant"}:
        apron_height = .50 if spec["outfit"] != "attendant" else .34
        apron_z = 1.08 if spec["outfit"] != "attendant" else .98
        apron = char_part(f"{asset_id}:apron", (0, -.218, apron_z), (profile_width*.88, .055, apron_height), accent, outfit_collection, rig, "torso", bevel=.03)
        char_part(f"{asset_id}:apron-trim-top", (0, -.251, apron_z+apron_height*.46), (profile_width*.82,.025,.025), trim, outfit_collection, rig, "torso", bevel=.005)
        for side, x in (("L", profile_width*.40), ("R", -profile_width*.40)):
            char_part(f"{asset_id}:apron-trim:{side}", (x, -.251, apron_z), (.025,.025,apron_height*.88), trim, outfit_collection, rig, "torso", bevel=.005)
        char_part(f"{asset_id}:apron-pocket", (0, -.255, apron_z-.07), (profile_width*.40,.025,.16), MATERIALS["GreenLight"] if spec["outfit"] != "attendant" else MATERIALS["Wine"], outfit_collection, rig, "torso", bevel=.018)
        char_part(f"{asset_id}:bow:L", (.07,-.23,1.47), (.14,.06,.09), accent, outfit_collection, rig, "torso", bevel=.025, rotation=(0,0,.18))
        char_part(f"{asset_id}:bow:R", (-.07,-.23,1.47), (.14,.06,.09), accent, outfit_collection, rig, "torso", bevel=.025, rotation=(0,0,-.18))
        char_part(f"{asset_id}:bow:center", (0,-.265,1.47), (.07,.05,.07), trim, outfit_collection, rig, "torso", bevel=.018)
    else:
        char_part(f"{asset_id}:jacket-front", (0,-.215,1.17), (profile_width*.88,.055,.49), accent, outfit_collection, rig, "torso", bevel=.03)
        char_part(f"{asset_id}:collar:L", (.10,-.255,1.42), (.15,.04,.19), shirt, outfit_collection, rig, "torso", bevel=.02, rotation=(0,.20,.16))
        char_part(f"{asset_id}:collar:R", (-.10,-.255,1.42), (.15,.04,.19), shirt, outfit_collection, rig, "torso", bevel=.02, rotation=(0,-.20,-.16))

    tray = cylinder(f"{asset_id}:tray", (0, -.58, 1.13), .42, .055, MATERIALS["SteelDark"], accessory_collection, vertices=20, rotation=(0, 0, 0), bevel=.015)
    tray.scale.y = .68
    bpy.context.view_layer.update()
    preserve_parent(tray, rig, bone="torso")
    tray["component"] = "empty_tray"
    tray["surfaceClear"] = True
    tray.hide_render = True
    utensil = cylinder(f"{asset_id}:utensil", (-.36, -.35, 1.06), .025, .62, MATERIALS["Chrome"], accessory_collection, vertices=8, rotation=(math.radians(72), 0, math.radians(8)), bevel=.008)
    preserve_parent(utensil, rig, bone="forearm.R")
    utensil["component"] = "cook_utensil"
    utensil.hide_render = True

    root["presentation"] = spec["presentation"]
    root["skinComponent"] = f"Skin_{spec['skin']}"
    root["hairComponent"] = hair_collection.name
    root["hairMaterial"] = f"Hair_{spec['hair_color']}"
    root["faceProfile"] = spec["face"]
    root["bodyProfile"] = spec["body"]
    root["outfitComponent"] = outfit_collection.name
    root["gameplayHeight"] = 2.20
    root["spriteFrame"] = list(FRAME_SIZE)
    root["feetAnchor"] = list(FEET_ANCHOR)
    root["directions"] = list(ACTIVE_DIRECTIONS)
    return root


def build_counter_master():
    global COUNTER_MASTER_COLLECTION
    master = bpy.data.collections.new("COUNTER_BASE_MASTER_1x1")
    root = new_empty("counter_master:origin", master)
    root["width"] = COUNTER["width"]
    root["depth"] = COUNTER["depth"]
    root["counterHeight"] = COUNTER["height"]
    root["plinthHeight"] = COUNTER["plinth_height"]
    root["tolerance"] = COUNTER["tolerance"]
    cube("counter_master:plinth", (0, 0, .06), (.92,.92,.12), MATERIALS["SteelDark"], master, bevel=.025)
    cube("counter_master:body", (0, .01, .53), (.94,.90,.82), MATERIALS["CounterBody"], master, bevel=.055)
    cube("counter_master:front-panel", (0, -.452, .56), (.76,.035,.56), MATERIALS["CounterPanel"], master, bevel=.025)
    cube("counter_master:top", (0, 0, 1.05), (1.0,1.0,.10), MATERIALS["CounterTop"], master, bevel=.035)
    cube("counter_master:top-inlay", (0,-.03,1.105), (.82,.78,.025), MATERIALS["CounterTopLight"], master, bevel=.012)
    for side, x in (("L", .27),("R",-.27)):
        cube(f"counter_master:door:{side}", (x,-.474,.57), (.38,.025,.50), MATERIALS["CounterBody"], master, bevel=.022)
        cube(f"counter_master:handle:{side}", (x,-.495,.67), (.16,.025,.035), MATERIALS["Gold"], master, bevel=.008)
    COUNTER_MASTER_COLLECTION = master
    return master


def counter_asset(asset_id, asset_type):
    source, root = create_source_asset(asset_id, "furniture")
    instance = new_empty(f"{asset_id}:counter-base-instance", source, parent=root)
    instance.instance_type = "COLLECTION"
    instance.instance_collection = COUNTER_MASTER_COLLECTION
    instance["counterBaseAssetId"] = "COUNTER_BASE_MASTER_1x1"
    instance["structuralDimensions"] = [COUNTER["width"], COUNTER["depth"], COUNTER["height"]]
    root["counterBaseAssetId"] = "COUNTER_BASE_MASTER_1x1"
    root["footprint"] = [1,1]
    root["structuralDimensions"] = [COUNTER["width"], COUNTER["depth"], COUNTER["height"]]
    root["pivot"] = list(COUNTER["pivot"])
    root["frontDirection"] = "sw"
    if asset_type == "counter_service":
        root["surfaceClear"] = True
    elif asset_type == "counter_stove":
        cube(f"{asset_id}:control", (0,-.48,1.13), (.58,.08,.14), MATERIALS["Steel"], source, bevel=.025)
        for row, y in enumerate((-.23,.20)):
            for col, x in enumerate((-.23,.23)):
                torus(f"{asset_id}:burner:{row}:{col}", (x,y,1.125), .115,.018,MATERIALS["Black"],source)
                flame = torus(f"{asset_id}:flame:{row}:{col}", (x,y,1.145), .075,.017,MATERIALS["Flame"],source)
                state_object(flame, "on")
        for index, x in enumerate((-.22,0,.22)):
            cylinder(f"{asset_id}:knob:{index}",(x,-.53,1.13),.035,.045,MATERIALS["Black"],source,vertices=10,rotation=(math.radians(90),0,0),bevel=.008)
    elif asset_type == "counter_coffee":
        cube(f"{asset_id}:machine", (0,.08,1.43), (.68,.48,.58), MATERIALS["Steel"], source, bevel=.055)
        cube(f"{asset_id}:machine-front", (0,-.175,1.45), (.52,.055,.38), MATERIALS["SteelDark"], source, bevel=.025)
        for x in (-.18,.18):
            cylinder(f"{asset_id}:group:{x}",(x,-.23,1.45),.055,.08,MATERIALS["Chrome"],source,vertices=12,rotation=(math.radians(90),0,0),bevel=.01)
            cube(f"{asset_id}:portafilter:{x}",(x+(.10 if x>0 else -.10),-.30,1.43),(.22,.035,.035),MATERIALS["Black"],source,bevel=.01,rotation=(0,0,.12 if x>0 else -.12))
        cube(f"{asset_id}:display", (0,-.212,1.63), (.25,.025,.10), MATERIALS["IndicatorGreen"], source, bevel=.012)
        for index, z in enumerate((1.72,1.84,1.96)):
            puff = cube(f"{asset_id}:steam:{index}", (.22,-.18,z), (.10+index*.025,.08,.10), MATERIALS["Steam"], source, bevel=.045)
            state_object(puff, "active_1", "active_2")
            puff.location.x += .03 * index
        blink = cube(f"{asset_id}:steam-blink", (-.22,-.18,1.77), (.11,.08,.12), MATERIALS["Steam"], source, bevel=.05)
        state_object(blink,"active_2")
    elif asset_type == "counter_sink":
        cube(f"{asset_id}:basin", (0,-.02,1.13), (.58,.50,.07), MATERIALS["SteelDark"], source, bevel=.05)
        cylinder(f"{asset_id}:faucet-stem",(0,.25,1.38),.035,.48,MATERIALS["Chrome"],source,vertices=10,bevel=.01)
        cube(f"{asset_id}:faucet-neck",(0,.13,1.59),(.07,.28,.07),MATERIALS["Chrome"],source,bevel=.025)
        water = cylinder(f"{asset_id}:water",(0,-.01,1.39),.045,.42,MATERIALS["Water"],source,vertices=10,bevel=.007)
        state_object(water,"active")
        splash = torus(f"{asset_id}:splash", (0,-.02,1.205), .16,.025,MATERIALS["Water"],source)
        state_object(splash,"active")
        indicator = cube(f"{asset_id}:indicator",(.31,-.49,1.20),(.10,.035,.10),MATERIALS["IndicatorGreen"],source,bevel=.018)
        state_object(indicator,"active")
    elif asset_type == "counter_fryer":
        cube(f"{asset_id}:well", (0,.02,1.15), (.55,.54,.16), MATERIALS["SteelDark"], source, bevel=.035)
        cube(f"{asset_id}:basket", (0,-.01,1.23), (.43,.41,.12), MATERIALS["Steel"], source, bevel=.025)
        cube(f"{asset_id}:handle", (0,-.39,1.27), (.12,.38,.08), MATERIALS["Black"], source, bevel=.025)
        glow = cube(f"{asset_id}:hot", (0,-.025,1.315), (.48,.43,.045), MATERIALS["HotOrange"], source, bevel=.018)
        state_object(glow,"on")
        light = cube(f"{asset_id}:indicator",(.31,-.49,1.22),(.11,.035,.11),MATERIALS["IndicatorGreen"],source,bevel=.018)
        state_object(light,"on")
        for index, z in enumerate((1.47, 1.62)):
            steam = cube(f"{asset_id}:steam:{index}",(.12 + index*.06,-.02,z),(.11 + index*.025,.09,.12),MATERIALS["Steam"],source,bevel=.045)
            state_object(steam,"on")
    return root


def build_table(asset_id):
    source, root = create_source_asset(asset_id, "furniture")
    root["footprint"] = [1,1]
    cube(f"{asset_id}:top",(0,0,.74),(.84,.84,.13),MATERIALS["WoodLight"],source,bevel=.055)
    cube(f"{asset_id}:inlay",(0,0,.815),(.66,.66,.025),MATERIALS["CounterTopLight"],source,bevel=.018)
    for x in (-.30,.30):
        for y in (-.30,.30):
            cube(f"{asset_id}:leg:{x}:{y}",(x,y,.37),(.13,.13,.69),MATERIALS["Wood"],source,bevel=.035)
    return root


def build_chair(asset_id):
    source, root = create_source_asset(asset_id, "furniture")
    root["footprint"] = [1,1]
    cube(f"{asset_id}:seat",(0,0,.48),(.52,.48,.13),MATERIALS["WoodLight"],source,bevel=.045)
    cube(f"{asset_id}:back",(0,.20,.82),(.52,.12,.62),MATERIALS["Green"],source,bevel=.055)
    cube(f"{asset_id}:back-inlay",(0,.13,.84),(.38,.035,.40),MATERIALS["GreenLight"],source,bevel=.028)
    for x in (-.20,.20):
        for y in (-.16,.16):
            cube(f"{asset_id}:leg:{x}:{y}",(x,y,.23),(.09,.09,.44),MATERIALS["Wood"],source,bevel=.025)
    return root


def build_fridge(asset_id):
    source, root = create_source_asset(asset_id, "furniture")
    root["footprint"] = [1,1]
    cube(f"{asset_id}:body",(0,0,1.10),(.92,.88,2.20),MATERIALS["Steel"],source,bevel=.075)
    cube(f"{asset_id}:left-door",(.225,-.452,1.16),(.42,.055,1.86),MATERIALS["SteelLight"],source,bevel=.045)
    cube(f"{asset_id}:right-door",(-.225,-.452,1.16),(.42,.055,1.86),MATERIALS["SteelLight"],source,bevel=.045)
    cube(f"{asset_id}:handleL",(.08,-.50,1.20),(.055,.045,.62),MATERIALS["SteelDark"],source,bevel=.015)
    cube(f"{asset_id}:handleR",(-.08,-.50,1.20),(.055,.045,.62),MATERIALS["SteelDark"],source,bevel=.015)
    cube(f"{asset_id}:display",(0,-.49,1.83),(.26,.025,.12),MATERIALS["IndicatorGreen"],source,bevel=.018)
    cube(f"{asset_id}:plinth",(0,0,.07),(.84,.80,.14),MATERIALS["SteelDark"],source,bevel=.025)
    return root


def build_furniture():
    build_counter_master()
    for definition in FURNITURE_ASSETS:
        kind = definition["type"]
        if kind == "table": build_table(definition["id"])
        elif kind == "chair": build_chair(definition["id"])
        elif kind == "fridge": build_fridge(definition["id"])
        else: counter_asset(definition["id"], kind)


def build_characters():
    create_shared_armature_data()
    for spec in (*PLAYER_PRESETS, *FAMILY_CHARACTERS):
        build_character(spec)


def collection_objects_recursive(source):
    objects = list(source.objects)
    for child in source.children:
        objects.extend(collection_objects_recursive(child))
    return objects


def reset_pose(asset_id):
    rig = ASSET_RIGS[asset_id]
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (0,0,0)
        bone.location = (0,0,0)
        bone.scale = (1,1,1)
    ASSET_ROOTS[asset_id].location = (0,0,0)
    for obj in collection_objects_recursive(ASSET_COLLECTIONS[asset_id]):
        if obj.get("component") in {"empty_tray", "cook_utensil"}:
            obj.hide_render = True


def walk_phase(frame):
    return ((1.0, -1.0, 0.0, 0.0), (0.0, 0.0, 1.0, -1.0), (-1.0, 1.0, 0.0, 0.0), (0.0, 0.0, -1.0, 1.0))[frame % 4]


def pose_character(asset_id, animation="idle", frame=0):
    reset_pose(asset_id)
    rig = ASSET_RIGS[asset_id]
    root = ASSET_ROOTS[asset_id]
    if animation in {"walk", "walk_tray"}:
        left, right, bend_left, bend_right = walk_phase(frame)
        rig.pose.bones["thigh.L"].rotation_euler.x = math.radians(30*left)
        rig.pose.bones["thigh.R"].rotation_euler.x = math.radians(30*right)
        rig.pose.bones["shin.L"].rotation_euler.x = math.radians(28*max(0,bend_left))
        rig.pose.bones["shin.R"].rotation_euler.x = math.radians(28*max(0,bend_right))
        root.location.z = .035 if frame % 2 else 0
        if animation == "walk":
            rig.pose.bones["upper_arm.L"].rotation_euler.x = math.radians(-22*left)
            rig.pose.bones["upper_arm.R"].rotation_euler.x = math.radians(-22*right)
            rig.pose.bones["forearm.L"].rotation_euler.x = math.radians(-8)
            rig.pose.bones["forearm.R"].rotation_euler.x = math.radians(-8)
        else:
            rig.pose.bones["upper_arm.L"].rotation_euler.x = math.radians(-50)
            rig.pose.bones["upper_arm.R"].rotation_euler.x = math.radians(-50)
            rig.pose.bones["forearm.L"].rotation_euler.x = math.radians(-62)
            rig.pose.bones["forearm.R"].rotation_euler.x = math.radians(-62)
            for obj in collection_objects_recursive(ASSET_COLLECTIONS[asset_id]):
                if obj.get("component") == "empty_tray": obj.hide_render = False
    elif animation == "cook":
        arm_phases = ((-34,-56,-42,-68),(-50,-38,-64,-48),(-38,-52,-48,-66),(-22,-62,-38,-72))[frame%4]
        rig.pose.bones["upper_arm.L"].rotation_euler.x = math.radians(arm_phases[0])
        rig.pose.bones["upper_arm.R"].rotation_euler.x = math.radians(arm_phases[1])
        rig.pose.bones["forearm.L"].rotation_euler.x = math.radians(arm_phases[2])
        rig.pose.bones["forearm.R"].rotation_euler.x = math.radians(arm_phases[3])
        rig.pose.bones["forearm.R"].rotation_euler.z = math.radians((-12,8,15,-8)[frame%4])
        for obj in collection_objects_recursive(ASSET_COLLECTIONS[asset_id]):
            if obj.get("component") == "cook_utensil": obj.hide_render = False
    bpy.context.view_layer.update()


def build_rig_actions():
    asset_id = PLAYER_PRESETS[0]["id"]
    rig = ASSET_RIGS[asset_id]
    for animation in ANIMATION_SPECS:
        action = bpy.data.actions.new(f"APPROVAL_{animation.upper()}_4")
        # Keep approval actions in the source file even when no NLA track uses them.
        action.use_fake_user = True
        rig.animation_data_create()
        try:
            rig.animation_data.action = action
            for frame in range(4):
                pose_character(asset_id, animation, frame)
                for bone in rig.pose.bones:
                    bone.keyframe_insert("rotation_euler", frame=frame+1, group=bone.name)
                    bone.keyframe_insert("location", frame=frame+1, group=bone.name)
            # Blender 5 stores curves inside layered action channel bags.
            for layer in action.layers:
                for strip in layer.strips:
                    for channelbag in strip.channelbags:
                        for fcurve in channelbag.fcurves:
                            for point in fcurve.keyframe_points:
                                point.interpolation = "BEZIER"
            action["loopFrames"] = 4
            action["recordedFrames"] = [1, 2, 3, 4]
            action["rootBobZ"] = [0.0, 0.035, 0.0, 0.035] if animation in {"walk", "walk_tray"} else [0.0] * 4
            action["approvalOnly"] = True
        except Exception as exc:
            action["creationWarning"] = str(exc)
        finally:
            rig.animation_data.action = None
    pose_character(asset_id, "idle", 0)


def set_state(asset_id, state):
    source = ASSET_COLLECTIONS[asset_id]
    for obj in collection_objects_recursive(source):
        states = obj.get("visibleStates")
        if states:
            obj.hide_render = state not in states


def hide_all_assets():
    for proxy in ASSET_PROXIES.values():
        proxy.hide_render = True


def render_png(path, resolution=None):
    scene = bpy.context.scene
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if resolution:
        scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    if not path.exists() or path.stat().st_size == 0:
        raise RuntimeError(f"Blender did not create {path}")


def render_asset(asset_id, path, direction, *, state="idle", animation="idle", frame=0):
    hide_all_assets()
    for tech in TECH_COLLECTIONS.values(): tech.hide_render = True
    proxy = ASSET_PROXIES[asset_id]
    proxy.hide_render = False
    proxy.location = (0,0,0)
    proxy.rotation_euler = (0,0,0)
    root = ASSET_ROOTS[asset_id]
    root.rotation_euler = (0,0,math.radians(DIRECTION_ROTATION[direction]))
    if ASSET_KINDS[asset_id] == "character":
        pose_character(asset_id, animation, frame)
        setup_camera((0,0,1.31), CHARACTER_ORTHO_SCALE, FRAME_SIZE, True)
        resolution = FRAME_SIZE
    else:
        set_state(asset_id, state)
        setup_camera((0,0,1.74), WORLD_ORTHO_SCALE, WORLD_FRAME_SIZE, True)
        resolution = WORLD_FRAME_SIZE
    render_png(path, resolution)
    proxy.hide_render = True


def load_pixels(path):
    image = bpy.data.images.load(str(path), check_existing=False)
    pixels = array('f', [0.0]) * (image.size[0] * image.size[1] * 4)
    image.pixels.foreach_get(pixels)
    size = tuple(image.size)
    bpy.data.images.remove(image)
    return size[0], size[1], pixels


def save_pixels(path, width, height, pixels):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    image = bpy.data.images.new(f"generated:{path.stem}", width=width, height=height, alpha=True)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def blank_pixels(width, height, color=(0,0,0,0)):
    return array('f', color) * (width * height)


def blit_alpha(target, target_w, target_h, source, source_w, source_h, x0, y0, scale=1):
    for sy in range(source_h):
        for sx in range(source_w):
            s = (sy*source_w+sx)*4
            alpha = source[s+3]
            if alpha <= .001: continue
            for oy in range(scale):
                ty=y0+sy*scale+oy
                if ty<0 or ty>=target_h: continue
                for ox in range(scale):
                    tx=x0+sx*scale+ox
                    if tx<0 or tx>=target_w: continue
                    t=(ty*target_w+tx)*4
                    inv=1-alpha
                    target[t]=source[s]*alpha+target[t]*inv
                    target[t+1]=source[s+1]*alpha+target[t+1]*inv
                    target[t+2]=source[s+2]*alpha+target[t+2]*inv
                    target[t+3]=alpha+target[t+3]*inv


def crop_transparent_pixels(item, padding=5):
    width,height,pixels=item
    opaque=[]
    for y in range(height):
        for x in range(width):
            if pixels[(y*width+x)*4+3]>.03:
                opaque.append((x,y))
    if not opaque:
        return item
    min_x=max(0,min(x for x,_ in opaque)-padding); max_x=min(width-1,max(x for x,_ in opaque)+padding)
    min_y=max(0,min(y for _,y in opaque)-padding); max_y=min(height-1,max(y for _,y in opaque)+padding)
    new_w=max_x-min_x+1; new_h=max_y-min_y+1
    result=blank_pixels(new_w,new_h)
    for y in range(new_h):
        source_start=((min_y+y)*width+min_x)*4
        target_start=y*new_w*4
        result[target_start:target_start+new_w*4]=pixels[source_start:source_start+new_w*4]
    return new_w,new_h,result


def compose_board(paths, output, *, columns, scale, background=(0.92,.89,.80,1), margin=28, gap=18, crop=False):
    loaded=[load_pixels(path) for path in paths]
    if crop:
        loaded=[crop_transparent_pixels(item) for item in loaded]
    cell_w=max(item[0] for item in loaded)*scale
    cell_h=max(item[1] for item in loaded)*scale
    rows=math.ceil(len(loaded)/columns)
    width=margin*2+columns*cell_w+(columns-1)*gap
    height=margin*2+rows*cell_h+(rows-1)*gap
    target=blank_pixels(width,height,background)
    for index,(w,h,pixels) in enumerate(loaded):
        col=index%columns; row_from_top=index//columns
        x=margin+col*(cell_w+gap)+(cell_w-w*scale)//2
        y=height-margin-(row_from_top+1)*cell_h-row_from_top*gap+(cell_h-h*scale)//2
        blit_alpha(target,width,height,pixels,w,h,x,y,scale)
    save_pixels(output,width,height,target)


def compose_sheet(frame_paths, output):
    fw,fh=FRAME_SIZE
    sheet=blank_pixels(fw*4,fh*4)
    for row,direction in enumerate(ACTIVE_DIRECTIONS):
        for col in range(4):
            w,h,pixels=load_pixels(frame_paths[(direction,col)])
            x=col*fw; y=(3-row)*fh
            blit_alpha(sheet,fw*4,fh*4,pixels,w,h,x,y,1)
    save_pixels(output,fw*4,fh*4,sheet)


def build_grid(target_collection, x_min, x_max, y_min, y_max):
    ground=cube(f"{target_collection.name}:ground",((x_min+x_max)/2,(y_min+y_max)/2,-.045),(x_max-x_min,y_max-y_min,.08),MATERIALS["Ground"],target_collection,bevel=.0)
    ground["technicalOnly"] = True
    for x in range(math.floor(x_min),math.ceil(x_max)+1):
        curve_data=bpy.data.curves.new(f"grid-x-{x}","CURVE"); curve_data.dimensions="3D"; curve_data.bevel_depth=.008; curve_data.bevel_resolution=0
        spline=curve_data.splines.new("POLY"); spline.points.add(1); spline.points[0].co=(x,y_min,.003,1); spline.points[1].co=(x,y_max,.003,1)
        obj=bpy.data.objects.new(f"grid-x-{x}",curve_data); target_collection.objects.link(obj); assign_material(obj,MATERIALS["Grid"])
    for y in range(math.floor(y_min),math.ceil(y_max)+1):
        curve_data=bpy.data.curves.new(f"grid-y-{y}","CURVE"); curve_data.dimensions="3D"; curve_data.bevel_depth=.008; curve_data.bevel_resolution=0
        spline=curve_data.splines.new("POLY"); spline.points.add(1); spline.points[0].co=(x_min,y,.003,1); spline.points[1].co=(x_max,y,.003,1)
        obj=bpy.data.objects.new(f"grid-y-{y}",curve_data); target_collection.objects.link(obj); assign_material(obj,MATERIALS["Grid"])


def instance_asset(asset_id, name, target_collection, location, rotation_degrees=0):
    obj=new_empty(name,target_collection)
    obj.instance_type="COLLECTION"; obj.instance_collection=ASSET_COLLECTIONS[asset_id]
    obj.location=location; obj.rotation_euler.z=math.radians(rotation_degrees)
    obj["assetId"] = asset_id
    return obj


def label_text(body, location, target_collection, size=.16):
    data=bpy.data.curves.new(f"label:{body}","FONT"); data.body=body; data.align_x="CENTER"; data.align_y="CENTER"; data.size=size; data.extrude=.006; data.bevel_depth=.003
    obj=bpy.data.objects.new(f"label:{body}",data); target_collection.objects.link(obj); obj.location=location; assign_material(obj,MATERIALS["Label"])
    obj.rotation_euler=bpy.data.objects["SpriteRefresh_MasterCamera"].rotation_euler
    return obj


def build_technical_scenes():
    root=collection("TECHNICAL_APPROVAL_SCENES",link_scene=True)
    counter=bpy.data.collections.new("TECH_COUNTER_ALIGNMENT"); root.children.link(counter); counter.hide_render=True
    build_grid(counter,-.5,4.5,-.5,4.5)
    ids=["counter_service","counter_stove","counter_coffee","counter_sink","counter_fryer"]
    for index,asset_id in enumerate(ids):
        instance_asset(asset_id,f"counter-row-a:{asset_id}",counter,(index,0,0),0)
        instance_asset(asset_id,f"counter-row-b:{asset_id}",counter,(index,3,0),90)
    TECH_COLLECTIONS["counter"] = counter

    scale=bpy.data.collections.new("TECH_FURNITURE_SCALE"); root.children.link(scale); scale.hide_render=True
    build_grid(scale,-.5,6.5,-.5,3.5)
    instance_asset("dining_table_basic","scale:table",scale,(1,1,0),0)
    instance_asset("dining_chair_basic","scale:chair-a",scale,(1,0,0),180)
    instance_asset("dining_chair_basic","scale:chair-b",scale,(1,2,0),0)
    instance_asset("industrial_fridge","scale:fridge",scale,(3,1,0),0)
    instance_asset("counter_service","scale:counter",scale,(4,1,0),0)
    instance_asset(PLAYER_PRESETS[0]["id"],"scale:character",scale,(5,1,0),0)
    TECH_COLLECTIONS["scale"] = scale


def orient_technical_labels(target_collection, labels):
    camera=bpy.context.scene.camera
    for body,location,size in labels:
        obj=label_text(body,location,target_collection,size)
        obj.rotation_euler=camera.rotation_euler


def clear_technical_labels(target_collection):
    for obj in list(target_collection.objects):
        if obj.name.startswith("label:"):
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if data and data.users == 0:
                bpy.data.curves.remove(data)


def render_technical_boards():
    if not ASSET_COLLECTIONS:
        bind_scene_assets()
    hide_all_assets()
    for value in TECH_COLLECTIONS.values(): value.hide_render=True
    for asset_id in ("counter_service","counter_stove","counter_coffee","counter_sink","counter_fryer"):
        set_state(asset_id,"off" if asset_id in {"counter_stove","counter_fryer"} else "idle")
        ASSET_ROOTS[asset_id].rotation_euler=(0,0,0)
    camera=setup_camera((2,2,.92),7.5,(1800,1000),False)
    counter=TECH_COLLECTIONS["counter"]; counter.hide_render=False
    clear_technical_labels(counter)
    orient_technical_labels(counter,[
        ("BASE MESTRA 1.000 x 1.000 BU | BANCADA 1.100 BU | TOLERANCIA 0.001",(2,1.55,3.10),.085),
    ])
    render_png(OUTPUT_ROOT/"approval_counter_alignment.png",(1800,1000))
    counter.hide_render=True

    scale=TECH_COLLECTIONS["scale"]; scale.hide_render=False
    clear_technical_labels(scale)
    scale_character=bpy.data.objects.get("scale:character")
    if scale_character is not None:
        scale_character.location.x=6
    pose_character(PLAYER_PRESETS[0]["id"],"idle",0)
    ASSET_ROOTS[PLAYER_PRESETS[0]["id"]].rotation_euler.z=0
    camera=setup_camera((3,1.45,.75),8.4,(1800,950),False)
    orient_technical_labels(scale,[
        ("MESA 1x1 + DUAS CADEIRAS OPOSTAS",(1,2.52,1.32),.075),
        ("GELADEIRA 1x1",(3,1.2,2.65),.075),("BALCAO 1x1",(4,1.15,1.62),.075),("PERSONAGEM 1x1",(6,1.1,2.65),.075),
    ])
    render_png(OUTPUT_ROOT/"approval_furniture_scale.png",(1800,950))
    scale.hide_render=True


def render_individuals_and_sheets():
    character_idle_paths={}
    for spec in (*PLAYER_PRESETS,*FAMILY_CHARACTERS):
        asset_id=spec["id"]
        for direction in ACTIVE_DIRECTIONS:
            path=OUTPUT_ROOT/"sprites"/"characters"/asset_id/"idle"/f"{direction}.png"
            render_asset(asset_id,path,direction)
            character_idle_paths[(asset_id,direction)] = path
    frame_paths_by_animation={}
    prototype_id=PLAYER_PRESETS[0]["id"]
    for animation in ANIMATION_SPECS:
        frame_paths={}
        for direction in ACTIVE_DIRECTIONS:
            for frame in range(4):
                path=OUTPUT_ROOT/"animation_frames"/animation/direction/f"{frame:03d}.png"
                render_asset(prototype_id,path,direction,animation=animation,frame=frame)
                frame_paths[(direction,frame)]=path
        compose_sheet(frame_paths,OUTPUT_ROOT/ANIMATION_SPECS[animation]["sheet"])
        frame_paths_by_animation[animation]=frame_paths

    furniture_paths={}
    for definition in FURNITURE_ASSETS:
        asset_id=definition["id"]
        for state in definition["states"]:
            for direction in FURNITURE_DIRECTIONS:
                path=OUTPUT_ROOT/"sprites"/"furniture"/asset_id/state/f"{direction}.png"
                render_asset(asset_id,path,direction,state=state)
                furniture_paths[(asset_id,state,direction)]=path

    compose_board([character_idle_paths[(spec["id"],"sw")] for spec in PLAYER_PRESETS],OUTPUT_ROOT/"approval_player_presets.png",columns=5,scale=3)
    compose_board([character_idle_paths[(PLAYER_PRESETS[0]["id"],direction)] for direction in ACTIVE_DIRECTIONS],OUTPUT_ROOT/"approval_player_turnaround.png",columns=4,scale=3)
    family=[*PLAYER_PRESETS,*FAMILY_CHARACTERS]
    compose_board([character_idle_paths[(spec["id"],"sw")] for spec in family],OUTPUT_ROOT/"approval_character_family.png",columns=len(family),scale=2,margin=24,gap=12)
    active_order=[
        ("counter_stove","off"),("counter_stove","on"),("counter_coffee","idle"),("counter_coffee","active_1"),
        ("counter_sink","idle"),("counter_sink","active"),("counter_fryer","off"),("counter_fryer","on"),
    ]
    compose_board([furniture_paths[(asset,state,"sw")] for asset,state in active_order],OUTPUT_ROOT/"approval_active_states.png",columns=4,scale=4,margin=30,gap=22,crop=True)
    compose_board([character_idle_paths[(PLAYER_PRESETS[0]["id"],direction)] for direction in ACTIVE_DIRECTIONS],OUTPUT_ROOT/"approval_player_turnaround_nearest_4x.png",columns=4,scale=4,margin=24,gap=16)
    return character_idle_paths, furniture_paths, frame_paths_by_animation


def write_manifest():
    characters=[]
    for spec in (*PLAYER_PRESETS,*FAMILY_CHARACTERS):
        role="player" if spec in PLAYER_PRESETS else "barista" if spec["id"].startswith("staff_barista") else "attendant" if spec["id"].startswith("staff_attendant") else "customer"
        characters.append({
            "id":spec["id"],"type":"character","role":role,"label":spec["label"],"presentation":spec["presentation"],
            "footprint":[1,1],"dimensionsBlender":[1,1,2.2],"pivot":[0,0,0],"anchor":list(FEET_ANCHOR),
            "frameSize":list(FRAME_SIZE),"directions":list(ACTIVE_DIRECTIONS),"skin":spec["skin"],"hair":spec["hair"],
            "hairColor":spec["hair_color"],"face":spec["face"],"body":spec["body"],"outfit":spec["outfit"],
            "sourceCollection":f"SRC_{spec['id']}","sourceBlend":"art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_approval.blend",
            "spritePath":f"sprites/characters/{spec['id']}/idle/{{direction}}.png",
            "animations":list(ANIMATION_SPECS) if role=="player" and spec==PLAYER_PRESETS[0] else ["idle"],
        })
    furniture=[]
    for definition in FURNITURE_ASSETS:
        is_counter=definition["type"].startswith("counter_")
        dims=[1.0,1.0,COUNTER["height"]] if is_counter else [1.0,1.0,2.2 if definition["type"]=="fridge" else .82]
        furniture.append({
            "id":definition["id"],"canonicalId":definition["canonicalId"],"type":"furniture","subtype":definition["type"],
            "footprint":definition["footprint"],"dimensionsBlender":dims,"pivot":[0,0,0],"anchor":[.5,WORLD_FLOOR_Y/WORLD_FRAME_SIZE[1]],
            "frameSize":list(WORLD_FRAME_SIZE),"directions":list(FURNITURE_DIRECTIONS),"states":definition["states"],
            "counterBaseAssetId":"COUNTER_BASE_MASTER_1x1" if is_counter else None,
            "sourceCollection":f"SRC_{definition['id']}","sourceBlend":"art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_approval.blend",
            "spritePath":f"sprites/furniture/{definition['id']}/{{state}}/{{direction}}.png",
        })
    manifest={
        "package":"cafe-tycoon-sprite-refresh-approval-v1","productionIntegrated":False,"source":"Blender 5.2 original geometry",
        "grid":{"tilePixels":list(ISO_TILE_PIXELS),"blenderUnitsPerTile":1.0},
        "camera":{"projection":"orthographic","azimuthDegrees":CAMERA_AZIMUTH_DEGREES,"elevationDegrees":CAMERA_ELEVATION_DEGREES},
        "counterMaster":COUNTER,"modularOptions":{"hairStyles":["short","bun","coily","curls","wave"],"hairColors":list(HAIR_COLORS),"skinTones":list(SKIN_TONES)},
        "characters":characters,"furniture":furniture,
        "animationSheets":{name:{**spec,"directions":list(ACTIVE_DIRECTIONS),"frameSize":list(FRAME_SIZE)} for name,spec in ANIMATION_SPECS.items()},
        "approvalBoards":["approval_player_presets.png","approval_player_turnaround.png","approval_character_family.png","approval_counter_alignment.png","approval_furniture_scale.png","approval_active_states.png"],
    }
    (OUTPUT_ROOT/"prototype_manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


def reset_default_scene():
    hide_all_assets()
    for tech in TECH_COLLECTIONS.values(): tech.hide_render=True
    asset_id=PLAYER_PRESETS[0]["id"]
    ASSET_PROXIES[asset_id].hide_render=False
    ASSET_ROOTS[asset_id].rotation_euler=(0,0,0)
    pose_character(asset_id,"idle",0)
    setup_camera((0,0,1.31),CHARACTER_ORTHO_SCALE,FRAME_SIZE,True)


def build_scene():
    setup_scene()
    build_characters()
    build_furniture()
    build_rig_actions()
    build_technical_scenes()
    return bpy.context.scene


def render_all():
    if not ASSET_COLLECTIONS:
        bind_scene_assets()
    OUTPUT_ROOT.mkdir(parents=True,exist_ok=True)
    render_individuals_and_sheets()
    render_technical_boards()
    write_manifest()


def build_and_render():
    blend_path=Path(os.environ.get("BLENDER_CODEX_BLEND_PATH",str(DEFAULT_BLEND)))
    preview_path=Path(os.environ.get("BLENDER_CODEX_PREVIEW_PATH",str(DEFAULT_PREVIEW)))
    blend_path.parent.mkdir(parents=True,exist_ok=True)
    preview_path.parent.mkdir(parents=True,exist_ok=True)
    build_scene()
    reset_default_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    render_all()
    approval=OUTPUT_ROOT/"approval_player_presets.png"
    if approval.resolve()!=preview_path.resolve():
        shutil.copyfile(approval,preview_path)
    reset_default_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(f"SPRITE_REFRESH_BLEND={blend_path}")
    print(f"SPRITE_REFRESH_PREVIEW={approval}")
