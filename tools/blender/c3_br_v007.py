"""Cafe Mania 0.0.7 — C3-BR character authoring and sprite pipeline.

The attached lineup is used only as a packed, non-rendering Blender reference.
Every runtime pixel is rendered from original editable Blender geometry.
"""

from __future__ import annotations

from array import array
from collections import OrderedDict
from copy import deepcopy
from math import cos, pi, radians, sin, tau
from pathlib import Path
import json
import os
import shutil
import tempfile

import bpy
from mathutils import Vector


VERSION = "0.0.7"
RENDER_VERSION = "0.0.7-c3-br-2"
QUALITY_PROFILE = "c3-br-cartoon-3d-pixel-2.5d-v1"
FRAME_SIZE = (112, 168)
FEET_ANCHOR = (56, 160)
MASTER_SCALE = 2
DIRECTIONS = OrderedDict((
    ("ne", (180, "right")),
    ("nw", (270, "up")),
    ("se", (90, "down")),
    ("sw", (0, "left")),
))

SHARED_ANIMATIONS = OrderedDict((
    ("idle", 4), ("walk", 8), ("sit_down", 6), ("seated_idle", 4),
    ("stand_up", 6), ("talk", 6), ("wait", 4), ("react_happy", 6),
))
PLAYER_ANIMATIONS = OrderedDict((
    ("carry_plate_idle", 4), ("carry_plate_walk", 8),
    ("carry_tray_idle", 4), ("carry_tray_walk", 8),
    ("carry_ingredient_idle", 4), ("carry_ingredient_walk", 8),
    ("pickup_dish", 6), ("place_dish", 6), ("pickup_ingredient", 6),
    ("cook_stove", 8), ("prep_counter", 8), ("wash_sink", 8),
    ("serve_table", 6), ("clear_table", 6), ("clean_table", 8),
))
COOK_ANIMATIONS = OrderedDict((
    ("carry_plate_idle", 4), ("carry_plate_walk", 8),
    ("carry_ingredient_idle", 4), ("carry_ingredient_walk", 8),
    ("pickup_ingredient", 6), ("cook_stove", 8), ("prep_counter", 8),
    ("wash_sink", 8), ("place_dish", 6), ("wait_workstation", 4),
))
WAITER_ANIMATIONS = OrderedDict((
    ("carry_plate_idle", 4), ("carry_plate_walk", 8),
    ("carry_tray_idle", 4), ("carry_tray_walk", 8),
    ("pickup_dish", 6), ("serve_table", 6), ("clear_table", 6),
    ("clean_table", 8), ("wait_service", 4),
))
CUSTOMER_ANIMATIONS = OrderedDict((
    ("wait_food", 4), ("eat", 8), ("drink", 8),
    ("talk_seated", 6), ("react_impatient", 6),
))


def animations_for(role: str) -> OrderedDict:
    result = deepcopy(SHARED_ANIMATIONS)
    result.update({
        "player": PLAYER_ANIMATIONS,
        "cook": COOK_ANIMATIONS,
        "waiter": WAITER_ANIMATIONS,
        "customer": CUSTOMER_ANIMATIONS,
    }[role])
    return result


CHARACTERS = [
    dict(assetId="char_player_male_01", short="player_male_01", role="player", displayName="Jogador masculino",
         body="athletic", height=1.00, width=1.00, skin="skin_caramel", hair="espresso", hairStyle="short_curls",
         outfit="player_green_vertical", pants="denim", shoes="green_white", accessory="watch", presentation="masculina"),
    dict(assetId="char_player_female_01", short="player_female_01", role="player", displayName="Jogadora feminina",
         body="curvy", height=.98, width=1.04, skin="skin_brown", hair="chestnut", hairStyle="high_curly_pony",
         outfit="player_red_black_horizontal", pants="denim", shoes="red_black", accessory="bracelets", presentation="feminina"),
    dict(assetId="char_cook_female_01", short="cook_female_01", role="cook", displayName="Cozinheira",
         body="strong", height=.96, width=1.13, skin="skin_deep", hair="espresso", hairStyle="turban_bun",
         outfit="cook_white", pants="checkered", shoes="white", accessory="turban", presentation="feminina"),
    dict(assetId="char_waiter_male_01", short="waiter_male_01", role="waiter", displayName="Garçom",
         body="tall", height=1.06, width=1.00, skin="skin_deep", hair="espresso", hairStyle="short_fade",
         outfit="waiter_wine", pants="black", shoes="black", accessory="blue_cloth", presentation="masculina"),
    dict(assetId="char_customer_01", short="customer_01", role="customer", displayName="Cliente streetwear",
         body="slim", height=1.00, width=.93, skin="skin_caramel", hair="espresso", hairStyle="back_cap_curls",
         outfit="street_black_white", pants="khaki_shorts", shoes="black_white", accessory="crossbody", presentation="masculina"),
    dict(assetId="char_customer_02", short="customer_02", role="customer", displayName="Cliente idosa elegante",
         body="soft", height=.91, width=1.02, skin="skin_light", hair="silver", hairStyle="silver_waves",
         outfit="elegant_red", pants="white", shoes="red", accessory="handbag", presentation="feminina"),
    dict(assetId="char_customer_03", short="customer_03", role="customer", displayName="Cliente de meia-idade",
         body="large", height=.96, width=1.20, skin="skin_caramel", hair="salt_pepper", hairStyle="short_side",
         outfit="wine_green_vertical", pants="beige_shorts", shoes="brown_sandals", accessory="glasses_moustache", presentation="masculina"),
    dict(assetId="char_customer_04", short="customer_04", role="customer", displayName="Cliente esportiva",
         body="athletic", height=1.02, width=.98, skin="skin_brown", hair="espresso", hairStyle="side_braid",
         outfit="sport_blue_black", pants="sport_black", shoes="blue_black", accessory="sport_watch", presentation="feminina"),
    dict(assetId="char_customer_05", short="customer_05", role="customer", displayName="Cliente jovem com óculos",
         body="slim", height=.98, width=.91, skin="skin_light", hair="chestnut", hairStyle="soft_curls",
         outfit="white_diagonal", pants="brown", shoes="black_white", accessory="round_glasses_backpack", presentation="masculina"),
    dict(assetId="char_customer_06", short="customer_06", role="customer", displayName="Cliente madura colorida",
         body="curvy", height=.99, width=1.08, skin="skin_deep", hair="espresso", hairStyle="large_afro",
         outfit="blue_red_white", pants="blue", shoes="red_sandals", accessory="color_earrings", presentation="feminina"),
]
for _character in CHARACTERS:
    _character["animations"] = animations_for(_character["role"])


COLLECTION_NAMES = (
    "CHARACTERS", "BASE_BODIES", "HEADS", "EYES", "FACIAL_RIGS", "HAIR", "CLOTHING",
    "FOOTBALL_INSPIRED_CLOTHING", "ACCESSORIES", "WORK_PROPS", "FOOD_PROPS", "RIGS",
    "ANIMATIONS", "CAMERAS", "LIGHTS", "SCALE_REFERENCES", "RENDER_HELPERS", "REFERENCES",
)

COLORS = {
    "skin_light": (0.95, .70, .53, 1), "skin_caramel": (.63, .32, .17, 1),
    "skin_brown": (.52, .28, .15, 1), "skin_deep": (.30, .13, .065, 1),
    "skin_shadow": (.42, .20, .10, 1), "espresso": (.035, .018, .012, 1),
    "chestnut": (.18, .065, .025, 1), "silver": (.73, .72, .70, 1),
    "salt_pepper": (.25, .23, .22, 1), "white": (.95, .94, .90, 1),
    "cream": (.90, .82, .68, 1), "black": (.035, .04, .045, 1),
    "charcoal": (.10, .11, .12, 1), "wine": (.36, .055, .075, 1),
    "red": (.72, .055, .045, 1), "red_light": (.95, .17, .08, 1),
    "green": (.12, .36, .18, 1), "green_light": (.33, .62, .33, 1),
    "blue": (.045, .27, .58, 1), "blue_light": (.08, .52, .78, 1),
    "denim": (.09, .31, .54, 1), "denim_light": (.22, .49, .70, 1), "denim_dark": (.045, .19, .36, 1),
    "cloth_green_dark": (.075, .25, .12, 1), "cloth_white_shadow": (.70, .72, .68, 1),
    "khaki": (.55, .42, .25, 1), "beige": (.78, .66, .48, 1),
    "brown": (.30, .15, .075, 1), "yellow": (.96, .64, .08, 1),
    "orange": (.92, .28, .035, 1), "pink": (.90, .12, .38, 1),
    "eye_white": (.98, .97, .92, 1), "iris": (.24, .085, .028, 1), "pupil": (.008, .006, .004, 1),
    "mouth": (.34, .025, .025, 1), "gold": (.90, .57, .08, 1),
    "steel": (.44, .48, .50, 1), "shadow": (.08, .035, .02, .16),
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.collections, bpy.data.materials, bpy.data.armatures, bpy.data.actions):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def collection(name: str, parent=None):
    target = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    owner = parent or bpy.context.scene.collection
    if target.name not in {child.name for child in owner.children}:
        owner.children.link(target)
    return target


def link_only(obj, owner):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    owner.objects.link(obj)
    return obj


def material(name: str, color=None, roughness=.72, metallic=0.0):
    target = bpy.data.materials.get(f"C3BR_{name}") or bpy.data.materials.new(f"C3BR_{name}")
    rgba = color or COLORS[name]
    target.diffuse_color = rgba
    target.use_nodes = True
    shader = target.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    if name.startswith("skin_"):
        if "Subsurface Weight" in shader.inputs:
            shader.inputs["Subsurface Weight"].default_value = .065
        if "Coat Weight" in shader.inputs:
            shader.inputs["Coat Weight"].default_value = .035
        shader.inputs["Roughness"].default_value = .60
    elif name in {"espresso", "chestnut", "silver", "salt_pepper"}:
        shader.inputs["Roughness"].default_value = .68
        if "Coat Weight" in shader.inputs:
            shader.inputs["Coat Weight"].default_value = .008
    if rgba[3] < 1:
        shader.inputs["Alpha"].default_value = rgba[3]
        target.surface_render_method = "DITHERED"
    if name in {"espresso", "chestnut", "silver", "salt_pepper", "denim", "denim_light", "denim_dark"} and not target.node_tree.nodes.get("C3BR micro detail"):
        noise = target.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.name = "C3BR micro detail"
        noise.inputs["Scale"].default_value = 18.0 if name in {"espresso", "chestnut", "silver", "salt_pepper"} else 48.0
        noise.inputs["Detail"].default_value = 5.0
        noise.inputs["Roughness"].default_value = .66
        bump = target.node_tree.nodes.new("ShaderNodeBump")
        bump.name = "C3BR material grain"
        bump.inputs["Strength"].default_value = .16 if name in {"espresso", "chestnut", "silver", "salt_pepper"} else .10
        bump.inputs["Distance"].default_value = .035
        target.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        target.node_tree.links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    return target


