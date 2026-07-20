from math import radians

from model_utils import cone, cube, cylinder, parent_parts, root_empty, shadow, sphere, tag_collection
from technical_markers import add_markers


def _table(asset_id, four, collection, materials):
    width, depth = ((.72, .56) if four else (.56, .46))
    green = asset_id.endswith("_green")
    top_material = materials["sage"] if green else materials["wood_light"]
    inlay_material = materials["sage_light"] if green else materials["wood_mid"]
    parts = [
        cube(f"{asset_id}:top", (0, 0, .78), (width, depth, .105), top_material, collection, .065),
        cube(f"{asset_id}:inlay", (0, 0, .895), (width-.11, depth-.11, .018), inlay_material, collection, .01),
        cube(f"{asset_id}:apron-front", (0, -depth+.035, .66), (width-.04, .045, .11), materials["wood_dark"], collection, .018),
        cube(f"{asset_id}:apron-side", (width-.035, 0, .66), (.045, depth-.04, .11), materials["wood_dark"], collection, .018),
    ]
    for x in (-width + .13, width - .13):
        for y in (-depth + .12, depth - .12):
            parts.append(cube(f"{asset_id}:leg:{x}:{y}", (x, y, .36), (.075, .075, .36), materials["wood"], collection, .025))
    return parts, (width+.08, depth+.07)


def _chair(asset_id, collection, materials, skin, layer_role):
    back_parts, seat_parts, front_parts = [], [], []
    width = .325 if skin == "upholstered" else .31
    seat_material = materials["sage"] if skin == "bistro" else materials["wood_light"]
    cushion_material = materials["sage_light"] if skin == "upholstered" else materials["terracotta"]
    seat_parts += [
        cube(f"{asset_id}:seat", (0, 0, .43), (width, .29, .060), seat_material, collection, .040),
        cube(f"{asset_id}:cushion", (0, -.01, .505), (width-.045, .245, .028), cushion_material, collection, .022),
    ]
    if skin == "upholstered":
        back_parts += [
            cube(f"{asset_id}:back-frame", (0, .255, .78), (.35, .05, .28), materials["wood_dark"], collection, .050),
            cube(f"{asset_id}:back-pad", (0, .205, .78), (.285, .028, .22), materials["sage_light"], collection, .060),
        ]
    elif skin == "bistro":
        back_parts.append(cube(f"{asset_id}:back-top", (0, .255, .88), (.325, .045, .052), materials["sage_dark"], collection, .022))
        for index, angle in enumerate((-28, 28)):
            slat = cube(f"{asset_id}:cross:{index}", (0, .255, .70), (.028, .035, .20), materials["sage"], collection, .010)
            slat.rotation_euler.y = radians(angle); back_parts.append(slat)
    else:
        back_parts.append(cube(f"{asset_id}:back-top", (0, .255, .87), (.31, .045, .058), materials["wood_dark"], collection, .022))
        for x in (-.25, 0, .25):
            back_parts.append(cube(f"{asset_id}:back-slat:{x}", (x, .255, .69), (.028, .035, .17), materials["wood"], collection, .010))
    for x in (-.235, .235):
        back_parts.append(cube(f"{asset_id}:rear-leg:{x}", (x, .22, .205), (.035, .035, .205), materials["wood_dark"], collection, .010))
        front_parts.append(cube(f"{asset_id}:front-leg:{x}", (x, -.22, .205), (.035, .035, .205), materials["wood_dark"], collection, .010))
    front_parts.append(cube(f"{asset_id}:front-apron", (0, -.27, .405), (width-.015, .026, .050), materials["wood_dark"], collection, .012))
    parts = back_parts + seat_parts if layer_role == "back" else front_parts if layer_role == "front" else back_parts + seat_parts + front_parts
    return parts, (.38, .32)


