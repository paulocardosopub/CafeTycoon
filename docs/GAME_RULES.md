# Regras confirmadas

- Versão atual: **0.0.2**. A câmera tem ângulo fixo; permite arraste e zoom em 0,5×, 1× ou 2×.
- Movimento segue blocos isométricos 64×32 com interpolação tile-to-tile. A* nunca atravessa células bloqueadas, ocupadas ou reservadas por outra pessoa.
- O restaurante ocupa 18×18 blocos e se conecta a uma faixa externa. Clientes nascem na rua, caminham até a entrada aberta e voltam à rua antes de desaparecer.
- Funcionários, proprietário e clientes usam multiplicador global de movimento 2×. Durações-base de preparo manual e produção programada também usam 2×; bônus de profissão e melhoria continuam cumulativos.
- Mesa exige ponto do garçom e cadeiras acessíveis. Seus estados vão de livre a limpeza.
- Clientes entram, aguardam mesa, sentam, pedem, recebem, comem, pagam e saem. Paciência zerada causa desistência e −2 de reputação.
- Pedidos usam prato pronto primeiro. Sem prato pronto, ingredientes são reservados uma única vez e a receita percorre estações por tarefas.
- Cozinheiro, garçom e proprietário reservam tarefas no mesmo `TaskManager`; uma ação não pode ter dois executores.
- O proprietário só busca tarefas da função selecionada. XP é concedida após conclusão real e o bônus profissional afeta sua velocidade.
- Produção programada para sem ingredientes ou espaço. Estoque e pratos nunca excedem capacidades.
- Offline usa cálculo resumido, no máximo 8 horas. Vendas exigem pratos existentes; produção exige ingredientes e espaço. O horário é reclamado uma vez antes do relatório.
- A posição e o footprint visual da v0.0.2 são migrados no save sem alterar moedas, estoque, progressão ou balanceamento da v0.0.1.
