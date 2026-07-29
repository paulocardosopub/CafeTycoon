"""Immutable approval-prototype contract derived from the current runtime audit."""

from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[3]
OUTPUT_ROOT = PROJECT_ROOT / "art" / "prototypes" / "sprite_refresh"
SOURCE_ROOT = PROJECT_ROOT / "art_source" / "blender" / "sprite_refresh"
DEFAULT_BLEND = SOURCE_ROOT / "cafe_tycoon_sprite_refresh_approval.blend"
DEFAULT_PREVIEW = OUTPUT_ROOT / "approval_player_presets.png"

FRAME_SIZE = (112, 168)
FEET_ANCHOR = (56, 158)
WORLD_FRAME_SIZE = (192, 192)
WORLD_FLOOR_Y = 174
ISO_TILE_PIXELS = (64, 32)
BLENDER_UNITS_PER_TILE = 1.0
CAMERA_AZIMUTH_DEGREES = 45.0
CAMERA_ELEVATION_DEGREES = 35.264389682754654
CHARACTER_ORTHO_SCALE = 2.80
# sqrt(2) * 192 / 64: one 1x1 Blender-unit base projects to the 64px tile width.
WORLD_ORTHO_SCALE = 4.242640687119286
ACTIVE_DIRECTIONS = ("sw", "nw", "ne", "se")
FURNITURE_DIRECTIONS = ("sw", "se", "ne", "nw")
DIRECTION_ROTATION = {"sw": 0.0, "se": 90.0, "ne": 180.0, "nw": 270.0}

COUNTER = {
    "width": 1.0,
    "depth": 1.0,
    "height": 1.10,
    "top_thickness": 0.10,
    "plinth_height": 0.12,
    "pivot": (0.0, 0.0, 0.0),
    "tolerance": 0.001,
}

SKIN_TONES = {
    "porcelain": (0.92, 0.68, 0.52, 1.0),
    "warm": (0.76, 0.49, 0.31, 1.0),
    "honey": (0.64, 0.36, 0.21, 1.0),
    "cocoa": (0.42, 0.22, 0.12, 1.0),
    "ebony": (0.25, 0.115, 0.055, 1.0),
}

HAIR_COLORS = {
    "espresso": (0.055, 0.028, 0.018, 1.0),
    "chestnut": (0.18, 0.075, 0.035, 1.0),
    "copper": (0.42, 0.12, 0.045, 1.0),
    "midnight": (0.022, 0.025, 0.045, 1.0),
    "silver": (0.52, 0.54, 0.56, 1.0),
}

PLAYER_PRESETS = (
    {"id": "player_01_male_short", "label": "Homem · curto castanho", "presentation": "male", "skin": "porcelain", "hair": "short", "hair_color": "chestnut", "face": "square", "body": "average", "outfit": "apron_green"},
    {"id": "player_02_female_bun", "label": "Mulher · coque escuro", "presentation": "female", "skin": "warm", "hair": "bun", "hair_color": "espresso", "face": "oval", "body": "average", "outfit": "apron_green"},
    {"id": "player_03_male_coily", "label": "Homem · crespo curto", "presentation": "male", "skin": "ebony", "hair": "coily", "hair_color": "midnight", "face": "broad", "body": "athletic", "outfit": "apron_green"},
    {"id": "player_04_female_curls", "label": "Mulher · cacheado cobre", "presentation": "female", "skin": "cocoa", "hair": "curls", "hair_color": "copper", "face": "heart", "body": "curvy", "outfit": "apron_green"},
    {"id": "player_05_male_wave", "label": "Homem · ondulado prata", "presentation": "male", "skin": "honey", "hair": "wave", "hair_color": "silver", "face": "long", "body": "slim", "outfit": "apron_green"},
)

FAMILY_CHARACTERS = (
    {"id": "staff_barista_nina", "label": "Barista", "presentation": "female", "skin": "warm", "hair": "bun", "hair_color": "espresso", "face": "oval", "body": "average", "outfit": "barista"},
    {"id": "staff_attendant_caio", "label": "Atendente", "presentation": "male", "skin": "cocoa", "hair": "short", "hair_color": "midnight", "face": "long", "body": "slim", "outfit": "attendant"},
    {"id": "customer_approval_01", "label": "Cliente 1", "presentation": "female", "skin": "porcelain", "hair": "wave", "hair_color": "silver", "face": "oval", "body": "average", "outfit": "customer_red"},
    {"id": "customer_approval_02", "label": "Cliente 2", "presentation": "male", "skin": "ebony", "hair": "coily", "hair_color": "midnight", "face": "broad", "body": "athletic", "outfit": "customer_gold"},
    {"id": "customer_approval_03", "label": "Cliente 3", "presentation": "female", "skin": "honey", "hair": "curls", "hair_color": "chestnut", "face": "heart", "body": "curvy", "outfit": "customer_teal"},
    {"id": "customer_approval_04", "label": "Cliente 4", "presentation": "male", "skin": "warm", "hair": "short", "hair_color": "silver", "face": "square", "body": "broad", "outfit": "customer_blue"},
)

FURNITURE_ASSETS = (
    {"id": "dining_table_basic", "canonicalId": "dining.table.basic", "type": "table", "footprint": [1, 1], "states": ["idle"]},
    {"id": "dining_chair_basic", "canonicalId": "dining.chair.basic", "type": "chair", "footprint": [1, 1], "states": ["idle"]},
    {"id": "industrial_fridge", "canonicalId": "refrigeration.b1.fridge", "type": "fridge", "footprint": [1, 1], "states": ["closed"]},
    {"id": "counter_service", "canonicalId": "service.c1.isolated", "type": "counter_service", "footprint": [1, 1], "states": ["idle"]},
    {"id": "counter_stove", "canonicalId": "cooking.a1.stove", "type": "counter_stove", "footprint": [1, 1], "states": ["off", "on"]},
    {"id": "counter_coffee", "canonicalId": "cooking.a8.coffee", "type": "counter_coffee", "footprint": [1, 1], "states": ["idle", "active_1", "active_2"]},
    {"id": "counter_sink", "canonicalId": "washing.b5.sink", "type": "counter_sink", "footprint": [1, 1], "states": ["idle", "active"]},
    {"id": "counter_fryer", "canonicalId": "cooking.a4.fryer", "type": "counter_fryer", "footprint": [1, 1], "states": ["off", "on"]},
)

ANIMATION_SPECS = {
    "walk": {"frames": 4, "fps": 8, "loop": True, "sheet": "approval_walk_sheet.png"},
    "walk_tray": {"frames": 4, "fps": 8, "loop": True, "sheet": "approval_walk_tray_sheet.png"},
    "cook": {"frames": 4, "fps": 8, "loop": True, "sheet": "approval_cook_sheet.png"},
}
