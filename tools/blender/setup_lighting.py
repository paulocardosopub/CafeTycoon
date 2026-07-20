import bpy
from mathutils import Vector

def _aim(obj, target=(0, 0, .8)):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

def setup_lighting(scene):
    for name, location, energy, size, color in (
        ("BistroKey", (-4, -5, 8), 900, 5.0, (1.0, .82, .61)),
        ("BistroFill", (5, 2, 5), 430, 4.0, (.65, .78, 1.0)),
        ("BistroRim", (1, 6, 7), 320, 3.0, (.83, 1.0, .74)),
    ):
        data = bpy.data.lights.get(name) or bpy.data.lights.new(name, "AREA")
        data.energy = energy; data.shape = "DISK"; data.size = size; data.color = color
        obj = bpy.data.objects.get(name) or bpy.data.objects.new(name, data)
        if not obj.users_collection: scene.collection.objects.link(obj)
        obj.location = location; _aim(obj)
    scene.world.color = (.025, .035, .03)
    scene["lightingRig"] = "bistro_softbox_v1"
