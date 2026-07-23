import { RECIPES } from '../recipes/recipes';

export type RewardKind = 'recipe'|'station'|'profession'|'candidate'|'furniture'|'expansion'|'staffSlot'|'system'|'upgrade'|'decorationPack'|'restaurantStar'|'endgame'|'currency';
export interface RewardDefinition { id:string; type:RewardKind; title:string; description:string; icon:string; destination:string; condition:string }
export interface LevelReward { level:number; rewards:RewardDefinition[]; kind:RewardKind; name:string; description:string }

const PROFESSIONS: Record<number, { specialty:string; candidateId:string; stationId:string; station:string }> = {
  1:{specialty:'Barista',candidateId:'cook-0',stationId:'cooking.a8.coffee',station:'Cafeteira'},
  5:{specialty:'Forneiro',candidateId:'cook-1',stationId:'cooking.a2.convection',station:'Forno/assadeira'},
  10:{specialty:'Chef de Sopas',candidateId:'cook-3',stationId:'cooking.a5.kettle',station:'Sopeira'},
  15:{specialty:'Cozinheiro Geral',candidateId:'cook-6',stationId:'cooking.a1.stove',station:'Fogão'},
  20:{specialty:'Fritureiro',candidateId:'cook-7',stationId:'cooking.a4.fryer',station:'Fritadeira'},
  25:{specialty:'Chapeiro',candidateId:'cook-2',stationId:'cooking.a3.griddle',station:'Chapa'},
  45:{specialty:'Chef Oriental',candidateId:'cook-4',stationId:'cooking.a1.stove',station:'Wok'},
  47:{specialty:'Assador',candidateId:'cook-5',stationId:'cooking.a6.grill',station:'Parrilla/defumador'},
  55:{specialty:'Confeiteiro',candidateId:'cook-8',stationId:'preparation.b8.pastry',station:'Confeitaria'},
  63:{specialty:'Sushiman',candidateId:'cook-9',stationId:'preparation.b3.counter',station:'Bancada fria profissional'},
};

