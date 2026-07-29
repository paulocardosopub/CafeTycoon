# PRODUÇÃO V003 — Auditoria do catálogo real

Data da auditoria: 2026-07-26. Fonte de verdade: catálogo e renderer atuais em `src/`. A v002 permanece o padrão visual oficial e seus arquivos não serão modificados.

## Contratos preservados

| Contrato | Valor em produção |
| --- | --- |
| Grid isométrico | 64×32 px; 1 tile lógico = 1×1 BU |
| Personagem | 112×168 px; âncora dos pés (56,158); altura 2,20 BU |
| Câmera | Ortográfica; azimute 45°; elevação 35,2643897°; escala 2,80 |
| Direções de personagem | SW, NW, NE, SE |
| Móvel | 192×192 px; âncora (0,5;174/192) |
| Direções de móvel | SW, SE, NE, NW |
| Profundidade | Fórmula isométrica existente; nenhuma alteração de pivô, collider ou footprint |

## 1. Profissões encontradas

O tipo técnico `ProfessionId` possui `cook`, `waiter`, `cleaner` e o legado `stocker`, porém `stocker` não tem candidato no catálogo e é removido do gameplay atual. A identidade profissional efetiva é definida pelos 13 registros de funcionários e suas especialidades, resultando em 12 famílias visuais canônicas.

| professionId v003 | Nome no jogo | Registros | Função | Estação compatível |
| --- | --- | --- | --- | --- |
| `barista` | Barista | `cook-0` Nina | Preparação de café | `coffee_machine` |
| `service` | Atendimento/Garçom | `waiter-0` Caio; `waiter-1` Bento | Pedidos, entrega e pagamento | `pickup` |
| `cleaner` | Auxiliar de limpeza | `cleaner-0` Iara | Limpeza de mesas | `sink` |
| `oven_specialist` | Forneiro | `cook-1` Lúcia | Produção em forno | `oven` |
| `griddle_specialist` | Chapeiro | `cook-2` João | Produção na chapa | `grill` |
| `soup_specialist` | Chef de Sopas | `cook-3` Célia | Produção na caldeira | `cauldron` |
| `oriental_chef` | Chef Oriental | `cook-4` Akira | Produção no fogão/wok | `stove` |
| `grill_specialist` | Assador | `cook-5` Mauro | Produção na parrilla | `grill` |
| `general_cook` | Cozinheiro Geral | `cook-6` Rosa | Produção versátil | `stove` |
| `fryer_specialist` | Fritureiro | `cook-7` Bia | Produção na fritadeira (função atual `grill`) | `grill` |
| `pastry_chef` | Confeiteiro | `cook-8` Dora | Confeitaria | `prep` |
| `sushi_chef` | Sushiman | `cook-9` Kenji | Bancada fria | `prep` |

O gerente/proprietário não é profissão separada no runtime; ele é o personagem do jogador. Os cinco presets aprovados são preservados. Nenhum asset de `stocker` novo será inventado.

## 2. Animações exigidas por profissão

| Família | Animações no contrato do runtime |
| --- | --- |
| Cozinha e especialidades | `idle` 4, `walk` 8, `turn` 6, `pickup` 6, `place` 6, `carry_plate_idle` 4, `carry_plate_walk` 8, `carry_ingredient_idle` 4, `carry_ingredient_walk` 8, `prep_counter` 8, `cook_stove` 8, `wash_sink` 8, `place_dish` 6, `wait_workstation` 4 |
| Atendimento | `idle` 4, `walk` 8, `turn` 6, `pickup` 6, `place` 6, `carry_plate_idle` 4, `carry_plate_walk` 8, `carry_tray_idle` 4, `carry_tray_walk` 8, `pickup_dish` 6, `serve_table` 6, `clear_table` 6, `clean_table` 8, `wait_service` 4 |
| Limpeza | `idle` 4, `walk` 8, `turn` 6, `pickup` 6, `place` 6, `clean_table` 8, `wash_sink` 8, `wait_service` 4 |

A bandeja existe apenas nas animações `carry_tray_*`; permanece vazia, horizontal e sustentada pelas duas mãos conforme v002. Utensílios permanecem ocultos em caminhada e espera.

## 3. Clientes atuais

