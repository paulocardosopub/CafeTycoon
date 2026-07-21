# Correção estrutural espacial — v0.0.6

## Causas-raiz

1. Grade, rotação, footprint, escala e facing eram calculados em módulos diferentes.
2. O último pixel opaco dos móveis era preso ao centro do losango. Como o render usa esse pixel como contato com o piso, pés e rodízios ficavam meia célula suspensos.
3. Escalas globais reduzidas ignoravam o enquadramento nativo desigual dos PNGs. Balcão, pia e fogão deixavam de compartilhar uma base modular.
4. Mesas aceitavam relações antigas de quatro lugares e a prévia local não tratava cadeira órfã/não oposta como inválida.
5. O editor mostrava móveis instalados numa lista paralela e o ✓ podia aparecer sem sessão ativa; ✓/× não removiam a seleção.
6. Facing lógico e facing visual usavam eixos diferentes, permitindo andar de costas ou permanecer em `walk` depois de parar.

## Contrato único

`SpatialLayoutService` é a fonte para tile 64×32, snap inteiro, conversões, footprint rotacionado, centro, contato inferior, bounds, profundidade, WorkSlots, SeatSlots e ApproachSlots. O contato visual é:

- 1×1: centro do losango + 16 px;
- 2×1 ou 1×2: centro do footprint + 24 px;
- demais footprints: `(largura + profundidade) × 8 px` abaixo do centro projetado.

O sprite continua com `baseAnchor = (0,5; 178/192)`. A posição muda para o vértice inferior do footprint; a coordenada lógica não recebe offset. Personagens sentados usam a mesma âncora da cadeira. Personagens andando continuam ancorados pelo pé no centro lógico de navegação.

## Catálogo normalizado

| Código | Móvel | Footprint | Categoria de altura | Escala | Âncora | Interação |
|---|---|---:|---|---:|---|---|
| A1 | Fogão industrial | 2×1 / 1×2 | STANDARD_COUNTER | 1.00 | base inferior | 2 WorkSlots |
| A2 | Forno de convecção | 1×1 | STANDARD_COUNTER | 0.51 | base inferior | 1 WorkSlot |
| A3 | Chapa industrial | 1×1 | STANDARD_COUNTER | 0.60 | base inferior | 1 WorkSlot |
| A4 | Fritadeira industrial | 1×1 | STANDARD_COUNTER | 0.60 | base inferior | 1 WorkSlot |
| A5 | Caldeira industrial | 1×1 | STANDARD_COUNTER | 0.68 | base inferior | 1 WorkSlot |
| A6 | Grelha industrial | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | 1 WorkSlot |
| A7 | Forno de padaria | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | 1 WorkSlot |
| A8 | Máquina de café | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | 1 WorkSlot |
| B1 | Geladeira industrial | 1×1 | TALL | 1.00 | base inferior | 1 WorkSlot |
| B2 | Freezer industrial | 1×1 | TALL | 1.00 | base inferior | 1 WorkSlot |
| B3 | Bancada de preparação | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | 1 WorkSlot |
| B4 | Ingredientes e corte | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | 1 WorkSlot |
| B5 | Pia industrial | 2×1 / 1×2 | STANDARD_COUNTER | 0.90 | base inferior | 2 WorkSlots |
| B6 | Lava-louças | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | 1 WorkSlot |
| B7 | Lavagem com duas cubas | 2×1 / 1×2 | STANDARD_COUNTER | 0.66 | base inferior | 2 WorkSlots |
| B8 | Mesa de massas | 2×1 / 1×2 | STANDARD_COUNTER | 1.00 | base inferior | 2 WorkSlots |
| C1–C4 | Módulos de serviço | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | cozinha + garçom |
| C5 | Despensa seca | 1×1 | TALL | 1.00 | base inferior | armazenamento |
| C6 | Estante de ingredientes | 1×1 | TALL | 1.00 | base inferior | armazenamento |
| C7 | Pratos e talheres | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | armazenamento |
| C8 | Lixeira e reciclagem | 1×1 | STANDARD_COUNTER | 0.63 | base inferior | limpeza |
| C9 | Bebidas frias | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | preparo |
| C10 | Bancada de corte | 1×1 | STANDARD_COUNTER | 1.00 | base inferior | preparo |
| T1 | Mesa básica | 1×1 | LOW | 0.82 | base inferior | até 2 SeatSlots |
| CH1 | Cadeira básica | 1×1 | LOW | 0.93 | base inferior | SeatSlot + ApproachSlot |
| D1 | Planta | 1×1 | LOW | 1.00 | base inferior | decoração |

As escalas excepcionais são compensações declaradas para o enquadramento transparente do arquivo-fonte. A largura visual resultante volta a corresponder a 64 px por módulo ou 96 px na projeção de dois módulos.

## Mesas e cadeiras

- Uma mesa ocupa exatamente 1×1 e aceita no máximo duas cadeiras.
- Duas cadeiras precisam ser adjacentes e diametralmente opostas.
- Mover/girar uma mesa transforma mesa e cadeiras de forma atômica.
- Uma cadeira fora da oposição fica vermelha e o ✓ é bloqueado.
- Saves antigos guardam cadeiras excedentes em `storedFurniture`; nenhuma compra é apagada.

## Editor transacional

O salão é a própria superfície de edição. Clique ou arraste cria uma prévia snapped; verde permite ✓, vermelho bloqueia ✓; × e Escape restauram o snapshot. ✓ e × encerram a sessão e desselecionam o móvel. Itens recém-colocados iniciam uma sessão válida imediatamente. Só “Confirmar e reabrir” grava o draft no estado persistente.

## Save schema 5

A migração arredonda coordenadas antigas, hidrata metadados espaciais, normaliza mesas e preserva excedentes. Ela é idempotente e o repositório cria `backup-before-spatial-schema-5` antes de substituir um save anterior.
