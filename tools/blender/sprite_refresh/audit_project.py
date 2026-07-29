"""Generate the read-only sprite-refresh audit from the current game sources.

This script deliberately parses the repository instead of importing the game so it
can run before Blender and without changing the build.  Its outputs live only in
the isolated prototype folder.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "art" / "prototypes" / "sprite_refresh"


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def field(source: str, name: str, default=None):
    match = re.search(rf"\b{re.escape(name)}:\s*'([^']*)'", source)
    return match.group(1) if match else default


def numeric_field(source: str, name: str, default=None):
    match = re.search(rf"\b{re.escape(name)}:\s*([0-9.]+)", source)
    if not match:
        return default
    value = float(match.group(1))
    return int(value) if value.is_integer() else value


def parse_furniture():
    source = read("src/game/data/furniture/catalog.ts")
    entries = []
    for line in source.splitlines():
        if not re.match(r"\s*definition\(\{", line):
            continue
        category = field(line, "category")
        height = field(line, "heightCategory")
        if height is None:
            height = "LOW" if category in {"tables", "chairs", "decoration"} else "TALL" if category in {"refrigeration", "storage"} else "STANDARD_COUNTER"
        entries.append({
            "id": field(line, "id"),
            "code": field(line, "code"),
            "name": field(line, "name"),
            "category": category,
            "assetId": field(line, "assetId"),
            "footprint": [numeric_field(line, "width", 1), numeric_field(line, "depth", 1)],
            "heightCategory": height,
            "visualScale": numeric_field(line, "visualScale", 1),
            "pivot": [0, 0, 0],
            "anchor": [0.5, 174 / 192],
            "directions": ["sw", "se", "ne", "nw"],
            "frontDirection": "sw",
            "functionId": field(line, "functionId"),
            "blenderSource": field(line, "source", "assets/blender/equipment/kitchen_equipment.blend"),
        })
    return entries


def parse_staff():
    source = read("src/game/data/staff.ts")
    entries = []
    for line in source.splitlines():
        if not re.match(r"\s*staff\(\{", line):
            continue
        role = field(line, "role")
        entries.append({
            "id": field(line, "id"),
            "actorId": field(line, "actorId"),
            "name": field(line, "name"),
            "role": role,
            "profession": field(line, "primaryProfession", {
                "cook": "Cozinha", "waiter": "Atendimento", "cleaner": "Limpeza", "stocker": "Estoque",
            }.get(role, role)),
            "specialties": re.findall(r"specialties:\s*\[([^]]*)\]", line),
            "compatibleStationId": field(line, "compatibleStationId", "prep"),
        })
    return entries


def parse_base_characters():
    source = read("src/assets/pixel/c3brManifest.ts")
    marker = "export const C3_BR_CHARACTER_ASSETS = "
    start = source.index(marker) + len(marker)
    end = source.index(" as C3BrRenderedAsset[];", start)
    return json.loads(source[start:end])


def build_inventory():
    furniture = parse_furniture()
    staff = parse_staff()
    base_characters = parse_base_characters()
    base_customers = [item for item in base_characters if item.get("role") == "customer"]
    customer_ids = [item["assetId"] for item in base_customers]
    customer_ids += [f"char_variant_customer_{index:02d}" for index in range(1, 17)]
    customer_ids += ["char_player_male_01"]
    base_character_ids = [item["assetId"] for item in base_characters]
    character_variant_ids = [
        "char_staff_cook_hat_white_01", "char_staff_service_chef_01",
        "char_staff_cleaner_chef_01", "char_staff_stocker_chef_01",
        *[f"char_variant_customer_{index:02d}" for index in range(1, 17)],
    ]
    return {
        "generatedFrom": {
            "furniture": "src/game/data/furniture/catalog.ts",
            "staff": "src/game/data/staff.ts",
            "characters": [
                "src/assets/pixel/c3brManifest.ts",
                "src/assets/pixel/stage2cCharacterManifest.ts",
                "src/assets/pixel/characterVariantManifest.ts",
                "src/content/characters/playerSkins.ts",
            ],
            "runtime": ["src/scenes/RestaurantScene.ts", "src/assets/pixel/runtimeRenderedAssets.ts"],
        },
        "grid": {
            "logicalCell": [1, 1],
            "isoTilePixels": [64, 32],
            "gridToWorld": {"x": "(gridX-gridY)*32", "y": "(gridX+gridY)*16+16"},
            "blenderUnitPerLogicalCell": 1,
        },
        "gameCamera": {
            "kind": "Phaser 2D camera over a fixed 2:1 isometric projection",
            "perspective": False,
            "worldRotationDegrees": 0,
            "zoomLevels": [0.5, 1, 2],
            "defaultZoom": 1,
            "blenderEquivalent": {
                "projection": "orthographic",
                "azimuthDegrees": 45,
                "elevationDegrees": 35.264389682754654,
                "rotationRule": "camera fixed; asset rotates in exact 90 degree steps",
            },
        },
        "spriteContracts": {
            "activeCharacter": {
                "frame": [112, 168], "feetAnchor": [56, 158], "nativeScale": 0.72,
                "directions": ["sw", "nw", "ne", "se"], "filter": "nearest",
            },
            "legacyCharacter": {
                "frame": [96, 144], "feetAnchor": [48, 136],
                "directions": ["ne", "nw", "se", "sw"], "filter": "nearest",
            },
            "world": {
                "frame": [192, 192], "serviceCounterFrame": [256, 192],
                "catalogAnchor": [0.5, 174 / 192], "manifestFloorAnchor": [0.5, 178 / 192],
                "filter": "nearest",
            },
        },
        "depth": {
            "formula": "round((x+y)*100+x+layer)",
            "layers": {"chairBack": 20, "furnitureBase": 30, "seatedCharacter": 34, "chairFront": 38, "counterItem": 44, "standingCharacter": 50, "status": 98},
            "furniturePoint": "center of rotated footprint",
            "characterPoint": "logical feet/navigation point",
        },
        "runtimeAnimationContract": {
            "activeShared": {"idle": 4, "walk": 8, "turn": 6, "pickup": 6, "place": 6},
            "player": {"carry_plate_idle": 4, "carry_plate_walk": 8, "carry_tray_idle": 4, "carry_tray_walk": 8, "carry_ingredient_idle": 4, "carry_ingredient_walk": 8, "prep_counter": 8, "cook_stove": 8, "wash_sink": 8, "serve_table": 6, "clear_table": 6, "clean_table": 8, "talk": 6},
            "cook": {"carry_plate_idle": 4, "carry_plate_walk": 8, "carry_ingredient_idle": 4, "carry_ingredient_walk": 8, "prep_counter": 8, "cook_stove": 8, "wash_sink": 8, "place_dish": 6, "wait_workstation": 4},
            "waiter": {"carry_plate_idle": 4, "carry_plate_walk": 8, "carry_tray_idle": 4, "carry_tray_walk": 8, "pickup_dish": 6, "serve_table": 6, "clear_table": 6, "clean_table": 8, "wait_service": 4},
            "customer": {"sit_down": 6, "seated_idle": 4, "wait_food": 4, "eat": 8, "drink": 8, "react_happy": 6, "react_impatient": 6, "stand_up": 6},
            "stationStates": ["free", "reserved", "in_use", "waiting_worker", "complete", "blocked", "no_ingredients"],
            "renderedStationFrameMapping": {"free_or_other": 0, "in_use": [1, 2], "complete": 3},
        },
        "furniture": furniture,
        "staff": staff,
        "characters": {
            "base": base_character_ids,
            "variants": character_variant_ids,
            "runtimeCustomerVisualIds": customer_ids,
            "runtimeCustomerVisualCount": len(customer_ids),
            "customerEntityCatalog": None,
        },
        "counts": {
            "furnitureDefinitions": len(furniture),
            "staffDefinitions": len(staff),
            "baseCharacterAssets": len(base_character_ids),
            "characterVariantAssets": len(character_variant_ids),
            "runtimeCustomerVisualIds": len(customer_ids),
        },
        "divergences": [
            "STRUCTURAL_GRID_FIX.md describes A1 stove and B5 sink as 2x1, but the current catalog declares both as 1x1.",
            "The legacy visual contract is 96x144 at feet (48,136); active Stage 2C assets are 112x168 at feet (56,158) and nativeScale 0.72.",
            "The legacy direction order is NE/NW/SE/SW; active Stage 2C row order is SW/NW/NE/SE.",
            "Furniture catalog baseAnchor is y=174/192 while the existing production Blender manifest normalization line is y=178/192.",
            "Legacy walk uses 6 frames, active Stage 2C uses 8, while the approval prototype explicitly requests 4 frames.",
            "Exact counter-mounted equipment currently exposes only one idle frame, so runtime active frame requests clamp to idle for those sheets.",
            "setup_camera.py and c3_br_v007.py label the camera inclination as 35.264 degrees, but their stored camera locations/targets do not mathematically reproduce that elevation exactly.",
            "The furniture source manifest contains historical assets not present in the canonical 32-item gameplay catalog; the catalog remains the production scope source of truth.",
        ],
    }


def markdown_table(headers, rows):
    lines = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    lines.extend("| " + " | ".join(str(cell).replace("|", "\\|") for cell in row) + " |" for row in rows)
    return "\n".join(lines)


def build_report(inventory):
    furniture_rows = [
        [item["code"], item["id"], item["name"], item["category"], "×".join(map(str, item["footprint"])), item["heightCategory"], item["assetId"]]
        for item in inventory["furniture"]
    ]
    staff_rows = [[item["id"], item["name"], item["role"], item["profession"], item["compatibleStationId"]] for item in inventory["staff"]]
    divergence_rows = [[index, item] for index, item in enumerate(inventory["divergences"], 1)]
    return f"""# Auditoria do protótipo de sprites — Cafe Tycoon

