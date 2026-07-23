"""Single source of truth for Bistrô Bloom Blender assets."""

from pathlib import Path

PALETTE_VERSION = "bistro-bloom-original-v1"
RENDER_VERSION = "0.0.4-blender-7"
QUALITY_PROFILE = "bistro-bloom-character-bible-v2"
STYLE_REFERENCE = "assets/blender/references/v004-positive-reference.png"
CHARACTER_STYLE_REFERENCE = "assets/blender/references/v004-character-style-bible.png"
CHARACTER_FRAME = (96, 144)
WORLD_FRAME = (192, 192)
WORLD_FLOOR_Y = 178
THUMBNAIL_SIZE = (128, 128)
DIRECTIONS = ("ne", "nw", "se", "sw")
ANIMATIONS = {
    "idle": 2, "walk": 6, "sit-down": 2, "seated-idle": 2,
    "seated-waiting": 2, "seated-eating": 4, "stand-up": 2,
    "carry-plate": 2, "carry-ingredients": 2, "cook": 4,
    "use-appliance": 4, "serve": 2, "clean": 4, "receive-payment": 2,
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

def character(asset_id, category, style, skin, hair, outfit, accessory="none", pants="denim", accent="cream_light", body_profile="average"):
    return {
        "assetId": asset_id, "kind": "character", "category": category, "style": style,
        "skin": skin, "hair": hair, "outfit": outfit, "accessory": accessory, "pants": pants, "accent": accent,
        "identityProfile": f"{asset_id}:{style}:{body_profile}", "bodyProfile": body_profile,
        "sourceBlend": "assets/blender/characters/characters_base.blend",
        "sourceCollection": asset_id, "visualLevel": 1, "footprint": [1, 1],
        "anchor": [48, 136], "orientations": list(DIRECTIONS), "animations": ANIMATIONS,
        "interactionPoints": [], "frameSize": list(CHARACTER_FRAME),
        "qualityProfile": QUALITY_PROFILE, "nativeScale": 1.0, "logicalHeightBlocks": 1.82, "visualSkinId": "character-bloom",
        "visualBounds": {"widthCells": 1.0, "depthCells": 1.0, "heightBlocks": 1.82, "overhangCells": .24},
    }

CHARACTERS = [
    character("player-style-0", "characters/player", "server-wave-apron", "skin_mid", "hair_dark", "blue", "apron", body_profile="player-masculine"),
    character("player-style-1", "characters/player", "server-copper-apron", "skin_light", "terracotta", "blue", "apron", body_profile="player-feminine"),
    character("customer-0", "characters/customers", "green-curls", "skin_mid", "hair_dark", "sage", "earrings", "denim", "cream_light", "average-curvy"),
    character("customer-1", "characters/customers", "blue-beard", "skin_light", "wood", "blue", "beard", "cream_shadow", "cream_light", "broad"),
    character("customer-2", "characters/customers", "orange-senior", "skin_mid", "hair_mid", "terracotta", "earrings", "steel_dark", "cream_light", "short-curvy"),
    character("customer-3", "characters/customers", "cream-crop", "skin_light", "hair_dark", "cream", "none", "steel_dark", "cream_light", "short-slim"),
    character("customer-4", "characters/customers", "gold-wave", "skin_light", "gold", "gold", "none", "denim", "cream_light", "tall-curvy"),
    character("customer-5", "characters/customers", "red-pattern", "skin_dark", "hair_dark", "red_dark", "beard", "denim_dark", "cream_light", "athletic-broad"),
    character("customer-6", "characters/customers", "sage-senior", "skin_light", "white", "sage_light", "glasses", "wood", "cream_light", "average"),
    character("customer-7", "characters/customers", "red-braids", "skin_dark", "hair_dark", "red", "earrings", "steel_dark", "cream_light", "tall-slim"),
    character("cook-0", "characters/employees/cooks", "chef-bun", "skin_dark", "hair_dark", "white", "chef-scarf", "blue_dark", "red"),
    character("cook-1", "characters/employees/cooks", "chef-crop", "skin_light", "wood", "white", "chef-hat", "blue_dark", "red"),
    character("waiter-0", "characters/employees/waiters", "waiter-crop", "skin_light", "hair_dark", "terracotta", "tray"),
    character("waiter-1", "characters/employees/waiters", "waiter-curls", "skin_dark", "hair_dark", "blue", "tray"),
    character("cleaner-0", "characters/employees/cleaners", "cleaner-curls", "skin_mid", "hair_dark", "sage", "cloth"),
    character("stocker-0", "characters/employees/stockers", "stocker-wave", "skin_light", "wood", "blue", "crate"),
]

def world_asset(asset_id, kind, category, footprint=(1, 1), visual_level=1, family=None, frame_size=WORLD_FRAME, skin_id="decor-bloom", layer_role="full"):
    if kind == "equipment" and skin_id == "decor-bloom":
        skin_id = "equipment-steel-level-1"
    source = "assets/blender/furniture/furniture.blend" if kind == "furniture" else "assets/blender/equipment/kitchen_equipment.blend"
    return {
        "assetId": asset_id, "kind": kind, "category": category, "sourceBlend": source,
        "sourceCollection": asset_id, "visualLevel": visual_level, "gameplayLevel": visual_level,
        "equipmentFamilyId": family, "footprint": list(footprint), "anchor": [0.5, WORLD_FLOOR_Y / frame_size[1]],
        "orientations": list(DIRECTIONS), "animations": {"off": 1, "active": 2, "complete": 1} if kind == "equipment" else {"idle": 1},
        "interactionPoints": [[0, 1]], "frameSize": list(frame_size),
        "nextLevelAssetId": f"{family}_level_2" if family else None,
        "qualityProfile": QUALITY_PROFILE, "nativeScale": 1.0, "visualSkinId": skin_id, "layerRole": layer_role,
        "visualBounds": {"widthCells": footprint[0], "depthCells": footprint[1], "heightBlocks": 1.8, "overhangCells": .25},
    }

FURNITURE = [
    world_asset("table_two", "furniture", "furniture/tables", skin_id="table-oak"), world_asset("table_four", "furniture", "furniture/tables", skin_id="table-oak"),
    world_asset("table_two_green", "furniture", "furniture/tables", skin_id="table-green"), world_asset("table_four_green", "furniture", "furniture/tables", skin_id="table-green"),
    *[world_asset(f"chair_{skin}{suffix}", "furniture", "furniture/chairs", skin_id=f"chair-{skin}", layer_role=role)
      for skin in ("wood", "upholstered", "bistro") for suffix, role in (("", "full"), ("_back", "back"), ("_front", "front"))],
    world_asset("pickup_counter", "furniture", "furniture/counters", (6, 1), frame_size=(256, 192), skin_id="counter-oak"),
    world_asset("pickup_counter_green", "furniture", "furniture/counters", (6, 1), frame_size=(256, 192), skin_id="counter-green"),
    world_asset("prep_counter", "furniture", "furniture/counters", (2, 1), skin_id="counter-oak"),
    world_asset("prep_counter_green", "furniture", "furniture/counters", (2, 1), skin_id="counter-green"), world_asset("shelf", "furniture", "furniture/storage"),
    world_asset("storage_cabinet", "furniture", "furniture/storage", (2, 1)), world_asset("bin", "furniture", "furniture/decorations"),
    world_asset("plant", "furniture", "furniture/decorations"),
    *[
        world_asset(asset_id, "furniture", category, footprint, skin_id=skin)
        for asset_id, category, footprint, skin in (
            ("c1_service_isolated", "furniture/service-counters", (1, 1), "counter-green"),
            ("c2_service_left", "furniture/service-counters", (1, 1), "counter-green"),
            ("c3_service_middle", "furniture/service-counters", (1, 1), "counter-green"),
            ("c4_service_right", "furniture/service-counters", (1, 1), "counter-green"),
            ("c5_dry_pantry", "furniture/storage", (1, 1), "storage-green"),
            ("c6_ingredient_shelf", "furniture/storage", (1, 1), "storage-green"),
            ("c7_plate_station", "furniture/support", (1, 1), "counter-green"),
            ("c8_waste_recycling", "furniture/support", (1, 1), "counter-green"),
            ("c9_cold_drinks", "furniture/support", (1, 1), "counter-green"),
            ("c10_cutting_block", "furniture/support", (1, 1), "counter-green"),
        )
    ],
]

EQUIPMENT = [
    world_asset("stove_level_1", "equipment", "equipment/stoves", (1, 1), family="stove", skin_id="equipment-steel-level-1"),
    world_asset("oven_level_1", "equipment", "equipment/ovens", (2, 1), family="oven", skin_id="equipment-steel-level-1"),
    world_asset("refrigerator_level_1", "equipment", "equipment/refrigerators", (2, 1), family="refrigerator", skin_id="equipment-steel-level-1"),
    world_asset("grill_level_1", "equipment", "equipment/grills", family="grill"),
    world_asset("coffee_machine_level_1", "equipment", "equipment/coffee-machines", family="coffee_machine"),
    world_asset("preparation_level_1", "equipment", "equipment/preparation", (2, 1), family="preparation"),
    world_asset("sink_level_1", "equipment", "equipment/sinks", (1, 1), family="sink"),
    world_asset("cauldron_level_1", "equipment", "equipment/cauldrons", family="cauldron"),
    world_asset("assembly_level_1", "equipment", "equipment/preparation", (2, 1), family="assembly"),
    world_asset("a1_stove_industrial", "equipment", "equipment/stoves", (1, 1), family="stove"),
    world_asset("a2_convection_oven", "equipment", "equipment/ovens", family="oven"),
    world_asset("a3_griddle", "equipment", "equipment/griddles", family="grill"),
    world_asset("a4_fryer", "equipment", "equipment/fryers", family="fryer"),
    world_asset("a5_kettle", "equipment", "equipment/kettles", family="cauldron"),
    world_asset("a6_grill", "equipment", "equipment/grills", family="grill"),
    world_asset("a7_bakery_oven", "equipment", "equipment/ovens", family="oven"),
    world_asset("a8_coffee_machine", "equipment", "equipment/coffee-machines", family="coffee_machine"),
    world_asset("b1_industrial_fridge", "equipment", "equipment/refrigerators", family="refrigerator"),
    world_asset("b2_industrial_freezer", "equipment", "equipment/refrigerators", family="refrigerator"),
    world_asset("b3_preparation_counter", "equipment", "equipment/preparation", family="preparation"),
    world_asset("b4_ingredient_station", "equipment", "equipment/preparation", family="preparation"),
    world_asset("b5_industrial_sink", "equipment", "equipment/sinks", family="sink"),
    world_asset("b6_dishwasher", "equipment", "equipment/dishwashers", family="dishwasher"),
    world_asset("b7_double_sink", "equipment", "equipment/sinks", (2, 1), family="sink"),
    world_asset("b8_pastry_table", "equipment", "equipment/preparation", (2, 1), family="preparation"),
]

for _asset in EQUIPMENT:
    if _asset["equipmentFamilyId"] == "refrigerator":
        _asset["animations"] = {"closed": 1, "open": 2, "complete": 1}
    if _asset["assetId"].startswith(("a2_", "a3_", "a4_", "a5_", "a6_", "a7_", "a8_", "b3_", "b4_", "b5_", "b6_", "b7_", "b8_")):
        _asset["animations"] = {"idle": 1}
    if _asset["assetId"] == "a8_coffee_machine":
        _asset["renderVersion"] = "0.0.8-coffee-counter-4"

ASSETS = CHARACTERS + FURNITURE + EQUIPMENT

REFERENCE_SOURCES = {
    **{
        f"chair_{skin}{suffix}": {
            "source": "assets/blender/references/v004-authorized-chairs-tables.png",
            "layout": {
                "kind": "grid", "columns": 4, "rows": 2, "sourceRow": 0,
                # The authored chair board keeps the two upper views in the
                # expected order but stores the two lower views crossed.
                "directionMap": [2, 3, 1, 0], "maxSize": [106, 144], "scale": .72,
            },
        }
        for skin in ("wood", "upholstered", "bistro")
        for suffix in ("", "_back", "_front")
    },
    **{
        asset_id: {
            "source": "assets/blender/references/v004-authorized-chairs-tables.png",
            "layout": {"kind": "grid", "columns": 4, "rows": 2, "sourceRow": 1, "maxSize": [154, 112], "scale": .75},
        }
        for asset_id in ("table_two", "table_four", "table_two_green", "table_four_green")
    },
    **{
        asset_id: {
            "source": "assets/blender/references/v004-authorized-counters.png",
            "layout": {
                "kind": "stack", "rows": 3, "sourceRow": source_row, "maxSize": max_size,
                **({"targetSize": max_size} if asset_id.startswith("pickup_counter") else {}),
            },
        }
        for asset_id, source_row, max_size in (
            ("pickup_counter", 0, [232, 134]), ("pickup_counter_green", 2, [232, 150]),
            ("prep_counter", 1, [172, 146]), ("prep_counter_green", 2, [172, 146]),
        )
    },
    "stove_level_1": {
        "source": "assets/blender/references/stove-reference.png",
        "layout": {"kind": "equipment-grid", "columns": 4, "rows": 2, "maxSize": [180, 170]},
    },
    "refrigerator_level_1": {
        "source": "assets/blender/references/refrigerator-reference.png",
        "layout": {"kind": "equipment-grid", "columns": 4, "rows": 2, "maxSize": [180, 170]},
    },
}

AUTHORIZED_DETAIL_REFERENCES = [
    "assets/blender/references/v004-authorized-stove-detail.png",
    "assets/blender/references/v004-authorized-fridge-detail.png",
    "assets/blender/references/cafe-mania-characters/clientes_grupo_a_4_direcoes.png",
    "assets/blender/references/cafe-mania-characters/clientes_grupo_b_4_direcoes.png",
    "assets/blender/references/cafe-mania-characters/cozinheiros_idle_walk_cook_4_direcoes.png",
    "assets/blender/references/cafe-mania-characters/jogadores_4_direcoes.png",
]

_CHARACTER_REFERENCE_ROOT = "assets/blender/references/cafe-mania-characters"

def character_reference(source, rows, columns, idle_row, column_offset=0, seated_row=None, walk_row=None, action_row=None):
    pose_rows = {"idle": idle_row}
    if seated_row is not None: pose_rows["seated"] = seated_row
    if walk_row is not None: pose_rows["walk"] = walk_row
    if action_row is not None: pose_rows["action"] = action_row
    return {
        "source": f"{_CHARACTER_REFERENCE_ROOT}/{source}",
        "mode": "authorized-character-sheet",
        "layout": {
            "kind": "character-sheet", "rows": rows, "columns": columns,
            "columnOffset": column_offset, "poseRows": pose_rows,
            # Source columns are SE, SW, NW, NE. Runtime rows are NE, NW, SE, SW.
            "directionMap": [3, 2, 0, 1], "maxSize": [84, 128], "floorY": 136,
        },
    }

REFERENCE_SOURCES.update({
    "customer-0": character_reference("clientes_grupo_a_4_direcoes.png", 4, 8, 0, 0, seated_row=1),
    "customer-1": character_reference("clientes_grupo_a_4_direcoes.png", 4, 8, 0, 4, seated_row=1),
    "customer-2": character_reference("clientes_grupo_a_4_direcoes.png", 4, 8, 2, 0, seated_row=3),
    "customer-3": character_reference("clientes_grupo_a_4_direcoes.png", 4, 8, 2, 4, seated_row=3),
    **{
        f"customer-{index + 4}": character_reference(
            "clientes_grupo_b_4_direcoes.png", 8, 4, index * 2, seated_row=index * 2 + 1,
        )
        for index in range(4)
    },
    "cook-0": character_reference("cozinheiros_idle_walk_cook_4_direcoes.png", 6, 4, 0, walk_row=1, action_row=2),
    "cook-1": character_reference("cozinheiros_idle_walk_cook_4_direcoes.png", 6, 4, 3, walk_row=4, action_row=5),
    "player-style-0": character_reference("jogadores_4_direcoes.png", 4, 4, 0, walk_row=1),
    "player-style-1": character_reference("jogadores_4_direcoes.png", 4, 4, 2, walk_row=3),
    "waiter-0": character_reference("jogadores_4_direcoes.png", 4, 4, 0, walk_row=1),
    "waiter-1": character_reference("jogadores_4_direcoes.png", 4, 4, 2, walk_row=3),
    "cleaner-0": character_reference("jogadores_4_direcoes.png", 4, 4, 2, walk_row=3),
    "stocker-0": character_reference("jogadores_4_direcoes.png", 4, 4, 0, walk_row=1),
})

for _asset in ASSETS:
    _reference = REFERENCE_SOURCES.get(_asset["assetId"])
    if _reference:
        _asset["referenceSource"] = _reference["source"]
        _asset["referenceMode"] = _reference.get("mode", "authorized-canonical-chroma-key")
        _asset["referenceLayout"] = _reference["layout"]

def project_root_from_script():
    return Path(__file__).resolve().parents[3]
