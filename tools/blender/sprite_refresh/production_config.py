"""Immutable production-v003 catalog built from the live Cafe Tycoon runtime.

The v001/v002 modules remain untouched.  This file is the single source of truth
for the 30 additional customers, canonical profession visuals, and the complete
five-level furniture render matrix.
"""

from __future__ import annotations

from prototype_config import OUTPUT_ROOT, SOURCE_ROOT


PRODUCTION_VERSION = "v003"
PRODUCTION_OUTPUT_ROOT = OUTPUT_ROOT / "production_v003"
PRODUCTION_BLEND = SOURCE_ROOT / "cafe_tycoon_sprite_refresh_production_v003.blend"
PRODUCTION_PREVIEW = PRODUCTION_OUTPUT_ROOT / "approval_customers_30.png"
PRODUCTION_PUBLIC_ROOT = "public/assets/pixel/rendered/production_v003"

CHARACTER_FRAME_SIZE = (112, 168)
CHARACTER_ANCHOR = (56, 158)
FURNITURE_FRAME_SIZE = (192, 192)
FURNITURE_BASE_ANCHOR_Y = 174


def furniture_anchor_for_footprint(footprint):
    """Anchor the lowest footprint vertex, including multi-tile projection depth."""
    width, depth = footprint
    extra_depth_pixels = max(0, width + depth - 2) * 8
    return (.5, (FURNITURE_BASE_ANCHOR_Y + extra_depth_pixels) / FURNITURE_FRAME_SIZE[1])


FURNITURE_ANCHOR = furniture_anchor_for_footprint((1, 1))
DIRECTIONS = ("sw", "nw", "ne", "se")
FURNITURE_DIRECTIONS = ("sw", "se", "ne", "nw")

CUSTOMER_ANIMATIONS = {
    "idle": 4, "walk": 8, "turn": 6, "pickup": 6, "place": 6,
    "sit_down": 6, "seated_idle": 4, "wait_food": 4, "eat": 8,
    "drink": 8, "react_happy": 6, "react_impatient": 6, "stand_up": 6,
}
COOK_ANIMATIONS = {
    "idle": 4, "walk": 8, "turn": 6, "pickup": 6, "place": 6,
    "carry_plate_idle": 4, "carry_plate_walk": 8,
    "carry_ingredient_idle": 4, "carry_ingredient_walk": 8,
    "prep_counter": 8, "cook_stove": 8, "wash_sink": 8,
    "place_dish": 6, "wait_workstation": 4,
}
WAITER_ANIMATIONS = {
    "idle": 4, "walk": 8, "turn": 6, "pickup": 6, "place": 6,
    "carry_plate_idle": 4, "carry_plate_walk": 8,
    "carry_tray_idle": 4, "carry_tray_walk": 8,
    "pickup_dish": 6, "serve_table": 6, "clear_table": 6,
    "clean_table": 8, "wait_service": 4,
}
CLEANER_ANIMATIONS = {
    "idle": 4, "walk": 8, "turn": 6, "pickup": 6, "place": 6,
    "clean_table": 8, "wash_sink": 8, "wait_service": 4,
}

# The four approved v002 customers replace four palette-only legacy variants.
# They therefore preserve the pre-production pool size instead of inflating the
# requested +30 count.
APPROVED_V002_CUSTOMERS = (
    {"id": "customer_approval_01", "runtime_id": "char_variant_customer_01", "label": "Cliente v002 01", "presentation": "female", "age": "older", "skin": "porcelain", "hair": "wave", "base_hair": "wave", "hair_color": "silver", "face": "oval", "base_face": "oval", "body": "average", "outfit": "customer_red", "accessories": ["earrings"]},
    {"id": "customer_approval_02", "runtime_id": "char_variant_customer_02", "label": "Cliente v002 02", "presentation": "male", "age": "young", "skin": "ebony", "hair": "coily", "base_hair": "coily", "hair_color": "midnight", "face": "broad", "base_face": "broad", "body": "athletic", "outfit": "customer_gold", "accessories": ["watch"]},
    {"id": "customer_approval_03", "runtime_id": "char_variant_customer_03", "label": "Cliente v002 03", "presentation": "female", "age": "middle", "skin": "honey", "hair": "curls", "base_hair": "curls", "hair_color": "chestnut", "face": "heart", "base_face": "heart", "body": "curvy", "outfit": "customer_teal", "accessories": ["earrings", "bag"]},
    {"id": "customer_approval_04", "runtime_id": "char_variant_customer_04", "label": "Cliente v002 04", "presentation": "male", "age": "older", "skin": "warm", "hair": "short", "base_hair": "short", "hair_color": "silver", "face": "square", "base_face": "square", "body": "broad", "outfit": "customer_blue", "accessories": ["glasses"]},
)

