"""Versioned paths and immutable scope for the character refinement checkpoint."""

from __future__ import annotations

from prototype_config import DEFAULT_BLEND, OUTPUT_ROOT, SOURCE_ROOT


BASELINE_BLEND = DEFAULT_BLEND
BASELINE_OUTPUT_ROOT = OUTPUT_ROOT
REFINEMENT_OUTPUT_ROOT = OUTPUT_ROOT / "refinement_v002"
REFINEMENT_BLEND = SOURCE_ROOT / "cafe_tycoon_sprite_refresh_refinement_v002.blend"
REFINEMENT_PREVIEW = REFINEMENT_OUTPUT_ROOT / "approval_player_presets.png"
BASELINE_SNAPSHOT = REFINEMENT_OUTPUT_ROOT / "baseline_v001.json"

REFINEMENT_VERSION = "v002"
UNCHANGED_ANIMATIONS = ("walk", "cook")
TRAY_ANIMATION = "walk_tray"

