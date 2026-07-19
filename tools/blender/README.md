# Pipeline Blender — Bistrô Bloom 0.0.3

Fonte editável: scripts Python + três arquivos `.blend` por família. O jogo continua 2D e carrega apenas PNGs transparentes.

- Tudo: `blender --background --python tools/blender/build_assets.py`
- Categoria: acrescente `-- --category character|furniture|equipment`
- Um asset: acrescente `-- --asset stove_level_1`
- Validar: `blender --background --python tools/blender/validate_assets.py`

Os scripts geram `assets/blender/`, os originais individuais em `assets/pixel/rendered/`, uma cópia pronta para o Phaser em `public/assets/pixel/rendered/`, o manifest JSON e `src/assets/pixel/blenderManifest.ts`. Níveis 2+ aparecem apenas como referências de dados; não existem modelos falsos nem são exibidos no jogo.

O perfil ativo `reference-hd-v2` mantém o jogo em `0.0.3`: personagens são renderizados em 96×144 com pés em (48,136), mundo em 192×192, balcão de serviço em 256×192 e filtro nearest. Caminhadas usam seis frames únicos por direção; fogão e geladeira expõem estados visuais completos.
