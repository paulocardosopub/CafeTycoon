# Relatório final — Produção v003

Status: **checkpoint integrado pronto para aprovação visual**  
Versão pública: **inalterada**  
Release: **não realizado**

## Contagens finais

- Clientes únicos anteriores: **23**.
- Clientes inéditos produzidos: **30**.
- Pool final de clientes: **53**.
- Funcionários produzidos: **12 famílias profissionais canônicas**, cobrindo 13 registros de contratação.
- Móveis ativos: **15**, todos com níveis L1–L5.
- PNGs individuais RGBA: **15.784**.
- Atlases de runtime: **146**.
- Arquivos públicos v003, incluindo miniaturas: **292**.
- Impacto direto dos assets v003 no build: **+26.97 MiB** em `public/assets/pixel/rendered/production_v003/`.

Variedade dos 30 inéditos: **15 femininos / 15 masculinos**, **5 tons de pele**, **18 silhuetas de cabelo**, **8 estruturas de rosto**, **5 silhuetas corporais** e **8 famílias de roupa**.

## Profissões encontradas e função

| professionId | Profissão | Registros | Estação/função |
|---|---|---|---|
| `barista` | Barista | cook-0 | coffee_machine |
| `service` | Atendimento/Garçom | waiter-0, waiter-1 | pickup |
| `cleaner` | Auxiliar de limpeza | cleaner-0 | sink |
| `oven_specialist` | Forneiro | cook-1 | oven |
| `griddle_specialist` | Chapeiro | cook-2 | grill |
| `soup_specialist` | Chef de Sopas | cook-3 | cauldron |
| `oriental_chef` | Chef Oriental | cook-4 | stove |
| `grill_specialist` | Assador | cook-5 | grill |
| `general_cook` | Cozinheiro Geral | cook-6 | stove |
| `fryer_specialist` | Fritureiro | cook-7 | grill |
| `pastry_chef` | Confeiteiro | cook-8 | prep |
| `sushi_chef` | Sushiman | cook-9 | prep |

O gerente/proprietário continua sendo o personagem do jogador; seus cinco presets foram preservados. O criador permite selecionar o preset e salvar tom de pele, estilo e cor de cabelo; o preset escolhido determina o sprite renderizado. O tipo técnico legado `stocker` não possui profissão cadastrada no catálogo atual e não recebeu asset inventado.

## Cobertura completa dos móveis

| furnitureId | Nome | Footprint | Cobertura | Estados |
|---|---|---:|---|---|
| `cooking.a1.stove` | Fogão industrial com fornos | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `cooking.a2.convection` | Forno de convecção | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `cooking.a3.griddle` | Chapa industrial | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `cooking.a4.fryer` | Fritadeira industrial | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `cooking.a5.kettle` | Caldeira industrial | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `cooking.a6.grill` | Parrilla e defumador | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `cooking.a7.bakery` | Forno de padaria | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `cooking.a8.coffee` | Máquina de café | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `preparation.b3.counter` | Bancada de preparação | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `washing.b5.sink` | Pia industrial | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `preparation.b8.pastry` | Mesa de massas e confeitaria | 2×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `service.c1.isolated` | Balcão de serviço | 1×1 | L1, L2, L3, L4, L5 | idle |
| `service.c9.drinks` | Dispensador de bebidas frias | 1×1 | L1, L2, L3, L4, L5 | off, active_1, active_2, complete |
| `dining.table.basic` | Mesa robusta | 1×1 | L1, L2, L3, L4, L5 | idle |
| `dining.chair.basic` | Banco robusto | 1×1 | L1, L2, L3, L4, L5 | idle |

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

- Cena editável: `art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_production_v003.blend`.
- Configuração modular: `tools/blender/sprite_refresh/production_config.py`.
- Geração Blender: `tools/blender/sprite_refresh/sprite_refresh_production.py`.
- Render/retomada: `work/blender/sprite-refresh-production-v003/render_full.py`.
- Atlases: `tools/blender/sprite_refresh/build_production_atlases.py`.
- Validação: `tools/blender/sprite_refresh/validate_production.py`.
- Integração: `tools/blender/sprite_refresh/integrate_production_assets.py`.
- Regeneração única: `python tools/blender/sprite_refresh/run_production.py`.

