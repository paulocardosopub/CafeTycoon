# QA e evidências — v0.0.7 C3-BR

## Resultado final

- 10 personagens definitivos carregados: 2 jogadores, 1 cozinheira, 1 garçom e 6 clientes.
- 3.784 PNGs individuais RGBA, totalizando 52,13 MB nas fontes de exportação.
- 10 folhas de sprites públicas, totalizando 15,72 MB.
- Frames consistentes de 112×168 px e pivô `(56,160)`.
- Quatro direções reais por animação: NE/right, NW/up, SE/down e SW/left.
- Fonte Blender de 3,68 MB com 10 coleções, 10 armatures, 159 ações persistentes, 10 malhas faciais com shape keys e 46 materiais.
- Manifesto central e dez manifests individuais presentes.
- Aliases antigos preservados para jogadores, funcionários e clientes.
- Seis clientes consecutivos usam seis modelos diferentes antes de repetir o ciclo.

## Verificação automatizada

- TypeScript/lint: aprovado.
- Testes: 239 aprovados em 20 arquivos.
- Testes C3-BR: carregamento, contagem exata, fontes Blender, rigs, ações, shape keys, animações por função, quatro direções, frames, FPS, loops, pivôs, RGBA, aliases e fallbacks aprovados.
- Build de produção: aprovado; saída total de 34,77 MB.
- Stress existente: 20 clientes simultâneos e ciclos prolongados continuam aprovados.
- Saves antigos: migrações e testes de serialização permanecem aprovados; IDs persistentes não foram removidos.

## Verificação visual na gameplay

- Desktop em zoom 0,5×, 1× e 2×: aprovado.
- Mobile 390×844: aprovado.
- Modo técnico com grid, slots, facing e profundidade: aprovado.
- Console após a correção de fallback: sem erros ou avisos.
- Caminhada, idle, sentar, espera, serviço e ações de trabalho foram observados na simulação real.
- Ordenação visual permanece baseada no ponto dos pés; personagens passam corretamente à frente e atrás de móveis.

## Evidências

- Lineup: `artifacts/v007/blender/c3_br_v007_full_refined.png`.
- Personagem masculino com braço corrigido: `artifacts/v007/blender/c3_br_player_male_arm_fixed_v22.png`.
- Gameplay final 0.0.7: `artifacts/v007/gameplay/c3_br_v007_final.png`.
- Zooms: `c3_br_desktop_zoom_050.png`, `c3_br_desktop_normal.png` e `c3_br_desktop_zoom_200.png`.
- Mobile: `c3_br_mobile_390x844.png`.
- Modo técnico: `c3_br_technical_mode.png`.

## Limitação conhecida

O bundle principal do Phaser continua acima de 500 kB minificado, gerando o aviso informativo já esperado do Vite. Os sprites C3-BR são folhas separadas e não foram incorporados ao JavaScript; não houve erro de build nem regressão funcional.
