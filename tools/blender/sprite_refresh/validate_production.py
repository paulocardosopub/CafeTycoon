"""Validate the complete production-v003 staging package and immutable history."""

from __future__ import annotations

import argparse
import hashlib
import json
from itertools import combinations
from pathlib import Path

from PIL import Image

from production_config import (
    ACTIVE_FURNITURE,
    APPROVED_V002_CUSTOMERS,
    CHARACTER_ANCHOR,
    CHARACTER_FRAME_SIZE,
    CUSTOMER_ANIMATIONS,
    DIRECTIONS,
    FURNITURE_ANCHOR,
    FURNITURE_DIRECTIONS,
    FURNITURE_FRAME_SIZE,
    NEW_CUSTOMERS,
    PRODUCTION_BLEND,
    PRODUCTION_OUTPUT_ROOT,
    STAFF_PROFESSIONS,
    animation_manifest_for_staff,
    furniture_anchor_for_footprint,
    iter_furniture_render_assets,
    runtime_customer_id,
    runtime_staff_id,
)
from prototype_config import PROJECT_ROOT


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def image_contract(path: Path, size: tuple[int, int]) -> tuple[bool, str]:
    if not path.exists():
        return False, f"ausente: {path.relative_to(PROJECT_ROOT)}"
    try:
        with Image.open(path) as image:
            if image.mode != "RGBA":
                return False, f"modo {image.mode}, esperado RGBA: {path.name}"
            if image.size != size:
                return False, f"dimensão {image.size}, esperada {size}: {path.name}"
            alpha = image.getchannel("A").getextrema()
            if alpha[0] != 0 or alpha[1] == 0:
                return False, f"canal alfa sem transparência útil: {path.name}"
    except Exception as exc:
        return False, f"PNG inválido {path.name}: {exc}"
    return True, ""


def difference_hash(path: Path) -> int:
    with Image.open(path) as image:
        gray = image.convert("RGBA")
        background = Image.new("RGBA", gray.size, (237, 228, 202, 255))
        background.alpha_composite(gray)
    pixels = list(background.convert("L").resize((9, 8), Image.Resampling.LANCZOS).get_flattened_data())
    result = 0
    for row in range(8):
        for column in range(8):
            result = (result << 1) | int(pixels[row * 9 + column] > pixels[row * 9 + column + 1])
    return result


def expected_character_sources():
    for spec in (*APPROVED_V002_CUSTOMERS, *NEW_CUSTOMERS):
        asset_id = runtime_customer_id(spec)
        for animation, count in CUSTOMER_ANIMATIONS.items():
            for direction in DIRECTIONS:
                for frame in range(count):
                    yield PRODUCTION_OUTPUT_ROOT / "sprites" / "characters" / asset_id / animation / direction / f"{frame:03d}.png"
    for spec in STAFF_PROFESSIONS:
        asset_id = runtime_staff_id(spec)
        for animation, count in animation_manifest_for_staff(spec).items():
            for direction in DIRECTIONS:
                for frame in range(count):
                    yield PRODUCTION_OUTPUT_ROOT / "sprites" / "characters" / asset_id / animation / direction / f"{frame:03d}.png"


def expected_furniture_sources():
    for definition, _level, _connection, _layer, asset_id in iter_furniture_render_assets():
        for state in definition["states"]:
            for direction in FURNITURE_DIRECTIONS:
                yield PRODUCTION_OUTPUT_ROOT / "sprites" / "furniture" / asset_id / state / f"{direction}.png"


def verify_preservation(results: list[dict]):
    baseline_path = PRODUCTION_OUTPUT_ROOT / "preservation_baseline.json"
    if not baseline_path.exists():
        results.append({"name": "Preservação v001/v002", "ok": False, "detail": "baseline ausente"})
        return
    baseline = json.loads(baseline_path.read_text(encoding="utf-8"))
    failures = []
    for key in ("v001Blend", "v002Blend"):
        record = baseline[key]
        path = Path(record["path"])
        if not path.exists() or path.stat().st_size != record["bytes"] or sha256(path) != record["sha256"]:
            failures.append(record["path"])
    for key in ("v001Outputs", "v002Outputs"):
        for record in baseline[key]:
            path = PROJECT_ROOT / record["path"]
            if not path.exists() or path.stat().st_size != record["bytes"] or sha256(path) != record["sha256"]:
                failures.append(record["path"])
    results.append({
        "name": "Preservação byte a byte v001/v002",
        "ok": not failures,
        "detail": f"{2 + len(baseline['v001Outputs']) + len(baseline['v002Outputs'])} arquivos verificados" if not failures else f"alterados/ausentes: {', '.join(failures[:8])}",
    })


