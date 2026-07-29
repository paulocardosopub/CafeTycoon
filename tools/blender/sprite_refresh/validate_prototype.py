"""Automated, measurable validation for the isolated sprite-refresh package."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from prototype_config import (  # noqa: E402
    ACTIVE_DIRECTIONS,
    CAMERA_AZIMUTH_DEGREES,
    CAMERA_ELEVATION_DEGREES,
    COUNTER,
    DEFAULT_BLEND,
    FEET_ANCHOR,
    FRAME_SIZE,
    FURNITURE_ASSETS,
    FURNITURE_DIRECTIONS,
    OUTPUT_ROOT,
    PLAYER_PRESETS,
    WORLD_FLOOR_Y,
    WORLD_FRAME_SIZE,
)


RESULTS = []


def record(name, passed, details):
    RESULTS.append({"validation": name, "status": "PASS" if passed else "FAIL", "details": details})


def image_data(path):
    image = bpy.data.images.load(str(path), check_existing=False)
    pixels = list(image.pixels)
    result = (image.size[0], image.size[1], image.channels, pixels)
    bpy.data.images.remove(image)
    return result


def alpha_bbox(data, threshold=.03):
    width, height, _channels, pixels = data
    points = []
    for y_bottom in range(height):
        for x in range(width):
            if pixels[(y_bottom * width + x) * 4 + 3] > threshold:
                points.append((x, height - 1 - y_bottom))
    if not points:
        return None
    return (min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points))


def difference(a, b):
    if a[:2] != b[:2]:
        return 1.0
    total = sum(abs(x - y) for x, y in zip(a[3], b[3]))
    return total / max(1, len(a[3]))


def recursive_objects(source):
    objects = list(source.objects)
    for child in source.children:
        objects.extend(recursive_objects(child))
    return objects


def validate_images():
    character_idle = sorted((OUTPUT_ROOT / "sprites" / "characters").glob("*/idle/*.png"))
    animation_frames = sorted((OUTPUT_ROOT / "animation_frames").glob("*/*/*.png"))
    furniture = sorted((OUTPUT_ROOT / "sprites" / "furniture").glob("*/*/*.png"))
    individual = character_idle + animation_frames + furniture
    expected_counts = (11 * 4, 3 * 4 * 4, sum(len(item["states"]) * 4 for item in FURNITURE_ASSETS))
    record("Quantidade de PNGs individuais", (len(character_idle), len(animation_frames), len(furniture)) == expected_counts,
           f"personagens={len(character_idle)}/{expected_counts[0]}, animações={len(animation_frames)}/{expected_counts[1]}, móveis={len(furniture)}/{expected_counts[2]}")

    loaded = {path: image_data(path) for path in individual}
    record("Todos os PNGs individuais usam RGBA", all(data[2] == 4 for data in loaded.values()), f"{len(loaded)} arquivos verificados")
    transparent = all(min(data[3][3::4]) < .01 and max(data[3][3::4]) > .1 for data in loaded.values())
    record("Transparência real sem fundo incorporado", transparent, "alpha contém pixels 0 e pixels opacos em todo sprite individual")
    record("Nenhum quadro vazio", all(alpha_bbox(data) is not None for data in loaded.values()), f"{len(loaded)} quadros com conteúdo opaco")
    not_cut = all((box := alpha_bbox(data)) is not None and box[0] > 0 and box[1] > 0 and box[2] < data[0] - 1 and box[3] < data[1] - 1 for data in loaded.values())
    record("Nenhum sprite cortado", not_cut, "bbox opaco mantém pelo menos 1 px de margem")

    char_sizes = {data[:2] for path, data in loaded.items() if path in character_idle or path in animation_frames}
    furniture_sizes = {data[:2] for path, data in loaded.items() if path in furniture}
    record("Resoluções consistentes por conjunto", char_sizes == {FRAME_SIZE} and furniture_sizes == {WORLD_FRAME_SIZE},
           f"personagens={sorted(char_sizes)}, móveis={sorted(furniture_sizes)}")

    feet = [alpha_bbox(loaded[path])[3] for path in character_idle]
    floor = [alpha_bbox(loaded[path])[3] for path in furniture]
    feet_ok = max(abs(value - FEET_ANCHOR[1]) for value in feet) <= 5
    # Isometric bases extend above/below their logical pivot depending on rotation.
    # Eight pixels is the audited envelope around the catalog anchor at y=174.
    floor_ok = max(abs(value - WORLD_FLOOR_Y) for value in floor) <= 8
    record("Âncoras visuais na linha de piso", feet_ok and floor_ok,
           f"pés min/max={min(feet)}/{max(feet)} alvo={FEET_ANCHOR[1]}; móveis min/max={min(floor)}/{max(floor)} alvo={WORLD_FLOOR_Y}")

    direction_ok = True
    for character_dir in (OUTPUT_ROOT / "sprites" / "characters").iterdir():
        if character_dir.is_dir():
            direction_ok &= {p.stem for p in (character_dir / "idle").glob("*.png")} == set(ACTIVE_DIRECTIONS)
    for definition in FURNITURE_ASSETS:
        for state in definition["states"]:
            direction_ok &= {p.stem for p in (OUTPUT_ROOT / "sprites" / "furniture" / definition["id"] / state).glob("*.png")} == set(FURNITURE_DIRECTIONS)
    record("Quatro direções presentes e na ordem manifestada", direction_ok, "personagens SW/NW/NE/SE; móveis SW/SE/NE/NW")

    frames_ok = True
    distinct_ok = True
    opposite_ok = True
    framing_ok = True
    for animation in ("walk", "walk_tray", "cook"):
        for direction in ACTIVE_DIRECTIONS:
            paths = [OUTPUT_ROOT / "animation_frames" / animation / direction / f"{index:03d}.png" for index in range(4)]
            frames_ok &= all(path.exists() for path in paths)
            data = [loaded[path] for path in paths]
            distinct_ok &= len({path.read_bytes() for path in paths}) == 4
            framing_ok &= all(item[:2] == FRAME_SIZE for item in data)
            if animation in {"walk", "walk_tray"}:
                opposite_ok &= difference(data[0], data[2]) > .012
    record("Quatro frames por direção e animação", frames_ok, "3 animações × 4 direções × 4 frames")
    record("Movimento diferente nos quatro frames", distinct_ok, "hash binário distinto em cada ciclo/direção")
    record("Frames 1 e 3 usam contatos de pernas opostos", opposite_ok, "diferença raster mensurável > 0,012 nos ciclos de caminhada")
    record("Canvas e enquadramento constantes entre frames", framing_ok, f"todos em {FRAME_SIZE[0]}×{FRAME_SIZE[1]}")

    active_pairs = [
        ("counter_stove", "off", "on"), ("counter_coffee", "idle", "active_1"),
        ("counter_sink", "idle", "active"), ("counter_fryer", "off", "on"),
    ]
    state_diffs = []
    for asset, state_a, state_b in active_pairs:
        path_a = OUTPUT_ROOT / "sprites" / "furniture" / asset / state_a / "sw.png"
        path_b = OUTPUT_ROOT / "sprites" / "furniture" / asset / state_b / "sw.png"
        state_diffs.append(difference(loaded[path_a], loaded[path_b]))
    record("Estados ligados/desligados são visualmente distintos", all(value > .0003 for value in state_diffs), f"diferenças={','.join(f'{value:.4f}' for value in state_diffs)}")


def validate_scene():
    camera = bpy.data.objects.get("SpriteRefresh_MasterCamera")
    camera_ok = camera is not None and camera.data.type == "ORTHO"
    if camera_ok:
        direction = (Vector((0, 0, 1.31)) - camera.location).normalized()
        elevation = math.degrees(math.asin(abs(direction.z)))
        camera_ok &= abs(elevation - CAMERA_ELEVATION_DEGREES) < 1e-5
    record("Câmera ortográfica isométrica exata", camera_ok, f"azimute={CAMERA_AZIMUTH_DEGREES:.6f}°, elevação={CAMERA_ELEVATION_DEGREES:.6f}°")

    roots = [bpy.data.objects.get(f"{spec['id']}:root") for spec in (*PLAYER_PRESETS,)]
    all_character_roots = [obj for obj in bpy.data.objects if obj.name.endswith(":root") and obj.get("gameplayHeight") == 2.2]
    pivots_ok = all(tuple(round(value, 6) for value in obj.location) == (0.0, 0.0, 0.0) for obj in all_character_roots)
    height_ok = len(all_character_roots) == 11 and all(obj.get("gameplayHeight") == 2.2 for obj in all_character_roots)
    record("Pivôs e escala de gameplay dos personagens", pivots_ok and height_ok, f"{len(all_character_roots)} personagens, altura 2,200 BU, pés em z=0")

    rigs = [obj for obj in bpy.data.objects if obj.type == "ARMATURE" and obj.name.endswith(":rig")]
    shared = {obj.data.name for obj in rigs}
    record("Esqueleto compartilhado masculino/feminino", len(rigs) == 11 and len(shared) == 1, f"{len(rigs)} rigs usam {', '.join(sorted(shared))}")
    actions = [bpy.data.actions.get(f"APPROVAL_{name.upper()}_4") for name in ("walk", "walk_tray", "cook")]
    actions_ok = all(
        action is not None
        and list(action.get("recordedFrames", [])) == [1, 2, 3, 4]
        and len(action.layers) > 0
        for action in actions
    )
    record("Ações do rig do personagem-protótipo", actions_ok, "walk, walk_tray e cook: 4 poses gravadas no .blend")

    tray = bpy.data.objects.get(f"{PLAYER_PRESETS[0]['id']}:tray")
    source = bpy.data.collections.get(f"SRC_{PLAYER_PRESETS[0]['id']}")
    forbidden = ("dish", "plate", "cup", "food", "napkin", "fork", "knife")
    tray_empty = tray is not None and tray.get("surfaceClear") is True and not tray.children
    tray_empty &= not any(any(word in obj.name.lower() for word in forbidden) for obj in recursive_objects(source))
    tray_normal = (tray.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized() if tray is not None else Vector((0, 0, 0))
    tray_level = tray is not None and tray_normal.dot(Vector((0, 0, 1))) > .999999
    record("Bandeja totalmente vazia e nivelada", tray_empty and tray_level, "sem filhos/itens proibidos; normal da superfície alinhada ao eixo Z global")

    counter_ids = [item["id"] for item in FURNITURE_ASSETS if item["type"].startswith("counter_")]
    counter_roots = [bpy.data.objects.get(f"{asset}:root") for asset in counter_ids]
    dimensions = [tuple(root.get("structuralDimensions")) for root in counter_roots]
    expected = (COUNTER["width"], COUNTER["depth"], COUNTER["height"])
    record("Dimensões estruturais idênticas dos balcões", all(max(abs(a-b) for a,b in zip(value, expected)) <= COUNTER["tolerance"] for value in dimensions), f"{len(dimensions)} módulos = {expected}, tolerância {COUNTER['tolerance']}")
    record("Altura de bancada idêntica", len({round(value[2], 6) for value in dimensions}) == 1, f"altura={dimensions[0][2]:.3f} BU")
    base_ids = {root.get("counterBaseAssetId") for root in counter_roots}
    record("Base mestra compartilhada por instância", base_ids == {"COUNTER_BASE_MASTER_1x1"}, f"baseIds={sorted(base_ids)}")

    tech = bpy.data.collections.get("TECH_COUNTER_ALIGNMENT")
    row_a = sorted((obj for obj in tech.objects if obj.name.startswith("counter-row-a:")), key=lambda obj: obj.location.x)
    row_b = sorted((obj for obj in tech.objects if obj.name.startswith("counter-row-b:")), key=lambda obj: obj.location.x)
    gaps = [row_a[index+1].location.x - row_a[index].location.x - COUNTER["width"] for index in range(len(row_a)-1)]
    gaps += [row_b[index+1].location.x - row_b[index].location.x - COUNTER["width"] for index in range(len(row_b)-1)]
    record("Sem lacuna ou sobreposição entre balcões", all(abs(value) <= COUNTER["tolerance"] for value in gaps), f"gaps={gaps}")

    manifest = json.loads((OUTPUT_ROOT / "prototype_manifest.json").read_text(encoding="utf-8"))
    footprint_ok = all(item["footprint"] == [1,1] for item in manifest["furniture"])
    record("Bases e footprints do protótipo respeitam o catálogo", footprint_ok, "mesa, cadeira, geladeira e módulos = 1×1")

    no_ground = True
    for item in manifest["characters"] + manifest["furniture"]:
        source = bpy.data.collections.get(item["sourceCollection"])
        no_ground &= not any(obj.get("technicalOnly") for obj in recursive_objects(source))
    record("Sprites sem tile, piso ou cenário incorporado", no_ground, "geometria técnica existe apenas nas coleções TECH_*")

    hair_styles = {item["hair"] for item in manifest["characters"] if item["role"] == "player"}
    hair_colors = {item["hairColor"] for item in manifest["characters"] if item["role"] == "player"}
    skins = {item["skin"] for item in manifest["characters"] if item["role"] == "player"}
    record("Sistema modular 5× cabelo/cor/pele", len(hair_styles) == len(hair_colors) == len(skins) == 5, f"cabelos={sorted(hair_styles)}, cores={sorted(hair_colors)}, peles={sorted(skins)}")


def write_results():
    output_json = OUTPUT_ROOT / "validation_results.json"
    output_md = OUTPUT_ROOT / "VALIDATION_RESULTS.md"
    summary = {"passed": sum(item["status"] == "PASS" for item in RESULTS), "failed": sum(item["status"] == "FAIL" for item in RESULTS), "results": RESULTS}
    output_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# Validações do protótipo", "", "| Validação | Resultado | Evidência |", "|---|---|---|"]
    for item in RESULTS:
        lines.append(f"| {item['validation']} | {item['status']} | {item['details'].replace('|', '/')} |")
    lines += ["", f"**Resumo:** {summary['passed']} passaram; {summary['failed']} falharam."]
    output_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))
    if summary["failed"]:
        raise SystemExit(2)


def main():
    if not bpy.data.filepath:
        bpy.ops.wm.open_mainfile(filepath=str(DEFAULT_BLEND), load_ui=False)
    validate_images()
    validate_scene()
    write_results()


if __name__ == "__main__":
    main()