def _counter(asset_id, width, collection, materials, service=False):
    body_height = .58 if service else .50
    body_center = .61 if service else .53
    top_z = 1.23 if service else 1.08
    green = asset_id.endswith("_green")
    body_material = materials["sage_dark"] if green else materials["wood_dark"]
    face_material = materials["sage"] if green else materials["wood"]
    parts = [
        cube(f"{asset_id}:body", (0, 0, body_center), (width, .48, body_height), body_material, collection, .045),
        cube(f"{asset_id}:front-face", (0, -.49, body_center), (width-.035, .025, body_height-.035), face_material, collection, .016),
        cube(f"{asset_id}:top", (0, 0, top_z), (width+.07, .535, .075), materials["cream_light"], collection, .028),
        cube(f"{asset_id}:top-edge", (0, -.52, top_z-.03), (width+.06, .025, .065), materials["cream_shadow"], collection, .012),
        cube(f"{asset_id}:toe-kick", (0, -.49, .12), (width-.04, .035, .11), materials["outline_soft"], collection, .010),
        cube(f"{asset_id}:base-trim", (0, -.515, .23), (width-.025, .025, .035), materials["wood_light"], collection, .008),
    ]
    panels = 6 if service else 2
    panel_width = width * 2 / panels
    for index in range(panels):
        x = -width + panel_width * (index + .5)
        panel_z = .68 if service else .60
        parts += [
            cube(f"{asset_id}:panel-frame:{index}", (x, -.535, panel_z), (panel_width*.43, .018, .36), materials["outline_soft"], collection, .015),
            cube(f"{asset_id}:panel:{index}", (x, -.557, panel_z), (panel_width*.37, .009, .30), materials["wood_mid"], collection, .010),
            cube(f"{asset_id}:panel-highlight:{index}", (x, -.57, panel_z+.17), (panel_width*.31, .006, .018), materials["wood_light"], collection, .004),
            cylinder(f"{asset_id}:handle:{index}", (x, -.585, panel_z+.08), .026, panel_width*.40, materials["chrome"], collection, 10, (0, radians(90), 0)),
        ]
    if service:
        parts += [
            cube(f"{asset_id}:service-rail", (0, .43, 1.05), (width-.06, .045, .09), materials["wood_light"], collection, .014),
            cube(f"{asset_id}:service-inlay", (0, -.05, top_z+.085), (width-.12, .33, .012), materials["white_shadow"], collection, .006),
            cube(f"{asset_id}:end-cap.L", (-width-.025, 0, .65), (.035, .46, .48), materials["wood_light"], collection, .010),
            cube(f"{asset_id}:end-cap.R", (width+.025, 0, .65), (.035, .46, .48), materials["wood_light"], collection, .010),
            cube(f"{asset_id}:display-base", (1.48, -.02, 1.37), (.78, .34, .055), materials["wood_dark"], collection, .016),
            cube(f"{asset_id}:display-glass-front", (1.48, -.35, 1.64), (.72, .018, .25), materials["glass"], collection, .010),
            cube(f"{asset_id}:display-glass-back", (1.48, .30, 1.64), (.72, .018, .25), materials["glass"], collection, .010),
            cube(f"{asset_id}:display-glass-top", (1.48, -.02, 1.91), (.76, .34, .025), materials["blue_light"], collection, .010),
            cube(f"{asset_id}:display-frame.L", (.74, -.02, 1.64), (.035, .35, .28), materials["chrome"], collection, .008),
            cube(f"{asset_id}:display-frame.R", (2.22, -.02, 1.64), (.035, .35, .28), materials["chrome"], collection, .008),
            cylinder(f"{asset_id}:bell", (-.76, -.12, 1.43), .13, .13, materials["gold"], collection, 14),
            cylinder(f"{asset_id}:bell-button", (-.76, -.12, 1.53), .035, .07, materials["gold_light"], collection, 10),
            cylinder(f"{asset_id}:herb-pot", (-1.72, .02, 1.39), .12, .18, materials["terracotta"], collection, 12),
        ]
        for index, (x, z, material) in enumerate(((1.08, 1.49, "gold"), (1.45, 1.49, "terracotta"), (1.82, 1.49, "cream"), (1.26, 1.72, "gold_light"), (1.68, 1.72, "sage_light"))):
            parts.append(sphere(f"{asset_id}:display-food:{index}", (x, -.38, z), (.13, .07, .08), materials[material], collection))
        for index, (x, z, material) in enumerate(((-1.82, 1.58, "sage_dark"), (-1.70, 1.70, "sage"), (-1.57, 1.57, "sage_light"))):
            leaf = sphere(f"{asset_id}:herb:{index}", (x, .02, z), (.10, .05, .16), materials[material], collection)
            leaf.rotation_euler.y = -.35 if x < -1.70 else .35
            parts.append(leaf)
    return parts, (width+.11, .56)


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


