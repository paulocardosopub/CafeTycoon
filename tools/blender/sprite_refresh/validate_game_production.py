"""Run the v003 game checks and record objective results for the final report."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from production_config import PRODUCTION_OUTPUT_ROOT
from prototype_config import PROJECT_ROOT


HISTORICAL_BASELINE = {"passed": 245, "failed": 64}


def run(command: list[str], *, allow_failure: bool = False) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        capture_output=True,
    )
    if result.returncode and not allow_failure:
        print(result.stdout)
        print(result.stderr)
        raise SystemExit(result.returncode)
    return result


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    npm = str(shutil.which("npm.cmd") or shutil.which("npm") or "npm")
    npx = str(shutil.which("npx.cmd") or shutil.which("npx") or "npx")
    targeted_path = PRODUCTION_OUTPUT_ROOT / "vitest_targeted_results.json"
    full_path = PRODUCTION_OUTPUT_ROOT / "vitest_full_results.json"
    PRODUCTION_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    lint = run([npm, "run", "lint"])
    build = run([npm, "run", "build"])
    targeted = run([
        npx, "vitest", "run", "src/tests/sprite-refresh-production-v003.test.ts",
        "--reporter=json", f"--outputFile={targeted_path}",
    ])
    full = run([
        npx, "vitest", "run", "--reporter=json", f"--outputFile={full_path}",
    ], allow_failure=True)

    targeted_json = read_json(targeted_path)
    full_json = read_json(full_path)
    result = {
        "version": "v003",
        "lint": {"ok": lint.returncode == 0},
        "build": {"ok": build.returncode == 0},
        "targeted": {
            "ok": targeted.returncode == 0,
            "passed": targeted_json.get("numPassedTests", 0),
            "failed": targeted_json.get("numFailedTests", 0),
            "total": targeted_json.get("numTotalTests", 0),
        },
        "full": {
            "passed": full_json.get("numPassedTests", 0),
            "failed": full_json.get("numFailedTests", 0),
            "total": full_json.get("numTotalTests", 0),
            "historicalBaseline": HISTORICAL_BASELINE,
            "noAdditionalFailures": full_json.get("numFailedTests", 0) <= HISTORICAL_BASELINE["failed"],
        },
    }
    result["ok"] = result["lint"]["ok"] and result["build"]["ok"] and result["targeted"]["ok"] and result["full"]["noAdditionalFailures"]
    output = PRODUCTION_OUTPUT_ROOT / "game_validation_results.json"
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"GAME_VALIDATION={result['ok']}; full={result['full']['passed']} passed/{result['full']['failed']} failed")
    if not result["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
