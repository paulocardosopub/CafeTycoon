export const GAME_VERSION = '0.0.2';
export const SAVE_SCHEMA_VERSION = 2;

export const BALANCE = {
  startingCoins: 260,
  startingReputation: 60,
  readyDishCapacity: 10,
  inventoryCapacity: 110,
  customerSpawnSeconds: 12,
  customerEatSeconds: 9,
  customerBasePatienceSeconds: 120,
  movementSpeedMultiplier: 2,
  cookingSpeedMultiplier: 2,
  actionSeconds: {
    takeOrder: 3.2,
    deliver: 2.4,
    payment: 2.2,
    clean: 4.5,
  },
  offline: {
    maxSeconds: 8 * 60 * 60,
    saleIntervalSeconds: 150,
  },
  restaurantLevels: [0, 80, 220],
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
  return Math.min(3, 1 + thresholds.slice(1).filter((threshold) => xp >= threshold).length);
}