def _service_module(asset_id, collection, materials):
    """One-cell service module with independent front and rear work faces."""
    width = .50
    parts = [
        cube(f"{asset_id}:body", (0, 0, .54), (width, .47, .50), materials["sage_dark"], collection, .040),
        cube(f"{asset_id}:front", (0, -.49, .56), (.46, .025, .43), materials["sage"], collection, .018),
        cube(f"{asset_id}:front-panel", (0, -.52, .57), (.36, .012, .31), materials["sage_light"], collection, .014),
        cube(f"{asset_id}:rear-shelf", (0, .49, .58), (.44, .025, .34), materials["wood_mid"], collection, .014),
        cube(f"{asset_id}:top", (0, 0, 1.09), (.55, .52, .065), materials["wood_light"], collection, .026),
        cube(f"{asset_id}:top-inlay", (0, -.02, 1.16), (.47, .43, .012), materials["wood_mid"], collection, .006),
        cube(f"{asset_id}:toe-kick", (0, -.48, .10), (.43, .035, .09), materials["outline_soft"], collection, .008),
    ]
    cap_left = asset_id in ("c1_service_isolated", "c2_service_left")
    cap_right = asset_id in ("c1_service_isolated", "c4_service_right")
    if cap_left:
        parts.append(cube(f"{asset_id}:cap.L", (-.53, 0, .57), (.035, .49, .52), materials["wood_dark"], collection, .012))
    if cap_right:
        parts.append(cube(f"{asset_id}:cap.R", (.53, 0, .57), (.035, .49, .52), materials["wood_dark"], collection, .012))
    for index, x in enumerate((-.25, 0, .25)):
        parts.append(cylinder(f"{asset_id}:dish:{index}", (x, .50, .43 + (index % 2) * .20), .11, .055, materials["cream_light"], collection, 14))
    return parts, (.60, .56)


def _pantry(asset_id, collection, materials):
    parts = [
        cube(f"{asset_id}:body", (0, .03, .96), (.53, .42, .94), materials["sage_dark"], collection, .045),
        cube(f"{asset_id}:crown", (0, .03, 1.94), (.57, .45, .06), materials["wood_light"], collection, .018),
        cube(f"{asset_id}:door.L", (-.265, -.405, 1.10), (.245, .030, .68), materials["sage"], collection, .022),
        cube(f"{asset_id}:door.R", (.265, -.405, 1.10), (.245, .030, .68), materials["sage"], collection, .022),
        cube(f"{asset_id}:glass.L", (-.265, -.442, 1.14), (.18, .012, .53), materials["glass"], collection, .010),
        cube(f"{asset_id}:glass.R", (.265, -.442, 1.14), (.18, .012, .53), materials["glass"], collection, .010),
        cube(f"{asset_id}:drawer", (0, -.42, .31), (.46, .035, .19), materials["sage"], collection, .018),
        cylinder(f"{asset_id}:handle.L", (-.07, -.47, 1.04), .025, .34, materials["gold"], collection, 10),
        cylinder(f"{asset_id}:handle.R", (.07, -.47, 1.04), .025, .34, materials["gold"], collection, 10),
    ]
    for index, (x, z, mat) in enumerate(((-.28, .72, "gold"), (.02, .72, "terracotta"), (.28, .72, "cream_light"), (-.25, 1.38, "sage_light"), (.10, 1.38, "gold_light"))):
        parts.append(cylinder(f"{asset_id}:jar:{index}", (x, -.46, z), .075, .18, materials[mat], collection, 10))
    return parts, (.60, .50)


