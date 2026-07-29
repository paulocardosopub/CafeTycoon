# Auditoria do protótipo de sprites — Cafe Tycoon

Gerada a partir do código atual, antes da modelagem. Nenhum asset, save, mecânica ou carregamento do jogo foi alterado.

## Estado do repositório e ferramentas

- Não existe `AGENTS.md` no repositório.
- Mudanças pré-existentes preservadas: `artifacts/bistro-bloom-0.0.9.tgz` e `artifacts/recipe-balance-0.0.10.csv` (ambas não rastreadas).
- Blender verificado: 5.2.0 LTS em `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe`.
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

## Catálogo canônico de móveis (32)

| Código | ID | Nome | Categoria | Footprint | Altura | Asset |
|---|---|---|---|---|---|---|
| A1 | cooking.a1.stove | Fogão industrial com fornos | cooking | 1×1 | STANDARD_COUNTER | a1_stove_industrial |
| A2 | cooking.a2.convection | Forno de convecção | cooking | 1×1 | STANDARD_COUNTER | a2_convection_oven |
| A3 | cooking.a3.griddle | Chapa industrial | cooking | 1×1 | STANDARD_COUNTER | a3_griddle |
| A4 | cooking.a4.fryer | Fritadeira industrial | cooking | 1×1 | STANDARD_COUNTER | a4_fryer |
| A5 | cooking.a5.kettle | Caldeira industrial | cooking | 1×1 | STANDARD_COUNTER | a5_kettle |
| A6 | cooking.a6.grill | Parrilla e defumador | cooking | 1×1 | STANDARD_COUNTER | a6_grill |
| A7 | cooking.a7.bakery | Forno de padaria | cooking | 1×1 | STANDARD_COUNTER | a7_bakery_oven |
| A8 | cooking.a8.coffee | Máquina de café | cooking | 1×1 | STANDARD_COUNTER | a8_coffee_machine |
| B1 | refrigeration.b1.fridge | Geladeira industrial | refrigeration | 1×1 | TALL | b1_industrial_fridge |
| B2 | refrigeration.b2.freezer | Freezer industrial | refrigeration | 1×1 | TALL | b2_industrial_freezer |
| B3 | preparation.b3.counter | Bancada de preparação | preparation | 1×1 | STANDARD_COUNTER | b3_preparation_counter |
| B4 | preparation.b4.ingredients | Estação de ingredientes e corte | preparation | 1×1 | STANDARD_COUNTER | b4_ingredient_station |
| B5 | washing.b5.sink | Pia industrial | washing | 1×1 | STANDARD_COUNTER | b5_industrial_sink |
| B6 | washing.b6.dishwasher | Lava-louças industrial | washing | 1×1 | STANDARD_COUNTER | b6_dishwasher |
| B7 | washing.b7.double-sink | Estação de lavagem com duas cubas | washing | 2×1 | STANDARD_COUNTER | b7_double_sink |
| B8 | preparation.b8.pastry | Mesa de massas e confeitaria | preparation | 2×1 | STANDARD_COUNTER | b8_pastry_table |
| B9 | washing.sink.t2 | Pia T2 - 15% mais rapida nas lavagens desta pia | washing | 1×1 | STANDARD_COUNTER | b5_industrial_sink |
| C1 | service.c1.isolated | Balcão de serviço | service | 1×1 | STANDARD_COUNTER | c1_service_isolated |
| C2 | service.c2.left | Balcão de serviço | service | 1×1 | STANDARD_COUNTER | c2_service_left |
| C3 | service.c3.middle | Balcão de serviço | service | 1×1 | STANDARD_COUNTER | c3_service_middle |
| C4 | service.c4.right | Balcão de serviço | service | 1×1 | STANDARD_COUNTER | c4_service_right |
| C11 | service.counter.t2 | Balcao T2 - 12% mais rapido nas tarefas deste balcao | service | 1×1 | STANDARD_COUNTER | c1_service_isolated |
| C5 | storage.c5.pantry | Despensa seca | storage | 1×1 | TALL | c5_dry_pantry |
| C6 | storage.c6.ingredients | Estante de ingredientes | storage | 1×1 | TALL | c6_ingredient_shelf |
| C7 | service.c7.plates | Estação de pratos e talheres | service | 1×1 | STANDARD_COUNTER | c7_plate_station |
| C8 | service.c8.waste | Lixeira e reciclagem | service | 1×1 | STANDARD_COUNTER | c8_waste_recycling |
| C9 | service.c9.drinks | Dispensador de bebidas frias | service | 1×1 | STANDARD_COUNTER | c9_cold_drinks |
| C10 | preparation.c10.block | Bancada pequena de corte | preparation | 1×1 | STANDARD_COUNTER | c10_cutting_block |
| T1 | dining.table.basic | Mesa robusta | tables | 1×1 | LOW | table_two |
| T2 | dining.table.t2 | Mesa robusta T2 | tables | 2×1 | LOW | table_two |
| CH1 | dining.chair.basic | Banco robusto | chairs | 1×1 | LOW | chair_wood |
| D1 | decor.plant.basic | Planta em vaso | decoration | 1×1 | LOW | plant |

