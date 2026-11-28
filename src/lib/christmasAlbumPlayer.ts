import { useEffect, useState } from 'react';
import { homeSoundtrack } from './homeSoundtrack';

export interface ChristmasTrack {
  index: number;
  title: string;
  url: string;
  cover: string;
}

export const CHRISTMAS_ALBUM_TRACKS: ChristmasTrack[] = [
  {
    index: 0,
    title: 'A Lonely Christmas',
    url: '/@music/136%20A%20Lonely%20Christmas/A%20Lonely%20Christmas.mp3',
    cover: '/@music/136%20A%20Lonely%20Christmas/A%20Lonely%20Christmas.jpg',
  },
  {
    index: 1,
    title: 'Do we know what Christmas is',
    url: '/@music/137%20Do%20we%20know%20what%20Christmas%20is/Do%20we%20know%20what%20Christmas%20is.mp3',
    cover: '/@music/137%20Do%20we%20know%20what%20Christmas%20is/Do%20we%20know%20what%20Christmas%20is.jpg',
  },
  {
    index: 2,
    title: 'Solitude on Christmas Day',
    url: '/@music/138%20Solitude%20on%20Christmas%20Day/Solitude%20on%20Christmas%20Day.mp3',
    cover: '/@music/138%20Solitude%20on%20Christmas%20Day/Solitude%20on%20Christmas%20Day.jpg',
  },
  {
    index: 3,
    title: 'I saw it happen',
    url: '/@music/139%20I%20saw%20it%20happen/I%20saw%20it%20happen.mp3',
    cover: '/@music/139%20I%20saw%20it%20happen/I%20saw%20it%20happen.jpg',
  },
  {
    index: 4,
    title: 'The Pew You Never Left',
    url: '/@music/140%20The%20Pew%20You%20Never%20Left/The%20Pew%20You%20Never%20Left.mp3',
    cover: '/@music/140%20The%20Pew%20You%20Never%20Left/The%20Pew%20You%20Never%20Left.jpg',
  },
  {
    index: 5,
    title: 'Together we bring Home to Stay',
    url: '/@music/141%20Together%20we%20bring%20Home%20to%20Stay/Together%20we%20bring%20Home%20to%20Stay.mp3',
    cover: '/@music/141%20Together%20we%20bring%20Home%20to%20Stay/Together%20we%20bring%20Home%20to%20Stay.jpg',
  },
  {
    index: 6,
    title: 'Merry Christmas and Healthy 2027',
    url: '/@music/142%20Merry%20Christmas%20and%20Healthy%202027/Merry%20Christmas%20and%20Healthy%202027.mp3',
    cover: '/@music/142%20Merry%20Christmas%20and%20Healthy%202027/Merry%20Christmas%20and%20Healthy%202027.jpg',
  },
];

export interface ChristmasPlayerSnapshot {
  track: ChristmasTrack;
  isPlaying: boolean;
  isVisible: boolean;
  volume: number;
  muted: boolean;
}

type Listener = (snapshot: ChristmasPlayerSnapshot) => void;

const VOL_STORAGE_KEY = 'pvg_christmas_volume';
const MUTE_STORAGE_KEY = 'pvg_christmas_muted';
const DEFAULT_VOLUME = 0.72;
const DUCKED_RATIO = 0.2;
const FADE_MS = 650;
const DUCK_DOWN_MS = 450;
const DUCK_UP_MS = 900;

function readSavedVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;
  try {
    const raw = window.localStorage.getItem(VOL_STORAGE_KEY);
    if (raw !== null) {
      const n = parseFloat(raw);
      if (!isNaN(n) && isFinite(n)) return Math.max(0, Math.min(1, n));
    }
  } catch {}
  return DEFAULT_VOLUME;
}

function readSavedMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {}
  return false;
}

class ChristmasAlbumPlayerController {
  private audio: HTMLAudioElement | null = null;
  private trackIndex = 0;
  private isPlaying = false;
  private isVisible = false;
  private isDucked = false;
  private pausedByExternalMusic = false;
  private volume = readSavedVolume();
  private muted = readSavedMuted();
  private fadeRaf: number | null = null;
  private duckPollInterval: number | null = null;
  private duckListenersAttached = false;
  private listeners = new Set<Listener>();

  private getEffectiveTargetVolume(ducked: boolean = this.isDucked): number {
    if (this.muted || this.volume <= 0) return 0;
    return ducked ? Math.min(0.16, this.volume * DUCKED_RATIO) : this.volume;
  }

