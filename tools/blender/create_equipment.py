from model_utils import cube, cylinder, parent_parts, root_empty, shadow, tag_collection
from technical_markers import add_markers

def create_equipment(definition, collection, materials):
    asset_id = definition["assetId"]; family = definition["equipmentFamilyId"]; root = root_empty(asset_id, collection); parts = []
    width = .92 if definition["footprint"][0] == 2 else .46
    if family == "refrigerator":
        parts += [cube(f"{asset_id}:body", (0, 0, .92), (width, .43, .92), materials["steel_light"], collection, .05), cube(f"{asset_id}:handle", (.18, -.45, 1.02), (.04, .03, .30), materials["steel"], collection, .01)]
    elif family == "oven":
        parts += [cube(f"{asset_id}:body", (0, 0, .58), (width, .43, .58), materials["steel"], collection, .04), cube(f"{asset_id}:window", (0, -.435, .56), (.54, .025, .29), materials["outline"], collection, .01), cube(f"{asset_id}:glow", (0, -.465, .56), (.44, .015, .20), materials["terracotta"], collection, 0)]
    elif family == "stove":
        parts += [cube(f"{asset_id}:body", (0, 0, .45), (width, .43, .45), materials["steel"], collection, .04), cube(f"{asset_id}:top", (0, 0, .93), (width, .46, .06), materials["steel_light"], collection, .02)]
        for x in (-.52, .52):
            for y in (-.20, .20): parts.append(cylinder(f"{asset_id}:burner:{x}:{y}", (x, y, 1.01), .15, .04, materials["outline"], collection, 12))
    elif family == "grill":
        parts += [cube(f"{asset_id}:body", (0, 0, .43), (width, .43, .43), materials["steel"], collection, .04)]
        for x in (-.28, -.14, 0, .14, .28): parts.append(cube(f"{asset_id}:bar:{x}", (x, 0, .90), (.025, .38, .025), materials["outline"], collection, 0))
    elif family == "coffee_machine":
        parts += [cube(f"{asset_id}:body", (0, .05, .70), (.38, .30, .60), materials["terracotta"], collection, .05), cylinder(f"{asset_id}:cup", (0, -.31, .20), .16, .26, materials["cream"], collection, 12), cube(f"{asset_id}:spout", (0, -.30, .68), (.05, .12, .05), materials["steel_light"], collection, .01)]
    elif family == "cauldron":
        parts += [cylinder(f"{asset_id}:pot", (0, 0, .48), .46, .66, materials["steel"], collection, 12), cylinder(f"{asset_id}:soup", (0, 0, .84), .39, .04, materials["blue"], collection, 16)]
    elif family == "sink":
        parts += [cube(f"{asset_id}:body", (0, 0, .43), (width, .43, .43), materials["steel"], collection, .04), cube(f"{asset_id}:basin", (0, 0, .91), (.54, .31, .05), materials["blue"], collection, .02), cube(f"{asset_id}:tap", (0, .22, 1.18), (.05, .05, .30), materials["steel_light"], collection, .02)]
    else:
        parts += [cube(f"{asset_id}:body", (0, 0, .43), (width, .43, .43), materials["wood"], collection, .04), cube(f"{asset_id}:surface", (0, 0, .91), (width, .46, .05), materials["cream"], collection, .02)]
    parts.append(shadow(asset_id, collection, materials["shadow"], (max(.55, width), .45))); parent_parts(root, parts)
    add_markers(asset_id, collection, equipment=True); tag_collection(collection, definition); return root
