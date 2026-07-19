from pathlib import Path
import bpy
from config.pipeline_config import CHARACTERS, EQUIPMENT, FURNITURE
from create_characters import create_character
from create_equipment import create_equipment
from create_furniture import create_furniture
from create_materials import build_materials
from setup_camera import setup_camera
from setup_lighting import setup_lighting

def clear_scene():
    bpy.ops.object.select_all(action="SELECT"); bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections): bpy.data.collections.remove(collection)

def configure_scene():
    scene = bpy.context.scene
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.film_transparent = True; scene.render.image_settings.file_format = "PNG"; scene.render.image_settings.color_mode = "RGBA"
    scene.render.resolution_percentage = 100
    scene.view_settings.look = "AgX - Medium High Contrast"
    setup_camera(scene); setup_lighting(scene)
    scene["bistroAssetSourceVersion"] = "0.0.3"
    return scene

def build_family(project_root: Path, definitions, relative_path: str, builder):
    clear_scene(); scene = configure_scene(); materials = build_materials()
    asset_root = bpy.data.collections.new("BistroAssets"); scene.collection.children.link(asset_root)
    for definition in definitions:
        collection = bpy.data.collections.new(definition["sourceCollection"]); asset_root.children.link(collection)
        builder(definition, collection, materials); collection.hide_render = True
    target = project_root / relative_path; target.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(target)); return target

def build_source_files(project_root: Path):
    return [
        build_family(project_root, CHARACTERS, "assets/blender/characters/characters_base.blend", create_character),
        build_family(project_root, FURNITURE, "assets/blender/furniture/furniture.blend", create_furniture),
        build_family(project_root, EQUIPMENT, "assets/blender/equipment/kitchen_equipment.blend", create_equipment),
    ]
