"""Repack v0.0.5 world sheets around the exact logical floor footprint."""
from pathlib import Path
import os
import shutil
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from build_assets import write_manifests
from config.pipeline_config import ASSETS, project_root_from_script
from normalize_sprite_sheets import normalize_world_assets


# A regra de base dentro do footprint vale para qualquer objeto de mundo,
# inclusive skins antigas que ainda possam ser carregadas por um save.
CATALOG = [item["assetId"] for item in ASSETS if item["kind"] != "character"]


if __name__ == "__main__":
    root = project_root_from_script()
    normalize_world_assets(root, ASSETS, CATALOG, include_authorized=True)
    write_manifests(root)
    preview = os.environ.get("BLENDER_CODEX_PREVIEW_PATH")
    blend = os.environ.get("BLENDER_CODEX_BLEND_PATH")
    if preview:
        shutil.copy2(root / "public/assets/pixel/rendered/thumbnails/c1_service_isolated.png", Path(preview))
    if blend:
        shutil.copy2(root / "assets/blender/furniture/furniture.blend", Path(blend))
