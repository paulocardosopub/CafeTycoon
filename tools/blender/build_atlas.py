"""Generate the runtime sheet index. Individual source PNGs remain canonical."""
from pathlib import Path
import json
from config.pipeline_config import project_root_from_script

def build_index(project_root: Path):
    manifest_path = project_root / "public/assets/pixel/rendered/asset-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    index = {asset["assetId"]: {"sheet": asset["spriteSheet"], "frameSize": asset["frameSize"], "animations": asset["animations"], "orientations": asset["orientations"]} for asset in manifest["assets"]}
    target = manifest_path.parent / "runtime-index.json"; target.write_text(json.dumps(index, indent=2), encoding="utf-8"); return target

if __name__ == "__main__": print(build_index(project_root_from_script()))
