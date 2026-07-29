"""Create the requested four-direction tray GIF from v002 renders."""

from __future__ import annotations

import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import make_previews as previews
from refinement_config import REFINEMENT_OUTPUT_ROOT


def main():
    previews.OUTPUT_ROOT = REFINEMENT_OUTPUT_ROOT
    frames = [previews.composite_frame("walk_tray", frame) for frame in range(4)]
    output = REFINEMENT_OUTPUT_ROOT / "previews" / "walk_tray_4_directions.gif"
    previews.write_gif(output, frames)
    print(f"GIF walk_tray v002: {frames[0][0]}x{frames[0][1]}")


if __name__ == "__main__":
    main()
