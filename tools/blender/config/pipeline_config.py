"""Single source of truth for Bistrô Bloom Blender assets."""

from pathlib import Path

PALETTE_VERSION = "bistro-bloom-v1"
RENDER_VERSION = "0.0.3-blender-1"
CHARACTER_FRAME = (64, 96)
WORLD_FRAME = (128, 160)
THUMBNAIL_SIZE = (128, 128)
DIRECTIONS = ("ne", "nw", "se", "sw")
ANIMATIONS = {
    "idle": 2, "walk": 6, "carry-dish": 2, "carry-ingredients": 2,
    "work": 4, "cook": 4, "serve": 2, "clean": 4,
    "sit": 2, "seated": 2, "eat": 4, "stand": 2,
}

PALETTE = {
    "cream": (0.94, 0.82, 0.62, 1), "white": (1.0, 0.95, 0.82, 1),
    "wood": (0.44, 0.26, 0.16, 1), "wood_light": (0.76, 0.46, 0.25, 1),
    "terracotta": (0.70, 0.25, 0.16, 1), "sage": (0.35, 0.52, 0.30, 1),
    "sage_dark": (0.12, 0.27, 0.19, 1), "steel": (0.38, 0.43, 0.44, 1),
    "steel_light": (0.72, 0.76, 0.74, 1), "blue": (0.20, 0.42, 0.50, 1),
    "gold": (0.88, 0.62, 0.20, 1), "outline": (0.055, 0.035, 0.03, 1),
    "skin_light": (0.92, 0.68, 0.52, 1), "skin_mid": (0.68, 0.39, 0.24, 1),
    "skin_dark": (0.27, 0.14, 0.08, 1), "hair_dark": (0.08, 0.05, 0.04, 1),
}

def character(asset_id, category, style, skin, hair, outfit, accessory="none"):
    return {
        "assetId": asset_id, "kind": "character", "category": category, "style": style,
        "skin": skin, "hair": hair, "outfit": outfit, "accessory": accessory,
        "sourceBlend": "assets/blender/characters/characters_base.blend",
        "sourceCollection": asset_id, "visualLevel": 1, "footprint": [1, 1],
        "anchor": [32, 88], "orientations": list(DIRECTIONS), "animations": ANIMATIONS,
        "interactionPoints": [], "frameSize": list(CHARACTER_FRAME),
    }

CHARACTERS = [
    character("player-style-0", "characters/player", "wave-apron", "skin_mid", "hair_dark", "sage", "apron"),
    character("player-style-1", "characters/player", "crop-vest", "skin_light", "wood", "blue", "vest"),
    character("player-style-2", "characters/player", "bun-chef", "skin_dark", "hair_dark", "cream", "chef-hat"),
    character("player-style-3", "characters/player", "curls-casual", "skin_mid", "terracotta", "gold", "scarf"),
    character("customer-0", "characters/customers", "wave-dress", "skin_light", "hair_dark", "blue"),
    character("customer-1", "characters/customers", "crop-jacket", "skin_mid", "wood", "terracotta"),
    character("customer-2", "characters/customers", "bun-shirt", "skin_dark", "hair_dark", "sage"),
    character("customer-3", "characters/customers", "curls-coat", "skin_mid", "terracotta", "gold", "glasses"),
    character("customer-4", "characters/customers", "braid-dress", "skin_light", "wood", "sage_dark"),
    character("customer-5", "characters/customers", "bald-vest", "skin_dark", "hair_dark", "blue", "moustache"),
    character("customer-6", "characters/customers", "ponytail-shirt", "skin_mid", "hair_dark", "terracotta", "bag"),
    character("customer-7", "characters/customers", "curly-jacket", "skin_light", "terracotta", "sage", "hat"),
    character("cook-0", "characters/employees/cooks", "chef-bun", "skin_dark", "hair_dark", "cream", "chef-hat"),
    character("cook-1", "characters/employees/cooks", "chef-crop", "skin_light", "wood", "white", "chef-hat"),
    character("waiter-0", "characters/employees/waiters", "waiter-crop", "skin_light", "hair_dark", "terracotta", "tray"),
    character("waiter-1", "characters/employees/waiters", "waiter-curls", "skin_dark", "hair_dark", "blue", "tray"),
    character("cleaner-0", "characters/employees/cleaners", "cleaner-curls", "skin_mid", "hair_dark", "sage", "cloth"),
    character("stocker-0", "characters/employees/stockers", "stocker-wave", "skin_light", "wood", "blue", "crate"),
]

def world_asset(asset_id, kind, category, footprint=(1, 1), visual_level=1, family=None):
    source = "assets/blender/furniture/furniture.blend" if kind == "furniture" else "assets/blender/equipment/kitchen_equipment.blend"
    return {
        "assetId": asset_id, "kind": kind, "category": category, "sourceBlend": source,
        "sourceCollection": asset_id, "visualLevel": visual_level, "gameplayLevel": visual_level,
        "equipmentFamilyId": family, "footprint": list(footprint), "anchor": [0.5, 0.85],
        "orientations": list(DIRECTIONS), "animations": {"off": 1, "active": 2, "complete": 1} if kind == "equipment" else {"idle": 1},
        "interactionPoints": [[0, 1]], "frameSize": list(WORLD_FRAME),
        "nextLevelAssetId": f"{family}_level_2" if family else None,
    }

FURNITURE = [
    world_asset("table_two", "furniture", "furniture/tables"), world_asset("table_four", "furniture", "furniture/tables"),
    world_asset("chair", "furniture", "furniture/chairs"), world_asset("pickup_counter", "furniture", "furniture/counters", (6, 1)),
    world_asset("prep_counter", "furniture", "furniture/counters", (2, 1)), world_asset("shelf", "furniture", "furniture/storage"),
    world_asset("storage_cabinet", "furniture", "furniture/storage", (2, 1)), world_asset("bin", "furniture", "furniture/decorations"),
    world_asset("plant", "furniture", "furniture/decorations"),
]

EQUIPMENT = [
    world_asset("stove_level_1", "equipment", "equipment/stoves", (2, 1), family="stove"),
    world_asset("oven_level_1", "equipment", "equipment/ovens", (2, 1), family="oven"),
    world_asset("refrigerator_level_1", "equipment", "equipment/refrigerators", (2, 1), family="refrigerator"),
    world_asset("grill_level_1", "equipment", "equipment/grills", family="grill"),
    world_asset("coffee_machine_level_1", "equipment", "equipment/coffee-machines", family="coffee_machine"),
    world_asset("preparation_level_1", "equipment", "equipment/preparation", (2, 1), family="preparation"),
    world_asset("sink_level_1", "equipment", "equipment/sinks", (2, 1), family="sink"),
    world_asset("cauldron_level_1", "equipment", "equipment/cauldrons", family="cauldron"),
    world_asset("assembly_level_1", "equipment", "equipment/preparation", (2, 1), family="assembly"),
]

ASSETS = CHARACTERS + FURNITURE + EQUIPMENT

def project_root_from_script():
    return Path(__file__).resolve().parents[3]
