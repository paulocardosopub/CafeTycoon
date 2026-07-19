# Changelog

## 0.0.3 — 2026-07-19

- Elevado o padrão visual da própria 0.0.3 para `reference-hd-v2`, sem alterar a versão do jogo.
- Vinculados cozinheira, cliente, fogão e geladeira diretamente aos quatro anexos canônicos no perfil `reference-canonical-v3`.
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
