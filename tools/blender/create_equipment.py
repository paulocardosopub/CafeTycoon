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
        cube(f"{asset_id}:{label}:frame", (x, -.525, z), (width, .045, height), materials["steel_dark"], collection, .018),
        cube(f"{asset_id}:{label}:glass", (x, -.578, z), (width - .065, .016, height - .065), materials["glass"], collection, .010),
        cube(f"{asset_id}:{label}:glass-highlight", (x, -.598, z + .035), (width - .12, .009, .018), materials["blue_light"], collection, .004),
        cylinder(f"{asset_id}:{label}:handle", (x, -.615, z + height + .075), .038, width * 1.55, materials["chrome"], collection, 12, (0, radians(90), 0)),
    ]


def _active(obj):
    obj.hide_render = True
    return obj


def _stove(asset_id, collection, materials):
    parts = [
        cube(f"{asset_id}:body", (0, 0, .63), (1.04, .50, .53), materials["steel"], collection, .050),
        cube(f"{asset_id}:body-front", (0, -.505, .64), (1.00, .025, .49), materials["steel_mid"], collection, .018),
        cube(f"{asset_id}:side.L", (-1.045, 0, .63), (.028, .47, .48), materials["steel_dark"], collection, .010),
        cube(f"{asset_id}:side.R", (1.045, 0, .63), (.028, .47, .48), materials["steel_dark"], collection, .010),
        cube(f"{asset_id}:top-rim", (0, 0, 1.18), (1.075, .535, .055), materials["chrome"], collection, .024),
        cube(f"{asset_id}:cooktop", (0, -.005, 1.238), (1.01, .48, .025), materials["steel_mid"], collection, .012),
        cube(f"{asset_id}:backsplash", (0, .48, 1.41), (1.07, .045, .20), materials["steel_light"], collection, .022),
        cube(f"{asset_id}:backsplash-cap", (0, .475, 1.625), (1.08, .055, .025), materials["chrome"], collection, .010),
        cube(f"{asset_id}:control-panel", (0, -.535, 1.04), (1.01, .038, .135), materials["steel_light"], collection, .016),
    ]
    parts += _front_panel(asset_id, "oven.L", -.50, .48, .425, .285, collection, materials)
    parts += _front_panel(asset_id, "oven.R", .50, .48, .425, .285, collection, materials)
    parts += [
        cube(f"{asset_id}:oven-divider", (0, -.585, .48), (.025, .025, .30), materials["chrome"], collection, .006),
        cube(f"{asset_id}:lower-rail", (0, -.545, .16), (1.00, .025, .035), materials["steel_dark"], collection, .008),
    ]
    for index, x in enumerate((-.76, -.46, -.15, .15, .46, .76)):
        parts += [
            cylinder(f"{asset_id}:knob:{index}", (x, -.585, 1.04), .065, .052, materials["outline"], collection, 12, (radians(90), 0, 0)),
            cube(f"{asset_id}:knob-mark:{index}", (x, -.618, 1.075), (.010, .008, .025), materials["chrome"], collection, .003),
        ]
    for index, (x, y) in enumerate(((-.68,-.25),(0,-.25),(.68,-.25),(-.68,.22),(0,.22),(.68,.22))):
        parts += [
            cylinder(f"{asset_id}:burner:{index}", (x, y, 1.278), .20, .026, materials["outline"], collection, 16),
            cylinder(f"{asset_id}:burner-ring:{index}", (x, y, 1.296), .13, .024, materials["steel_mid"], collection, 16),
            cylinder(f"{asset_id}:burner-cap:{index}", (x, y, 1.314), .072, .026, materials["outline"], collection, 12),
        ]
        for arm, angle in enumerate((0, 45, 90, 135)):
            grate = cube(f"{asset_id}:grate:{index}:{arm}", (x, y, 1.334), (.17, .018, .016), materials["outline"], collection, .005)
            grate.rotation_euler.z = radians(angle); parts.append(grate)
        parts.append(_active(cone(f"{asset_id}:state-active:flame-blue:{index}", (x, y, 1.32), .12, .035, .13, materials["flame_blue"], collection, 10)))
        parts.append(_active(cone(f"{asset_id}:state-active:flame-orange:{index}", (x, y, 1.365), .07, .015, .12, materials["orange"], collection, 10)))
    parts += [
        _active(cylinder(f"{asset_id}:state-active:pot", (0, .02, 1.49), .34, .31, materials["steel_mid"], collection, 16)),
        _active(cylinder(f"{asset_id}:state-active:pot-rim", (0, .02, 1.655), .36, .035, materials["chrome"], collection, 16)),
        _active(cube(f"{asset_id}:state-active:pot-handle.L", (-.42, .02, 1.52), (.13, .045, .045), materials["steel_dark"], collection, .018)),
        _active(cube(f"{asset_id}:state-active:pot-handle.R", (.42, .02, 1.52), (.13, .045, .045), materials["steel_dark"], collection, .018)),
        _active(cylinder(f"{asset_id}:state-active:pot-lid", (0, .02, 1.69), .37, .055, materials["chrome"], collection, 16)),
        _active(cylinder(f"{asset_id}:state-active:pot-knob", (0, .02, 1.755), .065, .075, materials["outline"], collection, 12)),
        _active(sphere(f"{asset_id}:state-active:steam-a", (-.08, .04, 1.93), (.075, .055, .13), materials["white_shadow"], collection)),
        _active(sphere(f"{asset_id}:state-active:steam-b", (.10, .04, 2.08), (.065, .045, .11), materials["white_shadow"], collection)),
    ]
    return parts, (1.10, .56), 2.12


