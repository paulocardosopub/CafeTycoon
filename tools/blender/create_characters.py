from math import radians

from create_animations import create_animation_library
from create_rigs import create_humanoid_rig
from model_utils import cone, cube, cylinder, parent_local, parent_parts, pivot, root_empty, shadow, sphere, tag_collection
from technical_markers import add_markers


# Width and height remain deliberately restrained: silhouettes vary without breaking
# the shared feet anchor or the one-cell logical footprint.
BODY_PROFILES = {
    "tall-broad": (1.08, 1.05), "short-stocky": (1.10, .93), "average-curvy": (1.06, 1.00),
    "tall-slim": (.94, 1.06), "short-curvy": (1.07, .94), "broad": (1.11, .99),
    "athletic": (1.01, 1.03), "average-soft": (1.05, .99), "short-slim": (.95, .94),
    "tall-curvy": (1.07, 1.05), "average": (1.0, 1.0),
}


def _limb(asset_id, side, kind, pivot_location, length, radius, body_material, end_material, collection, root):
    """Tapered two-part limb so walking and sitting bend naturally at elbow/knee."""
    joint = pivot(f"{asset_id}:{kind}.{side}", pivot_location, collection, root)
    upper_length = length * (.47 if kind == "arm" else .49)
    lower_length = length - upper_length
    upper = cone(
        f"{asset_id}:{kind}.{side}:upper", (0, 0, 0), radius * 1.07, radius * .88,
        upper_length, body_material, collection, 12,
    )
    parent_local(upper, joint, (0, 0, -upper_length / 2))
    bend = pivot(f"{asset_id}:{kind}.{side}:bend", (0, 0, -upper_length), collection, joint)
    lower = cone(
        f"{asset_id}:{kind}.{side}:lower", (0, 0, 0), radius * .88, radius * .70,
        lower_length, body_material, collection, 12,
    )
    parent_local(lower, bend, (0, 0, -lower_length / 2))
    if kind == "arm":
        cuff = cylinder(f"{asset_id}:cuff.{side}", (0, 0, 0), radius * .74, .065, body_material, collection, 12)
        parent_local(cuff, bend, (0, 0, -lower_length + .012))
        end = sphere(
            f"{asset_id}:hand.{side}", (0, 0, 0),
            (radius * .92, radius * .82, radius * 1.04), end_material, collection,
        )
        parent_local(end, bend, (0, -.012, -lower_length - radius * .60))
    else:
        ankle = cylinder(f"{asset_id}:ankle.{side}", (0, 0, 0), radius * .67, .075, body_material, collection, 12)
        parent_local(ankle, bend, (0, 0, -lower_length + .018))
        end = cube(
            f"{asset_id}:shoe.{side}", (0, 0, 0),
            (radius * .95, radius * 1.48, radius * .52), end_material, collection, .045,
        )
        parent_local(end, bend, (0, -.095, -lower_length - radius * .30))
    return joint


def _add_face(asset_id, skin, skin_shadow, hair, collection):
    return [
        sphere(f"{asset_id}:ear.L", (-.292, 0, 1.98), (.064, .045, .086), skin_shadow, collection),
        sphere(f"{asset_id}:ear.R", (.292, 0, 1.98), (.064, .045, .086), skin_shadow, collection),
        sphere(f"{asset_id}:nose", (0, -.286, 1.925), (.045, .035, .060), skin_shadow, collection),
        sphere(f"{asset_id}:eye.L", (-.102, -.282, 2.010), (.029, .019, .039), hair, collection),
        sphere(f"{asset_id}:eye.R", (.102, -.282, 2.010), (.029, .019, .039), hair, collection),
        cube(f"{asset_id}:brow.L", (-.102, -.296, 2.069), (.060, .010, .012), hair, collection, .006),
        cube(f"{asset_id}:brow.R", (.102, -.296, 2.069), (.060, .010, .012), hair, collection, .006),
        cube(f"{asset_id}:mouth", (0, -.300, 1.842), (.060, .010, .013), skin_shadow, collection, .006),
    ]


