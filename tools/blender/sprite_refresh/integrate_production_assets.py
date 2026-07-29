"""Publish validated v003 atlases from preparation into the runtime asset tree."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path

from production_config import PRODUCTION_OUTPUT_ROOT
from prototype_config import PROJECT_ROOT


PUBLIC_ROOT = PROJECT_ROOT / "public" / "assets" / "pixel" / "rendered" / "production_v003"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    source_root = PRODUCTION_OUTPUT_ROOT / "atlases"
    validation_path = PRODUCTION_OUTPUT_ROOT / "production_validation_results.json"
    if not validation_path.exists() or not json.loads(validation_path.read_text(encoding="utf-8")).get("ok"):
        raise SystemExit("Integração bloqueada: a preparação v003 ainda não foi aprovada pelo validador.")
    atlas_manifest = json.loads((PRODUCTION_OUTPUT_ROOT / "atlas_manifest.json").read_text(encoding="utf-8"))
    files=[]
    for relative in atlas_manifest["atlases"]:
        source=PRODUCTION_OUTPUT_ROOT/relative
        destination=PUBLIC_ROOT/Path(relative).relative_to("atlases")
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(source,destination)
        files.append({"source":relative,"runtimePath":"/assets/pixel/rendered/production_v003/"+str(destination.relative_to(PUBLIC_ROOT)).replace("\\","/"),"bytes":destination.stat().st_size,"sha256":digest(destination)})
    for source in sorted((source_root/"thumbnails").glob("*.png")):
        destination=PUBLIC_ROOT/"thumbnails"/source.name
        destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,destination)
        files.append({"source":str(source.relative_to(PRODUCTION_OUTPUT_ROOT)).replace("\\","/"),"runtimePath":"/assets/pixel/rendered/production_v003/thumbnails/"+source.name,"bytes":destination.stat().st_size,"sha256":digest(destination)})
    result={"version":"v003","root":"/assets/pixel/rendered/production_v003","files":files,"totalBytes":sum(item["bytes"] for item in files)}
    (PRODUCTION_OUTPUT_ROOT/"runtime_integration_manifest.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(f"INTEGRATED_FILES={len(files)}")
    print(f"INTEGRATED_BYTES={result['totalBytes']}")


if __name__ == "__main__":
    main()
