# Fontes Blender 0.0.3

Arquivos `.blend` desta pasta são gerados pelos scripts em `tools/blender/` e continuam editáveis por collection:

- `characters/characters_base.blend`: 4 estilos do jogador, 8 clientes e 6 funcionários; cada collection possui rig, biblioteca compartilhada e marcadores.
- `furniture/furniture.blend`: mesas, cadeira, balcões, armazenamento e decoração.
- `equipment/kitchen_equipment.blend`: famílias de equipamento no nível visual 1.

O perfil `reference-canonical-v3` define escala, materiais, câmera, contorno e iluminação. Cozinheira, cliente, fogão e geladeira mantêm vínculo explícito com os quatro anexos canônicos; cada asset permanece separado por collection/ID. Níveis 2 a 4 não possuem modelos ou placeholders nesta versão.

Não edite apenas o binário como fonte final: ajuste primeiro os módulos Python e regenere para manter o pipeline reproduzível.
