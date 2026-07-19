# Guia de pixel art — Bistrô Bloom 0.0.2

Este documento é a fonte de verdade visual da versão 0.0.2. A arte é original e usa a imagem de direção apenas como referência de perspectiva, densidade e atmosfera.

## Escala e grade

- Bloco isométrico: **64×32 px**, diamante 2:1.
- Pixel de arte do cenário: **2×2 px de tela em zoom 1×**. Personagens usam pixels nativos de 1× dentro do frame 64×96 para permitir rostos, cabelo e uniformes mais definidos; todo escalonamento continua nearest-neighbor.
- Personagem base: **64×96 px**.
- Ponto de ancoragem dos personagens: centro dos pés, em **(32, 88)** no frame.
- Ponto de ancoragem de móveis: centro da base do footprint; a arte pode ultrapassar o footprint.
- O polígono da base de mesas, cadeiras e equipamentos é derivado do footprint lógico; nenhum móvel usa uma base livre desenhada fora dos blocos ocupados.
- Zooms homologados: **0,5×, 1× e 2×**. A câmera alterna apenas entre esses níveis.
- Toda posição persistida é lógica, em blocos inteiros. Interpolação existe apenas na apresentação.

## Direções e animações

- Direções: `ne`, `nw`, `se`, `sw`.
- `idle`: 2 quadros, 4 FPS.
- `walk`: 6 quadros, 9 FPS.
- `carry-dish` e `carry-ingredients`: 2 quadros, 8 FPS.
- `work`: 4 quadros, 8 FPS.
- `sit`/`seated`: 2 quadros, 6/3 FPS.
- `eat`: 4 quadros, 7 FPS.
- Todas as camadas e variações mantêm frame 64×96 e a âncora dos pés.

## Paleta

| Uso | Cores |
| --- | --- |
| Creme e luz | `#FFF1CE`, `#EFD6A2`, `#D9B77E` |
| Madeira | `#3A2418`, `#70432A`, `#A86435`, `#D8954F` |
| Terracota | `#8E3F2F`, `#C65B3E`, `#E98255` |
| Sálvia | `#7D9B68`, `#4F7655`, `#294B3A` |
| Aço | `#2E3840`, `#59656A`, `#899397`, `#C9D0CD` |
| Azul | `#315B6E`, `#4F8293` |
| Dourado | `#C88B2A`, `#F1C45B` |
| Contorno | `#241A18`, com recortes `#3A2B25` |

Variações de volume usam grupos de 2 a 4 tons, sem gradientes suaves. A luz vem do noroeste; sombras caem para sudeste.

## Contorno, sombra e profundidade

- Contorno externo de 1 pixel lógico (2 px de tela), marrom muito escuro.
- Contornos internos usam a cor sombreada do material.
- Sombras são elipses em clusters, 25–38% de opacidade, sem blur.
- Profundidade é calculada pela célula-base; personagens usam os pés. Altura visual nunca substitui a base lógica.
- Móveis altos informam `visualHeight`; o ponto de ordenação continua na borda mais distante do footprint.

## Atlas e nomes

- `world-atlas`: pisos, paredes, móveis, cozinha, decoração, comida e efeitos.
- O exterior alterna dois tiles de grama com tufos pixelados e tiles de rua em pedra; a faixa externa também pertence à grade de navegação.
- `character-atlas`: personagens modulares compostos com pele, cabelo, roupa, uniforme, acessório e item carregado.
- Frames de mundo: `<grupo>/<asset>/<orientação-ou-estado>`.
- Frames de personagem: `character/<variação>/<animação>/<direção>/<quadro>`.
- Efeitos: `effect/<nome>/<quadro>`.
- IDs persistentes e frames são registrados em `src/assets/pixel/manifest.ts`.

## Renderização

- Phaser: `pixelArt: true`, `antialias: false`, `roundPixels: true`.
- Canvas e CSS: `image-rendering: pixelated`.
- Texturas são criadas como atlases raster no boot; nunca são escaladas com suavização.
- UI pode usar texto e CSS responsivos, mas o mundo isométrico não usa emojis, SVG, fotografias ou vetores suavizados.
