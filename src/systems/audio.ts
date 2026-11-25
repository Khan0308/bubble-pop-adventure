import { GameSettings, WorldId } from '../types/game';

type MusicContext = 'menu' | WorldId | 'none';

class AudioSystem {
  private ctx: AudioContext | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private currentContext: MusicContext = 'none';
  private settings: GameSettings = {
    music: true,
    sound: true,
    musicVolume: 0.45,
    soundVolume: 0.75,
    vibration: true,
    language: 'en',
    handedness: 'right',
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public updateSettings(next: GameSettings): void {
    this.settings = next;
    if (!next.music) {
      this.stopMusicLoop();
    } else if (this.currentContext !== 'none' && this.musicTimer === null) {
      this.startMusicLoop(this.currentContext);
    }
  }

  public vibrate(ms: number | number[]): void {
    if (!this.settings.vibration) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(ms);
      } catch {
        // Ignore unsupported vibration calls
      }
    }
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    slideTo?: number,
    delay = 0,
  ): void {
    if (!this.settings.sound || this.settings.soundVolume <= 0) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + duration);
    }

    const finalVol = Math.max(0.001, Math.min(0.4, volume * this.settings.soundVolume));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(finalVol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playClick(): void {
    this.playTone(580, 0.07, 'sine', 0.18, 720);
  }

  public playShoot(): void {
    this.playTone(260, 0.14, 'triangle', 0.25, 520);
  }

  public playBounce(): void {
    this.playTone(420, 0.06, 'sine', 0.16, 300);
  }

  public playAttach(): void {
    this.playTone(220, 0.08, 'sine', 0.2, 180);
  }

  public playPop(comboIndex = 0): void {
    const base = 440 + Math.min(10, comboIndex) * 48;
    this.playTone(base, 0.11, 'sine', 0.24, base * 1.45);
  }

  public playDrop(count = 1): void {
    const steps = Math.min(5, count);
    for (let i = 0; i < steps; i++) {
      this.playTone(540 + i * 65, 0.1, 'triangle', 0.18, 320, i * 0.045);
    }
  }

  public playPowerUp(): void {
    this.playTone(440, 0.1, 'triangle', 0.22, 660, 0);
    this.playTone(660, 0.14, 'sine', 0.22, 990, 0.07);
  }

  public playBomb(): void {
    this.playTone(130, 0.28, 'sawtooth', 0.28, 42);
  }

  public playLightning(): void {
    this.playTone(880, 0.16, 'square', 0.18, 220);
    this.playTone(1120, 0.14, 'sawtooth', 0.14, 340, 0.04);
  }

  public playReward(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.playTone(freq, 0.15, 'triangle', 0.2, undefined, i * 0.065);
    });
  }

  public playVictory(): void {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      this.playTone(freq, 0.22, 'triangle', 0.24, undefined, i * 0.09);
    });
  }

  public playFail(): void {
    [392, 349.23, 311.13, 261.63].forEach((freq, i) => {
      this.playTone(freq, 0.22, 'sine', 0.2, undefined, i * 0.12);
    });
  }

  public setMusicContext(context: MusicContext): void {
    if (this.currentContext === context && this.musicTimer !== null) return;
    this.currentContext = context;
    this.stopMusicLoop();
    if (context !== 'none' && this.settings.music) {
      this.startMusicLoop(context);
    }
  }

  private stopMusicLoop(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private startMusicLoop(context: Exclude<MusicContext, 'none'>): void {
    const scales: Record<Exclude<MusicContext, 'none'>, number[]> = {
      menu: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 392.0],
      candy: [349.23, 440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0],
      forest: [293.66, 349.23, 440.0, 523.25, 440.0, 392.0, 349.23, 329.63],
      ocean: [261.63, 311.13, 392.0, 466.16, 392.0, 311.13, 293.66, 349.23],
      space: [220.0, 261.63, 329.63, 440.0, 493.88, 440.0, 329.63, 246.94],
    };

    const notes = scales[context];
    this.musicTimer = window.setInterval(() => {
      if (!this.settings.music || this.settings.musicVolume <= 0) return;
      if (!this.ctx || this.ctx.state !== 'running') return;

      const freq = notes[this.musicStep % notes.length];
      this.musicStep++;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = context === 'space' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const vol = Math.max(0.001, 0.045 * this.settings.musicVolume);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    }, 520);
  }
}

export const audioManager = new AudioSystem();
