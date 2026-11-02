import { getCookie } from './analytics';

export interface EqualizerBand {
  freq: number;
  type: BiquadFilterType;
  label: string;
  subLabel: string;
  q?: number;
}

export const EQUALIZER_BANDS: EqualizerBand[] = [
  { freq: 60, type: 'lowshelf', label: '60 Hz', subLabel: 'Diepe bas' },
  { freq: 250, type: 'peaking', label: '250 Hz', subLabel: 'Warmte', q: 1.0 },
  { freq: 1000, type: 'peaking', label: '1 kHz', subLabel: 'Stem / Zang', q: 1.0 },
  { freq: 4000, type: 'peaking', label: '4 kHz', subLabel: 'Helderheid', q: 1.0 },
  { freq: 12000, type: 'highshelf', label: '12 kHz', subLabel: 'Sprankel' }
];

export interface EqualizerPreset {
  id: string;
  name: string;
  description: string;
  gains: [number, number, number, number, number];
}

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  {
    id: 'flat',
    name: 'Standaard (Neutraal)',
    description: 'Natuurlijk en ongekleurd, zoals gemasterd in de studio.',
    gains: [0, 0, 0, 0, 0]
  },
  {
    id: 'vocal',
    name: 'Warme Stem & Luisterboek',
    description: 'Accentueert de stem van Paul met intimiteit en warmte.',
    gains: [-1, 2, 4, 2, 0]
  },
  {
    id: 'acoustic',
    name: 'Akoestisch & Gitaar',
    description: 'Sprankelende gitaarsnaren en open, heldere ballades.',
    gains: [1, 1, 0, 3, 4]
  },
  {
    id: 'bass',
    name: 'Diepe Bas (Bass Boost)',
    description: 'Geeft meer diepgang en body op kleinere luidsprekers.',
    gains: [6, 4, 0, -1, -2]
  },
  {
    id: 'bright',
    name: 'Helder & Sprankelend',
    description: 'Licht de hoge frequenties en subtiele details op.',
    gains: [-2, 0, 1, 4, 5]
  },
  {
    id: 'night',
    name: 'Koptelefoon / Nachtmodus',
    description: 'Zachte lage tonen en rustgevende luisterervaring.',
    gains: [-3, 1, 2, 0, -3]
  }
];

export interface EqualizerPreferences {
  enabled: boolean;
  presetId: string;
  gains: [number, number, number, number, number];
}

/**
 * Lees opgeslagen equalizer instellingen uit cookies (met localStorage fallback).
 */
export function getEqualizerPreferences(): EqualizerPreferences {
  try {
    const cookieEnabled = getCookie('pv_eq_enabled');
    const cookiePreset = getCookie('pv_eq_preset');
    const cookieBands = getCookie('pv_eq_bands');

    const localEnabled = typeof localStorage !== 'undefined' ? localStorage.getItem('pv_eq_enabled') : null;
    const localPreset = typeof localStorage !== 'undefined' ? localStorage.getItem('pv_eq_preset') : null;
    const localBands = typeof localStorage !== 'undefined' ? localStorage.getItem('pv_eq_bands') : null;

    let enabled = true;
    if (cookieEnabled === 'false' || localEnabled === 'false') {
      enabled = false;
    } else if (cookieEnabled === 'true' || localEnabled === 'true') {
      enabled = true;
    }

    const presetId = cookiePreset || localPreset || 'flat';
    let gains: [number, number, number, number, number] = [0, 0, 0, 0, 0];

    const rawBands = cookieBands || localBands;
    if (rawBands) {
      const parts = rawBands.split(',').map(s => parseFloat(s.trim()));
      if (parts.length === 5 && parts.every(n => !isNaN(n))) {
        gains = parts.map(n => Math.max(-12, Math.min(12, Math.round(n * 10) / 10))) as [number, number, number, number, number];
      }
    } else {
      const foundPreset = EQUALIZER_PRESETS.find(p => p.id === presetId);
      if (foundPreset) {
        gains = [...foundPreset.gains];
      }
    }

    return { enabled, presetId, gains };
  } catch {
    return { enabled: true, presetId: 'flat', gains: [0, 0, 0, 0, 0] };
  }
}

