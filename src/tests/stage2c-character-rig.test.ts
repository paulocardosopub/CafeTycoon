import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STAGE_2C_CHARACTER_ASSETS, STAGE_2C_RIG_ID } from '../assets/pixel/stage2cCharacterManifest';
import { renderedDirectionRow } from '../assets/pixel/RenderedDirection';
import { FURNITURE_BY_ID } from '../game/data/furniture/catalog';
import { directionBetween } from '../game/navigation/TileMovement';
import { orientedFootprint } from '../game/systems/furniture/FurniturePlacement';

const root = resolve(import.meta.dirname, '../..');
const source = readFileSync(resolve(root, 'src/scenes/RestaurantScene.ts'), 'utf8');

describe('0.0.7 etapa 2C — rig compartilhado e animações funcionais', () => {
  it('integra os dez personagens aprovados com um contrato único de rig, escala e pivô', () => {
    expect(STAGE_2C_CHARACTER_ASSETS).toHaveLength(10);
    expect(new Set(STAGE_2C_CHARACTER_ASSETS.map((asset) => asset.assetId)).size).toBe(10);
    expect(new Set(STAGE_2C_CHARACTER_ASSETS.map((asset) => asset.rigId))).toEqual(new Set([STAGE_2C_RIG_ID]));
    expect(new Set(STAGE_2C_CHARACTER_ASSETS.map((asset) => asset.sourceBlend))).toEqual(new Set(['art_source/blender/characters/c3_br_shared_rig_stage_2c.blend']));
    for (const asset of STAGE_2C_CHARACTER_ASSETS) {
      expect(asset.frameSize).toEqual([112, 168]);
      expect(asset.anchor).toEqual([56, 158]);
      expect(asset.nativeScale).toBe(.72);
      expect(asset.orientations).toEqual(['sw', 'nw', 'ne', 'se']);
      expect(asset.animations).toMatchObject({ idle: 4, walk: 8, turn: 6 });
      expect(asset.frameCount).toBe(Object.values(asset.animations).reduce((sum, frames) => sum + frames, 0));
    }
  });

  it('oferece apenas as ações funcionais correspondentes aos papéis existentes', () => {
    const players = STAGE_2C_CHARACTER_ASSETS.filter((asset) => asset.role === 'player');
    const cook = STAGE_2C_CHARACTER_ASSETS.find((asset) => asset.role === 'cook')!;
    const waiter = STAGE_2C_CHARACTER_ASSETS.find((asset) => asset.role === 'waiter')!;
    const customers = STAGE_2C_CHARACTER_ASSETS.filter((asset) => asset.role === 'customer');
    expect(players).toHaveLength(2);
    expect(cook.animations).toMatchObject({ prep_counter: 8, cook_stove: 8, wash_sink: 8, place_dish: 6 });
    expect(waiter.animations).toMatchObject({ pickup_dish: 6, carry_tray_walk: 8, serve_table: 6, clear_table: 6 });
    expect(customers).toHaveLength(6);
    for (const customer of customers) expect(customer.animations).toMatchObject({ sit_down: 6, seated_idle: 4, eat: 8, drink: 8, stand_up: 6 });
  });

  it('mapeia tarefas reais sem criar uma nova máquina de estados', () => {
    expect(source).toContain("stationId.includes('sink')");
    expect(source).toContain("return 'wash_sink'");
    expect(source).toContain("return 'cook_stove'");
    expect(source).toContain("task.payload.deliveryStage === 'collect' ? 'pickup_dish' : 'serve_table'");
    expect(source).toContain("return 'clean_table'");
    expect(source).toContain("else if (standingUp) animation = 'stand-up'");
    expect(source).toContain("const turnFrames = asset?.animations.turn ?? 0");
    expect(source).toContain("const sitFrames = rendered?.animations.sit_down ?? sitDefinition.frames");
    expect(source).toContain('renderedLoopAnimationFrame(variant, renderedAnimation');
    expect(source).toContain('seatedDepthPoint = chair.visualPosition');
    expect(source).toContain('VISUAL_METRICS.depth.seatedCharacter + seatedDepthOffset');
  });

  it('usa a linha visual que aponta para o mesmo lado do deslocamento', () => {
    const asset = STAGE_2C_CHARACTER_ASSETS[0];
    const movements = [
      [{ x: 1, y: 0 }, 'se', 3], [{ x: 0, y: 1 }, 'sw', 0],
      [{ x: -1, y: 0 }, 'nw', 1], [{ x: 0, y: -1 }, 'ne', 2],
    ] as const;
    for (const [target, direction, row] of movements) {
      expect(directionBetween({ x: 0, y: 0 }, target)).toBe(direction);
      expect(renderedDirectionRow(direction, asset, true)).toBe(row);
    }
  });

  it('preserva pia e fogão aprovados em footprint lógico real 1×1', () => {
    for (const id of ['washing.b5.sink', 'cooking.a1.stove']) {
      const definition = FURNITURE_BY_ID[id];
      expect(orientedFootprint(definition, 'se')).toEqual({ width: 1, depth: 1 });
      expect(orientedFootprint(definition, 'nw')).toEqual({ width: 1, depth: 1 });
    }
  });

  it('exporta o blend compartilhado, validação estrutural e folhas RGBA individuais', () => {
    const blend = resolve(root, 'art_source/blender/characters/c3_br_shared_rig_stage_2c.blend');
    const validationPath = resolve(root, 'artifacts/v007/stage_2c/stage_2c_validation.json');
    expect(existsSync(blend)).toBe(true);
    expect(statSync(blend).size).toBeGreaterThan(100_000);
    const validation = JSON.parse(readFileSync(validationPath, 'utf8')) as { rigId: string; characters: string[]; bones: string[]; sockets: string[]; rootMotion: boolean; rigidWeights: boolean };
    expect(validation).toMatchObject({ rigId: STAGE_2C_RIG_ID, rootMotion: false, rigidWeights: true });
    expect(validation.characters).toHaveLength(10);
    expect(validation.bones).toEqual(expect.arrayContaining(['Root', 'Pelvis', 'Chest', 'Head', 'Thigh.L', 'Shin.R']));
    expect(validation.sockets).toEqual(['HandSocket.L', 'HandSocket.R', 'TraySocket', 'CarrySocket']);
    for (const asset of STAGE_2C_CHARACTER_ASSETS) {
      const path = resolve(root, 'public', asset.spriteSheet.slice(1));
      const png = readFileSync(path);
      expect(png.readUInt32BE(16)).toBe(asset.frameSize[0] * asset.frameCount);
      expect(png.readUInt32BE(20)).toBe(asset.frameSize[1] * 4);
      expect(png[25]).toBe(6);
    }
  });
});
