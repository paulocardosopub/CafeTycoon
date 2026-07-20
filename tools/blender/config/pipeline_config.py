"""Single source of truth for Bistrô Bloom Blender assets."""

from pathlib import Path

PALETTE_VERSION = "bistro-bloom-reference-scene-v5"
RENDER_VERSION = "0.0.3-blender-7"
QUALITY_PROFILE = "reference-scene-v5"
CHARACTER_FRAME = (96, 144)
WORLD_FRAME = (192, 192)
WORLD_FLOOR_Y = 178
THUMBNAIL_SIZE = (128, 128)
DIRECTIONS = ("ne", "nw", "se", "sw")
ANIMATIONS = {
    "idle": 2, "walk": 6, "carry-dish": 2, "carry-ingredients": 2,
    "work": 4, "cook": 4, "serve": 2, "clean": 4,
    "sit": 2, "seated": 2, "eat": 4, "stand": 2,
}

PALETTE = {
    "cream_light": (1.00, 0.96, 0.84, 1), "cream": (0.94, 0.82, 0.62, 1), "cream_shadow": (0.72, 0.57, 0.40, 1),
    "white": (0.98, 0.96, 0.88, 1), "white_shadow": (0.74, 0.76, 0.72, 1),
    "wood_dark": (0.20, 0.10, 0.07, 1), "wood": (0.44, 0.26, 0.16, 1), "wood_mid": (0.60, 0.35, 0.20, 1), "wood_light": (0.76, 0.46, 0.25, 1),
    "terracotta_dark": (0.42, 0.14, 0.10, 1), "terracotta": (0.70, 0.25, 0.16, 1), "terracotta_light": (0.88, 0.42, 0.25, 1),
    "sage": (0.35, 0.52, 0.30, 1), "sage_light": (0.55, 0.66, 0.43, 1), "sage_dark": (0.12, 0.27, 0.19, 1),
    "steel_dark": (0.12, 0.15, 0.17, 1), "steel": (0.34, 0.38, 0.40, 1), "steel_mid": (0.52, 0.56, 0.56, 1), "steel_light": (0.76, 0.79, 0.77, 1), "chrome": (0.90, 0.91, 0.86, 1),
    "blue_dark": (0.08, 0.19, 0.25, 1), "blue": (0.20, 0.42, 0.50, 1), "blue_light": (0.34, 0.57, 0.64, 1),
    "denim_dark": (0.07, 0.19, 0.31, 1), "denim": (0.12, 0.32, 0.51, 1), "denim_light": (0.24, 0.48, 0.67, 1),
    "gold_dark": (0.53, 0.31, 0.04, 1), "gold": (0.88, 0.62, 0.20, 1), "gold_light": (0.98, 0.78, 0.30, 1),
    "red_dark": (0.42, 0.05, 0.03, 1), "red": (0.78, 0.13, 0.06, 1), "orange": (1.00, 0.36, 0.04, 1), "flame_blue": (0.04, 0.45, 0.90, 1),
    "green_dark": (0.10, 0.31, 0.09, 1), "green": (0.27, 0.58, 0.16, 1), "food_red": (0.86, 0.12, 0.05, 1),
    "outline": (0.035, 0.022, 0.02, 1), "outline_soft": (0.12, 0.075, 0.06, 1), "glass": (0.10, 0.22, 0.28, 1),
    "skin_light": (0.92, 0.68, 0.52, 1), "skin_light_shadow": (0.70, 0.43, 0.29, 1),
    "skin_mid": (0.68, 0.39, 0.24, 1), "skin_mid_shadow": (0.46, 0.23, 0.13, 1),
    "skin_dark": (0.34, 0.18, 0.10, 1), "skin_dark_shadow": (0.18, 0.08, 0.04, 1),
    "hair_dark": (0.055, 0.035, 0.03, 1), "hair_mid": (0.18, 0.09, 0.055, 1),
}

def character(asset_id, category, style, skin, hair, outfit, accessory="none", pants="denim", accent="cream_light"):
    return {
        "assetId": asset_id, "kind": "character", "category": category, "style": style,
        "skin": skin, "hair": hair, "outfit": outfit, "accessory": accessory, "pants": pants, "accent": accent,
        "sourceBlend": "assets/blender/characters/characters_base.blend",
        "sourceCollection": asset_id, "visualLevel": 1, "footprint": [1, 1],
        "anchor": [48, 136], "orientations": list(DIRECTIONS), "animations": ANIMATIONS,
        "interactionPoints": [], "frameSize": list(CHARACTER_FRAME),
        "qualityProfile": QUALITY_PROFILE, "nativeScale": 1.0, "logicalHeightBlocks": 1.9,
    }

