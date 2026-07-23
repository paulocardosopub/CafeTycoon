import { BALANCE } from '../../config/balance';
import { RECIPE_BY_ID, RECIPES } from '../../content/recipes/recipes';
import type { GameState, HelpRole, OfflineReport, ProfessionId } from '../../core/types';
import { productionDuration } from '../cooking/ProductionService';
import { chargePayroll } from '../staff/StaffService';
import { createStations } from '../map/initialMap';
import { completeProductionTask, deferProductionTask, markProductionTaskStarted, prepareNextProductionTask, preparedQuantity, refreshMaintainTargetPlans } from '../cooking/ProductionPlanningService';

const PROFESSION_BY_ROLE: Record<HelpRole, ProfessionId> = { manager:'cook', kitchen:'cook', service:'waiter', cleaning:'cleaner', stock:'stocker' };

function emptyReport(absentSeconds:number, calculatedSeconds:number, role:HelpRole): OfflineReport {
  return { absentSeconds, calculatedSeconds, capped:absentSeconds>BALANCE.offline.maxSeconds, produced:{}, sold:{}, ingredientsConsumed:{}, coins:0, experience:0, characterRole:role, characterTasks:0, characterGeneralXp:0, characterProfessionXp:0, bonusPercent:0, idleSeconds:calculatedSeconds, stoppedReasons:[], ingredientsPurchased:{}, salariesCharged:0, purchaseCosts:0, grossRevenue:0, costs:0, netProfit:0, blockedTasks:[] };
}

export function calculateOfflineProgress(state:GameState, now=Date.now()): OfflineReport {
  const absentSeconds=Math.max(0,Math.floor((now-state.lastActiveAt)/1000));
  const calculatedSeconds=Math.min(absentSeconds,BALANCE.offline.maxSeconds);
  const role=state.profile?.helpRole??'manager';
  const report=emptyReport(absentSeconds,calculatedSeconds,role);
  const claimId=`${state.lastActiveAt}:${now}`;
  if(state.offlineClaimId===claimId||calculatedSeconds<=0){state.lastActiveAt=now;return report;}
  state.offlineClaimId=claimId; state.lastActiveAt=now;
  const professionLevel=state.profile?.professions[PROFESSION_BY_ROLE[role]].level??1;
  report.bonusPercent=Math.round((professionLevel-1)*BALANCE.professionSpeedPerLevel*100);
  refreshMaintainTargetPlans(state,state.construction.serviceCounters,now);
  const stations=createStations(state.construction);
  const cooks=state.staff.instances.filter((member)=>member.enabled&&member.role==='cook');
  let workSeconds=calculatedSeconds*cooks.length;
  while(workSeconds>0){
    const prepared=prepareNextProductionTask(state,stations,state.construction.serviceCounters,now);
    if(!prepared)break;
    if(prepared.duration>workSeconds){deferProductionTask(state,prepared.task.id,state.construction.serviceCounters,'Tempo offline insuficiente para concluir o próximo lote.');break;}
    markProductionTaskStarted(state,prepared.task.id,cooks[0]?.id??'offline-cook',now);
    const restaurantXpBefore=state.restaurantXp;
    if(!completeProductionTask(state,prepared.task.id,state.construction.serviceCounters,now)){deferProductionTask(state,prepared.task.id,state.construction.serviceCounters);break;}
    state.restaurantXp=restaurantXpBefore;
    workSeconds-=prepared.duration; report.produced[prepared.task.recipeId]=(report.produced[prepared.task.recipeId]??0)+prepared.task.batchQuantity;
  }

  // Compatibilidade com filas antigas: cada lote cobra dinheiro uma vez e nunca depende de insumos.
  let legacySeconds=calculatedSeconds;
  while(state.productionQueue.length&&legacySeconds>0){
    const item=state.productionQueue[0]; const recipe=RECIPE_BY_ID[item.recipeId]; const duration=productionDuration(state,item.recipeId);
    if(!item.costPaid){if(state.coins<recipe.batchCost){report.stoppedReasons.push(`Saldo insuficiente para ${recipe.name}: faltam ${recipe.batchCost-state.coins} moedas.`);break;}state.coins-=recipe.batchCost;item.costPaid=true;item.status='producing';report.costs+=recipe.batchCost;}
    const needed=Math.max(0,duration-item.progressSeconds);
    if(legacySeconds<needed){item.progressSeconds+=legacySeconds;report.idleSeconds=Math.max(0,report.idleSeconds-legacySeconds);legacySeconds=0;break;}
    legacySeconds-=needed; report.idleSeconds=Math.max(0,report.idleSeconds-needed); item.progressSeconds=0; item.completed+=1;
    state.readyDishes[item.recipeId]+=recipe.yield; state.stats.dishesProduced+=recipe.yield; report.produced[item.recipeId]=(report.produced[item.recipeId]??0)+recipe.yield;
    if(item.completed>=item.quantity)state.productionQueue.shift(); else item.costPaid=false;
  }

  let saleBudget=Math.floor(calculatedSeconds/(BALANCE.offline.saleIntervalSeconds*Math.max(.65,role==='cleaning'?.92:1)));
  for(const recipe of [...RECIPES].sort((a,b)=>b.salePrice-a.salePrice)){
    if(saleBudget<=0)break; const available=state.readyDishes[recipe.id]+preparedQuantity(state.construction.serviceCounters,recipe.id); const sold=Math.min(available,saleBudget); if(!sold)continue;
    const legacy=Math.min(sold,state.readyDishes[recipe.id]); state.readyDishes[recipe.id]-=legacy; let counterAmount=sold-legacy;
    for(const module of state.construction.serviceCounters.filter((item)=>item.assignedRecipeId===recipe.id)){const removed=Math.min(counterAmount,Math.max(0,module.currentQuantity-module.reservedQuantity));module.currentQuantity-=removed;counterAmount-=removed;if(!counterAmount)break;}
    saleBudget-=sold; report.sold[recipe.id]=sold; const revenue=sold*recipe.salePrice; report.coins+=revenue; report.grossRevenue+=revenue; state.coins+=revenue; state.stats.customersServed+=sold; state.stats.coinsEarned+=revenue;
  }
  const producedCount=Object.values(report.produced).reduce<number>((sum,value)=>sum+(value??0),0); const soldCount=Object.values(report.sold).reduce<number>((sum,value)=>sum+(value??0),0);
  report.characterTasks=0;
  const payrollPeriods=Math.floor(calculatedSeconds/BALANCE.staff.payrollIntervalSeconds);if(payrollPeriods>0)report.salariesCharged=chargePayroll(state,payrollPeriods,now).charged;
  report.costs+=report.salariesCharged; report.netProfit=report.grossRevenue-report.costs;
  const blocked=state.production.tasks.filter((task)=>!['completed','cancelled','failed'].includes(task.state)&&task.blockedReason);for(const task of blocked)report.blockedTasks.push({kind:'production',reason:`${RECIPE_BY_ID[task.recipeId].name}: ${task.blockedReason}`});
  if(!producedCount&&!state.productionQueue.length&&!state.production.tasks.some((task)=>!['completed','cancelled','failed'].includes(task.state)))report.stoppedReasons.push('Não havia produção programada.');
  if(!soldCount)report.stoppedReasons.push('Não havia pratos prontos para vender.');if(absentSeconds>BALANCE.offline.maxSeconds)report.stoppedReasons.push('O limite de 8 horas foi aplicado.');report.stoppedReasons.push('Nenhuma experiência é concedida com o jogo fechado.');report.stoppedReasons=[...new Set(report.stoppedReasons)];return report;
}
