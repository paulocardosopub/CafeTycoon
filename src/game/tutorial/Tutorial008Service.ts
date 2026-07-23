import type { GameState } from '../../core/types';
import { FURNITURE_BY_ID } from '../data/furniture/catalog';
import { STAFF_BY_ID } from '../data/staff';

export const INITIAL_TUTORIAL_STEPS = [
  { id: 'welcome', title: 'Bem-vindo ao seu primeiro restaurante!', objective: 'Antes de receber clientes, vamos montar a estrutura necessária.', manual: true },
  { id: 'buy-counter', title: 'Compre o Balcão de serviço T1', objective: 'Pratos prontos ficam aqui até o atendimento.' },
  { id: 'buy-sink', title: 'Compre a Pia T1', objective: 'A Pia limpa as louças recolhidas das mesas.' },
  { id: 'buy-dining', title: 'Compre a mesa e duas cadeiras', objective: 'Clientes precisam de assentos acessíveis e caminhos livres.' },
  { id: 'buy-coffee-machine', title: 'Compre a Cafeteira T1', objective: 'A primeira estação é operada por um Barista.' },
  { id: 'open-editor', title: 'Abra Editar restaurante', objective: 'Comprar e posicionar são ações separadas.', manual: true },
  { id: 'place-setup', title: 'Monte o restaurante', objective: 'Posicione Balcão, Pia, Cafeteira, mesa e duas cadeiras.' },
  { id: 'hire-barista', title: 'Contrate o Barista iniciante', objective: 'Nina opera a Cafeteira e prepara Café preto.' },
  { id: 'cost-and-time', title: 'Entenda custo e tempo', objective: 'O custo é cobrado uma única vez; estação e profissional ficam ocupados.', manual: true },
  { id: 'first-production', title: 'Produza o primeiro lote', objective: 'Confira custo, saldo, tempo, porções, faturamento, lucro e XP.' },
  { id: 'hire-cleaner', title: 'Contrate a funcionária de limpeza', objective: 'Iara limpa as mesas, recolhe as louças e leva tudo para lavar na Pia.' },
  { id: 'player-waiter', title: 'Trabalhe como Atendente/Garçom', objective: 'Seu personagem servirá clientes e recolherá louças.' },
  { id: 'understand-counter', title: 'Confira o Café no balcão', objective: 'Clientes pedem somente receitas realmente disponíveis.' },
  { id: 'open-restaurant', title: 'Abra o restaurante', objective: 'A abertura só é liberada quando todos os requisitos forem cumpridos.' },
  { id: 'first-customer', title: 'Atenda o primeiro cliente', objective: 'Sirva, receba o pagamento, recolha e lave a louça.' },
  { id: 'chapter-complete', title: 'Seu restaurante está funcionando!', objective: 'Consulte os próximos capítulos na Jornada do Restaurante.' },
] as const;

export const JOURNEY_CHAPTER_LEVELS = [1,2,3,4,5,7,10,13,20,25,30,31,35,41,45,47,50,53,55,57,59,60,61,62,63,66,67,70,73,74,77,78,80,82,83,86,89,90,92,93,98,99,100] as const;
export const JOURNEY_CHAPTER_TITLES: Partial<Record<number,string>> = {
  82:'Parceria comercial: redução do custo de produção',
  89:'Eficiência operacional: redução do tempo de preparo',
  92:'Programa de qualidade: bônus de lucro e reputação',
};

export function acknowledgeTutorialStep(state: GameState, id: string): void {
  if (!state.tutorial008.completedSteps.includes(id)) state.tutorial008.completedSteps.push(id);
  reconcileTutorial(state);
}

export function pendingTutorialStep(state: GameState): (typeof INITIAL_TUTORIAL_STEPS)[number] | undefined {
  const completed = new Set(state.tutorial008.completedSteps);
  return INITIAL_TUTORIAL_STEPS.find((step) => !completed.has(step.id));
}

export function pendingJourneyChapter(state: GameState): number | undefined {
  return JOURNEY_CHAPTER_LEVELS.find((level) => {
    if (level === 1) return false;
    const id = `level-${level}`;
    return state.tutorial008.availableChapters.includes(id) && !state.tutorial008.completedChapters.includes(id);
  });
}

export function acknowledgeJourneyChapter(state: GameState, level: number): void {
  const id = `level-${level}`;
  if (!state.tutorial008.completedChapters.includes(id)) state.tutorial008.completedChapters.push(id);
}

export function reconcileTutorial(state: GameState): void {
  const completed = new Set(state.tutorial008.completedSteps);
  const owned = [...state.construction.placedFurniture, ...state.construction.storedFurniture].map((item) => FURNITURE_BY_ID[item.definitionId]);
  const placed = state.construction.placedFurniture.map((item) => FURNITURE_BY_ID[item.definitionId]);
  const count = (items: typeof owned, fn: string) => items.filter((item) => item?.functionId === fn).length;
  if (count(owned, 'pickup')) completed.add('buy-counter');
  if (count(owned, 'sink')) completed.add('buy-sink');
  if (count(owned, 'table') && count(owned, 'chair') >= 2) completed.add('buy-dining');
  if (count(owned, 'coffee_machine')) completed.add('buy-coffee-machine');
  if (count(placed, 'pickup') && count(placed, 'sink') && count(placed, 'coffee_machine') && count(placed, 'table') && count(placed, 'chair') >= 2) completed.add('place-setup');
  if (state.staff.instances.some((member) => STAFF_BY_ID[member.definitionId]?.specialties.includes('Barista'))) completed.add('hire-barista');
  if (state.production.plans.some((plan) => plan.recipeId === 'coffee')) completed.add('first-production');
  if (state.staff.instances.some((member) => member.enabled && member.role === 'cleaner')) completed.add('hire-cleaner');
  if (state.profile?.helpRole === 'service') completed.add('player-waiter');
  if ((state.readyDishes.coffee ?? 0) + state.construction.serviceCounters.filter((counter) => counter.assignedRecipeId === 'coffee').reduce((sum, counter) => sum + counter.currentQuantity, 0) > 0) completed.add('understand-counter');
  if (state.restaurantOpen) completed.add('open-restaurant');
  if (state.stats.customersServed > 0) completed.add('first-customer');
  if (completed.has('first-customer')) completed.add('chapter-complete');
  state.tutorial008.completedSteps = [...completed];
  const pendingStepIndex = INITIAL_TUTORIAL_STEPS.findIndex((step) => !completed.has(step.id));
  state.tutorial008.currentStep = pendingStepIndex < 0 ? INITIAL_TUTORIAL_STEPS.length : pendingStepIndex;
  if (completed.has('chapter-complete') && !state.tutorial008.completedChapters.includes('level-1-first-service')) state.tutorial008.completedChapters.push('level-1-first-service');
  for (const level of JOURNEY_CHAPTER_LEVELS) {
    const id = level === 1 ? 'level-1-first-service' : `level-${level}`;
    if (level <= state.restaurantLevel && !state.tutorial008.availableChapters.includes(id)) {
      state.tutorial008.availableChapters.push(id);
      if (level > 1) state.tutorial008.minimized = false;
    }
  }
}
