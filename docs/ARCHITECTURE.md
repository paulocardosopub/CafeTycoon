# Arquitetura

## Fluxo principal

`main.ts` carrega/migra o save, aplica progresso offline, inicia `RestaurantSimulation`, `RestaurantScene` e `GameUI`. A simulação não depende do Phaser nem do DOM.

## Módulos

- `src/content/`: ingredientes, receitas, estações e opções visuais; adicionar conteúdo aqui.
- `src/config/balance.ts`: valores econômicos, tempos, níveis, limite offline e melhorias.
- `src/game/grid`, `navigation`, `map`: células, A* e mapa inicial validado.
- `src/game/simulation`: ciclo de clientes, pedidos, equipe e resolução de tarefas.
- `src/game/tasks`: fila central e reservas contra concorrência.
- `src/game/inventory`, `cooking`, `progression`, `offline`: regras independentes da interface.
- `src/game/save`: estado padrão, repositório IndexedDB e migração/saneamento.
- `src/game/multiplayer`: contratos locais para perfil, ranking e visita futura.
- `src/scenes/`: representação isométrica e controles de câmera.
- `src/ui/`: criação de personagem, HUD e painéis funcionais.

IDs persistentes usam prefixos; IDs de conteúdo são strings estáveis. O save possui `schemaVersion`. Uma futura visita pode usar `RestaurantSnapshot` somente leitura.