| Origem | Quantidade | Observação |
| --- | ---: | --- |
| Clientes 3D base (`char_customer_01`…`06`) | 6 | Válidos e preservados |
| Variantes de paleta (`char_variant_customer_01`…`16`) | 16 | As quatro primeiras recebem a geometria aprovada v002 sem criar IDs extras |
| Fallback histórico `char_player_male_01` no pool | 1 | Preservado para compatibilidade |
| Total atual único | **23** | Base antes dos 30 inéditos |
| Novos v003 | **30** | `char_v003_customer_001`…`030` |
| Total final do pool | **53** | 23 atuais + 30 novos |

Animações de cliente exigidas: `idle`, `walk`, `turn`, `pickup`, `place`, `sit_down`, `seated_idle`, `wait_food`, `eat`, `drink`, `react_happy`, `react_impatient` e `stand_up`. A cadeira não é incorporada à sprite sentada.

## 4–6. Móveis, footprints, orientações e estados

O catálogo mantém 32 definições por compatibilidade de saves, mas a loja atual expõe exatamente 15 móveis compráveis. A migração remove ativamente armazenamento e refrigeração; portanto despensas, estantes, geladeiras e freezers legados não entram na produção v003. A decoração antiga também não está mais colocada nem comprável no estado inicial.

Todos os itens abaixo usam as quatro orientações SW/SE/NE/NW e terão níveis 1–5.

| furnitureId | Nome | Footprint | Estados renderizados por nível | Observação |
| --- | --- | --- | --- | --- |
| `cooking.a1.stove` | Fogão industrial com fornos | 1×1 | off, active_1, active_2, complete | estação |
| `cooking.a2.convection` | Forno de convecção | 1×1 | off, active_1, active_2, complete | estação |
| `cooking.a3.griddle` | Chapa industrial | 1×1 | off, active_1, active_2, complete | estação |
| `cooking.a4.fryer` | Fritadeira industrial | 1×1 | off, active_1, active_2, complete | estação |
| `cooking.a5.kettle` | Caldeira industrial | 1×1 | off, active_1, active_2, complete | estação |
| `cooking.a6.grill` | Parrilla e defumador | 1×1 | off, active_1, active_2, complete | estação |
| `cooking.a7.bakery` | Forno de padaria | 1×1 | off, active_1, active_2, complete | estação |
| `cooking.a8.coffee` | Máquina de café | 1×1 | off, active_1, active_2, complete | estação |
| `preparation.b3.counter` | Bancada de preparação | 1×1 | off, active_1, active_2, complete | estação |
| `washing.b5.sink` | Pia industrial | 1×1 | off, active_1, active_2, complete | estação |
| `preparation.b8.pastry` | Mesa de massas e confeitaria | 2×1 | off, active_1, active_2, complete | duas bases mestras alinhadas |
| `service.c1.isolated` | Balcão de serviço | 1×1 | idle | variantes isolated/left/middle/right; superfície vazia |
| `service.c9.drinks` | Dispensador de bebidas frias | 1×1 | off, active_1, active_2, complete | estação |
| `dining.table.basic` | Mesa robusta | 1×1 | idle | duas cadeiras independentes |
| `dining.chair.basic` | Banco robusto | 1×1 | idle | camadas full/back/front para oclusão sentada |

## 7. Situação atual dos upgrades

Antes da v003, `PlacedFurniture.level` já existia e era salvo, e móveis novos começavam em 1. O runtime também copiava o valor para estações e balcões. Faltavam, porém: limite máximo 5, seleção do asset por nível, custos centralizados, transação de upgrade, interface, desbloqueios e clamp consistente na migração. A v003 completa somente essas lacunas; não adiciona bônus de produção, capacidade, gorjeta, velocidade ou economia.

## 8. Quantidade planejada de renders

| Grupo | Fórmula | PNGs individuais |
| --- | --- | ---: |
| 30 clientes inéditos | 30 × 78 quadros × 4 direções | 9.360 |
| 4 clientes v002 preservados | 4 × 78 × 4 | 1.248 |
| 10 famílias visuais de cozinha | 10 × 88 × 4 | 3.520 |
| Atendimento | 1 × 84 × 4 | 336 |
| Limpeza | 1 × 50 × 4 | 200 |
| Móveis e estações | matriz de 100 assets de runtime | 1.120 |
| **Total** |  | **15.784** |

Serão gerados **146 atlases**: 34 de clientes, 12 de funcionários e 100 de móveis/camadas/variantes. O pipeline usa quadros-chave renderizados pelo Blender, hashes de entrada e retomada; os PNGs individuais RGBA permanecem a fonte de arte, enquanto o runtime carrega atlas por asset.
