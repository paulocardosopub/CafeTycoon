# Cafe Tycoon — protótipo de reformulação das sprites

Pacote isolado de aprovação visual. Nada desta pasta é carregado pelo jogo e nenhum asset de produção foi substituído.

## Regenerar tudo

Na raiz do repositório:

```powershell
python tools/blender/sprite_refresh/run_pipeline.py
```

O comando audita o código atual, cria a cena no Blender 5.2 em background, salva o `.blend`, renderiza todos os PNGs/pranchas, cria as prévias GIF e executa as validações automáticas.

## Estrutura

- `AUDIT_REPORT.md`: medidas, câmera, catálogos e divergências encontradas.
- `current_assets_manifest.json`: inventário atual extraído do código.
- `prototype_manifest.json`: contrato dos modelos deste pacote.
- `sprites/`: PNGs individuais transparentes, sem grid, texto, piso ou cenário.
- `animation_frames/`: quadros individuais do preset 1.
- `approval_*.png`: pranchas solicitadas.
- `previews/`: ciclos animados nas quatro direções.
- `VALIDATION_RESULTS.md`: tabela final das verificações mensuráveis.

Fonte editável: `art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_approval.blend`.

Scripts: `tools/blender/sprite_refresh/`.

## Ordem das pranchas

- Personagens: SW, NW, NE, SE.
- `approval_active_states.png`, da esquerda para a direita e de cima para baixo: fogão off/on; cafeteira idle/active; pia idle/active; fritadeira off/on.
- Os GIFs usam um mosaico 2×2 com SW/NW na primeira linha e NE/SE na segunda.

Este é o ponto de parada de aprovação. A integração, o catálogo completo e a conversão para os ciclos ativos de oito quadros ficam bloqueados até aprovação explícita.

