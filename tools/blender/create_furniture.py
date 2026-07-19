from model_utils import cube, cylinder, parent_parts, root_empty, shadow, tag_collection
from technical_markers import add_markers

def create_furniture(definition, collection, materials):
    asset_id = definition["assetId"]; root = root_empty(asset_id, collection); parts = []
    if asset_id.startswith("table"):
        size = (.62, .48, .10) if asset_id == "table_four" else (.48, .40, .10)
        parts += [cube(f"{asset_id}:top", (0, 0, .72), size, materials["wood_light"], collection, .05)]
        for x in (-size[0] + .12, size[0] - .12):
            for y in (-size[1] + .10, size[1] - .10): parts.append(cube(f"{asset_id}:leg:{x}:{y}", (x, y, .35), (.07, .07, .35), materials["wood"], collection, .02))
    elif asset_id == "chair":
        parts += [cube(f"{asset_id}:seat", (0, 0, .47), (.32, .32, .07), materials["wood_light"], collection, .04), cube(f"{asset_id}:back", (0, .28, .84), (.33, .06, .38), materials["wood"], collection, .04)]
        for x in (-.25, .25):
            for y in (-.24, .24): parts.append(cube(f"{asset_id}:leg:{x}:{y}", (x, y, .23), (.045, .045, .23), materials["wood"], collection, .01))
    elif "counter" in asset_id:
        width = 2.65 if asset_id == "pickup_counter" else .85
        parts += [cube(f"{asset_id}:body", (0, 0, .45), (width, .42, .45), materials["wood"], collection, .04), cube(f"{asset_id}:top", (0, 0, .94), (width + .06, .48, .07), materials["cream"], collection, .03)]
    elif asset_id in ("shelf", "storage_cabinet"):
        width = .85 if asset_id == "storage_cabinet" else .52
        parts += [cube(f"{asset_id}:body", (0, 0, .75), (width, .32, .75), materials["wood"], collection, .03)]
        for z in (.35, .72, 1.1): parts.append(cube(f"{asset_id}:shelf:{z}", (0, -.34, z), (width, .06, .04), materials["wood_light"], collection, .01))
    elif asset_id == "bin":
        parts += [cylinder(f"{asset_id}:body", (0, 0, .42), .31, .72, materials["sage"], collection, 8), cylinder(f"{asset_id}:lid", (0, 0, .80), .34, .08, materials["sage_dark"], collection, 8)]
    else:
        parts += [cylinder(f"{asset_id}:pot", (0, 0, .26), .28, .42, materials["terracotta"], collection, 8)]
        for index, x in enumerate((-.22, 0, .22)): parts.append(cube(f"{asset_id}:leaf:{index}", (x, 0, .78 + abs(x)), (.16, .06, .42), materials["sage" if index % 2 else "sage_dark"], collection, .06))
    parts.append(shadow(asset_id, collection, materials["shadow"], (.68, .42))); parent_parts(root, parts)
    add_markers(asset_id, collection, counter="counter" in asset_id); tag_collection(collection, definition); return root
