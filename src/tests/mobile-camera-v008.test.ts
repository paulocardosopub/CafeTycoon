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

  it('mantém abertura do restaurante acessível no mobile vertical', () => {
    expect(ui).toContain('data-action="toggle-restaurant"');
    expect(styles).toContain('(orientation:portrait)');
    expect(styles).toContain('.shift-card>button');
    expect(styles).toContain('.shift-card.restaurant-open{display:none}');
    expect(styles).toContain('.shift-card.restaurant-open>button{display:none}');
    expect(ui).toContain("shiftCard?.classList.toggle('restaurant-open', this.state.restaurantOpen)");
  });

  it('abre o restaurante sem recriar o canvas nem a tela de loading', () => {
    const toggleMethod = ui.slice(ui.indexOf('private toggleRestaurant()'), ui.indexOf('private openingRequirements()'));
    expect(toggleMethod).not.toContain('this.renderShell()');
    expect(toggleMethod).toContain('this.renderDynamic()');
  });

  it('fecha um painel quando o jogador toca novamente no mesmo menu', () => {
    expect(ui).toContain('if (this.activePanel === panel) this.close(); else this.open(panel)');
  });

  it('mostra progresso real e evita carregar personagens sem uso', () => {
    expect(ui).toContain('restaurant-loading-progress');
    expect(scene).toContain("this.load.on('progress'");
    expect(scene).toContain('sessionCharacterIds');
  });
});
