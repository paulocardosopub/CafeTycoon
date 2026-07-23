import { describe, expect, it } from 'vitest';
import { CUSTOMER_CHARACTER_ASSET_IDS } from '../assets/pixel/characterVariantManifest';
import { PLAYER_SKINS, playerSkinAsset } from '../content/characters/playerSkins';
import { STAFF_CATALOG } from '../game/data/staff';
import { createDefaultState } from '../game/save/defaultState';
import { migrateAndSanitizeSave } from '../game/save/migrations';

describe('remoção do estoquista e reaproveitamento das skins', () => {
  it('não oferece estoquistas como funcionários', () => {
    expect(STAFF_CATALOG.some((staff) => staff.role === 'stocker')).toBe(false);
  });

  it('usa a antiga aparência do estoquista como Skin 1 do jogador', () => {
    expect(PLAYER_SKINS[0].assetId).toBe('char_staff_stocker_chef_01');
    expect(playerSkinAsset({ presentation: 'masculina' })).toBe('char_staff_stocker_chef_01');
    expect(PLAYER_SKINS.some((skin) => skin.assetId === 'char_player_male_01')).toBe(false);
  });

  it('reaproveita a antiga Skin 1 do jogador entre os clientes', () => {
    expect(CUSTOMER_CHARACTER_ASSET_IDS).toContain('char_player_male_01');
  });

  it('remove pontos antigos do estoquista e troca a função do jogador ao carregar', () => {
    const state = createDefaultState(0);
    state.profile = {
      id: state.playerId, name: 'Jogador', appearance: { presentation: 'masculina', skin: 'honey', hairStyle: 'short', hairColor: 'espresso', face: 'soft', outfit: 'casual', outfitColor: 'green' },
      level: 1, xp: 0, helpRole: 'stock',
      professions: { cook:{xp:0,level:1,tasksCompleted:0}, waiter:{xp:0,level:1,tasksCompleted:0}, cleaner:{xp:0,level:1,tasksCompleted:0}, stocker:{xp:0,level:1,tasksCompleted:0} },
      taskHistory: { take_order:0,cook_step:0,deliver:0,payment:0,clean:0,stock_support:0,restock_purchase:0,production_batch:0 },
    };
    state.construction.staffStartPositions.push({ staffId: 'stocker-0', gridX: 3, gridY: 4, facing: 'ne', returnWhenIdle: true });
    const migrated = migrateAndSanitizeSave(state, 1);
    expect(migrated.profile?.helpRole).toBe('kitchen');
    expect(migrated.construction.staffStartPositions.some((position) => position.staffId === 'stocker-0')).toBe(false);
  });
});