# Exactly thirty explicit and stable modular signatures.  Differences combine
# silhouette, face, clothing family, body profile, age, and accessories; none is
# a color-only duplicate.
NEW_CUSTOMERS = (
    {"id": "customer_001", "label": "Cliente 001", "presentation": "female", "age": "young", "skin": "porcelain", "hair": "bob", "base_hair": "wave", "hair_color": "copper", "face": "round", "base_face": "oval", "body": "slim", "outfit": "casual_cardigan", "accessories": ["earrings", "watch"]},
    {"id": "customer_002", "label": "Cliente 002", "presentation": "male", "age": "middle", "skin": "warm", "hair": "fade", "base_hair": "short", "hair_color": "espresso", "face": "angular", "base_face": "square", "body": "athletic", "outfit": "urban_jacket", "accessories": ["watch"]},
    {"id": "customer_003", "label": "Cliente 003", "presentation": "female", "age": "middle", "skin": "honey", "hair": "long_wave", "base_hair": "wave", "hair_color": "chestnut", "face": "diamond", "base_face": "heart", "body": "curvy", "outfit": "elegant_blazer", "accessories": ["glasses", "bag"]},
    {"id": "customer_004", "label": "Cliente 004", "presentation": "male", "age": "older", "skin": "cocoa", "hair": "bald", "base_hair": "short", "hair_color": "silver", "face": "broad", "base_face": "broad", "body": "broad", "outfit": "social_vest", "accessories": ["glasses", "moustache"]},
    {"id": "customer_005", "label": "Cliente 005", "presentation": "female", "age": "young", "skin": "ebony", "hair": "braids", "base_hair": "coily", "hair_color": "midnight", "face": "heart", "base_face": "heart", "body": "athletic", "outfit": "sporty", "accessories": ["earrings"]},
    {"id": "customer_006", "label": "Cliente 006", "presentation": "male", "age": "young", "skin": "porcelain", "hair": "messy", "base_hair": "wave", "hair_color": "copper", "face": "long", "base_face": "long", "body": "slim", "outfit": "casual_hoodie", "accessories": ["cap"]},
    {"id": "customer_007", "label": "Cliente 007", "presentation": "female", "age": "older", "skin": "warm", "hair": "low_bun", "base_hair": "bun", "hair_color": "silver", "face": "round", "base_face": "oval", "body": "average", "outfit": "elegant_dress", "accessories": ["glasses", "earrings"]},
    {"id": "customer_008", "label": "Cliente 008", "presentation": "male", "age": "middle", "skin": "honey", "hair": "coily", "base_hair": "coily", "hair_color": "espresso", "face": "square", "base_face": "square", "body": "average", "outfit": "casual_polo", "accessories": ["beard"]},
    {"id": "customer_009", "label": "Cliente 009", "presentation": "female", "age": "young", "skin": "cocoa", "hair": "ponytail", "base_hair": "bun", "hair_color": "midnight", "face": "oval", "base_face": "oval", "body": "slim", "outfit": "urban_jacket", "accessories": ["bag"]},
    {"id": "customer_010", "label": "Cliente 010", "presentation": "male", "age": "older", "skin": "ebony", "hair": "short", "base_hair": "short", "hair_color": "silver", "face": "diamond", "base_face": "long", "body": "broad", "outfit": "elegant_blazer", "accessories": ["glasses", "watch"]},
    {"id": "customer_011", "label": "Cliente 011", "presentation": "female", "age": "middle", "skin": "porcelain", "hair": "curls", "base_hair": "curls", "hair_color": "chestnut", "face": "broad", "base_face": "broad", "body": "curvy", "outfit": "casual_cardigan", "accessories": ["earrings"]},
    {"id": "customer_012", "label": "Cliente 012", "presentation": "male", "age": "young", "skin": "warm", "hair": "locs", "base_hair": "coily", "hair_color": "midnight", "face": "round", "base_face": "oval", "body": "athletic", "outfit": "sporty", "accessories": ["watch"]},
    {"id": "customer_013", "label": "Cliente 013", "presentation": "female", "age": "young", "skin": "honey", "hair": "pixie", "base_hair": "short", "hair_color": "copper", "face": "angular", "base_face": "square", "body": "average", "outfit": "social_vest", "accessories": ["glasses"]},
    {"id": "customer_014", "label": "Cliente 014", "presentation": "male", "age": "middle", "skin": "cocoa", "hair": "wave", "base_hair": "wave", "hair_color": "chestnut", "face": "heart", "base_face": "heart", "body": "slim", "outfit": "casual_hoodie", "accessories": ["beard", "bag"]},
    {"id": "customer_015", "label": "Cliente 015", "presentation": "female", "age": "older", "skin": "ebony", "hair": "short_afro", "base_hair": "coily", "hair_color": "silver", "face": "square", "base_face": "square", "body": "broad", "outfit": "elegant_dress", "accessories": ["earrings", "watch"]},
    {"id": "customer_016", "label": "Cliente 016", "presentation": "male", "age": "young", "skin": "porcelain", "hair": "fade", "base_hair": "short", "hair_color": "midnight", "face": "oval", "base_face": "oval", "body": "athletic", "outfit": "urban_jacket", "accessories": ["cap"]},
    {"id": "customer_017", "label": "Cliente 017", "presentation": "female", "age": "middle", "skin": "warm", "hair": "braid_crown", "base_hair": "bun", "hair_color": "espresso", "face": "diamond", "base_face": "heart", "body": "average", "outfit": "casual_polo", "accessories": ["earrings"]},
    {"id": "customer_018", "label": "Cliente 018", "presentation": "male", "age": "older", "skin": "honey", "hair": "receding", "base_hair": "short", "hair_color": "silver", "face": "long", "base_face": "long", "body": "average", "outfit": "social_vest", "accessories": ["moustache", "glasses"]},
    {"id": "customer_019", "label": "Cliente 019", "presentation": "female", "age": "young", "skin": "cocoa", "hair": "long_straight", "base_hair": "wave", "hair_color": "midnight", "face": "square", "base_face": "square", "body": "slim", "outfit": "sporty", "accessories": ["bag", "watch"]},
    {"id": "customer_020", "label": "Cliente 020", "presentation": "male", "age": "middle", "skin": "ebony", "hair": "short_afro", "base_hair": "coily", "hair_color": "midnight", "face": "angular", "base_face": "square", "body": "broad", "outfit": "elegant_blazer", "accessories": ["beard"]},
    {"id": "customer_021", "label": "Cliente 021", "presentation": "female", "age": "middle", "skin": "porcelain", "hair": "ponytail", "base_hair": "bun", "hair_color": "chestnut", "face": "broad", "base_face": "broad", "body": "athletic", "outfit": "casual_hoodie", "accessories": ["glasses"]},
    {"id": "customer_022", "label": "Cliente 022", "presentation": "male", "age": "young", "skin": "warm", "hair": "messy", "base_hair": "wave", "hair_color": "copper", "face": "diamond", "base_face": "heart", "body": "average", "outfit": "casual_cardigan", "accessories": ["watch"]},
    {"id": "customer_023", "label": "Cliente 023", "presentation": "female", "age": "older", "skin": "honey", "hair": "bob", "base_hair": "wave", "hair_color": "silver", "face": "long", "base_face": "long", "body": "curvy", "outfit": "elegant_blazer", "accessories": ["earrings", "bag"]},
    {"id": "customer_024", "label": "Cliente 024", "presentation": "male", "age": "middle", "skin": "cocoa", "hair": "bald", "base_hair": "short", "hair_color": "espresso", "face": "heart", "base_face": "heart", "body": "athletic", "outfit": "sporty", "accessories": ["beard", "watch"]},
    {"id": "customer_025", "label": "Cliente 025", "presentation": "female", "age": "young", "skin": "ebony", "hair": "locs", "base_hair": "coily", "hair_color": "midnight", "face": "oval", "base_face": "oval", "body": "broad", "outfit": "urban_jacket", "accessories": ["earrings"]},
    {"id": "customer_026", "label": "Cliente 026", "presentation": "male", "age": "older", "skin": "porcelain", "hair": "receding", "base_hair": "short", "hair_color": "silver", "face": "round", "base_face": "oval", "body": "slim", "outfit": "casual_polo", "accessories": ["glasses", "moustache"]},
    {"id": "customer_027", "label": "Cliente 027", "presentation": "female", "age": "middle", "skin": "warm", "hair": "braids", "base_hair": "coily", "hair_color": "chestnut", "face": "angular", "base_face": "square", "body": "average", "outfit": "social_vest", "accessories": ["bag"]},
    {"id": "customer_028", "label": "Cliente 028", "presentation": "male", "age": "young", "skin": "honey", "hair": "long_wave", "base_hair": "wave", "hair_color": "espresso", "face": "broad", "base_face": "broad", "body": "broad", "outfit": "casual_cardigan", "accessories": ["cap"]},
    {"id": "customer_029", "label": "Cliente 029", "presentation": "female", "age": "young", "skin": "cocoa", "hair": "pixie", "base_hair": "short", "hair_color": "copper", "face": "heart", "base_face": "heart", "body": "athletic", "outfit": "elegant_dress", "accessories": ["earrings", "watch"]},
    {"id": "customer_030", "label": "Cliente 030", "presentation": "male", "age": "middle", "skin": "ebony", "hair": "braid_crown", "base_hair": "bun", "hair_color": "midnight", "face": "square", "base_face": "square", "body": "average", "outfit": "elegant_blazer", "accessories": ["glasses", "beard"]},
)

