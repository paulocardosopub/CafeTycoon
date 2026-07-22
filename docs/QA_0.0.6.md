# Validação e evidências — v0.0.6

Data: 21/07/2026. Navegador real: Codex in-app Browser. Viewports: 1440×960 e 390×844.

## Resultado automatizado

| Verificação | Resultado |
|---|---|
| Lint | `npm run lint`: aprovado (`tsc --noEmit`) |
| Build | `npm run build`: aprovado, 54 módulos |
| Testes | 16 arquivos, 143/143 testes aprovados |
| Novos testes unitários | 48 casos de aceite em `v006-systems.test.ts` |
| Novos fluxos integrados | 8/8 fluxos A–H em `v006-integration.test.ts` |
| Regressão anterior | 87 testes preservados e aprovados |
| Console do cenário final | nenhum erro ou warning no carregamento limpo |

O build emite apenas o aviso não bloqueante de chunk principal acima de 500 kB (1.840,94 kB; gzip 427,27 kB). Phaser e o jogo continuam num único bundle; divisão dinâmica fica como otimização futura.

## Fluxos integrados

- **A — contratação:** candidato comparado, posição validada, cobrança somente após confirmação e ator criado na posição escolhida.
- **B — reposição manual:** solicitação atômica, estoquista físico, transporte, WorkSlot e histórico concluído.
- **C — reposição automática:** mínimo/alvo, saldo protegido, compra, armazenamento e auditoria.
- **D — produção programada:** 500 unidades em 25 lotes de 20, todas concluídas; três módulos receberam exatamente 200, 200 e 100 pratos, sem estoque negativo.
- **E — falta de espaço:** compra bloqueada, novo armazenamento adicionado e solicitação retomada.
- **F — prioridade:** pedido de cliente ficou acima da produção preventiva.
- **G — offline:** equipe, compras, produção e salários agregados com teto de oito horas.
- **H — migração:** save v0.0.5 preservado e segundo carregamento sem duplicação.

## Vinte evidências visuais obrigatórias

| # | Evidência | Captura |
|---:|---|---|
| 1 | Tela de contratação e catálogo | [`39-equipe-contratacao-desktop-final.png`](../artifacts/v006/39-equipe-contratacao-desktop-final.png) |
| 2 | Comparação, custo, salário e posição | [`40-comparacao-desktop-final.png`](../artifacts/v006/40-comparacao-desktop-final.png) |
| 3 | Painel de funcionários e folha | [`02-equipe-desktop.png`](../artifacts/v006/02-equipe-desktop.png) |
| 4 | Estoquista caminhando com rota | [`26-estoquista-fluxo-1.png`](../artifacts/v006/26-estoquista-fluxo-1.png) |
| 5 | Estoquista chegando ao armazenamento B1 | [`30-estoquista-fluxo-5.png`](../artifacts/v006/30-estoquista-fluxo-5.png) |
| 6 | Estoquista em `carrying` com ingrediente | [`28-estoquista-fluxo-3.png`](../artifacts/v006/28-estoquista-fluxo-3.png) |
| 7 | Central de estoque físico | [`37-estoque-desktop-final.png`](../artifacts/v006/37-estoque-desktop-final.png) |
| 8 | Mínimo e estoque-alvo por ingrediente | [`06-auto-politicas-historico-desktop.png`](../artifacts/v006/06-auto-politicas-historico-desktop.png) |
| 9 | Política automática e limites | [`38-auto-historico-desktop-final.png`](../artifacts/v006/38-auto-historico-desktop-final.png) |
| 10 | Lista de compras e responsável | [`06-auto-politicas-historico-desktop.png`](../artifacts/v006/06-auto-politicas-historico-desktop.png) |
| 11 | Histórico manual e automático | [`06-auto-politicas-historico-desktop.png`](../artifacts/v006/06-auto-politicas-historico-desktop.png) |
| 12 | Central de produção | [`36-producao-500-desktop-final.png`](../artifacts/v006/36-producao-500-desktop-final.png) |
| 13 | Plano visível de 500 unidades | [`07-producao-500-desktop.png`](../artifacts/v006/07-producao-500-desktop.png) |
| 14 | Fila dividida em 25 lotes | [`08-fila-lotes-desktop.png`](../artifacts/v006/08-fila-lotes-desktop.png) |
| 15 | Produção/atores respeitando WorkSlots | [`10-modo-tecnico-workslots-desktop.png`](../artifacts/v006/10-modo-tecnico-workslots-desktop.png) |
| 16 | Três balcões modulares conectados | [`09-salao-tres-balcoes-desktop.png`](../artifacts/v006/09-salao-tres-balcoes-desktop.png) |
| 17 | Modo técnico, tarefa, prioridade, reserva e filtros | [`35-filtros-modo-tecnico-desktop-final.png`](../artifacts/v006/35-filtros-modo-tecnico-desktop-final.png) |
| 18 | Relatório offline com custos e 25 bloqueios explicados | [`41-offline-desktop-final.png`](../artifacts/v006/41-offline-desktop-final.png) |
| 19 | Interface desktop 1440×960 | [`39-equipe-contratacao-desktop-final.png`](../artifacts/v006/39-equipe-contratacao-desktop-final.png) |
| 20 | Interface móvel 390×844 | [`33-estoque-mobile-final-390x844.png`](../artifacts/v006/33-estoque-mobile-final-390x844.png) |

O diretório contém exatamente 20 PNGs; além da matriz acima, preserva variações móveis do relatório, equipe e produção para comparar o breakpoint de 390×844.

## Inspeção visual

- Personagens caminham célula a célula, sem deslizar ou entrar em footprints.
- O estoquista usa a pose de carga e a bolha técnica confirma `restock_purchase`, prioridade 82, ingrediente `beef`, destino B1 e rota em movimento.
- Ingredientes não aparecem flutuando; a carga acompanha o ator.
- Os três balcões 1×1 mantêm seus lados de cozinha/serviço e conexão visual.
- Painéis têm rolagem própria, fechamento sempre visível e textos legíveis.
- No viewport exato 390×844, documento e body medem 390×844 sem overflow global; a navegação inferior usa rolagem horizontal sem scrollbar visível.
- Áreas de toque críticas têm pelo menos 40–44 px no breakpoint móvel.
- Nenhum placeholder visual novo foi introduzido.

## Migração e offline

Migração testada a partir de `gameVersion: 0.0.5`: moedas, inventário, layout, balcões, personagem e quatro funcionários são preservados; políticas começam desligadas e `backup-v0.0.5` é mantido. Uma segunda migração preserva os mesmos IDs, quantidades, tarefas e dinheiro.

O cenário visual de 9 h aplicou somente 8 h: receita bruta 842, compras 20, salários 608, lucro líquido +214 e 25 lotes bloqueados com o motivo “Ingredientes insuficientes”. O relatório não confunde mais plano bloqueado com ausência de produção programada.

## Limitações conhecidas

- O bundle principal ainda pode ser dividido para reduzir o download inicial.
- O catálogo inicial contém dois candidatos renováveis; novos perfis dependem de adicionar seus sprites ao pipeline.
- A navegação móvel com oito áreas é rolável horizontalmente por projeto, para preservar alvos de toque adequados em 390 px.
