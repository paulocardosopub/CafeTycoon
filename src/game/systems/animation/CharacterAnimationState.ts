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

export function oneShotAnimationFrame(elapsedMs: number, frames: number, fps: number): number {
  if (frames <= 1 || fps <= 0) return 0;
  return Math.min(frames - 1, Math.max(0, Math.floor(Math.max(0, elapsedMs) / (1000 / fps))));
}

export function oneShotAnimationDurationMs(frames: number, fps: number): number {
  return frames <= 0 || fps <= 0 ? 0 : frames * (1000 / fps);
}
