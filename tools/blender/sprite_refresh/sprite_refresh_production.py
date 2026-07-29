"""Cafe Tycoon sprite-refresh production v003.

Builds a new editable Blender scene from the approved v002 character system,
adds the complete production catalog, and renders resumable RGBA source frames.
No v001/v002 file is opened for writing.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import shutil
from pathlib import Path

import bpy

import sprite_refresh_pipeline as base
import sprite_refresh_refinement as refined
from prototype_config import (
    ACTIVE_DIRECTIONS,
    CHARACTER_ORTHO_SCALE,
    DIRECTION_ROTATION,
    FEET_ANCHOR,
    FRAME_SIZE,
    FURNITURE_DIRECTIONS,
    PLAYER_PRESETS,
    WORLD_FRAME_SIZE,
    WORLD_ORTHO_SCALE,
)
from production_config import (
    ACTIVE_FURNITURE,
    APPROVED_V002_CUSTOMERS,
    CHARACTER_ANCHOR,
    CHARACTER_FRAME_SIZE,
    CLEANER_ANIMATIONS,
    COOK_ANIMATIONS,
    CUSTOMER_ANIMATIONS,
    FURNITURE_ANCHOR,
    FURNITURE_FRAME_SIZE,
    FURNITURE_LEVELS,
    NEW_CUSTOMERS,
    PRODUCTION_BLEND,
    PRODUCTION_OUTPUT_ROOT,
    PRODUCTION_PREVIEW,
    PRODUCTION_VERSION,
    STAFF_PROFESSIONS,
    WAITER_ANIMATIONS,
    animation_manifest_for_staff,
    furniture_asset_id,
    furniture_anchor_for_footprint,
    iter_furniture_render_assets,
    runtime_customer_id,
    runtime_staff_id,
)


PRODUCTION_CHARACTER_SPECS = tuple(APPROVED_V002_CUSTOMERS) + tuple(NEW_CUSTOMERS) + tuple(STAFF_PROFESSIONS)
COUNTER_MASTERS = {}
CACHE_PATH = PRODUCTION_OUTPUT_ROOT / "render_cache.json"
RENDER_CACHE = {}
RENDER_CACHE_REVISION = "production-v003-geometry-r2"
SERVICE_END_CAP_REVISION = "production-v003-service-end-cap-r3"
RENDER_CACHE_DIRTY = False


def _color(name, rgba, roughness=.6, metallic=0.0, emission=None, strength=0.0):
    return base.material(name, rgba, roughness=roughness, metallic=metallic, emission=emission, emission_strength=strength)


def build_production_materials():
    refined.build_refined_materials()
    palette = {
        "V003_WoodSimple": ((.40, .18, .065, 1), .67, 0),
        "V003_WoodSimpleLight": ((.66, .35, .12, 1), .62, 0),
        "V003_WoodContemporary": ((.49, .27, .12, 1), .48, 0),
        "V003_Ceramic": ((.74, .82, .76, 1), .34, 0),
        "V003_Graphite": ((.055, .065, .07, 1), .42, .22),
        "V003_Steel": ((.47, .52, .53, 1), .29, .72),
        "V003_Concrete": ((.25, .27, .27, 1), .79, 0),
        "V003_DarkWood": ((.16, .07, .035, 1), .42, 0),
        "V003_Quartz": ((.73, .70, .65, 1), .25, 0),
        "V003_MatteBlack": ((.018, .022, .025, 1), .47, .08),
        "V003_Brass": ((.61, .34, .055, 1), .24, .67),
        "V003_MarbleLight": ((.88, .86, .79, 1), .19, 0),
        "V003_MarbleDark": ((.075, .085, .08, 1), .20, 0),
        "V003_Gold": ((.78, .51, .095, 1), .19, .76),
        "V003_UpholsterySage": ((.11, .32, .24, 1), .82, 0),
        "V003_UpholsteryBlue": ((.08, .20, .34, 1), .78, 0),
        "V003_UpholsteryWine": ((.34, .035, .055, 1), .78, 0),
        "V003_UpholsteryCream": ((.72, .61, .45, 1), .72, 0),
        "V003_UpholsteryVelvet": ((.10, .28, .22, 1), .67, 0),
        "V003_Rubber": ((.025, .026, .028, 1), .71, 0),
        "V003_Glass": ((.32, .58, .62, .62), .12, 0),
        "V003_Water": ((.08, .52, .88, .82), .16, 0),
        "V003_Heat": ((1.0, .15, .015, 1), .18, 0),
        "V003_Indicator": ((.05, .84, .25, 1), .18, 0),
        "V003_Complete": ((.95, .58, .08, 1), .18, 0),
    }
    for name, (rgba, roughness, metallic) in palette.items():
        emission = rgba if name in {"V003_Heat", "V003_Indicator", "V003_Complete"} else None
        _color(name, rgba, roughness, metallic, emission, 4.0 if emission else 0.0)
    for name in ("V003_Glass", "V003_Water"):
        material = base.MATERIALS[name]
        if hasattr(material, "surface_render_method"):
            material.surface_render_method = "DITHERED"


def _mapped_character_spec(spec):
    mapped = dict(spec)
    mapped["id"] = runtime_customer_id(spec) if spec in APPROVED_V002_CUSTOMERS or spec in NEW_CUSTOMERS else runtime_staff_id(spec)
    mapped["hair"] = spec.get("base_hair", spec["hair"])
    mapped["face"] = spec.get("base_face", spec["face"])
    outfit = spec["outfit"]
    if outfit not in {"apron_green", "barista", "attendant", "customer_red", "customer_gold", "customer_teal", "customer_blue"}:
        if spec in STAFF_PROFESSIONS:
            mapped["outfit"] = "barista" if outfit != "cleaner" else "attendant"
        else:
            families = ("customer_red", "customer_gold", "customer_teal", "customer_blue")
            mapped["outfit"] = families[sum(map(ord, outfit)) % len(families)]
    return mapped


def _part(asset_id, suffix, location, dimensions, material, collection, rig, bone="head", bevel=.025, rotation=(0, 0, 0), component="accessories"):
    return refined.refined_part(
        f"{asset_id}:v003:{suffix}", location, dimensions, base.MATERIALS[material], collection, rig, bone,
        bevel=bevel, rotation=rotation, component=component, detail=f"production-{suffix}",
    )


def add_hair_silhouette(spec, asset_id):
    style = spec["hair"]
    if style == spec.get("base_hair", style):
        return
    source = base.ASSET_COLLECTIONS[asset_id]
    hair_collection = next((item for item in source.children_recursive if item.name.startswith(f"{asset_id}_HAIR")), source)
    rig = base.ASSET_RIGS[asset_id]
    hair = f"HairBase_{spec['hair_color']}"
    highlight = f"HairHighlight_{spec['hair_color']}"
    if style == "bald":
        for obj in base.collection_objects_recursive(hair_collection):
            obj.hide_render = True
        _part(asset_id, "bald-shadow", (0, .13, 1.99), (.42, .22, .06), hair, hair_collection, rig, bevel=.035, component="hair")
    elif style in {"bob", "long_wave", "long_straight"}:
        length = .52 if style == "bob" else .90
        z = 1.80 if style == "bob" else 1.60
        for side, x in (("L", .29), ("R", -.29)):
            _part(asset_id, f"{style}-{side}", (x, .08, z), (.15, .30, length), hair if side == "L" else highlight, hair_collection, rig, bevel=.055, component="hair")
        _part(asset_id, f"{style}-back", (0, .26, z+.05), (.48, .16, length*.92), hair, hair_collection, rig, bevel=.06, component="hair")
    elif style in {"ponytail", "low_bun"}:
        _part(asset_id, f"{style}-tie", (0, .31, 1.98 if style == "ponytail" else 1.86), (.16, .12, .15), highlight, hair_collection, rig, bevel=.05, component="hair")
        if style == "ponytail":
            _part(asset_id, "ponytail-length", (0, .36, 1.62), (.22, .18, .68), hair, hair_collection, rig, bevel=.07, component="hair")
        else:
            _part(asset_id, "low-bun", (0, .35, 1.83), (.32, .27, .30), hair, hair_collection, rig, bevel=.09, component="hair")
    elif style in {"braids", "locs", "braid_crown"}:
        if style == "braid_crown":
            for index, x in enumerate((-.24, -.12, 0, .12, .24)):
                _part(asset_id, f"crown-braid-{index}", (x, -.01, 2.14 + .03*(1-abs(index-2))), (.15, .22, .13), highlight if index % 2 else hair, hair_collection, rig, bevel=.045, component="hair")
        else:
            for index, x in enumerate((-.27, -.16, -.05, .07, .18, .28)):
                _part(asset_id, f"{style}-{index}", (x, .18, 1.68-(index%2)*.08), (.075, .10, .68), highlight if index % 2 else hair, hair_collection, rig, bevel=.028, component="hair")
    elif style in {"fade", "pixie", "messy", "receding", "short_afro"}:
        if style == "receding":
            _part(asset_id, "receding-sides", (0, .18, 2.00), (.49, .22, .16), hair, hair_collection, rig, bevel=.045, component="hair")
        elif style == "short_afro":
            for index, (x, y) in enumerate(((-.22,-.10),(0,-.16),(.22,-.1),(-.2,.08),(0,.10),(.2,.08))):
                _part(asset_id, f"afro-{index}", (x, y, 2.17), (.20,.20,.19), highlight if index in {1,4} else hair, hair_collection, rig, bevel=.07, component="hair")
        else:
            for index, (x, z, rz) in enumerate(((-.22,2.10,.20),(-.07,2.18,.09),(.09,2.17,-.06),(.23,2.11,-.22))):
                _part(asset_id, f"{style}-{index}", (x,-.12,z), (.17,.22,.13), highlight if index in {1,2} else hair, hair_collection, rig, bevel=.045, rotation=(0,.1,rz), component="hair")


def add_face_silhouette(spec, asset_id):
    style = spec["face"]
    if style == spec.get("base_face", style):
        return
    source = base.ASSET_COLLECTIONS[asset_id]
    head_collection = next((item for item in source.children_recursive if item.name.startswith(f"{asset_id}_HEAD")), source)
    rig = base.ASSET_RIGS[asset_id]
    skin = f"SkinSoft_{spec['skin']}"
    if style == "round":
        for side, x in (("L", .255), ("R", -.255)):
            _part(asset_id, f"face-silhouette-round-{side}", (x,-.238,1.68), (.13,.055,.15), skin, head_collection, rig, bevel=.052, component="face")
    elif style == "angular":
        for side, x in (("L", .245), ("R", -.245)):
            _part(asset_id, f"face-silhouette-angular-{side}", (x,-.232,1.60), (.115,.06,.145), skin, head_collection, rig, bevel=.026, rotation=(0,0,.18 if side == "L" else -.18), component="face")
    elif style == "diamond":
        for side, x in (("L", .275), ("R", -.275)):
            _part(asset_id, f"face-silhouette-diamond-{side}", (x,-.235,1.72), (.12,.055,.12), skin, head_collection, rig, bevel=.035, component="face")
        _part(asset_id, "face-silhouette-diamond-chin", (0,-.235,1.535), (.16,.055,.11), skin, head_collection, rig, bevel=.028, component="face")


def add_outfit_silhouette(spec, asset_id):
    if spec in STAFF_PROFESSIONS:
        return
    style = spec["outfit"]
    source = base.ASSET_COLLECTIONS[asset_id]
    clothing = next((item for item in source.children_recursive if item.name.startswith(f"{asset_id}_CLOTHING")), source)
    rig = base.ASSET_RIGS[asset_id]
    palettes = ("Fabric_Red", "Fabric_Gold", "Fabric_Teal", "Fabric_Blue", "Fabric_Sage", "Fabric_Wine")
    accent = palettes[sum(map(ord, style)) % len(palettes)]
    if style == "casual_cardigan":
        for side, x in (("L", .15), ("R", -.15)):
            _part(asset_id, f"outfit-{style}-{side}", (x,-.275,1.17), (.22,.055,.52), accent, clothing, rig, bone="torso", bevel=.032, component="clothing")
        _part(asset_id, f"outfit-{style}-hem", (0,-.286,.91), (.56,.04,.07), "Fabric_Stitch", clothing, rig, bone="torso", bevel=.014, component="clothing")
    elif style == "casual_hoodie":
        _part(asset_id, f"outfit-{style}-hood", (0,.16,1.53), (.55,.23,.35), accent, clothing, rig, bone="torso", bevel=.08, component="clothing")
        for side, x in (("L", .09), ("R", -.09)):
            _part(asset_id, f"outfit-{style}-cord-{side}", (x,-.285,1.31), (.025,.025,.28), "Fabric_Stitch", clothing, rig, bone="torso", bevel=.006, component="clothing")
        _part(asset_id, f"outfit-{style}-pocket", (0,-.293,1.00), (.40,.035,.19), accent, clothing, rig, bone="torso", bevel=.03, component="clothing")
    elif style == "casual_polo":
        for side, x in (("L", .10), ("R", -.10)):
            _part(asset_id, f"outfit-{style}-collar-{side}", (x,-.275,1.43), (.18,.05,.17), accent, clothing, rig, bone="torso", bevel=.024, rotation=(0,0,.18 if side == "L" else -.18), component="clothing")
        _part(asset_id, f"outfit-{style}-placket", (0,-.292,1.30), (.07,.03,.22), "Fabric_Stitch", clothing, rig, bone="torso", bevel=.009, component="clothing")
    elif style == "elegant_blazer":
        for side, x in (("L", .13), ("R", -.13)):
            _part(asset_id, f"outfit-{style}-lapel-{side}", (x,-.292,1.31), (.22,.055,.36), accent, clothing, rig, bone="torso", bevel=.025, rotation=(0,0,.28 if side == "L" else -.28), component="clothing")
            _part(asset_id, f"outfit-{style}-shoulder-{side}", (.35 if side == "L" else -.35,-.04,1.43), (.20,.30,.10), accent, clothing, rig, bone=f"upper_arm.{side}", bevel=.035, component="clothing")
    elif style == "elegant_dress":
        _part(asset_id, f"outfit-{style}-skirt", (0,-.18,.94), (.67,.35,.58), accent, clothing, rig, bone="pelvis", bevel=.065, component="clothing")
        _part(asset_id, f"outfit-{style}-waist", (0,-.285,1.18), (.55,.045,.10), "Fabric_Stitch", clothing, rig, bone="torso", bevel=.018, component="clothing")
    elif style == "social_vest":
        for side, x in (("L", .14), ("R", -.14)):
            _part(asset_id, f"outfit-{style}-panel-{side}", (x,-.286,1.23), (.23,.05,.46), accent, clothing, rig, bone="torso", bevel=.028, component="clothing")
        _part(asset_id, f"outfit-{style}-watch-pocket", (.17,-.318,1.10), (.17,.025,.10), "Metal_Brass", clothing, rig, bone="torso", bevel=.012, component="clothing")
    elif style == "sporty":
        _part(asset_id, f"outfit-{style}-stripe", (0,-.294,1.25), (.58,.035,.15), accent, clothing, rig, bone="torso", bevel=.018, component="clothing")
        _part(asset_id, f"outfit-{style}-zip", (0,-.318,1.18), (.035,.022,.53), "Metal_Silver", clothing, rig, bone="torso", bevel=.007, component="clothing")
    elif style == "urban_jacket":
        _part(asset_id, f"outfit-{style}-raised-collar", (0,-.16,1.48), (.53,.24,.19), accent, clothing, rig, bone="torso", bevel=.045, component="clothing")
        for side, x in (("L", .20), ("R", -.20)):
            _part(asset_id, f"outfit-{style}-pocket-{side}", (x,-.302,1.03), (.20,.04,.18), accent, clothing, rig, bone="torso", bevel=.025, component="clothing")


def add_accessories_and_profession(spec, asset_id):
    source = base.ASSET_COLLECTIONS[asset_id]
    accessories = next((item for item in source.children_recursive if item.name.startswith(f"{asset_id}_ACCESSORIES")), source)
    clothing = next((item for item in source.children_recursive if item.name.startswith(f"{asset_id}_CLOTHING")), accessories)
    rig = base.ASSET_RIGS[asset_id]
    items = set(spec.get("accessories", []))
    if "glasses" in items:
        for side, x in (("L", .14), ("R", -.14)):
            _part(asset_id, f"glasses-{side}", (x,-.304,1.835), (.135,.018,.105), "Accessory_Dark", accessories, rig, bevel=.012)
        _part(asset_id, "glasses-bridge", (0,-.307,1.84), (.12,.014,.025), "Accessory_Dark", accessories, rig, bevel=.004)
    if "earrings" in items:
        for side, x in (("L", .31), ("R", -.31)):
            _part(asset_id, f"earring-{side}", (x,-.01,1.70), (.035,.035,.075), "Metal_Brass", accessories, rig, bevel=.012)
    if "watch" in items:
        _part(asset_id, "watch", (.40,-.12,.98), (.22,.24,.055), "Metal_Brass", accessories, rig, bone="forearm.L", bevel=.014)
    if "bag" in items:
        _part(asset_id, "bag-strap", (-.22,-.23,1.19), (.07,.04,.70), "Leather_Upper", accessories, rig, bone="torso", bevel=.014, rotation=(0,0,-.35))
        _part(asset_id, "bag", (-.45,-.02,.84), (.31,.18,.38), "Leather_Toe", accessories, rig, bone="pelvis", bevel=.055)
    if "cap" in items or spec.get("hair") == "cap":
        _part(asset_id, "cap-crown", (0,-.01,2.16), (.52,.38,.18), "Fabric_Green", accessories, rig, bevel=.065)
        _part(asset_id, "cap-brim", (0,-.27,2.10), (.39,.25,.055), "Fabric_GreenLight", accessories, rig, bevel=.025)
    if "bandana" in items or spec.get("hair") == "bandana":
        _part(asset_id, "bandana", (0,-.02,2.08), (.56,.43,.10), "Fabric_Wine", accessories, rig, bevel=.035)
        _part(asset_id, "bandana-tail", (-.20,.27,1.98), (.12,.08,.30), "Fabric_Wine", accessories, rig, bevel=.025, rotation=(0,.2,.16))
    if "chef_hat" in items or spec.get("hair") == "chef_hat":
        _part(asset_id, "chef-hat-band", (0,0,2.10), (.52,.40,.18), "Fabric_Ivory", accessories, rig, bevel=.05)
        for index, x in enumerate((-.19,-.06,.07,.20)):
            _part(asset_id, f"chef-hat-lobe-{index}", (x,.01,2.28+(index%2)*.04), (.20,.23,.24), "Fabric_Ivory", accessories, rig, bevel=.075)
    if spec in STAFF_PROFESSIONS:
        profession = spec["professionId"]
        accent_by_profession = {
            "barista": "Fabric_Green", "service": "Fabric_Wine", "cleaner": "Fabric_Teal",
            "oven_specialist": "Fabric_Gold", "griddle_specialist": "V003_Graphite", "soup_specialist": "Fabric_Teal",
            "oriental_chef": "Fabric_Red", "grill_specialist": "Leather_Toe", "general_cook": "Fabric_Cream",
            "fryer_specialist": "Fabric_Gold", "pastry_chef": "Fabric_Sky", "sushi_chef": "Fabric_Blue",
        }
        accent = accent_by_profession[profession]
        _part(asset_id, "profession-apron-panel", (0,-.292,1.02), (.50,.045,.54), accent, clothing, rig, bone="torso", bevel=.032)
        _part(asset_id, "profession-apron-band", (0,-.315,1.28), (.58,.035,.075), "Fabric_Stitch", clothing, rig, bone="torso", bevel=.012)
        if profession in {"griddle_specialist", "fryer_specialist", "oven_specialist", "grill_specialist"}:
            _part(asset_id, "thermal-sleeve-L", (.39,-.08,1.20), (.245,.285,.18), "V003_Graphite", clothing, rig, bone="upper_arm.L", bevel=.035)
        if profession in {"oriental_chef", "sushi_chef"}:
            _part(asset_id, "cross-collar-L", (.12,-.276,1.38), (.32,.045,.09), accent, clothing, rig, bone="torso", bevel=.018, rotation=(0,0,-.52))
            _part(asset_id, "cross-collar-R", (-.12,-.276,1.38), (.32,.045,.09), accent, clothing, rig, bone="torso", bevel=.018, rotation=(0,0,.52))
        if profession == "cleaner":
            for side, x in (("L", .18), ("R", -.18)):
                _part(asset_id, f"utility-pocket-{side}", (x,-.325,.93), (.19,.035,.18), "Fabric_GreenLight", clothing, rig, bone="torso", bevel=.022)
        if profession == "barista":
            _part(asset_id, "coffee-badge-v003", (.16,-.333,1.34), (.11,.025,.11), "Metal_Brass", accessories, rig, bone="torso", bevel=.026)
    root = base.ASSET_ROOTS[asset_id]
    root["productionVersion"] = PRODUCTION_VERSION
    root["visualSignature"] = json.dumps({key: spec.get(key) for key in ("face", "hair", "hair_color", "skin", "outfit", "body", "accessories")}, ensure_ascii=False)
    root["professionId"] = spec.get("professionId", "customer")
    root["runtimeId"] = asset_id


def build_production_character(spec):
    mapped = _mapped_character_spec(spec)
    refined.build_refined_character(mapped)
    asset_id = mapped["id"]
    add_face_silhouette(spec, asset_id)
    add_hair_silhouette(spec, asset_id)
    add_outfit_silhouette(spec, asset_id)
    add_accessories_and_profession(spec, asset_id)
    return base.ASSET_ROOTS[asset_id]


def ensure_production_augmentations():
    for spec in PRODUCTION_CHARACTER_SPECS:
        asset_id = runtime_customer_id(spec) if spec in APPROVED_V002_CUSTOMERS or spec in NEW_CUSTOMERS else runtime_staff_id(spec)
        if spec["face"] != spec.get("base_face", spec["face"]):
            marker = f"{asset_id}:v003:face-silhouette-{spec['face']}"
            if not any(obj.name.startswith(marker) for obj in bpy.data.objects):
                add_face_silhouette(spec, asset_id)
        if spec not in STAFF_PROFESSIONS:
            marker = f"{asset_id}:v003:outfit-{spec['outfit']}"
            if not any(obj.name.startswith(marker) for obj in bpy.data.objects):
                add_outfit_silhouette(spec, asset_id)
    ensure_furniture_tile_alignment()


def ensure_furniture_tile_alignment():
    """Upgrade an opened v003 scene to the current footprint/side-cap contract."""
    for definition, _level, _connection, _layer, asset_id in iter_furniture_render_assets():
        root = base.ASSET_ROOTS.get(asset_id)
        if root is not None:
            root["anchor"] = list(furniture_anchor_for_footprint(definition["footprint"]))
    for obj in (candidate for candidate in bpy.data.objects if candidate.name.endswith(":end-trim")):
        obj.location.z = .56
        expected = (.035, .90, .88)
        current = tuple(float(value) for value in obj.dimensions)
        if all(value > 0 for value in current):
            scale = tuple(target / value for target, value in zip(expected, current))
            for vertex in obj.data.vertices:
                vertex.co.x *= scale[0]
                vertex.co.y *= scale[1]
                vertex.co.z *= scale[2]
            obj.data.update()
        obj["tileAlignment"] = "plinth-to-countertop"
    bpy.context.view_layer.update()


def build_production_characters():
    refined.create_refined_armature_data()
    for spec in PLAYER_PRESETS:
        refined.build_refined_character(spec)
    for spec in PRODUCTION_CHARACTER_SPECS:
        build_production_character(spec)


def _level_materials(level):
    return {
        1: ("V003_WoodSimple", "V003_WoodSimpleLight", "V003_Graphite", "V003_UpholsterySage"),
        2: ("V003_WoodContemporary", "V003_Ceramic", "V003_Steel", "V003_UpholsteryBlue"),
        3: ("V003_Graphite", "V003_Steel", "V003_Concrete", "V003_UpholsteryWine"),
        4: ("V003_DarkWood", "V003_Quartz", "V003_MatteBlack", "V003_UpholsteryCream"),
        5: ("V003_DarkWood", "V003_MarbleLight", "V003_Gold", "V003_UpholsteryVelvet"),
    }[level]


def build_counter_master(level):
    body_mat, top_mat, trim_mat, _ = _level_materials(level)
    master = bpy.data.collections.new(f"COUNTER_BASE_L{level}")
    root = base.new_empty(f"COUNTER_BASE_L{level}:origin", master)
    root["width"] = 1.0; root["depth"] = 1.0; root["counterHeight"] = 1.10; root["tolerance"] = .001
    base.cube(f"COUNTER_BASE_L{level}:plinth", (0,0,.06), (.92,.92,.12), base.MATERIALS[trim_mat], master, bevel=.025)
    base.cube(f"COUNTER_BASE_L{level}:body", (0,.01,.53), (.94,.90,.82), base.MATERIALS[body_mat], master, bevel=.055)
    base.cube(f"COUNTER_BASE_L{level}:front", (0,-.452,.56), (.76,.035,.56), base.MATERIALS[body_mat], master, bevel=.025)
    base.cube(f"COUNTER_BASE_L{level}:top", (0,0,1.05), (1.0,1.0,.10), base.MATERIALS[top_mat], master, bevel=.035)
    for side, x in (("L", .27), ("R", -.27)):
        base.cube(f"COUNTER_BASE_L{level}:door:{side}", (x,-.474,.57), (.38,.025,.50), base.MATERIALS[body_mat], master, bevel=.022)
        base.cube(f"COUNTER_BASE_L{level}:handle:{side}", (x,-.495,.67), (.16,.025,.035), base.MATERIALS[trim_mat], master, bevel=.008)
    COUNTER_MASTERS[level] = master
    return master


def _visible(obj, *states):
    return base.state_object(obj, *states)


def _counter_instances(source, root, level, footprint):
    width = footprint[0]
    for index in range(width):
        instance = base.new_empty(f"{root.name}:counter-base:{index}", source, parent=root)
        instance.instance_type = "COLLECTION"
        instance.instance_collection = COUNTER_MASTERS[level]
        instance.location.x = index - (width - 1) / 2
        instance["counterBaseAssetId"] = f"COUNTER_BASE_L{level}"
    root["counterBaseAssetId"] = f"COUNTER_BASE_L{level}"
    root["structuralDimensions"] = [float(width), 1.0, 1.10]


def _add_appliance_component(asset_id, source, definition, level):
    component = definition["component"]
    _, top_mat, trim_mat, upholstery = _level_materials(level)
    metal = base.MATERIALS["V003_Steel" if level < 4 else "V003_MatteBlack"]
    dark = base.MATERIALS["V003_Graphite"]
    gold = base.MATERIALS[trim_mat]
    if component == "service":
        base.ASSET_ROOTS[asset_id]["surfaceClear"] = True
        return
    if component in {"stove", "griddle", "grill"}:
        base.cube(f"{asset_id}:cooktop", (0,0,1.14), (.76,.72,.10), dark, source, bevel=.035)
        count = 4 if component == "stove" else 2
        for index in range(count):
            x = (-.22,.22,-.22,.22)[index]; y = (-.20,-.20,.20,.20)[index]
            ring = base.torus(f"{asset_id}:heat:{index}", (x,y,1.205), .105,.018,base.MATERIALS["V003_Heat"],source)
            _visible(ring, "active_1", "active_2")
    elif component in {"oven", "bakery"}:
        base.cube(f"{asset_id}:oven-body", (0,.03,1.50), (.76,.60,.76), metal, source, bevel=.06)
        base.cube(f"{asset_id}:oven-door", (0,-.285,1.45), (.61,.045,.49), dark, source, bevel=.035)
        window = base.cube(f"{asset_id}:oven-window", (0,-.313,1.48), (.43,.022,.29), base.MATERIALS["V003_Glass"], source, bevel=.025)
        glow = base.cube(f"{asset_id}:oven-glow", (0,-.327,1.48), (.38,.012,.24), base.MATERIALS["V003_Heat"], source, bevel=.02)
        _visible(glow, "active_1", "active_2")
    elif component == "fryer":
        base.cube(f"{asset_id}:fryer-well", (0,.02,1.17), (.58,.55,.18), dark, source, bevel=.035)
        base.cube(f"{asset_id}:basket", (0,-.01,1.27), (.45,.42,.13), metal, source, bevel=.025)
        base.cube(f"{asset_id}:handle", (0,-.39,1.30), (.12,.38,.08), base.MATERIALS["V003_Rubber"], source, bevel=.025)
        glow = base.cube(f"{asset_id}:oil-heat", (0,-.01,1.345), (.48,.43,.035), base.MATERIALS["V003_Heat"], source, bevel=.015)
        _visible(glow, "active_1", "active_2")
    elif component == "kettle":
        base.cylinder(f"{asset_id}:kettle", (0,.02,1.43), .33,.55,metal,source,vertices=20,bevel=.045)
        base.torus(f"{asset_id}:rim", (0,.02,1.72), .33,.025,gold,source)
        steam = base.cube(f"{asset_id}:steam", (.08,.01,1.92), (.16,.13,.25), base.MATERIALS["Steam"], source, bevel=.07)
        _visible(steam, "active_1", "active_2")
    elif component == "coffee":
        base.cube(f"{asset_id}:machine", (0,.08,1.46), (.68,.48,.62), metal, source, bevel=.055)
        base.cube(f"{asset_id}:machine-front", (0,-.175,1.47), (.52,.055,.38), dark, source, bevel=.025)
        for x in (-.18,.18):
            base.cylinder(f"{asset_id}:group:{x}",(x,-.23,1.45),.055,.08,gold,source,vertices=12,rotation=(math.radians(90),0,0),bevel=.01)
        steam = base.cube(f"{asset_id}:steam", (.20,-.16,1.91), (.15,.12,.27), base.MATERIALS["Steam"], source, bevel=.07)
        _visible(steam, "active_1", "active_2")
    elif component == "sink":
        base.cube(f"{asset_id}:basin", (0,-.02,1.13), (.60,.52,.08), dark, source, bevel=.05)
        base.cylinder(f"{asset_id}:faucet", (0,.25,1.38), .035,.48,gold,source,vertices=10,bevel=.01)
        base.cube(f"{asset_id}:faucet-neck", (0,.13,1.59), (.07,.28,.07), gold, source, bevel=.025)
        water = base.cylinder(f"{asset_id}:water", (0,-.01,1.39), .045,.42,base.MATERIALS["V003_Water"],source,vertices=10,bevel=.007)
        _visible(water, "active_1", "active_2")
    elif component in {"prep", "pastry"}:
        width = definition["footprint"][0]
        base.cube(f"{asset_id}:work-inlay", (0,-.02,1.115), (.74*width,.67,.025), base.MATERIALS[top_mat], source, bevel=.012)
        rails = base.cube(f"{asset_id}:work-rails", (0,.30,1.19), (.66*width,.055,.10), gold, source, bevel=.018)
        _visible(rails, "active_1", "active_2", "complete")
    elif component == "drinks":
        base.cube(f"{asset_id}:dispenser", (0,.08,1.47), (.68,.47,.64), metal, source, bevel=.055)
        for index, x in enumerate((-.20,0,.20)):
            base.cube(f"{asset_id}:drink-panel:{index}", (x,-.17,1.57), (.15,.035,.26), base.MATERIALS[("Fabric_Red","Fabric_Gold","Fabric_Teal")[index]], source, bevel=.025)
            base.cylinder(f"{asset_id}:tap:{index}",(x,-.24,1.40),.03,.09,gold,source,vertices=10,rotation=(math.radians(90),0,0),bevel=.008)
    indicator = base.cube(f"{asset_id}:indicator", (.34,-.50,1.19), (.10,.035,.10), base.MATERIALS["V003_Indicator"], source, bevel=.018)
    _visible(indicator, "active_1", "active_2")
    complete = base.cube(f"{asset_id}:complete", (-.34,-.50,1.19), (.10,.035,.10), base.MATERIALS["V003_Complete"], source, bevel=.018)
    _visible(complete, "complete")


def build_furniture_asset(definition, level, connection, layer, asset_id):
    source, root = base.create_source_asset(asset_id, "furniture")
    root["furnitureId"] = definition["furnitureId"]
    root["level"] = level
    root["footprint"] = definition["footprint"]
    root["pivot"] = [0,0,0]
    root["anchor"] = list(furniture_anchor_for_footprint(definition["footprint"]))
    root["directions"] = list(FURNITURE_DIRECTIONS)
    root["states"] = definition["states"]
    root["structuralTolerance"] = .001
    root["productionVersion"] = PRODUCTION_VERSION
    if connection:
        root["connectionVariant"] = connection
    body_mat, top_mat, trim_mat, upholstery = _level_materials(level)
    component = definition["component"]
    if component == "table":
        base.cube(f"{asset_id}:top", (0,0,.74), (.84,.84,.13), base.MATERIALS[top_mat], source, bevel=.055)
        base.cube(f"{asset_id}:inlay", (0,0,.815), (.66,.66,.025), base.MATERIALS[trim_mat], source, bevel=.018)
        for x in (-.30,.30):
            for y in (-.30,.30):
                base.cube(f"{asset_id}:leg:{x}:{y}",(x,y,.37),(.13,.13,.69),base.MATERIALS[body_mat],source,bevel=.035)
    elif component == "chair":
        full = layer in {None, "full"}
        if full or layer == "front":
            base.cube(f"{asset_id}:seat",(0,0,.48),(.52,.48,.13),base.MATERIALS[upholstery],source,bevel=.045)
            for x in (-.20,.20):
                base.cube(f"{asset_id}:front-leg:{x}",(x,-.16,.23),(.09,.09,.44),base.MATERIALS[body_mat],source,bevel=.025)
        if full or layer == "back":
            base.cube(f"{asset_id}:back",(0,.20,.82),(.52,.12,.62),base.MATERIALS[body_mat],source,bevel=.055)
            base.cube(f"{asset_id}:back-inlay",(0,.13,.84),(.38,.035,.40),base.MATERIALS[upholstery],source,bevel=.028)
            for x in (-.20,.20):
                base.cube(f"{asset_id}:rear-leg:{x}",(x,.16,.23),(.09,.09,.44),base.MATERIALS[body_mat],source,bevel=.025)
        root["layerRole"] = layer or "full"
    else:
        _counter_instances(source, root, level, definition["footprint"])
        if connection in {"left", "right"}:
            x = -.49 if connection == "left" else .49
            end_cap = base.cube(f"{asset_id}:end-trim", (x,0,.56), (.035,.90,.88), base.MATERIALS[trim_mat], source, bevel=.004)
            end_cap["tileAlignment"] = "plinth-to-countertop"
        _add_appliance_component(asset_id, source, definition, level)
    return root


def build_production_furniture():
    for level in range(1, 6):
        build_counter_master(level)
    for definition, level, connection, layer, asset_id in iter_furniture_render_assets():
        build_furniture_asset(definition, level, connection, layer, asset_id)


def build_production_technical_scenes():
    root = base.collection("TECHNICAL_PRODUCTION_V003", link_scene=True)
    root.hide_render = True
    for level in range(1, 6):
        row = bpy.data.collections.new(f"TECH_COUNTER_ALIGNMENT_L{level}")
        root.children.link(row)
        row.hide_render = True
        for index, slug in enumerate(("c1_service", "a1_stove", "a8_coffee", "b5_sink", "a4_fryer")):
            definition = next(item for item in ACTIVE_FURNITURE if item["slug"] == slug)
            asset_id = furniture_asset_id(definition, level, "isolated" if slug == "c1_service" else None)
            base.instance_asset(asset_id, f"alignment:l{level}:{slug}", row, (index, level*1.5, 0))
        row["tolerance"] = .001


def _set_bone(rig, bone, x=0, y=0, z=0):
    rig.pose.bones[bone].rotation_euler = (math.radians(x), math.radians(y), math.radians(z))


def production_pose(asset_id, animation="idle", frame=0):
    phase = frame % 4
    if animation in {"idle", "walk", "walk_tray", "cook"}:
        refined.pose_refined_character(asset_id, animation, phase)
        return
    refined.reset_refined_pose(asset_id)
    rig = base.ASSET_RIGS[asset_id]
    root = base.ASSET_ROOTS[asset_id]
    if animation in {"carry", "tray_idle"}:
        _set_bone(rig, "upper_arm.L", -47); _set_bone(rig, "upper_arm.R", -47)
        _set_bone(rig, "forearm.L", -62); _set_bone(rig, "forearm.R", -62)
        if animation == "tray_idle":
            refined.set_accessory_visibility(asset_id, "empty_tray", True)
    elif animation == "talk":
        _set_bone(rig, "upper_arm.L", (-12,-28,-16,-34)[phase], 0, (8,-10,12,-8)[phase])
        _set_bone(rig, "forearm.L", (-28,-48,-34,-54)[phase])
    elif animation in {"clean", "wash"}:
        _set_bone(rig, "upper_arm.L", (-36,-54,-30,-48)[phase]); _set_bone(rig, "upper_arm.R", (-52,-34,-58,-38)[phase])
        _set_bone(rig, "forearm.L", (-50,-68,-44,-62)[phase]); _set_bone(rig, "forearm.R", (-66,-46,-72,-52)[phase])
    elif animation in {"seated", "sit", "eat", "drink"}:
        progress = 1.0 if animation != "sit" else (phase / 3.0)
        _set_bone(rig, "thigh.L", 78*progress); _set_bone(rig, "thigh.R", 78*progress)
        _set_bone(rig, "shin.L", -72*progress); _set_bone(rig, "shin.R", -72*progress)
        root.location.z = .20 * progress
        if animation in {"eat", "drink"}:
            amount = (38,55,45,62)[phase]
            _set_bone(rig, "upper_arm.L", -amount); _set_bone(rig, "upper_arm.R", -amount+6)
            _set_bone(rig, "forearm.L", -amount-18); _set_bone(rig, "forearm.R", -amount-12)
    bpy.context.view_layer.update()


def install_production_overrides():
    refined.install_refinement_overrides()
    base.build_materials = build_production_materials
    base.build_characters = build_production_characters
    base.build_furniture = build_production_furniture
    base.build_technical_scenes = build_production_technical_scenes
    base.pose_character = production_pose
    base.OUTPUT_ROOT = PRODUCTION_OUTPUT_ROOT


def load_cache():
    global RENDER_CACHE
    if CACHE_PATH.exists():
        try:
            RENDER_CACHE = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            RENDER_CACHE = {}


def save_cache():
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(RENDER_CACHE, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def cached_render(asset_id, path, direction, *, state="idle", animation="idle", frame=0):
    path = Path(path)
    key = str(path.relative_to(PRODUCTION_OUTPUT_ROOT)).replace("\\", "/")
    revision = SERVICE_END_CAP_REVISION if asset_id.startswith("v003_c1_service_") and any(token in asset_id for token in ("_left_", "_right_")) else RENDER_CACHE_REVISION
    signature = hashlib.sha256(json.dumps({"v": revision, "asset": asset_id, "direction": direction, "state": state, "animation": animation, "frame": frame}, sort_keys=True).encode()).hexdigest()
    record = RENDER_CACHE.get(key)
    if path.exists() and record and record.get("signature") == signature and record.get("size") == path.stat().st_size:
        return path
    base.render_asset(asset_id, path, direction, state=state, animation=animation, frame=frame)
    RENDER_CACHE[key] = {"signature": signature, "size": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    return path


def character_keyframe(asset_id, pose, direction, phase):
    if pose in {"carry", "tray_idle", "seated"}:
        phase = 0
    path = PRODUCTION_OUTPUT_ROOT / "keyframes" / "characters" / asset_id / pose / direction / f"{phase:02d}.png"
    return cached_render(asset_id, path, direction, animation=pose, frame=phase)


def render_approval_set():
    customer_paths = []
    for spec in NEW_CUSTOMERS:
        asset_id = runtime_customer_id(spec)
        customer_paths.append(character_keyframe(asset_id, "idle", "sw", 0))
    staff_paths = []
    staff_turnarounds = []
    for spec in STAFF_PROFESSIONS:
        asset_id = runtime_staff_id(spec)
        staff_paths.append(character_keyframe(asset_id, "idle", "sw", 0))
        for direction in ACTIVE_DIRECTIONS:
            staff_turnarounds.append(character_keyframe(asset_id, "idle", direction, 0))
    furniture_overview = []
    active_states = []
    for definition in ACTIVE_FURNITURE:
        for level in range(1, 6):
            connection = "isolated" if definition.get("connectionVariants") else None
            asset_id = furniture_asset_id(definition, level, connection, "full" if definition.get("layers") else None)
            path = PRODUCTION_OUTPUT_ROOT / "keyframes" / "furniture" / asset_id / definition["states"][0] / "sw.png"
            furniture_overview.append(cached_render(asset_id, path, "sw", state=definition["states"][0]))
            if len(definition["states"]) > 1:
                for state in definition["states"]:
                    active_path = PRODUCTION_OUTPUT_ROOT / "keyframes" / "furniture" / asset_id / state / "sw.png"
                    active_states.append(cached_render(asset_id, active_path, "sw", state=state))
    base.compose_board(customer_paths, PRODUCTION_OUTPUT_ROOT / "approval_customers_30_unlabeled.png", columns=5, scale=4, margin=30, gap=18, crop=True)
    base.compose_board(customer_paths, PRODUCTION_OUTPUT_ROOT / "approval_customers_30_actual_size_unlabeled.png", columns=5, scale=1, margin=18, gap=10)
    base.compose_board(staff_paths, PRODUCTION_OUTPUT_ROOT / "approval_staff_professions_unlabeled.png", columns=4, scale=3, margin=28, gap=18, crop=True)
    base.compose_board(staff_turnarounds, PRODUCTION_OUTPUT_ROOT / "approval_staff_turnarounds_unlabeled.png", columns=4, scale=2, margin=24, gap=12, crop=True)
    base.compose_board(furniture_overview, PRODUCTION_OUTPUT_ROOT / "approval_furniture_levels_overview_unlabeled.png", columns=5, scale=2, margin=26, gap=12, crop=True)
    base.compose_board(active_states, PRODUCTION_OUTPUT_ROOT / "approval_furniture_active_states_all_levels_unlabeled.png", columns=8, scale=2, margin=24, gap=10, crop=True)
    save_cache()
    return PRODUCTION_OUTPUT_ROOT / "approval_customers_30_unlabeled.png"


def animation_pose(name, role):
    if name == "walk": return "walk"
    if name in {"carry_tray_walk"}: return "walk_tray"
    if name in {"carry_tray_idle"}: return "tray_idle"
    if name in {"carry_plate_walk", "carry_ingredient_walk"}: return "walk"
    if name in {"carry_plate_idle", "carry_ingredient_idle", "pickup_dish", "place_dish", "pickup", "place", "serve_table", "clear_table"}: return "carry"
    if name in {"cook_stove", "prep_counter"}: return "cook"
    if name in {"clean_table", "wash_sink"}: return "clean"
    if name in {"sit_down", "stand_up"}: return "sit"
    if name in {"seated_idle", "wait_food", "wait_workstation", "wait_service"}: return "seated" if role == "customer" else "idle"
    if name in {"eat"}: return "eat"
    if name in {"drink"}: return "drink"
    if name in {"turn", "react_happy", "react_impatient"}: return "talk"
    return "idle"


def populate_character_frames(spec, asset_id, animations, role):
    for animation, count in animations.items():
        pose = animation_pose(animation, role)
        for direction in ACTIVE_DIRECTIONS:
            for frame in range(count):
                phase = frame % 4
                if animation == "stand_up": phase = 3 - phase
                source = character_keyframe(asset_id, pose, direction, phase)
                target = PRODUCTION_OUTPUT_ROOT / "sprites" / "characters" / asset_id / animation / direction / f"{frame:03d}.png"
                target.parent.mkdir(parents=True, exist_ok=True)
                if not target.exists() or target.stat().st_size != source.stat().st_size:
                    shutil.copyfile(source, target)


def render_full_source_matrix():
    for spec in APPROVED_V002_CUSTOMERS:
        populate_character_frames(spec, runtime_customer_id(spec), CUSTOMER_ANIMATIONS, "customer")
    for spec in NEW_CUSTOMERS:
        populate_character_frames(spec, runtime_customer_id(spec), CUSTOMER_ANIMATIONS, "customer")
    for spec in STAFF_PROFESSIONS:
        populate_character_frames(spec, runtime_staff_id(spec), animation_manifest_for_staff(spec), spec["animationRole"])
    for definition, level, connection, layer, asset_id in iter_furniture_render_assets():
        for state in definition["states"]:
            for direction in FURNITURE_DIRECTIONS:
                path = PRODUCTION_OUTPUT_ROOT / "sprites" / "furniture" / asset_id / state / f"{direction}.png"
                cached_render(asset_id, path, direction, state=state)
    save_cache()


def write_scene_manifest():
    data = {
        "version": PRODUCTION_VERSION,
        "sourceBlend": "art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_production_v003.blend",
        "preservedSources": [
            "art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_approval.blend",
            "art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_refinement_v002.blend",
        ],
        "contract": {"characterFrame": list(CHARACTER_FRAME_SIZE), "feetAnchor": list(CHARACTER_ANCHOR), "furnitureFrame": list(FURNITURE_FRAME_SIZE), "furnitureAnchor": list(FURNITURE_ANCHOR), "furnitureAnchors": {"1x1": list(furniture_anchor_for_footprint((1, 1))), "2x1": list(furniture_anchor_for_footprint((2, 1)))}, "directions": list(ACTIVE_DIRECTIONS)},
        "customers": [{**spec, "runtimeId": runtime_customer_id(spec), "animations": CUSTOMER_ANIMATIONS} for spec in NEW_CUSTOMERS],
        "approvedV002Customers": [{**spec, "runtimeId": runtime_customer_id(spec), "animations": CUSTOMER_ANIMATIONS} for spec in APPROVED_V002_CUSTOMERS],
        "staff": [{**spec, "runtimeId": runtime_staff_id(spec), "animations": animation_manifest_for_staff(spec)} for spec in STAFF_PROFESSIONS],
        "furniture": [{"furnitureId": definition["furnitureId"], "assetId": asset_id, "level": level, "connection": connection, "layer": layer, "footprint": definition["footprint"], "dimensionsBlender": [definition["footprint"][0], 1.0, 1.10 if definition["component"] not in {"table", "chair"} else .82], "pivot": [0,0,0], "anchor": list(furniture_anchor_for_footprint(definition["footprint"])), "directions": list(FURNITURE_DIRECTIONS), "states": definition["states"], "counterBase": f"COUNTER_BASE_L{level}" if definition["component"] not in {"table", "chair"} else None} for definition, level, connection, layer, asset_id in iter_furniture_render_assets()],
        "counterMasters": FURNITURE_LEVELS,
    }
    (PRODUCTION_OUTPUT_ROOT / "production_manifest.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_blender_structural_validation():
    checks = []
    add = lambda name, ok, detail: checks.append({"name": name, "ok": bool(ok), "detail": detail})
    masters = []
    for level in range(1, 6):
        master = bpy.data.collections.get(f"COUNTER_BASE_L{level}")
        root = bpy.data.objects.get(f"COUNTER_BASE_L{level}:origin")
        ok = master is not None and root is not None and abs(float(root.get("width", 0)) - 1.0) <= .001 and abs(float(root.get("depth", 0)) - 1.0) <= .001 and abs(float(root.get("counterHeight", 0)) - 1.10) <= .001
        masters.append(ok)
    add("Cinco bases mestras de balcão", all(masters), f"{sum(masters)}/5 dentro da tolerância de 0,001 BU")

    character_ids = [runtime_customer_id(spec) for spec in (*APPROVED_V002_CUSTOMERS, *NEW_CUSTOMERS)] + [runtime_staff_id(spec) for spec in STAFF_PROFESSIONS]
    rig_checks = []
    for asset_id in character_ids:
        rig = base.ASSET_RIGS.get(asset_id)
        root = base.ASSET_ROOTS.get(asset_id)
        rig_checks.append(rig is not None and root is not None and rig.data.name == "SpriteRefresh_Humanoid_Shared_v002" and list(rig.get("feetPivot", [9, 9, 9])) == [0.0, 0.0, 0.0] and abs(float(root.get("gameplayHeight", 0)) - 2.20) <= .001)
    add("Rig, pivô e altura compartilhados", all(rig_checks), f"{sum(rig_checks)}/{len(character_ids)} personagens")

    furniture_checks = []
    shared_base_checks = []
    alignment_checks = []
    end_cap_checks = []
    content_violations = []
    forbidden = ("food", "plate", "dish", "ingredient", "meal", "cup")
    for definition, level, connection, layer, asset_id in iter_furniture_render_assets():
        root = base.ASSET_ROOTS.get(asset_id)
        source = base.ASSET_COLLECTIONS.get(asset_id)
        expected_anchor = furniture_anchor_for_footprint(definition["footprint"])
        actual_anchor = list(root.get("anchor", [])) if root is not None else []
        ok = root is not None and source is not None and root.get("furnitureId") == definition["furnitureId"] and int(root.get("level", 0)) == level and list(root.get("footprint", [])) == list(definition["footprint"]) and list(root.get("pivot", [])) == [0, 0, 0] and len(actual_anchor) == 2 and all(abs(float(actual) - expected) <= .0001 for actual, expected in zip(actual_anchor, expected_anchor))
        furniture_checks.append(ok)
        if definition["component"] not in {"table", "chair"} and source is not None:
            instances = [obj for obj in source.objects if obj.instance_type == "COLLECTION"]
            shared_base_checks.append(len(instances) == definition["footprint"][0] and all(obj.instance_collection and obj.instance_collection.name == f"COUNTER_BASE_L{level}" for obj in instances))
            expected_x = [index - (definition["footprint"][0] - 1) / 2 for index in range(definition["footprint"][0])]
            actual_x = sorted(float(obj.location.x) for obj in instances)
            alignment_checks.append(
                len(actual_x) == len(expected_x)
                and all(abs(actual - expected) <= .001 for actual, expected in zip(actual_x, expected_x))
                and all(abs(float(obj.location.y)) <= .001 and abs(float(obj.location.z)) <= .001 for obj in instances)
            )
        if source is not None:
            for obj in source.all_objects:
                if any(token in obj.name.lower() for token in forbidden):
                    content_violations.append(obj.name)
        if connection in {"left", "right"} and source is not None:
            caps = [obj for obj in source.all_objects if obj.name.endswith(":end-trim")]
            end_cap_checks.append(
                len(caps) == 1
                and abs(float(caps[0].location.z) - .56) <= .001
                and all(abs(float(actual) - expected) <= .001 for actual, expected in zip(caps[0].dimensions, (.035, .90, .88)))
                and caps[0].get("tileAlignment") == "plinth-to-countertop"
            )
        if definition["component"] == "service":
            furniture_checks.append(bool(root and root.get("surfaceClear")))
    add("Matriz estrutural dos móveis", all(furniture_checks), f"{sum(furniture_checks)}/{len(furniture_checks)} contratos")
    add("Instâncias das bases compartilhadas", all(shared_base_checks), f"{sum(shared_base_checks)}/{len(shared_base_checks)} módulos")
    add("Encaixe contínuo sem lacuna ou sobreposição", all(alignment_checks), f"{sum(alignment_checks)}/{len(alignment_checks)} conjuntos dentro de 0,001 BU")
    add("Tampas laterais alinhadas do rodapé ao tampo", all(end_cap_checks), f"{sum(end_cap_checks)}/{len(end_cap_checks)} terminações")
    add("Móveis sem comida incorporada", not content_violations, f"violações: {', '.join(content_violations[:8]) if content_violations else 'nenhuma'}")

    report = {"version": PRODUCTION_VERSION, "ok": all(item["ok"] for item in checks), "checks": checks}
    (PRODUCTION_OUTPUT_ROOT / "blender_structural_validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not report["ok"]:
        raise RuntimeError("Falha na validação estrutural Blender v003")
    return report


def build_and_render_production():
    blend_path = Path(os.environ.get("BLENDER_CODEX_BLEND_PATH", str(PRODUCTION_BLEND)))
    preview_path = Path(os.environ.get("BLENDER_CODEX_PREVIEW_PATH", str(PRODUCTION_PREVIEW)))
    mode = os.environ.get("SPRITE_REFRESH_V003_MODE", "approval")
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    PRODUCTION_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    load_cache()
    install_production_overrides()
    base.build_scene()
    scene = bpy.context.scene
    scene["prototype"] = "Cafe Tycoon production v003"
    scene["visualStandard"] = "approved refinement v002"
    scene["productionScope"] = "30 customers, 12 professions, 15 active furniture definitions x levels 1-5"
    scene["counterTolerance"] = .001
    write_blender_structural_validation()
    base.reset_default_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    preview = render_approval_set()
    if mode == "full":
        render_full_source_matrix()
    write_scene_manifest()
    if preview.resolve() != preview_path.resolve():
        preview_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(preview, preview_path)
    base.reset_default_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    print(f"PRODUCTION_BLEND={blend_path}")
    print(f"PRODUCTION_PREVIEW={preview}")
    print(f"PRODUCTION_MODE={mode}")


def open_production_blend(path=None):
    target = Path(path or PRODUCTION_BLEND).resolve()
    if Path(bpy.data.filepath).resolve() != target:
        bpy.ops.wm.open_mainfile(filepath=str(target), load_ui=False)
    install_production_overrides()
    base.bind_scene_assets()