Gerada a partir do código atual, antes da modelagem. Nenhum asset, save, mecânica ou carregamento do jogo foi alterado.

## Estado do repositório e ferramentas

- Não existe `AGENTS.md` no repositório.
- Mudanças pré-existentes preservadas: `artifacts/bistro-bloom-0.0.9.tgz` e `artifacts/recipe-balance-0.0.10.csv` (ambas não rastreadas).
- Blender verificado: 5.2.0 LTS em `C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe`.
- Referências recebidas: duas pranchas PNG de caminhada com bandeja e gesto de trabalho. São somente direção visual; não serão incorporadas aos renders.

## Grid, projeção e câmera

- Célula lógica: 1×1 unidade de grid.
- Tile isométrico: 64×32 pixels; um passo de X projeta (+32,+16) e um passo de Y projeta (-32,+16).
- Não existe PPU 3D no Phaser: as unidades de mundo são pixels 2D. Para Blender, o protótipo fixa 1 unidade Blender = 1 célula lógica.
- Câmera do jogo: câmera 2D sem perspectiva nem rotação, sobre projeção isométrica fixa 2:1.
- Zooms: 0,5×, 1× e 2×; padrão 1×.
- Equivalente Blender exato: ortográfica, azimute 45°, elevação 35,2643897°, câmera fixa e assets rotacionados em passos de 90°.

