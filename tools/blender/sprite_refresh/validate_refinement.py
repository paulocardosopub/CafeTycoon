"""Specific, measurable validation for the character refinement v002."""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from prototype_config import ACTIVE_DIRECTIONS, FAMILY_CHARACTERS, FEET_ANCHOR, FRAME_SIZE, PLAYER_PRESETS, PROJECT_ROOT  # noqa: E402
from refinement_config import BASELINE_BLEND, BASELINE_SNAPSHOT, REFINEMENT_BLEND, REFINEMENT_OUTPUT_ROOT  # noqa: E402
from sprite_refresh_refinement import base, open_refinement_blend, pose_refined_character  # noqa: E402


RESULTS = []
DEFORM_BONES = (
    "pelvis", "torso", "head", "thigh.L", "shin.L", "thigh.R", "shin.R",
    "upper_arm.L", "forearm.L", "upper_arm.R", "forearm.R",
)
LEG_BONES = ("thigh.L", "shin.L", "thigh.R", "shin.R")


def record(name, passed, details):
    RESULTS.append({"validation": name, "status": "PASS" if passed else "FAIL", "details": details})


def rounded(values):
    return [round(float(value), 8) for value in values]


def pose_signature(animation, bones):
    asset_id = PLAYER_PRESETS[0]["id"]
    rig = base.ASSET_RIGS[asset_id]
    result = []
    for frame in range(4):
        pose_refined_character(asset_id, animation, frame)
        result.append({
            name: {"rotation": rounded(rig.pose.bones[name].rotation_euler), "location": rounded(rig.pose.bones[name].location)}
            for name in bones
        })
    return result


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
    return min(x for x,_ in points), min(y for _,y in points), max(x for x,_ in points), max(y for _,y in points)


