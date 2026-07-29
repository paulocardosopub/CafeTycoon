# Cafe Tycoon — refinamento dos personagens v002

Checkpoint visual isolado. Esta versão refina somente os onze personagens aprovados e a pose dos braços com bandeja.

## Regenerar

Na raiz do repositório:

```powershell
python tools/blender/sprite_refresh/run_refinement.py
```

O comando registra os invariantes da v001, gera a cena v002 em arquivo separado, renderiza somente personagens, cria as comparações/GIF e executa as validações específicas.

## Arquivos-fonte

- Preservado: `art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_approval.blend`.
- Refinado: `art_source/blender/sprite_refresh/cafe_tycoon_sprite_refresh_refinement_v002.blend`.

## Contrato preservado

- Canvas 112×168.
- Pés em (56,158).
- Altura de gameplay 2,200 BU.
- Câmera ortográfica 45°/35,2643897°.
- Direções SW, NW, NE, SE.
- Caminhada comum e cozinha sem alteração de keyframes.
- Pernas da caminhada com bandeja sem alteração.

O catálogo completo e a integração no jogo continuam bloqueados até aprovação explícita desta v002.
