"""Blender entry point for the character refinement v002."""

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from sprite_refresh_refinement import build_and_render_refinement


build_and_render_refinement()
