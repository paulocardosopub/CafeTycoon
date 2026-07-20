import bpy
from config.pipeline_config import ANIMATIONS

def create_animation_library(rig):
    if rig.animation_data is None:
        rig.animation_data_create()
    for name, frames in ANIMATIONS.items():
        action = bpy.data.actions.get(f"BB_{name}") or bpy.data.actions.new(f"BB_{name}")
        action["animationId"] = name
        action["frameCount"] = frames
        action["directions"] = 4
    rig["animationSet"] = "bistro_character_v1"
    rig["animationNames"] = list(ANIMATIONS)
