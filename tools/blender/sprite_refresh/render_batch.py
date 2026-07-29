"""Re-render the isolated approval package from the editable .blend source."""

import os
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from prototype_config import DEFAULT_BLEND
from sprite_refresh_pipeline import render_all, reset_default_scene


blend_path = Path(os.environ.get("SPRITE_REFRESH_BLEND", str(DEFAULT_BLEND)))
if Path(bpy.data.filepath).resolve() != blend_path.resolve():
    bpy.ops.wm.open_mainfile(filepath=str(blend_path), load_ui=False)
render_all()
reset_default_scene()
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

