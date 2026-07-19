# Regras confirmadas

- Versão atual: **0.0.3**. O jogo continua 2D; Blender é apenas a ferramenta de produção dos PNGs.
- Personagens continuam em footprint 1×1, mas são exibidos em 96×144, escala 1:1 e altura visual próxima de dois blocos; a profundidade é ordenada pelos pés.
- Fogão e geladeira continuam em 2×1, com quatro orientações e estados desligado/funcionando ou fechado/aberto sem alterar pontos de interação.
- O restaurante tem 10 vagas, calculadas pelas cadeiras acessíveis. Cada cadeira reserva um cliente, pedido, prato e sujeira independentemente.
- Um grupo só senta quando encontra lugares suficientes na mesma mesa. Se não houver, aguarda na fila.
- Pessoas terminam no centro dos blocos e não atravessam paredes, móveis, ocupações ou reservas alheias.
- Quando uma rota falha, a simulação espera, libera a reserva, recalcula e tenta outro destino. Saídas usam uma zona de cinco blocos; a remoção segura é o último recurso.
- Pedidos reservam ingredientes uma vez, consomem a reserva ao iniciar o preparo e liberam a reserva no cancelamento.
- O balcão possui três slots exclusivos. Um prato não pode ser preparado, colocado, retirado ou entregue duas vezes.
- Pagamento, reputação e XP são aplicados uma única vez. Ao sair, o cliente libera tarefa, pedido e lugar antes de buscar a rua.
- A limpeza acontece por lugar; outros lugares da mesma mesa continuam utilizáveis.
- Compra rápida nunca excede moedas, capacidade global nem máximo do ingrediente. Pedidos sem insumos permanecem na fila e retomam após reposição.
- Pausa, 1×, 2× e 4× afetam simulação, tarefas, pathfinding e animação. Offline ignora esse seletor; uma nova sessão começa em 1×.
- Offline calcula no máximo 8 horas, exige ingredientes e espaço para produzir e pratos/demanda para vender.
- Saves 0.0.2 migram para schema 3 sem perder perfil, aparência, XP, moedas, estoque ou progressão.
