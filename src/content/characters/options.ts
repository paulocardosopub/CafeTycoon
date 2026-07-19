export const CHARACTER_OPTIONS = {
  skin: [
    { id: 'porcelain', label: 'Porcelana', color: '#f6d4bd' },
    { id: 'honey', label: 'Mel', color: '#d99a68' },
    { id: 'cocoa', label: 'Cacau', color: '#8b5a3c' },
    { id: 'ebony', label: 'Ébano', color: '#553521' },
  ],
  hairStyle: [
    { id: 'wave', label: 'Ondulado' },
    { id: 'crop', label: 'Curto' },
    { id: 'bun', label: 'Coque' },
    { id: 'curls', label: 'Cachos' },
  ],
  hairColor: [
    { id: 'espresso', label: 'Espresso', color: '#3a241d' },
    { id: 'chestnut', label: 'Castanho', color: '#74432d' },
    { id: 'copper', label: 'Cobre', color: '#b95f3a' },
    { id: 'midnight', label: 'Noite', color: '#242635' },
  ],
  face: [{ id: 'bright', label: 'Sorridente' }, { id: 'calm', label: 'Sereno' }, { id: 'spark', label: 'Animado' }],
  outfit: [{ id: 'apron', label: 'Avental Bloom' }, { id: 'vest', label: 'Colete casual' }, { id: 'chef', label: 'Dólmã leve' }],
  outfitColor: [
    { id: 'teal', label: 'Folha', color: '#1d766d' },
    { id: 'coral', label: 'Coral', color: '#d96652' },
    { id: 'gold', label: 'Mel', color: '#d49a3a' },
    { id: 'plum', label: 'Ameixa', color: '#76536c' },
  ],
} as const;
