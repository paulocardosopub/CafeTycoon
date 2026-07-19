export const PIXEL_PALETTE = {
  outline: '#241a18', outlineSoft: '#3a2b25', creamLight: '#fff1ce', cream: '#efd6a2', creamShade: '#d9b77e',
  woodDark: '#3a2418', wood: '#70432a', woodMid: '#a86435', woodLight: '#d8954f',
  terracottaDark: '#8e3f2f', terracotta: '#c65b3e', terracottaLight: '#e98255',
  sageLight: '#7d9b68', sage: '#4f7655', sageDark: '#294b3a',
  steelDark: '#2e3840', steel: '#59656a', steelLight: '#899397', steelBright: '#c9d0cd',
  blueDark: '#315b6e', blue: '#4f8293', gold: '#c88b2a', goldLight: '#f1c45b',
  floorKitchen: '#d9b77e', floorDining: '#d9a960', grout: '#b98551',
  grass: '#466a35', grassLight: '#658548', shadow: 'rgba(28,23,20,.32)', white: '#fff8e9', red: '#c94b3c',
} as const;

export type PixelColor = keyof typeof PIXEL_PALETTE;