const EXTRA: Record<number, RewardDefinition[]> = {
  2:[reward('currency','coins:level-2:150','Caixa de boas-vindas','150 moedas para fortalecer o início.','●','progression','level>=2'),reward('system','system:second-service-counter','Exposição de duas receitas','Aprenda a usar um segundo balcão de serviço.','▰','shop','level>=2')],
  3:[reward('currency','coins:level-3:200','Bônus de primeiros clientes','200 moedas para o próximo investimento.','●','progression','level>=3')],
  4:[reward('currency','coins:level-4:250','Fundo para a fornearia','250 moedas para contratar e equipar a nova área.','●','progression','level>=4')],
  6:[reward('currency','coins:level-6:180','Retorno de divulgação','180 moedas de incentivo.','●','progression','level>=6')],
  7:[reward('currency','coins:level-7:220','Bônus de movimento','220 moedas para novos lotes.','●','progression','level>=7')],
  8:[reward('currency','coins:level-8:260','Reserva operacional','260 moedas para preparar a próxima estação.','●','progression','level>=8')],
  9:[reward('currency','coins:level-9:300','Fundo para a sopeira','300 moedas antes do novo profissional.','●','progression','level>=9')],
  11:[reward('currency','coins:level-11:220','Bônus de clientela','220 moedas para reinvestimento.','●','progression','level>=11')],
  12:[reward('currency','coins:level-12:260','Caixa em crescimento','260 moedas para novos lotes.','●','progression','level>=12')],
  14:[reward('currency','coins:level-14:350','Fundo para o fogão','350 moedas antes da próxima especialidade.','●','progression','level>=14')],
  13:[reward('station','station:cold-prep-basic','Bancada fria básica','Prepara a Salada Caesar.','▰','shop','level>=13')],
  20:[reward('restaurantStar','star:1','Primeira estrela','O restaurante alcançou uma estrela.','★','progression','level>=20')],
  23:[reward('staffSlot','slot:23','Vaga de cozinheiro','Mais uma vaga de funcionário.','♟','staff','level>=23')],
  27:[reward('staffSlot','slot:27','Vaga de garçom','Mais uma vaga de funcionário.','♟','staff','level>=27')],
  41:[reward('station','station:cold-drinks','Balcão de bebidas','Libera bebidas frias.','▰','shop','level>=41'),reward('staffSlot','slot:41','Vaga de cozinheiro','Mais uma vaga de funcionário.','♟','staff','level>=41')],
  47:[reward('furniture','furniture:booth-four','Booth para quatro pessoas','Novo conjunto de salão.','▦','shop','level>=47')],
  51:[reward('staffSlot','slot:51','Vaga de garçom','Mais uma vaga de funcionário.','♟','staff','level>=51')],
  53:[reward('system','system:second-specialty','Treinamento de segunda especialização','Permite treinar uma segunda especialidade.','✦','staff','level>=53')],
  60:[reward('system','system:multi-step','Produções com múltiplas etapas','Receitas avançadas usam várias estações.','↻','production','level>=60'),reward('restaurantStar','star:3','Terceira estrela','O restaurante alcançou três estrelas.','★★★','progression','level>=60')],
  65:[reward('staffSlot','slot:65','Vaga de cozinheiro','Mais uma vaga de funcionário.','♟','staff','level>=65')],
  71:[reward('staffSlot','slot:71','Vaga de garçom','Mais uma vaga de funcionário.','♟','staff','level>=71')],
  81:[reward('staffSlot','slot:81','Vaga de cozinheiro','Mais uma vaga de funcionário.','♟','staff','level>=81')],
  85:[reward('staffSlot','slot:85','Vaga de funcionário','Mais uma vaga de funcionário.','♟','staff','level>=85')],
  93:[reward('system','system:third-specialty','Treinamento de terceira especialização','Permite treinar uma terceira especialidade.','✦','staff','level>=93')],
  100:[reward('restaurantStar','star:5','Quinta estrela','Classificação máxima do restaurante.','★★★★★','progression','level>=100'),reward('endgame','endgame:master-chef','Endgame liberado','Desafios finais disponíveis.','♛','progression','level>=100')],
};

function reward(type:RewardKind,id:string,title:string,description:string,icon:string,destination:string,condition:string):RewardDefinition {
  return { type,id,title,description,icon,destination,condition };
}

export const LEVEL_REWARDS: LevelReward[] = Array.from({length:100},(_,index) => {
  const level=index+1;
  const rewards:RewardDefinition[]=[];
  for (const recipe of RECIPES.filter((item)=>item.requiredLevel===level)) rewards.push(reward('recipe',`recipe:${recipe.id}`,recipe.name,`Nova receita: ${recipe.name}.`,'🍽','recipes',`level>=${level}`));
  const professional=PROFESSIONS[level];
  if (professional) rewards.push(
    reward('station',`station:${professional.stationId}:${level}`,professional.station,`Estação compatível com ${professional.specialty}.`,'▰','shop',`level>=${level}`),
    reward('profession',`profession:${professional.specialty}`,professional.specialty,`Nova profissão: ${professional.specialty}.`,'♟','staff',`level>=${level}`),
    reward('candidate',`candidate:${professional.candidateId}:${professional.specialty}`,`${professional.specialty} iniciante`,`Novo candidato disponível imediatamente.`,'☺','staff',`level>=${level}`),
  );
  rewards.push(...(EXTRA[level] ?? []));
  if (!rewards.length) rewards.push(reward('upgrade',`upgrade:efficiency:${level}`,`Eficiência ${level}`,`Bônus permanente de eficiência do restaurante.`,'↑','progression',`level>=${level}`));
  const primary=rewards[0]!;
  return {level,rewards,kind:primary.type,name:primary.title,description:primary.description};
});

export const LEVEL_REWARD_BY_LEVEL=Object.fromEntries(LEVEL_REWARDS.map((entry)=>[entry.level,entry]));
export const REQUIRED_PROFESSIONS=PROFESSIONS;
