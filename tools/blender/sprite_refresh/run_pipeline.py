"""One-command reproducible entry point for the complete approval package."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

from prototype_config import DEFAULT_BLEND, DEFAULT_PREVIEW, PROJECT_ROOT


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
    raise SystemExit("Blender não encontrado. Instale Blender 5.2 LTS ou defina BLENDER_EXE.")


def run(command, env=None):
    print(" ".join(str(item) for item in command))
    subprocess.run([str(item) for item in command], cwd=PROJECT_ROOT, env=env, check=True)


def main():
    blender = blender_path()
    run([sys.executable, SCRIPT_DIR / "audit_project.py"])
    environment = os.environ.copy()
    environment["BLENDER_CODEX_BLEND_PATH"] = str(DEFAULT_BLEND)
    environment["BLENDER_CODEX_PREVIEW_PATH"] = str(DEFAULT_PREVIEW)
    run([blender, "--background", "--factory-startup", "--python-exit-code", "1", "--python", SCRIPT_DIR / "build_prototype.py"], environment)
    run([sys.executable, SCRIPT_DIR / "make_previews.py"])
    run([blender, "--background", DEFAULT_BLEND, "--python-exit-code", "1", "--python", SCRIPT_DIR / "validate_prototype.py"])
    print(f"Pacote pronto: {DEFAULT_PREVIEW}")


if __name__ == "__main__":
    main()

