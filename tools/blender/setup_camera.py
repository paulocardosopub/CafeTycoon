import bpy
from mathutils import Vector

CAMERA_LOCATION = (6.0, -6.0, 6.0)
CAMERA_ORTHO_SCALE = 3.1

def aim(obj, target=(0, 0, 1.0)):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()

def setup_camera(scene, ortho_scale=CAMERA_ORTHO_SCALE, target_z=1.0):
    camera_data = bpy.data.cameras.get("BistroIsoCamera") or bpy.data.cameras.new("BistroIsoCamera")
    camera = bpy.data.objects.get("BistroIsoCamera") or bpy.data.objects.new("BistroIsoCamera", camera_data)
    if not camera.users_collection: scene.collection.objects.link(camera)
    camera.location = CAMERA_LOCATION; camera.data.type = "ORTHO"; camera.data.ortho_scale = ortho_scale
    aim(camera, (0, 0, target_z)); scene.camera = camera
    camera["projection"] = "isometric-2-to-1"; camera["horizontalAngle"] = 45.0; camera["inclination"] = 35.264
    camera["feetAnchor"] = [48, 136]
    return camera
