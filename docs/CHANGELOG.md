# Changelog

## 0.0.7 — 2026-07-22

- Primeiro pacote definitivo C3-BR com exatamente dez personagens brasileiros originais.
- Fontes Blender editáveis com dez rigs corporais/faciais, 159 ações e materiais organizados.
- Sprites 112×168 em quatro direções reais, alpha transparente, pivô 56×160 e manifests centralizados.
- Integração de jogador, cozinheira, garçom e seis clientes com fallbacks seguros e aliases para saves antigos.
- Quatro pratos low-poly definitivos ligados às receitas reais, com o mesmo visual no balcão, transporte, mesa e estado de louça usada.
- Balcões agrupam pratos equivalentes em uma única representação e exibem contador apenas a partir de duas unidades.
- Móveis 1×1, mesas, bancos, camadas de assento e âncoras dos personagens revisados sem alterar a lógica econômica.
- Validação em desktop, mobile 390×844 e zooms 0,5×, 1× e 2×.

## 0.0.6 — 2026-07-21

### Correção estrutural espacial

- Unificadas grade, footprints, âncoras inferiores, escalas, profundidade, WorkSlots, SeatSlots e ApproachSlots.
- Corrigido o efeito de móveis “flutuando”: o contato visual passa do centro ao vértice inferior do footprint.
- Normalizadas bases modulares de balcões, fogão, pia, geladeira e armazenamento; elementos funcionais permanecem acima da bancada.
- Mesas agora ocupam 1×1, aceitam no máximo duas cadeiras opostas e preservam excedentes no inventário.
- Editor passa a operar diretamente no salão com preview verde/vermelho, clique/arraste, ✓/×/Escape e desseleção ao concluir.
- Facing usa vetores visuais e personagens parados não permanecem em animação de caminhada.
- Save atualizado para schema 5 com backup e migração idempotente.

- Adicionados `StaffDefinition`, `StaffInstance` e candidatos data-driven, com contratação confirmada, posição inicial validada, limite configurável, gestão, localização, pausa, demissão e persistência.
- Adicionados turnos, folha salarial por período, proteção contra saldo negativo, atraso sem demissão automática, experiência moderada e treinamento com custo/duração.
- Transformado o estoquista em agente físico: compra, transporte, animação de carga, pathfinding, WorkSlot externo e depósito apenas no armazenamento correto.
- Integrados C5, C6, geladeira e freezer à capacidade física por tipo (`dry`, `general`, `refrigerated`, `frozen`), com reservas e overflow legado seguro.
- Evoluída a compra rápida para solicitações atômicas; adicionadas lista de compras, cancelamento, responsável, estados e histórico limitado.
- Adicionadas políticas globais e por ingrediente, desativadas por padrão, com saldo protegido, limites por ciclo/período, deduplicação, capacidade e motivos de bloqueio.
- Adicionada central de produção até 999 unidades, modos, prioridades, lotes de até 50, pausa/retomada/cancelamento, estoque-alvo e distribuição segura entre balcões 1×1.
- Centralizada a coordenação de pedidos, reposição e produção com reservas de funcionário, ingrediente, equipamento, WorkSlot, armazenamento e balcão; pedidos de clientes permanecem prioritários.
- Integrado o personagem do jogador às tarefas de estoque e produção sem salário e sem duplicar lógica.
- Ampliados modo técnico, recuperação de ausência de progresso, filtros, diagnóstico de reservas, tarefa, rota e bloqueios.
- Ampliado o offline determinístico, ainda limitado a 8 horas, para salários, treinamento, compras automáticas, produção, custos e lucro líquido.
- Adicionada migração idempotente de saves 0.0.5 para schema 4, com backup anterior, preservação de equipe/layout/moedas/pratos/ingredientes e relatório de ajustes.
- Adicionados 48 testes unitários de aceite e 8 fluxos de integração, preservando a suíte anterior.
- Validada a interface em desktop e no viewport 390×844, com 20 capturas reais em `artifacts/v006/`.

## 0.0.3 — 2026-07-19

- Elevado o padrão visual da própria 0.0.3 para `reference-hd-v2`, sem alterar a versão do jogo.
- Vinculados cozinheira, cliente, fogão e geladeira diretamente aos quatro anexos canônicos no perfil `reference-canonical-v3`.
- Evoluído o perfil para `reference-family-v4`: anexos viraram referência estilística, oito consumidores receberam identidades distintas e deixaram de repetir literalmente o mesmo exemplo.
- Evoluído o acabamento para `reference-scene-v5`: jogador e todos os funcionários agora compartilham a densidade e proporção dos consumidores detalhados; piso, paredes e balcão seguem a paleta e os materiais da cena completa de referência.
- Neutralizadas as sombras roxas das pranchas de referência em favor de sombras marrons semitransparentes integradas ao piso (`0.0.3-blender-7`).
- Disponibilizada a mesma experiência web para celular, com áreas seguras, altura dinâmica, alvos de toque, gestão rolável e zoom dedicado sem alterar a versão `0.0.3`.
- Corrigida a fila que podia permanecer travada após carregar: entradas alternativas, posições de espera exclusivas, realocação de NPCs sobrepostos e limpeza de cadeiras reservadas por clientes inexistentes.
- Corrigido “Apagar save”: o autosave não recria mais o progresso antigo durante o recarregamento.
- Normalizados os 18 móveis/equipamentos na linha de piso 178/192; corrigidos anchor, margem do frame e depth sorting pela célula frontal do footprint.
- Corrigida a publicação para servir os PNGs externos e invalidar cache por revisão visual, impedindo o fallback procedural antigo.
- Personagens passaram de 64×96 para 96×144, com altura útil próxima de dois blocos, anchor centralizado nos pés e escala 1:1 no Phaser.
- Refeitos todos os personagens, móveis e equipamentos Blender para evitar mistura com os antigos blocos simplificados.
- Adicionados seis frames distintos de caminhada por direção, identidade e roupa consistentes, rostos, mãos, cabelos e acessórios mais detalhados.
- Refeito o fogão 2×1 com quatro orientações, forno duplo, seis queimadores e estados desligado/funcionando.
- Refeita a geladeira 2×1 com quatro orientações, portas articuladas e estados fechada/aberta com interior abastecido.
- Corrigidos grelhas, controles, puxadores e enquadramentos dos equipamentos; o balcão de serviço agora ocupa visualmente os seis blocos sem cortes.
- Atualizados manifest, anchors, filtro nearest, escala e ordenação por pés; adicionada validação de cobertura visual do footprint.

