"""Record immutable v001/v002 hashes before production-v003 writes begin."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from production_config import PRODUCTION_OUTPUT_ROOT
from prototype_config import DEFAULT_BLEND, OUTPUT_ROOT
from refinement_config import REFINEMENT_BLEND, REFINEMENT_OUTPUT_ROOT


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def files_under(root: Path):
    return [
        {"path": str(path.relative_to(OUTPUT_ROOT.parents[2])).replace("\\", "/"), "bytes": path.stat().st_size, "sha256": sha256(path)}
        for path in sorted(root.rglob("*")) if path.is_file()
    ]


def main():
    PRODUCTION_OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    data = {
        "v001Blend": {"path": str(DEFAULT_BLEND), "bytes": DEFAULT_BLEND.stat().st_size, "sha256": sha256(DEFAULT_BLEND)},
        "v002Blend": {"path": str(REFINEMENT_BLEND), "bytes": REFINEMENT_BLEND.stat().st_size, "sha256": sha256(REFINEMENT_BLEND)},
        "v001Outputs": files_under(OUTPUT_ROOT),
        "v002Outputs": files_under(REFINEMENT_OUTPUT_ROOT),
    }
    # v001Outputs includes refinement_v002 because it is nested.  Keep the
    # explicit v001-only list separate for meaningful byte-for-byte checks.
    prefix = str(REFINEMENT_OUTPUT_ROOT.relative_to(OUTPUT_ROOT.parents[2])).replace("\\", "/") + "/"
    data["v001Outputs"] = [item for item in data["v001Outputs"] if not item["path"].startswith(prefix)]
    destination = PRODUCTION_OUTPUT_ROOT / "preservation_baseline.json"
    destination.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(destination)


if __name__ == "__main__":
    main()