def _fridge(asset_id, collection, materials, root):
    parts = [
        cube(f"{asset_id}:body", (0, .02, 1.08), (1.03, .50, 1.04), materials["steel_mid"], collection, .060),
        cube(f"{asset_id}:top-cap", (0, .02, 2.30), (1.035, .50, .055), materials["chrome"], collection, .020),
        cube(f"{asset_id}:bottom-plinth", (0, .02, .12), (1.00, .47, .10), materials["steel_dark"], collection, .018),
        cube(f"{asset_id}:compressor", (0, .01, 2.13), (1.01, .49, .16), materials["steel_light"], collection, .038),
        cube(f"{asset_id}:vent-well", (-.15, -.507, 2.13), (.67, .025, .085), materials["outline"], collection, .008),
        cube(f"{asset_id}:display", (.72, -.542, 2.15), (.13, .020, .070), materials["blue_dark"], collection, .006),
        cube(f"{asset_id}:display-glow", (.72, -.566, 2.15), (.085, .008, .035), materials["blue_light"], collection, .003),
        _active(cube(f"{asset_id}:state-open:interior", (0, -.525, 1.08), (.92, .035, .87), materials["steel_dark"], collection, .012)),
        _active(cube(f"{asset_id}:state-open:interior-light", (0, -.568, 1.84), (.82, .018, .065), materials["cream_light"], collection, .006)),
    ]
    for index, z in enumerate((2.075, 2.105, 2.135, 2.165, 2.195)):
        parts.append(cube(f"{asset_id}:vent-slat:{index}", (-.15, -.541, z), (.59, .010, .009), materials["steel_mid"], collection, .003))
    for index, z in enumerate((.52, .98, 1.44)):
        parts.append(_active(cube(f"{asset_id}:state-open:shelf:{index}", (0, -.58, z), (.84, .13, .032), materials["chrome"], collection, .010)))
    for index, (x, z, material) in enumerate(((-.58,1.60,"green"),(-.37,1.58,"food_red"),(-.12,1.60,"food_red"),(.25,1.20,"cream_light"),(.50,1.20,"blue_light"),(-.48,.72,"gold"),(0,.72,"green"),(.45,.72,"terracotta_light"))):
        if material in ("green", "food_red"):
            food = sphere(f"{asset_id}:state-open:food:{index}", (x, -.64, z), (.11, .075, .10), materials[material], collection)
        else:
            food = cube(f"{asset_id}:state-open:food:{index}", (x, -.64, z), (.11, .075, .13), materials[material], collection, .018)
        parts.append(_active(food))
    left = pivot(f"{asset_id}:door-pivot.L", (-1.02, -.52, 1.08), collection, root)
    right = pivot(f"{asset_id}:door-pivot.R", (1.02, -.52, 1.08), collection, root)
    for side, door, x_local, handle_x in (("L", left, .50, .76), ("R", right, -.50, -.76)):
        panel = cube(f"{asset_id}:door.{side}", (0, 0, 0), (.49, .055, .87), materials["steel_light"], collection, .032)
        parent_local(panel, door, (x_local, 0, 0))
        inset = cube(f"{asset_id}:door.{side}:inset", (0, 0, 0), (.405, .012, .76), materials["steel_mid"], collection, .018)
        parent_local(inset, door, (x_local, -.064, 0))
        handle = cylinder(f"{asset_id}:door.{side}:handle", (0, 0, 0), .040, .62, materials["steel_dark"], collection, 12)
        parent_local(handle, door, (handle_x, -.105, 0))
        parts.append(door)
    return parts, (1.10, .57), 2.38