## Catálogo canônico de funcionários (13)

| ID | Nome | Role | Profissão | Estação compatível |
|---|---|---|---|---|
| cook-0 | Nina | cook | Barista | coffee_machine |
| waiter-0 | Caio | waiter | Atendimento | prep |
| cleaner-0 | Iara | cleaner | Limpeza | prep |
| cook-1 | Lúcia | cook | Forneiro | oven |
| cook-2 | João | cook | Chapeiro | grill |
| cook-3 | Célia | cook | Chef de Sopas | cauldron |
| cook-4 | Akira | cook | Chef Oriental | stove |
| cook-5 | Mauro | cook | Assador | grill |
| cook-6 | Rosa | cook | Cozinheiro Geral | stove |
| cook-7 | Bia | cook | Fritureiro | grill |
| cook-8 | Dora | cook | Confeiteiro | prep |
| cook-9 | Kenji | cook | Sushiman | prep |
| waiter-1 | Bento | waiter | Atendimento | prep |

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

| # | Divergência |
|---|---|
| 1 | STRUCTURAL_GRID_FIX.md describes A1 stove and B5 sink as 2x1, but the current catalog declares both as 1x1. |
| 2 | The legacy visual contract is 96x144 at feet (48,136); active Stage 2C assets are 112x168 at feet (56,158) and nativeScale 0.72. |
| 3 | The legacy direction order is NE/NW/SE/SW; active Stage 2C row order is SW/NW/NE/SE. |
| 4 | Furniture catalog baseAnchor is y=174/192 while the existing production Blender manifest normalization line is y=178/192. |
| 5 | Legacy walk uses 6 frames, active Stage 2C uses 8, while the approval prototype explicitly requests 4 frames. |
| 6 | Exact counter-mounted equipment currently exposes only one idle frame, so runtime active frame requests clamp to idle for those sheets. |
| 7 | setup_camera.py and c3_br_v007.py label the camera inclination as 35.264 degrees, but their stored camera locations/targets do not mathematically reproduce that elevation exactly. |
| 8 | The furniture source manifest contains historical assets not present in the canonical 32-item gameplay catalog; the catalog remains the production scope source of truth. |

## Escopo depois da aprovação

Será necessário produzir, sem alterar footprints: os 32 móveis canônicos e seus quatro ângulos; estados realmente úteis dos equipamentos; os 13 funcionários canônicos; o conjunto completo de clientes definido para a nova direção; cinco presets de jogador e o sistema modular; além de todas as animações ativas por função. Antes da integração, será preciso decidir qual contrato de célula/âncora será consolidado e converter os ciclos de aprovação de 4 quadros para os 8 quadros consumidos pelos personagens ativos, ou alterar o contrato numa etapa separada e explicitamente aprovada.
