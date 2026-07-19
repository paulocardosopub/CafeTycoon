# Regras confirmadas

- Versão atual: **0.0.1**. A câmera tem ângulo fixo; só permite arraste e zoom limitado.
- Movimento segue a grade 18×18 com interpolação visual. A* nunca atravessa células bloqueadas.
- Mesa exige ponto do garçom e cadeiras acessíveis. Seus estados vão de livre a limpeza.
- Clientes entram, aguardam mesa, sentam, pedem, recebem, comem, pagam e saem. Paciência zerada causa desistência e −2 de reputação.
- Pedidos usam prato pronto primeiro. Sem prato pronto, ingredientes são reservados uma única vez e a receita percorre estações por tarefas.
- Cozinheiro, garçom e proprietário reservam tarefas no mesmo `TaskManager`; uma ação não pode ter dois executores.
- O proprietário só busca tarefas da função selecionada. XP é concedida após conclusão real e o bônus profissional afeta sua velocidade.
- Produção programada para sem ingredientes ou espaço. Estoque e pratos nunca excedem capacidades.
- Offline usa cálculo resumido, no máximo 8 horas. Vendas exigem pratos existentes; produção exige ingredientes e espaço. O horário é reclamado uma vez antes do relatório.