  private inspectExternalMedia(): { shouldPause: boolean; shouldDuck: boolean } {
    if (!this.audio || typeof document === 'undefined') {
      return { shouldPause: false, shouldDuck: false };
    }
    const mediaEls = document.querySelectorAll<HTMLMediaElement>('video, audio');
    let shouldPause = false;
    let shouldDuck = false;

    for (let i = 0; i < mediaEls.length; i++) {
      const el = mediaEls[i];
      if (el === this.audio) continue;
      if (!el.paused && !el.ended && !el.muted && el.volume > 0.05) {
        const src = (el.currentSrc || el.getAttribute('src') || '').toLowerCase();
        const isMusicBanner =
          el.tagName === 'AUDIO' ||
          el.dataset.pauseChristmas === 'true' ||
          src.includes('luna-story');
        if (isMusicBanner) {
          shouldPause = true;
          break;
        }
        shouldDuck = true;
      }
    }
    return { shouldPause, shouldDuck };
  }

  private checkOtherAudibleMedia = () => {
    if ((!this.isPlaying && !this.pausedByExternalMusic) || !this.audio || typeof document === 'undefined') {
      return;
    }

    const { shouldPause, shouldDuck } = this.inspectExternalMedia();

    // 1. Full pause when another music track (e.g. "Luna als eigen personage" or ChapterAudio) is audible
    if (shouldPause) {
      if (this.isPlaying) {
        this.pausedByExternalMusic = true;
        this.isPlaying = false;
        this.isDucked = false;
        this.emit();
        const audio = this.audio;
        this.fadeVolume(audio.volume, 0, 400, () => {
          if (this.pausedByExternalMusic) {
            audio.pause();
          }
        });
      }
      return;
    }

    // 2. Auto-resume smoothly when the external music stops / is muted / scrolls away
    if (this.pausedByExternalMusic) {
      this.pausedByExternalMusic = false;
      this.isDucked = shouldDuck;
      this.isPlaying = true;
      this.emit();
      const audio = this.audio;
      const target = this.getEffectiveTargetVolume(this.isDucked);
      audio.volume = 0;
      audio
        .play()
        .then(() => {
          if (this.isPlaying) {
            this.fadeVolume(0, target, DUCK_UP_MS);
          }
        })
        .catch(() => {
          this.isPlaying = false;
          this.emit();
        });
      return;
    }

    // 3. Gentle ducking for spoken-word / ambient banners (e.g. fortune teller)
    if (shouldDuck !== this.isDucked) {
      this.isDucked = shouldDuck;
      const target = this.getEffectiveTargetVolume(this.isDucked);
      const duration = this.isDucked ? DUCK_DOWN_MS : DUCK_UP_MS;
      this.fadeVolume(this.audio.volume, target, duration);
    }
  };