STAFF_PROFESSIONS = (
    {"id": "staff_barista", "professionId": "barista", "label": "Barista", "staffIds": ["cook-0"], "presentation": "female", "skin": "warm", "hair": "bun", "base_hair": "bun", "hair_color": "espresso", "face": "oval", "base_face": "oval", "body": "average", "outfit": "barista", "accessories": ["coffee_badge", "towel"], "animationRole": "cook", "stationIds": ["coffee_machine"]},
    {"id": "staff_service", "professionId": "service", "label": "Atendimento/Garçom", "staffIds": ["waiter-0", "waiter-1"], "presentation": "male", "skin": "cocoa", "hair": "short", "base_hair": "short", "hair_color": "midnight", "face": "long", "base_face": "long", "body": "slim", "outfit": "attendant", "accessories": ["nameplate"], "animationRole": "waiter", "stationIds": ["pickup"]},
    {"id": "staff_cleaner", "professionId": "cleaner", "label": "Auxiliar de limpeza", "staffIds": ["cleaner-0"], "presentation": "female", "skin": "ebony", "hair": "low_bun", "base_hair": "bun", "hair_color": "midnight", "face": "round", "base_face": "oval", "body": "average", "outfit": "cleaner", "accessories": ["utility_pockets", "gloves"], "animationRole": "cleaner", "stationIds": ["sink"]},
    {"id": "staff_oven", "professionId": "oven_specialist", "label": "Forneiro", "staffIds": ["cook-1"], "presentation": "female", "skin": "porcelain", "hair": "cap", "base_hair": "bun", "hair_color": "chestnut", "face": "heart", "base_face": "heart", "body": "average", "outfit": "chef_oven", "accessories": ["thermal_mitt", "cap"], "animationRole": "cook", "stationIds": ["oven"]},
    {"id": "staff_griddle", "professionId": "griddle_specialist", "label": "Chapeiro", "staffIds": ["cook-2"], "presentation": "male", "skin": "warm", "hair": "bandana", "base_hair": "short", "hair_color": "espresso", "face": "square", "base_face": "square", "body": "athletic", "outfit": "chef_griddle", "accessories": ["heat_guard", "bandana"], "animationRole": "cook", "stationIds": ["grill"]},
    {"id": "staff_soup", "professionId": "soup_specialist", "label": "Chef de Sopas", "staffIds": ["cook-3"], "presentation": "female", "skin": "honey", "hair": "cap", "base_hair": "curls", "hair_color": "chestnut", "face": "round", "base_face": "oval", "body": "curvy", "outfit": "chef_soup", "accessories": ["protected_apron", "neck_scarf"], "animationRole": "cook", "stationIds": ["cauldron"]},
    {"id": "staff_oriental", "professionId": "oriental_chef", "label": "Chef Oriental", "staffIds": ["cook-4"], "presentation": "male", "skin": "honey", "hair": "bandana", "base_hair": "short", "hair_color": "midnight", "face": "diamond", "base_face": "heart", "body": "slim", "outfit": "chef_oriental", "accessories": ["cross_collar", "bandana"], "animationRole": "cook", "stationIds": ["stove"]},
    {"id": "staff_grill", "professionId": "grill_specialist", "label": "Assador", "staffIds": ["cook-5"], "presentation": "male", "skin": "cocoa", "hair": "short", "base_hair": "short", "hair_color": "espresso", "face": "broad", "base_face": "broad", "body": "broad", "outfit": "chef_grill", "accessories": ["leather_apron", "heat_guard"], "animationRole": "cook", "stationIds": ["grill"]},
    {"id": "staff_general_cook", "professionId": "general_cook", "label": "Cozinheiro Geral", "staffIds": ["cook-6"], "presentation": "female", "skin": "warm", "hair": "chef_hat", "base_hair": "bun", "hair_color": "espresso", "face": "oval", "base_face": "oval", "body": "average", "outfit": "chef_general", "accessories": ["chef_hat", "neutral_apron"], "animationRole": "cook", "stationIds": ["stove"]},
    {"id": "staff_fryer", "professionId": "fryer_specialist", "label": "Fritureiro", "staffIds": ["cook-7"], "presentation": "female", "skin": "ebony", "hair": "cap", "base_hair": "coily", "hair_color": "midnight", "face": "square", "base_face": "square", "body": "athletic", "outfit": "chef_fryer", "accessories": ["thermal_mitt", "sleeve_guard"], "animationRole": "cook", "stationIds": ["grill"]},
    {"id": "staff_pastry", "professionId": "pastry_chef", "label": "Confeiteiro", "staffIds": ["cook-8"], "presentation": "female", "skin": "porcelain", "hair": "chef_hat", "base_hair": "wave", "hair_color": "copper", "face": "heart", "base_face": "heart", "body": "slim", "outfit": "chef_pastry", "accessories": ["chef_hat", "piping_pockets"], "animationRole": "cook", "stationIds": ["prep"]},
    {"id": "staff_sushi", "professionId": "sushi_chef", "label": "Sushiman", "staffIds": ["cook-9"], "presentation": "male", "skin": "honey", "hair": "bandana", "base_hair": "short", "hair_color": "midnight", "face": "long", "base_face": "long", "body": "average", "outfit": "chef_sushi", "accessories": ["cross_collar", "bandana", "towel"], "animationRole": "cook", "stationIds": ["prep"]},
)

