from math import radians

from create_animations import create_animation_library
from create_rigs import create_humanoid_rig
from model_utils import cube, cylinder, parent_local, parent_parts, pivot, root_empty, shadow, sphere, tag_collection
from technical_markers import add_markers


def _limb(asset_id, side, kind, pivot_location, length, radius, body_material, end_material, collection, root):
    joint = pivot(f"{asset_id}:{kind}.{side}", pivot_location, collection, root)
    segment = cylinder(f"{asset_id}:{kind}.{side}:segment", (0, 0, 0), radius, length, body_material, collection, 10)
    parent_local(segment, joint, (0, 0, -length / 2))
    if kind == "arm":
        end = sphere(f"{asset_id}:hand.{side}", (0, 0, 0), (radius * 1.04, radius * .92, radius * 1.12), end_material, collection)
        parent_local(end, joint, (0, -.015, -length - radius * .72))
    else:
        end = cube(f"{asset_id}:shoe.{side}", (0, 0, 0), (radius * 1.12, radius * 1.56, radius * .62), end_material, collection, .025)
        parent_local(end, joint, (0, -.10, -length - radius * .42))
    return joint


def _add_face(asset_id, skin, skin_shadow, hair, collection):
    return [
        sphere(f"{asset_id}:ear.L", (-.305, 0, 1.96), (.07, .045, .095), skin_shadow, collection),
        sphere(f"{asset_id}:ear.R", (.305, 0, 1.96), (.07, .045, .095), skin_shadow, collection),
        sphere(f"{asset_id}:nose", (0, -.292, 1.92), (.055, .04, .065), skin_shadow, collection),
        sphere(f"{asset_id}:eye.L", (-.105, -.288, 2.005), (.034, .022, .044), hair, collection),
        sphere(f"{asset_id}:eye.R", (.105, -.288, 2.005), (.034, .022, .044), hair, collection),
        cube(f"{asset_id}:brow.L", (-.105, -.302, 2.070), (.068, .012, .014), hair, collection, .006),
        cube(f"{asset_id}:brow.R", (.105, -.302, 2.070), (.068, .012, .014), hair, collection, .006),
        cube(f"{asset_id}:mouth", (0, -.309, 1.825), (.075, .012, .018), skin_shadow, collection, .006),
    ]


def _add_hair(asset_id, style, hair, collection):
    parts = [sphere(f"{asset_id}:hair-cap", (0, .03, 2.19), (.335, .30, .205), hair, collection)]
    if "bald" in style:
        parts[0].scale.z = .25; parts[0].location.z -= .12
    elif "crop" in style:
        parts[0].scale.y = .84; parts[0].scale.z = .70
        for index, x in enumerate((-.23, -.08, .08, .23)):
            parts.append(sphere(f"{asset_id}:crop:{index}", (x, -.12, 2.20 + .025 * (index % 2)), (.115, .105, .10), hair, collection))
    elif "bun" in style:
        for index, (x, y, z) in enumerate(((-.16,.13,2.35),(0,.17,2.39),(.16,.13,2.35),(-.08,.25,2.34),(.09,.25,2.34))):
            parts.append(sphere(f"{asset_id}:bun:{index}", (x, y, z), (.14, .14, .14), hair, collection))
    elif "curls" in style or "curly" in style:
        curls = ((-.28,-.03,2.20),(-.16,-.12,2.28),(0,-.15,2.30),(.16,-.12,2.28),(.28,-.03,2.20),(-.27,.13,2.25),(-.10,.20,2.31),(.10,.20,2.31),(.27,.13,2.25))
        for index, location in enumerate(curls):
            parts.append(sphere(f"{asset_id}:curl:{index}", location, (.13, .13, .13), hair, collection))
    elif "braid" in style:
        for index in range(5):
            parts.append(sphere(f"{asset_id}:braid:{index}", (.27, .15, 2.02 - index * .14), (.085, .085, .10), hair, collection))
    elif "ponytail" in style:
        for index in range(3):
            parts.append(sphere(f"{asset_id}:ponytail:{index}", (0, .26 + index * .055, 2.13 - index * .13), (.14, .15, .17), hair, collection))
    elif "wave" in style:
        parts += [sphere(f"{asset_id}:wave.L", (-.27, .05, 2.14), (.13, .16, .25), hair, collection), sphere(f"{asset_id}:wave.R", (.27, .05, 2.14), (.13, .16, .25), hair, collection)]
    return parts


