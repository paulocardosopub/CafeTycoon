import type { PlayerProfile, RestaurantSnapshot } from '../../core/types';

export interface PlayerProfileService { getProfile(playerId: string): Promise<PlayerProfile | null> }
export interface LeaderboardService { list(): Promise<readonly { playerId: string; score: number }[]> }
export interface RestaurantVisitService { getSnapshot(restaurantId: string): Promise<RestaurantSnapshot | null> }

export class LocalPlayerProfileService implements PlayerProfileService {
  constructor(private readonly profile?: PlayerProfile) {}
  async getProfile(): Promise<PlayerProfile | null> { return this.profile ?? null; }
}
export class MockLeaderboardService implements LeaderboardService { async list() { return []; } }
export class MockRestaurantVisitService implements RestaurantVisitService { async getSnapshot() { return null; } }
