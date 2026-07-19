# Visão do projeto

**Bistrô Bloom** é um simulador web original de restaurante. A v0.0.2 mantém a vertical jogável da versão anterior e substitui a apresentação do mundo por pixel art isométrica baseada em grade. O salão e a cozinha ocupam uma área lógica 18×18, ligada a uma faixa externa caminhável onde clientes chegam e partem.

## Implementado

- Câmera isométrica fixa com arraste e zoom discreto; grade 64×32, A*, reservas tile-to-tile e modo técnico.
- Atlas raster original para pisos, paredes, móveis, equipamentos, efeitos e personagens 64×96.
- Mesas acopladas a cadeiras (2 e 4 lugares), validação de acesso e estados.
- Clientes variados com quatro direções, fila, paciência, pedidos, refeições, pagamento, desistência e caminhada pela rua na entrada/saída.
- Cozinheiro, garçom, assistente e personagem com animações de trabalho, transporte e reservas compartilhadas.
- Equipamentos de cozinha com footprints, frente livre, efeitos de uso e balcão de retirada com lado da cozinha e lado do salão.
- Quatro receitas data-driven, nove ingredientes e sete estações.
- Estoque, compras, pratos prontos, fila programada, economia, XP e três melhorias.
- Perfil visual, quatro progressões profissionais e bônus simples de velocidade.
- Save versionado em IndexedDB (com fallback local), autosave e progresso offline de até 8 h.

## Não implementado nesta versão

Editor e expansão de mapa, fornecedores, salários, cosméticos adicionais, áudio completo, tráfego externo, nuvem, rankings, visitas, eventos e multiplayer real. Nada da v0.0.3 foi iniciado.
