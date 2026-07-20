# Perfil de referência `reference-scene-v5`

As quatro imagens fornecidas em 19 de julho de 2026 definem o padrão mínimo de escala, densidade, contorno e iluminação. Elas são referências de linguagem visual, não um catálogo literal que deve ser repetido:

- cozinheira: quatro direções, seis poses, coque cacheado e uniforme legível;
- cliente: quatro direções, seis poses, jaqueta mostarda e jeans;
- fogão: quatro orientações, desligado e funcionando;
- geladeira: quatro orientações, fechada e aberta.

O mesmo vocabulário industrial se aplica ao balcão de serviço e às bancadas: proporção coerente com o footprint, tampo destacado, painéis e puxadores legíveis, faces traseiras preservadas e enquadramento sem cortes.

Os quatro PNGs originais ficam preservados em `assets/blender/references/`. O Blender remove o fundo magenta, recorta e usa a referência do cliente para derivar oito identidades com tons de pele, cabelos, roupas, acessórios e acentos distintos. Móveis e equipamentos são reenquadrados por frame em uma linha de piso comum, sem cortes e sem alterar footprints. Todos os arquivos finais têm fundo transparente, pixels nítidos, escala nativa e manifest individual.
