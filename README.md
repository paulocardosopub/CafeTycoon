# Bistrô Bloom — v0.0.7

Jogo web de gerenciamento de restaurante em Pixel 2.5D isométrico. A v0.0.7 integra o primeiro pacote definitivo C3-BR com dez personagens brasileiros originais modelados, rigados e animados no Blender.

A correção estrutural da v0.0.6 unifica grade, footprints, contato visual com o piso, direção de personagens, mesas de dois lugares e edição transacional diretamente no salão. Consulte [o contrato espacial](docs/STRUCTURAL_GRID_FIX.md) e [as evidências de QA](docs/QA_STRUCTURAL_FIX.md).

## Executar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra o endereço local exibido pelo Vite, normalmente `http://localhost:5173`.

## Validar

```bash
npm test
npm run build
```

O projeto não possui uma etapa separada de lint: `npm run build` executa a checagem estrita do TypeScript antes de gerar a versão de produção.

## Jogar

- Arraste o restaurante para mover a câmera; use a roda ou os botões móveis para zoom.
- Use **Equipe** para contratar, localizar, pausar, treinar ou demitir funcionários.
- Use **Estoque** para preparar compras, configurar mínimos/alvos e acompanhar o estoquista.
- Use **Produção** para programar até 999 unidades, escolher lotes e manter estoque-alvo.
- Use **Onde ajudar?** para colocar o personagem do jogador na mesma fila de tarefas da equipe.
- Em desenvolvimento, pressione **D** para inspecionar rotas, WorkSlots, prioridades e reservas.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Sistemas e balanceamento da v0.0.6](docs/V0.0.6_SYSTEMS.md)
- [Validação e evidências da v0.0.6](docs/QA_0.0.6.md)
- [Changelog](docs/CHANGELOG.md)

## Limitações conhecidas

- O catálogo inicial oferece dois candidatos por renovação; os dados já suportam novos candidatos.
- Turnos usam uma agenda diária padrão, sem férias, doenças ou escalas complexas.
- Compras representam o fluxo local do bistrô; não há mapa externo de fornecedores.
- A fila mostra até 60 lotes simultaneamente na interface, embora o save preserve o plano completo.