def create_character(definition, collection, materials):
    asset_id = definition["assetId"]; root = root_empty(asset_id, collection)
    skin = materials[definition["skin"]]; skin_shadow = materials.get(f"{definition['skin']}_shadow", skin)
    hair = materials[definition["hair"]]; outfit = materials[definition["outfit"]]
    pants = materials[definition.get("pants", "denim")]; accent = materials[definition.get("accent", "cream_light")]
    parts = [
        cube(f"{asset_id}:torso", (0, 0, 1.34), (.39, .255, .43), outfit, collection, .10),
        cylinder(f"{asset_id}:neck", (0, 0, 1.77), .135, .18, skin_shadow, collection, 10),
        sphere(f"{asset_id}:head", (0, 0, 1.98), (.31, .285, .35), skin, collection),
        cube(f"{asset_id}:shirt-panel", (0, -.263, 1.35), (.205, .018, .31), accent, collection, .012),
        cube(f"{asset_id}:collar.L", (-.12, -.283, 1.63), (.12, .02, .075), accent, collection, .014),
        cube(f"{asset_id}:collar.R", (.12, -.283, 1.63), (.12, .02, .075), accent, collection, .014),
    ]
    parts += _add_face(asset_id, skin, skin_shadow, hair, collection)
    parts += _add_hair(asset_id, definition.get("style", ""), hair, collection)
    for index, z in enumerate((1.48, 1.33, 1.18)):
        parts.append(sphere(f"{asset_id}:button:{index}", (0, -.292, z), (.025, .018, .025), materials["outline"], collection))

    style = definition.get("style", "")
    if "dress" in style or "coat" in style:
        parts.append(cube(f"{asset_id}:skirt", (0, 0, .93), (.42, .27, .27), outfit, collection, .09))
    if "jacket" in style:
        parts += [cube(f"{asset_id}:lapel.L", (-.18, -.286, 1.47), (.12, .018, .25), outfit, collection, .015), cube(f"{asset_id}:lapel.R", (.18, -.286, 1.47), (.12, .018, .25), outfit, collection, .015)]

    accessory = definition.get("accessory")
    if accessory == "chef-hat":
        parts += [cylinder(f"{asset_id}:chef-band", (0, 0, 2.34), .30, .14, materials["white"], collection, 14)]
        for index, x in enumerate((-.17, 0, .17)):
            parts.append(sphere(f"{asset_id}:chef-puff:{index}", (x, 0, 2.49 + .025 * (index % 2)), (.17, .16, .16), materials["white"], collection))
    elif accessory == "hat":
        parts += [cylinder(f"{asset_id}:hat", (0, 0, 2.34), .38, .08, materials["gold"], collection, 14)]
    elif accessory == "glasses":
        parts += [cube(f"{asset_id}:glasses.L", (-.11, -.315, 2.00), (.095, .018, .075), materials["outline"], collection, .015), cube(f"{asset_id}:glasses.R", (.11, -.315, 2.00), (.095, .018, .075), materials["outline"], collection, .015)]
    elif accessory in ("apron", "vest", "scarf", "chef-scarf"):
        if accessory in ("scarf", "chef-scarf"):
            parts += [cube(f"{asset_id}:scarf", (0, -.305, 1.70), (.23, .035, .07), accent, collection, .018), cube(f"{asset_id}:scarf-tail", (.10, -.31, 1.58), (.065, .025, .12), accent, collection, .018)]
        else:
            parts.append(cube(f"{asset_id}:{accessory}", (0, -.285, 1.30), (.27, .025, .34), materials["cream_light"], collection, .02))
    elif accessory == "cloth":
        parts.append(cube(f"{asset_id}:cloth", (.34, -.28, .88), (.12, .03, .18), materials["terracotta"], collection, .01))
    elif accessory == "bag":
        parts.append(cube(f"{asset_id}:bag", (.40, .08, .88), (.18, .12, .26), materials["gold"], collection, .04))
    elif accessory == "moustache":
        parts.append(cube(f"{asset_id}:moustache", (0, -.315, 1.87), (.15, .018, .035), hair, collection, .01))
    elif accessory == "crate":
        parts.append(cube(f"{asset_id}:tool-pouch", (.40, .06, .82), (.14, .11, .19), materials["wood_light"], collection, .03))

    arm_l = _limb(asset_id, "L", "arm", (-.44, 0, 1.55), .55, .105, outfit, skin, collection, root)
    arm_r = _limb(asset_id, "R", "arm", (.44, 0, 1.55), .55, .105, outfit, skin, collection, root)
    leg_l = _limb(asset_id, "L", "leg", (-.18, 0, .93), .68, .145, pants, materials["outline"], collection, root)
    leg_r = _limb(asset_id, "R", "leg", (.18, 0, .93), .68, .145, pants, materials["outline"], collection, root)
    parts += [arm_l, arm_r, leg_l, leg_r]

    dish = cylinder(f"{asset_id}:carried-dish", (0, -.59, 1.18), .31, .05, materials["cream_light"], collection, 16); dish.hide_render = True; parts.append(dish)
    crate = cube(f"{asset_id}:carried-crate", (0, -.56, 1.08), (.35, .25, .25), materials["wood_light"], collection, .035); crate.hide_render = True; parts.append(crate)
    parts.append(shadow(asset_id, collection, materials["shadow"], (.55, .33)))
    parent_parts(root, [part for part in parts if part.parent is None])
    root["pixelHeight"] = 132; root["logicalHeightBlocks"] = 1.9; root["qualityProfile"] = "reference-canonical-v3"
    rig = create_humanoid_rig(asset_id, collection); rig.parent = root; create_animation_library(rig)
    add_markers(asset_id, collection); tag_collection(collection, definition)
    return root
