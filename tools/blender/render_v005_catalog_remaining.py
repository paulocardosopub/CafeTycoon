"""Finish the v0.0.5 equipment catalog without rebuilding completed assets."""
from pathlib import Path
import os
import shutil
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from build_assets import build_all
from config.pipeline_config import project_root_from_script


REMAINING = [
    "a6_grill", "a7_bakery_oven", "a8_coffee_machine", "b1_industrial_fridge",
    "b2_industrial_freezer", "b3_preparation_counter", "b4_ingredient_station",
    "b5_industrial_sink", "b6_dishwasher", "b7_double_sink", "b8_pastry_table",
]


if __name__ == "__main__":
    root = project_root_from_script()
    rendered, _ = build_all(root, REMAINING, "equipment", False)
    preview = os.environ.get("BLENDER_CODEX_PREVIEW_PATH")
    blend = os.environ.get("BLENDER_CODEX_BLEND_PATH")
    if preview and rendered:
        shutil.copy2(rendered[0][2], Path(preview))
    if blend and rendered:
        shutil.copy2(root / rendered[0][0]["sourceBlend"], Path(blend))
