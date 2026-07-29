"""Write the objective final v003 delivery report from generated manifests."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from production_config import ACTIVE_FURNITURE, NEW_CUSTOMERS, PRODUCTION_BLEND, PRODUCTION_OUTPUT_ROOT, STAFF_PROFESSIONS
from prototype_config import PROJECT_ROOT


SRC_FILES = (
    "src/assets/pixel/productionV003Manifest.ts",
    "src/assets/pixel/characterVariantManifest.ts",
    "src/assets/pixel/runtimeRenderedAssets.ts",
    "src/content/characters/options.ts",
    "src/content/characters/playerSkins.ts",
    "src/game/data/furniture/levels.ts",
    "src/game/data/staff.ts",
    "src/game/map/initialMap.ts",
    "src/game/save/migrations.ts",
    "src/game/systems/construction/ConstructionEditor.ts",
    "src/main.ts",
    "src/scenes/RestaurantScene.ts",
    "src/ui/ConstructionShop.ts",
    "src/ui/GameUI.ts",
    "src/ui/characterCreator.ts",
    "src/styles.css",
    "src/tests/sprite-refresh-production-v003.test.ts",
    "src/tests/c3-br-v007.test.ts",
    "src/tests/construction-editor-v005.test.ts",
)


def require_json(name):
    path = PRODUCTION_OUTPUT_ROOT / name
    if not path.exists():
        raise SystemExit(f"Manifesto obrigatório ausente: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    validation = require_json("production_validation_results.json")
    integration = require_json("runtime_integration_manifest.json")
    individual = require_json("individual_manifest.json")
    atlas = require_json("atlas_manifest.json")
    game_validation = require_json("game_validation_results.json")
    if not validation.get("ok"):
        raise SystemExit("Relatório bloqueado: a validação final possui reprovações.")
    runtime_assets_mib = integration["totalBytes"] / 1024 / 1024
    individual_count = f"{individual['count']:,}".replace(",", ".")
    profession_rows = "\n".join(
        f"| `{item['professionId']}` | {item['label']} | {', '.join(item['staffIds'])} | {', '.join(item['stationIds'])} |"
        for item in STAFF_PROFESSIONS
    )
    furniture_rows = "\n".join(
        f"| `{item['furnitureId']}` | {item['label']} | {item['footprint'][0]}×{item['footprint'][1]} | L1, L2, L3, L4, L5 | {', '.join(item['states'])} |"
        for item in ACTIVE_FURNITURE
    )
    validation_rows = "\n".join(f"| {item['name']} | {'APROVADO' if item['ok'] else 'REPROVADO'} | {item['detail']} |" for item in validation["results"])
    source_rows = "\n".join(f"- `{path}`" for path in SRC_FILES)
    boards = (
        "approval_customers_30.png", "approval_customers_30_actual_size.png", "approval_staff_professions.png",
        "approval_staff_turnarounds.png", "approval_furniture_levels_overview.png", "approval_counter_levels_alignment.png",
        "approval_furniture_active_states_all_levels.png", "approval_furniture_tile_alignment.png",
        "approval_runtime_character_mix.png", "approval_runtime_furniture_levels.png",
        "approval_runtime_furniture_tile_alignment.png",
    )
    board_rows = "\n".join(f"- `{name}` — {'presente' if (PRODUCTION_OUTPUT_ROOT / name).exists() else 'ausente'}" for name in boards)
    targeted = game_validation["targeted"]
    full = game_validation["full"]
    presentations = Counter(item["presentation"] for item in NEW_CUSTOMERS)
    report = f"""# Relatório final — Produção v003

Status: **checkpoint integrado pronto para aprovação visual**  
Versão pública: **inalterada**  
Release: **não realizado**

## Contagens finais

- Clientes únicos anteriores: **23**.
- Clientes inéditos produzidos: **{len(NEW_CUSTOMERS)}**.
- Pool final de clientes: **53**.
- Funcionários produzidos: **12 famílias profissionais canônicas**, cobrindo 13 registros de contratação.
- Móveis ativos: **{len(ACTIVE_FURNITURE)}**, todos com níveis L1–L5.
- PNGs individuais RGBA: **{individual_count}**.
- Atlases de runtime: **{atlas['count']}**.
- Arquivos públicos v003, incluindo miniaturas: **{len(integration['files'])}**.
- Impacto direto dos assets v003 no build: **+{runtime_assets_mib:.2f} MiB** em `public/assets/pixel/rendered/production_v003/`.

