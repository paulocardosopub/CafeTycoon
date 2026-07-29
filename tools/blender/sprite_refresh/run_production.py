"""One-command reproducible v003 build, validation, integration, and game checks."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from production_config import PRODUCTION_BLEND, PRODUCTION_OUTPUT_ROOT
from prototype_config import PROJECT_ROOT, SOURCE_ROOT


def run(command, *, env=None):
    print("RUN", " ".join(map(str, command)))
    subprocess.run([str(item) for item in command], cwd=PROJECT_ROOT, env=env, check=True)


def blender_executable():
    configured = os.environ.get("BLENDER_EXE")
    candidates = [
        Path(configured) if configured else None,
        Path(r"C:\Program Files\Blender Foundation\Blender 5.2\blender.exe"),
        Path(r"C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"),
    ]
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate
    discovered = shutil.which("blender")
    if discovered:
        return Path(discovered)
    raise SystemExit("Blender não encontrado. Defina BLENDER_EXE.")


def main():
    baseline = PRODUCTION_OUTPUT_ROOT / "preservation_baseline.json"
    if not baseline.exists():
        run([sys.executable, "tools/blender/sprite_refresh/snapshot_production_baseline.py"])
    env = os.environ.copy()
    env["SPRITE_REFRESH_V003_MODE"] = "full"
    env["BLENDER_CODEX_BLEND_PATH"] = str(PRODUCTION_BLEND)
    env["BLENDER_CODEX_PREVIEW_PATH"] = str(SOURCE_ROOT / "cafe_tycoon_sprite_refresh_production_v003.png")
    entry = PROJECT_ROOT / "work" / "blender" / "sprite-refresh-production-v003" / "entry.py"
    run([blender_executable(), "--background", "--factory-startup", "--python-exit-code", "1", "--python", entry], env=env)
    run([sys.executable, "tools/blender/sprite_refresh/build_production_atlases.py"])
    run([sys.executable, "tools/blender/sprite_refresh/validate_production.py"])
    run([sys.executable, "tools/blender/sprite_refresh/integrate_production_assets.py"])
    run([sys.executable, "tools/blender/sprite_refresh/validate_production.py", "--require-runtime"])
    run([sys.executable, "tools/blender/sprite_refresh/validate_game_production.py"])
    run([sys.executable, "tools/blender/sprite_refresh/write_production_report.py"])
    print("PRODUCTION_V003=READY_FOR_APPROVAL")


if __name__ == "__main__":
    main()