/**
 * Bewaar equalizer instellingen in browser cookies (1 jaar geldig) en localStorage.
 */
export function setEqualizerPreferences(
  enabled: boolean,
  presetId: string,
  gains: [number, number, number, number, number]
): void {
  const bandsString = gains.map(n => Math.round(n * 10) / 10).join(',');

  if (typeof document !== 'undefined') {
    const maxAge = 365 * 24 * 60 * 60; // 1 jaar (31536000s)
    document.cookie = `pv_eq_enabled=${enabled ? 'true' : 'false'}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `pv_eq_preset=${encodeURIComponent(presetId)}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `pv_eq_bands=${encodeURIComponent(bandsString)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pv_eq_enabled', enabled ? 'true' : 'false');
      localStorage.setItem('pv_eq_preset', presetId);
      localStorage.setItem('pv_eq_bands', bandsString);
    }
  } catch {}
}

/**
 * Web Audio API Equalizer Manager
 * Beheert de AudioContext, BiquadFilterNodes en AnalyserNode.
 */
class EqualizerEngine {
  private audioCtx: AudioContext | null = null;
  private filters: BiquadFilterNode[] = [];
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private activeElement: HTMLMediaElement | null = null;
  private connectedSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private currentPreferences: EqualizerPreferences;

  constructor() {
    this.currentPreferences = getEqualizerPreferences();
  }

  private initAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    return this.audioCtx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /**
   * Koppel een <audio> of <video> element veilig aan de Equalizer keten.
   * Ontkoppelt eventuele voorgaande elementen om te voorkomen dat audio meervoudig klinkt.
   */
  public attachMediaElement(element: HTMLMediaElement | null): void {
    if (!element || typeof window === 'undefined') return;

    // On iOS (iPhone/iPad), Apple forcefully suspends AudioContext when the browser is backgrounded,
    // which immediately silences audio playback when switching apps or locking the screen!
    // Since createMediaElementSource permanently detaches native audio output in WebKit,
    // we never attach media elements to Web Audio on iOS devices so native background playback works uninterrupted.
    if (typeof navigator !== 'undefined') {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        return;
      }
    }

    try {
      const ctx = this.initAudioContext();
      if (!ctx) return;

      // Bouw filters op als ze nog niet bestaan
      if (this.filters.length === 0) {
        this.filters = EQUALIZER_BANDS.map(b => {
          const filter = ctx.createBiquadFilter();
          filter.type = b.type;
          filter.frequency.setValueAtTime(b.freq, ctx.currentTime);
          if (b.q !== undefined) {
            filter.Q.setValueAtTime(b.q, ctx.currentTime);
          }
          filter.gain.setValueAtTime(0, ctx.currentTime);
          return filter;
        });

        // Sluit filters aan in serie: f0 -> f1 -> f2 -> f3 -> f4
        for (let i = 0; i < this.filters.length - 1; i++) {
          this.filters[i].connect(this.filters[i + 1]);
        }

        // Maak analyser node voor realtime frequentie visualizer
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.8;

        // Maak masterGain node om buffer-stotteren op iOS/Safari bij pauzeren te voorkomen
        this.masterGain = ctx.createGain();
        this.masterGain.gain.setValueAtTime(1, ctx.currentTime);

        // Sluit laatste filter aan op analyser, dan masterGain, en tenslotte luidsprekers
        this.filters[this.filters.length - 1].connect(this.analyser);
        this.analyser.connect(this.masterGain);
        this.masterGain.connect(ctx.destination);

        // Pas opgeslagen voorkeuren direct toe
        this.applyPreferences(this.currentPreferences);
      }

      // Herstel masterGain naar 1 bij nieuwe koppeling
      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(1, ctx.currentTime);
      }

      // Als er al een ander element actief was, pauzeer en ontkoppel die eerst
      if (this.activeElement && this.activeElement !== element) {
        try {
          this.activeElement.pause();
          this.activeElement.volume = 0;
        } catch (e) {}
        const oldSource = this.connectedSources.get(this.activeElement);
        if (oldSource) {
          try {
            oldSource.disconnect();
          } catch (e) {}
        }
      }

      // Check of dit element al gekoppeld is: verbind NOOIT meervoudig parallel aan filters[0]
      let source = this.connectedSources.get(element);
      if (!source) {
        source = ctx.createMediaElementSource(element);
        this.connectedSources.set(element, source);
        try {
          source.connect(this.filters[0]);
        } catch (e) {}
      } else if (this.activeElement !== element) {
        try {
          source.disconnect();
        } catch (e) {}
        try {
          source.connect(this.filters[0]);
        } catch (e) {}
      }
      this.activeElement = element;

      // Hervat audio context indien suspended door browser autoplay policy
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (err) {
      console.warn('[Equalizer] Kon media element niet aan Web Audio API koppelen:', err);
    }
  }

  /**
   * Regel master versterking (gain) in Web Audio keten.
   * Essentieel om op iOS/iPhone stotteren van audio buffers bij pauzeren te voorkomen.
   */
  public setMasterGain(gainVal: number, rampMs = 0): void {
    if (!this.masterGain || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    try {
      if (rampMs > 0) {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
        this.masterGain.gain.linearRampToValueAtTime(gainVal, now + rampMs / 1000);
      } else {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(gainVal, now);
      }
    } catch {
      this.masterGain.gain.value = gainVal;
    }
  }

  /**
   * Pauzeer-veilige afhandeling voor iOS/Safari:
   * Zet direct masterGain op 0 en suspendeert AudioContext zodat iOS WebKit
   * niet de laatste ringbuffer blijft herhalen ('plaat blijft hangen / stotteren').
   */
  public onPauseMediaElement(element: HTMLMediaElement | null): void {
    if (element) {
      try {
        element.pause();
      } catch (e) {}
    }
    if (this.masterGain && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(0, now);
      } catch (e) {
        if (this.masterGain) this.masterGain.gain.value = 0;
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'running') {
      try {
        this.audioCtx.suspend().catch(() => {});
      } catch (e) {}
    }
  }

  /**
   * Hervat-veilige afhandeling:
   * Wekt AudioContext weer en laat masterGain zachtjes infaden.
   */
  public onResumeMediaElement(element: HTMLMediaElement | null, rampMs = 120): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        this.audioCtx.resume().catch(() => {});
      } catch (e) {}
    }
    if (this.masterGain && this.audioCtx) {
      try {
        const now = this.audioCtx.currentTime;
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setValueAtTime(0, now);
        this.masterGain.gain.linearRampToValueAtTime(1, now + Math.max(0.05, rampMs / 1000));
      } catch (e) {
        if (this.masterGain) this.masterGain.gain.value = 1;
      }
    }
  }

  public suspend(): void {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend().catch(() => {});
    }
  }

  /**
   * Ontkoppel en stop een media element veilig.
   */
  public detachMediaElement(element: HTMLMediaElement | null): void {
    if (!element) return;
    try {
      element.pause();
      element.volume = 0;
    } catch (e) {}
    const source = this.connectedSources.get(element);
    if (source) {
      try {
        source.disconnect();
      } catch (e) {}
    }
    if (this.activeElement === element) {
      this.activeElement = null;
    }
  }

  /**
   * Pas filter versterkingen (dB) toe op de actieve Web Audio filters.
   */
  public applyPreferences(prefs: EqualizerPreferences): void {
    this.currentPreferences = prefs;
    if (this.filters.length === 0 || !this.audioCtx) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    this.filters.forEach((filter, idx) => {
      // Als EQ is uitgeschakeld, stellen we alle banden in op 0 dB (transparant / flat)
      const targetGain = prefs.enabled ? (prefs.gains[idx] ?? 0) : 0;
      try {
        filter.gain.cancelScheduledValues(now);
        filter.gain.setTargetAtTime(targetGain, now, 0.05);
      } catch {
        filter.gain.value = targetGain;
      }
    });
  }

  public resume(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }
}

// Singleton equalizer engine instantie
export const equalizerEngine = new EqualizerEngine();
