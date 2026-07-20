# Visão do projeto

**Bistrô Bloom** é um simulador web 2D de restaurante em pixel art isométrica. A versão atual é a **0.0.3**, dedicada à auditoria jogável e à estabilização da operação.

## Implementado

- Restaurante lógico 18×18 conectado à rua, grade 64×32, A*, reservas tile-to-tile, câmera com arraste e zoom discreto.
- Capacidade calculada por cadeira acessível: uma mesa de 2 e duas mesas de 4, totalizando 10 lugares independentes.
- Clientes individuais e grupos de até quatro, com assento, pedido, prato, sujeira, limpeza e pagamento associados ao lugar correto.
- Ciclo completo de entrada, fila, atendimento, cozinha, balcão com três slots, refeição, pagamento idempotente e saída com recuperação de rota.
- Fila central de tarefas com prioridade, reservas, estados explícitos, cancelamento seguro e retomada após save/load.
- Quatro funcionários e proprietário atuando em cozinha, atendimento, limpeza e estoque/apoio.
- Estoque com reservas, alertas por urgência e compra rápida confirmada, respeitando moedas, capacidade, meta e pedidos pendentes.
- Pausa e velocidades 1×, 2× e 4×; a seleção volta a 1× ao abrir o jogo.
- Save schema 3 compatível com 0.0.2, incluindo clientes, pedidos, mesas, estações, balcão e tarefas em andamento.
- Progresso offline matemático limitado a 8 horas e protegido contra dupla aplicação.
- Pipeline Blender automatizado para gerar modelos-fonte, PNGs transparentes, sprite sheets, miniaturas e manifest sem carregar 3D no jogo.
- Perfil visual `reference-scene-v5`: cena completa e anexos usados como padrão e não como cópia literal; jogador, funcionários e oito clientes distintos usam personagens 96×144, mundo 192×192 alinhado ao piso, balcão 6×1 em 256×192 e equipamentos industriais com estados completos.

## Fora do escopo da 0.0.3

Editor e expansão de mapa, sistema completo de construção, upgrades visuais acima do nível 1, fornecedores, salários, cosméticos ampliados, nuvem, rankings, visitas, eventos e multiplayer real. A estrutura de dados permite níveis futuros, mas não exibe cópias falsas dos níveis 2 a 4.
