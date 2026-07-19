import bpy

BONES = ("root", "spine", "head", "arm.L", "arm.R", "leg.L", "leg.R", "carry")

def create_humanoid_rig(asset_id, collection):
    armature_data = bpy.data.armatures.new(f"{asset_id}:rig-data")
    rig = bpy.data.objects.new(f"{asset_id}:rig", armature_data)
    collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    parent = None
    for index, name in enumerate(BONES):
        bone = armature_data.edit_bones.new(name)
        if name == "root": bone.head, bone.tail = (0, 0, 0), (0, 0, .25)
        elif name == "spine": bone.head, bone.tail, bone.parent = (0, 0, .25), (0, 0, 1.35), armature_data.edit_bones["root"]
        elif name == "head": bone.head, bone.tail, bone.parent = (0, 0, 1.35), (0, 0, 2.05), armature_data.edit_bones["spine"]
        elif name.startswith("arm"):
            side = -.38 if name.endswith("L") else .38
            bone.head, bone.tail, bone.parent = (side, 0, 1.3), (side, 0, .68), armature_data.edit_bones["spine"]
        elif name.startswith("leg"):
            side = -.18 if name.endswith("L") else .18
            bone.head, bone.tail, bone.parent = (side, 0, .62), (side, 0, .05), armature_data.edit_bones["root"]
        else:
            bone.head, bone.tail, bone.parent = (0, -.42, 1.0), (0, -.7, 1.0), armature_data.edit_bones["spine"]
        parent = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    rig.hide_render = True
    rig["rigId"] = "bistro_humanoid_v1"
    rig["feetAnchor"] = [32, 88]
    rig.select_set(False)
    return rig
