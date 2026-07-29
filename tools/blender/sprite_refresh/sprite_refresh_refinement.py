"""Character-only v002 refinement built on the approved sprite-refresh contract.

The v001 pipeline stays untouched. This module replaces only character geometry,
character materials, the shared rig controls, and the tray-arm pose while reusing
the approved camera, scale, anchors, directions, and leg/cook motion.
"""

from __future__ import annotations

import json
import math
import os
import shutil
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

import sprite_refresh_pipeline as base
from prototype_config import (
    ACTIVE_DIRECTIONS,
    ANIMATION_SPECS,
    CHARACTER_ORTHO_SCALE,
    FAMILY_CHARACTERS,
    FEET_ANCHOR,
    FRAME_SIZE,
    HAIR_COLORS,
    PLAYER_PRESETS,
    SKIN_TONES,
)
from refinement_config import (
    BASELINE_OUTPUT_ROOT,
    REFINEMENT_BLEND,
    REFINEMENT_OUTPUT_ROOT,
    REFINEMENT_PREVIEW,
    REFINEMENT_VERSION,
)


ORIGINAL_BUILD_MATERIALS = base.build_materials
ORIGINAL_CREATE_ARMATURE = base.create_shared_armature_data
ORIGINAL_BUILD_CHARACTER = base.build_character
ORIGINAL_RESET_POSE = base.reset_pose
ORIGINAL_POSE_CHARACTER = base.pose_character
ORIGINAL_BUILD_RIG_ACTIONS = base.build_rig_actions

REFINED_COLLECTIONS = {}
TRAY_SUPPORT = {
    "L": Vector((0.275, -0.280, 1.100)),
    "R": Vector((-0.275, -0.280, 1.100)),
}


def color_variant(color, lift=0.0, saturation=1.0):
    rgb = []
    average = sum(color[:3]) / 3.0
    for value in color[:3]:
        shifted = average + (value - average) * saturation + lift
        rgb.append(max(0.0, min(1.0, shifted)))
    return (*rgb, color[3])


def refined_material(name, color, roughness, metallic=0.0):
    return base.material(name, color, roughness=roughness, metallic=metallic)


def build_refined_materials():
    ORIGINAL_BUILD_MATERIALS()
    for name, color in SKIN_TONES.items():
        refined_material(f"SkinSoft_{name}", color_variant(color, lift=.012, saturation=.97), .64)
        refined_material(f"SkinBlush_{name}", color_variant(color, lift=.035, saturation=1.12), .70)
    for name, color in HAIR_COLORS.items():
        refined_material(f"HairBase_{name}", color_variant(color, lift=-.006, saturation=1.03), .76)
        refined_material(f"HairHighlight_{name}", color_variant(color, lift=.055, saturation=.96), .66)

    materials = {
        "Fabric_Ivory": ((.91, .87, .76, 1), .82, 0),
        "Fabric_Cream": ((.78, .70, .56, 1), .84, 0),
        "Fabric_Sage": ((.12, .34, .23, 1), .78, 0),
        "Fabric_Green": ((.035, .22, .115, 1), .76, 0),
        "Fabric_GreenLight": ((.12, .42, .255, 1), .76, 0),
        "Fabric_Wine": ((.34, .035, .055, 1), .80, 0),
        "Fabric_Red": ((.54, .055, .045, 1), .81, 0),
        "Fabric_Gold": ((.67, .29, .045, 1), .82, 0),
        "Fabric_Teal": ((.025, .30, .31, 1), .78, 0),
        "Fabric_Blue": ((.045, .18, .34, 1), .80, 0),
        "Fabric_Sky": ((.32, .52, .59, 1), .82, 0),
        "Fabric_Denim": ((.065, .14, .235, 1), .88, 0),
        "Fabric_Pants": ((.075, .08, .105, 1), .87, 0),
        "Fabric_Stitch": ((.78, .61, .24, 1), .75, 0),
        "Leather_Upper": ((.19, .052, .021, 1), .46, 0),
        "Leather_Toe": ((.39, .125, .032, 1), .42, 0),
        "Leather_Sole": ((.035, .027, .024, 1), .62, 0),
        "EyeWhite": ((.86, .83, .70, 1), .58, 0),
        "IrisBrown": ((.16, .065, .025, 1), .46, 0),
        "IrisHazel": ((.25, .18, .045, 1), .46, 0),
        "IrisGreen": ((.035, .20, .12, 1), .46, 0),
        "IrisBlue": ((.045, .15, .27, 1), .46, 0),
        "LipRose": ((.36, .07, .055, 1), .70, 0),
        "Metal_Brass": ((.63, .34, .055, 1), .31, .55),
        "Metal_Silver": ((.54, .60, .61, 1), .27, .70),
        "Accessory_Dark": ((.025, .032, .035, 1), .52, 0),
    }
    for name, (color, roughness, metallic) in materials.items():
        refined_material(name, color, roughness, metallic)


def tag(obj, component, detail):
    obj["componentGroup"] = component
    obj["detailClass"] = detail
    obj["refinementVersion"] = REFINEMENT_VERSION
    return obj


def refined_part(name, location, dimensions, mat, collection, rig, bone, *, bevel=.025, rotation=(0, 0, 0), component="body", detail="structural"):
    return tag(base.char_part(name, location, dimensions, mat, collection, rig, bone, bevel=bevel, rotation=rotation), component, detail)


