import bpy

MARKERS = ("origin", "feetAnchor", "footprintOrigin", "interactionPoint", "frontDirection", "platePosition", "carriedItemAnchor", "shadowOrigin")

def add_markers(asset_id, collection, equipment=False, counter=False):
    names = list(MARKERS)
    if equipment: names += ["workPoint", "ingredientPoint", "outputPoint"]
    if counter: names += ["kitchenDropPoint", "servicePickupPoint", "plateSlot"]
    marker_collection = bpy.data.collections.new(f"{asset_id}:markers")
    collection.children.link(marker_collection)
    for index, name in enumerate(dict.fromkeys(names)):
        marker = bpy.data.objects.new(f"{asset_id}:{name}", None)
        marker.empty_display_type = "ARROWS" if "Direction" in name else "SPHERE"
        marker.empty_display_size = .06
        marker.location = (0, -.45 if "interaction" in name.lower() or "Point" in name else 0, 0 if name not in ("platePosition", "carriedItemAnchor") else 1.05)
        marker.hide_render = True
        marker["technicalMarker"] = True
        marker_collection.objects.link(marker)
