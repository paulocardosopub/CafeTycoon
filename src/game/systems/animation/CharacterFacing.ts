import type { CharacterFacingState, Direction, GridPoint, PixelAnimationName, ScreenFacing } from '../../../core/types';
import { gridToWorld } from '../../grid/SpatialLayoutService';

export function movementVectors(from: GridPoint, to: GridPoint): { grid: GridPoint; screen: GridPoint } {
  const fromScreen = gridToWorld(from);
  const toScreen = gridToWorld(to);
  return { grid: { x: to.x - from.x, y: to.y - from.y }, screen: { x: toScreen.x - fromScreen.x, y: toScreen.y - fromScreen.y } };
}

export function facingFromScreenVector(vector: GridPoint, fallback: Direction = 'se'): Direction {
  if (Math.abs(vector.x) < 0.001 && Math.abs(vector.y) < 0.001) return fallback;
  if (vector.x >= 0 && vector.y >= 0) return 'se';
  if (vector.x < 0 && vector.y >= 0) return 'sw';
  if (vector.x < 0 && vector.y < 0) return 'nw';
  return 'ne';
}

export function screenFacingFromVector(vector: GridPoint, fallback: ScreenFacing = 'front'): ScreenFacing {
  if (Math.abs(vector.x) < 0.001 && Math.abs(vector.y) < 0.001) return fallback;
  if (Math.abs(vector.y) >= Math.abs(vector.x)) return vector.y >= 0 ? 'front' : 'back';
  return vector.x >= 0 ? 'right' : 'left';
}

export function facingBetweenTargets(from: GridPoint, target: GridPoint, fallback: Direction = 'se'): Direction {
  return facingFromScreenVector(movementVectors(from, target).screen, fallback);
}

export function characterFacingState(input: {
  currentFacing: Direction; from: GridPoint; target?: GridPoint; action: CharacterFacingState['action'];
  animationKey?: PixelAnimationName; now?: number; lastDirectionChangeAt?: number;
}): CharacterFacingState {
  const vectors = input.target ? movementVectors(input.from, input.target) : { grid: { x: 0, y: 0 }, screen: { x: 0, y: 0 } };
  const targetFacing = input.target ? facingFromScreenVector(vectors.screen, input.currentFacing) : input.currentFacing;
  return {
    currentFacing: targetFacing,
    screenFacing: screenFacingFromVector(vectors.screen),
    movementVectorGrid: vectors.grid,
    movementVectorScreen: vectors.screen,
    targetFacing,
    action: input.action,
    animationKey: input.animationKey ?? (input.action === 'walking' || input.action === 'exiting' || input.action === 'carrying' ? 'walk' : 'idle'),
    lastDirectionChangeAt: targetFacing === input.currentFacing ? input.lastDirectionChangeAt ?? 0 : input.now ?? Date.now(),
    reason: input.target ? `${input.action}: alvo ${input.target.x},${input.target.y}` : `${input.action}: mantém direção válida`,
  };
}
