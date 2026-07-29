# Validações do protótipo

| Validação | Resultado | Evidência |
|---|---|---|
| Quantidade de PNGs individuais | PASS | personagens=44/44, animações=48/48, móveis=52/52 |
| Todos os PNGs individuais usam RGBA | PASS | 144 arquivos verificados |
| Transparência real sem fundo incorporado | PASS | alpha contém pixels 0 e pixels opacos em todo sprite individual |
| Nenhum quadro vazio | PASS | 144 quadros com conteúdo opaco |
| Nenhum sprite cortado | PASS | bbox opaco mantém pelo menos 1 px de margem |
| Resoluções consistentes por conjunto | PASS | personagens=[(112, 168)], móveis=[(192, 192)] |
| Âncoras visuais na linha de piso | PASS | pés min/max=156/160 alvo=158; móveis min/max=167/176 alvo=174 |
| Quatro direções presentes e na ordem manifestada | PASS | personagens SW/NW/NE/SE; móveis SW/SE/NE/NW |
| Quatro frames por direção e animação | PASS | 3 animações × 4 direções × 4 frames |
| Movimento diferente nos quatro frames | PASS | hash binário distinto em cada ciclo/direção |
| Frames 1 e 3 usam contatos de pernas opostos | PASS | diferença raster mensurável > 0,012 nos ciclos de caminhada |
| Canvas e enquadramento constantes entre frames | PASS | todos em 112×168 |
| Estados ligados/desligados são visualmente distintos | PASS | diferenças=0.0005,0.0006,0.0008,0.0027 |
| Câmera ortográfica isométrica exata | PASS | azimute=45.000000°, elevação=35.264390° |
| Pivôs e escala de gameplay dos personagens | PASS | 11 personagens, altura 2,200 BU, pés em z=0 |
| Esqueleto compartilhado masculino/feminino | PASS | 11 rigs usam SpriteRefresh_Humanoid_Shared |
| Ações do rig do personagem-protótipo | PASS | walk, walk_tray e cook: 4 poses gravadas no .blend |
| Bandeja totalmente vazia e nivelada | PASS | sem filhos/itens proibidos; normal da superfície alinhada ao eixo Z global |
| Dimensões estruturais idênticas dos balcões | PASS | 5 módulos = (1.0, 1.0, 1.1), tolerância 0.001 |
| Altura de bancada idêntica | PASS | altura=1.100 BU |
| Base mestra compartilhada por instância | PASS | baseIds=['COUNTER_BASE_MASTER_1x1'] |
| Sem lacuna ou sobreposição entre balcões | PASS | gaps=[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] |
| Bases e footprints do protótipo respeitam o catálogo | PASS | mesa, cadeira, geladeira e módulos = 1×1 |
| Sprites sem tile, piso ou cenário incorporado | PASS | geometria técnica existe apenas nas coleções TECH_* |
| Sistema modular 5× cabelo/cor/pele | PASS | cabelos=['bun', 'coily', 'curls', 'short', 'wave'], cores=['chestnut', 'copper', 'espresso', 'midnight', 'silver'], peles=['cocoa', 'ebony', 'honey', 'porcelain', 'warm'] |

**Resumo:** 25 passaram; 0 falharam.