def striped_material(name, color_a, color_b, direction="X", scale=3.0):
    target = bpy.data.materials.get(f"C3BR_pattern_{name}") or bpy.data.materials.new(f"C3BR_pattern_{name}")
    target.use_nodes = True
    nodes = target.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = .78
    texcoord = nodes.new("ShaderNodeTexCoord")
    wave = nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = direction
    wave.inputs["Scale"].default_value = scale
    wave.inputs["Distortion"].default_value = 0.0
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].position = .48
    ramp.color_ramp.elements[0].color = COLORS[color_a]
    ramp.color_ramp.elements[1].position = .52
    ramp.color_ramp.elements[1].color = COLORS[color_b]
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 52.0
    noise.inputs["Detail"].default_value = 3.0
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .075
    bump.inputs["Distance"].default_value = .018
    links = target.node_tree.links
    links.new(texcoord.outputs["Generated"], wave.inputs["Vector"])
    links.new(wave.outputs["Color"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return target


def bearded_skin_material(name, skin_name, hair_name):
    target = bpy.data.materials.get(f"C3BR_bearded_{name}") or bpy.data.materials.new(f"C3BR_bearded_{name}")
    target.use_nodes = True
    nodes = target.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = .68
    if "Subsurface Weight" in shader.inputs:
        shader.inputs["Subsurface Weight"].default_value = .045
    texcoord = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    center_x = nodes.new("ShaderNodeMath"); center_x.operation = "SUBTRACT"; center_x.inputs[1].default_value = .5
    absolute_x = nodes.new("ShaderNodeMath"); absolute_x.operation = "ABSOLUTE"
    side_lift = nodes.new("ShaderNodeMath"); side_lift.operation = "MULTIPLY"; side_lift.inputs[1].default_value = .58
    threshold = nodes.new("ShaderNodeMath"); threshold.operation = "ADD"; threshold.inputs[1].default_value = .31
    distance = nodes.new("ShaderNodeMath"); distance.operation = "SUBTRACT"
    soften = nodes.new("ShaderNodeMapRange")
    soften.interpolation_type = "SMOOTHERSTEP"
    soften.inputs["From Min"].default_value = -.025
    soften.inputs["From Max"].default_value = .025
    soften.inputs["To Min"].default_value = 0.0
    soften.inputs["To Max"].default_value = 1.0
    soften.clamp = True
    mix = nodes.new("ShaderNodeMixRGB")
    mix.blend_type = "MIX"
    mix.inputs[1].default_value = COLORS[skin_name]
    mix.inputs[2].default_value = COLORS[hair_name]
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 34.0
    noise.inputs["Detail"].default_value = 4.0
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = .07
    bump.inputs["Distance"].default_value = .018
    links = target.node_tree.links
    links.new(texcoord.outputs["Generated"], separate.inputs["Vector"])
    links.new(separate.outputs["X"], center_x.inputs[0])
    links.new(center_x.outputs[0], absolute_x.inputs[0])
    links.new(absolute_x.outputs[0], side_lift.inputs[0])
    links.new(side_lift.outputs[0], threshold.inputs[0])
    links.new(threshold.outputs[0], distance.inputs[0])
    links.new(separate.outputs["Z"], distance.inputs[1])
    links.new(distance.outputs[0], soften.inputs["Value"])
    links.new(soften.outputs["Result"], mix.inputs[0])
    links.new(mix.outputs[0], shader.inputs["Base Color"])
    links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return target


def smooth(obj):
    if obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def sphere(name, location, scale, mat, owner, segments=20, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return link_only(smooth(obj), owner)


def cube(name, location, scale, mat, owner, bevel=.025, rotation=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    if rotation:
        obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Soft cartoon bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    obj.data.materials.append(mat)
    return link_only(obj, owner)


def cylinder(name, location, radius, depth, mat, owner, vertices=16, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    bevel = obj.modifiers.new("Rounded manufactured edge", "BEVEL")
    bevel.width = min(depth * .10, radius * .15)
    bevel.segments = 3
    obj.data.materials.append(mat)
    return link_only(smooth(obj), owner)


def cone(name, location, radius1, radius2, depth, mat, owner, vertices=16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    bevel = obj.modifiers.new("Continuous soft transition", "BEVEL")
    bevel.width = min(depth * .055, max(radius1, radius2) * .16)
    bevel.segments = 3
    obj.data.materials.append(mat)
    return link_only(smooth(obj), owner)


def torus(name, location, major, minor, mat, owner, rotation=None):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=16, minor_segments=6, location=location)
    obj = bpy.context.object
    obj.name = name
    if rotation:
        obj.rotation_euler = rotation
    obj.data.materials.append(mat)
    return link_only(smooth(obj), owner)


def curve_line(name, points, bevel_depth, mat, owner, origin=None):
    data = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 2
    data.bevel_depth = bevel_depth
    data.bevel_resolution = 3
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    origin_vector = Vector(origin) if origin else Vector((0, 0, 0))
    for point, co in zip(spline.bezier_points, points):
        point.co = Vector(co) - origin_vector
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    if origin:
        obj.location = origin
    data.materials.append(mat)
    owner.objects.link(obj)
    return obj


def tapered_curve(name, points, bevel_depth, mat, owner):
    data = bpy.data.curves.new(f"{name}_Curve", "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 3
    data.bevel_depth = bevel_depth
    data.bevel_resolution = 4
    data.use_fill_caps = True
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    midpoint = (len(points) - 1) / 2
    for index, (point, co) in enumerate(zip(spline.bezier_points, points)):
        point.co = co
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
        normalized = abs(index - midpoint) / max(1.0, midpoint)
        point.radius = .22 + .78 * (1.0 - normalized ** 1.7)
    obj = bpy.data.objects.new(name, data)
    data.materials.append(mat)
    owner.objects.link(obj)
    return obj


def mesh_patch(name, points, mat, owner, bevel=.015, thickness=.018):
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(points, [], [list(range(len(points)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    mesh.materials.append(mat)
    owner.objects.link(obj)
    solidify = obj.modifiers.new("Garment depth", "SOLIDIFY")
    solidify.thickness = thickness
    solidify.offset = 0.0
    edge = obj.modifiers.new("Soft tailored edge", "BEVEL")
    edge.width = bevel
    edge.segments = 3
    return smooth(obj)


def profile_mesh(name, levels, mat, owner, segments=32, bevel_width=.018, subdivision_levels=0, origin=None):
    origin = origin or (0, 0, 0)
    vertices = []
    for z, radius_x, radius_y in levels:
        for index in range(segments):
            angle = tau * index / segments
            vertices.append((radius_x * cos(angle), radius_y * sin(angle), z - origin[2]))
    faces = []
    for level_index in range(len(levels) - 1):
        start = level_index * segments
        next_start = (level_index + 1) * segments
        for index in range(segments):
            nxt = (index + 1) % segments
            faces.append((start + index, start + nxt, next_start + nxt, next_start + index))
    faces.append(tuple(reversed(range(segments))))
    top_start = (len(levels) - 1) * segments
    faces.append(tuple(top_start + index for index in range(segments)))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    obj.location = origin
    owner.objects.link(obj)
    if subdivision_levels:
        subdivision = obj.modifiers.new("Sculpt surface density", "SUBSURF")
        subdivision.subdivision_type = "CATMULL_CLARK"
        subdivision.levels = subdivision_levels
        subdivision.render_levels = subdivision_levels
    edge = obj.modifiers.new("Tailored soft silhouette", "BEVEL")
    edge.width = bevel_width
    edge.segments = 3
    return smooth(obj)


def empty(name, location, owner, parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.location = location
    obj.hide_render = True
    owner.objects.link(obj)
    obj.parent = parent
    return obj


def parent_keep(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world
    return obj


def parent_local(obj, parent):
    obj.parent = parent
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    return obj


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def configure_scene():
    scene = bpy.context.scene
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.filter_size = .35
    scene.render.resolution_percentage = 100
    scene.render.use_file_extension = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world.color = (.035, .025, .018)
    scene["gameVersion"] = VERSION
    scene["qualityProfile"] = QUALITY_PROFILE
    scene["renderVersion"] = RENDER_VERSION
    scene["sourceIdentity"] = "Original editable Blender geometry; reference never rendered into sprites"
    scene["gridContract"] = f"64x32 iso; feet=({FEET_ANCHOR[0]},{FEET_ANCHOR[1]}); {FRAME_SIZE[0]}x{FRAME_SIZE[1]}; zoom=.5,1,2"

    cameras = collection("CAMERAS")
    camera_data = bpy.data.cameras.new("C3BR_GameCamera_Data")
    camera = bpy.data.objects.new("C3BR_GameCamera", camera_data)
    cameras.objects.link(camera)
    camera.location = (6, -6, 6)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 3.05
    aim(camera, (0, 0, 1.23))
    camera["projection"] = "orthographic"
    camera["horizontalAngle"] = 45.0
    camera["inclination"] = 35.264
    camera["tilePixels"] = [64, 32]
    camera["feetAnchor"] = list(FEET_ANCHOR)
    scene.camera = camera

    lights = collection("LIGHTS")
    for name, kind, location, energy, size, color in (
        ("C3BR_Key", "AREA", (-4.5, -6, 8), 950, 5.0, (1.0, .78, .58)),
        ("C3BR_Fill", "AREA", (5, -1, 5), 520, 4.0, (.58, .76, 1.0)),
        ("C3BR_Rim", "AREA", (1, 6, 7), 430, 3.0, (.78, 1.0, .68)),
    ):
        data = bpy.data.lights.new(name, kind)
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        data.color = color
        obj = bpy.data.objects.new(name, data)
        lights.objects.link(obj)
        obj.location = location
        aim(obj, (0, 0, 1.1))
    scene["lightingRig"] = "c3_br_softbox_v1"
    return scene


def create_scale_references(materials):
    owner = collection("SCALE_REFERENCES")
    tile = cube("SCALE_tile_1x1", (0, 0, -.05), (.5, .5, .05), materials["cream"], owner, .01)
    chair = cube("SCALE_chair_seat", (1.4, 0, .48), (.34, .34, .08), materials["brown"], owner)
    cube("SCALE_chair_back", (1.4, .30, .84), (.34, .06, .38), materials["brown"], owner)
    cube("SCALE_table", (-1.45, 0, .76), (.58, .58, .07), materials["brown"], owner)
    cube("SCALE_counter", (0, 1.5, .88), (.65, .45, .88), materials["steel"], owner)
    cube("SCALE_stove", (-1.5, 1.5, .82), (.70, .45, .82), materials["steel"], owner)
    cube("SCALE_sink", (1.5, 1.5, .82), (.70, .45, .82), materials["steel"], owner)
    owner.hide_render = True
    owner["tileMeters"] = 1.0
    owner["seatHeight"] = .48
    owner["tableHeight"] = .76
    owner["counterHeight"] = .88
    owner["equipmentHeight"] = .82
    return tile, chair


def pack_reference(reference_path: Path):
    owner = collection("REFERENCES")
    if not reference_path.exists():
        owner["status"] = f"Missing reference: {reference_path}"
        return
    image = bpy.data.images.load(str(reference_path), check_existing=False)
    image.pack()
    ref = bpy.data.objects.new("REFERENCE_C3_BR_LINEUP_10_DO_NOT_RENDER", None)
    ref.empty_display_type = "IMAGE"
    ref.data = image
    ref.empty_display_size = 8
    ref.location = (0, 2.8, 4.4)
    ref.rotation_euler = (radians(90), 0, 0)
    ref.hide_render = True
    owner.objects.link(ref)
    owner["usage"] = "Visual identity reference only. Never used as a game texture or sprite source."
    owner["sourceName"] = reference_path.name
    owner.hide_render = True


def create_rig(asset_id: str, owner, height_scale: float):
    data = bpy.data.armatures.new(f"{asset_id}_HumanoidRig_Data")
    rig = bpy.data.objects.new(f"{asset_id}_HumanoidRig", data)
    owner.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {
        "root": ((0, 0, 0), (0, 0, .20), None),
        "pelvis": ((0, 0, .55), (0, 0, .95), "root"),
        "spine": ((0, 0, .95), (0, 0, 1.42), "pelvis"),
        "chest": ((0, 0, 1.35), (0, 0, 1.65), "spine"),
        "neck": ((0, 0, 1.65), (0, 0, 1.80), "chest"),
        "head": ((0, 0, 1.78), (0, 0, 2.20), "neck"),
        "upper_arm.L": ((-.34, 0, 1.56), (-.55, 0, 1.22), "chest"),
        "lower_arm.L": ((-.55, 0, 1.22), (-.55, 0, .92), "upper_arm.L"),
        "hand.L": ((-.55, 0, .92), (-.55, 0, .78), "lower_arm.L"),
        "upper_arm.R": ((.34, 0, 1.56), (.55, 0, 1.22), "chest"),
        "lower_arm.R": ((.55, 0, 1.22), (.55, 0, .92), "upper_arm.R"),
        "hand.R": ((.55, 0, .92), (.55, 0, .78), "lower_arm.R"),
        "upper_leg.L": ((-.15, 0, .94), (-.15, 0, .50), "pelvis"),
        "lower_leg.L": ((-.15, 0, .50), (-.15, 0, .12), "upper_leg.L"),
        "foot.L": ((-.15, 0, .12), (-.15, -.24, .08), "lower_leg.L"),
        "upper_leg.R": ((.15, 0, .94), (.15, 0, .50), "pelvis"),
        "lower_leg.R": ((.15, 0, .50), (.15, 0, .12), "upper_leg.R"),
        "foot.R": ((.15, 0, .12), (.15, -.24, .08), "lower_leg.R"),
        "face_root": ((0, -.20, 1.86), (0, -.22, 2.05), "head"),
        "jaw": ((0, -.23, 1.88), (0, -.25, 1.78), "face_root"),
        "brow.L": ((-.10, -.25, 2.03), (-.10, -.26, 2.10), "face_root"),
        "brow.R": ((.10, -.25, 2.03), (.10, -.26, 2.10), "face_root"),
        "eye.L": ((-.10, -.25, 1.98), (-.10, -.28, 2.02), "face_root"),
        "eye.R": ((.10, -.25, 1.98), (.10, -.28, 2.02), "face_root"),
        "carry": ((0, -.35, 1.10), (0, -.62, 1.10), "chest"),
    }
    for name, (head, tail, parent_name) in bones.items():
        bone = data.edit_bones.new(name)
        bone.head = Vector(head) * height_scale
        bone.tail = Vector(tail) * height_scale
        if parent_name:
            bone.parent = data.edit_bones[parent_name]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig.hide_render = True
    rig["rigId"] = "C3BR_Humanoid_v1"
    rig["rootPivot"] = "between-feet"
    rig["facialSystem"] = "bones+shape-keys"
    rig["compatibleDirections"] = 4
    rig.select_set(False)
    return rig


def create_animation_library(rig, definition):
    names = []
    for animation, frames in definition["animations"].items():
        action = bpy.data.actions.new(f"{definition['assetId']}__{animation}")
        action.use_fake_user = True
        action["animationId"] = animation
        action["frameCount"] = frames
        action["fps"] = 8 if frames >= 8 else 6
        action["loop"] = animation not in {"sit_down", "stand_up", "pickup_dish", "place_dish", "pickup_ingredient", "serve_table", "clear_table"}
        action["directions"] = ["down", "left", "up", "right"]
        names.append(action.name)
    rig["animationSet"] = f"{definition['role']}_c3_br_v1"
    rig["animationNames"] = names


def limb(asset_id, side, kind, pivot_location, length, radius, upper_mat, end_mat, owner, root, detail_mat=None):
    joint = empty(f"{asset_id}:{kind}.{side}", pivot_location, owner, root)
    upper_len = length * .49
    lower_len = length - upper_len
    if kind == "arm":
        sleeve_len = upper_len * .54
        sleeve = profile_mesh(
            f"{asset_id}:{kind}.{side}:upper",
            [
                (pivot_location[2], radius * .98, radius * .92),
                (pivot_location[2] - sleeve_len * .38, radius * 1.08, radius * .98),
                (pivot_location[2] - sleeve_len, radius * .91, radius * .84),
            ],
            upper_mat, owner, 24, .010, 0, pivot_location,
        )
        upper_skin_len = upper_len - sleeve_len
        upper_skin = profile_mesh(
            f"{asset_id}:{kind}.{side}:upper-skin",
            [
                (pivot_location[2] - sleeve_len, radius * .80, radius * .74),
                (pivot_location[2] - sleeve_len - upper_skin_len * .45, radius * .88, radius * .79),
                (pivot_location[2] - upper_len, radius * .74, radius * .69),
            ],
            end_mat, owner, 24, .009, 0, pivot_location,
        )
        parent_keep(sleeve, joint); parent_keep(upper_skin, joint)
        cuff = torus(
            f"{asset_id}:{kind}.{side}:sleeve-cuff",
            (pivot_location[0], pivot_location[1], pivot_location[2] - sleeve_len),
            radius * .86, radius * .10, upper_mat, owner,
        )
        parent_keep(cuff, joint)
    else:
        upper = profile_mesh(
            f"{asset_id}:{kind}.{side}:upper",
            [
                (pivot_location[2], radius * .96, radius * .91),
                (pivot_location[2] - upper_len * .42, radius * 1.06, radius * .97),
                (pivot_location[2] - upper_len, radius * .82, radius * .78),
            ],
            upper_mat, owner, 24, .012, 0, pivot_location,
        )
        parent_keep(upper, joint)
    bend_location = (pivot_location[0], pivot_location[1], pivot_location[2] - upper_len)
    bend = empty(f"{asset_id}:{kind}.{side}:bend", (0, 0, -upper_len), owner, joint)
    lower_mat = end_mat if kind == "arm" else upper_mat
    lower_levels = (
        [
            (bend_location[2], radius * .76, radius * .71),
            (bend_location[2] - lower_len * .32, radius * .87, radius * .78),
            (bend_location[2] - lower_len * .72, radius * .72, radius * .66),
            (bend_location[2] - lower_len, radius * .58, radius * .54),
        ]
        if kind == "arm" else
        [
            (bend_location[2], radius * .82, radius * .78),
            (bend_location[2] - lower_len * .40, radius * .94, radius * .86),
            (bend_location[2] - lower_len * .76, radius * .78, radius * .72),
            (bend_location[2] - lower_len, radius * .64, radius * .60),
        ]
    )
    lower = profile_mesh(f"{asset_id}:{kind}.{side}:lower", lower_levels, lower_mat, owner, 24, .010, 0, bend_location)
    parent_keep(lower, bend)
    crease_y = -radius * (.73 if kind == "arm" else .80)
    crease = curve_line(
        f"{asset_id}:{kind}.{side}:joint-crease",
        [
            (bend_location[0] - radius * .42, crease_y, bend_location[2] + radius * .025),
            (bend_location[0], crease_y - radius * .035, bend_location[2] - radius * .005),
            (bend_location[0] + radius * .42, crease_y, bend_location[2] + radius * .025),
        ],
        radius * .026, detail_mat or lower_mat, owner, bend_location,
    )
    parent_local(crease, bend)
    if kind == "arm":
        hand_z = bend_location[2] - lower_len - radius * .30
        hand = cube(
            f"{asset_id}:hand.{side}",
            (bend_location[0], bend_location[1] - .012, hand_z),
            (radius * .70, radius * .58, radius * .74), end_mat, owner, radius * .19,
        )
        smooth(hand)
        parent_keep(hand, bend)
        thumb_x = bend_location[0] + (-radius * .62 if side == "L" else radius * .62)
        thumb = cube(
            f"{asset_id}:thumb.{side}",
            (thumb_x, bend_location[1] - .035, hand_z + radius * .05),
            (radius * .23, radius * .26, radius * .46), end_mat, owner, radius * .15,
            (0, radians(-28 if side == "L" else 28), 0),
        )
        smooth(thumb)
        parent_keep(thumb, bend)
        for finger_index in range(3):
            groove = curve_line(
                f"{asset_id}:hand.{side}:finger-groove:{finger_index}",
                [
                    (bend_location[0] - radius * .48, bend_location[1] - radius * .63, hand_z + radius * (.42 - finger_index * .24)),
                    (bend_location[0], bend_location[1] - radius * .67, hand_z + radius * (.39 - finger_index * .24)),
                    (bend_location[0] + radius * .48, bend_location[1] - radius * .63, hand_z + radius * (.42 - finger_index * .24)),
                ],
                radius * .025, detail_mat or end_mat, owner, bend_location,
            )
            parent_local(groove, bend)
        for knuckle_index, offset in enumerate((-.48, -.16, .16, .48)):
            knuckle = cube(
                f"{asset_id}:hand.{side}:knuckle:{knuckle_index}",
                (bend_location[0] + radius * offset, bend_location[1] - radius * .50, hand_z - radius * .57),
                (radius * .145, radius * .19, radius * .20), end_mat, owner, radius * .11,
            )
            smooth(knuckle)
            parent_keep(knuckle, bend)
    else:
        shoe = cube(
            f"{asset_id}:shoe.{side}",
            (bend_location[0], bend_location[1] - .11, bend_location[2] - lower_len - .01),
            (radius * .88, radius * 1.48, radius * .52), end_mat, owner, radius * .48,
        )
        smooth(shoe)
        parent_keep(shoe, bend)
        sole = cube(f"{asset_id}:sole.{side}", (bend_location[0], bend_location[1] - .12, bend_location[2] - lower_len - radius * .42), (radius * .88, radius * 1.46, radius * .13), end_mat, owner, .025)
        parent_keep(sole, bend)
    return joint


def add_face_shape_keys(head):
    head.shape_key_add(name="Basis")
    for name in ("Smile", "Talk", "Happy", "Impatient", "Eat", "Drink"):
        key = head.shape_key_add(name=name)
        for index, vertex in enumerate(head.data.vertices):
            co = vertex.co
            if co.y < -.10:
                if name in {"Smile", "Happy"} and co.z < -.02:
                    key.data[index].co.z += .016 * (1 - abs(co.x) / max(.001, .30))
                elif name in {"Talk", "Eat", "Drink"} and co.z < -.05:
                    key.data[index].co.y -= .008
                elif name == "Impatient" and co.z > .08:
                    key.data[index].co.z -= .006


def add_face(asset_id, definition, owner, root, materials):
    head_shape = {
        "char_player_male_01": (.285, .258, .275), "char_player_female_01": (.286, .254, .288),
        "char_cook_female_01": (.305, .274, .282), "char_waiter_male_01": (.282, .248, .292),
        "char_customer_01": (.266, .236, .286), "char_customer_02": (.304, .274, .270),
        "char_customer_03": (.320, .282, .278), "char_customer_04": (.272, .240, .282),
        "char_customer_05": (.264, .232, .288), "char_customer_06": (.304, .270, .286),
    }[asset_id]
    has_beard = definition["presentation"] == "masculina" and asset_id in {"char_player_male_01", "char_waiter_male_01"}
    head_material = (
        bearded_skin_material(asset_id, definition["skin"], definition["hair"])
        if has_beard else materials[definition["skin"]]
    )
    head = sphere(f"{asset_id}:head", (0, 0, 2.02), head_shape, head_material, owner, 40, 20)
    add_face_shape_keys(head)
    parent_keep(head, root)
    ear_l = sphere(f"{asset_id}:ear.L", (-head_shape[0] * .97, .005, 2.01), (.060, .040, .080), materials[definition["skin"]], owner, 16, 8)
    ear_r = sphere(f"{asset_id}:ear.R", (head_shape[0] * .97, .005, 2.01), (.060, .040, .080), materials[definition["skin"]], owner, 16, 8)
    parent_keep(ear_l, root); parent_keep(ear_r, root)
    eye_gap = .104 if asset_id in {"char_cook_female_01", "char_customer_02", "char_customer_06"} else .096
    eye_scale = .070 if definition["presentation"] == "feminina" else .064
    front_y = -head_shape[1] + .006
    for side, x in (("L", -eye_gap), ("R", eye_gap)):
        eye_white = sphere(f"{asset_id}:eye-white.{side}", (x, front_y - .004, 2.045), (eye_scale * .93, .019, eye_scale * 1.08), materials["eye_white"], owner, 20, 10)
        iris = sphere(f"{asset_id}:eye.{side}", (x, front_y - .021, 2.043), (.026, .010, .036), materials["iris"], owner, 18, 9)
        pupil = sphere(f"{asset_id}:pupil.{side}", (x, front_y - .029, 2.043), (.014, .0055, .022), materials["pupil"], owner, 16, 8)
        highlight = sphere(f"{asset_id}:eye-highlight.{side}", (x - .007, front_y - .036, 2.058), (.0065, .0035, .0085), materials["white"], owner, 14, 7)
        brow_tilt = .010 if side == "L" else -.010
        brow = curve_line(
            f"{asset_id}:brow.{side}",
            [(x - .060, front_y - .025, 2.118 + brow_tilt), (x, front_y - .031, 2.130), (x + .060, front_y - .025, 2.118 - brow_tilt)],
            .010, materials[definition["hair"]], owner,
        )
        lid = curve_line(
            f"{asset_id}:upper-lid.{side}",
            [(x - eye_scale * .78, front_y - .020, 2.064), (x, front_y - .028, 2.079), (x + eye_scale * .78, front_y - .020, 2.064)],
            .0065, materials[definition["hair"]], owner,
        )
        for part in (eye_white, iris, pupil, highlight, brow, lid): parent_keep(part, root)
    nose_width = .055 if asset_id in {"char_cook_female_01", "char_customer_03", "char_customer_06"} else .044
    nose = sphere(f"{asset_id}:nose", (0, front_y - .020, 1.990), (nose_width * .86, .026, .052), materials[definition["skin"]], owner, 20, 10)
    mouth_width = .086 if asset_id in {"char_player_male_01", "char_waiter_male_01", "char_player_female_01", "char_cook_female_01", "char_customer_06"} else .072
    mouth = sphere(f"{asset_id}:mouth", (0, front_y - .023, 1.915), (mouth_width * 1.30, .014, .047), materials["mouth"], owner, 24, 12)
    teeth = sphere(f"{asset_id}:teeth", (0, front_y - .036, 1.932), (mouth_width, .008, .023), materials["white"], owner, 20, 10)
    for part in (nose, mouth, teeth): parent_keep(part, root)
    for side, x in (("L", -head_shape[0] * .985), ("R", head_shape[0] * .985)):
        inner_ear = curve_line(
            f"{asset_id}:ear-detail.{side}",
            [(x, -.037, 2.045), (x + (.015 if side == "L" else -.015), -.046, 2.010), (x, -.037, 1.982)],
            .006, materials["skin_shadow"], owner,
        )
        parent_keep(inner_ear, root)
    if has_beard:
        moustache_l = curve_line(f"{asset_id}:beard-moustache.L", [(-.005, front_y - .037, 1.957), (-.055, front_y - .040, 1.948), (-.102, front_y - .032, 1.958)], .014, materials[definition["hair"]], owner)
        moustache_r = curve_line(f"{asset_id}:beard-moustache.R", [( .005, front_y - .037, 1.957), ( .055, front_y - .040, 1.948), ( .102, front_y - .032, 1.958)], .014, materials[definition["hair"]], owner)
        for part in (moustache_l, moustache_r): parent_keep(part, root)
    return head


def curl_cluster(asset_id, owner, root, materials, points, radius=.10, mat_name="espresso", prefix="curl"):
    result = []
    base_color = COLORS[mat_name]
    curl_color = tuple(min(1.0, channel * 1.50 + .012) for channel in base_color[:3]) + (base_color[3],)
    curl_material = material(f"{mat_name}_curl_detail", curl_color, .62)
    for index, point in enumerate(points):
        local_radius = radius * (.88 + .04 * ((index * 7) % 5))
        cx, cy, cz = point
        if cy < -.075:
            strand_points = [
                (cx - local_radius, cy - .014, cz),
                (cx - local_radius * .45, cy - .018, cz + local_radius * .55),
                (cx + local_radius * .35, cy - .019, cz + local_radius * .45),
                (cx + local_radius, cy - .014, cz - local_radius * .08),
            ]
        else:
            strand_points = [
                (cx - local_radius, cy, cz),
                (cx - local_radius * .42, cy - local_radius * .55, cz + .004),
                (cx + local_radius * .32, cy + local_radius * .48, cz + .006),
                (cx + local_radius, cy, cz + .002),
            ]
        curl = tapered_curve(
            f"{asset_id}:{prefix}:{index:02d}", strand_points,
            max(.0060, local_radius * .19), curl_material, owner,
        )
        parent_keep(curl, root)
        result.append(curl)
    return result


def sculpted_hair_volume(name, location, scale, mat, owner, root, noise_scale=.070, strength=.030):
    volume = sphere(name, location, scale, mat, owner, 48, 24)
    texture = bpy.data.textures.new(f"{name}_Sculpt", type="VORONOI")
    texture.noise_scale = noise_scale
    displace = volume.modifiers.new("Unified sculpted curls", "DISPLACE")
    displace.texture = texture
    displace.strength = strength
    displace.mid_level = .50
    parent_keep(volume, root)
    return volume


def add_hair(asset_id, definition, owner, root, materials):
    style = definition["hairStyle"]
    hair = materials[definition["hair"]]
    parts = []
    cap = profile_mesh(
        f"{asset_id}:hair-cap",
        [
            (2.180, .232, .208), (2.205, .258, .226), (2.230, .282, .244),
            (2.260, .296, .254), (2.290, .302, .260), (2.320, .296, .256),
            (2.350, .280, .246), (2.380, .250, .226), (2.410, .204, .188),
            (2.435, .140, .132), (2.455, .052, .050),
        ],
        hair, owner, 42, .024, 2,
    )
    texture = bpy.data.textures.new(f"{asset_id}_HairSculpt", type="CLOUDS")
    texture.noise_scale = .055
    texture.noise_depth = 2
    displace = cap.modifiers.new("Sculpted curl texture", "DISPLACE")
    displace.texture = texture
    displace.strength = .014
    displace.mid_level = .48
    clump_texture = bpy.data.textures.new(f"{asset_id}_HairClumps", type="VORONOI")
    clump_texture.noise_scale = .070
    clump_displace = cap.modifiers.new("Unified curl clumps", "DISPLACE")
    clump_displace.texture = clump_texture
    clump_displace.strength = .026
    clump_displace.mid_level = .50
    parent_keep(cap, root)
    parts.append(cap)
    if style in {"short_curls", "short_fade", "back_cap_curls", "soft_curls"}:
        points = [(-.180, -.177, 2.245), (-.090, -.192, 2.255), (0, -.197, 2.262), (.090, -.192, 2.255), (.180, -.177, 2.245)]
        for row, y in enumerate((-.105, .010, .115, .190)):
            x_values = (-.165, 0, .165) if row % 2 == 0 else (-.215, -.072, .072, .215)
            for x in x_values:
                radial = min(1.0, (x / .30) ** 2 + ((y - .015) / .26) ** 2)
                points.append((x, y, 2.450 - .185 * radial))
        parts += curl_cluster(asset_id, owner, root, materials, points, .026 if style == "short_fade" else .032, definition["hair"])
    elif style == "high_curly_pony":
        pony = sculpted_hair_volume(f"{asset_id}:pony-volume", (0, .245, 2.325), (.285, .235, .355), hair, owner, root, .065, .034)
        parts.append(pony)
        band = torus(f"{asset_id}:red-hair-band", (0, .22, 2.37), .14, .025, materials["red"], owner, (radians(90), 0, 0))
        parent_keep(band, root); parts.append(band)
    elif style == "turban_bun":
        cap.hide_render = True
        wrap_material = striped_material("turban_green_yellow", "green", "yellow", "X", 2.4)
        wrap = sphere(f"{asset_id}:turban", (0, .02, 2.27), (.34, .30, .20), wrap_material, owner, 36, 18)
        parent_keep(wrap, root); parts.append(wrap)
        bun = sculpted_hair_volume(f"{asset_id}:turban-bun", (0, .175, 2.425), (.205, .175, .175), hair, owner, root, .060, .026)
        trim = torus(f"{asset_id}:turban-orange-trim", (0, -.245, 2.285), .225, .014, materials["orange"], owner, (radians(90), 0, 0))
        parent_keep(trim, root); parts += [bun, trim]
    elif style == "silver_waves":
        points = [(-.27, -.05, 2.25), (-.15, -.14, 2.34), (0, -.16, 2.38), (.15, -.14, 2.34), (.27, -.05, 2.25), (-.25, .13, 2.31), (0, .20, 2.38), (.25, .13, 2.31)]
        parts += curl_cluster(asset_id, owner, root, materials, points, .13, "silver", "silver-wave")
    elif style == "side_braid":
        parts += curl_cluster(asset_id, owner, root, materials, [(-.20, -.05, 2.30), (0, -.11, 2.37), (.20, -.05, 2.30)], .13, definition["hair"], "braid-cap")
        braid_root = empty(f"{asset_id}:braid-rig", (.27, .12, 2.12), owner, root)
        for index in range(7):
            bead = sphere(f"{asset_id}:braid:{index}", (.27 + .025 * sin(index), .12, 2.08 - .15 * index), (.075, .075, .092), hair, owner, 12, 6)
            parent_keep(bead, braid_root); parts.append(bead)
        braid_root["secondaryRig"] = "controlled-seven-segment-braid"
    elif style == "large_afro":
        cap.hide_render = True
        afro = sculpted_hair_volume(f"{asset_id}:afro-volume", (0, .045, 2.285), (.455, .390, .365), hair, owner, root, .072, .042)
        parts.append(afro)
    elif style == "short_side":
        cap.scale.z = .68
    if style == "back_cap_curls":
        cap_obj = cylinder(f"{asset_id}:cap", (0, .00, 2.39), .32, .13, materials["black"], owner, 18)
        brim = cube(f"{asset_id}:cap-brim", (0, .25, 2.38), (.22, .15, .025), materials["white"], owner, .025)
        parent_keep(cap_obj, root); parent_keep(brim, root); parts += [cap_obj, brim]
    return parts


def stripe_panel(asset_id, owner, root, materials, name, x, z, width, height, mat_name, back=False, rotation=0):
    panel = cube(f"{asset_id}:{name}", (x, .248 if back else -.252, z), (width, .014, height), materials[mat_name], owner, .007, (0, radians(rotation), 0))
    parent_keep(panel, root)
    return panel


def apply_torso_pattern(torso, outfit, materials):
    smooth_patterns = {
        "player_green_vertical": ("white", "green", "X", 1.75),
        "player_red_black_horizontal": ("black", "red", "Z", 4.5),
        "street_black_white": ("white", "black", "X", 3.5),
        "sport_blue_black": ("black", "blue_light", "X", 3.0),
    }
    if outfit in smooth_patterns:
        color_a, color_b, direction, scale = smooth_patterns[outfit]
        torso.data.materials.clear()
        torso.data.materials.append(striped_material(outfit, color_a, color_b, direction, scale))
        for polygon in torso.data.polygons:
            polygon.material_index = 0
        return
    schemes = {
        "wine_green_vertical": ("wine", "green", "white"),
        "white_diagonal": ("white", "black", "red"),
        "blue_red_white": ("blue", "red", "white"),
        "elegant_red": ("red", "blue"),
    }
    names = schemes.get(outfit)
    if not names:
        return
    torso.data.materials.clear()
    for name in names:
        torso.data.materials.append(materials[name])
    max_x = max(abs(vertex.co.x) for vertex in torso.data.vertices)
    max_z = max(abs(vertex.co.z) for vertex in torso.data.vertices)
    for polygon in torso.data.polygons:
        center = polygon.center
        nx = center.x / max(.001, max_x)
        nz = center.z / max(.001, max_z)
        if outfit == "player_red_black_horizontal":
            polygon.material_index = 1 if int((nz + 1) * 4.5) % 2 else 0
        elif outfit in {"player_green_vertical", "street_black_white", "sport_blue_black"}:
            polygon.material_index = 1 if int((nx + 1) * 4.0) % 2 else 0
        elif outfit == "wine_green_vertical":
            polygon.material_index = 0 if nx < -.30 else 1 if nx < .30 else 2
        elif outfit == "white_diagonal":
            diagonal = nx + nz * .78
            polygon.material_index = 1 if abs(diagonal) < .22 else 2 if .22 <= diagonal < .38 else 0
        elif outfit == "blue_red_white":
            polygon.material_index = 1 if abs(nx - nz) < .23 else 2 if abs(nx + nz) < .18 else 0
        elif outfit == "elegant_red":
            polygon.material_index = 1 if abs(nx) < .42 else 0


def add_clothes(asset_id, definition, owner, root, materials):
    outfit = definition["outfit"]
    parts = []
    if outfit == "player_green_vertical":
        collar = torus(f"{asset_id}:green-collar", (0, 0, 1.70), .13, .022, materials["green"], owner); collar.scale.z = .55; parent_keep(collar, root); parts.append(collar)
        hem = cylinder(f"{asset_id}:jersey-hem", (0, 0, 1.105), .264, .030, materials["green"], owner, 28); hem.scale.y = .74; parent_keep(hem, root); parts.append(hem)
        badge = cylinder(f"{asset_id}:jersey-badge", (.205, -.235, 1.500), .048, .010, materials["green"], owner, 24, (radians(90), 0, 0))
        badge_inner = cylinder(f"{asset_id}:jersey-badge-inner", (.205, -.242, 1.500), .026, .010, materials["yellow"], owner, 20, (radians(90), 0, 0))
        for part in (badge, badge_inner): parent_keep(part, root); parts.append(part)
    elif outfit == "player_red_black_horizontal":
        collar = torus(f"{asset_id}:red-collar", (0, 0, 1.70), .13, .022, materials["red"], owner); collar.scale.z = .55; parent_keep(collar, root); parts.append(collar)
        hem = cylinder(f"{asset_id}:jersey-hem", (0, 0, 1.105), .264, .030, materials["red"], owner, 28); hem.scale.y = .74; parent_keep(hem, root); parts.append(hem)
    elif outfit == "cook_white":
        apron = cone(f"{asset_id}:black-apron", (0, -.255, 1.23), .31, .23, .72, materials["black"], owner, 18)
        apron.scale.y = .12; parent_keep(apron, root); parts.append(apron)
        parts += [stripe_panel(asset_id, owner, root, materials, "green-piping", -.18, 1.48, .022, .29, "green"), stripe_panel(asset_id, owner, root, materials, "yellow-piping", .18, 1.48, .022, .29, "yellow")]
        for index, (x, z) in enumerate(((-.10, 1.53), (.10, 1.53), (-.10, 1.36), (.10, 1.36))):
            button = sphere(f"{asset_id}:chef-button:{index}", (x, -.288, z), (.018, .012, .018), materials["gold"], owner, 10, 5); parent_keep(button, root); parts.append(button)
    elif outfit == "waiter_wine":
        apron = cone(f"{asset_id}:waiter-apron", (0, -.25, 1.12), .34, .25, .68, materials["black"], owner, 18)
        apron.scale.y = .12; parent_keep(apron, root); parts.append(apron)
        cloth = cube(f"{asset_id}:blue-cloth", (.28, -.27, .92), (.055, .025, .22), materials["blue_light"], owner, .015)
        parent_keep(cloth, root); parts.append(cloth)
    elif outfit == "street_black_white":
        pass
    elif outfit == "elegant_red":
        collar = torus(f"{asset_id}:elegant-collar", (0, 0, 1.69), .14, .020, materials["blue"], owner)
        collar.scale.z = .55
        parent_keep(collar, root); parts.append(collar)
        for index, z in enumerate((1.50, 1.38, 1.26)):
            button = sphere(f"{asset_id}:elegant-button:{index}", (0, -.263, z), (.014, .010, .014), materials["gold"], owner, 12, 6)
            parent_keep(button, root); parts.append(button)
    elif outfit == "wine_green_vertical":
        pass
    elif outfit == "sport_blue_black":
        pass
    elif outfit == "white_diagonal":
        pass
    elif outfit == "blue_red_white":
        belt = torus(f"{asset_id}:fabric-belt", (0, 0, 1.08), .29, .035, materials["blue_light"], owner); parent_keep(belt, root); parts.append(belt)
    return parts


def add_accessories(asset_id, definition, owner, root, materials):
    acc = definition["accessory"]
    parts = []
    if "glasses" in acc:
        for side, x in (("L", -.105), ("R", .105)):
            glass = torus(f"{asset_id}:glasses.{side}", (x, -.307, 2.045), .070, .012, materials["black"], owner, (radians(90), 0, 0)); parent_keep(glass, root); parts.append(glass)
        bridge = cube(f"{asset_id}:glasses-bridge", (0, -.307, 2.045), (.030, .010, .010), materials["black"], owner, .004); parent_keep(bridge, root); parts.append(bridge)
    if acc == "glasses_moustache":
        moustache = cube(f"{asset_id}:moustache", (0, -.312, 1.948), (.105, .013, .028), materials[definition["hair"]], owner, .012); parent_keep(moustache, root); parts.append(moustache)
    if acc in {"watch", "sport_watch"}:
        watch = torus(f"{asset_id}:watch", (.39, -.01, 1.10), .08, .018, materials["black"], owner, (0, radians(90), 0)); parent_keep(watch, root); parts.append(watch)
    if acc == "bracelets":
        for index, color in enumerate(("gold", "red")):
            band = torus(f"{asset_id}:bracelet-{index}", (-.39, -.01, 1.09 - index * .04), .078, .014, materials[color], owner, (0, radians(90), 0)); parent_keep(band, root); parts.append(band)
    if acc in {"crossbody", "handbag", "round_glasses_backpack"}:
        bag_color = "black" if acc != "handbag" else "blue"
        bag = cube(f"{asset_id}:bag", (.37, .08, 1.00), (.15, .10, .23), materials[bag_color], owner, .045)
        strap = cube(f"{asset_id}:bag-strap", (.08, -.01, 1.42), (.025, .035, .48), materials[bag_color], owner, .008, (0, radians(-18), 0))
        for part in (bag, strap): parent_keep(part, root); parts.append(part)
        bag["hideWhenSeated"] = True
    if acc == "color_earrings":
        for side, x, color in (("L", -.31, "yellow"), ("R", .31, "red")):
            ring = torus(f"{asset_id}:earring.{side}", (x, -.03, 1.99), .070, .018, materials[color], owner, (radians(90), 0, 0)); parent_keep(ring, root); parts.append(ring)
    return parts


def create_character(definition, parent_collection, materials):
    asset_id = definition["assetId"]
    owner = collection(asset_id, parent_collection)
    root = empty(f"{asset_id}:root", (0, 0, 0), owner)
    root["assetId"] = asset_id
    root["displayName"] = definition["displayName"]
    root["role"] = definition["role"]
    root["bodyProfile"] = definition["body"]
    root["sourceOriginality"] = "procedural-original-Blender-mesh"
    root["feetAnchor"] = list(FEET_ANCHOR)
    root["logicalFootprint"] = [1, 1]
    root["referenceIdentityOrder"] = CHARACTERS.index(definition) + 1
    root.scale = (definition["width"], definition["width"], definition["height"])

    skin = materials[definition["skin"]]
    outfit_base = {
        "player_green_vertical": "white", "player_red_black_horizontal": "black", "cook_white": "white",
        "waiter_wine": "wine", "street_black_white": "white", "elegant_red": "red",
        "wine_green_vertical": "wine", "sport_blue_black": "black", "white_diagonal": "white",
        "blue_red_white": "blue",
    }[definition["outfit"]]
    pants_name = {
        "denim": "denim", "checkered": "white", "black": "black", "khaki_shorts": "khaki",
        "white": "white", "beige_shorts": "beige", "sport_black": "black", "brown": "brown", "blue": "blue",
    }[definition["pants"]]
    shoe_name = {"green_white": "green", "red_black": "red", "white": "white", "black": "black", "black_white": "black", "red": "red", "brown_sandals": "brown", "blue_black": "blue", "red_sandals": "red"}[definition["shoes"]]
    torso_scale = {
        "slim": (.31, .22, .40), "athletic": (.37, .24, .41), "curvy": (.39, .255, .41),
        "strong": (.43, .28, .42), "tall": (.36, .24, .43), "soft": (.38, .26, .40),
        "large": (.48, .32, .43),
    }[definition["body"]]
    hip_scale = (torso_scale[0] * (1.03 if definition["presentation"] == "feminina" else .84), torso_scale[1] * .92, .21)
    torso = profile_mesh(
        f"{asset_id}:torso",
        [
            (1.045, torso_scale[0] * .62, torso_scale[1] * .76),
            (1.115, torso_scale[0] * .82, torso_scale[1] * .88),
            (1.300, torso_scale[0] * .95, torso_scale[1] * .98),
            (1.515, torso_scale[0], torso_scale[1]),
            (1.650, torso_scale[0] * .88, torso_scale[1] * .92),
            (1.720, torso_scale[0] * .50, torso_scale[1] * .66),
        ],
        materials[outfit_base], owner, 36, .034,
    )
    apply_torso_pattern(torso, definition["outfit"], materials)
    hips = profile_mesh(
        f"{asset_id}:hips",
        [
            (.925, hip_scale[0] * .76, hip_scale[1] * .84),
            (.985, hip_scale[0] * .96, hip_scale[1]),
            (1.090, hip_scale[0], hip_scale[1]),
            (1.165, hip_scale[0] * .88, hip_scale[1] * .90),
        ],
        materials[pants_name], owner, 32, .025,
    )
    neck = cylinder(f"{asset_id}:neck", (0, 0, 1.80), .105, .16, skin, owner, 14)
    for part in (torso, hips, neck): parent_keep(part, root)
    add_face(asset_id, definition, owner, root, materials)
    add_hair(asset_id, definition, owner, root, materials)
    add_clothes(asset_id, definition, owner, root, materials)
    add_accessories(asset_id, definition, owner, root, materials)

    arm_radius = .105 if definition["body"] not in {"strong", "large"} else .125
    leg_radius = .135 if definition["body"] != "large" else .16
    sleeve = (
        striped_material("player_green_vertical_sleeve", "white", "green", "X", 1.5)
        if definition["outfit"] == "player_green_vertical"
        else striped_material("player_red_black_horizontal_sleeve", "black", "red", "Z", 3.2)
        if definition["outfit"] == "player_red_black_horizontal"
        else materials[outfit_base]
    )
    arm_l = limb(asset_id, "L", "arm", (-torso_scale[0], 0, 1.62), .60, arm_radius, sleeve, skin, owner, root, materials["skin_shadow"])
    arm_r = limb(asset_id, "R", "arm", (torso_scale[0], 0, 1.62), .60, arm_radius, sleeve, skin, owner, root, materials["skin_shadow"])
    if definition["outfit"] in {"player_green_vertical", "player_red_black_horizontal"}:
        cuff_material = materials["green" if definition["outfit"] == "player_green_vertical" else "red"]
        seam_material = materials["cloth_green_dark" if definition["outfit"] == "player_green_vertical" else "red"]
        sleeve_end_z = 1.62 - (.60 * .49 * .54)
        for side, x in (("L", -torso_scale[0]), ("R", torso_scale[0])):
            cuff = torus(f"{asset_id}:sleeve-tailored-cuff:{side}", (x, 0, sleeve_end_z), arm_radius * .91, arm_radius * .055, cuff_material, owner)
            arm_joint = bpy.data.objects[f"{asset_id}:arm.{side}"]
            parent_keep(cuff, arm_joint)
            sleeve_seam = curve_line(
                f"{asset_id}:sleeve-seam:{side}",
                [(x, -arm_radius * .91, 1.602), (x, -arm_radius * .98, 1.545), (x, -arm_radius * .86, sleeve_end_z + .008)],
                .0045, seam_material, owner, (x, 0, 1.62),
            )
            parent_local(sleeve_seam, arm_joint)
        for fold_index, x in enumerate((-.145, .145)):
            fold = curve_line(
                f"{asset_id}:jersey-fold:{fold_index}",
                [(x, -torso_scale[1] * .985, 1.120), (x * .92, -torso_scale[1] * 1.015, 1.175), (x * .82, -torso_scale[1] * .99, 1.235)],
                .0035, materials["cloth_white_shadow"], owner,
            )
            parent_keep(fold, root)
    watch = bpy.data.objects.get(f"{asset_id}:watch")
    if watch:
        parent_keep(watch, bpy.data.objects[f"{asset_id}:arm.R:bend"])
    leg_detail = materials["denim_dark"] if definition["pants"] == "denim" else materials[pants_name]
    leg_l = limb(asset_id, "L", "leg", (-.15, 0, .98), .78, leg_radius, materials[pants_name], materials[shoe_name], owner, root, leg_detail)
    leg_r = limb(asset_id, "R", "leg", (.15, 0, .98), .78, leg_radius, materials[pants_name], materials[shoe_name], owner, root, leg_detail)

    if definition["shoes"] in {"green_white", "red_black", "black_white", "blue_black"}:
        accent = materials["white" if definition["shoes"] in {"green_white", "black_white"} else "black"]
        for side, x in (("L", -.15), ("R", .15)):
            foot_parent = bpy.data.objects[f"{asset_id}:leg.{side}:bend"]
            sole = cube(f"{asset_id}:shoe-detail:{side}:sole", (x, -.115, .145), (leg_radius * .92, leg_radius * 1.52, .025), materials["white"], owner, .025)
            side_panel = sphere(f"{asset_id}:shoe-detail:{side}:panel", (x, -.205, .205), (leg_radius * .72, .035, .055), accent, owner, 20, 10)
            parent_keep(sole, foot_parent); parent_keep(side_panel, foot_parent)
            for lace_index in range(3):
                lace = cube(
                    f"{asset_id}:shoe-detail:{side}:lace:{lace_index}",
                    (x, -.145 - lace_index * .040, .258),
                    (leg_radius * .46, .010, .006), materials["white"], owner, .005,
                )
                parent_keep(lace, foot_parent)

    if definition["pants"] in {"khaki_shorts", "beige_shorts"}:
        for side, x in (("L", -.15), ("R", .15)):
            patch = cube(f"{asset_id}:shorts.{side}", (x, -.01, .91), (.16, .19, .20), materials[pants_name], owner, .04); parent_keep(patch, root)
    if definition["pants"] == "checkered":
        for row in range(4):
            for col, x in enumerate((-.15, .15)):
                patch = cube(f"{asset_id}:check:{row}:{col}", (x + (.04 if row % 2 else -.04), -.142, .84 - row * .12), (.045, .012, .045), materials["black"], owner, .004); parent_keep(patch, root)
    if definition["pants"] == "sport_black":
        for x in (-.27, .27):
            stripe = cube(f"{asset_id}:pants-blue-stripe:{x}", (x, -.01, .62), (.020, .15, .38), materials["blue_light"], owner, .006); parent_keep(stripe, root)
    if definition["pants"] == "denim":
        waistband = cylinder(f"{asset_id}:denim-waistband", (0, .01, 1.115), hip_scale[0] * .88, .045, materials["denim_light"], owner, 28)
        waistband.scale.y = hip_scale[1] / max(.001, hip_scale[0]) * .92
        parent_keep(waistband, root)
        fly = curve_line(
            f"{asset_id}:denim-fly",
            [(0, -hip_scale[1] * .88, 1.125), (-.012, -hip_scale[1] * .94, 1.055), (.012, -hip_scale[1] * .92, .995)],
            .006, materials["denim_light"], owner,
        )
        parent_keep(fly, root)
        for side, x, direction in (("L", -.145, -1), ("R", .145, 1)):
            pocket = curve_line(
                f"{asset_id}:denim-pocket:{side}",
                [(x - direction * .070, -hip_scale[1] * .93, 1.105), (x, -hip_scale[1] * 1.02, 1.065), (x + direction * .055, -hip_scale[1] * .94, 1.095)],
                .006, materials["denim_light"], owner,
            )
            belt_loop = cube(f"{asset_id}:denim-belt-loop:{side}", (x, -hip_scale[1] * .96, 1.137), (.013, .010, .032), materials["denim_light"], owner, .005)
            parent_keep(pocket, root); parent_keep(belt_loop, root)
        for side, x in (("L", -.15), ("R", .15)):
            upper_parent = bpy.data.objects[f"{asset_id}:leg.{side}"]
            lower_parent = bpy.data.objects[f"{asset_id}:leg.{side}:bend"]
            upper_origin = (x, 0, .98)
            lower_origin = (x, 0, .98 - .78 * .49)
            upper_seam = curve_line(
                f"{asset_id}:denim-leg-seam-upper:{side}",
                [(x, -leg_radius * .90, .955), (x, -leg_radius * .96, .785), (x, -leg_radius * .82, .625)],
                .0045, materials["denim_light"], owner, upper_origin,
            )
            lower_seam = curve_line(
                f"{asset_id}:denim-leg-seam-lower:{side}",
                [(x, -leg_radius * .80, .575), (x, -leg_radius * .92, .440), (x, -leg_radius * .66, .285)],
                .0040, materials["denim_light"], owner, lower_origin,
            )
            knee_fold = curve_line(
                f"{asset_id}:denim-knee-fold:{side}",
                [(x - leg_radius * .40, -leg_radius * .80, .610), (x, -leg_radius * .88, .595), (x + leg_radius * .38, -leg_radius * .79, .615)],
                .0045, materials["denim_dark"], owner, lower_origin,
            )
            parent_local(upper_seam, upper_parent)
            parent_local(lower_seam, lower_parent)
            parent_local(knee_fold, lower_parent)
            cuff = torus(f"{asset_id}:denim-cuff:{side}", (x, 0, .255), leg_radius * .74, .010, materials["denim_light"], owner)
            cuff.scale.y = .88
            parent_keep(cuff, lower_parent)

    props = {}
    props["plate"] = cylinder(f"{asset_id}:prop:plate", (0, -.56, 1.22), .27, .035, materials["white"], owner, 20)
    props["tray"] = cylinder(f"{asset_id}:prop:tray", (0, -.55, 1.30), .34, .035, materials["steel"], owner, 20)
    props["cup"] = cylinder(f"{asset_id}:prop:cup", (.10, -.58, 1.28), .075, .17, materials["white"], owner, 16)
    props["ingredient"] = cube(f"{asset_id}:prop:ingredient", (0, -.55, 1.16), (.25, .18, .17), materials["khaki"], owner, .035)
    props["spoon"] = cylinder(f"{asset_id}:prop:spoon", (.16, -.55, 1.14), .018, .45, materials["steel"], owner, 10, (radians(90), 0, 0))
    for prop in props.values():
        prop.hide_render = True
        parent_keep(prop, root)
    shadow = cylinder(f"{asset_id}:shadow", (0, 0, .008), .46, .012, materials["shadow"], owner, 20)
    shadow.scale.y = .55
    parent_keep(shadow, root)

    markers = collection(f"{asset_id}_MARKERS", owner)
    for marker_name, location in (("origin", (0, 0, 0)), ("feetAnchor", (0, 0, 0)), ("carriedItemAnchor", (0, -.55, 1.22)), ("frontDirection", (0, -.45, .05))):
        marker = empty(f"{asset_id}:{marker_name}", location, markers, root)
        marker["technicalMarker"] = True
    rig_owner = collection(f"{asset_id}_RIGS", owner)
    rig = create_rig(asset_id, rig_owner, definition["height"])
    rig.parent = root
    create_animation_library(rig, definition)
    owner["animationCount"] = len(definition["animations"])
    owner["animations"] = list(definition["animations"])
    owner["fourDirectionsReal"] = True
    owner["originBetweenFeet"] = True
    owner["facialStates"] = ["friendly_neutral", "blink", "smile", "talk", "happy", "wait", "impatient", "eat", "drink"]
    owner.hide_render = True
    return owner, root


def create_canonical_props(materials):
    work = collection("WORK_PROPS")
    food = collection("FOOD_PROPS")
    cylinder("PROP_tray", (0, 0, .04), .34, .04, materials["steel"], work, 20)
    cylinder("PROP_plate", (0, 0, .03), .27, .035, materials["white"], food, 20)
    cylinder("PROP_cup", (0, 0, .09), .075, .18, materials["white"], food, 16)
    cube("PROP_cutlery", (0, 0, .015), (.018, .18, .012), materials["steel"], food, .004)
    cube("PROP_ingredient_crate", (0, 0, .17), (.25, .18, .17), materials["khaki"], work, .035)
    cylinder("PROP_spoon", (0, 0, .20), .018, .45, materials["steel"], work, 10, (radians(90), 0, 0))
    work.hide_render = True
    food.hide_render = True


def build_scene(project_root: Path, reference_path: Path):
    clear_scene()
    scene = configure_scene()
    top = {name: collection(name) for name in COLLECTION_NAMES}
    materials = {name: material(name) for name in COLORS}
    create_scale_references(materials)
    create_canonical_props(materials)
    pack_reference(reference_path)
    characters_root = top["CHARACTERS"]
    roots = {}
    for definition in CHARACTERS:
        _owner, root = create_character(definition, characters_root, materials)
        roots[definition["assetId"]] = root
    return scene, roots, materials


def object_snapshot(owner):
    result = {}
    for obj in owner.all_objects:
        result[obj.name] = (obj.location.copy(), obj.rotation_euler.copy(), obj.scale.copy(), obj.hide_render)
    return result


def reset_snapshot(owner, snapshot):
    for obj in owner.all_objects:
        if obj.name in snapshot:
            loc, rot, scale, hidden = snapshot[obj.name]
            obj.location = loc.copy(); obj.rotation_euler = rot.copy(); obj.scale = scale.copy(); obj.hide_render = hidden


def set_face(asset_id, smile=0.0, talk=0.0, impatient=0.0, blink=0.0, happy=0.0):
    head = bpy.data.objects.get(f"{asset_id}:head")
    if head and head.data.shape_keys:
        for key in head.data.shape_keys.key_blocks[1:]:
            key.value = 0
        if "Smile" in head.data.shape_keys.key_blocks: head.data.shape_keys.key_blocks["Smile"].value = smile
        if "Talk" in head.data.shape_keys.key_blocks: head.data.shape_keys.key_blocks["Talk"].value = talk
        if "Happy" in head.data.shape_keys.key_blocks: head.data.shape_keys.key_blocks["Happy"].value = happy
        if "Impatient" in head.data.shape_keys.key_blocks: head.data.shape_keys.key_blocks["Impatient"].value = impatient
    for side in ("L", "R"):
        eye = bpy.data.objects.get(f"{asset_id}:eye-white.{side}")
        iris = bpy.data.objects.get(f"{asset_id}:eye.{side}")
        pupil = bpy.data.objects.get(f"{asset_id}:pupil.{side}")
        highlight = bpy.data.objects.get(f"{asset_id}:eye-highlight.{side}")
        if eye: eye.scale.z = max(.06, 1 - blink * .94)
        if iris: iris.scale.z = max(.06, 1 - blink * .94)
        if pupil: pupil.scale.z = max(.06, 1 - blink * .94)
        if highlight: highlight.scale.z = max(.06, 1 - blink * .94)
    mouth = bpy.data.objects.get(f"{asset_id}:mouth")
    teeth = bpy.data.objects.get(f"{asset_id}:teeth")
    if mouth: mouth.scale.z = 1 + talk * 1.8 + smile * .3
    if teeth: teeth.hide_render = talk > .70 or impatient > .60


def pose_character(definition, owner, snapshot, animation, frame, direction):
    reset_snapshot(owner, snapshot)
    asset_id = definition["assetId"]
    root = bpy.data.objects[f"{asset_id}:root"]
    frame_count = definition["animations"][animation]
    t = frame / max(1, frame_count - 1)
    cycle = sin(tau * t)
    half = sin(pi * t)
    root.rotation_euler.z = radians(DIRECTIONS[direction][0])
    arm_l = bpy.data.objects[f"{asset_id}:arm.L"]; arm_r = bpy.data.objects[f"{asset_id}:arm.R"]
    leg_l = bpy.data.objects[f"{asset_id}:leg.L"]; leg_r = bpy.data.objects[f"{asset_id}:leg.R"]
    elbow_l = bpy.data.objects[f"{asset_id}:arm.L:bend"]; elbow_r = bpy.data.objects[f"{asset_id}:arm.R:bend"]
    knee_l = bpy.data.objects[f"{asset_id}:leg.L:bend"]; knee_r = bpy.data.objects[f"{asset_id}:leg.R:bend"]
    braid = bpy.data.objects.get(f"{asset_id}:braid-rig")
    props = {name: bpy.data.objects.get(f"{asset_id}:prop:{name}") for name in ("plate", "tray", "cup", "ingredient", "spoon")}
    seated = animation in {"sit_down", "seated_idle", "stand_up", "wait_food", "eat", "drink", "talk_seated", "react_impatient"}
    seated_amount = t if animation == "sit_down" else 1 - t if animation == "stand_up" else 1.0 if seated else 0.0
    if seated_amount:
        root.location.z -= .38 * seated_amount
        root.location.y += .06 * seated_amount
        # The character's authored front is local -Y. Negative thigh rotation
        # sends the knees toward that front; the inverse signs used previously
        # made the torso face the table while both legs folded behind the chair.
        leg_l.rotation_euler.x = leg_r.rotation_euler.x = radians(-76 * seated_amount)
        knee_l.rotation_euler.x = knee_r.rotation_euler.x = radians(82 * seated_amount)
    if animation == "walk" or animation.endswith("_walk"):
        stride = .55 * cycle
        arm_l.rotation_euler.x = stride; arm_r.rotation_euler.x = -stride
        leg_l.rotation_euler.x = -stride; leg_r.rotation_euler.x = stride
        knee_l.rotation_euler.x = max(0, .30 * cycle); knee_r.rotation_euler.x = max(0, -.30 * cycle)
        root.location.z += .035 * abs(cycle)
        root.rotation_euler.y += radians(1.5) * cycle
        if braid: braid.rotation_euler.x = -.12 * cycle
    elif animation in {"idle", "seated_idle", "wait", "wait_workstation", "wait_service", "wait_food"}:
        root.location.z += .012 * sin(pi * frame / max(1, frame_count - 1))
        root.rotation_euler.y += radians(.8) * cycle
        set_face(asset_id, smile=.48, blink=1.0 if frame == 2 and animation == "idle" else 0.0)
    elif animation in {"talk", "talk_seated"}:
        arm_r.rotation_euler.x = radians(-28) - .22 * cycle
        elbow_r.rotation_euler.x = radians(-52) + .14 * cycle
        set_face(asset_id, smile=.35, talk=.45 + .45 * abs(cycle))
    elif animation == "react_happy":
        arm_l.rotation_euler.x = radians(-95 * half); arm_r.rotation_euler.x = radians(-95 * half)
        elbow_l.rotation_euler.z = radians(-18); elbow_r.rotation_euler.z = radians(18)
        root.location.z += .05 * half
        set_face(asset_id, smile=1, happy=1)
    elif "carry_plate" in animation:
        arm_l.rotation_euler.x = arm_r.rotation_euler.x = radians(-42)
        elbow_l.rotation_euler.x = elbow_r.rotation_euler.x = radians(-62)
        props["plate"].hide_render = False
        set_face(asset_id, smile=.42)
    elif "carry_tray" in animation:
        arm_l.rotation_euler.x = radians(-50); elbow_l.rotation_euler.x = radians(-70)
        props["tray"].hide_render = False
        set_face(asset_id, smile=.45)
    elif "carry_ingredient" in animation:
        arm_l.rotation_euler.x = arm_r.rotation_euler.x = radians(-38)
        elbow_l.rotation_euler.x = elbow_r.rotation_euler.x = radians(-58)
        props["ingredient"].hide_render = False
    elif animation in {"pickup_dish", "place_dish", "pickup_ingredient", "serve_table", "clear_table"}:
        reach = half
        arm_r.rotation_euler.x = radians(-20 - 60 * reach)
        elbow_r.rotation_euler.x = radians(-20 - 45 * reach)
        arm_l.rotation_euler.x = radians(-18 - 35 * reach)
        if animation in {"pickup_dish", "place_dish", "serve_table", "clear_table"}: props["plate"].hide_render = not (t > .45 if animation.startswith("pickup") else t < .60)
        else: props["ingredient"].hide_render = not (t > .45)
    elif animation in {"cook_stove", "prep_counter", "wash_sink", "clean_table"}:
        amplitude = .28 if animation != "clean_table" else .48
        arm_l.rotation_euler.x = radians(-42) + amplitude * cycle
        arm_r.rotation_euler.x = radians(-46) - amplitude * cycle
        elbow_l.rotation_euler.x = elbow_r.rotation_euler.x = radians(-58)
        props["spoon"].hide_render = animation not in {"cook_stove", "prep_counter"}
        set_face(asset_id, smile=.25, talk=.12 * abs(cycle))
    elif animation == "eat":
        props["plate"].hide_render = False
        arm_r.rotation_euler.x = radians(-45 - 22 * half)
        elbow_r.rotation_euler.x = radians(-68 - 18 * half)
        set_face(asset_id, smile=.30, talk=.45 * half)
    elif animation == "drink":
        props["cup"].hide_render = False
        arm_r.rotation_euler.x = radians(-48 - 35 * half)
        elbow_r.rotation_euler.x = radians(-72 - 18 * half)
        set_face(asset_id, smile=.22, talk=.24 * half)
    elif animation == "react_impatient":
        arm_l.rotation_euler.z = radians(-25); arm_r.rotation_euler.z = radians(25)
        knee_r.rotation_euler.x += .18 * cycle
        set_face(asset_id, impatient=.85)
    else:
        set_face(asset_id, smile=.35)
    if animation not in {"idle", "seated_idle", "wait", "wait_workstation", "wait_service", "wait_food", "talk", "talk_seated", "react_happy", "react_impatient", "eat", "drink"}:
        set_face(asset_id, smile=.34, blink=1.0 if frame_count > 4 and frame == frame_count - 2 else 0.0)


def render_pixels(width, height):
    scene = bpy.context.scene
    engine_ids = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    workbench = next((candidate for candidate in ("BLENDER_WORKBENCH_NEXT", "BLENDER_WORKBENCH") if candidate in engine_ids), None)
    if workbench:
        scene.render.engine = workbench
        shading = scene.display.shading
        shading.light = "STUDIO"
        shading.studio_light = "paint.sl"
        shading.color_type = "MATERIAL"
        shading.show_shadows = True
        shading.show_cavity = True
        shading.cavity_type = "WORLD"
        shading.curvature_ridge_factor = 1.35
        shading.curvature_valley_factor = 1.10
        shading.show_specular_highlight = True
        shading.show_object_outline = True
        shading.object_outline_color = (.08, .035, .02)
        scene["spriteRenderEngine"] = "Blender Workbench Studio — deterministic cartoon volume"
    scene.render.resolution_x = width * MASTER_SCALE
    scene.render.resolution_y = height * MASTER_SCALE
    scene.render.resolution_percentage = 100
    with tempfile.TemporaryDirectory(prefix="c3-br-render-") as temp_dir:
        render_path = Path(temp_dir) / "master.png"
        scene.render.filepath = str(render_path)
        bpy.ops.render.render(write_still=True)
        source = bpy.data.images.load(str(render_path), check_existing=False)
        source_width, source_height = source.size
        raw = array("f", [0.0]) * (source_width * source_height * 4)
        source.pixels.foreach_get(raw)
        bpy.data.images.remove(source)
    temp = bpy.data.images.new("C3BR_Downsample", source_width, source_height, alpha=True)
    temp.pixels.foreach_set(raw)
    temp.scale(width, height)
    output = array("f", [0.0]) * (width * height * 4)
    temp.pixels.foreach_get(output)
    bpy.data.images.remove(temp)
    for index in range(0, len(output), 4):
        alpha = output[index + 3]
        output[index + 3] = 0.0 if alpha < .035 else .25 if alpha < .25 else .65 if alpha < .72 else 1.0
        if output[index + 3] > 0:
            for channel in range(3):
                output[index + channel] = round(output[index + channel] * 31) / 31
    return output


def save_pixels(path: Path, width, height, pixels):
    path.parent.mkdir(parents=True, exist_ok=True)
    image = bpy.data.images.new(f"C3BR_{path.stem}", width, height, alpha=True)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def blit(target, target_width, frame, frame_width, frame_height, column, row_top, rows):
    target_height = frame_height * rows
    x_offset = column * frame_width
    y_offset = target_height - (row_top + 1) * frame_height
    for y in range(frame_height):
        source_start = y * frame_width * 4
        target_start = ((y_offset + y) * target_width + x_offset) * 4
        target[target_start:target_start + frame_width * 4] = frame[source_start:source_start + frame_width * 4]


def render_character(definition, project_root: Path):
    asset_id = definition["assetId"]
    owner = bpy.data.collections[asset_id]
    snapshot = object_snapshot(owner)
    characters = bpy.data.collections["CHARACTERS"]
    for child in characters.children:
        child.hide_render = child.name != asset_id
    owner.hide_render = False
    camera = bpy.data.objects["C3BR_GameCamera"]
    bpy.context.scene.camera = camera
    camera.data.ortho_scale = 3.05
    camera.location = (6, -6, 6)
    aim(camera, (0, 0, 1.23))
    frame_w, frame_h = FRAME_SIZE
    columns = sum(definition["animations"].values())
    sheet_w, sheet_h = columns * frame_w, len(DIRECTIONS) * frame_h
    sheet = array("f", [0.0]) * (sheet_w * sheet_h * 4)
    source_root = project_root / "assets/characters/c3_br" / definition["short"]
    column_index = 0
    representative = None
    for direction_row, direction in enumerate(DIRECTIONS):
        column_index = 0
        for animation, frame_count in definition["animations"].items():
            if animation == "walk" or animation.endswith("_walk"):
                unique_count = frame_count
            elif animation in {"cook_stove", "prep_counter", "wash_sink", "clean_table", "eat", "drink"}:
                unique_count = min(4, frame_count)
            elif animation in {"sit_down", "stand_up", "talk", "react_happy", "pickup_dish", "place_dish", "pickup_ingredient", "serve_table", "clear_table", "talk_seated", "react_impatient"}:
                unique_count = min(3, frame_count)
            else:
                unique_count = min(2, frame_count)
            unique_pixels = []
            for phase in range(unique_count):
                source_frame = round(phase * (frame_count - 1) / max(1, unique_count - 1))
                pose_character(definition, owner, snapshot, animation, source_frame, direction)
                unique_pixels.append(render_pixels(frame_w, frame_h))
            for frame in range(frame_count):
                phase = round(frame * (unique_count - 1) / max(1, frame_count - 1))
                pixels = unique_pixels[phase]
                if direction == "se" and animation == "idle" and frame == 0:
                    representative = array("f", pixels)
                blit(sheet, sheet_w, pixels, frame_w, frame_h, column_index, direction_row, len(DIRECTIONS))
                screen_direction = DIRECTIONS[direction][1]
                frame_path = source_root / f"{asset_id}_{animation}_{screen_direction}_{frame:03d}.png"
                save_pixels(frame_path, frame_w, frame_h, pixels)
                column_index += 1
    runtime = project_root / "assets/pixel/rendered/characters/c3_br" / definition["short"] / f"{asset_id}.png"
    deployed = project_root / "public/assets/pixel/rendered/characters/c3_br" / definition["short"] / f"{asset_id}.png"
    save_pixels(runtime, sheet_w, sheet_h, sheet)
    deployed.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(runtime, deployed)
    thumbnail = project_root / "assets/pixel/rendered/thumbnails" / f"{asset_id}.png"
    deployed_thumbnail = project_root / "public/assets/pixel/rendered/thumbnails" / f"{asset_id}.png"
    save_pixels(thumbnail, frame_w, frame_h, representative)
    deployed_thumbnail.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(thumbnail, deployed_thumbnail)
    reset_snapshot(owner, snapshot)
    owner.hide_render = True
    return runtime, deployed, thumbnail


def manifest_entry(definition):
    frame_count = sum(definition["animations"].values())
    return {
        "assetId": definition["assetId"], "displayName": definition["displayName"], "kind": "character",
        "role": definition["role"], "presentation": definition["presentation"], "bodyProfile": definition["body"],
        "category": f"characters/c3_br/{definition['short']}",
        "renderedFile": f"/assets/pixel/rendered/characters/c3_br/{definition['short']}/{definition['assetId']}.png",
        "spriteSheet": f"/assets/pixel/rendered/characters/c3_br/{definition['short']}/{definition['assetId']}.png",
        "thumbnail": f"/assets/pixel/rendered/thumbnails/{definition['assetId']}.png",
        "sourceBlend": "art_source/blender/characters/c3_br_characters.blend",
        "sourceCollection": definition["assetId"], "visualLevel": 1, "footprint": [1, 1],
        "anchor": list(FEET_ANCHOR), "orientations": list(DIRECTIONS),
        "screenDirections": {key: value[1] for key, value in DIRECTIONS.items()},
        "animations": dict(definition["animations"]), "frameCount": frame_count, "frameSize": list(FRAME_SIZE),
        "fps": {name: 8 if frames >= 8 else 6 for name, frames in definition["animations"].items()},
        "loops": {name: name not in {"sit_down", "stand_up", "pickup_dish", "place_dish", "pickup_ingredient", "serve_table", "clear_table"} for name in definition["animations"]},
        "events": {"pickup_dish": {"attach": .5}, "place_dish": {"release": .55}, "serve_table": {"release": .58}, "clear_table": {"attach": .48}},
        "fallback": "idle", "paletteVersion": QUALITY_PROFILE, "renderVersion": RENDER_VERSION,
        "qualityProfile": QUALITY_PROFILE, "transparent": True, "nativeScale": 1.0,
        "logicalHeightBlocks": round(1.82 * definition["height"], 3),
        "identityProfile": f"{definition['assetId']}:{definition['hairStyle']}:{definition['outfit']}",
        "visualSkinId": "c3-br-original", "referenceMode": "visual-reference-only-not-rendered",
        "rigId": "C3BR_Humanoid_v1", "facialRig": "bones+shape-keys",
        "visualBounds": {"widthCells": 1.0, "depthCells": 1.0, "heightBlocks": round(1.82 * definition["height"], 3), "overhangCells": .27},
    }


def write_manifests(project_root: Path):
    entries = [manifest_entry(definition) for definition in CHARACTERS]
    manifest = {
        "version": RENDER_VERSION, "gameVersion": VERSION, "qualityProfile": QUALITY_PROFILE,
        "style": "C3-BR — Cartoon 3D brasileiro em sprites Pixel 2.5D",
        "referenceUsage": "Packed in Blender for visual guidance only; never copied, cropped or animated.",
        "camera": {"projection": "orthographic", "location": [6, -6, 6], "horizontalAngle": 45, "inclination": 35.264, "orthoScale": 3.05, "tile": [64, 32], "zooms": [.5, 1, 2]},
        "lighting": {"rig": "c3_br_softbox_v1", "key": 950, "fill": 520, "rim": 430},
        "frame": {"size": list(FRAME_SIZE), "feetAnchor": list(FEET_ANCHOR), "transparent": True, "masterScale": MASTER_SCALE},
        "legacyAliases": {
            "player-style-0": "char_player_male_01", "player-style-1": "char_player_female_01",
            "cook-0": "char_cook_female_01", "cook-1": "char_cook_female_01",
            "waiter-0": "char_waiter_male_01", "waiter-1": "char_waiter_male_01",
            "cleaner-0": "char_player_female_01", "stocker-0": "char_player_male_01",
            **{f"customer-{index}": f"char_customer_{index % 6 + 1:02d}" for index in range(10)},
        },
        "assets": entries,
    }
    public_manifest = project_root / "public/assets/pixel/rendered/c3-br-character-manifest.json"
    source_manifest = project_root / "assets/characters/c3_br/manifests/c3-br-character-manifest.json"
    for path in (public_manifest, source_manifest):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    for entry in entries:
        short = next(item["short"] for item in CHARACTERS if item["assetId"] == entry["assetId"])
        path = project_root / "assets/characters/c3_br/manifests" / f"{short}.json"
        path.write_text(json.dumps(entry, ensure_ascii=False, indent=2), encoding="utf-8")
    for legacy_id, asset_id in manifest["legacyAliases"].items():
        source = project_root / "public/assets/pixel/rendered/thumbnails" / f"{asset_id}.png"
        if source.exists():
            for root in (project_root / "public/assets/pixel/rendered/thumbnails", project_root / "assets/pixel/rendered/thumbnails"):
                root.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, root / f"{legacy_id}.png")
    compact = json.dumps(entries, ensure_ascii=False, separators=(",", ":"))
    aliases = json.dumps(manifest["legacyAliases"], ensure_ascii=False, separators=(",", ":"))
    ts = project_root / "src/assets/pixel/c3brManifest.ts"
    ts.write_text(
        "// Generated by tools/blender/c3_br_v007.py.\n"
        "import type { BlenderRenderedAsset } from './blenderManifest';\n"
        "export type C3BrRenderedAsset = Omit<BlenderRenderedAsset,'interactionPoints'> & { displayName:string;role:'player'|'cook'|'waiter'|'customer';presentation:'masculina'|'feminina';screenDirections:Record<string,string>;fps:Record<string,number>;loops:Record<string,boolean>;fallback:string;rigId:string;facialRig:string;interactionPoints?:number[][];events?:Record<string,Record<string,number>>;}\n"
        f"export const C3_BR_CHARACTER_ASSETS = {compact} as C3BrRenderedAsset[];\n"
        f"export const C3_BR_LEGACY_ALIASES: Record<string,string> = {aliases};\n",
        encoding="utf-8",
    )
    return manifest


def render_lineup_preview(preview_path: Path, roots, materials):
    scene = bpy.context.scene
    characters = bpy.data.collections["CHARACTERS"]
    for child in characters.children: child.hide_render = False
    positions = [(-3.2, 0, 3.0), (-1.6, 0, 3.0), (0, 0, 3.0), (1.6, 0, 3.0), (3.2, 0, 3.0), (-3.2, 0, 0), (-1.6, 0, 0), (0, 0, 0), (1.6, 0, 0), (3.2, 0, 0)]
    for definition, (x, y, z) in zip(CHARACTERS, positions):
        root = roots[definition["assetId"]]
        root.location = (x, y, z)
        root.rotation_euler.z = 0
        set_face(definition["assetId"], smile=.72, happy=.35)
    floor_mat = material("preview_floor", (1.0, .88, .70, 1))
    floor = cube("C3BR_PREVIEW_FLOOR", (0, .1, -.08), (4.6, 1.2, .06), floor_mat, bpy.context.scene.collection, .06)
    upper_floor = cube("C3BR_PREVIEW_UPPER_FLOOR", (0, .1, 2.92), (4.6, 1.2, .06), floor_mat, bpy.context.scene.collection, .06)
    upper_floor.visible_shadow = False
    backdrop = cube("C3BR_PREVIEW_BACKDROP", (0, 1.22, 2.65), (4.8, .05, 3.65), floor_mat, bpy.context.scene.collection, .05)
    scene.render.film_transparent = False
    scene.world.color = (.78, .54, .34)
    camera = bpy.data.objects["C3BR_GameCamera"]
    camera.location = (0, -18, 5.7)
    camera.data.ortho_scale = 10.0
    aim(camera, (0, 0, 2.55))
    scene.camera = camera
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.filepath = str(preview_path)
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(floor, do_unlink=True)
    bpy.data.objects.remove(upper_floor, do_unlink=True)
    bpy.data.objects.remove(backdrop, do_unlink=True)
    for definition in CHARACTERS:
        root = roots[definition["assetId"]]
        root.location = (0, 0, 0)
        set_face(definition["assetId"], smile=.35)
    scene.render.film_transparent = True
    scene.world.color = (.035, .025, .018)
    for child in characters.children: child.hide_render = True


def save_sources(project_root: Path, blend_path: Path):
    scene = bpy.context.scene
    engine_ids = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engine_ids else "BLENDER_EEVEE"
    target = project_root / "art_source/blender/characters/c3_br_characters.blend"
    target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(target))
    render_scene = project_root / "art_source/blender/render_scene/c3_br_render_scene.blend"
    render_scene.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, render_scene)
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, blend_path)
    return target, render_scene


def build_and_render(project_root: Path, reference_path: Path, blend_path: Path, preview_path: Path, render_sprites=True):
    scene, roots, materials = build_scene(project_root, reference_path)
    render_lineup_preview(preview_path, roots, materials)
    source_paths = save_sources(project_root, blend_path)
    rendered = []
    if render_sprites:
        role_filter = {role.strip() for role in os.environ.get("C3_BR_RENDER_ROLES", "").split(",") if role.strip()}
        asset_filter = {asset_id.strip() for asset_id in os.environ.get("C3_BR_RENDER_ASSETS", "").split(",") if asset_id.strip()}
        render_definitions = [definition for definition in CHARACTERS
                              if (not role_filter or definition["role"] in role_filter)
                              and (not asset_filter or definition["assetId"] in asset_filter)]
        for definition in render_definitions:
            rendered.append(render_character(definition, project_root))
        write_manifests(project_root)
        save_sources(project_root, blend_path)
    return source_paths, rendered


def main(render_sprites=True):
    project_root = Path(os.environ.get("CAFE_TYCOON_ROOT", Path(__file__).resolve().parents[2])).resolve()
    reference_path = Path(os.environ.get("C3_BR_REFERENCE", r"C:\Users\paulo\AppData\Local\Temp\codex-clipboard-121059b7-2fc5-40ef-99a4-3010eb374b63.png"))
    blend_path = Path(os.environ["BLENDER_CODEX_BLEND_PATH"])
    preview_path = Path(os.environ["BLENDER_CODEX_PREVIEW_PATH"])
    sources, rendered = build_and_render(project_root, reference_path, blend_path, preview_path, render_sprites)
    print(f"C3BR_SOURCES={','.join(str(path) for path in sources)}")
    print(f"C3BR_RENDERED={len(rendered)}")


if __name__ == "__main__":
    main(render_sprites=True)
