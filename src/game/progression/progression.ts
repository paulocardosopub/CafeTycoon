import { BALANCE, levelFromXp } from '../../config/balance';
import type { GameState, ProfessionId, TaskKind } from '../../core/types';
import { applyProgressionThroughLevel } from './RewardService';

const PROFESSION_FOR_TASK: Record<TaskKind, ProfessionId> = {
  take_order: 'waiter', cook_step: 'cook', deliver: 'waiter', payment: 'waiter', clean: 'cleaner', stock_support: 'stocker',
  restock_purchase: 'stocker', production_batch: 'cook',
};

export function awardPlayerTaskXp(state: GameState, task: TaskKind): void {
  if (!state.profile) return;
  const amount = task === 'cook_step' ? 5 : task === 'clean' ? 4 : 3;
  const profession = state.profile.professions[PROFESSION_FOR_TASK[task]];
  profession.xp += amount;
  profession.level = levelFromXp(profession.xp, BALANCE.professionLevels);
  profession.tasksCompleted += 1;
  state.profile.xp += Math.max(2, Math.floor(amount * 0.6));
  state.profile.level = levelFromXp(state.profile.xp, BALANCE.playerLevels);
  state.profile.taskHistory[task] = (state.profile.taskHistory[task] ?? 0) + 1;
}

export function updateRestaurantLevel(state: GameState): void {
  const nextLevel = levelFromXp(state.restaurantXp, BALANCE.restaurantLevels);
  if (nextLevel > state.restaurantLevel) applyProgressionThroughLevel(state, nextLevel, { notify:true });
  // Difficulty changes must never remove a level that an existing save already earned.
  state.restaurantLevel = Math.max(state.restaurantLevel, nextLevel);
}