ACTIVE_FURNITURE = (
    {"furnitureId": "cooking.a1.stove", "slug": "a1_stove", "label": "Fogão industrial com fornos", "category": "cooking", "component": "stove", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "cooking.a2.convection", "slug": "a2_convection", "label": "Forno de convecção", "category": "cooking", "component": "oven", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "cooking.a3.griddle", "slug": "a3_griddle", "label": "Chapa industrial", "category": "cooking", "component": "griddle", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "cooking.a4.fryer", "slug": "a4_fryer", "label": "Fritadeira industrial", "category": "cooking", "component": "fryer", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "cooking.a5.kettle", "slug": "a5_kettle", "label": "Caldeira industrial", "category": "cooking", "component": "kettle", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "cooking.a6.grill", "slug": "a6_grill", "label": "Parrilla e defumador", "category": "cooking", "component": "grill", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "cooking.a7.bakery", "slug": "a7_bakery", "label": "Forno de padaria", "category": "cooking", "component": "bakery", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "cooking.a8.coffee", "slug": "a8_coffee", "label": "Máquina de café", "category": "cooking", "component": "coffee", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "preparation.b3.counter", "slug": "b3_preparation", "label": "Bancada de preparação", "category": "preparation", "component": "prep", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "washing.b5.sink", "slug": "b5_sink", "label": "Pia industrial", "category": "washing", "component": "sink", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "preparation.b8.pastry", "slug": "b8_pastry", "label": "Mesa de massas e confeitaria", "category": "preparation", "component": "pastry", "footprint": [2, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "service.c1.isolated", "slug": "c1_service", "label": "Balcão de serviço", "category": "service", "component": "service", "footprint": [1, 1], "states": ["idle"], "connectionVariants": ["isolated", "left", "middle", "right"]},
    {"furnitureId": "service.c9.drinks", "slug": "c9_drinks", "label": "Dispensador de bebidas frias", "category": "service", "component": "drinks", "footprint": [1, 1], "states": ["off", "active_1", "active_2", "complete"]},
    {"furnitureId": "dining.table.basic", "slug": "dining_table", "label": "Mesa robusta", "category": "tables", "component": "table", "footprint": [1, 1], "states": ["idle"]},
    {"furnitureId": "dining.chair.basic", "slug": "dining_chair", "label": "Banco robusto", "category": "chairs", "component": "chair", "footprint": [1, 1], "states": ["idle"], "layers": ["full", "back", "front"]},
)

FURNITURE_LEVELS = {
    1: {"identity": "initial-wood", "counterBase": "COUNTER_BASE_L1"},
    2: {"identity": "contemporary-cafe", "counterBase": "COUNTER_BASE_L2"},
    3: {"identity": "industrial-professional", "counterBase": "COUNTER_BASE_L3"},
    4: {"identity": "premium-modern", "counterBase": "COUNTER_BASE_L4"},
    5: {"identity": "maximum-luxury", "counterBase": "COUNTER_BASE_L5"},
}


def runtime_customer_id(spec):
    return spec.get("runtime_id", f"char_v003_{spec['id']}")


def runtime_staff_id(spec):
    return f"char_v003_{spec['id']}"


def animation_manifest_for_staff(spec):
    return {"cook": COOK_ANIMATIONS, "waiter": WAITER_ANIMATIONS, "cleaner": CLEANER_ANIMATIONS}[spec["animationRole"]]


def furniture_asset_id(definition, level, connection=None, layer=None):
    parts = ["v003", definition["slug"]]
    if connection:
        parts.append(connection)
    parts.append(f"l{level}")
    if layer and layer != "full":
        parts.append(layer)
    return "_".join(parts)


def iter_furniture_render_assets():
    for definition in ACTIVE_FURNITURE:
        connections = definition.get("connectionVariants", [None])
        layers = definition.get("layers", [None])
        for level in range(1, 6):
            for connection in connections:
                for layer in layers:
                    yield definition, level, connection, layer, furniture_asset_id(definition, level, connection, layer)
