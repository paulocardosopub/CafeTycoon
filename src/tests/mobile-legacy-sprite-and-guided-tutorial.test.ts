import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDefaultState } from '../game/save/defaultState';
import { ConstructionEditor } from '../game/systems/construction/ConstructionEditor';
import { TUTORIAL_SETUP_PLACEMENTS } from '../ui/ConstructionShop';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('mobile sem sprites antigas e tutorial acionável', () => {
  it('não instala nem usa o atlas antigo de personagens na cena do restaurante', () => {
    const scene = source('../scenes/RestaurantScene.ts');
    expect(scene).toContain('installWorldAtlas(this)');
    expect(scene).toContain('canonicalCharacterAsset(actor.assetId)');
    expect(scene).not.toContain("'character-atlas'");
    expect(scene).not.toContain('installPixelAtlases(this');
  });

  it('remove Receitas e Pedidos do menu e mantém notificações substituíveis em duas linhas', () => {
    const ui = source('../ui/GameUI.ts');
    const css = source('../styles.css');
    expect(ui).not.toContain("navButton('recipes'");
    expect(ui).not.toContain("navButton('orders'");
    expect(ui).toContain('stack.replaceChildren(item)');
    expect(css).toContain('-webkit-line-clamp:2');
  });

  it('define a ordem inicial completa e posições válidas para os seis itens', () => {
    expect(TUTORIAL_SETUP_PLACEMENTS.map((item) => item.definitionId)).toEqual([
      'service.c1.isolated', 'washing.b5.sink', 'cooking.a8.coffee',
      'dining.table.basic', 'dining.chair.basic', 'dining.chair.basic',
    ]);
    expect(TUTORIAL_SETUP_PLACEMENTS.map((item) => [item.x, item.y])).toEqual([[3,3],[7,3],[11,3],[9,11],[8,11],[10,11]]);
  });

  it('impõe o limite temporário de dez balcões de serviço', () => {
    const state = createDefaultState(0);
    state.coins = 100_000;
    const editor = new ConstructionEditor(state);
    for (let index = 0; index < 10; index += 1) expect(editor.purchase('service.c1.isolated').ok).toBe(true);
    expect(editor.purchase('service.c1.isolated')).toMatchObject({ ok: false, reason: expect.stringContaining('10 balcões') });
  });

  it('bloqueia a cena atrás de painéis e mantém saldo e navegação no mobile', () => {
    const css = source('../styles.css');
    expect(css).toContain('.panel-host { position: absolute; z-index: 900; inset:0;');
    expect(css).toContain('.panel-host:empty{pointer-events:none');
    expect(css).toContain('.hud-pill.coin { display:flex');
    expect(css).toContain('.management-bar { position:relative; z-index:1200;');
  });
});
