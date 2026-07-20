"""Rebuild the layered chair sheets after validating their four facings."""
from pathlib import Path
import os
import shutil
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from build_assets import build_all
from config.pipeline_config import project_root_from_script


CHAIR_ASSETS = [
    f"chair_{skin}{suffix}"
    for skin in ("wood", "upholstered", "bistro")
    for suffix in ("", "_back", "_front")
]


if __name__ == "__main__":
    root = project_root_from_script()
    rendered, _ = build_all(root, CHAIR_ASSETS, "furniture", False)
    preview = os.environ.get("BLENDER_CODEX_PREVIEW_PATH")
    blend = os.environ.get("BLENDER_CODEX_BLEND_PATH")
    if preview and rendered:
        shutil.copy2(rendered[0][2], Path(preview))
    if blend:
        shutil.copy2(root / rendered[0][0]["sourceBlend"], Path(blend))
