from math import radians

from model_utils import cone, cube, cylinder, parent_local, parent_parts, pivot, root_empty, shadow, sphere, tag_collection
from technical_markers import add_markers


def _legs(asset_id, width, depth, collection, materials):
    parts = []
    for x in (-width + .12, width - .12):
        for y in (-depth + .10, depth - .10):
            parts.append(cylinder(f"{asset_id}:leg:{x}:{y}", (x, y, .09), .07, .18, materials["steel_dark"], collection, 10))
    return parts


def _front_panel(asset_id, label, x, z, width, height, collection, materials):
    return [
        cube(f"{asset_id}:{label}:frame", (x, -.515, z), (width, .035, height), materials["steel_dark"], collection, .018),
        cube(f"{asset_id}:{label}:glass", (x, -.555, z), (width - .07, .018, height - .07), materials["glass"], collection, .012),
        cylinder(f"{asset_id}:{label}:handle", (x, -.592, z + height + .075), width * .80, .045, materials["chrome"], collection, 12),
    ]


def _active(obj):
    obj.hide_render = True
    return obj


def _stove(asset_id, collection, materials):
    parts = [
        cube(f"{asset_id}:body", (0, 0, .61), (1.02, .50, .52), materials["steel"], collection, .055),
        cube(f"{asset_id}:top", (0, 0, 1.16), (1.06, .53, .055), materials["steel_light"], collection, .025),
        cube(f"{asset_id}:backsplash", (0, .47, 1.38), (1.05, .045, .23), materials["steel_mid"], collection, .025),
        cube(f"{asset_id}:control-panel", (0, -.515, .99), (1.00, .035, .16), materials["steel_mid"], collection, .018),
    ]
    parts += _front_panel(asset_id, "oven.L", -.50, .48, .43, .28, collection, materials)
    parts += _front_panel(asset_id, "oven.R", .50, .48, .43, .28, collection, materials)
    for index, x in enumerate((-.76, -.46, -.15, .15, .46, .76)):
        parts += [cylinder(f"{asset_id}:knob:{index}", (x, -.56, 1.00), .065, .065, materials["outline"], collection, 12)]
    for index, (x, y) in enumerate(((-.68,-.25),(0,-.25),(.68,-.25),(-.68,.22),(0,.22),(.68,.22))):
        parts += [cylinder(f"{asset_id}:burner:{index}", (x, y, 1.235), .205, .035, materials["steel_dark"], collection, 16), cylinder(f"{asset_id}:burner-cap:{index}", (x, y, 1.26), .075, .03, materials["outline"], collection, 12)]
        parts.append(_active(cone(f"{asset_id}:state-active:flame-blue:{index}", (x, y, 1.32), .12, .035, .13, materials["flame_blue"], collection, 10)))
        parts.append(_active(cone(f"{asset_id}:state-active:flame-orange:{index}", (x, y, 1.365), .07, .015, .12, materials["orange"], collection, 10)))
    parts += [
        _active(cylinder(f"{asset_id}:state-active:pot", (.18, .06, 1.48), .34, .34, materials["steel_mid"], collection, 16)),
        _active(cylinder(f"{asset_id}:state-active:pot-lid", (.18, .06, 1.68), .37, .055, materials["chrome"], collection, 16)),
        _active(sphere(f"{asset_id}:state-active:steam-a", (.12, .07, 1.88), (.08, .06, .13), materials["white_shadow"], collection)),
        _active(sphere(f"{asset_id}:state-active:steam-b", (.25, .07, 2.03), (.07, .05, .11), materials["white_shadow"], collection)),
    ]
    return parts, (1.08, .54), 2.10