## Pranchas, GIFs e screenshots

- `approval_customers_30.png` — presente
- `approval_customers_30_actual_size.png` — presente
- `approval_staff_professions.png` — presente
- `approval_staff_turnarounds.png` — presente
- `approval_furniture_levels_overview.png` — presente
- `approval_counter_levels_alignment.png` — presente
- `approval_furniture_active_states_all_levels.png` — presente
- `approval_furniture_tile_alignment.png` — presente
- `approval_runtime_character_mix.png` — presente
- `approval_runtime_furniture_levels.png` — presente
- `approval_runtime_furniture_tile_alignment.png` — presente

- `previews/customers_walking.gif`
- `previews/staff_operating.gif`
- `previews/waiter_tray.gif`
- `previews/furniture_levels_1_to_5.gif`

## Validações

| Verificação | Resultado | Evidência |
|---|---:|---|
| 30 novos clientes | APROVADO | 30 registros; 30 assinaturas modulares |
| 12 profissões canônicas | APROVADO | 12 profissões; 12 assets |
| 15 móveis × cinco níveis | APROVADO | 15 definições; 100 folhas |
| Cena Blender editável | APROVADO | 2901486 bytes |
| Preservação byte a byte v001/v002 | APROVADO | 300 arquivos verificados |
| Manifesto estrutural | APROVADO | contratos, pivôs, direções e matriz de produção |
| Estrutura interna da cena Blender | APROVADO | 7/7 verificações |
| PNGs individuais de personagens | APROVADO | 14664/14664 RGBA 112×168 |
| PNGs individuais de móveis | APROVADO | 1120/1120 RGBA 192×192 |
| Conteúdo sem corte no canvas | APROVADO | cortes/bordas tocadas: 0 |
| Contato visual dos balcões com o tile por footprint | APROVADO | 1060/1.060; falhas 0 |
| Continuidade projetada entre módulos 1×1 | APROVADO | 20/20; desvio máximo 1 px |
| Linha dos pés idêntica à v002 | APROVADO | 184/184; falhas 0 |
| Manifesto dos arquivos individuais | APROVADO | 15784/15.784 registros com hash |
| 146 atlases de runtime | APROVADO | 146/146; falhas 0 |
| Diferença visual dos clientes | APROVADO | 435 pares; distância mínima 0; duplicatas exatas 0 |
| Integração pública | APROVADO | 292/292 arquivos publicados; ausentes 0 |

Comandos de jogo executados:

- `npm run lint`
- `npm run build`
- `npx vitest run src/tests/sprite-refresh-production-v003.test.ts`
- suíte histórica completa para comparação com o baseline conhecido

Resultados: TypeScript **APROVADO**; build **APROVADO**; testes v003 **6/6 aprovados**. A suíte completa terminou com **251 aprovados / 64 reprovados**; o baseline anterior já possuía **64 reprovações**, portanto **nenhuma reprovação adicional foi introduzida**.

## Arquivos relevantes alterados em src

- `src/assets/pixel/productionV003Manifest.ts`
- `src/assets/pixel/characterVariantManifest.ts`
- `src/assets/pixel/runtimeRenderedAssets.ts`
- `src/content/characters/options.ts`
- `src/content/characters/playerSkins.ts`
- `src/game/data/furniture/levels.ts`
- `src/game/data/staff.ts`
- `src/game/map/initialMap.ts`
- `src/game/save/migrations.ts`
- `src/game/systems/construction/ConstructionEditor.ts`
- `src/main.ts`
- `src/scenes/RestaurantScene.ts`
- `src/ui/ConstructionShop.ts`
- `src/ui/GameUI.ts`
- `src/ui/characterCreator.ts`
- `src/styles.css`
- `src/tests/sprite-refresh-production-v003.test.ts`
- `src/tests/c3-br-v007.test.ts`
- `src/tests/construction-editor-v005.test.ts`

## Preservação

Os blends e todos os renders/relatórios v001 e v002 foram conferidos novamente contra `preservation_baseline.json`. Nenhum foi regravado ou removido.