def _add_hair(asset_id, style, hair, collection):
    parts = [sphere(f"{asset_id}:hair-cap", (0, .035, 2.205), (.325, .292, .205), hair, collection)]
    if "wrap" in style:
        parts[0].scale = (.98, .96, .78)
    elif "bald" in style:
        parts[0].scale.z = .20
        parts[0].location.z -= .13
    elif "crop" in style or "waiter" in style:
        parts[0].scale.y = .86
        parts[0].scale.z = .68
        for index, x in enumerate((-.22, -.075, .075, .22)):
            parts.append(sphere(f"{asset_id}:crop:{index}", (x, -.105, 2.22 + .025 * (index % 2)), (.105, .095, .09), hair, collection))
    elif "bun" in style:
        for index, (x, y, z) in enumerate(((-.15, .14, 2.35), (0, .17, 2.39), (.15, .14, 2.35), (-.07, .25, 2.33), (.08, .25, 2.33))):
            parts.append(sphere(f"{asset_id}:bun:{index}", (x, y, z), (.13, .13, .13), hair, collection))
    elif "curls" in style or "curly" in style:
        curls = ((-.27, -.02, 2.20), (-.15, -.12, 2.29), (0, -.15, 2.31), (.15, -.12, 2.29), (.27, -.02, 2.20),
                 (-.26, .13, 2.25), (-.10, .20, 2.31), (.10, .20, 2.31), (.26, .13, 2.25))
        for index, location in enumerate(curls):
            parts.append(sphere(f"{asset_id}:curl:{index}", location, (.12, .12, .12), hair, collection))
    elif "braid" in style:
        for index in range(5):
            parts.append(sphere(f"{asset_id}:braid:{index}", (.27, .15, 2.03 - index * .13), (.078, .078, .092), hair, collection))
    elif "ponytail" in style:
        for index in range(3):
            parts.append(sphere(f"{asset_id}:ponytail:{index}", (0, .25 + index * .052, 2.14 - index * .13), (.13, .14, .16), hair, collection))
    elif "wave" in style:
        parts += [
            sphere(f"{asset_id}:wave.L", (-.255, .04, 2.15), (.115, .145, .23), hair, collection),
            sphere(f"{asset_id}:wave.R", (.255, .04, 2.15), (.115, .145, .23), hair, collection),
            sphere(f"{asset_id}:wave-fringe", (-.10, -.205, 2.22), (.16, .055, .085), hair, collection),
        ]
    return parts


def _front_cube(name, location, scale, material, collection, bevel=.014, tilt=0):
    part = cube(name, location, scale, material, collection, bevel)
    if tilt:
        part.rotation_euler.y = radians(tilt)
    return part


