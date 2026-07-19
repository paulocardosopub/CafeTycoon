# Arquitetura

## Fluxo principal

`main.ts` carrega e migra o save, aplica progresso offline e inicia `RestaurantSimulation`, `RestaurantScene` e `GameUI`. A simulação não depende de Phaser nem do DOM. A cena apenas traduz estado lógico em sprites e profundidade isométrica.

## Módulos

- `src/content/`: ingredientes, receitas, estações, personagens e definições data-driven dos equipamentos por família/nível.
- `src/config/balance.ts`: economia, tempos, velocidades, recuperação, progressão e limite offline.
- `src/assets/pixel/`: atlas procedural de fallback e manifest TypeScript gerado dos renders Blender.
- `src/game/grid`, `navigation`, `map`: grade, ocupação indexada, A*, footprints, zonas de entrada/saída e mapa validado.
- `src/game/simulation/`: ciclo de clientes e grupos, assentos, pedidos, equipe, balcão e reconciliação operacional.
- `src/game/tasks/`: fila central com estados `pending/reserved/moving/executing/completed/cancelled/blocked`.
- `src/game/inventory`, `cooking`, `progression`, `offline`: regras puras e independentes da interface.
- `src/game/save/`: IndexedDB, fallback local, schema 3, migração e saneamento de reservas.
- `src/scenes/`: carregamento de sprite sheets Blender, fallback raster, depth pela base/pés e visualização técnica local.
- `src/ui/`: criação do perfil, HUD operacional, estoque, tarefas, relatórios e ferramentas apenas em desenvolvimento.
- `tools/blender/`: fonte automatizada dos modelos, rig, animações, materiais, câmera, luz, render, manifest e validação.

## Persistência operacional

O save separa estado econômico do estado da operação. `operation` guarda atores, clientes, pedidos, assentos, estações, slots do balcão e tarefas. Ao carregar, posições fixas do mapa prevalecem, reservas são revalidadas, tarefas interrompidas voltam à fila e estados de transporte/preparo são reconciliados sem duplicar prato ou pagamento.

IDs de conteúdo e de assets são estáveis. `visualLevel` e `gameplayLevel` são independentes; trocar `renderedAssetId` não altera posição, orientação, fila ou pedido da estação.

## Contrato visual 0.0.3

O manifest `reference-hd-v2` é a fonte de escala do runtime. Personagens usam anchors em pixels, normalizados pela cena antes de criar o sprite; mundo usa anchors normalizados. `nativeScale` permanece 1, o filtro é nearest e `isoDepth` recebe a posição lógica/visual dos pés. Assim, aumentar a imagem não aumenta footprint, colisão ou alcance de interação.