def _counter_machine(asset_id, family, width, collection, materials):
    parts = [
        cube(f"{asset_id}:body", (0, 0, .58), (width, .48, .52), materials["steel"], collection, .048),
        cube(f"{asset_id}:front", (0, -.495, .58), (width-.035, .025, .47), materials["steel_mid"], collection, .014),
        cube(f"{asset_id}:top", (0, 0, 1.13), (width + .045, .51, .055), materials["chrome"], collection, .020),
        cube(f"{asset_id}:top-edge", (0, -.50, 1.15), (width+.035, .025, .045), materials["steel_light"], collection, .010),
    ]
    if family == "oven":
        parts += _front_panel(asset_id, "oven.L", -.48, .53, .40, .30, collection, materials)
        parts += _front_panel(asset_id, "oven.R", .48, .53, .40, .30, collection, materials)
        parts += [cube(f"{asset_id}:controls", (0, -.515, .98), (width - .10, .03, .11), materials["steel_mid"], collection, .012)]
        for index, x in enumerate((-.50, -.25, 0, .25, .50)):
            if abs(x) < width: parts.append(cylinder(f"{asset_id}:knob:{index}", (x, -.575, .98), .055, .05, materials["outline"], collection, 12, (radians(90), 0, 0)))
        parts.append(_active(cube(f"{asset_id}:state-active:glow", (0, -.59, .55), (min(.60, width-.16), .012, .20), materials["orange"], collection, .005)))
    elif family == "grill":
        parts.append(cube(f"{asset_id}:grill-bed", (0, 0, 1.19), (width-.06, .42, .025), materials["outline"], collection, .008))
        for index, x in enumerate((-.32,-.20,-.08,.04,.16,.28)):
            parts.append(cube(f"{asset_id}:grate:{index}", (x, 0, 1.225), (.018, .39, .022), materials["steel_mid"], collection, 0))
        parts.append(_active(cube(f"{asset_id}:state-active:glow", (0, 0, 1.16), (width-.08, .38, .025), materials["orange"], collection, .005)))
    elif family == "sink":
        # The 1x1 sink has one correctly centred bowl; 2x1 variants have two.
        # Previous fixed +/- .46 positions forced the small sink outside its cell.
        double = width > .70
        basin_centres = (-.46, .46) if double else (0,)
        basin_width = .34 if double else .36
        parts += [
            cube(f"{asset_id}:backsplash", (0, .47, 1.34), (width+.035, .035, .17), materials["steel_light"], collection, .016),
            cube(f"{asset_id}:front-rail", (0, -.50, 1.12), (width+.025, .025, .09), materials["steel_dark"], collection, .010),
            cylinder(f"{asset_id}:tap-riser.L", (-.075, .31, 1.42), .038, .42, materials["chrome"], collection, 12),
            cylinder(f"{asset_id}:tap-riser.R", (.075, .31, 1.42), .038, .42, materials["chrome"], collection, 12),
            cylinder(f"{asset_id}:tap-bridge", (0, .31, 1.62), .038, .15, materials["chrome"], collection, 12, (0, radians(90), 0)),
            cylinder(f"{asset_id}:tap-spout", (0, .18, 1.57), .038, .26, materials["chrome"], collection, 12, (radians(90), 0, 0)),
            cylinder(f"{asset_id}:tap-knob.L", (-.16, .28, 1.28), .055, .055, materials["blue"], collection, 10),
            cylinder(f"{asset_id}:tap-knob.R", (.16, .28, 1.28), .055, .055, materials["terracotta"], collection, 10),
        ]
        for index, x in enumerate(basin_centres):
            parts += [
                cube(f"{asset_id}:basin-rim:{index}", (x, -.03, 1.205), (basin_width, .335, .035), materials["steel_dark"], collection, .018),
                cube(f"{asset_id}:basin:{index}", (x, -.03, 1.225), (basin_width-.055, .275, .026), materials["blue_dark"], collection, .022),
                cylinder(f"{asset_id}:drain:{index}", (x, -.03, 1.255), .055, .018, materials["outline"], collection, 12),
            ]
        panel_count = 2 if double else 1
        panel_width = width * 2 / panel_count
        for index in range(panel_count):
            x = -width + panel_width * (index + .5)
            parts += [
                cube(f"{asset_id}:door:{index}", (x, -.535, .58), (panel_width*.42, .020, .36), materials["steel_light"], collection, .014),
                cube(f"{asset_id}:door-inset:{index}", (x, -.558, .58), (panel_width*.35, .010, .29), materials["steel_mid"], collection, .008),
                cylinder(f"{asset_id}:door-handle:{index}", (x, -.585, .76), .023, panel_width*.48, materials["steel_dark"], collection, 10, (0, radians(90), 0)),
            ]
        parts.append(_active(cylinder(f"{asset_id}:state-active:water", (0, .03, 1.40), .026, .31, materials["blue_light"], collection, 8)))
    else:
        panel_count = 3 if width > .8 else 1
        panel_width = width * 2 / panel_count
        for index in range(panel_count):
            x = -width + panel_width * (index + .5)
            parts += [
                cube(f"{asset_id}:panel:{index}", (x, -.535, .58), (panel_width*.42, .020, .36), materials["steel_dark"], collection, .012),
                cube(f"{asset_id}:panel-inset:{index}", (x, -.558, .58), (panel_width*.36, .010, .30), materials["steel_mid"], collection, .008),
                cylinder(f"{asset_id}:handle:{index}", (x, -.582, .72), .025, panel_width*.55, materials["chrome"], collection, 10, (0, radians(90), 0)),
            ]
        parts += [
            _active(cube(f"{asset_id}:state-active:board", (0, -.03, 1.205), (.44, .26, .025), materials["wood_light"], collection, .012)),
            _active(sphere(f"{asset_id}:state-active:produce", (.18, -.03, 1.27), (.11, .08, .08), materials["food_red"], collection)),
        ]
    return parts, (width + .08, .53), 1.66


