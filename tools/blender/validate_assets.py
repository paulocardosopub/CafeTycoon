from pathlib import Path
import json, sys
import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path: sys.path.insert(0, str(SCRIPT_DIR))
from config.pipeline_config import ANIMATIONS, CHARACTER_FRAME, CHARACTER_STYLE_REFERENCE, DIRECTIONS, PALETTE, QUALITY_PROFILE, RENDER_VERSION, STYLE_REFERENCE, WORLD_FLOOR_Y, WORLD_FRAME, project_root_from_script

def validate(project_root: Path):
    manifest_path = project_root / "public/assets/pixel/rendered/asset-manifest.json"
    if not manifest_path.exists(): raise RuntimeError("Asset manifest is missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")); errors = []
    if manifest.get("version") != RENDER_VERSION: errors.append("render version mismatch")
    if manifest.get("qualityProfile") != QUALITY_PROFILE: errors.append("quality profile mismatch")
    if not (project_root / STYLE_REFERENCE).exists(): errors.append("positive visual reference is missing")
    if not (project_root / CHARACTER_STYLE_REFERENCE).exists(): errors.append("character style bible is missing")
    camera = manifest.get("camera", {})
    if camera.get("projection") != "orthographic" or camera.get("horizontalAngle") != 45: errors.append("camera configuration mismatch")
    for relative_source in sorted({asset["sourceBlend"] for asset in manifest.get("assets", [])}):
        source_path = project_root / relative_source
        if not source_path.exists(): errors.append(f"missing source: {relative_source}"); continue
        bpy.ops.wm.open_mainfile(filepath=str(source_path))
        scene = bpy.context.scene; camera_object = scene.camera
        if not camera_object or camera_object.data.type != "ORTHO" or camera_object.name != "BistroIsoCamera": errors.append(f"invalid orthographic camera: {relative_source}")
        if scene.get("lightingRig") != "bistro_softbox_v1" or any(name not in bpy.data.objects for name in ("BistroKey", "BistroFill", "BistroRim")): errors.append(f"invalid lighting rig: {relative_source}")
        if not scene.render.film_transparent: errors.append(f"film is not transparent: {relative_source}")
        for asset in (item for item in manifest.get("assets", []) if item["sourceBlend"] == relative_source):
            if not bpy.data.collections.get(asset["sourceCollection"]): errors.append(f"source collection missing: {asset['assetId']}")
            marker_names = {"origin", "footprintOrigin", "frontDirection", "shadowOrigin"}
            if asset["kind"] == "character": marker_names |= {"feetAnchor", "carriedItemAnchor"}
            if asset["kind"] == "equipment": marker_names |= {"workPoint", "ingredientPoint", "outputPoint"}
            if any(f"{asset['assetId']}:{name}" not in bpy.data.objects for name in marker_names): errors.append(f"technical marker missing: {asset['assetId']}")
    for asset in manifest.get("assets", []):
        source = project_root / asset["sourceBlend"]
        rendered = project_root / "assets/pixel/rendered" / asset["category"] / f"{asset['assetId']}.png"
        thumb = project_root / "assets/pixel/rendered/thumbnails" / f"{asset['assetId']}.png"
        deployed = project_root / "public" / asset["renderedFile"].lstrip("/")
        if not source.exists(): errors.append(f"missing blend: {asset['assetId']}")
        if not rendered.exists(): errors.append(f"missing PNG: {asset['assetId']}"); continue
        if not thumb.exists(): errors.append(f"missing thumbnail: {asset['assetId']}")
        if not deployed.exists(): errors.append(f"missing deployed PNG: {asset['assetId']}")
        if asset.get("visualLevel") != 1: errors.append(f"invalid visual level: {asset['assetId']}")
        if asset.get("qualityProfile") != QUALITY_PROFILE or asset.get("nativeScale") != 1.0: errors.append(f"quality metadata mismatch: {asset['assetId']}")
        reference_mode = asset.get("referenceMode")
        if reference_mode and reference_mode not in {"authorized-canonical-chroma-key", "authorized-character-sheet"}: errors.append(f"invalid reference mode: {asset['assetId']}")
        if reference_mode in {"authorized-canonical-chroma-key", "authorized-character-sheet"} and not (project_root / asset.get("referenceSource", "")).exists(): errors.append(f"authorized reference missing: {asset['assetId']}")
        if not asset.get("visualSkinId"): errors.append(f"visual skin missing: {asset['assetId']}")
        bounds = asset.get("visualBounds", {})
        if bounds.get("overhangCells", 99) > .35: errors.append(f"visual overhang too large: {asset['assetId']}")
        if asset.get("orientations") != list(DIRECTIONS): errors.append(f"directions mismatch: {asset['assetId']}")
        if asset["kind"] == "character":
            if asset.get("anchor") != [48, 136] or asset.get("frameSize") != list(CHARACTER_FRAME): errors.append(f"feet anchor/frame mismatch: {asset['assetId']}")
            if any(name not in asset.get("animations", {}) for name in ANIMATIONS): errors.append(f"required animation missing: {asset['assetId']}")
            if asset.get("animations", {}).get("walk") != 6: errors.append(f"six-frame walk missing: {asset['assetId']}")
            if not asset.get("identityProfile") or not asset.get("bodyProfile"): errors.append(f"structural identity missing: {asset['assetId']}")
        else:
            expected_frame = [256, 192] if asset["assetId"].startswith("pickup_counter") else list(WORLD_FRAME)
            if asset.get("frameSize") != expected_frame: errors.append(f"world frame mismatch: {asset['assetId']}")
            if abs(asset.get("anchor", [0, 0])[1] - WORLD_FLOOR_Y / expected_frame[1]) > .0001: errors.append(f"world floor anchor mismatch: {asset['assetId']}")
        if asset["assetId"] == "stove_level_1" and not {"off", "active"}.issubset(asset.get("animations", {})): errors.append("stove states missing")
        if asset["assetId"] == "refrigerator_level_1" and not {"closed", "open"}.issubset(asset.get("animations", {})): errors.append("refrigerator states missing")
        image = bpy.data.images.load(str(rendered), check_existing=False)
        frame_w, frame_h = asset["frameSize"]; expected_w = frame_w * asset["frameCount"]; expected_h = frame_h * 4
        if tuple(image.size) != (expected_w, expected_h): errors.append(f"dimensions mismatch: {asset['assetId']} {tuple(image.size)}")
        pixels = list(image.pixels); alphas = pixels[3::4]
        if not any(alpha < .01 for alpha in alphas): errors.append(f"transparent background missing: {asset['assetId']}")
        if not any(alpha > .5 for alpha in alphas): errors.append(f"empty render: {asset['assetId']}")
        opaque_colors = {tuple(round(value, 3) for value in pixels[index:index+3]) for index in range(0, len(pixels), 4) if pixels[index+3] > .5}
        if reference_mode not in {"canonical-chroma-key", "reference-derived-variant", "authorized-canonical-chroma-key", "authorized-character-sheet"} and len(opaque_colors) > len(PALETTE) * 4 + 4: errors.append(f"uncontrolled/blurred palette: {asset['assetId']} ({len(opaque_colors)} colors)")
        if reference_mode in {"canonical-chroma-key", "reference-derived-variant", "authorized-canonical-chroma-key", "authorized-character-sheet"}:
            magenta_pixels = sum(1 for index in range(0, len(pixels), 4) if pixels[index+3] > .5 and pixels[index] > .70 and pixels[index+2] > .62 and pixels[index+1] < .38)
            if magenta_pixels: errors.append(f"reference background leaked: {asset['assetId']} ({magenta_pixels}px)")
        frame_opaque = [(x, y) for y in range(frame_h) for x in range(frame_w) if pixels[(y * image.size[0] + x) * 4 + 3] > .2]
        if frame_opaque:
            coverage_w = max(point[0] for point in frame_opaque) - min(point[0] for point in frame_opaque) + 1
            coverage_h = max(point[1] for point in frame_opaque) - min(point[1] for point in frame_opaque) + 1
            if asset["kind"] == "character" and (coverage_h < frame_h * .68 or coverage_w < frame_w * .28): errors.append(f"undersized character: {asset['assetId']} ({coverage_w}x{coverage_h})")
            if asset["kind"] == "character" and (min(point[1] for point in frame_opaque) < 3 or max(point[1] for point in frame_opaque) > frame_h - 4): errors.append(f"clipped character frame: {asset['assetId']}")
            if asset["kind"] != "character" and asset.get("layerRole") != "back" and abs(min(point[1] for point in frame_opaque) - (frame_h - WORLD_FLOOR_Y)) > 2: errors.append(f"world baseline mismatch: {asset['assetId']} ({min(point[1] for point in frame_opaque)})")
            if asset["kind"] == "equipment" and asset["footprint"][0] == 2 and coverage_w < frame_w * .48: errors.append(f"equipment does not fill footprint: {asset['assetId']} ({coverage_w}px)")
            if asset["assetId"].startswith("pickup_counter") and coverage_w < frame_w * .70: errors.append(f"service counter does not fill footprint: {coverage_w}px")
            if asset["assetId"].startswith("pickup_counter") and (min(point[0] for point in frame_opaque) < 3 or max(point[0] for point in frame_opaque) > frame_w - 4): errors.append("service counter frame is clipped")
        else: errors.append(f"empty first frame: {asset['assetId']}")
        bpy.data.images.remove(image)
    customers = [asset for asset in manifest.get("assets", []) if asset["assetId"].startswith("customer-")]
    if len(customers) != 8: errors.append(f"expected 8 authorized customers, found {len(customers)}")
    if len({asset.get("identityProfile") for asset in customers}) != 8: errors.append("customer identities are not structurally unique")
    if any(asset.get("referenceMode") != "authorized-character-sheet" for asset in customers): errors.append("customers are not using the authorized character package")
    for skin in ("wood", "upholstered", "bistro"):
        roles = {asset.get("layerRole") for asset in manifest.get("assets", []) if asset["assetId"].startswith(f"chair_{skin}")}
        if roles != {"full", "back", "front"}: errors.append(f"chair layers incomplete: {skin}")
    if errors: raise RuntimeError("\n".join(errors))
    print(f"VALIDATED {len(manifest['assets'])} Blender assets")
    return manifest

if __name__ == "__main__": validate(project_root_from_script())
