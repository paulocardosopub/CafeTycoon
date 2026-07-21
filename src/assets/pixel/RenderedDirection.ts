import type { Direction } from '../../core/types';

// Character sheets need the visual left/right row correction in every
// animation. Chairs and all other world assets keep the manifest's order.
const CORRECTED_CHARACTER_ROWS: Record<Direction, number> = {
  ne: 1,
  nw: 0,
  se: 3,
  sw: 2,
};

export function renderedDirectionRow(
  direction: Direction,
  asset: { kind: string; category: string; orientations: string[] },
  correctCharacterRows = false,
): number {
  if (correctCharacterRows && asset.kind === 'character') return CORRECTED_CHARACTER_ROWS[direction];
  return Math.max(0, asset.orientations.indexOf(direction));
}
