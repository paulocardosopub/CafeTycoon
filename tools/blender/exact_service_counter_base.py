"""Contract for appliances mounted on the approved service-counter shell."""
from pathlib import Path

import bpy


BASE_ASSET_ID = "c1_service_isolated"
SOURCE_COLLECTION = "ASSET_delivery_counter"
SOURCE_ROOT = "delivery_counter:root"
SOURCE_BLEND = Path("art_source/blender/furniture/c3_br_modular_furniture_v007_2b_1x1.blend")
BASE_PARTS = (
    "delivery_counter:plinth",
    "delivery_counter:body",
    "delivery_counter:trim",
    "delivery_counter:top",
    "delivery_counter:door:0",
    "delivery_counter:door:1",
    "delivery_counter:handle:0",
    "delivery_counter:handle:1",
)


def open_exact_service_counter(project_root: Path, target_asset_id: str):
    """Open the canonical source and relabel its exact shell for one appliance."""
    bpy.ops.wm.open_mainfile(filepath=str(project_root / SOURCE_BLEND), load_ui=False)
    collection = bpy.data.collections.get(SOURCE_COLLECTION)
    root = bpy.data.objects.get(SOURCE_ROOT)
    if collection is None or root is None:
        raise RuntimeError("Approved service-counter source is incomplete")
    missing = [name for name in BASE_PARTS if bpy.data.objects.get(name) is None]
    if missing:
        raise RuntimeError(f"Approved service-counter shell is incomplete: {missing}")
    collection.name = target_asset_id
    collection["counterBaseAssetId"] = BASE_ASSET_ID
    collection["counterBaseMode"] = "exact-copy"
    collection["counterBaseParts"] = list(BASE_PARTS)
    root.name = f"{target_asset_id}:root"
    root["assetId"] = target_asset_id
    root["counterBaseAssetId"] = BASE_ASSET_ID
    return collection, root


def validate_exact_service_counter(collection, expected_base=BASE_ASSET_ID):
    if collection.get("counterBaseAssetId") != expected_base:
        raise RuntimeError(f"Counter base must be the exact {expected_base} shell")
    if collection.get("counterBaseMode") != "exact-copy":
        raise RuntimeError("Counter base was recreated instead of copied")
    missing = [name for name in BASE_PARTS if bpy.data.objects.get(name) is None]
    if missing:
        raise RuntimeError(f"Exact service-counter parts changed or disappeared: {missing}")
    return True