## Resolução, pivôs e âncoras

- Contrato ativo de personagem: célula 112×168, pés em (56,158), escala nativa 0,72, nearest-neighbor.
- Contrato legado ainda testado: 96×144, pés em (48,136).
- Sprites de mundo: 192×192; o catálogo aplica origem normalizada (0,5; 174/192).
- O manifesto Blender de produção existente registra a linha de piso em 178/192; a divergência de 4 px está listada abaixo.
- Pivô 3D adotado: centro da base do asset em (0,0,0); personagem com os dois pés na mesma linha z=0.
- Profundidade: `round((x+y)*100+x+layer)`, usando centro do footprint para móveis e ponto dos pés para personagens.

## Ordem das direções

- Ordem de linhas realmente usada pelos personagens ativos Stage 2C: **SW, NW, NE, SE**.
- Ordem de rotação do catálogo de móveis: **SW, SE, NE, NW**.
- O manifesto legado lista **NE, NW, SE, SW**. O runtime resolve a linha por manifesto de cada asset, portanto o protótipo registra explicitamente sua ordem em vez de depender de índice implícito.

## Catálogo canônico de móveis ({inventory['counts']['furnitureDefinitions']})

{markdown_table(['Código', 'ID', 'Nome', 'Categoria', 'Footprint', 'Altura', 'Asset'], furniture_rows)}

