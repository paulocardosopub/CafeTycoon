# Bistrô Bloom — v0.0.2

Jogo web original de gerenciamento de restaurante. A versão 0.0.2 traz mundo isométrico em pixel art, grade 64×32, personagens animados em quatro direções, móveis com footprints exatos, balcão com dois lados de trabalho e circulação visível de clientes pela rua. Economia, estoque, receitas, progressão, save e cálculo offline continuam compatíveis com a 0.0.1.

## Executar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

Abra o endereço local exibido pelo Vite (normalmente `http://localhost:5173`).

## Validar

```bash
npm run test
npm run build
```

Controles: arraste o restaurante com o mouse ou toque; use a roda para alternar entre zoom 0,5×, 1× e 2×. Pressione **D** para mostrar a grade técnica, reservas, ocupação e rotas. O personagem trabalha por tarefas: escolha **Onde ajudar?** e, se quiser, priorize uma ação pelo painel **Tarefas** ou clicando em uma mesa/estação.

## Limitações conhecidas

- O atlas raster é montado no carregamento a partir de arte pixelada original; ainda não existe editor de layout ou importação de sprites externos.
- Cada grupo de clientes usa um representante visual e reserva o número correto de cadeiras.
- A rua é uma faixa de circulação do mapa inicial, sem tráfego de veículos ou mudança de bairro.
- Não há conteúdo da 0.0.3 implementado.

Os documentos de arquitetura, conteúdo e padrão visual ficam em [`docs/`](docs/PROJECT_OVERVIEW.md), incluindo o [`PIXEL_ART_GUIDE.md`](docs/PIXEL_ART_GUIDE.md).
