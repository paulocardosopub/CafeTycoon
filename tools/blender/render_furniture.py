from pathlib import Path
from build_assets import build_all
from config.pipeline_config import project_root_from_script

def render(project_root: Path, asset_id=None): return build_all(project_root, asset_id, "furniture", False)
if __name__ == "__main__": render(project_root_from_script())
