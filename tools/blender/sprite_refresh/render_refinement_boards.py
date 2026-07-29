"""Render labeled v001/v002 comparison boards inside Blender."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from prototype_config import ACTIVE_DIRECTIONS, PLAYER_PRESETS
from refinement_config import BASELINE_OUTPUT_ROOT, REFINEMENT_OUTPUT_ROOT
from sprite_refresh_refinement import open_refinement_blend


def emission_material(name, color=None, image=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    transparent = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    if image is None:
        emission.inputs["Color"].default_value = color
        links.new(emission.outputs[0], output.inputs[0])
    else:
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image
        texture.interpolation = "Closest"
        links.new(texture.outputs["Color"], emission.inputs["Color"])
        links.new(texture.outputs["Alpha"], mix.inputs[0])
        links.new(transparent.outputs[0], mix.inputs[1])
        links.new(emission.outputs[0], mix.inputs[2])
        links.new(mix.outputs[0], output.inputs[0])
        material.surface_render_method = "DITHERED"
    return material


def plane(scene, name, center, width, height, material, z=0):
    x, y = center
    mesh = bpy.data.meshes.new(f"{name}:mesh")
    mesh.from_pydata([(-width/2,-height/2,0),(width/2,-height/2,0),(width/2,height/2,0),(-width/2,height/2,0)], [], [(0,1,2,3)])
    mesh.uv_layers.new(name="UVMap")
    for loop, uv in zip(mesh.uv_layers[0].data, ((0,0),(1,0),(1,1),(0,1))):
        loop.uv = uv
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (x,y,z)
    obj.data.materials.append(material)
    scene.collection.objects.link(obj)
    return obj


def image_plane(scene, path, center, height, name):
    image = bpy.data.images.load(str(path), check_existing=False)
    image.colorspace_settings.name = "sRGB"
    width = height * image.size[0] / image.size[1]
    return plane(scene, name, center, width, height, emission_material(f"{name}:material", image=image), z=.02)


def text_object(scene, body, location, size=.32, color=(.10,.18,.16,1), align="LEFT"):
    data = bpy.data.curves.new(f"text:{body}", "FONT")
    data.body = body
    data.align_x = align
    data.align_y = "CENTER"
    data.size = size
    data.extrude = 0
    obj = bpy.data.objects.new(f"text:{body}", data)
    obj.location = (*location, .06)
    obj.data.materials.append(emission_material(f"text:{body}:material", color=color))
    scene.collection.objects.link(obj)
    return obj


def line(scene, points, color=(.08,.46,.40,1), width=.025):
    data = bpy.data.curves.new("callout-line", "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = width
    data.bevel_resolution = 0
    spline = data.splines.new("POLY")
    spline.points.add(len(points)-1)
    for item, point in zip(spline.points, points):
        item.co = (*point, .05, 1)
    obj = bpy.data.objects.new("callout-line", data)
    obj.data.materials.append(emission_material("callout-line-material", color=color))
    scene.collection.objects.link(obj)


def board_scene(name, resolution=(1800,1000), ortho=10):
    scene = bpy.data.scenes.new(name)
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.filter_size = .01
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    camera_data = bpy.data.cameras.new(f"{name}:camera-data")
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = ortho
    camera = bpy.data.objects.new(f"{name}:camera", camera_data)
    camera.location = (0,0,12)
    camera.rotation_euler = (0,0,0)
    scene.collection.objects.link(camera)
    scene.camera = camera
    # Blender's orthographic scale is the horizontal span. Derive height from
    # the render aspect so the technical board coordinates match the camera.
    width = ortho
    height = ortho * resolution[1] / resolution[0]
    background = emission_material(f"{name}:background", color=(.90,.86,.74,1))
    plane(scene, f"{name}:background", (0,0), width, height, background, z=-.05)
    return scene


def render(scene, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(path)
    bpy.context.window.scene = scene
    bpy.ops.render.render(write_still=True)


def detail_board():
    scene = board_scene("REFINEMENT_DETAIL_COMPARISON", (1800,1000), 20.7)
    old = BASELINE_OUTPUT_ROOT / "sprites" / "characters" / PLAYER_PRESETS[0]["id"] / "idle" / "sw.png"
    new = REFINEMENT_OUTPUT_ROOT / "sprites" / "characters" / PLAYER_PRESETS[0]["id"] / "idle" / "sw.png"
    image_plane(scene, old, (-6.8,-.25), 7.2, "v001-character")
    image_plane(scene, new, (-1.5,-.25), 7.2, "v002-character")
    text_object(scene, "V001  APROVADO", (-6.8,4.25), .31, align="CENTER")
    text_object(scene, "V002  REFINADO", (-1.5,4.25), .31, color=(.02,.35,.28,1), align="CENTER")
    text_object(scene, "COMPARACAO DE DETALHE  |  EXIBICAO 4x", (0,5.15), .34, color=(.04,.20,.18,1), align="CENTER")
    callouts = [
        ("CABELO: MECHAS E VOLUME", (-1.45,2.65), (5.25,3.00)),
        ("ROSTO: MANDIBULA + EXPRESSAO", (-1.45,1.65), (5.25,1.85)),
        ("ROUPA: GOLA + PUNHOS + COSTURA", (-1.40,.65), (5.25,.70)),
        ("AVENTAL: ALCAS + BOLSO + DOBRAS", (-1.35,-.40), (5.25,-.55)),
        ("CALCADO: BIQUEIRA + SOLA", (-1.35,-2.85), (5.25,-2.90)),
    ]
    for index, (label, target, text_at) in enumerate(callouts):
        color = ((.04,.43,.36,1),(.62,.27,.08,1),(.20,.34,.52,1),(.14,.42,.22,1),(.40,.20,.10,1))[index]
        line(scene, [target, (target[0]+.65,target[1]), (text_at[0]-2.6,text_at[1])], color=color, width=.022)
        text_object(scene, label, text_at, .22, color=color, align="CENTER")
    text_object(scene, "MESMA CAMERA  |  112x168  |  PES (56,158)  |  ALTURA 2.200 BU", (4.9,-4.55), .18, color=(.18,.20,.17,1), align="CENTER")
    render(scene, REFINEMENT_OUTPUT_ROOT / "approval_character_detail_comparison.png")


def tray_board():
    scene = board_scene("REFINEMENT_TRAY_COMPARISON", (1800,1050), 20.57)
    text_object(scene, "POSE DE BANDEJA  |  ANTES E DEPOIS", (0,5.35), .34, color=(.04,.20,.18,1), align="CENTER")
    x_positions = (-7.5,-2.5,2.5,7.5)
    for column, direction in enumerate(ACTIVE_DIRECTIONS):
        old = BASELINE_OUTPUT_ROOT / "animation_frames" / "walk_tray" / direction / "000.png"
        new = REFINEMENT_OUTPUT_ROOT / "animation_frames" / "walk_tray" / direction / "000.png"
        image_plane(scene, old, (x_positions[column],2.35), 3.40, f"tray-old-{direction}")
        image_plane(scene, new, (x_positions[column],-1.65), 3.40, f"tray-new-{direction}")
        text_object(scene, direction.upper(), (x_positions[column],4.28), .23, align="CENTER")
    text_object(scene, "V001  |  BRACOS ABERTOS", (0,.43), .24, color=(.55,.18,.08,1), align="CENTER")
    text_object(scene, "V002  |  IK DAS MAOS + POLES DOS COTOVELOS", (0,-3.62), .24, color=(.02,.38,.30,1), align="CENTER")
    footer = "PERNAS PRESERVADAS  |  MAOS SOB A BANDEJA  |  COTOVELOS 81.48 GRAUS  |  SUPERFICIE VAZIA  |  OSCILACAO <= 2 px"
    text_object(scene, footer, (0,-5.45), .18, color=(.12,.20,.17,1), align="CENTER")
    render(scene, REFINEMENT_OUTPUT_ROOT / "approval_tray_arm_pose_comparison.png")


def main():
    open_refinement_blend()
    main_scene = bpy.context.scene
    detail_board()
    tray_board()
    bpy.context.window.scene = main_scene


if __name__ == "__main__":
    main()
