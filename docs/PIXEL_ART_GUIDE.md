# Guia de pixel art — Bistrô Bloom 0.0.3

Este documento é a fonte de verdade visual. O jogo continua 2D no Phaser; Blender é uma ferramenta offline de autoria e renderização. Nenhum modelo 3D é carregado durante o jogo.

## Perfil visual ativo

- Perfil: `reference-scene-v5`.
- Revisão do render: `0.0.3-blender-7`; a versão do jogo permanece `0.0.3`.
- Referências mínimas: cozinheira, cliente, fogão industrial e geladeira industrial fornecidos em 19 de julho de 2026.
- Silhuetas arredondadas, contorno escuro de um pixel, luz superior suave, sombra projetada curta e detalhes legíveis em 1×.
- Não misturar renders `reference-scene-v5` com os antigos personagens e blocos simplificados na apresentação final.

## Escala e grade

- Bloco isométrico lógico: **64×32 px**, diamante 2:1.
- Personagem: frame nativo **96×144 px**, pés em **(48, 136)** e altura visual de aproximadamente **1,9 bloco**.
- Móveis/equipamentos: frame nativo **192×192 px**, linha de piso comum em **178 px**; o balcão de serviço 6×1 usa **256×192 px** para não ser comprimido ou cortado.
- Personagem continua ocupando logicamente 1×1, mesmo quando a arte ultrapassa o bloco.
- Fogão e geladeira continuam com footprint lógico 2×1 e precisam ocupar visualmente essa largura.
- O balcão de serviço deve preencher os seis blocos visuais, preservando tampo, painéis frontais e as duas vistas traseiras.
- Escala do runtime é 1:1. É proibido reduzir os novos personagens para a dimensão dos antigos.
- Zooms homologados: 0,5×, 1× e 2×.

## Pipeline Blender → PNG

1. `tools/blender/build_assets.py` gera fontes editáveis por família em `assets/blender/`.
2. Os anexos e a cena completa são preservados como referências estilísticas. O Blender aplica chroma-key, recorte e nearest-neighbor, deriva jogador, funcionários e oito identidades de cliente e mantém a paleta `bistro-bloom-reference-scene-v5`.
3. A câmera ortográfica comum usa rotação horizontal de 45° e inclinação de 35,264°.
4. Eevee renderiza diretamente na resolução nativa com filtro mínimo, Freestyle de um pixel e fundo transparente.
5. O pós-processamento usa nearest-neighbor, alfa recortado e quantização determinística da paleta.
6. Arquivos individuais ficam em `assets/pixel/rendered/`; cópias do runtime ficam em `public/assets/pixel/rendered/`.
7. `asset-manifest.json`, `runtime-index.json` e `src/assets/pixel/blenderManifest.ts` são gerados automaticamente.
8. `validate_assets.py` verifica fontes, câmera, escala, anchors, cobertura do footprint, estados, direções, animações, RGBA, transparência e paleta.

## Personagens

- Direções obrigatórias: `ne`, `nw`, `se`, `sw`.
- Caminhada: seis frames realmente distintos por direção.
- Biblioteca: `idle`, `walk`, `carry-dish`, `carry-ingredients`, `work`, `cook`, `serve`, `clean`, `sit`, `seated`, `eat`, `stand`.
- Identidade, tom de pele, cabelo, roupa, acessórios e proporções permanecem consistentes em todos os frames.
- A cozinheira de referência usa coque cacheado, dólmã clara, lenço vermelho, calça escura e sapatos pretos.
- O cliente de referência usa cabelo cacheado, jaqueta mostarda, camisa clara, jeans e tênis.
- Os clientes derivados variam tom de pele, cabelo, roupa, acessório e acento; a referência define qualidade e movimento, não uma identidade obrigatória.
- Profundidade é calculada pelos pés, nunca pela cabeça ou pela altura do frame.

## Equipamentos

- Fogão: quatro orientações; estados desligado e funcionando; seis queimadores, comandos, forno duplo, chamas, panela e vapor.
- Geladeira: quatro orientações; estados fechada e aberta; duas portas, puxadores, ventilação, prateleiras e alimentos.
- Frente, costas, origem do footprint e marcadores `ingredientPoint`, `workPoint` e `outputPoint` permanecem no `.blend`.
- Equipamentos futuros devem reutilizar câmera, densidade, contorno, iluminação e escala, mas nunca a mesma imagem como placeholder de outro nível.

## Runtime

- Phaser: `pixelArt: true`, `antialias: false`, `roundPixels: true`.
- Texturas Blender usam filtro `NEAREST` e `nativeScale: 1`.
- A origem do personagem é calculada pelo anchor de pés do manifest.
- Móveis e equipamentos usam anchor 178/192, orientação, footprint e estado do manifest; a profundidade parte da célula frontal ocupada.
- O atlas procedural antigo permanece apenas como fallback defensivo para falha de carregamento; não aparece misturado quando os assets definitivos estão disponíveis.
