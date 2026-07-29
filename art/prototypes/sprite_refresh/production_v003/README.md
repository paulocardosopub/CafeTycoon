# Produção v003 — reprodução

Este diretório é a área de preparação isolada da produção de clientes, funcionários e móveis níveis 1 a 5. Os arquivos de v001 e v002 são tratados como imutáveis e conferidos por SHA-256 antes da publicação.

## Comando único

Execute na raiz do projeto com um Python que possua Pillow:

```powershell
python tools/blender/sprite_refresh/run_production.py
```

O comando:

1. mantém ou cria o baseline de preservação;
2. gera a cena Blender v003 e os PNGs RGBA individuais usando cache por hash;
3. monta os 146 atlases, 146 miniaturas, pranchas e GIFs;
4. valida a preparação;
5. somente então publica em `public/assets/pixel/rendered/production_v003/`;
6. repete a validação contra os arquivos publicados;
7. executa TypeScript, build, os testes específicos da v003 e a suíte histórica completa, registrando a comparação com o baseline conhecido.

Uma execução interrompida pode ser repetida: o cache em `render_cache.json` reutiliza renders válidos. Para retomar apenas a matriz de renders a partir da cena já salva, use `work/blender/sprite-refresh-production-v003/render_full.py` no Blender em modo background.

## Fontes de verdade

- Configurações modulares: `tools/blender/sprite_refresh/production_config.py`
- Geração Blender: `tools/blender/sprite_refresh/sprite_refresh_production.py`
- Entrada Blender: `work/blender/sprite-refresh-production-v003/entry.py`
- Retomada do lote: `work/blender/sprite-refresh-production-v003/render_full.py`
- Atlases e pranchas: `tools/blender/sprite_refresh/build_production_atlases.py`
- Validação: `tools/blender/sprite_refresh/validate_production.py`
- Integração: `tools/blender/sprite_refresh/integrate_production_assets.py`
- Validação do jogo e testes: `tools/blender/sprite_refresh/validate_game_production.py`

## Ordem de aprovação

`preservation_baseline.json` → cena e fontes individuais → `individual_manifest.json` → atlases/pranchas → `PRODUCTION_VALIDATION_RESULTS.md` sem reprovação → integração pública → validação de runtime.