## Catálogo canônico de funcionários ({inventory['counts']['staffDefinitions']})

{markdown_table(['ID', 'Nome', 'Role', 'Profissão', 'Estação compatível'], staff_rows)}

O código contém: Barista, Atendimento/Garçom, Limpeza, Forneiro, Chapeiro, Chef de Sopas, Chef Oriental, Assador, Cozinheiro Geral, Fritureiro, Confeiteiro e Sushiman. O tipo `stocker` existe, mas não há uma definição canônica de estoquista no `STAFF_CATALOG` atual.

## Personagens e clientes atuais

- 10 personagens-base no manifesto C3-BR: 2 jogadores, 1 cozinheira, 1 garçom e 6 clientes.
- 20 variações de paleta: 4 aliases de função e 16 clientes.
- O runtime de clientes percorre 23 IDs visuais: 6 clientes-base, 16 variações e `char_player_male_01` como fallback adicional.
- Não existe catálogo de entidades de cliente com nomes/IDs próprios; o estado usa um índice numérico `variant`.
- `PLAYER_SKINS` também expõe vários assets de função/cliente como escolhas visuais. Isso não equivale aos cinco presets modulares solicitados para a reformulação.

## Animações e estados consumidos

- Compartilhadas ativas: idle 4, walk 8, turn 6, pickup 6 e place 6.
- Jogador: carregar prato/bandeja/ingrediente (idle e walk), preparar, cozinhar, lavar, servir, retirar, limpar e falar.
- Cozinha: carregar prato/ingrediente, preparar, cozinhar, lavar, colocar prato e aguardar estação.
- Atendimento: carregar prato/bandeja, retirar prato, servir, retirar mesa, limpar e aguardar serviço.
- Cliente: sentar, sentado, aguardar comida, comer, beber, reagir, levantar.
- Estados lógicos de estação: free, reserved, in_use, waiting_worker, complete, blocked e no_ingredients.
- Mapeamento visual de estação quando há quadros: idle/off=0, in_use=1/2, complete=3.

## Divergências encontradas

{markdown_table(['#', 'Divergência'], divergence_rows)}

## Escopo depois da aprovação

Será necessário produzir, sem alterar footprints: os 32 móveis canônicos e seus quatro ângulos; estados realmente úteis dos equipamentos; os 13 funcionários canônicos; o conjunto completo de clientes definido para a nova direção; cinco presets de jogador e o sistema modular; além de todas as animações ativas por função. Antes da integração, será preciso decidir qual contrato de célula/âncora será consolidado e converter os ciclos de aprovação de 4 quadros para os 8 quadros consumidos pelos personagens ativos, ou alterar o contrato numa etapa separada e explicitamente aprovada.
"""


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    inventory = build_inventory()
    (OUT / "current_assets_manifest.json").write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "AUDIT_REPORT.md").write_text(build_report(inventory), encoding="utf-8")
    status = subprocess.run(["git", "status", "--short"], cwd=ROOT, check=True, capture_output=True, text=True).stdout
    (OUT / "audit_git_status.txt").write_text(status, encoding="utf-8")
    print(json.dumps(inventory["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()
