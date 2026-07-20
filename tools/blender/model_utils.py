import bpy
from mathutils import Vector

def link_only(obj, collection):
    for owner in list(obj.users_collection): owner.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def cube(name, location, scale, material, collection, bevel=.03):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object; obj.name = name; obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Pixel bevel", "BEVEL"); modifier.width = bevel; modifier.segments = 1
    obj.data.materials.append(material); return link_only(obj, collection)

def cylinder(name, location, radius, depth, material, collection, vertices=8, rotation=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object; obj.name = name
    if rotation is not None: obj.rotation_euler = rotation
    obj.data.materials.append(material); return link_only(obj, collection)

def cone(name, location, radius1, radius2, depth, material, collection, vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location)
    obj = bpy.context.object; obj.name = name; obj.data.materials.append(material); return link_only(obj, collection)

def sphere(name, location, scale, material, collection):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, location=location)
    obj = bpy.context.object; obj.name = name; obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material); return link_only(obj, collection)

def root_empty(asset_id, collection):
    root = bpy.data.objects.new(f"{asset_id}:root", None); root.empty_display_type = "PLAIN_AXES"; root.hide_render = True
    collection.objects.link(root); root["assetId"] = asset_id; return root

def pivot(name, location, collection, parent=None):
    obj = bpy.data.objects.new(name, None); obj.empty_display_type = "PLAIN_AXES"; obj.hide_render = True
    collection.objects.link(obj); obj.location = location; obj.parent = parent; return obj

def parent_local(obj, parent, location):
    obj.parent = parent; obj.location = location; return obj

def parent_parts(root, objects):
    for obj in objects: obj.parent = root

def shadow(asset_id, collection, material, size=(.48, .30)):
    bpy.ops.mesh.primitive_circle_add(vertices=12, radius=1, fill_type="NGON", location=(0, 0, .012))
    obj = bpy.context.object; obj.name = f"{asset_id}:shadow"; obj.scale = (size[0], size[1], 1); obj.data.materials.append(material)
    return link_only(obj, collection)

def tag_collection(collection, definition):
    for key in ("assetId", "category", "visualLevel", "equipmentFamilyId"):
        value = definition.get(key)
        if value is not None: collection[key] = value
    collection["footprint"] = definition["footprint"]
    collection["frontDirection"] = "sw"

def collection_objects_recursive(collection):
    result = list(collection.objects)
    for child in collection.children: result.extend(collection_objects_recursive(child))
    return result
