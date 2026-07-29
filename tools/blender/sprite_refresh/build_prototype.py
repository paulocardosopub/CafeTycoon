"""Blender entry point for building and rendering the complete approval package."""

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from sprite_refresh_pipeline import build_and_render


build_and_render()

