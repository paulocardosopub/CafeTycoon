export type CharacterMotionState = 'idle' | 'walk';

export interface CharacterMotionSource {
  motionState?: CharacterMotionState;
  pathStatus: 'idle' | 'moving' | 'blocked' | 'no_path' | 'arrived';
}

/** Returns to idle immediately when a mover arrives or becomes blocked. */
export function characterMotionState(source: CharacterMotionSource): CharacterMotionState {
  if (source.pathStatus !== 'moving') return 'idle';
  return source.motionState ?? 'walk';
}
