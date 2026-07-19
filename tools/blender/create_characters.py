from create_animations import create_animation_library
from create_rigs import create_humanoid_rig
from model_utils import cube, cylinder, parent_parts, root_empty, shadow, sphere, tag_collection
from technical_markers import add_markers

def create_character(definition, collection, materials):
    asset_id = definition["assetId"]; root = root_empty(asset_id, collection)
    skin = materials[definition["skin"]]; hair = materials[definition["hair"]]; outfit = materials[definition["outfit"]]
    parts = [
        cube(f"{asset_id}:torso", (0, 0, 1.05), (.32, .22, .42), outfit, collection, .06),
        sphere(f"{asset_id}:head", (0, 0, 1.72), (.31, .28, .34), skin, collection),
        cube(f"{asset_id}:hair", (0, .01, 1.96), (.32, .28, .11), hair, collection, .07),
        cube(f"{asset_id}:arm.L", (-.42, 0, 1.05), (.09, .10, .36), outfit, collection, .04),
        cube(f"{asset_id}:arm.R", (.42, 0, 1.05), (.09, .10, .36), outfit, collection, .04),
        cube(f"{asset_id}:leg.L", (-.17, 0, .43), (.12, .14, .38), materials["blue"], collection, .03),
        cube(f"{asset_id}:leg.R", (.17, 0, .43), (.12, .14, .38), materials["blue"], collection, .03),
        cube(f"{asset_id}:shoe.L", (-.17, -.07, .08), (.14, .21, .07), materials["outline"], collection, .02),
        cube(f"{asset_id}:shoe.R", (.17, -.07, .08), (.14, .21, .07), materials["outline"], collection, .02),
    ]
    style = definition.get("style", "")
    hair_object = parts[2]
    if "bald" in style:
        hair_object.scale.z = .25; hair_object.location.z -= .08
    elif "crop" in style:
        hair_object.scale.y = .72; hair_object.scale.z = .65
    elif "bun" in style:
        parts.append(sphere(f"{asset_id}:hair-bun", (0, .18, 2.16), (.20, .20, .20), hair, collection))
    elif "curls" in style or "curly" in style:
        for index, x in enumerate((-.30, -.15, 0, .15, .30)):
            parts.append(sphere(f"{asset_id}:curl:{index}", (x, .03, 1.98 + .06 * (index % 2)), (.13, .14, .14), hair, collection))
    elif "braid" in style:
        parts.append(cylinder(f"{asset_id}:braid", (.28, .13, 1.55), .08, .58, hair, collection, 8))
    elif "ponytail" in style:
        parts.append(sphere(f"{asset_id}:ponytail", (0, .27, 1.83), (.17, .22, .25), hair, collection))
    elif "wave" in style:
        parts += [sphere(f"{asset_id}:wave.L", (-.27, .05, 1.88), (.12, .14, .30), hair, collection), sphere(f"{asset_id}:wave.R", (.27, .05, 1.88), (.12, .14, .30), hair, collection)]
    if "dress" in style or "coat" in style:
        parts.append(cube(f"{asset_id}:skirt", (0, 0, .72), (.40, .26, .28), outfit, collection, .08))
    accessory = definition.get("accessory")
    if accessory == "chef-hat":
        parts += [cylinder(f"{asset_id}:chef-hat", (0, 0, 2.18), .29, .22, materials["white"], collection, 12)]
    elif accessory == "hat":
        parts += [cylinder(f"{asset_id}:hat", (0, 0, 2.09), .38, .08, materials["gold"], collection, 12)]
    elif accessory == "glasses":
        parts += [cube(f"{asset_id}:glasses", (0, -.285, 1.75), (.25, .025, .07), materials["outline"], collection, .01)]
    elif accessory in ("apron", "vest", "scarf"):
        parts += [cube(f"{asset_id}:{accessory}", (0, -.235, 1.03), (.25, .025, .31), materials["cream"], collection, .01)]
    elif accessory == "tray":
        parts += [cylinder(f"{asset_id}:tray", (0, -.48, .97), .34, .035, materials["steel_light"], collection, 12)]
    elif accessory == "cloth":
        parts += [cube(f"{asset_id}:cloth", (.34, -.28, .78), (.12, .03, .18), materials["terracotta"], collection, .01)]
    elif accessory == "bag":
        parts += [cube(f"{asset_id}:bag", (.38, .08, .72), (.18, .12, .26), materials["gold"], collection, .04)]
    elif accessory == "moustache":
        parts += [cube(f"{asset_id}:moustache", (0, -.29, 1.65), (.15, .02, .035), hair, collection, .01)]
    elif accessory == "crate":
        parts += [cube(f"{asset_id}:tool-pouch", (.38, .06, .70), (.14, .11, .19), materials["wood_light"], collection, .03)]
    dish = cylinder(f"{asset_id}:carried-dish", (0, -.55, 1.08), .30, .05, materials["cream"], collection, 12); dish.hide_render = True; parts.append(dish)
    crate = cube(f"{asset_id}:carried-crate", (0, -.52, .92), (.34, .24, .24), materials["wood_light"], collection, .03); crate.hide_render = True; parts.append(crate)
    shadow_obj = shadow(asset_id, collection, materials["shadow"]); parts.append(shadow_obj)
    parent_parts(root, parts)
    rig = create_humanoid_rig(asset_id, collection); rig.parent = root; create_animation_library(rig)
    add_markers(asset_id, collection)
    tag_collection(collection, definition)
    return root
