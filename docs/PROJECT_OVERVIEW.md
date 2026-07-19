# Visão do projeto

**Bistrô Bloom** é um simulador web original de restaurante. A v0.0.1 entrega uma vertical jogável em um mapa 18×18: o jogador cria seu personagem, escolhe onde ajudar e administra estoque, receitas, produção e melhorias enquanto clientes percorrem um ciclo completo.

## Implementado

- Câmera isométrica fixa com arraste e zoom; grade lógica e A*.
- Mesas acopladas a cadeiras (2 e 4 lugares), validação de acesso e estados.
- Clientes com fila, paciência, pedidos, refeições, pagamento, desistência e saída.
- Cozinheiro, garçom e personagem com tarefas e reservas compartilhadas.
- Quatro receitas data-driven, nove ingredientes e sete estações.
- Estoque, compras, pratos prontos, fila programada, economia, XP e três melhorias.
- Perfil visual, quatro progressões profissionais e bônus simples de velocidade.
- Save versionado em IndexedDB (com fallback local), autosave e progresso offline de até 8 h.

## Futuro, não implementado

Expansão/edição de mapa, fornecedores, salários, cosméticos adicionais, áudio completo, nuvem, rankings, visitas, eventos e multiplayer real.