def _fridge(asset_id, collection, materials, root):
    parts = [
        cube(f"{asset_id}:body", (0, .02, 1.08), (1.02, .49, 1.04), materials["steel_mid"], collection, .065),
        cube(f"{asset_id}:compressor", (0, .01, 2.15), (1.00, .48, .18), materials["steel_light"], collection, .045),
        cube(f"{asset_id}:vent", (0, -.50, 2.15), (.72, .028, .075), materials["steel_dark"], collection, .01),
        cube(f"{asset_id}:display", (.72, -.535, 2.16), (.12, .018, .065), materials["blue_light"], collection, .006),
        _active(cube(f"{asset_id}:state-open:interior", (0, -.505, 1.08), (.91, .025, .88), materials["steel_dark"], collection, .01)),
    ]
    for index, z in enumerate((.52, .98, 1.44)):
        parts.append(_active(cube(f"{asset_id}:state-open:shelf:{index}", (0, -.56, z), (.84, .12, .035), materials["chrome"], collection, .01)))
    for index, (x, z, material) in enumerate(((-.58,1.60,"green"),(-.37,1.58,"food_red"),(-.12,1.60,"food_red"),(.25,1.20,"cream_light"),(.50,1.20,"blue_light"),(-.48,.72,"gold"),(0,.72,"green"),(.45,.72,"terracotta_light"))):
        parts.append(_active(cube(f"{asset_id}:state-open:food:{index}", (x, -.61, z), (.11, .08, .11), materials[material], collection, .018)))
    left = pivot(f"{asset_id}:door-pivot.L", (-1.01, -.50, 1.08), collection, root)
    right = pivot(f"{asset_id}:door-pivot.R", (1.01, -.50, 1.08), collection, root)
    for side, door, x_local, handle_x in (("L", left, .50, .76), ("R", right, -.50, -.76)):
        panel = cube(f"{asset_id}:door.{side}", (0, 0, 0), (.49, .045, .89), materials["steel_light"], collection, .035)
        parent_local(panel, door, (x_local, 0, 0))
        handle = cylinder(f"{asset_id}:door.{side}:handle", (0, 0, 0), .045, .55, materials["steel_dark"], collection, 12)
        parent_local(handle, door, (handle_x, -.065, 0))
        parts.append(door)
    return parts, (1.08, .55), 2.34


def _counter_machine(asset_id, family, width, collection, materials):
    parts = [cube(f"{asset_id}:body", (0, 0, .58), (width, .48, .52), materials["steel"], collection, .05), cube(f"{asset_id}:top", (0, 0, 1.13), (width + .04, .51, .055), materials["steel_light"], collection, .02)]
    if family == "oven":
        parts += _front_panel(asset_id, "oven", 0, .55, min(.72, width - .10), .31, collection, materials)
        parts += [cube(f"{asset_id}:controls", (0, -.515, .98), (width - .10, .03, .11), materials["steel_mid"], collection, .012)]
        for index, x in enumerate((-.50, -.25, 0, .25, .50)):
            if abs(x) < width: parts.append(cylinder(f"{asset_id}:knob:{index}", (x, -.56, .98), .055, .06, materials["outline"], collection, 12))
        parts.append(_active(cube(f"{asset_id}:state-active:glow", (0, -.59, .55), (min(.60, width-.16), .012, .20), materials["orange"], collection, .005)))
    elif family == "grill":
        for index, x in enumerate((-.32,-.20,-.08,.04,.16,.28)):
            parts.append(cube(f"{asset_id}:grate:{index}", (x, 0, 1.20), (.018, .39, .025), materials["steel_dark"], collection, 0))
        parts.append(_active(cube(f"{asset_id}:state-active:glow", (0, 0, 1.16), (width-.08, .38, .025), materials["orange"], collection, .005)))
    elif family == "sink":
        parts += [cube(f"{asset_id}:basin", (0, -.02, 1.17), (width-.16, .34, .055), materials["blue_dark"], collection, .025), cylinder(f"{asset_id}:tap", (0, .25, 1.42), .055, .44, materials["chrome"], collection, 12), cube(f"{asset_id}:spout", (0, .12, 1.62), (.055, .20, .055), materials["chrome"], collection, .02)]
        parts.append(_active(cylinder(f"{asset_id}:state-active:water", (0, -.08, 1.35), .035, .35, materials["blue_light"], collection, 8)))
    else:
        parts += [cube(f"{asset_id}:front-panel", (0, -.50, .57), (width-.08, .025, .38), materials["wood_mid"], collection, .018), cylinder(f"{asset_id}:handle", (0, -.55, .70), min(.42,width-.15), .04, materials["chrome"], collection, 12)]
    return parts, (width + .08, .53), 1.66


