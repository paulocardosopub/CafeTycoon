from build_assets import build_all
from config.pipeline_config import project_root_from_script

if __name__ == "__main__": build_all(project_root_from_script(), rebuild_sources=False)
