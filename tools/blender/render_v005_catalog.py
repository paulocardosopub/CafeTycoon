"""Build and render the complete A1-A8, B1-B8 and C1-C10 v0.0.5 catalog."""
from pathlib import Path
import os
import shutil
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from build_assets import build_all
from config.pipeline_config import project_root_from_script


CATALOG_ASSETS = [
    "a1_stove_industrial", "a2_convection_oven", "a3_griddle", "a4_fryer",
    "a5_kettle", "a6_grill", "a7_bakery_oven", "a8_coffee_machine",
    "b1_industrial_fridge", "b2_industrial_freezer", "b3_preparation_counter",
    "b4_ingredient_station", "b5_industrial_sink", "b6_dishwasher",
    "b7_double_sink", "b8_pastry_table", "c1_service_isolated",
    "c2_service_left", "c3_service_middle", "c4_service_right", "c5_dry_pantry",
    "c6_ingredient_shelf", "c7_plate_station", "c8_waste_recycling",
    "c9_cold_drinks", "c10_cutting_block",
]


if __name__ == "__main__":
    root = project_root_from_script()
    rendered, _ = build_all(root, CATALOG_ASSETS, None, True)
    preview = os.environ.get("BLENDER_CODEX_PREVIEW_PATH")
    blend = os.environ.get("BLENDER_CODEX_BLEND_PATH")
    if preview and rendered:
        shutil.copy2(rendered[0][2], Path(preview))
    if blend and rendered:
        shutil.copy2(root / rendered[0][0]["sourceBlend"], Path(blend))
