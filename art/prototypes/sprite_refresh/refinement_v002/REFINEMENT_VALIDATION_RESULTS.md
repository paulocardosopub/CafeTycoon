# Validações do refinamento v002

| Validação | Resultado | Evidência |
|---|---|---|
| Arquivo v001 preservado byte a byte | PASS | sha256=adda9d00bb8b52a3838d71f6df62de5e3b84471afd7c149e12d9cd0e97578ed4 |
| Câmera e enquadramento idênticos à v001 | PASS | ortho=2.79999995; frame=(112, 168) |
| Escala, altura, pivô, canvas e âncora preservados | PASS | 11 personagens; altura=2,200 BU; pivot=(0,0,0); canvas=112×168; pés=(56,158) |
| Caminhada comum mantém os mesmos keyframes | PASS | assinatura de rotação/localização dos 11 ossos deformadores × 4 frames |
| Cozinha mantém os mesmos keyframes | PASS | assinatura de rotação/localização dos 11 ossos deformadores × 4 frames |
| Pernas da bandeja idênticas à caminhada aprovada | PASS | thigh/shin L/R × 4 frames sem alteração |
| Modularidade preservada e ampliada | PASS | BODY/HEAD/FACE/HAIR/CLOTHING/APRON/ACCESSORIES separados nos 11 modelos |
| Rig compartilhado funciona com controles IK | PASS | 11 rigs usam SpriteRefresh_Humanoid_Shared_v002; 2 hand IK + 2 pole targets |
| Cinco rostos possuem geometrias próprias | PASS | assinaturas distintas=5/5 |
| Cinco cabelos possuem silhuetas modeladas próprias | PASS | estilos/contagens distintas=[('bun', 11), ('coily', 17), ('curls', 16), ('short', 11), ('wave', 13)] |
| Cinco jogadores possuem combinações de roupa próprias | PASS | combinações tecido/avental=5/5 |
| Roupas têm detalhes funcionais legíveis | PASS | golas, punhos, botões, costuras, sola/abertura e avental confeccionado presentes |
| Materiais separam pele, cabelo, tecidos, couro e metal | PASS | grupos={'skin': True, 'hair': True, 'shirt/apron': True, 'shoe': True, 'metal': True}; roughness=[0.27, 0.31, 0.42, 0.46, 0.62, 0.64, 0.75, 0.76, 0.78, 0.8, 0.81, 0.82, 0.84, 0.87, 0.88] |
| Sem peças de rosto/roupa deslocadas ou clipping estrutural | PASS | peças deslocadas=[] |
| Cotovelos relaxados entre 80° e 100° | PASS | mín/máx=81.48°/81.48° |
| Cotovelos permanecem próximos ao tronco | PASS | amostras=32; limite lateral=0,46 BU |
| Mãos ficam sob os dois pontos de apoio | PASS | palmas abaixo do fundo, próximas às laterais e afastadas do torso em 16 poses |
| Bandeja permanece horizontal | PASS | normal da superfície alinhada ao Z global nas 4 direções × 4 frames |
| Oscilação vertical da bandeja limitada a 2 px | PASS | máxima=1.715 px |
| Superfície da bandeja continua completamente vazia | PASS | sem comida, pratos, copos, talheres, guardanapos, filhos ou decoração |
| Somente renders de personagens foram produzidos | PASS | idle=44/44; animações=48/48; móveis=0 |
| PNGs permanecem RGBA 112×168 e transparentes | PASS | 92 arquivos individuais |
| Nenhum personagem ou detalhe foi cortado | PASS | bbox opaco com margem mínima de 1 px |
| Pés permanecem exatamente na linha visual da v001 | PASS | v001/v002 min=156; máx=160; âncora=158 |
| Todas as pranchas e prévias solicitadas existem | PASS | ausentes=[] |
| Nenhum arquivo em src/ foi alterado | PASS | git status -- src vazio |

**Resumo:** 26 passaram; 0 falharam.
