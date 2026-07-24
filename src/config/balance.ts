export const GAME_VERSION = '0.0.10';
export const SAVE_SCHEMA_VERSION = 6;

export const BALANCE = {
  // Covers the complete level-one setup, the first Barista and two extra coffee batches.
  startingCoins: 5000,
  startingReputation: 60,
  readyDishCapacity: 10,
  inventoryCapacity: 110,
  customerSpawnSeconds: 8,
  customerEatSeconds: 9,
  customerBasePatienceSeconds: 150,
  movementSpeedMultiplier: 2,
  actionSeconds: {
    takeOrder: 3.2,
    deliver: 2.4,
    payment: 2.2,
    clean: 4.5,
  },
  movementRecovery: {
    retrySeconds: 0.8,
    maxTaskRetries: 4,
    maxExitRetries: 20,
    noProgressSeconds: 12,
    reservationTimeoutSeconds: 20,
  },
  staff: {
    initialLimit: 10,
    candidateRefreshSeconds: 24 * 60 * 60,
    payrollIntervalSeconds: 60 * 60,
    payrollWarningSeconds: 10 * 60,
    overdueEfficiencyMultiplier: 0.85,
    trainingCost: 90,
    trainingDurationSeconds: 20 * 60,
    experiencePerTask: 4,
    levelThresholds: [0, 40, 110, 220, 380],
    movementSpeedPerLevel: 0.025,
    taskSpeedPerLevel: 0.04,
    qualityPerLevel: 0.025,
    maxLevel: 5,
  },
  storage: {
    capacities: { dry: 240, refrigerated: 260, frozen: 200, general: 180 },
    levelCapacityMultiplier: 0.25,
  },
  procurement: {
    protectedCashBalance: 80,
    maximumSpendPerCycle: 90,
    maximumSpendPerPeriod: 260,
    checkIntervalSeconds: 20,
    confirmationThreshold: 120,
    pauseAtCriticalCash: 110,
    periodSeconds: 15 * 60,
    historyLimit: 100,
  },
  production: {
    maximumQuantity: 300,
    defaultBatchSize: 1,
    maximumBatchSize: 300,
    queueHistoryLimit: 240,
    schedulerIntervalSeconds: 0.5,
  },
  offline: {
    maxSeconds: 8 * 60 * 60,
    saleIntervalSeconds: 150,
  },
  restaurantLevels: Array.from({ length: 100 }, (_, index) => index === 0 ? 0 : Math.round(140 * Math.pow(index, 1.85))),
  playerLevels: [0, 40, 120],
  professionLevels: [0, 25, 80],
  professionSpeedPerLevel: 0.08,
  upgrades: {
    inventory: { baseCost: 140, amount: 20 },
    dishStorage: { baseCost: 120, amount: 4 },
    stationSpeed: { baseCost: 180, amount: 0.08 },
  },
} as const;

export function levelFromXp(xp: number, thresholds: readonly number[]): number {
  return Math.min(thresholds.length, 1 + thresholds.slice(1).filter((threshold) => xp >= threshold).length);
}
