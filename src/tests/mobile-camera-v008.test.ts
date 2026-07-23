import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const scene = readFileSync('src/scenes/RestaurantScene.ts', 'utf8');
const ui = readFileSync('src/ui/GameUI.ts', 'utf8');
const styles = readFileSync('src/styles.css', 'utf8');

describe('controles móveis da câmera e construção', () => {
  it('remove os botões móveis de zoom', () => {
    expect(ui).not.toContain('mobile-camera-controls');
    expect(ui).not.toContain('camera-zoom-in');
    expect(ui).not.toContain('camera-zoom-out');
  });

  it('habilita pinça com múltiplos ponteiros', () => {
    expect(scene).toContain('this.input.addPointer(2)');
    expect(scene).toContain('updatePinchGesture');
    expect(scene).toContain('activeCameraPointers');
  });

  it('diferencia toque para colocar de arraste para mover a câmera', () => {
    expect(scene).toContain('pendingFloorTap');
    expect(scene).toContain('Math.hypot(pointer.x - this.pendingFloorTap.startX');
    expect(styles).toContain('Mobile construction: keep most of the screen available for the floor.');
  });
});