def _support_module(asset_id, collection, materials):
    parts = [
        cube(f"{asset_id}:body", (0, 0, .48), (.50, .45, .44), materials["sage_dark"], collection, .040),
        cube(f"{asset_id}:front", (0, -.47, .50), (.46, .025, .38), materials["sage"], collection, .018),
        cube(f"{asset_id}:top", (0, 0, .97), (.54, .49, .055), materials["steel_light"], collection, .022),
        cylinder(f"{asset_id}:handle", (0, -.51, .57), .024, .34, materials["gold"], collection, 10, (0, radians(90), 0)),
    ]
    if asset_id == "c7_plate_station":
        for stack, x in enumerate((-.22, .05, .28)):
            for layer in range(3):
                parts.append(cylinder(f"{asset_id}:plate:{stack}:{layer}", (x, -.04, 1.06 + layer * .035), .16, .022, materials["cream_light"], collection, 14))
        parts.append(cylinder(f"{asset_id}:cutlery", (-.33, .25, 1.18), .085, .28, materials["chrome"], collection, 12))
    elif asset_id == "c8_waste_recycling":
        parts += [
            cube(f"{asset_id}:divider", (0, -.49, .51), (.025, .018, .36), materials["outline_soft"], collection, .006),
            cylinder(f"{asset_id}:hole-green-rim", (-.22, 0, 1.035), .175, .045, materials["green"], collection, 16),
            cylinder(f"{asset_id}:hole-green", (-.22, 0, 1.065), .125, .052, materials["outline"], collection, 16),
            cylinder(f"{asset_id}:hole-dark-rim", (.22, 0, 1.035), .175, .045, materials["steel_dark"], collection, 16),
            cylinder(f"{asset_id}:hole-dark", (.22, 0, 1.065), .125, .052, materials["outline"], collection, 16),
            cube(f"{asset_id}:recycle-panel", (-.22, -.505, .48), (.14, .012, .15), materials["green_dark"], collection, .006),
            cube(f"{asset_id}:organic-panel", (.22, -.505, .48), (.14, .012, .15), materials["wood_dark"], collection, .006),
            cube(f"{asset_id}:label-green", (-.22, -.52, .49), (.075, .008, .035), materials["sage_light"], collection, .004),
            cube(f"{asset_id}:label-dark", (.22, -.52, .49), (.075, .008, .035), materials["gold_light"], collection, .004),
        ]
    elif asset_id == "c9_cold_drinks":
        for index, (x, liquid) in enumerate(((-.19, "orange"), (.19, "green"))):
            parts += [
                cylinder(f"{asset_id}:tank:{index}", (x, .02, 1.45), .16, .44, materials["glass"], collection, 14),
                cylinder(f"{asset_id}:drink:{index}", (x, .02, 1.43), .13, .34, materials[liquid], collection, 14),
                cube(f"{asset_id}:tap:{index}", (x, -.20, 1.20), (.035, .12, .055), materials["outline"], collection, .010),
            ]
    elif asset_id == "c10_cutting_block":
        parts[2] = cube(f"{asset_id}:butcher-top", (0, 0, 1.02), (.55, .50, .11), materials["wood_light"], collection, .028)
        knife = cube(f"{asset_id}:knife", (-.12, -.02, 1.16), (.30, .025, .018), materials["chrome"], collection, .006)
        knife.rotation_euler.z = radians(-25); parts.append(knife)
        for index, (x, y, mat) in enumerate(((.18, .03, "green"), (.30, -.08, "food_red"), (.23, .18, "sage_light"))):
            parts.append(sphere(f"{asset_id}:herb:{index}", (x, y, 1.17), (.08, .05, .08), materials[mat], collection))
    return parts, (.60, .54)


