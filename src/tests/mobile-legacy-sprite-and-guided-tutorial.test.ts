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
    expect(scene).toContain("? requestedBlenderId : 'b3_preparation_counter'");
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

  it('posiciona e salva o kit inicial inteiro com um único clique', () => {
    const state = createDefaultState(0);
    state.coins = 100_000;
    state.construction.placedFurniture = [];
    state.construction.storedFurniture = [];
    const buyer = new ConstructionEditor(state);
    for (const placement of TUTORIAL_SETUP_PLACEMENTS) expect(buyer.purchase(placement.definitionId).ok).toBe(true);
    expect(buyer.confirmPurchases().ok).toBe(true);
    const editor = new ConstructionEditor(state);
    const stored = [...editor.draft.construction.storedFurniture];
    const placements = TUTORIAL_SETUP_PLACEMENTS.map((placement) => {
      const index = stored.findIndex((item) => item.definitionId === placement.definitionId);
      const [item] = stored.splice(index, 1);
      return { definitionId: placement.definitionId, gridX: placement.x, gridY: placement.y, orientation: placement.orientation, storedItemId: item.id };
    });
    expect(editor.placeStoredBatch(placements).ok).toBe(true);
    expect(editor.confirm().ok).toBe(true);
    expect(state.construction.placedFurniture).toHaveLength(6);
    expect(state.construction.placedFurniture.filter((item) => item.definitionId === 'dining.chair.basic').every((item) => item.state.linkedTableId)).toBe(true);
  });

  it('leva o tutorial ao kit e usa o botão único de posicionamento', () => {
    const ui = source('../ui/GameUI.ts');
    const shop = source('../ui/ConstructionShop.ts');
    expect(ui).toContain("constructionShop.open('shop', 'tutorial-kit')");
    expect(shop).toContain('data-editor-action="tutorial-place-all"');
    expect(shop).toContain('.tutorial-placement-guide');
    expect(source('../styles.css')).toContain('.construction-live-overlay .tutorial-placement-guide{pointer-events:auto}');
    expect(shop).not.toContain('tutorial-place-suggested');
  });

  it('compacta a produção e agrupa lotes iguais por receita', () => {
    const ui = source('../ui/GameUI.ts');
    expect(ui).toContain('const groupedTasks =');
    expect(ui).toContain('${group.tasks.length} ${group.tasks.length === 1 ? \'lote\' : \'lotes\'}');
    expect(ui).not.toContain('<h3>Planos ativos</h3>');
    expect(ui).toContain('production-guide compact');
    expect(ui).toContain('class="production-meta"');
    expect(ui).toContain('class="production-requirement"');
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