def validate(require_runtime: bool = False) -> dict:
    results: list[dict] = []
    add = lambda name, ok, detail: results.append({"name": name, "ok": bool(ok), "detail": detail})

    customer_signatures = {
        (item["presentation"], item["age"], item["hair"], item["face"], item["body"], item["outfit"], tuple(item["accessories"]))
        for item in NEW_CUSTOMERS
    }
    add("30 novos clientes", len(NEW_CUSTOMERS) == 30 and len(customer_signatures) == 30, f"{len(NEW_CUSTOMERS)} registros; {len(customer_signatures)} assinaturas modulares")
    staff_ids = [runtime_staff_id(item) for item in STAFF_PROFESSIONS]
    add("12 profissões canônicas", len(STAFF_PROFESSIONS) == 12 and len(set(staff_ids)) == 12, f"{len(STAFF_PROFESSIONS)} profissões; {len(set(staff_ids))} assets")
    furniture_assets = list(iter_furniture_render_assets())
    add("15 móveis × cinco níveis", len(ACTIVE_FURNITURE) == 15 and len(furniture_assets) == 100, f"{len(ACTIVE_FURNITURE)} definições; {len(furniture_assets)} folhas")
    add("Cena Blender editável", PRODUCTION_BLEND.exists() and PRODUCTION_BLEND.stat().st_size > 100_000, f"{PRODUCTION_BLEND.stat().st_size if PRODUCTION_BLEND.exists() else 0} bytes")
    verify_preservation(results)

    manifest_path = PRODUCTION_OUTPUT_ROOT / "production_manifest.json"
    manifest_ok = False
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        furniture_manifest = manifest.get("furniture", [])
        anchors_ok = all(
            item.get("anchor") == list(furniture_anchor_for_footprint(item.get("footprint", [1, 1])))
            for item in furniture_manifest
        )
        manifest_ok = (
            manifest.get("contract", {}).get("characterFrame") == list(CHARACTER_FRAME_SIZE)
            and manifest.get("contract", {}).get("feetAnchor") == list(CHARACTER_ANCHOR)
            and manifest.get("contract", {}).get("furnitureFrame") == list(FURNITURE_FRAME_SIZE)
            and manifest.get("contract", {}).get("furnitureAnchors", {}).get("1x1") == list(furniture_anchor_for_footprint((1, 1)))
            and manifest.get("contract", {}).get("furnitureAnchors", {}).get("2x1") == list(furniture_anchor_for_footprint((2, 1)))
            and len(manifest.get("customers", [])) == 30
            and len(manifest.get("staff", [])) == 12
            and len(furniture_manifest) == 100
            and anchors_ok
        )
    add("Manifesto estrutural", manifest_ok, "contratos, pivôs, direções e matriz de produção")
    blender_validation_path = PRODUCTION_OUTPUT_ROOT / "blender_structural_validation.json"
    blender_validation = json.loads(blender_validation_path.read_text(encoding="utf-8")) if blender_validation_path.exists() else {"ok": False, "checks": []}
    add("Estrutura interna da cena Blender", blender_validation.get("ok", False), f"{sum(1 for item in blender_validation.get('checks', []) if item.get('ok'))}/{len(blender_validation.get('checks', []))} verificações")

    character_paths = list(expected_character_sources())
    furniture_paths = list(expected_furniture_sources())
    character_existing = [path for path in character_paths if path.exists()]
    furniture_existing = [path for path in furniture_paths if path.exists()]
    character_contract_failures = [detail for path in character_existing if not (contract := image_contract(path, CHARACTER_FRAME_SIZE))[0] for detail in [contract[1]]]
    furniture_contract_failures = [detail for path in furniture_existing if not (contract := image_contract(path, FURNITURE_FRAME_SIZE))[0] for detail in [contract[1]]]
    add("PNGs individuais de personagens", len(character_paths) == 14_664 and len(character_existing) == 14_664 and not character_contract_failures, f"{len(character_existing)}/{len(character_paths)} RGBA 112×168")
    add("PNGs individuais de móveis", len(furniture_paths) == 1_120 and len(furniture_existing) == 1_120 and not furniture_contract_failures, f"{len(furniture_existing)}/{len(furniture_paths)} RGBA 192×192")
    clipping = []
    for path in (*character_existing, *furniture_existing):
        with Image.open(path) as image:
            box = image.getchannel("A").getbbox()
            if not box or box[0] <= 0 or box[1] <= 0 or box[2] >= image.width or box[3] >= image.height:
                clipping.append(str(path.relative_to(PRODUCTION_OUTPUT_ROOT)).replace("\\", "/"))
    add("Conteúdo sem corte no canvas", not clipping and len(character_existing) + len(furniture_existing) == 15_784, f"cortes/bordas tocadas: {len(clipping)}")
    tile_contact_failures = []
    tile_contact_checks = 0
    for definition, _level, _connection, _layer, asset_id in furniture_assets:
        if definition["component"] == "chair":
            continue
        anchor_y = round(furniture_anchor_for_footprint(definition["footprint"])[1] * FURNITURE_FRAME_SIZE[1])
        for state in definition["states"]:
            for direction in FURNITURE_DIRECTIONS:
                path = PRODUCTION_OUTPUT_ROOT / "sprites" / "furniture" / asset_id / state / f"{direction}.png"
                if not path.exists():
                    tile_contact_failures.append(f"{asset_id}:{state}:{direction}:ausente")
                    continue
                with Image.open(path) as image:
                    box = image.getchannel("A").getbbox()
                bottom = box[3] - 1 if box else -1
                tile_contact_checks += 1
                if abs(bottom - anchor_y) > 3:
                    tile_contact_failures.append(f"{asset_id}:{state}:{direction}:{bottom}/{anchor_y}")
    add("Contato visual dos balcões com o tile por footprint", not tile_contact_failures and tile_contact_checks == 1_060, f"{tile_contact_checks - len(tile_contact_failures)}/1.060; falhas {len(tile_contact_failures)}")
    projection_failures = []
    projection_checks = 0
    max_projection_delta = 0
    service = next(item for item in ACTIVE_FURNITURE if item["slug"] == "c1_service")
    pastry = next(item for item in ACTIVE_FURNITURE if item["slug"] == "b8_pastry")
    for level in range(1, 6):
        left_id = f"v003_{service['slug']}_left_l{level}"
        right_id = f"v003_{service['slug']}_right_l{level}"
        pastry_id = f"v003_{pastry['slug']}_l{level}"
        for direction in FURNITURE_DIRECTIONS:
            vector = (32, 16) if direction in {"sw", "ne"} else (-32, 16)
            paths = (
                PRODUCTION_OUTPUT_ROOT / "sprites" / "furniture" / left_id / "idle" / f"{direction}.png",
                PRODUCTION_OUTPUT_ROOT / "sprites" / "furniture" / right_id / "idle" / f"{direction}.png",
                PRODUCTION_OUTPUT_ROOT / "sprites" / "furniture" / pastry_id / "off" / f"{direction}.png",
            )
            if not all(path.exists() for path in paths):
                projection_failures.append(f"L{level}:{direction}:ausente")
                continue
            boxes = []
            for path, multiplier in zip(paths[:2], (-.5, .5)):
                with Image.open(path) as image:
                    box = image.getchannel("A").getbbox()
                if box:
                    dx = round(vector[0] * multiplier)
                    dy = round(vector[1] * multiplier)
                    boxes.append((box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy))
            with Image.open(paths[2]) as image:
                reference = image.getchannel("A").getbbox()
            projection_checks += 1
            if len(boxes) != 2 or not reference:
                projection_failures.append(f"L{level}:{direction}:vazio")
                continue
            combined = (
                min(box[0] for box in boxes), min(box[1] for box in boxes),
                max(box[2] for box in boxes), max(box[3] for box in boxes),
            )
            delta = max(abs(actual - expected) for actual, expected in zip(combined, reference))
            max_projection_delta = max(max_projection_delta, delta)
            if delta > 1:
                projection_failures.append(f"L{level}:{direction}:{combined}/{reference}")
    add("Continuidade projetada entre módulos 1×1", not projection_failures and projection_checks == 20, f"{projection_checks - len(projection_failures)}/20; desvio máximo {max_projection_delta} px")
    expected_foot_bottom = {"sw": 160, "nw": 156, "ne": 156, "se": 160}
    foot_failures = []
    all_character_specs = (*APPROVED_V002_CUSTOMERS, *NEW_CUSTOMERS, *STAFF_PROFESSIONS)
    for spec in all_character_specs:
        asset_id = runtime_staff_id(spec) if "professionId" in spec else runtime_customer_id(spec)
        for direction, expected in expected_foot_bottom.items():
            path = PRODUCTION_OUTPUT_ROOT / "sprites" / "characters" / asset_id / "idle" / direction / "000.png"
            if not path.exists():
                foot_failures.append(f"{asset_id}:{direction}:ausente")
                continue
            with Image.open(path) as image:
                box = image.getchannel("A").getbbox()
                actual = box[3] - 1 if box else -1
            if actual != expected:
                foot_failures.append(f"{asset_id}:{direction}:{actual}")
    add("Linha dos pés idêntica à v002", not foot_failures, f"{len(all_character_specs) * 4 - len(foot_failures)}/{len(all_character_specs) * 4}; falhas {len(foot_failures)}")
    individual_manifest_path = PRODUCTION_OUTPUT_ROOT / "individual_manifest.json"
    individual_count = 0
    if individual_manifest_path.exists():
        individual_count = json.loads(individual_manifest_path.read_text(encoding="utf-8")).get("count", 0)
    add("Manifesto dos arquivos individuais", individual_count == 15_784, f"{individual_count}/15.784 registros com hash")

    atlas_manifest_path = PRODUCTION_OUTPUT_ROOT / "atlas_manifest.json"
    atlas_failures = []
    atlas_count = 0
    if atlas_manifest_path.exists():
        atlas_manifest = json.loads(atlas_manifest_path.read_text(encoding="utf-8"))
        atlas_count = atlas_manifest.get("count", 0)
        for relative in atlas_manifest.get("atlases", []):
            path = PRODUCTION_OUTPUT_ROOT / relative
            if not path.exists():
                atlas_failures.append(f"ausente: {relative}")
                continue
            with Image.open(path) as image:
                if image.mode != "RGBA" or image.getchannel("A").getextrema()[0] != 0:
                    atlas_failures.append(f"RGBA/transparência inválida: {relative}")
    add("146 atlases de runtime", atlas_count == 146 and not atlas_failures, f"{atlas_count}/146; falhas {len(atlas_failures)}")

    similarity = []
    idle_paths = [(runtime_customer_id(spec), PRODUCTION_OUTPUT_ROOT / "sprites" / "characters" / runtime_customer_id(spec) / "idle" / "sw" / "000.png") for spec in NEW_CUSTOMERS]
    if all(path.exists() for _, path in idle_paths):
        hashes = {asset_id: difference_hash(path) for asset_id, path in idle_paths}
        raw_hashes = {asset_id: sha256(path) for asset_id, path in idle_paths}
        for left, right in combinations(hashes, 2):
            similarity.append({"left": left, "right": right, "distance": (hashes[left] ^ hashes[right]).bit_count(), "exact": raw_hashes[left] == raw_hashes[right]})
        similarity.sort(key=lambda item: (item["distance"], item["left"], item["right"]))
    duplicates = [item for item in similarity if item["exact"]]
    add("Diferença visual dos clientes", len(similarity) == 435 and not duplicates, f"435 pares; distância mínima {similarity[0]['distance'] if similarity else 'n/d'}; duplicatas exatas {len(duplicates)}")
    (PRODUCTION_OUTPUT_ROOT / "similarity_report.json").write_text(json.dumps({"method": "64-bit difference hash over SW idle frame", "pairs": similarity}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    runtime_manifest = PRODUCTION_OUTPUT_ROOT / "runtime_integration_manifest.json"
    runtime_ok = runtime_manifest.exists()
    runtime_detail = "integração ainda não exigida"
    if runtime_ok:
        integrated = json.loads(runtime_manifest.read_text(encoding="utf-8"))
        # Runtime paths start at /assets; public is their document root.
        missing = [item["runtimePath"] for item in integrated.get("files", []) if not (PROJECT_ROOT / "public" / item["runtimePath"].removeprefix("/")).exists()]
        runtime_ok = len(integrated.get("files", [])) == 292 and not missing
        runtime_detail = f"{len(integrated.get('files', []))}/292 arquivos publicados; ausentes {len(missing)}"
    add("Integração pública", runtime_ok if require_runtime else (runtime_ok or not runtime_manifest.exists()), runtime_detail)

    report = {
        "version": "v003",
        "passed": sum(1 for item in results if item["ok"]),
        "failed": sum(1 for item in results if not item["ok"]),
        "ok": all(item["ok"] for item in results),
        "results": results,
        "expectedCounts": {"newCustomers": 30, "professions": 12, "activeFurniture": 15, "furnitureAtlases": 100, "allAtlases": 146, "individualPngs": 15_784},
    }
    (PRODUCTION_OUTPUT_ROOT / "production_validation_results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# Validação da produção v003", "", f"Resultado: **{report['passed']} aprovados / {report['failed']} reprovados**", "", "| Verificação | Resultado | Evidência |", "|---|---:|---|"]
    for item in results:
        lines.append(f"| {item['name']} | {'APROVADO' if item['ok'] else 'REPROVADO'} | {item['detail']} |")
    lines.extend(["", f"Total esperado de PNGs individuais: **15.784** ({len(character_paths)} personagens + {len(furniture_paths)} móveis).", ""])
    (PRODUCTION_OUTPUT_ROOT / "PRODUCTION_VALIDATION_RESULTS.md").write_text("\n".join(lines), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-runtime", action="store_true")
    args = parser.parse_args()
    report = validate(args.require_runtime)
    print(f"PRODUCTION_VALIDATION={report['passed']}/{len(report['results'])}")
    if not report["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
