# Auditoria jogável — versão 0.0.3

Data: 19 de julho de 2026

## Resultado

A versão 0.0.3 foi aprovada para publicação. O escopo permanece um jogo Phaser 2D; o Blender é usado somente como pipeline de autoria e renderização de pixel art, sem carregar arquivos `.blend` em tempo de execução.

Reauditoria visual: o perfil `reference-canonical-v3` substitui o lote simplificado sem mudar a versão do jogo. Cozinheira, cliente, fogão e geladeira são derivados diretamente dos anexos; personagens usam 96×144 em escala nativa, mundo 192×192 e balcão de serviço 256×192.

## Verificações automatizadas

- 10 arquivos de teste executados.
- 57 testes aprovados, sem falhas.
- Compilação TypeScript e build de produção aprovados.
- 36 ativos Blender validados, incluindo dimensões, RGBA, direções, animações, miniaturas, cópias públicas, manifest e arquivos-fonte editáveis.
- Exercícios de stress com 20 clientes simultâneos e 50 ciclos de entrada/saída.
- Validação offline parametrizada em 10 minutos, 1 hora, 4 horas, 8 horas e 12 horas, respeitando o limite de 8 horas.

## Auditoria jogável no navegador

- Criação de perfil, escolha de cabelo e dupla confirmação.
- Abertura do restaurante com restauração do save 0.0.3.
- Exibição dos sprites gerados pelo Blender e fallback procedural disponível.
- Pausa e velocidades 1×, 2× e 4×; a abertura sempre retorna para 1×.
- Compra rápida de estoque, ordenação por urgência, confirmação e atualização da quantidade.
- Catálogo visual dos nove equipamentos de nível 1.
- Ocupação de 10 assentos, pedidos, balcão com três retiradas e alertas operacionais.
- Reload durante operação com clientes ativos e reconciliação do estado.
- Nenhum erro de console observado durante o percurso normal.

## Regressões cobertas

- O cliente não insiste em uma única mesa bloqueada quando há outro assento alcançável.
- Grupos de até quatro pessoas reservam lugares da mesma mesa de forma atômica.
- Pedido, prato, pagamento, sujeira e limpeza pertencem ao assento correto.
- Reservas de ingredientes impedem duplicação e estoque negativo.
- Pagamentos são idempotentes.
- Clientes presos em saída recebem nova rota e, no último recurso, limpeza segura de todas as referências.
- Save operacional preserva pedidos, transporte, balcão, sujeira e saída sem reaplicar ganhos.

## Observações

- O aviso de tamanho do bundle do Vite é apenas informativo; o build foi concluído.
- Avisos de recuperação segura aparecem somente nos cenários artificiais de congestionamento usados em desenvolvimento.
- O modo de construção e níveis visuais futuros continuam fora do escopo e estão planejados para a 0.0.4 ou posterior.
