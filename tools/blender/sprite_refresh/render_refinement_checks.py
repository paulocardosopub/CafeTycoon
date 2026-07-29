"""Render lightweight diversity checks from the saved refinement scene."""

from __future__ import annotations

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from prototype_config import FAMILY_CHARACTERS, PLAYER_PRESETS
from refinement_config import REFINEMENT_OUTPUT_ROOT
from sprite_refresh_refinement import base, open_refinement_blend


open_refinement_blend()
paths = []
for spec in (*PLAYER_PRESETS, *FAMILY_CHARACTERS):
    path = REFINEMENT_OUTPUT_ROOT / "preview_frames" / f"diversity_{spec['id']}.png"
    base.render_asset(spec["id"], path, "sw")
    paths.append(path)
base.compose_board(paths, REFINEMENT_OUTPUT_ROOT / "preview_character_diversity.png", columns=6, scale=4, crop=True)
