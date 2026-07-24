# Cafe Mania — v0.0.10

Versão pública de teste do jogo web de gerenciamento de restaurante em Pixel 2.5D isométrico.

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
- Use **Produção** para programar lotes de até 300 unidades, pagos diretamente em moedas.
- Use **Onde ajudar?** para colocar o personagem do jogador na mesma fila de tarefas da equipe.
- Clientes entram, sentam, pedem, pagam e saem individualmente.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Sistemas e balanceamento da v0.0.6](docs/V0.0.6_SYSTEMS.md)
- [Validação e evidências da v0.0.6](docs/QA_0.0.6.md)
- [Changelog](docs/CHANGELOG.md)

## Limitações conhecidas

- O catálogo inicial oferece dois candidatos por renovação; os dados já suportam novos candidatos.
- Turnos usam uma agenda diária padrão, sem férias, doenças ou escalas complexas.
- A suíte ainda contém testes históricos de versões anteriores, mantidos como dívida técnica e fora do contrato atual de produção.
- Não há despensa, estoque individual de ingredientes ou clientes em grupo no runtime atual.
