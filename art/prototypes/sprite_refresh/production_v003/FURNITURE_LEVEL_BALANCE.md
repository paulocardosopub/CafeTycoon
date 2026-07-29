# Equilíbrio dos níveis visuais de móveis v003

Os níveis 1–5 são exclusivamente visuais nesta etapa. Não modificam velocidade, capacidade, produção, gorjetas, paciência, receitas ou tarefas.

## Desbloqueios

| Nível visual | Nível mínimo do restaurante | Identidade |
| ---: | ---: | --- |
| 1 | 1 | Inicial de madeira |
| 2 | 8 | Café contemporâneo |
| 3 | 20 | Industrial profissional |
| 4 | 40 | Premium moderno |
| 5 | 65 | Luxo máximo |

Os marcos 8, 20, 40 e 65 acompanham a curva já existente: primeiro ciclo de expansão operacional, primeira estrela, meio de campanha e abertura das vagas avançadas. Nenhuma recompensa preexistente foi alterada.

## Custos

O custo usa o preço-base já cadastrado para cada `furnitureId`, preservando a economia geral.

| Upgrade | Fórmula | Arredondamento |
| --- | --- | --- |
| L1 → L2 | 40% do preço-base | múltiplo de 50; mínimo 50 |
| L2 → L3 | 70% do preço-base | múltiplo de 50; mínimo 50 |
| L3 → L4 | 105% do preço-base | múltiplo de 50; mínimo 50 |
| L4 → L5 | 150% do preço-base | múltiplo de 50; mínimo 50 |

## Garantias transacionais

- O saldo é verificado antes da mutação.
- Falta de saldo ou requisito de nível não altera o móvel.
- O nível fica limitado ao intervalo 1–5.
- Posição, orientação, skin, vínculos, receita do balcão, tarefas e slots permanecem intactos.
- O custo adquirido é acumulado no preço pago para manter a revenda coerente com a compra.
- Saves sem `level` carregam como L1; valores antigos fora do intervalo são normalizados para 1–5.
