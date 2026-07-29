"""Fast re-render for approval boards after framing/annotation adjustments."""

import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from prototype_config import DEFAULT_BLEND, OUTPUT_ROOT
from sprite_refresh_pipeline import bind_scene_assets, compose_board, render_technical_boards, reset_default_scene


if Path(bpy.data.filepath).resolve() != DEFAULT_BLEND.resolve():
    bpy.ops.wm.open_mainfile(filepath=str(DEFAULT_BLEND), load_ui=False)
bind_scene_assets()
active_order = [
    ("counter_stove", "off"), ("counter_stove", "on"),
    ("counter_coffee", "idle"), ("counter_coffee", "active_1"),
    ("counter_sink", "idle"), ("counter_sink", "active"),
    ("counter_fryer", "off"), ("counter_fryer", "on"),
]
paths = [OUTPUT_ROOT / "sprites" / "furniture" / asset / state / "sw.png" for asset, state in active_order]
compose_board(paths, OUTPUT_ROOT / "approval_active_states.png", columns=4, scale=4, margin=30, gap=22, crop=True)
render_technical_boards()
reset_default_scene()
bpy.ops.wm.save_as_mainfile(filepath=str(DEFAULT_BLEND))
