import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('experiência mobile da v0.0.4', () => {
  it('preserva área segura, controles de toque e zoom acessível no celular', () => {
    const root = resolve(import.meta.dirname, '../..');
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8');
    const ui = readFileSync(resolve(root, 'src/ui/GameUI.ts'), 'utf8');
    const scene = readFileSync(resolve(root, 'src/scenes/RestaurantScene.ts'), 'utf8');
    expect(html).toContain('viewport-fit=cover');
    expect(css).toContain('100dvh');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('@media (pointer: coarse)');
    expect(ui).toContain('mobile-camera-controls');
    expect(scene).toContain("gameEvents.on<number>('camera:zoom-step'");
  });
});
