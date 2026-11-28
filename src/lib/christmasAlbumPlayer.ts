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
}

type Listener = (snapshot: ChristmasPlayerSnapshot) => void;

const TARGET_VOLUME = 0.72;
const DUCKED_VOLUME = 0.13;
const FADE_MS = 650;
const DUCK_DOWN_MS = 450;
const DUCK_UP_MS = 900;

class ChristmasAlbumPlayerController {
  private audio: HTMLAudioElement | null = null;
  private trackIndex = 0;
  private isPlaying = false;
  private isVisible = false;
  private isDucked = false;
  private fadeRaf: number | null = null;
  private duckPollInterval: number | null = null;
  private duckListenersAttached = false;
  private listeners = new Set<Listener>();

  private checkOtherAudibleMedia = () => {
    if (!this.isPlaying || !this.audio || typeof document === 'undefined') return;

    const mediaEls = document.querySelectorAll<HTMLMediaElement>('video, audio');
    let hasAudibleForegroundMedia = false;

    for (let i = 0; i < mediaEls.length; i++) {
      const el = mediaEls[i];
      if (el === this.audio) continue;
      if (!el.paused && !el.ended && !el.muted && el.volume > 0.05) {
        hasAudibleForegroundMedia = true;
        break;
      }
    }

    if (hasAudibleForegroundMedia !== this.isDucked) {
      this.isDucked = hasAudibleForegroundMedia;
      const target = this.isDucked ? DUCKED_VOLUME : TARGET_VOLUME;
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
      a.volume = TARGET_VOLUME;
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
    };
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
    this.isPlaying = true;
    this.emit();
    this.startDuckMonitor();

    // Check immediately if an unmuted video/audio is already playing
    let initialTarget = TARGET_VOLUME;
    if (typeof document !== 'undefined') {
      const mediaEls = document.querySelectorAll<HTMLMediaElement>('video, audio');
      for (let i = 0; i < mediaEls.length; i++) {
        const el = mediaEls[i];
        if (el !== audio && !el.paused && !el.ended && !el.muted && el.volume > 0.05) {
          this.isDucked = true;
          initialTarget = DUCKED_VOLUME;
          break;
        }
      }
    }

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
    if (!audio || !this.isPlaying) return;
    this.isPlaying = false;
    this.stopDuckMonitor();
    this.emit();
    this.fadeVolume(audio.volume, 0, FADE_MS, () => {
      audio.pause();
    });
  }

  stop() {
    const audio = this.audio;
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
