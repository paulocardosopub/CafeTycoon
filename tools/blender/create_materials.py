import bpy
from config.pipeline_config import PALETTE

def build_materials():
    materials = {}
    for name, color in PALETTE.items():
        material = bpy.data.materials.get(f"BB_{name}") or bpy.data.materials.new(f"BB_{name}")
        material.diffuse_color = color
        material.use_nodes = True
        shader = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if shader is None:
            shader = material.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
            output = next((node for node in material.node_tree.nodes if node.type == "OUTPUT_MATERIAL"), None) or material.node_tree.nodes.new("ShaderNodeOutputMaterial")
            material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Roughness"].default_value = 0.82
        shader.inputs["Metallic"].default_value = 0.72 if name == "chrome" else 0.42 if "steel" in name else 0.0
        shader.inputs["Specular IOR Level"].default_value = 0.34
        materials[name] = material
    shadow = bpy.data.materials.get("BB_shadow") or bpy.data.materials.new("BB_shadow")
    shadow.diffuse_color = (0.16, 0.075, 0.045, 0.16)
    shadow.use_nodes = True
    shader = next((node for node in shadow.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if shader is None:
        shader = shadow.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        output = next((node for node in shadow.node_tree.nodes if node.type == "OUTPUT_MATERIAL"), None) or shadow.node_tree.nodes.new("ShaderNodeOutputMaterial")
        shadow.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    shader.inputs["Base Color"].default_value = (0.16, 0.075, 0.045, 1)
    shader.inputs["Roughness"].default_value = 1.0
    shader.inputs["Alpha"].default_value = 0.16
    shadow.surface_render_method = "DITHERED"
    materials["shadow"] = shadow
    return materials
