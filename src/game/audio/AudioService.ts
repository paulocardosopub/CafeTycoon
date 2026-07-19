export interface AudioSettings { master: number; music: number; effects: number; muted: boolean }

export class AudioService {
  settings: AudioSettings = { master: 0.7, music: 0.45, effects: 0.75, muted: false };

  update(patch: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...patch };
    localStorage.setItem('bistro-bloom-audio', JSON.stringify(this.settings));
  }

  load(): void {
    try { this.settings = { ...this.settings, ...JSON.parse(localStorage.getItem('bistro-bloom-audio') ?? '{}') }; } catch { /* defaults */ }
  }
}