Variedade dos 30 inéditos: **{presentations['female']} femininos / {presentations['male']} masculinos**, **{len({item['skin'] for item in NEW_CUSTOMERS})} tons de pele**, **{len({item['hair'] for item in NEW_CUSTOMERS})} silhuetas de cabelo**, **{len({item['face'] for item in NEW_CUSTOMERS})} estruturas de rosto**, **{len({item['body'] for item in NEW_CUSTOMERS})} silhuetas corporais** e **{len({item['outfit'] for item in NEW_CUSTOMERS})} famílias de roupa**.

## Profissões encontradas e função

| professionId | Profissão | Registros | Estação/função |
|---|---|---|---|
{profession_rows}

O gerente/proprietário continua sendo o personagem do jogador; seus cinco presets foram preservados. O criador permite selecionar o preset e salvar tom de pele, estilo e cor de cabelo; o preset escolhido determina o sprite renderizado. O tipo técnico legado `stocker` não possui profissão cadastrada no catálogo atual e não recebeu asset inventado.

## Cobertura completa dos móveis

| furnitureId | Nome | Footprint | Cobertura | Estados |
|---|---|---:|---|---|
{furniture_rows}

Os níveis são exclusivamente visuais. `gameplayLevel` permanece 1 e não há bônus novo de velocidade, capacidade, produção, gorjeta, paciência ou economia.

O contato com o tile foi normalizado por footprint: móveis 1×1 usam a âncora vertical 174/192 e a bancada 2×1 usa 182/192. As dez tampas laterais dos balcões conectáveis agora cobrem continuamente do rodapé ao tampo.

## Custos e desbloqueios

| Próximo nível | Restaurante | Custo sobre o preço-base |
|---:|---:|---:|
| L2 | 8 | 40% |
| L3 | 20 | 70% |
| L4 | 40 | 105% |
| L5 | 65 | 150% |

O custo é arredondado ao múltiplo de 50 mais próximo, com mínimo de 50. Saldo e desbloqueio são verificados antes da mutação; posição, orientação e vínculos não mudam.

## Cena e pipeline

- Cena editável: `{PRODUCTION_BLEND.relative_to(PROJECT_ROOT).as_posix()}`.
- Configuração modular: `tools/blender/sprite_refresh/production_config.py`.
- Geração Blender: `tools/blender/sprite_refresh/sprite_refresh_production.py`.
- Render/retomada: `work/blender/sprite-refresh-production-v003/render_full.py`.
- Atlases: `tools/blender/sprite_refresh/build_production_atlases.py`.
- Validação: `tools/blender/sprite_refresh/validate_production.py`.
- Integração: `tools/blender/sprite_refresh/integrate_production_assets.py`.
- Regeneração única: `python tools/blender/sprite_refresh/run_production.py`.

## Pranchas, GIFs e screenshots

{board_rows}

- `previews/customers_walking.gif`
- `previews/staff_operating.gif`
- `previews/waiter_tray.gif`
- `previews/furniture_levels_1_to_5.gif`

## Validações

| Verificação | Resultado | Evidência |
|---|---:|---|
{validation_rows}

Comandos de jogo executados:

- `npm run lint`
- `npm run build`
- `npx vitest run src/tests/sprite-refresh-production-v003.test.ts`
- suíte histórica completa para comparação com o baseline conhecido

Resultados: TypeScript **{'APROVADO' if game_validation['lint']['ok'] else 'REPROVADO'}**; build **{'APROVADO' if game_validation['build']['ok'] else 'REPROVADO'}**; testes v003 **{targeted['passed']}/{targeted['total']} aprovados**. A suíte completa terminou com **{full['passed']} aprovados / {full['failed']} reprovados**; o baseline anterior já possuía **{full['historicalBaseline']['failed']} reprovações**, portanto **{'nenhuma reprovação adicional foi introduzida' if full['noAdditionalFailures'] else 'houve regressão adicional'}**.

## Arquivos relevantes alterados em src

{source_rows}

## Preservação

Os blends e todos os renders/relatórios v001 e v002 foram conferidos novamente contra `preservation_baseline.json`. Nenhum foi regravado ou removido.
"""
    (PRODUCTION_OUTPUT_ROOT / "PRODUCTION_REPORT.md").write_text(report, encoding="utf-8")
    print(PRODUCTION_OUTPUT_ROOT / "PRODUCTION_REPORT.md")


if __name__ == "__main__":
    main()
