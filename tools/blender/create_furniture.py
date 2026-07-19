from model_utils import cone, cube, cylinder, parent_parts, root_empty, shadow, sphere, tag_collection
from technical_markers import add_markers


def _table(asset_id, four, collection, materials):
    width, depth = ((.72, .56) if four else (.56, .46))
    parts = [
        cube(f"{asset_id}:top", (0, 0, .78), (width, depth, .105), materials["wood_light"], collection, .065),
        cube(f"{asset_id}:inlay", (0, 0, .895), (width-.11, depth-.11, .018), materials["wood_mid"], collection, .01),
        cube(f"{asset_id}:apron-front", (0, -depth+.035, .66), (width-.04, .045, .11), materials["wood_dark"], collection, .018),
        cube(f"{asset_id}:apron-side", (width-.035, 0, .66), (.045, depth-.04, .11), materials["wood_dark"], collection, .018),
    ]
    for x in (-width + .13, width - .13):
        for y in (-depth + .12, depth - .12):
            parts.append(cube(f"{asset_id}:leg:{x}:{y}", (x, y, .36), (.075, .075, .36), materials["wood"], collection, .025))
    return parts, (width+.08, depth+.07)


def _chair(asset_id, collection, materials):
    parts = [
        cube(f"{asset_id}:seat", (0, 0, .49), (.34, .34, .075), materials["wood_light"], collection, .045),
        cube(f"{asset_id}:cushion", (0, -.01, .58), (.29, .29, .035), materials["terracotta"], collection, .025),
        cube(f"{asset_id}:back-top", (0, .30, 1.03), (.34, .055, .075), materials["wood_dark"], collection, .025),
    ]
    for x in (-.25, 0, .25):
        parts.append(cube(f"{asset_id}:back-slat:{x}", (x, .30, .82), (.035, .045, .20), materials["wood"], collection, .012))
    for x in (-.27, .27):
        for y in (-.26, .26):
            parts.append(cube(f"{asset_id}:leg:{x}:{y}", (x, y, .24), (.045, .045, .24), materials["wood_dark"], collection, .012))
    return parts, (.45, .42)


def _counter(asset_id, width, collection, materials):
    parts = [
        cube(f"{asset_id}:body", (0, 0, .50), (width, .46, .50), materials["wood"], collection, .045),
        cube(f"{asset_id}:top", (0, 0, 1.04), (width+.055, .51, .065), materials["cream_light"], collection, .028),
        cube(f"{asset_id}:toe-kick", (0, -.475, .12), (width-.03, .035, .11), materials["wood_dark"], collection, .01),
    ]
    panels = max(1, round(width / .42)); panel_width = width * 2 / panels
    for index in range(panels):
        x = -width + panel_width * (index + .5)
        parts += [cube(f"{asset_id}:panel:{index}", (x, -.475, .58), (panel_width*.40, .025, .31), materials["wood_mid"], collection, .025), cylinder(f"{asset_id}:handle:{index}", (x, -.515, .64), .035, .18, materials["chrome"], collection, 10)]
    return parts, (width+.09, .53)


def _storage(asset_id, cabinet, collection, materials):
    width = .92 if cabinet else .58
    body_material = materials["steel_mid"] if cabinet else materials["wood_dark"]
    parts = [cube(f"{asset_id}:body", (0, .05, .85), (width, .36, .85), body_material, collection, .045)]
    if cabinet:
        parts += [
            cube(f"{asset_id}:door.L", (-.45, -.33, .87), (.43, .035, .72), materials["steel_light"], collection, .025),
            cube(f"{asset_id}:door.R", (.45, -.33, .87), (.43, .035, .72), materials["steel_light"], collection, .025),
            cylinder(f"{asset_id}:handle.L", (-.16, -.39, .88), .035, .48, materials["steel_dark"], collection, 10),
            cylinder(f"{asset_id}:handle.R", (.16, -.39, .88), .035, .48, materials["steel_dark"], collection, 10),
        ]
    else:
        for index, z in enumerate((.28, .72, 1.16, 1.55)):
            parts.append(cube(f"{asset_id}:shelf:{index}", (0, -.34, z), (width, .10, .045), materials["wood_light"], collection, .012))
        for index, (x,z,material) in enumerate(((-.30,1.42,"gold"),(0,1.42,"terracotta"),(.30,1.42,"sage"),(-.28,.98,"cream_light"),(.08,.98,"blue_light"),(.32,.56,"food_red"),(-.15,.55,"green"))):
            parts.append(cylinder(f"{asset_id}:jar:{index}", (x, -.44, z), .09, .23, materials[material], collection, 10))
    return parts, (width+.08, .45)


def create_furniture(definition, collection, materials):
    asset_id = definition["assetId"]; root = root_empty(asset_id, collection)
    if asset_id.startswith("table"):
        parts, shadow_size = _table(asset_id, asset_id == "table_four", collection, materials)
    elif asset_id == "chair":
        parts, shadow_size = _chair(asset_id, collection, materials)
    elif "counter" in asset_id:
        parts, shadow_size = _counter(asset_id, 2.72 if asset_id == "pickup_counter" else 1.03, collection, materials)
    elif asset_id in ("shelf", "storage_cabinet"):
        parts, shadow_size = _storage(asset_id, asset_id == "storage_cabinet", collection, materials)
    elif asset_id == "bin":
        parts = [
            cylinder(f"{asset_id}:body", (0, 0, .46), .34, .76, materials["sage"], collection, 12),
            cylinder(f"{asset_id}:rim", (0, 0, .85), .36, .07, materials["sage_dark"], collection, 12),
            cylinder(f"{asset_id}:lid", (0, 0, .91), .35, .06, materials["steel_dark"], collection, 12),
            cube(f"{asset_id}:pedal", (0, -.34, .10), (.13, .12, .04), materials["steel_light"], collection, .015),
        ]; shadow_size = (.43, .39)
    else:
        parts = [cylinder(f"{asset_id}:pot", (0, 0, .28), .31, .48, materials["terracotta"], collection, 12), cylinder(f"{asset_id}:soil", (0, 0, .54), .27, .035, materials["wood_dark"], collection, 12)]
        for index, (x,y,z,material) in enumerate(((-.23,0,.88,"sage_dark"),(0,-.05,1.06,"sage"),(.23,0,.90,"sage_light"),(-.10,.08,1.22,"sage"),(.12,.05,1.30,"sage_dark"))):
            leaf = sphere(f"{asset_id}:leaf:{index}", (x, y, z), (.18, .08, .30), materials[material], collection); leaf.rotation_euler.y = -.35 if x < 0 else .35; parts.append(leaf)
        shadow_size = (.43, .38)
    parts.append(shadow(asset_id, collection, materials["shadow"], shadow_size)); parent_parts(root, parts)
    root["qualityProfile"] = "reference-hd-v2"; root["fillsFootprint"] = True
    add_markers(asset_id, collection, counter="counter" in asset_id); tag_collection(collection, definition)
    return root