def _add_clothing(asset_id, style, accessory, outfit, accent, materials, collection):
    """Identity-specific clothing; casual customers never inherit a staff uniform."""
    parts = []
    is_chef = "chef" in style
    is_waiter = "waiter" in style
    if is_chef:
        parts += [
            _front_cube(f"{asset_id}:chef-panel", (0, -.252, 1.39), (.285, .020, .34), materials["white"], collection, .018),
            _front_cube(f"{asset_id}:chef-collar.L", (-.105, -.278, 1.66), (.105, .018, .060), materials["white_shadow"], collection, .012, -18),
            _front_cube(f"{asset_id}:chef-collar.R", (.105, -.278, 1.66), (.105, .018, .060), materials["white_shadow"], collection, .012, 18),
        ]
        for index, (x, z) in enumerate(((-.10, 1.50), (.10, 1.50), (-.10, 1.33), (.10, 1.33), (-.10, 1.16), (.10, 1.16))):
            parts.append(sphere(f"{asset_id}:chef-button:{index}", (x, -.283, z), (.018, .012, .018), materials["outline_soft"], collection))
    elif is_waiter or "vest" in style or accessory == "vest":
        parts += [
            _front_cube(f"{asset_id}:shirt-front", (0, -.252, 1.39), (.27, .018, .34), accent, collection, .016),
            _front_cube(f"{asset_id}:vest.L", (-.17, -.276, 1.39), (.115, .022, .31), outfit, collection, .020, -6),
            _front_cube(f"{asset_id}:vest.R", (.17, -.276, 1.39), (.115, .022, .31), outfit, collection, .020, 6),
            _front_cube(f"{asset_id}:bow", (0, -.296, 1.66), (.10, .020, .045), materials["outline_soft"], collection, .012),
        ]
    elif "jacket" in style or "coat" in style or "cardigan" in style:
        front_height = .38 if "coat" in style else .32
        parts += [
            _front_cube(f"{asset_id}:shirt-front", (0, -.252, 1.39), (.23, .016, front_height), accent, collection, .014),
            _front_cube(f"{asset_id}:lapel.L", (-.17, -.278, 1.48), (.105, .020, .24), outfit, collection, .018, -10),
            _front_cube(f"{asset_id}:lapel.R", (.17, -.278, 1.48), (.105, .020, .24), outfit, collection, .018, 10),
        ]
        if "coat" in style:
            parts.append(cube(f"{asset_id}:coat-tail", (0, .02, 1.02), (.355, .235, .30), outfit, collection, .08))
    elif "dress" in style:
        parts += [
            cone(f"{asset_id}:dress-skirt", (0, 0, .91), .42, .28, .58, outfit, collection, 16),
            _front_cube(f"{asset_id}:dress-belt", (0, -.245, 1.17), (.30, .022, .040), accent, collection, .012),
        ]
    elif accessory == "overalls" or "overalls" in style:
        parts += [
            _front_cube(f"{asset_id}:overalls-panel", (0, -.270, 1.33), (.235, .025, .29), materials["denim"], collection, .024),
            _front_cube(f"{asset_id}:overall-strap.L", (-.145, -.286, 1.58), (.035, .018, .23), materials["denim_light"], collection, .012, -5),
            _front_cube(f"{asset_id}:overall-strap.R", (.145, -.286, 1.58), (.035, .018, .23), materials["denim_light"], collection, .012, 5),
            _front_cube(f"{asset_id}:overall-pocket", (0, -.301, 1.29), (.10, .012, .065), materials["denim_light"], collection, .010),
        ]
    else:
        # Casual shirts receive seams and a hem, not a generic white uniform panel.
        parts += [
            _front_cube(f"{asset_id}:shirt-hem", (0, -.252, 1.08), (.31, .016, .025), accent, collection, .008),
            _front_cube(f"{asset_id}:neckline", (0, -.257, 1.66), (.11, .018, .035), accent, collection, .010),
        ]

    if accessory == "apron":
        apron = cone(f"{asset_id}:apron", (0, -.268, 1.29), .285, .19, .70, materials["cream_light"], collection, 14)
        apron.scale.y = .10
        parts += [
            apron,
            _front_cube(f"{asset_id}:apron-pocket", (0, -.305, 1.15), (.105, .012, .065), materials["cream_shadow"], collection, .010),
            _front_cube(f"{asset_id}:apron-belt", (0, -.300, 1.47), (.23, .014, .028), materials["cream_shadow"], collection, .008),
            cube(f"{asset_id}:apron-tie", (0, .255, 1.36), (.29, .022, .028), materials["cream_shadow"], collection, .010),
        ]
    if accessory in ("scarf", "chef-scarf"):
        parts += [
            _front_cube(f"{asset_id}:scarf", (0, -.292, 1.70), (.20, .030, .055), accent, collection, .018),
            _front_cube(f"{asset_id}:scarf-tail", (.085, -.298, 1.59), (.050, .023, .105), accent, collection, .018, 10),
        ]
    return parts


