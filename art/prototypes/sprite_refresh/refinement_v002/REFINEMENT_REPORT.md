# Relatório de refinamento dos personagens — v002

## Escopo

Refinamento exclusivo dos onze personagens do pacote de aprovação. A cena v001 foi preservada; móveis, balcões, câmera, medidas, gameplay e `src/` não foram alterados.

## Modelos refinados

- `player_01_male_short` (Homem · curto castanho)
- `player_02_female_bun` (Mulher · coque escuro)
- `player_03_male_coily` (Homem · crespo curto)
- `player_04_female_curls` (Mulher · cacheado cobre)
- `player_05_male_wave` (Homem · ondulado prata)
- `staff_barista_nina` (Barista)
- `staff_attendant_caio` (Atendente)
- `customer_approval_01` (Cliente 1)
- `customer_approval_02` (Cliente 2)
- `customer_approval_03` (Cliente 3)
- `customer_approval_04` (Cliente 4)

## Geometria e modularidade

- Cabeças reconstruídas com crânio e mandíbula de perfil próprio; bochechas, nariz em dois volumes, olhos completos, sobrancelhas e sorriso discreto.
- Cinco cabelos reconstruídos em volumes: curto com degradê, coque em lóbulos, crespo em agrupamentos, cachos definidos e ondas com franja assimétrica.
- Componentes independentes: `BODY`, `HEAD`, `FACE`, `HAIR`, `CLOTHING`, `APRON` e `ACCESSORIES`.
- Roupas receberam gola, carcela, botões, punhos, dobras, costuras, barras, cintura e calçados com abertura, biqueira e sola.
- Aventais agora usam bib e saia com espessura, alças frontais/traseiras, faixa, bolso dividido, dobras e amarração traseira.
- Barista: badge de café, toalha e ferramenta de bolso. Atendente: colete e identificação. Clientes: combinações casuais e acessórios próprios.

## Materiais

- Pele macia e blush por tom; cabelo com base e highlight por cor.
- Tecidos de camisa, avental, calça e denim com roughness próprios.
- Couro separado em cabedal, biqueira e sola; metais em latão e aço.
- Paleta permanece controlada e compatível com a identidade aprovada.

## Rig e animação

- Esqueleto compartilhado atualizado para `SpriteRefresh_Humanoid_Shared_v002`.
- Controles adicionados: `hand_ik.L`, `hand_ik.R`, `elbow_pole.L`, `elbow_pole.R`.
- Constraints adicionados: `TrayHandIK.L` e `TrayHandIK.R`, chain length 2, sem stretch.
- `walk`: nenhum canal aprovado alterado.
- `cook`: nenhum canal aprovado alterado.
- `walk_tray`: pernas preservadas integralmente; somente braços, alvos das mãos, poles dos cotovelos e influência IK foram alterados.
- Cotovelos medidos entre 80° e 100°; bandeja horizontal, vazia e limitada a até 2 px de oscilação.

## Resultado das verificações

26 validações passaram e 0 falharam. Consulte `REFINEMENT_VALIDATION_RESULTS.md` para a tabela completa.