def create_furniture(definition, collection, materials):
    asset_id = definition["assetId"]; root = root_empty(asset_id, collection)
    if asset_id.startswith("table"):
        parts, shadow_size = _table(asset_id, asset_id == "table_four", collection, materials)
    elif asset_id.startswith("chair_"):
        skin = "upholstered" if "upholstered" in asset_id else "bistro" if "bistro" in asset_id else "wood"
        layer_role = definition.get("layerRole", "full")
        parts, shadow_size = _chair(asset_id, collection, materials, skin, layer_role)
    elif asset_id.startswith(("c1_service_", "c2_service_", "c3_service_", "c4_service_")):
        parts, shadow_size = _service_module(asset_id, collection, materials)
    elif asset_id == "c5_dry_pantry":
        parts, shadow_size = _pantry(asset_id, collection, materials)
    elif asset_id == "c6_ingredient_shelf":
        parts, shadow_size = _storage(asset_id, False, collection, materials)
    elif asset_id.startswith(("c7_", "c8_", "c9_", "c10_")):
        parts, shadow_size = _support_module(asset_id, collection, materials)
    elif "counter" in asset_id:
        is_service = asset_id.startswith("pickup_counter")
        parts, shadow_size = _counter(asset_id, 2.88 if is_service else 1.03, collection, materials, is_service)
    elif asset_id in ("shelf", "storage_cabinet"):
        parts, shadow_size = _storage(asset_id, asset_id == "storage_cabinet", collection, materials)
    elif asset_id == "bin":
        parts = [
            cube(f"{asset_id}:body", (0, 0, .47), (.39, .34, .43), materials["sage_dark"], collection, .045),
            cube(f"{asset_id}:front", (0, -.35, .48), (.35, .025, .37), materials["sage"], collection, .018),
            cube(f"{asset_id}:front-inset", (0, -.38, .49), (.28, .010, .29), materials["sage_light"], collection, .010),
            cube(f"{asset_id}:rim", (0, 0, .91), (.41, .36, .055), materials["steel_dark"], collection, .022),
            cube(f"{asset_id}:lid", (0, -.01, .98), (.38, .33, .045), materials["steel_light"], collection, .024),
            cube(f"{asset_id}:lid-inset", (0, -.02, 1.03), (.28, .23, .012), materials["steel_mid"], collection, .008),
            cube(f"{asset_id}:pedal", (0, -.39, .08), (.14, .11, .035), materials["chrome"], collection, .014),
            cylinder(f"{asset_id}:handle", (0, -.40, .67), .022, .26, materials["gold"], collection, 10, (0, radians(90), 0)),
        ]; shadow_size = (.47, .41)
    else:
        parts = [cylinder(f"{asset_id}:pot", (0, 0, .28), .31, .48, materials["terracotta"], collection, 12), cylinder(f"{asset_id}:soil", (0, 0, .54), .27, .035, materials["wood_dark"], collection, 12)]
        for index, (x,y,z,material) in enumerate(((-.23,0,.88,"sage_dark"),(0,-.05,1.06,"sage"),(.23,0,.90,"sage_light"),(-.10,.08,1.22,"sage"),(.12,.05,1.30,"sage_dark"))):
            leaf = sphere(f"{asset_id}:leaf:{index}", (x, y, z), (.18, .08, .30), materials[material], collection); leaf.rotation_euler.y = -.35 if x < 0 else .35; parts.append(leaf)
        shadow_size = (.43, .38)
    if definition.get("layerRole", "full") != "front":
        parts.append(shadow(asset_id, collection, materials["shadow"], shadow_size))
    parent_parts(root, parts)
    root["qualityProfile"] = "bistro-bloom-character-bible-v2"; root["fillsFootprint"] = True
    add_markers(asset_id, collection, counter="counter" in asset_id); tag_collection(collection, definition)
    return root