def create_equipment(definition, collection, materials):
    asset_id = definition["assetId"]; family = definition["equipmentFamilyId"]; root = root_empty(asset_id, collection)
    width = 1.02 if definition["footprint"][0] == 2 else .52
    if family == "stove":
        parts, shadow_size, visual_height = _stove(asset_id, collection, materials)
    elif family == "refrigerator":
        parts, shadow_size, visual_height = _fridge(asset_id, collection, materials, root)
    elif family in ("oven", "grill", "sink", "preparation", "assembly"):
        parts, shadow_size, visual_height = _counter_machine(asset_id, family, width, collection, materials)
    elif family == "coffee_machine":
        parts = [
            cube(f"{asset_id}:body", (0, .05, .82), (.45, .34, .67), materials["terracotta_dark"], collection, .065),
            cube(f"{asset_id}:chrome-front", (0, -.31, .90), (.34, .04, .45), materials["chrome"], collection, .025),
            cylinder(f"{asset_id}:group-head", (0, -.40, .92), .09, .12, materials["steel_dark"], collection, 12),
            cylinder(f"{asset_id}:cup", (0, -.39, .24), .17, .28, materials["cream_light"], collection, 14),
            cube(f"{asset_id}:spout", (0, -.42, .75), (.045, .12, .055), materials["steel_dark"], collection, .01),
            _active(cylinder(f"{asset_id}:state-active:coffee", (0, -.43, .56), .025, .31, materials["wood_dark"], collection, 8)),
            _active(sphere(f"{asset_id}:state-active:steam", (.14, -.36, 1.50), (.07, .05, .13), materials["white_shadow"], collection)),
        ]; shadow_size = (.56, .44); visual_height = 1.62
    elif family == "cauldron":
        parts = [
            cylinder(f"{asset_id}:pot", (0, 0, .61), .52, .76, materials["steel"], collection, 16),
            cylinder(f"{asset_id}:rim", (0, 0, 1.00), .55, .07, materials["chrome"], collection, 16),
            cylinder(f"{asset_id}:soup", (0, 0, 1.035), .46, .035, materials["terracotta"], collection, 16),
            cube(f"{asset_id}:handle.L", (-.58, 0, .72), (.12, .05, .07), materials["steel_dark"], collection, .02),
            cube(f"{asset_id}:handle.R", (.58, 0, .72), (.12, .05, .07), materials["steel_dark"], collection, .02),
            _active(sphere(f"{asset_id}:state-active:bubble-a", (-.16, -.08, 1.08), (.07, .05, .05), materials["orange"], collection)),
            _active(sphere(f"{asset_id}:state-active:bubble-b", (.18, .05, 1.08), (.06, .05, .045), materials["gold_light"], collection)),
        ]; shadow_size = (.60, .48); visual_height = 1.18
    else:
        parts, shadow_size, visual_height = _counter_machine(asset_id, family, width, collection, materials)
    parts += _legs(asset_id, shadow_size[0] - .04, min(.48, shadow_size[1]), collection, materials)
    parts.append(shadow(asset_id, collection, materials["shadow"], shadow_size))
    parent_parts(root, [part for part in parts if part.parent is None])
    root["visualHeight"] = visual_height; root["qualityProfile"] = "reference-hd-v2"; root["fillsFootprint"] = True
    add_markers(asset_id, collection, equipment=True); tag_collection(collection, definition)
    return root
