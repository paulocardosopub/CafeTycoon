import { LEVEL_REWARD_BY_LEVEL, LEVEL_REWARDS, type RewardDefinition } from '../../content/progression/levels';
import type { GameState, ProgressionState } from '../../core/types';

export function createInitialProgressionState(): ProgressionState {
  return { appliedRewardIds:[], notifiedLevels:[], confirmedLevels:[], pendingLevels:[], unlockedProfessionIds:[], unlockedCandidateIds:[], unlockedFurnitureIds:[], unlockedSystemIds:[], restaurantStars:0, retroactiveSummaryPending:false, retroactiveSummaryLevels:[] };
}

export function sanitizeProgressionState(input: ProgressionState|undefined): ProgressionState {
  const base=createInitialProgressionState();
  if (!input) return base;
  return {
    ...base,...input,
    appliedRewardIds:uniqueStrings(input.appliedRewardIds),notifiedLevels:uniqueLevels(input.notifiedLevels),confirmedLevels:uniqueLevels(input.confirmedLevels),pendingLevels:uniqueLevels(input.pendingLevels),
    unlockedProfessionIds:uniqueStrings(input.unlockedProfessionIds),unlockedCandidateIds:uniqueStrings(input.unlockedCandidateIds),unlockedFurnitureIds:uniqueStrings(input.unlockedFurnitureIds),unlockedSystemIds:uniqueStrings(input.unlockedSystemIds),
    restaurantStars:Math.max(0,Math.min(5,Number(input.restaurantStars)||0)),retroactiveSummaryLevels:uniqueLevels(input.retroactiveSummaryLevels),retroactiveSummaryPending:Boolean(input.retroactiveSummaryPending),
  };
}

export function applyProgressionThroughLevel(state:GameState, level:number, options:{notify?:boolean;retroactive?:boolean}={}):void {
  state.progression=sanitizeProgressionState(state.progression);
  const capped=Math.max(1,Math.min(100,Math.floor(level)));
  const newlyAppliedLevels:number[]=[];
  for (const manifest of LEVEL_REWARDS.filter((entry)=>entry.level<=capped)) {
    let appliedAtLevel=false;
    for (const reward of manifest.rewards) if (!state.progression.appliedRewardIds.includes(reward.id)) {
      if (!(options.retroactive && reward.type === 'currency')) applyReward(state,reward);
      state.progression.appliedRewardIds.push(reward.id); appliedAtLevel=true;
    }
    if (appliedAtLevel) newlyAppliedLevels.push(manifest.level);
  }
  if (options.retroactive && newlyAppliedLevels.length) {
    state.progression.retroactiveSummaryPending=true;
    state.progression.retroactiveSummaryLevels=uniqueLevels([...state.progression.retroactiveSummaryLevels,...newlyAppliedLevels]);
    return;
  }
  if (options.notify !== false) for (const current of newlyAppliedLevels) if (!state.progression.confirmedLevels.includes(current) && !state.progression.pendingLevels.includes(current)) {
    state.progression.notifiedLevels.push(current); state.progression.pendingLevels.push(current);
  }
  state.progression.pendingLevels=uniqueLevels(state.progression.pendingLevels);
}

export function confirmProgressionNotification(state:GameState):number|undefined {
  if (state.progression.retroactiveSummaryPending) { state.progression.retroactiveSummaryPending=false; return 0; }
  const level=state.progression.pendingLevels.shift();
  if (level!==undefined && !state.progression.confirmedLevels.includes(level)) state.progression.confirmedLevels.push(level);
  return level;
}

export function pendingLevelReward(state:GameState) { const level=state.progression.pendingLevels[0]; return level ? LEVEL_REWARD_BY_LEVEL[level] : undefined; }

function applyReward(state:GameState,reward:RewardDefinition):void {
  const value=reward.id.split(':')[1] ?? reward.id;
  if (reward.type==='recipe' && !state.enabledRecipeIds.includes(value)) state.enabledRecipeIds.push(value);
  else if (reward.type==='candidate' && !state.staff.instances.some((instance)=>instance.definitionId===value) && !state.staff.candidateDefinitionIds.includes(value)) state.staff.candidateDefinitionIds.push(value);
  else if (reward.type==='profession' && !state.progression.unlockedProfessionIds.includes(value)) state.progression.unlockedProfessionIds.push(value);
  else if ((reward.type==='station'||reward.type==='furniture'||reward.type==='decorationPack') && !state.progression.unlockedFurnitureIds.includes(reward.id)) state.progression.unlockedFurnitureIds.push(reward.id);
  else if ((reward.type==='system'||reward.type==='upgrade'||reward.type==='endgame') && !state.progression.unlockedSystemIds.includes(reward.id)) state.progression.unlockedSystemIds.push(reward.id);
  else if (reward.type==='staffSlot') state.staff.maxStaff+=1;
  else if (reward.type==='restaurantStar') state.progression.restaurantStars=Math.max(state.progression.restaurantStars,Number(value)||0);
  else if (reward.type==='currency') state.coins+=Math.max(0,Number(reward.id.split(':').at(-1))||0);
}

function uniqueStrings(input:unknown):string[]{return [...new Set(Array.isArray(input)?input.filter((value):value is string=>typeof value==='string'):[])];}
function uniqueLevels(input:unknown):number[]{return [...new Set(Array.isArray(input)?input.map(Number).filter((value)=>Number.isInteger(value)&&value>=1&&value<=100):[])].sort((a,b)=>a-b);}