def tapered_part(name, location, width_top, width_bottom, depth, height, mat, collection, rig, bone, *, bevel=.02, component="clothing", detail="tailored-volume"):
    wt, wb, d, h = width_top / 2, width_bottom / 2, depth / 2, height / 2
    vertices = [
        (-wb, -d, -h), (wb, -d, -h), (wb, d, -h), (-wb, d, -h),
        (-wt, -d, h), (wt, -d, h), (wt, d, h), (-wt, d, h),
    ]
    faces = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(4,0,3,7)]
    mesh = bpy.data.meshes.new(f"{name}:mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    if bevel:
        modifier = obj.modifiers.new("Tailored edge bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    base.assign_material(obj, mat)
    # Objects in source collections are reached through collection instances;
    # assign an explicit world matrix before bone parenting to avoid a stale
    # identity matrix placing the custom prism at the character pivot.
    world = Matrix.Translation(Vector(location))
    obj.matrix_world = world
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = bone
    obj.matrix_world = world
    return tag(obj, component, detail)


def create_refined_armature_data():
    data = bpy.data.armatures.new("SpriteRefresh_Humanoid_Shared_v002")
    rig = bpy.data.objects.new("_armature_template_v002", data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = {
        "root": ((0, 0, 0), (0, 0, .18), None, True),
        "pelvis": ((0, 0, .62), (0, 0, .86), "root", True),
        "torso": ((0, 0, .86), (0, 0, 1.48), "pelvis", True),
        "head": ((0, 0, 1.48), (0, 0, 2.10), "torso", True),
        "thigh.L": ((.16, 0, .67), (.16, 0, .40), "pelvis", True),
        "shin.L": ((.16, 0, .40), (.16, -.02, .10), "thigh.L", True),
        "thigh.R": ((-.16, 0, .67), (-.16, 0, .40), "pelvis", True),
        "shin.R": ((-.16, 0, .40), (-.16, -.02, .10), "thigh.R", True),
        "upper_arm.L": ((.35, 0, 1.39), (.41, -.03, 1.14), "torso", True),
        "forearm.L": ((.41, -.03, 1.14), (.40, -.16, .89), "upper_arm.L", True),
        "hand.L": ((.40, -.16, .89), (.40, -.20, .82), "forearm.L", True),
        "upper_arm.R": ((-.35, 0, 1.39), (-.41, -.03, 1.14), "torso", True),
        "forearm.R": ((-.41, -.03, 1.14), (-.40, -.16, .89), "upper_arm.R", True),
        "hand.R": ((-.40, -.16, .89), (-.40, -.20, .82), "forearm.R", True),
        "hand_ik.L": (tuple(TRAY_SUPPORT["L"]), tuple(TRAY_SUPPORT["L"] + Vector((0, 0, .09))), None, False),
        "hand_ik.R": (tuple(TRAY_SUPPORT["R"]), tuple(TRAY_SUPPORT["R"] + Vector((0, 0, .09))), None, False),
        "elbow_pole.L": ((.42, -.015, 1.20), (.42, -.015, 1.29), None, False),
        "elbow_pole.R": ((-.42, -.015, 1.20), (-.42, -.015, 1.29), None, False),
    }
    edit = {}
    for name, (head, tail, parent_name, deform) in bones.items():
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        bone.use_deform = deform
        edit[name] = bone
        if parent_name:
            bone.parent = edit[parent_name]
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.scene.collection.objects.unlink(rig)
    bpy.data.objects.remove(rig)
    base.SHARED_ARMATURE_DATA = data
    return data


def add_tray_ik(rig):
    for side in ("L", "R"):
        constraint = rig.pose.bones[f"forearm.{side}"].constraints.new("IK")
        constraint.name = f"TrayHandIK.{side}"
        constraint.target = rig
        constraint.subtarget = f"hand_ik.{side}"
        constraint.pole_target = rig
        constraint.pole_subtarget = f"elbow_pole.{side}"
        constraint.chain_count = 2
        constraint.use_tail = True
        constraint.use_stretch = False
        constraint.pole_angle = 0.0 if side == "L" else math.pi
        constraint.influence = 0.0
    rig["trayIKControls"] = ["hand_ik.L", "hand_ik.R", "elbow_pole.L", "elbow_pole.R"]
    rig["trayElbowAngleTarget"] = [80, 100]


def face_parameters(face):
    return {
        "square": {"upper": .58, "jaw_top": .56, "jaw_bottom": .52, "jaw_h": .23, "eye_sep": .142, "eye_h": .068, "nose": .105, "mouth": .17, "brow": .02},
        "oval": {"upper": .54, "jaw_top": .52, "jaw_bottom": .42, "jaw_h": .25, "eye_sep": .132, "eye_h": .060, "nose": .085, "mouth": .145, "brow": -.025},
        "broad": {"upper": .61, "jaw_top": .59, "jaw_bottom": .55, "jaw_h": .24, "eye_sep": .152, "eye_h": .065, "nose": .12, "mouth": .18, "brow": .055},
        "heart": {"upper": .56, "jaw_top": .53, "jaw_bottom": .39, "jaw_h": .25, "eye_sep": .138, "eye_h": .062, "nose": .082, "mouth": .15, "brow": -.055},
        "long": {"upper": .53, "jaw_top": .49, "jaw_bottom": .41, "jaw_h": .28, "eye_sep": .132, "eye_h": .058, "nose": .095, "mouth": .155, "brow": .035},
    }[face]


def hair_blocks_refined(spec, hair_collection, rig):
    asset_id = spec["id"]
    style = spec["hair"]
    base_mat = base.MATERIALS[f"HairBase_{spec['hair_color']}"]
    highlight = base.MATERIALS[f"HairHighlight_{spec['hair_color']}"]

    def block(suffix, loc, dims, mat=base_mat, rot=(0, 0, 0), bevel=.035, detail="hair-volume"):
        return refined_part(f"{asset_id}:hair:{suffix}", loc, dims, mat, hair_collection, rig, "head", bevel=bevel, rotation=rot, component="hair", detail=detail)

    block("crown-back", (0, .105, 2.055), (.52, .33, .19), bevel=.055)
    block("hairline-center", (0, -.225, 2.025), (.22, .075, .11), highlight, rot=(0, .08, 0), bevel=.025, detail="hairline")
    if style == "short":
        block("fade-L", (.275, .035, 1.99), (.075, .32, .17), detail="fade")
        block("fade-R", (-.275, .035, 1.99), (.075, .32, .17), detail="fade")
        for index, (x, z, rz) in enumerate(((-.22,2.11,.16),(-.08,2.16,.08),(.07,2.17,-.04),(.21,2.13,-.15))):
            block(f"top-{index}", (x,-.075,z), (.16,.25,.14), highlight if index in {1,2} else base_mat, rot=(0,.10,rz), bevel=.045)
        block("quiff", (.10,-.205,2.105), (.28,.13,.13), highlight, rot=(0,.16,-.08), bevel=.045, detail="fringe")
    elif style == "bun":
        block("sleek-crown", (0,.02,2.13), (.48,.40,.14), rot=(0,.04,0), bevel=.055)
        block("side-L", (.27,.015,1.98), (.085,.34,.25), detail="temple")
        block("side-R", (-.27,.015,1.98), (.085,.34,.25), detail="temple")
        block("tie", (0,.275,2.08), (.17,.12,.17), highlight, bevel=.045, detail="hair-tie")
        for index, (x,y,z) in enumerate(((-.10,.36,2.10),(.10,.36,2.10),(0,.39,2.19))):
            block(f"bun-lobe-{index}", (x,y,z), (.22,.20,.20), highlight if index == 2 else base_mat, bevel=.065, detail="bun")
    elif style == "coily":
        block("fade-L", (.278,.04,1.98), (.065,.27,.15), detail="fade")
        block("fade-R", (-.278,.04,1.98), (.065,.27,.15), detail="fade")
        points = [(-.23,-.14,2.12),(-.08,-.18,2.18),(.08,-.18,2.19),(.23,-.13,2.13),(-.24,.02,2.17),(-.08,.02,2.22),(.09,.02,2.22),(.24,.03,2.17),(-.17,.18,2.15),(0,.20,2.20),(.17,.18,2.15)]
        for index, point in enumerate(points):
            block(f"coil-{index}", point, (.17,.17,.16), highlight if index in {1,5,6} else base_mat, bevel=.055, detail="coil-cluster")
    elif style == "curls":
        points = [(-.24,-.15,2.13),(-.08,-.19,2.19),(.10,-.18,2.18),(.25,-.10,2.12),(-.29,.04,2.06),(.29,.05,2.06),(-.31,.14,1.91),(.31,.15,1.92),(-.23,.28,1.99),(-.08,.32,2.09),(.09,.32,2.10),(.24,.27,1.99)]
        for index, point in enumerate(points):
            dims = (.19,.19,.21) if index < 6 else (.18,.18,.24)
            block(f"curl-{index}", point, dims, highlight if index in {1,4,9} else base_mat, rot=(.04,0,(index%3-1)*.12), bevel=.062, detail="defined-curl")
    elif style == "wave":
        waves = [(-.23,-.12,2.12,.18),(-.08,-.18,2.18,.12),(.08,-.18,2.19,-.03),(.23,-.11,2.15,-.18),(-.17,.03,2.20,.10),(.02,.04,2.22,-.08),(.20,.06,2.17,-.20)]
        for index, (x,y,z,rz) in enumerate(waves):
            block(f"wave-{index}", (x,y,z), (.22,.19,.135), highlight if index in {1,2,5} else base_mat, rot=(0,.10,rz), bevel=.045, detail="wave-lock")
        block("swept-fringe", (.15,-.22,2.09), (.30,.11,.12), highlight, rot=(0,.18,-.18), bevel=.04, detail="fringe")
        block("nape", (0,.25,2.00), (.46,.15,.25), bevel=.045, detail="nape")
    for side, x in (("L", .25), ("R", -.25)):
        block(f"sideburn-{side}", (x,-.18,1.92), (.06,.07,.16), bevel=.018, detail="hairline")


def style_materials(spec):
    outfit = spec["outfit"]
    player_index = next((index for index, item in enumerate(PLAYER_PRESETS) if item["id"] == spec["id"]), 0)
    if outfit == "apron_green":
        shirts = ("Fabric_Ivory", "Fabric_Cream", "Fabric_Sky", "Fabric_Ivory", "Fabric_Sage")
        aprons = ("Fabric_Green", "Fabric_Sage", "Fabric_Green", "Fabric_GreenLight", "Fabric_Sage")
        return base.MATERIALS[shirts[player_index]], base.MATERIALS[aprons[player_index]], base.MATERIALS["Fabric_Stitch"]
    if outfit == "barista":
        return base.MATERIALS["Fabric_Ivory"], base.MATERIALS["Fabric_Green"], base.MATERIALS["Leather_Toe"]
    if outfit == "attendant":
        return base.MATERIALS["Fabric_Cream"], base.MATERIALS["Fabric_Wine"], base.MATERIALS["Metal_Brass"]
    mapping = {
        "customer_red": ("Fabric_Red", "Fabric_Ivory", "Metal_Silver"),
        "customer_gold": ("Fabric_Gold", "Fabric_Denim", "Fabric_Stitch"),
        "customer_teal": ("Fabric_Teal", "Fabric_Cream", "Metal_Brass"),
        "customer_blue": ("Fabric_Blue", "Fabric_Ivory", "Metal_Silver"),
    }
    names = mapping[outfit]
    return tuple(base.MATERIALS[name] for name in names)


def build_refined_character(spec):
    asset_id = spec["id"]
    source, root = base.create_source_asset(asset_id, "character")
    names = ("BODY", "HEAD", "FACE", f"HAIR_{spec['hair']}", "CLOTHING", "APRON", "ACCESSORIES")
    collections = {name.split("_")[0]: bpy.data.collections.new(f"{asset_id}_{name}") for name in names}
    # HAIR keeps its full component name and is exposed independently in metadata.
    hair_collection = next(value for key, value in collections.items() if key == "HAIR")
    for child in collections.values():
        source.children.link(child)
    REFINED_COLLECTIONS[asset_id] = collections

    rig = bpy.data.objects.new(f"{asset_id}:rig", base.SHARED_ARMATURE_DATA)
    source.objects.link(rig)
    rig.parent = root
    rig.show_in_front = True
    rig["sharedSkeleton"] = base.SHARED_ARMATURE_DATA.name
    rig["gameplayHeight"] = 2.20
    rig["feetPivot"] = [0.0, 0.0, 0.0]
    # A pose is initialized only after the armature has entered the view layer.
    # Link it temporarily; the source collection remains its persistent owner.
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.update()
    add_tray_ik(rig)
    bpy.context.scene.collection.objects.unlink(rig)
    base.ASSET_RIGS[asset_id] = rig

    body = collections["BODY"]
    head_collection = collections["HEAD"]
    face_collection = collections["FACE"]
    clothing = collections["CLOTHING"]
    apron_collection = collections["APRON"]
    accessories = collections["ACCESSORIES"]

    profile_width = {"slim": .54, "average": .61, "athletic": .65, "curvy": .66, "broad": .71}.get(spec["body"], .61)
    hip_width = profile_width * (1.02 if spec["presentation"] == "female" else .92)
    params = face_parameters(spec["face"])
    skin = base.MATERIALS[f"SkinSoft_{spec['skin']}"]
    blush = base.MATERIALS[f"SkinBlush_{spec['skin']}"]
    hair = base.MATERIALS[f"HairBase_{spec['hair_color']}"]
    shirt, accent, trim = style_materials(spec)

    refined_part(f"{asset_id}:neck", (0,.015,1.50), (.23,.21,.18), skin, body, rig, "torso", bevel=.045, component="body", detail="neck-transition")
    refined_part(f"{asset_id}:torso", (0,0,1.18), (profile_width,.38,.58), shirt, body, rig, "torso", bevel=.06, component="body", detail="tailored-torso")
    refined_part(f"{asset_id}:hips", (0,.005,.78), (hip_width,.34,.23), base.MATERIALS["Fabric_Pants"], body, rig, "pelvis", bevel=.035, component="body", detail="waist-shape")
    refined_part(f"{asset_id}:waistband", (0,-.175,.82), (hip_width*.92,.035,.075), base.MATERIALS["Fabric_Stitch"], clothing, rig, "pelvis", bevel=.012, component="clothing", detail="waistband")

    for side, x in (("L", .16), ("R", -.16)):
        refined_part(f"{asset_id}:leg:{side}:upper", (x,0,.52), (.24,.28,.32), base.MATERIALS["Fabric_Pants"], body, rig, f"thigh.{side}", bevel=.04, component="body", detail="trouser-volume")
        refined_part(f"{asset_id}:leg:{side}:crease", (x,-.148,.52), (.035,.018,.24), base.MATERIALS["Fabric_Stitch"], clothing, rig, f"thigh.{side}", bevel=.006, component="clothing", detail="trouser-crease")
        refined_part(f"{asset_id}:leg:{side}:lower", (x,-.005,.24), (.22,.26,.31), base.MATERIALS["Fabric_Pants"], body, rig, f"shin.{side}", bevel=.035, component="body", detail="trouser-volume")
        refined_part(f"{asset_id}:shoe:{side}", (x,-.085,.075), (.27,.38,.15), base.MATERIALS["Leather_Upper"], body, rig, f"shin.{side}", bevel=.05, component="footwear", detail="shoe-upper")
        refined_part(f"{asset_id}:shoe-toe:{side}", (x,-.255,.09), (.25,.13,.11), base.MATERIALS["Leather_Toe"], clothing, rig, f"shin.{side}", bevel=.03, component="footwear", detail="toe-cap")
        refined_part(f"{asset_id}:shoe-sole:{side}", (x,-.095,.058), (.285,.40,.045), base.MATERIALS["Leather_Sole"], clothing, rig, f"shin.{side}", bevel=.012, component="footwear", detail="sole")
        refined_part(f"{asset_id}:shoe-opening:{side}", (x,.035,.135), (.18,.11,.045), base.MATERIALS["Accessory_Dark"], clothing, rig, f"shin.{side}", bevel=.012, component="footwear", detail="opening")

    for side, x in (("L", .39), ("R", -.39)):
        refined_part(f"{asset_id}:arm:{side}:upper", (x,-.015,1.27), (.22,.27,.34), shirt, body, rig, f"upper_arm.{side}", bevel=.06, component="body", detail="sleeve-volume")
        refined_part(f"{asset_id}:sleeve-fold:{side}", (x,-.155,1.28), (.15,.022,.10), trim, clothing, rig, f"upper_arm.{side}", bevel=.012, component="clothing", detail="sleeve-fold")
        refined_part(f"{asset_id}:cuff:{side}", (x,-.055,1.12), (.225,.275,.065), accent if spec["outfit"] == "attendant" else shirt, clothing, rig, f"upper_arm.{side}", bevel=.018, component="clothing", detail="cuff")
        refined_part(f"{asset_id}:arm:{side}:lower", (x,-.075,1.035), (.195,.225,.255), skin, body, rig, f"forearm.{side}", bevel=.065, component="body", detail="forearm")
        refined_part(f"{asset_id}:hand:{side}", (x,-.16,.91), (.15,.14,.07), skin, body, rig, f"hand.{side}", bevel=.030, component="body", detail="hand-support")
        refined_part(f"{asset_id}:finger-line:{side}", (x,-.274,.905), (.12,.014,.035), blush, face_collection, rig, f"hand.{side}", bevel=.005, component="face", detail="finger-line")

    # Head uses a cranium plus a tapered jaw, so every face profile has a real silhouette.
    refined_part(f"{asset_id}:cranium", (0,.005,1.89), (params["upper"],.48,.36), skin, head_collection, rig, "head", bevel=.082, component="head", detail="cranium")
    tapered_part(f"{asset_id}:jaw", (0,-.005,1.65), params["jaw_top"], params["jaw_bottom"], .46, params["jaw_h"], skin, head_collection, rig, "head", bevel=.055, component="head", detail=f"jaw-{spec['face']}")
    for side, x in (("L", params["upper"]*.50+.022), ("R", -params["upper"]*.50-.022)):
        refined_part(f"{asset_id}:ear:{side}", (x,.015,1.78), (.085,.125,.16), skin, head_collection, rig, "head", bevel=.042, component="head", detail="ear")
        refined_part(f"{asset_id}:cheek:{side}", (x*.60,-.245,1.70), (.105,.035,.085), blush, face_collection, rig, "head", bevel=.025, component="face", detail="cheek-volume")

    iris_names = ("IrisBrown", "IrisHazel", "IrisGreen", "IrisBrown", "IrisBlue")
    deterministic_fallback = sum(ord(character) for character in asset_id) % len(iris_names)
    player_index = next((index for index, item in enumerate(PLAYER_PRESETS) if item["id"] == asset_id), deterministic_fallback)
    iris = base.MATERIALS[iris_names[player_index % len(iris_names)]]
    for side, x in (("L", params["eye_sep"]), ("R", -params["eye_sep"])):
        refined_part(f"{asset_id}:eye-white:{side}", (x,-.263,1.835), (.105,.028,params["eye_h"]), base.MATERIALS["EyeWhite"], face_collection, rig, "head", bevel=.012, component="face", detail="eye-white")
        refined_part(f"{asset_id}:iris:{side}", (x + (-.010 if side == "L" else .010),-.280,1.834), (.044,.014,params["eye_h"]*.72), iris, face_collection, rig, "head", bevel=.009, component="face", detail="iris")
        refined_part(f"{asset_id}:pupil:{side}", (x + (-.012 if side == "L" else .012),-.289,1.834), (.018,.010,params["eye_h"]*.48), base.MATERIALS["Eye"], face_collection, rig, "head", bevel=.004, component="face", detail="pupil")
        refined_part(f"{asset_id}:glint:{side}", (x-.015,-.296,1.855), (.014,.008,.014), base.MATERIALS["EyeGlint"], face_collection, rig, "head", bevel=.003, component="face", detail="eye-glint")
        brow = refined_part(f"{asset_id}:brow:{side}", (x,-.276,1.925), (.145,.028,.034), hair, face_collection, rig, "head", bevel=.008, component="face", detail="expression-brow")
        brow.rotation_euler.y = params["brow"] if side == "L" else -params["brow"]
    refined_part(f"{asset_id}:nose-bridge", (0,-.258,1.785), (params["nose"]*.55,.070,.10), skin, face_collection, rig, "head", bevel=.022, component="face", detail="nose-bridge")
    refined_part(f"{asset_id}:nose-tip", (0,-.292,1.725), (params["nose"],.075,.085), blush, face_collection, rig, "head", bevel=.032, component="face", detail="nose-tip")
    refined_part(f"{asset_id}:mouth", (0,-.276,1.607), (params["mouth"],.026,.029), base.MATERIALS["LipRose"], face_collection, rig, "head", bevel=.008, component="face", detail="soft-smile")
    for side, x in (("L", params["mouth"]*.47), ("R", -params["mouth"]*.47)):
        corner = refined_part(f"{asset_id}:smile:{side}", (x,-.278,1.617), (.045,.022,.024), base.MATERIALS["LipRose"], face_collection, rig, "head", bevel=.007, rotation=(0,0,.22 if side == "L" else -.22), component="face", detail="smile-corner")

    if spec["presentation"] == "male" and spec["face"] in {"square", "broad", "long"}:
        beard_style = "boxed" if spec["face"] == "square" else "short" if spec["face"] == "broad" else "goatee"
        if beard_style != "goatee":
            refined_part(f"{asset_id}:beard:chin", (0,-.254,1.57), (params["jaw_bottom"]*.70,.045,.115), hair, face_collection, rig, "head", bevel=.028, component="face", detail=f"beard-{beard_style}")
            for side, x in (("L", params["jaw_top"]*.44), ("R", -params["jaw_top"]*.44)):
                refined_part(f"{asset_id}:beard:{side}", (x,-.238,1.665), (.065,.055,.19), hair, face_collection, rig, "head", bevel=.023, component="face", detail=f"beard-{beard_style}")
        else:
            refined_part(f"{asset_id}:beard:goatee", (0,-.275,1.56), (.17,.038,.12), hair, face_collection, rig, "head", bevel=.025, component="face", detail="beard-goatee")
        refined_part(f"{asset_id}:moustache", (0,-.292,1.655), (.17,.025,.036), hair, face_collection, rig, "head", bevel=.009, component="face", detail="moustache")

    hair_blocks_refined(spec, hair_collection, rig)

    # Tailored clothing structure shared by restaurant characters.
    refined_part(f"{asset_id}:collar:L", (.105,-.218,1.435), (.17,.05,.18), shirt, clothing, rig, "torso", bevel=.025, rotation=(0,.18,.16), component="clothing", detail="collar")
    refined_part(f"{asset_id}:collar:R", (-.105,-.218,1.435), (.17,.05,.18), shirt, clothing, rig, "torso", bevel=.025, rotation=(0,-.18,-.16), component="clothing", detail="collar")
    refined_part(f"{asset_id}:placket", (0,-.207,1.18), (.055,.035,.43), trim, clothing, rig, "torso", bevel=.010, component="clothing", detail="shirt-placket")
    for index, z in enumerate((1.33,1.18,1.03)):
        refined_part(f"{asset_id}:button:{index}", (0,-.232,z), (.055,.025,.055), base.MATERIALS["Metal_Brass"] if spec["outfit"] != "customer_blue" else base.MATERIALS["Metal_Silver"], clothing, rig, "torso", bevel=.016, component="clothing", detail="button")
    for side, x in (("L", profile_width*.49), ("R", -profile_width*.49)):
        refined_part(f"{asset_id}:shirt-seam:{side}", (x,-.195,1.14), (.022,.018,.34), trim, clothing, rig, "torso", bevel=.004, component="clothing", detail="main-seam")

    if spec["outfit"] in {"apron_green", "barista", "attendant"}:
        full_apron = spec["outfit"] != "attendant"
        bib_height = .29 if full_apron else .18
        bib_z = 1.285 if full_apron else 1.16
        skirt_height = .38 if full_apron else .26
        skirt_z = .98 if full_apron else .91
        tapered_part(f"{asset_id}:apron-bib", (0,-.224,bib_z), profile_width*.69, profile_width*.76, .07, bib_height, accent, apron_collection, rig, "torso", bevel=.026, component="apron", detail="thick-bib")
        tapered_part(f"{asset_id}:apron-skirt", (0,-.225,skirt_z), profile_width*.82, profile_width*.91, .075, skirt_height, accent, apron_collection, rig, "torso", bevel=.028, component="apron", detail="draped-skirt")
        for side, x in (("L", profile_width*.25), ("R", -profile_width*.25)):
            refined_part(f"{asset_id}:apron-strap-front:{side}", (x,-.218,1.405), (.065,.055,.27), accent, apron_collection, rig, "torso", bevel=.016, rotation=(0,0,-.08 if side == "L" else .08), component="apron", detail="shoulder-strap")
            refined_part(f"{asset_id}:apron-strap-back:{side}", (x,.205,1.34), (.055,.045,.36), accent, apron_collection, rig, "torso", bevel=.014, rotation=(0,0,.12 if side == "L" else -.12), component="apron", detail="rear-strap")
        refined_part(f"{asset_id}:apron-waist-front", (0,-.245,1.10), (profile_width*.90,.035,.065), trim, apron_collection, rig, "torso", bevel=.012, component="apron", detail="waist-band")
        refined_part(f"{asset_id}:apron-waist-back", (0,.205,1.10), (profile_width*.90,.035,.065), accent, apron_collection, rig, "torso", bevel=.012, component="apron", detail="waist-band")
        pocket_mat = base.MATERIALS["Fabric_GreenLight"] if spec["outfit"] != "attendant" else base.MATERIALS["Fabric_Wine"]
        tapered_part(f"{asset_id}:apron-pocket", (0,-.268,skirt_z-.02), profile_width*.42, profile_width*.48, .028, .17, pocket_mat, apron_collection, rig, "torso", bevel=.018, component="apron", detail="functional-pocket")
        refined_part(f"{asset_id}:pocket-division", (0,-.286,skirt_z-.02), (.024,.015,.135), trim, apron_collection, rig, "torso", bevel=.004, component="apron", detail="pocket-division")
        for side, x in (("L", .075), ("R", -.075)):
            refined_part(f"{asset_id}:apron-tie:{side}", (x,.245,1.075), (.15,.065,.075), accent, apron_collection, rig, "torso", bevel=.022, rotation=(0,0,.25 if side == "L" else -.25), component="apron", detail="rear-tie")
        refined_part(f"{asset_id}:apron-knot", (0,.27,1.075), (.08,.06,.08), trim, apron_collection, rig, "torso", bevel=.022, component="apron", detail="rear-knot")
        for side, x in (("L", profile_width*.31), ("R", -profile_width*.31)):
            refined_part(f"{asset_id}:apron-fold:{side}", (x,-.266,skirt_z), (.025,.012,skirt_height*.66), trim, apron_collection, rig, "torso", bevel=.004, component="apron", detail="fabric-fold")
    else:
        tapered_part(f"{asset_id}:jacket-front", (0,-.22,1.18), profile_width*.80, profile_width*.90, .07, .49, accent, clothing, rig, "torso", bevel=.032, component="clothing", detail="layered-jacket")
        refined_part(f"{asset_id}:jacket-hem", (0,-.258,.95), (profile_width*.84,.025,.045), trim, clothing, rig, "torso", bevel=.008, component="clothing", detail="garment-hem")
        refined_part(f"{asset_id}:belt", (0,-.205,.84), (hip_width*.93,.04,.07), base.MATERIALS["Leather_Upper"], clothing, rig, "pelvis", bevel=.014, component="clothing", detail="belt")
        refined_part(f"{asset_id}:belt-buckle", (0,-.237,.84), (.105,.035,.085), base.MATERIALS["Metal_Brass"], accessories, rig, "pelvis", bevel=.016, component="accessories", detail="buckle")

    # Function/personality accessories remain chunky enough to survive the final sprite.
    if spec["outfit"] == "barista":
        refined_part(f"{asset_id}:coffee-badge", (.15,-.284,1.30), (.10,.022,.10), base.MATERIALS["Metal_Brass"], accessories, rig, "torso", bevel=.025, component="accessories", detail="barista-badge")
        refined_part(f"{asset_id}:barista-towel", (-profile_width*.46,-.245,.95), (.12,.05,.28), base.MATERIALS["Fabric_Ivory"], accessories, rig, "torso", bevel=.018, component="accessories", detail="service-towel")
        refined_part(f"{asset_id}:pocket-pen", (-.12,-.298,1.02), (.025,.018,.14), base.MATERIALS["Metal_Silver"], accessories, rig, "torso", bevel=.005, component="accessories", detail="barista-tool")
    elif spec["outfit"] == "attendant":
        refined_part(f"{asset_id}:vest:L", (.15,-.225,1.22), (profile_width*.36,.065,.42), accent, clothing, rig, "torso", bevel=.026, component="clothing", detail="attendant-vest")
        refined_part(f"{asset_id}:vest:R", (-.15,-.225,1.22), (profile_width*.36,.065,.42), accent, clothing, rig, "torso", bevel=.026, component="clothing", detail="attendant-vest")
        refined_part(f"{asset_id}:nameplate", (.14,-.268,1.32), (.18,.028,.075), base.MATERIALS["Metal_Brass"], accessories, rig, "torso", bevel=.012, component="accessories", detail="nameplate")
    elif spec["id"] in {"player_02_female_bun", "player_04_female_curls", "customer_approval_01"}:
        for side, x in (("L", params["upper"]*.52), ("R", -params["upper"]*.52)):
            refined_part(f"{asset_id}:earring:{side}", (x,-.01,1.70), (.035,.035,.07), base.MATERIALS["Metal_Brass"], accessories, rig, "head", bevel=.012, component="accessories", detail="earring")
    if spec["id"] == "customer_approval_04":
        for side, x in (("L", params["eye_sep"]), ("R", -params["eye_sep"])):
            refined_part(f"{asset_id}:glasses:{side}", (x,-.304,1.835), (.135,.018,.105), base.MATERIALS["Accessory_Dark"], accessories, rig, "head", bevel=.012, component="accessories", detail="glasses-frame")
        refined_part(f"{asset_id}:glasses-bridge", (0,-.307,1.84), (.12,.014,.025), base.MATERIALS["Accessory_Dark"], accessories, rig, "head", bevel=.004, component="accessories", detail="glasses-bridge")

    tray = base.cylinder(f"{asset_id}:tray", (0,-.40,1.190), .39,.055,base.MATERIALS["SteelDark"],accessories,vertices=24,bevel=.016)
    tray.scale.y = .72
    bpy.context.view_layer.update()
    base.preserve_parent(tray, rig, bone="torso")
    tag(tray, "accessories", "empty-tray")
    tray["component"] = "empty_tray"
    tray["surfaceClear"] = True
    tray["supportPoints"] = [list(TRAY_SUPPORT["L"]), list(TRAY_SUPPORT["R"])]
    tray.hide_render = True
    utensil = base.cylinder(f"{asset_id}:utensil", (-.36,-.35,1.06),.025,.62,base.MATERIALS["Metal_Silver"],accessories,vertices=8,rotation=(math.radians(72),0,math.radians(8)),bevel=.008)
    base.preserve_parent(utensil, rig, bone="forearm.R")
    tag(utensil, "accessories", "cook-utensil")
    utensil["component"] = "cook_utensil"
    utensil.hide_render = True

    root["presentation"] = spec["presentation"]
    root["skinComponent"] = f"SkinSoft_{spec['skin']}"
    root["hairComponent"] = hair_collection.name
    root["hairMaterial"] = f"HairBase_{spec['hair_color']}"
    root["faceComponent"] = face_collection.name
    root["bodyComponent"] = body.name
    root["clothingComponent"] = clothing.name
    root["apronComponent"] = apron_collection.name
    root["accessoriesComponent"] = accessories.name
    root["faceProfile"] = spec["face"]
    root["bodyProfile"] = spec["body"]
    root["outfitComponent"] = clothing.name
    root["gameplayHeight"] = 2.20
    root["spriteFrame"] = list(FRAME_SIZE)
    root["feetAnchor"] = list(FEET_ANCHOR)
    root["directions"] = list(ACTIVE_DIRECTIONS)
    root["refinementVersion"] = REFINEMENT_VERSION
    return root


def reset_refined_pose(asset_id):
    ORIGINAL_RESET_POSE(asset_id)
    rig = base.ASSET_RIGS[asset_id]
    for side in ("L", "R"):
        constraint = rig.pose.bones[f"forearm.{side}"].constraints.get(f"TrayHandIK.{side}")
        if constraint:
            constraint.influence = 0.0


def set_accessory_visibility(asset_id, component, visible):
    for obj in base.collection_objects_recursive(base.ASSET_COLLECTIONS[asset_id]):
        if obj.get("component") == component:
            obj.hide_render = not visible


def pose_refined_character(asset_id, animation="idle", frame=0):
    if animation != "walk_tray":
        ORIGINAL_POSE_CHARACTER(asset_id, animation, frame)
        return

    # Reuse the approved v001 leg cycle verbatim, then replace only arm solving.
    ORIGINAL_POSE_CHARACTER(asset_id, "walk_tray", frame)
    rig = base.ASSET_RIGS[asset_id]
    for side in ("L", "R"):
        rig.pose.bones[f"upper_arm.{side}"].rotation_euler = (0,0,0)
        rig.pose.bones[f"forearm.{side}"].rotation_euler = (0,0,0)
        rig.pose.bones[f"hand.{side}"].rotation_euler = (0,0,0)
        # A short wrist translation keeps the palm volume immediately below
        # the tray without changing arm length or rotating the wrist.
        rig.pose.bones[f"hand.{side}"].location = ((.06 if side == "L" else -.06),0,0)
        rig.pose.bones[f"hand_ik.{side}"].location = (0,0,0)
        rig.pose.bones[f"elbow_pole.{side}"].location = (0,0,0)
        constraint = rig.pose.bones[f"forearm.{side}"].constraints[f"TrayHandIK.{side}"]
        constraint.influence = 1.0
    set_accessory_visibility(asset_id, "empty_tray", True)
    set_accessory_visibility(asset_id, "cook_utensil", False)
    bpy.context.view_layer.update()


def all_action_fcurves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for channelbag in strip.channelbags:
                yield from channelbag.fcurves


def build_refined_rig_actions():
    asset_id = PLAYER_PRESETS[0]["id"]
    rig = base.ASSET_RIGS[asset_id]
    for animation in ANIMATION_SPECS:
        action = bpy.data.actions.new(f"APPROVAL_{animation.upper()}_4")
        action.use_fake_user = True
        rig.animation_data_create()
        rig.animation_data.action = action
        for frame in range(4):
            pose_refined_character(asset_id, animation, frame)
            for bone in rig.pose.bones:
                bone.keyframe_insert("rotation_euler", frame=frame+1, group=bone.name)
                bone.keyframe_insert("location", frame=frame+1, group=bone.name)
            for side in ("L", "R"):
                rig.pose.bones[f"forearm.{side}"].constraints[f"TrayHandIK.{side}"].keyframe_insert("influence", frame=frame+1)
        for fcurve in all_action_fcurves(action):
            for point in fcurve.keyframe_points:
                point.interpolation = "BEZIER"
        action["loopFrames"] = 4
        action["recordedFrames"] = [1,2,3,4]
        action["rootBobZ"] = [0.0,.035,0.0,.035] if animation in {"walk", "walk_tray"} else [0.0]*4
        action["approvalOnly"] = True
        action["refinementVersion"] = REFINEMENT_VERSION
        action["changedChannels"] = ["arm IK controls", "IK influences"] if animation == "walk_tray" else []
        rig.animation_data.action = None
    pose_refined_character(asset_id, "idle", 0)


def install_refinement_overrides():
    base.build_materials = build_refined_materials
    base.create_shared_armature_data = create_refined_armature_data
    base.build_character = build_refined_character
    base.reset_pose = reset_refined_pose
    base.pose_character = pose_refined_character
    base.build_rig_actions = build_refined_rig_actions
    base.OUTPUT_ROOT = REFINEMENT_OUTPUT_ROOT


def render_character_outputs():
    REFINEMENT_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    idle_paths = {}
    for spec in (*PLAYER_PRESETS, *FAMILY_CHARACTERS):
        for direction in ACTIVE_DIRECTIONS:
            path = REFINEMENT_OUTPUT_ROOT / "sprites" / "characters" / spec["id"] / "idle" / f"{direction}.png"
            base.render_asset(spec["id"], path, direction)
            idle_paths[(spec["id"], direction)] = path

    animations = {}
    prototype_id = PLAYER_PRESETS[0]["id"]
    for animation in ANIMATION_SPECS:
        frames = {}
        for direction in ACTIVE_DIRECTIONS:
            for frame in range(4):
                path = REFINEMENT_OUTPUT_ROOT / "animation_frames" / animation / direction / f"{frame:03d}.png"
                base.render_asset(prototype_id, path, direction, animation=animation, frame=frame)
                frames[(direction, frame)] = path
        base.compose_sheet(frames, REFINEMENT_OUTPUT_ROOT / ANIMATION_SPECS[animation]["sheet"])
        animations[animation] = frames

    base.compose_board([idle_paths[(spec["id"], "sw")] for spec in PLAYER_PRESETS], REFINEMENT_OUTPUT_ROOT / "approval_player_presets.png", columns=5, scale=3)
    base.compose_board([idle_paths[(prototype_id, direction)] for direction in ACTIVE_DIRECTIONS], REFINEMENT_OUTPUT_ROOT / "approval_player_turnaround.png", columns=4, scale=3)
    family = [*PLAYER_PRESETS, *FAMILY_CHARACTERS]
    base.compose_board([idle_paths[(spec["id"], "sw")] for spec in family], REFINEMENT_OUTPUT_ROOT / "approval_character_family.png", columns=len(family), scale=2, margin=24, gap=12)
    base.compose_board([idle_paths[(spec["id"], "sw")] for spec in family], REFINEMENT_OUTPUT_ROOT / "approval_characters_enlarged.png", columns=6, scale=4, margin=34, gap=22, crop=True)
    return idle_paths, animations


def render_fast_preview():
    asset_id = PLAYER_PRESETS[0]["id"]
    paths = []
    for direction in ACTIVE_DIRECTIONS:
        path = REFINEMENT_OUTPUT_ROOT / "preview_frames" / f"refined_{direction}.png"
        base.render_asset(asset_id, path, direction)
        paths.append(path)
    base.compose_board(paths, REFINEMENT_OUTPUT_ROOT / "preview_refined_player.png", columns=4, scale=4, crop=True)
    tray_paths = []
    for frame in range(4):
        path = REFINEMENT_OUTPUT_ROOT / "preview_frames" / f"tray_sw_{frame}.png"
        base.render_asset(asset_id, path, "sw", animation="walk_tray", frame=frame)
        tray_paths.append(path)
    base.compose_board(tray_paths, REFINEMENT_OUTPUT_ROOT / "preview_tray_pose.png", columns=4, scale=4, crop=True)
    return REFINEMENT_OUTPUT_ROOT / "preview_refined_player.png"


def write_refinement_manifest():
    data = {
        "version": REFINEMENT_VERSION,
        "scope": "approval character refinement only",
        "sourceBlend": str(REFINEMENT_BLEND.relative_to(REFINEMENT_BLEND.parents[3])).replace("\\", "/"),
        "preservedBlend": str((REFINEMENT_BLEND.parent / "cafe_tycoon_sprite_refresh_approval.blend").relative_to(REFINEMENT_BLEND.parents[3])).replace("\\", "/"),
        "unchangedContract": {
            "frameSize": list(FRAME_SIZE), "feetAnchor": list(FEET_ANCHOR),
            "directions": list(ACTIVE_DIRECTIONS), "characterOrthoScale": CHARACTER_ORTHO_SCALE,
            "gameplayHeight": 2.2,
        },
        "changed": {
            "models": [item["id"] for item in (*PLAYER_PRESETS, *FAMILY_CHARACTERS)],
            "materials": sorted(name for name in base.MATERIALS if name.startswith(("SkinSoft_", "SkinBlush_", "HairBase_", "HairHighlight_", "Fabric_", "Leather_", "Metal_"))),
            "rigControls": ["hand_ik.L", "hand_ik.R", "elbow_pole.L", "elbow_pole.R"],
            "animationChannels": {"walk": [], "cook": [], "walk_tray": ["upper arms solved by IK", "forearms solved by IK", "hand targets", "elbow poles", "IK influence"]},
        },
        "components": ["BODY", "HEAD", "FACE", "HAIR", "CLOTHING", "APRON", "ACCESSORIES"],
        "outputs": {
            "sprites": "sprites/characters/{assetId}/idle/{direction}.png",
            "animations": "animation_frames/{animation}/{direction}/{frame}.png",
            "boards": [
                "approval_character_detail_comparison.png", "approval_tray_arm_pose_comparison.png",
                "approval_player_presets.png", "approval_player_turnaround.png", "approval_character_family.png",
                "approval_characters_enlarged.png", "approval_walk_sheet.png", "approval_walk_tray_sheet.png", "approval_cook_sheet.png",
            ],
            "gif": "previews/walk_tray_4_directions.gif",
        },
    }
    (REFINEMENT_OUTPUT_ROOT / "refinement_manifest.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build_and_render_refinement():
    blend_path = Path(os.environ.get("BLENDER_CODEX_BLEND_PATH", str(REFINEMENT_BLEND)))
    preview_path = Path(os.environ.get("BLENDER_CODEX_PREVIEW_PATH", str(REFINEMENT_PREVIEW)))
    fast = os.environ.get("SPRITE_REFRESH_REFINEMENT_FAST", "0") == "1"
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    preview_path.parent.mkdir(parents=True, exist_ok=True)
    install_refinement_overrides()
    base.build_scene()
    scene = bpy.context.scene
    scene["prototype"] = "Cafe Tycoon character refinement approval v002"
    scene["refinementScope"] = "characters only; furniture/gameplay untouched"
    scene["preservedSource"] = str(REFINEMENT_BLEND.parent / "cafe_tycoon_sprite_refresh_approval.blend")
    base.reset_default_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    if fast:
        preview = render_fast_preview()
    else:
        render_character_outputs()
        write_refinement_manifest()
        preview = REFINEMENT_PREVIEW
    if preview.resolve() != preview_path.resolve():
        shutil.copyfile(preview, preview_path)
    base.reset_default_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(f"REFINEMENT_BLEND={blend_path}")
    print(f"REFINEMENT_PREVIEW={preview}")


def open_refinement_blend():
    if Path(bpy.data.filepath).resolve() != REFINEMENT_BLEND.resolve():
        bpy.ops.wm.open_mainfile(filepath=str(REFINEMENT_BLEND), load_ui=False)
    install_refinement_overrides()
    base.bind_scene_assets()
