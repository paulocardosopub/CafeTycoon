"""Validate every appliance that declares the exact service-counter base contract."""
from pathlib import Path
import sys

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from config.pipeline_config import ASSETS, project_root_from_script
from exact_service_counter_base import validate_exact_service_counter


def validate(project_root: Path):
    checked = 0
    for definition in ASSETS:
        expected = definition.get("counterBaseAssetId")
        if not expected:
            continue
        bpy.ops.wm.open_mainfile(filepath=str(project_root / definition["sourceBlend"]), load_ui=False)
        collection = bpy.data.collections.get(definition["sourceCollection"])
        if collection is None:
            raise RuntimeError(f"Missing counter appliance collection: {definition['assetId']}")
        validate_exact_service_counter(collection, expected)
        checked += 1
    if checked == 0:
        raise RuntimeError("No exact service-counter appliances are registered")
    print(f"VALIDATED {checked} exact service-counter appliance(s)")


if __name__ == "__main__":
    validate(project_root_from_script())