CHARACTERS = [
    character("player-style-0", "characters/player", "wave-apron", "skin_mid", "hair_dark", "sage", "apron"),
    character("player-style-1", "characters/player", "crop-vest", "skin_light", "wood", "blue", "vest"),
    character("player-style-2", "characters/player", "bun-chef", "skin_dark", "hair_dark", "white", "chef-scarf", "blue_dark", "red"),
    character("player-style-3", "characters/player", "curls-casual", "skin_mid", "terracotta", "gold", "scarf"),
    character("customer-0", "characters/customers", "curly-jacket", "skin_dark", "hair_dark", "gold", "jacket", "denim", "cream_light"),
    character("customer-1", "characters/customers", "crop-jacket", "skin_mid", "wood", "terracotta"),
    character("customer-2", "characters/customers", "bun-shirt", "skin_dark", "hair_dark", "sage"),
    character("customer-3", "characters/customers", "curls-coat", "skin_mid", "terracotta", "gold", "glasses"),
    character("customer-4", "characters/customers", "braid-dress", "skin_light", "wood", "sage_dark"),
    character("customer-5", "characters/customers", "bald-vest", "skin_dark", "hair_dark", "blue", "moustache"),
    character("customer-6", "characters/customers", "ponytail-shirt", "skin_mid", "hair_dark", "terracotta", "bag"),
    character("customer-7", "characters/customers", "curly-jacket", "skin_light", "terracotta", "sage", "hat"),
    character("cook-0", "characters/employees/cooks", "chef-bun", "skin_dark", "hair_dark", "white", "chef-scarf", "blue_dark", "red"),
    character("cook-1", "characters/employees/cooks", "chef-crop", "skin_light", "wood", "white", "chef-hat", "blue_dark", "red"),
    character("waiter-0", "characters/employees/waiters", "waiter-crop", "skin_light", "hair_dark", "terracotta", "tray"),
    character("waiter-1", "characters/employees/waiters", "waiter-curls", "skin_dark", "hair_dark", "blue", "tray"),
    character("cleaner-0", "characters/employees/cleaners", "cleaner-curls", "skin_mid", "hair_dark", "sage", "cloth"),
    character("stocker-0", "characters/employees/stockers", "stocker-wave", "skin_light", "wood", "blue", "crate"),
]

def world_asset(asset_id, kind, category, footprint=(1, 1), visual_level=1, family=None, frame_size=WORLD_FRAME):
    source = "assets/blender/furniture/furniture.blend" if kind == "furniture" else "assets/blender/equipment/kitchen_equipment.blend"
    return {
        "assetId": asset_id, "kind": kind, "category": category, "sourceBlend": source,
        "sourceCollection": asset_id, "visualLevel": visual_level, "gameplayLevel": visual_level,
        "equipmentFamilyId": family, "footprint": list(footprint), "anchor": [0.5, WORLD_FLOOR_Y / frame_size[1]],
        "orientations": list(DIRECTIONS), "animations": {"off": 1, "active": 2, "complete": 1} if kind == "equipment" else {"idle": 1},
        "interactionPoints": [[0, 1]], "frameSize": list(frame_size),
        "nextLevelAssetId": f"{family}_level_2" if family else None,
        "qualityProfile": QUALITY_PROFILE, "nativeScale": 1.0,
    }

FURNITURE = [
    world_asset("table_two", "furniture", "furniture/tables"), world_asset("table_four", "furniture", "furniture/tables"),
    world_asset("chair", "furniture", "furniture/chairs"), world_asset("pickup_counter", "furniture", "furniture/counters", (6, 1), frame_size=(256, 192)),
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

for _asset in EQUIPMENT:
    if _asset["equipmentFamilyId"] == "refrigerator":
        _asset["animations"] = {"closed": 1, "open": 2, "complete": 1}

ASSETS = CHARACTERS + FURNITURE + EQUIPMENT

REFERENCE_SOURCES = {
    "cook-0": "assets/blender/references/cook-reference.png",
    "stove_level_1": "assets/blender/references/stove-reference.png",
    "refrigerator_level_1": "assets/blender/references/refrigerator-reference.png",
    **{f"customer-{index}": "assets/blender/references/customer-reference.png" for index in range(8)},
    **{asset_id: "assets/blender/references/customer-reference.png" for asset_id in (
        "player-style-0", "player-style-1", "player-style-2", "player-style-3",
        "cook-1", "waiter-0", "waiter-1", "cleaner-0", "stocker-0",
    )},
}

for _asset in ASSETS:
    if _asset["assetId"] in REFERENCE_SOURCES:
        _asset["referenceSource"] = REFERENCE_SOURCES[_asset["assetId"]]
        _asset["referenceMode"] = "canonical-chroma-key" if _asset["assetId"] in {
            "cook-0", "customer-0", "stove_level_1", "refrigerator_level_1"
        } else "reference-derived-variant"

def project_root_from_script():
    return Path(__file__).resolve().parents[3]
