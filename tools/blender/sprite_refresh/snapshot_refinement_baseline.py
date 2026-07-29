"""Capture the approved v001 invariants before building the refined characters."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

import sprite_refresh_pipeline as base  # noqa: E402
from prototype_config import ACTIVE_DIRECTIONS, FEET_ANCHOR, FRAME_SIZE, PLAYER_PRESETS  # noqa: E402
from refinement_config import BASELINE_BLEND, BASELINE_OUTPUT_ROOT, BASELINE_SNAPSHOT  # noqa: E402


DEFORM_BONES = (
    "pelvis", "torso", "head",
    "thigh.L", "shin.L", "thigh.R", "shin.R",
    "upper_arm.L", "forearm.L", "upper_arm.R", "forearm.R",
)
LEG_BONES = ("thigh.L", "shin.L", "thigh.R", "shin.R")


def rounded(values):
    return [round(float(value), 8) for value in values]


def pose_signature(animation, bones):
    asset_id = PLAYER_PRESETS[0]["id"]
    rig = base.ASSET_RIGS[asset_id]
    result = []
    for frame in range(4):
        base.pose_character(asset_id, animation, frame)
        result.append({
            name: {
                "rotation": rounded(rig.pose.bones[name].rotation_euler),
                "location": rounded(rig.pose.bones[name].location),
            }
            for name in bones
        })
    return result


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    if Path(bpy.data.filepath).resolve() != BASELINE_BLEND.resolve():
        bpy.ops.wm.open_mainfile(filepath=str(BASELINE_BLEND), load_ui=False)
    base.bind_scene_assets()
    scene = bpy.context.scene
    camera = bpy.data.objects["SpriteRefresh_MasterCamera"]
    player_root = bpy.data.objects[f"{PLAYER_PRESETS[0]['id']}:root"]
    snapshot = {
        "version": "v001-approved",
        "blend": str(BASELINE_BLEND.relative_to(BASELINE_BLEND.parents[3])).replace("\\", "/"),
        "blendSha256": sha256(BASELINE_BLEND),
        "camera": {
            "type": camera.data.type,
            "location": rounded(camera.location),
            "rotation": rounded(camera.rotation_euler),
            "orthoScale": round(float(camera.data.ortho_scale), 8),
            "azimuthDegrees": float(camera["azimuthDegrees"]),
            "elevationDegrees": float(camera["elevationDegrees"]),
        },
        "render": {
            "frameSize": list(FRAME_SIZE),
            "feetAnchor": list(FEET_ANCHOR),
            "directions": list(ACTIVE_DIRECTIONS),
            "filterSize": float(scene.render.filter_size),
        },
        "player": {
            "rootLocation": rounded(player_root.location),
            "gameplayHeight": float(player_root["gameplayHeight"]),
            "sharedSkeleton": base.ASSET_RIGS[PLAYER_PRESETS[0]["id"]].data.name,
        },
        "poseSignatures": {
            "walk": pose_signature("walk", DEFORM_BONES),
            "cook": pose_signature("cook", DEFORM_BONES),
            "walkTrayLegs": pose_signature("walk_tray", LEG_BONES),
        },
        "approvedRenders": {
            "playerPresets": str((BASELINE_OUTPUT_ROOT / "approval_player_presets.png").resolve()),
            "walkTrayFrames": {
                direction: [str((BASELINE_OUTPUT_ROOT / "animation_frames" / "walk_tray" / direction / f"{frame:03d}.png").resolve()) for frame in range(4)]
                for direction in ACTIVE_DIRECTIONS
            },
        },
    }
    BASELINE_SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    BASELINE_SNAPSHOT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"BASELINE_SNAPSHOT={BASELINE_SNAPSHOT}")


if __name__ == "__main__":
    main()
