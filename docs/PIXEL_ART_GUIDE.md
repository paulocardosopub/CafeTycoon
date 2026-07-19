# Guia de pixel art — Bistrô Bloom 0.0.3

Este documento é a fonte de verdade visual. O jogo continua sendo renderizado em 2D pelo Phaser. Blender é uma ferramenta offline de produção: nenhum modelo 3D é enviado ao runtime.

## Escala e grade

- Bloco isométrico: **64×32 px**, diamante 2:1.
- Personagem: frame **64×96 px**, pés em **(32, 88)**.
- Móveis/equipamentos: frame **128×160 px**, base alinhada ao footprint.
- Zooms homologados: **0,5×, 1× e 2×**.
- Posição persistida é sempre lógica e inteira. Interpolação existe apenas na apresentação.
- A arte pode ultrapassar o footprint, mas nunca altera ocupação, colisão ou pontos de serviço.

## Pipeline Blender→PNG

1. `tools/blender/build_assets.py` gera fontes por família em `assets/blender/`.
2. Materiais compartilhados usam cores sólidas da paleta; geometria é low-poly e a luz vem do noroeste.
3. Uma câmera ortográfica comum usa rotação horizontal de 45° e inclinação de 35,264°.
4. O render Eevee usa fundo transparente e resolução 2×.
5. A redução coleta pixels por nearest-neighbor, quantiza a paleta e elimina alfa residual.
6. Originais individuais são salvos em `assets/pixel/rendered/`; a cópia do runtime vai para `public/assets/pixel/rendered/`.
7. `asset-manifest.json` e `src/assets/pixel/blenderManifest.ts` são gerados automaticamente.
8. `validate_assets.py` verifica fontes, câmera, direções, frame count, dimensões, RGBA, transparência, âncora, footprint, miniatura e nível visual.

Comandos:

```text
blender --background --python tools/blender/build_assets.py
blender --background --python tools/blender/build_assets.py -- --category character
blender --background --python tools/blender/build_assets.py -- --asset stove_level_1
blender --background --python tools/blender/validate_assets.py
```

## Direções e animações

- Direções obrigatórias: `ne`, `nw`, `se`, `sw`.
- Biblioteca base: `idle`, `walk`, `carry-dish`, `carry-ingredients`, `work`, `cook`, `serve`, `clean`, `sit`, `seated`, `eat`, `stand`.
- O jogo usa os subconjuntos necessários por estado; as demais sequências ficam prontas para especialização sem trocar o rig.
- Identidade, altura, roupa, acessório, tamanho do frame e ponto dos pés permanecem consistentes nas quatro direções.

## Paleta

| Uso | Cores-base |
| --- | --- |
| Creme e luz | `#FFF1CE`, `#EFD6A2`, `#D9B77E` |
| Madeira | `#3A2418`, `#70432A`, `#A86435`, `#D8954F` |
| Terracota | `#8E3F2F`, `#C65B3E`, `#E98255` |
| Sálvia | `#7D9B68`, `#4F7655`, `#294B3A` |
| Aço | `#2E3840`, `#59656A`, `#899397`, `#C9D0CD` |
| Azul | `#315B6E`, `#4F8293` |
| Dourado | `#C88B2A`, `#F1C45B` |
| Contorno | `#241A18` e recortes `#3A2B25` |

Silhueta tem prioridade sobre microdetalhe. Não usar blur, interpolação suave, ruído fino, gradiente fotográfico ou pixels isolados.

## Organização e níveis

- Cada asset possui collection, ID, categoria, marcadores técnicos e miniatura.
- Personagens compartilham `bistro_humanoid_v1`, materiais e biblioteca de animação.
- Equipamentos possuem estados `off`, `active` e `complete`, quatro orientações e marcadores de ingrediente/trabalho/saída.
- Apenas nível 1 é modelado na 0.0.3. `nextLevelAssetId` prepara a arquitetura; níveis futuros não reutilizam a mesma imagem como placeholder.
- O atlas procedural anterior permanece como fallback defensivo, não como fonte primária dos personagens, móveis e equipamentos atuais.

## Runtime

- Phaser: `pixelArt: true`, `antialias: false`, `roundPixels: true`.
- Canvas/CSS: `image-rendering: pixelated`.
- A cena carrega cada sheet pelo manifest gerado e calcula o frame por animação, direção e estado.
- Profundidade usa base/pés, nunca altura visual.