def _fryer(asset_id, collection, materials):
    parts, shadow_size, visual_height = _counter_machine(asset_id, "cabinet", .52, collection, materials)
    parts += [
        cube(f"{asset_id}:oil-well.L", (-.23, 0, 1.23), (.20, .35, .06), materials["outline"], collection, .012),
        cube(f"{asset_id}:oil-well.R", (.23, 0, 1.23), (.20, .35, .06), materials["outline"], collection, .012),
        cube(f"{asset_id}:backsplash", (0, .47, 1.43), (.55, .045, .18), materials["steel_light"], collection, .018),
    ]
    for side, x in (("L", -.23), ("R", .23)):
        for rail in (-.11, 0, .11):
            parts.append(cube(f"{asset_id}:basket:{side}:{rail}", (x + rail, 0, 1.39), (.012, .29, .12), materials["chrome"], collection, .004))
        handle = cube(f"{asset_id}:handle:{side}", (x, -.42, 1.45), (.035, .30, .035), materials["outline"], collection, .012)
        handle.rotation_euler.z = radians(8 if x > 0 else -8); parts.append(handle)
    parts.append(_active(cylinder(f"{asset_id}:state-active:oil", (0, 0, 1.31), .18, .04, materials["gold"], collection, 14)))
    return parts, shadow_size, visual_height


def _dishwasher(asset_id, collection, materials):
    parts, shadow_size, visual_height = _counter_machine(asset_id, "cabinet", .52, collection, materials)
    parts += [
        cube(f"{asset_id}:door", (0, -.55, .57), (.43, .035, .31), materials["steel_dark"], collection, .018),
        cube(f"{asset_id}:door-glass", (0, -.59, .57), (.34, .012, .21), materials["glass"], collection, .010),
        cylinder(f"{asset_id}:door-handle", (0, -.61, .83), .028, .34, materials["chrome"], collection, 10, (0, radians(90), 0)),
        cube(f"{asset_id}:wash-bed", (0, 0, 1.22), (.43, .36, .045), materials["blue_dark"], collection, .012),
    ]
    for x in (-.25, 0, .25):
        parts.append(_active(cube(f"{asset_id}:state-active:rack:{x}", (x, 0, 1.34), (.012, .29, .12), materials["chrome"], collection, .004)))
    parts.append(_active(sphere(f"{asset_id}:state-active:water", (0, 0, 1.42), (.28, .18, .05), materials["blue_light"], collection)))
    return parts, shadow_size, visual_height


def create_equipment(definition, collection, materials):
    asset_id = definition["assetId"]; family = definition["equipmentFamilyId"]; root = root_empty(asset_id, collection)
    width = 1.02 if definition["footprint"][0] == 2 else .52
    if asset_id == "a4_fryer":
        parts, shadow_size, visual_height = _fryer(asset_id, collection, materials)
    elif asset_id == "b6_dishwasher":
        parts, shadow_size, visual_height = _dishwasher(asset_id, collection, materials)
    elif family == "stove":
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
    if asset_id in ("b1_industrial_fridge", "b2_industrial_freezer"):
        root.scale.x = .52
    root["visualHeight"] = visual_height; root["qualityProfile"] = "bistro-bloom-character-bible-v2"; root["fillsFootprint"] = True
    add_markers(asset_id, collection, equipment=True); tag_collection(collection, definition)
    return root
