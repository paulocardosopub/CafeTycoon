"""Re-render all character-only outputs from the adjusted v002 .blend."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from refinement_config import REFINEMENT_BLEND
from sprite_refresh_refinement import base, open_refinement_blend, render_character_outputs, write_refinement_manifest


open_refinement_blend()
render_character_outputs()
write_refinement_manifest()
base.reset_default_scene()
bpy.ops.wm.save_as_mainfile(filepath=str(REFINEMENT_BLEND))
