"""Apply the final sole-floor correction to the saved v002 scene."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from prototype_config import PLAYER_PRESETS
from refinement_config import REFINEMENT_BLEND, REFINEMENT_OUTPUT_ROOT
from sprite_refresh_refinement import base, open_refinement_blend


open_refinement_blend()
for obj in bpy.data.objects:
    if ":shoe-sole:" not in obj.name or obj.get("soleFloorCorrection"):
        continue
    world = obj.matrix_world.copy()
    world.translation.z += .04
    obj.matrix_world = world
    obj["soleFloorCorrection"] = .04

base.reset_default_scene()
check = REFINEMENT_OUTPUT_ROOT / "preview_frames" / "sole_check_sw.png"
base.render_asset(PLAYER_PRESETS[0]["id"], check, "sw")
base.reset_default_scene()
bpy.ops.wm.save_as_mainfile(filepath=str(REFINEMENT_BLEND))
print(f"SOLE_CHECK={check}")
