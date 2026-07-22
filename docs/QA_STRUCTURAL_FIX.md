# QA da correção estrutural — v0.0.6

## Resultado automatizado

- 60 requisitos unitários numerados e um teste auxiliar de contrato espacial.
- 10 fluxos integrados A–J.
- Regressão completa, lint e build registrados na entrega.

## Evidências reais

As capturas estão em `artifacts/structural-fix/`.

| # | Critério visual | Evidência |
|---:|---|---|
| 1 | Estado anterior do salão | `00-before-live.png` |
| 2 | Escala inicial corrigida | `01-after-desktop.png` |
| 3 | Base modular recalibrada | `05-aligned-styled-desktop.png` |
| 4 | Móveis tocando o chão | `08-ground-contact-verified.png` |
| 5 | Cadeira no vértice inferior | `09-chair-ground-anchor.png` |
| 6 | Mesa 1×1 | `09-chair-ground-anchor.png` |
| 7 | Duas cadeiras opostas | `09-chair-ground-anchor.png` |
| 8 | Cliente sentado voltado à mesa | `08-ground-contact-verified.png` |
| 9 | Fogão 2×1 proporcional | `08-ground-contact-verified.png` |
| 10 | Pia 2×1 proporcional | `08-ground-contact-verified.png` |
| 11 | Balcão/preparo 1×1 | `08-ground-contact-verified.png` |
| 12 | Geladeira alta com base 1×1 | `08-ground-contact-verified.png` |
| 13 | Editor sobre o salão | `06-editor-integrated-desktop.png` |
| 14 | Sem lista de instalados | `06-editor-integrated-desktop.png` |
| 15 | Seleção direta no móvel | `09-chair-ground-anchor.png` |
| 16 | Preview verde | `09-chair-ground-anchor.png` |
| 17 | ✓ e × contextuais | `09-chair-ground-anchor.png` |
| 18 | Cadeira não oposta vermelha | `10-chair-invalid-opposition.png` |
| 19 | ✓ bloqueado no vermelho | `10-chair-invalid-opposition.png` |
| 20 | Erro explicado no salão | `10-chair-invalid-opposition.png` |
| 21 | Cancelamento restaura | `13-confirm-cancel-deselect.png` |
| 22 | Cancelamento desseleciona | `13-confirm-cancel-deselect.png` |
| 23 | Confirmação desseleciona | validação DOM + `13-confirm-cancel-deselect.png` |
| 24 | Salão mobile 390×844 | `11-mobile-390x844-salon.png` |
| 25 | Editor mobile 390×844 | `12-mobile-390x844-editor.png` |
| 26 | Zoom 50% | `14-zoom-50.png` |
| 27 | Zoom 100% | `15-zoom-100.png` |
| 28 | Zoom 200% centralizado | `17-zoom-200-centered.png` |
| 29 | Grade/footprints técnicos | `18-technical-grid-facing.png` |
| 30 | Facing e estado técnico | `18-technical-grid-facing.png` |

## Fluxos integrados

A. mover → confirmar → salvar → migrar/recarregar; B. mover/girar → cancelar; C. dois clientes sentam/olham/levantam; D. quatro direções; E. cadeira não oposta → vermelho → restaurar; F. fogão 2×1 → 1×2; G. categorias de altura; H. balcão preserva pratos; I. toque/arraste/rotação/✓/×; J. migração idempotente preserva excedentes.