- Corrigidos NPCs presos em `leaving`: zona de saída ampliada, metadados de recuperação, espera entre recálculos, rotas alternativas e limpeza segura de todas as referências.
- Corrigida a seleção de mesa que insistia numa primeira mesa temporariamente bloqueada e fazia clientes seguintes desistirem apesar de haver lugares alcançáveis.
- Reestruturadas mesas para 10 assentos independentes; grupos reservam lugares atomicamente, pedidos/pratos pertencem ao assento e a limpeza libera cada lugar separadamente.
- Reescrita a operação de pedidos, tarefas, reservas de ingredientes, estações e três slots do balcão com proteção contra duplicação.
- Adicionados estoquista e auxiliar de limpeza, funções do proprietário, motivo ocioso, destino e estados completos da tarefa.
- Adicionados alertas operacionais, ocupação/capacidade, pedidos/retiradas, compra rápida confirmada e diagnóstico de ingredientes em falta.
- Adicionadas pausa e velocidades 1×/2×/4× com retorno a 1× na abertura.
- Adicionado schema de save 3 compatível com 0.0.2 e persistência/reconciliação durante pedidos, transporte, balcão, sujeira e saída.
- Validado offline em 10 min, 1 h, 4 h, 8 h e 12 h (limitado a 8), sem estoque negativo nem reaplicação.
- Corrigido o escopo: não há slider/carrossel. Foi criado pipeline modular Blender 5.2 em modo background para modelos low-poly, rig, animações, câmera ortográfica, paleta, PNGs, sprite sheets, miniaturas e manifest.
- Criados 4 estilos do jogador, 8 clientes, 2 cozinheiros, 2 garçons, 1 auxiliar, 1 estoquista, 9 móveis e 9 equipamentos nível 1, todos individuais e renderizados nas quatro direções.
- Mantido Phaser 2D com atlas procedural como fallback; modelos `.blend` nunca são carregados durante o jogo.
- Ampliados testes de ciclo, capacidade, grupos, compras, offline, save, stress, cinquenta saídas e integridade dos assets Blender.

## 0.0.2 — 2026-07-19

- Substituída a apresentação do mundo por pixel art isométrica original, com grade 64×32, atlas raster, renderização sem suavização e zooms 0,5×/1×/2×.
- Adicionados personagens 64×96 em quatro direções, oito variações de clientes e animações de idle, caminhada, trabalho, transporte, sentar e comer.
- Adicionados footprints, frentes livres, pontos de interação, reservas tile-to-tile, ordenação pelos pés/base e modo técnico com ocupação e rotas.
- Redesenhados mesas, cadeiras, lixeira, pisos, paredes, cozinha e balcão; fogão, forno e geladeira usam 2×1, e o balcão separa os lados da cozinha e do salão.
- Removida a porta isolada; adicionadas grama texturizada, calçada/rua e caminhada visível dos clientes ao chegar e ir embora.
- Dobradas as velocidades de movimento de funcionários, jogador e clientes e a velocidade-base de preparo dos pratos.
- Corrigida a camada do balcão de serviço; simplificadas as paredes e redesenhados os equipamentos para leitura imediata.
- Adicionados efeitos de preparo, pratos prontos no balcão, assistente visual e migração de save para dados gráficos v2.
- Mantidos economia, estoque, receitas, progressão e balanceamento da 0.0.1.
- Adicionados guia de pixel art e testes de conversão isométrica, reservas, footprints, atlas, migração e circulação externa.

## 0.0.1 — 2026-07-19

- Criado Bistrô Bloom com identidade visual original e mapa isométrico 18×18.
- Adicionados criação/salvamento do personagem, presença física, quatro funções, tarefas diretas, XP geral/profissional e bônus de velocidade.
- Adicionados cozinheiro, garçom, apoio básico de estoque, gerenciador central de tarefas e reservas.
- Adicionado ciclo de clientes com fila, mesas 2/4, paciência, quatro receitas, preparo em etapas, serviço, pagamento, limpeza e desistência.
- Adicionados nove ingredientes, compras, capacidade, fila de produção, pratos prontos, três melhorias, moedas, reputação, níveis e XP.
- Adicionados IndexedDB, migração/saneamento, autosave, reset confirmado e offline matemático limitado a 8 horas com simulador/relatório.
- Adicionados testes críticos, documentação modular e comandos de build/desenvolvimento.
