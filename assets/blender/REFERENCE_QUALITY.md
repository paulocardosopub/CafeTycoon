# Perfil de referência `reference-canonical-v3`

As quatro imagens fornecidas em 19 de julho de 2026 definem o padrão mínimo, sem serem copiadas para o runtime:

- cozinheira: quatro direções, seis poses, coque cacheado e uniforme legível;
- cliente: quatro direções, seis poses, jaqueta mostarda e jeans;
- fogão: quatro orientações, desligado e funcionando;
- geladeira: quatro orientações, fechada e aberta.

O mesmo vocabulário industrial se aplica ao balcão de serviço e às bancadas: proporção coerente com o footprint, tampo destacado, painéis e puxadores legíveis, faces traseiras preservadas e enquadramento sem cortes.

Os quatro PNGs originais ficam preservados em `assets/blender/references/`. O Blender remove o fundo magenta, recorta, redimensiona com nearest-neighbor e reorganiza essas referências nos sheets definitivos de cozinheira, cliente, fogão e geladeira. Os demais assets continuam gerados por geometria, materiais, câmera e iluminação sob o mesmo contrato visual. Todos os arquivos finais têm fundo transparente, pixels nítidos, escala nativa e manifest individual.