  private startDuckMonitor() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (!this.duckListenersAttached) {
      document.addEventListener('play', this.checkOtherAudibleMedia, true);
      document.addEventListener('pause', this.checkOtherAudibleMedia, true);
      document.addEventListener('ended', this.checkOtherAudibleMedia, true);
      document.addEventListener('volumechange', this.checkOtherAudibleMedia, true);
      this.duckListenersAttached = true;
    }
    if (this.duckPollInterval === null) {
      this.duckPollInterval = window.setInterval(this.checkOtherAudibleMedia, 350);
    }
  }

  private stopDuckMonitor() {
    if (this.duckListenersAttached && typeof document !== 'undefined') {
      document.removeEventListener('play', this.checkOtherAudibleMedia, true);
      document.removeEventListener('pause', this.checkOtherAudibleMedia, true);
      document.removeEventListener('ended', this.checkOtherAudibleMedia, true);
      document.removeEventListener('volumechange', this.checkOtherAudibleMedia, true);
      this.duckListenersAttached = false;
    }
    if (this.duckPollInterval !== null) {
      window.clearInterval(this.duckPollInterval);
      this.duckPollInterval = null;
    }
    this.isDucked = false;
  }

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      const a = new Audio();
      a.preload = 'metadata';
      a.volume = this.getEffectiveTargetVolume(false);
      a.addEventListener('ended', () => {
        this.next();
      });
      this.audio = a;
    }
    return this.audio;
  }

  private cancelFade() {
    if (this.fadeRaf !== null) {
      window.cancelAnimationFrame(this.fadeRaf);
      this.fadeRaf = null;
    }
  }

  private fadeVolume(from: number, to: number, durationMs: number, onDone?: () => void) {
    const audio = this.audio;
    if (!audio) {
      onDone?.();
      return;
    }
    this.cancelFade();
    const start = performance.now();
    audio.volume = Math.max(0, Math.min(1, from));

    const step = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / durationMs);
      const eased = p * (2 - p);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * eased));
      if (p < 1) {
        this.fadeRaf = window.requestAnimationFrame(step);
      } else {
        this.fadeRaf = null;
        onDone?.();
      }
    };
    this.fadeRaf = window.requestAnimationFrame(step);
  }

  private emit() {
    const snap = this.getSnapshot();
    this.listeners.forEach((l) => l(snap));
  }

  getSnapshot(): ChristmasPlayerSnapshot {
    return {
      track: CHRISTMAS_ALBUM_TRACKS[this.trackIndex] || CHRISTMAS_ALBUM_TRACKS[0],
      isPlaying: this.isPlaying,
      isVisible: this.isVisible,
      volume: this.volume,
      muted: this.muted,
    };
  }

  setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, Number(val) || 0));
    this.volume = clamped;
    if (clamped > 0 && this.muted) {
      this.muted = false;
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, '0');
      } catch {}
    }
    try {
      window.localStorage.setItem(VOL_STORAGE_KEY, String(clamped));
    } catch {}
    if (this.audio && this.isPlaying) {
      this.cancelFade();
      this.audio.volume = this.getEffectiveTargetVolume(this.isDucked);
    }
    this.emit();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      window.localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? '1' : '0');
    } catch {}
    if (this.audio && this.isPlaying) {
      this.cancelFade();
      this.audio.volume = this.getEffectiveTargetVolume(this.isDucked);
    }
    this.emit();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  play(index?: number) {
    const audio = this.ensureAudio();
    if (!audio) return;

    // Pause homepage soundtrack so there is never overlapping audio
    try {
      homeSoundtrack.stopImmediately();
    } catch {
      // ignore
    }

    if (typeof index === 'number') {
      this.trackIndex = ((index % CHRISTMAS_ALBUM_TRACKS.length) + CHRISTMAS_ALBUM_TRACKS.length) % CHRISTMAS_ALBUM_TRACKS.length;
    }

    const track = CHRISTMAS_ALBUM_TRACKS[this.trackIndex];
    const targetSrc = new URL(track.url, window.location.origin).href;
    if (audio.src !== targetSrc) {
      audio.src = track.url;
    }

    this.isVisible = true;
    this.pausedByExternalMusic = false;
    this.isPlaying = true;
    this.emit();
    this.startDuckMonitor();

    // Check immediately if an unmuted video/audio is already playing
    const { shouldPause, shouldDuck } = this.inspectExternalMedia();
    if (shouldPause) {
      this.pausedByExternalMusic = true;
      this.isPlaying = false;
      this.isDucked = false;
      this.emit();
      return;
    }

    this.isDucked = shouldDuck;
    const initialTarget = this.getEffectiveTargetVolume(this.isDucked);

    audio.volume = 0;
    audio
      .play()
      .then(() => {
        this.fadeVolume(0, initialTarget, FADE_MS);
      })
      .catch(() => {
        this.isPlaying = false;
        this.stopDuckMonitor();
        this.emit();
      });
  }

  pause() {
    const audio = this.audio;
    this.pausedByExternalMusic = false;
    if (!audio || !this.isPlaying) {
      this.stopDuckMonitor();
      this.emit();
      return;
    }
    this.isPlaying = false;
    this.stopDuckMonitor();
    this.emit();
    this.fadeVolume(audio.volume, 0, FADE_MS, () => {
      audio.pause();
    });
  }

  stop() {
    const audio = this.audio;
    this.pausedByExternalMusic = false;
    this.isPlaying = false;
    this.isVisible = false;
    this.stopDuckMonitor();
    this.emit();
    if (!audio) return;
    this.fadeVolume(audio.volume, 0, 450, () => {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // ignore
      }
    });
  }

  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  next() {
    const nextIdx = (this.trackIndex + 1) % CHRISTMAS_ALBUM_TRACKS.length;
    this.play(nextIdx);
  }

  prev() {
    const prevIdx = (this.trackIndex - 1 + CHRISTMAS_ALBUM_TRACKS.length) % CHRISTMAS_ALBUM_TRACKS.length;
    this.play(prevIdx);
  }
}

export const christmasAlbumPlayer = new ChristmasAlbumPlayerController();

export function useChristmasAlbumPlayer(): ChristmasPlayerSnapshot {
  const [snap, setSnap] = useState<ChristmasPlayerSnapshot>(() =>
    christmasAlbumPlayer.getSnapshot()
  );

  useEffect(() => christmasAlbumPlayer.subscribe(setSnap), []);
  return snap;
}
