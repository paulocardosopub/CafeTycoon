# Arquitetura

## Fluxo principal

`main.ts` carrega/migra o save, aplica progresso offline, inicia `RestaurantSimulation`, `RestaurantScene` e `GameUI`. A simulação continua independente de Phaser e DOM; a cena converte estado lógico em sprites raster e profundidade isométrica.

## Módulos

- `src/content/`: ingredientes, receitas, estações e opções visuais; adicionar conteúdo aqui.
- `src/config/balance.ts`: valores econômicos, tempos, níveis, limite offline e melhorias.
- `src/assets/pixel`: paleta, manifesto e fábrica dos atlases raster de mundo/personagens.
- `src/game/grid`, `navigation`, `map`: células, conversão grade↔mundo, A*, reservas tile-to-tile, footprints e mapa inicial validado.
- `src/game/simulation`: ciclo de clientes, pedidos, equipe e resolução de tarefas.
- `src/game/tasks`: fila central e reservas contra concorrência.
- `src/game/inventory`, `cooking`, `progression`, `offline`: regras independentes da interface.
- `src/game/save`: estado padrão, repositório IndexedDB e migração/saneamento.
- `src/game/multiplayer`: contratos locais para perfil, ranking e visita futura.
- `src/scenes/`: representação isométrica, depth pela base/pés, efeitos, modo técnico e controles de câmera.
- `src/ui/`: criação de personagem, HUD e painéis funcionais.

IDs persistentes usam prefixos; IDs de conteúdo e frames são strings estáveis. O save possui `schemaVersion` e uma seção `graphics` com objetos, footprint, frente, âncoras e células ocupadas. Uma futura visita pode usar `RestaurantSnapshot` somente leitura.