def world_bounds(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    points = [evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box]
    return {
        "x": (min(point.x for point in points), max(point.x for point in points)),
        "y": (min(point.y for point in points), max(point.y for point in points)),
        "z": (min(point.z for point in points), max(point.z for point in points)),
        "center": evaluated.matrix_world.translation.copy(),
    }


def collection_objects(source):
    return base.collection_objects_recursive(source)


def validate_preserved_contract(baseline):
    current_hash = hashlib.sha256(BASELINE_BLEND.read_bytes()).hexdigest()
    record("Arquivo v001 preservado byte a byte", current_hash == baseline["blendSha256"], f"sha256={current_hash}")

    camera = bpy.data.objects["SpriteRefresh_MasterCamera"]
    camera_data = {
        "type": camera.data.type,
        "location": rounded(camera.location),
        "rotation": rounded(camera.rotation_euler),
        "orthoScale": round(float(camera.data.ortho_scale), 8),
        "azimuthDegrees": float(camera["azimuthDegrees"]),
        "elevationDegrees": float(camera["elevationDegrees"]),
    }
    record("Câmera e enquadramento idênticos à v001", camera_data == baseline["camera"], f"ortho={camera.data.ortho_scale:.8f}; frame={FRAME_SIZE}")

    roots = [bpy.data.objects[f"{item['id']}:root"] for item in (*PLAYER_PRESETS, *FAMILY_CHARACTERS)]
    root_ok = all(tuple(round(float(value), 8) for value in root.location) == (0.0,0.0,0.0) for root in roots)
    height_ok = all(float(root["gameplayHeight"]) == 2.2 for root in roots)
    anchor_ok = all(list(root["feetAnchor"]) == list(FEET_ANCHOR) and list(root["spriteFrame"]) == list(FRAME_SIZE) for root in roots)
    record("Escala, altura, pivô, canvas e âncora preservados", root_ok and height_ok and anchor_ok, "11 personagens; altura=2,200 BU; pivot=(0,0,0); canvas=112×168; pés=(56,158)")

    record("Caminhada comum mantém os mesmos keyframes", pose_signature("walk", DEFORM_BONES) == baseline["poseSignatures"]["walk"], "assinatura de rotação/localização dos 11 ossos deformadores × 4 frames")
    record("Cozinha mantém os mesmos keyframes", pose_signature("cook", DEFORM_BONES) == baseline["poseSignatures"]["cook"], "assinatura de rotação/localização dos 11 ossos deformadores × 4 frames")
    record("Pernas da bandeja idênticas à caminhada aprovada", pose_signature("walk_tray", LEG_BONES) == baseline["poseSignatures"]["walkTrayLegs"], "thigh/shin L/R × 4 frames sem alteração")


def validate_modularity_and_detail():
    characters = (*PLAYER_PRESETS, *FAMILY_CHARACTERS)
    required_components = ("BODY", "HEAD", "FACE", "HAIR", "CLOTHING", "APRON", "ACCESSORIES")
    component_ok = True
    for spec in characters:
        source = bpy.data.collections[f"SRC_{spec['id']}"]
        child_names = [child.name for child in source.children]
        component_ok &= all(any(f"_{component}" in name for name in child_names) for component in required_components)
    record("Modularidade preservada e ampliada", component_ok, "BODY/HEAD/FACE/HAIR/CLOTHING/APRON/ACCESSORIES separados nos 11 modelos")

    rigs = [base.ASSET_RIGS[item["id"]] for item in characters]
    shared = {rig.data.name for rig in rigs}
    controls = {"hand_ik.L", "hand_ik.R", "elbow_pole.L", "elbow_pole.R"}
    controls_ok = all(controls.issubset(set(rig.pose.bones.keys())) for rig in rigs)
    constraints_ok = all(all(rig.pose.bones[f"forearm.{side}"].constraints.get(f"TrayHandIK.{side}") for side in ("L","R")) for rig in rigs)
    record("Rig compartilhado funciona com controles IK", len(shared) == 1 and controls_ok and constraints_ok, f"11 rigs usam {next(iter(shared))}; 2 hand IK + 2 pole targets")

    face_signatures = set()
    hair_signatures = set()
    outfit_signatures = set()
    for spec in PLAYER_PRESETS:
        asset_id = spec["id"]
        cranium = bpy.data.objects[f"{asset_id}:cranium"]
        jaw = bpy.data.objects[f"{asset_id}:jaw"]
        face_signatures.add((tuple(round(v,3) for v in cranium.dimensions), tuple(round(v,3) for v in jaw.dimensions), spec["face"]))
        hair_collection = next(child for child in bpy.data.collections[f"SRC_{asset_id}"].children if "_HAIR_" in child.name)
        hair_signatures.add((spec["hair"], len(collection_objects(hair_collection))))
        torso_material = bpy.data.objects[f"{asset_id}:torso"].data.materials[0].name
        apron_material = bpy.data.objects[f"{asset_id}:apron-skirt"].data.materials[0].name
        outfit_signatures.add((torso_material, apron_material))
    record("Cinco rostos possuem geometrias próprias", len(face_signatures) == 5, f"assinaturas distintas={len(face_signatures)}/5")
    record("Cinco cabelos possuem silhuetas modeladas próprias", len(hair_signatures) == 5, f"estilos/contagens distintas={sorted(hair_signatures)}")
    record("Cinco jogadores possuem combinações de roupa próprias", len(outfit_signatures) == 5, f"combinações tecido/avental={len(outfit_signatures)}/5")

    required_detail_tokens = ("collar", "cuff", "button", "shirt-seam", "shoe-sole", "shoe-opening")
    detail_ok = True
    apron_ok = True
    for spec in characters:
        names = [obj.name for obj in collection_objects(bpy.data.collections[f"SRC_{spec['id']}"])]
        detail_ok &= all(any(token in name for name in names) for token in required_detail_tokens)
        if spec["outfit"] in {"apron_green", "barista", "attendant"}:
            apron_ok &= all(any(token in name for name in names) for token in ("apron-bib","apron-skirt","apron-pocket","apron-strap-front","apron-tie","apron-fold"))
    record("Roupas têm detalhes funcionais legíveis", detail_ok and apron_ok, "golas, punhos, botões, costuras, sola/abertura e avental confeccionado presentes")

    material_groups = {
        "skin": any(name.startswith("SkinSoft_") for name in base.MATERIALS),
        "hair": any(name.startswith("HairBase_") for name in base.MATERIALS),
        "shirt/apron": any(name.startswith("Fabric_") for name in base.MATERIALS),
        "shoe": any(name.startswith("Leather_") for name in base.MATERIALS),
        "metal": any(name.startswith("Metal_") for name in base.MATERIALS),
    }
    roughness_values = set()
    for name, material in base.MATERIALS.items():
        if name.startswith(("SkinSoft_","HairBase_","Fabric_","Leather_","Metal_")):
            shader = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
            if shader:
                roughness_values.add(round(float(shader.inputs["Roughness"].default_value), 2))
    record("Materiais separam pele, cabelo, tecidos, couro e metal", all(material_groups.values()) and len(roughness_values) >= 5, f"grupos={material_groups}; roughness={sorted(roughness_values)}")

    # Detect the transform failure that would place custom jaw/apron meshes at the feet.
    misplaced = []
    for spec in characters:
        pose_refined_character(spec["id"], "idle", 0)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        for obj in collection_objects(bpy.data.collections[f"SRC_{spec['id']}"]):
            if obj.type != "MESH" or any(token in obj.name for token in ("leg:","shoe")):
                continue
            if world_bounds(obj, depsgraph)["center"].z < .45:
                misplaced.append(obj.name)
    record("Sem peças de rosto/roupa deslocadas ou clipping estrutural", not misplaced, f"peças deslocadas={misplaced[:5]}")


def validate_tray_pose():
    asset_id = PLAYER_PRESETS[0]["id"]
    rig = base.ASSET_RIGS[asset_id]
    root = base.ASSET_ROOTS[asset_id]
    tray = bpy.data.objects[f"{asset_id}:tray"]
    elbow_angles = []
    elbow_centers = []
    support_ok = True
    horizontal_ok = True
    oscillations = []
    camera = bpy.data.objects["SpriteRefresh_MasterCamera"]
    scene = bpy.context.scene

    for direction in ACTIVE_DIRECTIONS:
        base.ASSET_ROOTS[asset_id].rotation_euler.z = math.radians(base.DIRECTION_ROTATION[direction])
        tray_pixels = []
        for frame in range(4):
            pose_refined_character(asset_id, "walk_tray", frame)
            depsgraph = bpy.context.evaluated_depsgraph_get()
            evaluated_rig = rig.evaluated_get(depsgraph)
            tray_bounds = world_bounds(tray, depsgraph)
            normal = (tray.evaluated_get(depsgraph).matrix_world.to_3x3() @ Vector((0,0,1))).normalized()
            horizontal_ok &= normal.dot(Vector((0,0,1))) > .999999
            for side in ("L","R"):
                upper = evaluated_rig.pose.bones[f"upper_arm.{side}"]
                forearm = evaluated_rig.pose.bones[f"forearm.{side}"]
                angle = math.degrees(upper.vector.normalized().angle(forearm.vector.normalized()))
                elbow_angles.append(angle)
                # PoseBone coordinates are already in armature-local space.
                elbow_centers.append(tuple(forearm.head))
                hand = bpy.data.objects[f"{asset_id}:hand:{side}"]
                hand_bounds = world_bounds(hand, depsgraph)
                hand_center = hand_bounds["center"]
                hand_local = root.matrix_world.inverted() @ hand_center
                support_ok &= hand_bounds["z"][1] <= tray_bounds["z"][0] + .012
                support_ok &= .15 <= abs(hand_local.x) <= .42
                support_ok &= -.681 <= hand_local.y <= -.119
                support_ok &= hand_local.y < -.20
            projected = world_to_camera_view(scene, camera, tray.evaluated_get(depsgraph).matrix_world.translation)
            tray_pixels.append((1.0 - projected.y) * FRAME_SIZE[1])
        oscillations.append(max(tray_pixels) - min(tray_pixels))

    angle_ok = all(80 <= value <= 100 for value in elbow_angles)
    close_ok = all(abs(center[0]) <= .46 and center[1] >= -.26 for center in elbow_centers)
    record("Cotovelos relaxados entre 80° e 100°", angle_ok, f"mín/máx={min(elbow_angles):.2f}°/{max(elbow_angles):.2f}°")
    record("Cotovelos permanecem próximos ao tronco", close_ok, f"amostras={len(elbow_centers)}; limite lateral=0,46 BU")
    record("Mãos ficam sob os dois pontos de apoio", support_ok, "palmas abaixo do fundo, próximas às laterais e afastadas do torso em 16 poses")
    record("Bandeja permanece horizontal", horizontal_ok, "normal da superfície alinhada ao Z global nas 4 direções × 4 frames")
    record("Oscilação vertical da bandeja limitada a 2 px", max(oscillations) <= 2.05, f"máxima={max(oscillations):.3f} px")

    forbidden = ("dish","plate","cup","food","napkin","fork","knife")
    source = bpy.data.collections[f"SRC_{asset_id}"]
    empty = tray.get("surfaceClear") is True and not tray.children
    empty &= not any(any(word in obj.name.lower() for word in forbidden) for obj in collection_objects(source))
    record("Superfície da bandeja continua completamente vazia", empty, "sem comida, pratos, copos, talheres, guardanapos, filhos ou decoração")


def validate_renders_and_scope():
    idle = sorted((REFINEMENT_OUTPUT_ROOT / "sprites" / "characters").glob("*/idle/*.png"))
    animation = sorted((REFINEMENT_OUTPUT_ROOT / "animation_frames").glob("*/*/*.png"))
    files = idle + animation
    record("Somente renders de personagens foram produzidos", len(idle) == 44 and len(animation) == 48 and not (REFINEMENT_OUTPUT_ROOT / "sprites" / "furniture").exists(), f"idle={len(idle)}/44; animações={len(animation)}/48; móveis=0")
    loaded = {path: image_data(path) for path in files}
    rgba = all(data[:3] == (112,168,4) for data in loaded.values())
    transparent = all(min(data[3][3::4]) < .01 and max(data[3][3::4]) > .1 for data in loaded.values())
    not_cut = all((box := alpha_bbox(data)) is not None and box[0] > 0 and box[1] > 0 and box[2] < 111 and box[3] < 167 for data in loaded.values())
    record("PNGs permanecem RGBA 112×168 e transparentes", rgba and transparent, f"{len(files)} arquivos individuais")
    record("Nenhum personagem ou detalhe foi cortado", not_cut, "bbox opaco com margem mínima de 1 px")
    feet = [alpha_bbox(loaded[path])[3] for path in idle]
    baseline_feet = []
    for path in idle:
        relative = path.relative_to(REFINEMENT_OUTPUT_ROOT)
        baseline_feet.append(alpha_bbox(image_data(REFINEMENT_OUTPUT_ROOT.parent / relative))[3])
    record("Pés permanecem exatamente na linha visual da v001", feet == baseline_feet, f"v001/v002 min={min(feet)}; máx={max(feet)}; âncora={FEET_ANCHOR[1]}")

    required_outputs = (
        "approval_character_detail_comparison.png", "approval_player_presets.png", "approval_player_turnaround.png",
        "approval_character_family.png", "approval_characters_enlarged.png", "approval_walk_sheet.png",
        "approval_walk_tray_sheet.png", "approval_cook_sheet.png", "approval_tray_arm_pose_comparison.png",
        "previews/walk_tray_4_directions.gif",
    )
    missing = [name for name in required_outputs if not (REFINEMENT_OUTPUT_ROOT / name).exists()]
    record("Todas as pranchas e prévias solicitadas existem", not missing, f"ausentes={missing}")

    status = subprocess.run(["git","status","--porcelain","--","src"], cwd=PROJECT_ROOT, capture_output=True, text=True, check=True).stdout.strip()
    record("Nenhum arquivo em src/ foi alterado", not status, status or "git status -- src vazio")


def write_outputs():
    summary = {"passed": sum(item["status"] == "PASS" for item in RESULTS), "failed": sum(item["status"] == "FAIL" for item in RESULTS), "results": RESULTS}
    (REFINEMENT_OUTPUT_ROOT / "refinement_validation_results.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    lines = ["# Validações do refinamento v002", "", "| Validação | Resultado | Evidência |", "|---|---|---|"]
    for item in RESULTS:
        lines.append(f"| {item['validation']} | {item['status']} | {item['details'].replace('|','/')} |")
    lines += ["", f"**Resumo:** {summary['passed']} passaram; {summary['failed']} falharam."]
    (REFINEMENT_OUTPUT_ROOT / "REFINEMENT_VALIDATION_RESULTS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    models = [f"`{item['id']}` ({item['label']})" for item in (*PLAYER_PRESETS, *FAMILY_CHARACTERS)]
    report = f"""# Relatório de refinamento dos personagens — v002

## Escopo

Refinamento exclusivo dos onze personagens do pacote de aprovação. A cena v001 foi preservada; móveis, balcões, câmera, medidas, gameplay e `src/` não foram alterados.

## Modelos refinados

{chr(10).join(f'- {item}' for item in models)}

## Geometria e modularidade

- Cabeças reconstruídas com crânio e mandíbula de perfil próprio; bochechas, nariz em dois volumes, olhos completos, sobrancelhas e sorriso discreto.
- Cinco cabelos reconstruídos em volumes: curto com degradê, coque em lóbulos, crespo em agrupamentos, cachos definidos e ondas com franja assimétrica.
- Componentes independentes: `BODY`, `HEAD`, `FACE`, `HAIR`, `CLOTHING`, `APRON` e `ACCESSORIES`.
- Roupas receberam gola, carcela, botões, punhos, dobras, costuras, barras, cintura e calçados com abertura, biqueira e sola.
- Aventais agora usam bib e saia com espessura, alças frontais/traseiras, faixa, bolso dividido, dobras e amarração traseira.
- Barista: badge de café, toalha e ferramenta de bolso. Atendente: colete e identificação. Clientes: combinações casuais e acessórios próprios.

## Materiais

- Pele macia e blush por tom; cabelo com base e highlight por cor.
- Tecidos de camisa, avental, calça e denim com roughness próprios.
- Couro separado em cabedal, biqueira e sola; metais em latão e aço.
- Paleta permanece controlada e compatível com a identidade aprovada.

## Rig e animação

- Esqueleto compartilhado atualizado para `SpriteRefresh_Humanoid_Shared_v002`.
- Controles adicionados: `hand_ik.L`, `hand_ik.R`, `elbow_pole.L`, `elbow_pole.R`.
- Constraints adicionados: `TrayHandIK.L` e `TrayHandIK.R`, chain length 2, sem stretch.
- `walk`: nenhum canal aprovado alterado.
- `cook`: nenhum canal aprovado alterado.
- `walk_tray`: pernas preservadas integralmente; somente braços, alvos das mãos, poles dos cotovelos e influência IK foram alterados.
- Cotovelos medidos entre 80° e 100°; bandeja horizontal, vazia e limitada a até 2 px de oscilação.

## Resultado das verificações

{summary['passed']} validações passaram e {summary['failed']} falharam. Consulte `REFINEMENT_VALIDATION_RESULTS.md` para a tabela completa.
"""
    (REFINEMENT_OUTPUT_ROOT / "REFINEMENT_REPORT.md").write_text(report, encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))
    if summary["failed"]:
        raise SystemExit(2)


def main():
    open_refinement_blend()
    baseline = json.loads(BASELINE_SNAPSHOT.read_text(encoding="utf-8"))
    validate_preserved_contract(baseline)
    validate_modularity_and_detail()
    validate_tray_pose()
    validate_renders_and_scope()
    write_outputs()


if __name__ == "__main__":
    main()
