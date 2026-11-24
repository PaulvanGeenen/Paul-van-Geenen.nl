export interface HomeSoundtrackTrack {
  index: number;
  title: string;
  url: string;
}

export const HOME_SOUNDTRACK_TRACKS: HomeSoundtrackTrack[] = [
  {
    index: 0,
    title: 'Stem zonder geluid',
    url: '/videos/home/Music/01%20Stem%20zonder%20geluid.mp3',
  },
  {
    index: 1,
    title: 'Ik hoor haar stem',
    url: '/videos/home/Music/02%20Ik%20hoor%20haar%20stem.mp3',
  },
  {
    index: 2,
    title: 'Muziek is mijn Stem',
    url: '/videos/home/Music/03%20Muziek%20is%20mijn%20Stem.mp3',
  },
  {
    index: 3,
    title: 'Ik mis je',
    url: '/videos/home/Music/04%20Ik%20mis%20je.mp3',
  },
];

export interface HomeSoundtrackSnapshot {
  track: HomeSoundtrackTrack;
  isPlaying: boolean;
  showTitleBadge: boolean;
}

type Listener = (snapshot: HomeSoundtrackSnapshot) => void;

class HomeSoundtrackController {
  private audio: HTMLAudioElement | null = null;
  private trackIndex = 0;
  private savedTime = 0;
  private isOnHome = false;
  private heroInView = true;
  private muted = false;
  private targetVolume = 0.65;
  private fadeTimer: number | null = null;
  private titleBadgeTimer: number | null = null;
  private showTitleBadge = false;
  private isPlaying = false;
  private listeners = new Set<Listener>();
  private gestureCleanup: (() => void) | null = null;

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.audio) {
      const a = new Audio();
      a.preload = 'auto';
      a.volume = 0;
      a.addEventListener('ended', this.handleEnded);
      a.addEventListener('playing', this.handlePlaying);
      a.addEventListener('pause', this.handlePause);
      this.audio = a;
    }
    return this.audio;
  }

  private emit() {
    const snap: HomeSoundtrackSnapshot = {
      track: HOME_SOUNDTRACK_TRACKS[this.trackIndex] || HOME_SOUNDTRACK_TRACKS[0],
      isPlaying: this.isPlaying,
      showTitleBadge: this.showTitleBadge,
    };
    this.listeners.forEach((fn) => fn(snap));
  }

  public subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn({
      track: HOME_SOUNDTRACK_TRACKS[this.trackIndex] || HOME_SOUNDTRACK_TRACKS[0],
      isPlaying: this.isPlaying,
      showTitleBadge: this.showTitleBadge,
    });
    return () => {
      this.listeners.delete(fn);
    };
  }

  private clearFade() {
    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
  }

  private clearTitleBadgeTimer() {
    if (this.titleBadgeTimer !== null) {
      window.clearTimeout(this.titleBadgeTimer);
      this.titleBadgeTimer = null;
    }
  }

  private triggerTitleBadge(durationMs = 7500) {
    this.clearTitleBadgeTimer();
    this.showTitleBadge = true;
    this.emit();
    this.titleBadgeTimer = window.setTimeout(() => {
      this.showTitleBadge = false;
      this.emit();
    }, durationMs);
  }

  private clearGestureFallback() {
    if (this.gestureCleanup) {
      this.gestureCleanup();
      this.gestureCleanup = null;
    }
  }

  private armGestureFallback() {
    if (this.gestureCleanup || typeof window === 'undefined') return;
    const onGesture = () => {
      this.clearGestureFallback();
      if (this.isOnHome && this.heroInView && !this.muted && !document.hidden) {
        this.startOrResume(true);
      }
    };
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('touchstart', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture, { passive: true });
    this.gestureCleanup = () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('touchstart', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
  }

  private fadeVolume(from: number, to: number, durationMs: number, onComplete?: () => void) {
    const a = this.ensureAudio();
    if (!a) return;
    this.clearFade();
    const steps = 20;
    const stepMs = Math.max(15, Math.round(durationMs / steps));
    let step = 0;
    a.volume = Math.max(0, Math.min(1, from));

    this.fadeTimer = window.setInterval(() => {
      step += 1;
      const ratio = Math.min(1, step / steps);
      const nextVol = from + (to - from) * ratio;
      if (this.audio) {
        this.audio.volume = Math.max(0, Math.min(1, nextVol));
      }
      if (step >= steps) {
        this.clearFade();
        onComplete?.();
      }
    }, stepMs);
  }

  private handlePlaying = () => {
    this.isPlaying = true;
    this.emit();
  };

  private handlePause = () => {
    if (this.audio) {
      this.savedTime = this.audio.currentTime || this.savedTime;
    }
    this.isPlaying = false;
    this.emit();
  };

  private handleEnded = () => {
    if (!this.isOnHome || !this.heroInView) return;
    this.trackIndex = (this.trackIndex + 1) % HOME_SOUNDTRACK_TRACKS.length;
    this.savedTime = 0;
    this.startOrResume(true);
  };

  private startOrResume(showBadge: boolean) {
    const a = this.ensureAudio();
    if (!a || !this.isOnHome || !this.heroInView || this.muted || document.hidden) return;

    const track = HOME_SOUNDTRACK_TRACKS[this.trackIndex] || HOME_SOUNDTRACK_TRACKS[0];
    const absoluteTarget = new URL(track.url, window.location.origin).href;

    if (a.src !== absoluteTarget) {
      a.src = track.url;
      a.load();
    }

    try {
      if (this.savedTime > 0 && Math.abs((a.currentTime || 0) - this.savedTime) > 0.5) {
        a.currentTime = this.savedTime;
      }
    } catch {}

    this.clearFade();
    a.volume = 0;

    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        this.clearGestureFallback();
        if (!this.isOnHome || this.muted) {
          a.pause();
          return;
        }
        this.fadeVolume(0, this.targetVolume, 950);
        if (showBadge) {
          this.triggerTitleBadge(7500);
        }
      }).catch(() => {
        // Autoplay blocked until first user interaction
        this.armGestureFallback();
      });
    }
  }

  public enterHome(muted: boolean) {
    this.isOnHome = true;
    this.heroInView = true;
    this.muted = muted;
    if (!muted && !document.hidden) {
      this.startOrResume(true);
    }
  }

  public setHeroInView(inView: boolean) {
    if (this.heroInView === inView) return;
    this.heroInView = inView;
    if (!this.isOnHome) return;

    const a = this.audio;
    if (!inView) {
      this.clearGestureFallback();
      if (a && !a.paused) {
        const startVol = a.volume;
        this.fadeVolume(startVol, 0, 850, () => {
          if (!this.heroInView && this.audio) {
            this.savedTime = this.audio.currentTime || this.savedTime;
            this.audio.pause();
          }
        });
      } else if (a) {
        this.savedTime = a.currentTime || this.savedTime;
      }
    } else if (!this.muted && !document.hidden) {
      this.startOrResume(false);
    }
  }

  public leaveHome() {
    this.isOnHome = false;
    this.clearGestureFallback();
    this.clearTitleBadgeTimer();
    this.showTitleBadge = false;
    this.emit();

    const a = this.audio;
    if (!a) return;

    if (!a.paused) {
      const startVol = a.volume;
      this.fadeVolume(startVol, 0, 850, () => {
        if (!this.isOnHome && this.audio) {
          this.savedTime = this.audio.currentTime || this.savedTime;
          this.audio.pause();
        }
      });
    } else {
      this.savedTime = a.currentTime || this.savedTime;
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    const a = this.audio;
    if (muted) {
      this.clearGestureFallback();
      if (a && !a.paused) {
        this.fadeVolume(a.volume, 0, 450, () => {
          if (this.muted && this.audio) {
            this.savedTime = this.audio.currentTime || this.savedTime;
            this.audio.pause();
          }
        });
      }
    } else if (this.isOnHome && this.heroInView && !document.hidden) {
      this.startOrResume(false);
    }
  }

  public handleVisibilityChange(hidden: boolean) {
    if (!this.isOnHome) return;
    const a = this.audio;
    if (hidden) {
      if (a && !a.paused) {
        this.savedTime = a.currentTime || this.savedTime;
        a.pause();
      }
    } else if (!this.muted && this.heroInView) {
      this.startOrResume(false);
    }
  }
}

export const homeSoundtrack = new HomeSoundtrackController();
