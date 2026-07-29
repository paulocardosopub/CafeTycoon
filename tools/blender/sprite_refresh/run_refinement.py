"""One-command regeneration of the approved character refinement v002."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from prototype_config import PROJECT_ROOT
from refinement_config import BASELINE_BLEND, REFINEMENT_BLEND, REFINEMENT_PREVIEW


SCRIPT_DIR = Path(__file__).resolve().parent


def blender_path():
    explicit = os.environ.get("BLENDER_EXE")
    candidates = [
        Path(explicit) if explicit else None,
        Path(shutil.which("blender")) if shutil.which("blender") else None,
        Path(r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"),
    ]
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate
    raise SystemExit("Blender 5.2 não encontrado; defina BLENDER_EXE.")


def run(command, environment=None):
    print(" ".join(str(item) for item in command))
    subprocess.run([str(item) for item in command], cwd=PROJECT_ROOT, env=environment, check=True)


def main():
    blender = blender_path()
    run([blender, "--background", BASELINE_BLEND, "--python-exit-code", "1", "--python", SCRIPT_DIR / "snapshot_refinement_baseline.py"])
    environment = os.environ.copy()
    environment.pop("SPRITE_REFRESH_REFINEMENT_FAST", None)
    environment["BLENDER_CODEX_BLEND_PATH"] = str(REFINEMENT_BLEND)
    environment["BLENDER_CODEX_PREVIEW_PATH"] = str(REFINEMENT_PREVIEW)
    run([blender, "--background", "--factory-startup", "--python-exit-code", "1", "--python", SCRIPT_DIR / "build_refinement.py"], environment)
    run([blender, "--background", REFINEMENT_BLEND, "--python-exit-code", "1", "--python", SCRIPT_DIR / "render_refinement_boards.py"])
    run([sys.executable, SCRIPT_DIR / "make_refinement_previews.py"])
    run([blender, "--background", REFINEMENT_BLEND, "--python-exit-code", "1", "--python", SCRIPT_DIR / "validate_refinement.py"])
    print(f"Refinamento pronto: {REFINEMENT_PREVIEW}")


if __name__ == "__main__":
    main()

