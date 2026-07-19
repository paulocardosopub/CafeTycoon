# Guia de conteúdo

- **Ingrediente:** adicione um objeto com ID único em `src/content/ingredients/ingredients.ts`. Quantidade, limite, custo, unidade e ícone ficam no próprio dado.
- **Receita:** adicione em `src/content/recipes/recipes.ts`; declare ingredientes, etapas/estações, duração, rendimento, preço, XP, nível e espaço. Não altere funcionários.
- **Estação:** adicione ID ao tipo `StationId`, depois defina posição, tamanho e ponto de interação em `src/content/stations/stations.ts`. O ponto deve ser caminhável.
- **Funcionário/personagem:** dados visuais ficam em `src/content/characters/`; comportamento usa papéis e tarefas em `game/simulation` e `game/tasks`.
- **Móvel/mesa:** siga `createTables()` em `game/map/initialMap.ts`, com área, cadeiras, aproximações e capacidade. Execute os testes de mapa.

Valores de balanceamento pertencem a `src/config/balance.ts`; não devem ser duplicados na interface.