def create_character(definition, collection, materials):
    asset_id = definition["assetId"]
    root = root_empty(asset_id, collection)
    skin = materials[definition["skin"]]
    skin_shadow = materials.get(f"{definition['skin']}_shadow", skin)
    hair = materials[definition["hair"]]
    outfit = materials[definition["outfit"]]
    pants = materials[definition.get("pants", "denim")]
    accent = materials[definition.get("accent", "cream_light")]
    style = definition.get("style", "")
    accessory = definition.get("accessory", "none")

    torso_material = materials["white"] if "chef" in style else outfit
    parts = [
        sphere(f"{asset_id}:torso", (0, 0, 1.38), (.365, .245, .405), torso_material, collection),
        sphere(f"{asset_id}:waist", (0, .015, 1.08), (.30, .225, .20), pants if "dress" not in style else outfit, collection),
        cylinder(f"{asset_id}:neck", (0, 0, 1.755), .115, .16, skin_shadow, collection, 12),
        sphere(f"{asset_id}:head", (0, 0, 1.99), (.295, .275, .335), skin, collection),
    ]
    parts += _add_face(asset_id, skin, skin_shadow, hair, collection)
    parts += _add_hair(asset_id, style, hair, collection)
    parts += _add_clothing(asset_id, style, accessory, outfit, accent, materials, collection)

    if accessory == "chef-hat":
        parts.append(cylinder(f"{asset_id}:chef-band", (0, 0, 2.34), .285, .12, materials["white"], collection, 16))
        for index, x in enumerate((-.15, 0, .15)):
            parts.append(sphere(f"{asset_id}:chef-puff:{index}", (x, 0, 2.47 + .018 * (index % 2)), (.145, .14, .14), materials["white"], collection))
    elif accessory == "hat":
        parts += [
            cylinder(f"{asset_id}:hat-brim", (0, 0, 2.33), .36, .055, materials["gold_dark"], collection, 16),
            cylinder(f"{asset_id}:hat-crown", (0, 0, 2.43), .25, .18, materials["gold"], collection, 16),
        ]
    elif accessory == "glasses":
        parts += [
            cube(f"{asset_id}:glasses.L", (-.102, -.302, 2.00), (.085, .014, .063), materials["outline_soft"], collection, .012),
            cube(f"{asset_id}:glasses.R", (.102, -.302, 2.00), (.085, .014, .063), materials["outline_soft"], collection, .012),
            cube(f"{asset_id}:glasses-bridge", (0, -.306, 2.0), (.025, .012, .010), materials["outline_soft"], collection, .004),
        ]
    elif accessory == "cloth":
        parts.append(cube(f"{asset_id}:cloth", (.33, -.25, .93), (.10, .025, .15), materials["terracotta"], collection, .012))
    elif accessory == "bag":
        parts += [
            cube(f"{asset_id}:bag", (.37, .08, .92), (.15, .10, .22), materials["gold_dark"], collection, .04),
            cube(f"{asset_id}:bag-strap", (.19, -.01, 1.35), (.022, .035, .48), materials["wood_dark"], collection, .008),
        ]
    elif accessory == "moustache":
        parts.append(cube(f"{asset_id}:moustache", (0, -.302, 1.875), (.13, .014, .028), hair, collection, .010))
    elif accessory == "crate":
        parts.append(cube(f"{asset_id}:tool-pouch", (.36, .06, .86), (.12, .09, .16), materials["wood_light"], collection, .03))
    elif accessory == "head-wrap":
        parts += [
            sphere(f"{asset_id}:head-wrap", (0, .02, 2.205), (.33, .295, .205), accent, collection),
            cube(f"{asset_id}:wrap-tail", (.25, .15, 2.04), (.065, .04, .18), accent, collection, .025),
        ]

    arm_l = _limb(asset_id, "L", "arm", (-.365, 0, 1.58), .57, .100, torso_material, skin, collection, root)
    arm_r = _limb(asset_id, "R", "arm", (.365, 0, 1.58), .57, .100, torso_material, skin, collection, root)
    leg_l = _limb(asset_id, "L", "leg", (-.15, 0, .98), .70, .135, pants, materials["outline_soft"], collection, root)
    leg_r = _limb(asset_id, "R", "leg", (.15, 0, .98), .70, .135, pants, materials["outline_soft"], collection, root)
    parts += [arm_l, arm_r, leg_l, leg_r]

    dish = cylinder(f"{asset_id}:carried-dish", (0, -.56, 1.20), .28, .045, materials["cream_light"], collection, 18)
    dish.hide_render = True
    crate = cube(f"{asset_id}:carried-crate", (0, -.54, 1.09), (.32, .22, .21), materials["wood_light"], collection, .04)
    crate.hide_render = True
    parts += [dish, crate, shadow(asset_id, collection, materials["shadow"], (.43, .245))]
    parent_parts(root, [part for part in parts if part.parent is None])

    width_scale, height_scale = BODY_PROFILES.get(definition.get("bodyProfile", "average"), BODY_PROFILES["average"])
    root.scale = (width_scale, width_scale, height_scale)
    root["pixelHeight"] = round(128 * height_scale)
    root["logicalHeightBlocks"] = round(1.82 * height_scale, 3)
    root["qualityProfile"] = "bistro-bloom-character-bible-v2"
    root["identityProfile"] = definition.get("identityProfile", asset_id)
    rig = create_humanoid_rig(asset_id, collection)
    rig.parent = root
    create_animation_library(rig)
    add_markers(asset_id, collection)
    tag_collection(collection, definition)
    return root
