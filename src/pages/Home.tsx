import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Volume2, Volume1, VolumeX } from 'lucide-react';
import { IvoryHeartPendant } from '../components/ui/IvoryHeartPendant';
import { Link } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import page9Img from '../assets/images/hoofdstuk9.jpg';
import { LogboekPreviewSection } from '../components/LogboekPreviewSection';
import { useAudio } from '../context/AudioContext';
import { homeSoundtrack, HomeSoundtrackSnapshot } from '../lib/homeSoundtrack';

const DEFAULT_HERO_VIDEO = '/videos/home.mp4';
const CROSSFADE_MS = 1100;
const CROSSFADE_LEAD_SEC = 1.2;

const HOME_VIDEOS_API =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://paulvangeenen.nl/api/home_videos.php'
    : '/api/home_videos.php';

function getOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'landscape';
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

function getIsPhoneOrPortrait(): boolean {
  if (typeof window === 'undefined') return false;
  const isPortrait = window.innerHeight > window.innerWidth;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  const isMobilePhoneUA =
    typeof navigator !== 'undefined' &&
    /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(navigator.userAgent);
  return isPortrait || shortSide <= 540 || isMobilePhoneUA;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function Home() {
  const { reportVideoAudioStatus } = useAudio();
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => getOrientation());
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [usingFallbackBlossom, setUsingFallbackBlossom] = useState(false);
  const [soundtrackState, setSoundtrackState] = useState<HomeSoundtrackSnapshot | null>(null);

  // Dual-deck state for true simultaneous crossfade (outgoing fades out while incoming fades in)
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const [slotIndexA, setSlotIndexA] = useState<number>(0);
  const [slotIndexB, setSlotIndexB] = useState<number>(1);
  const [deckAReady, setDeckAReady] = useState(false);
  const [deckBReady, setDeckBReady] = useState(false);
  const [isPhotoHovered, setIsPhotoHovered] = useState(false);
  const [heroTextVisible, setHeroTextVisible] = useState(true);

  const heroSectionRef = useRef<HTMLElement>(null);
  const heroInViewRef = useRef<boolean>(true);
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const activeSlotRef = useRef<'A' | 'B'>('A');
  const slotIndexARef = useRef<number>(0);
  const slotIndexBRef = useRef<number>(1);
  const crossfadingRef = useRef<boolean>(false);
  const cleanupTimerRef = useRef<number | null>(null);
  const heroTextTimerRef = useRef<number | null>(null);
  const errorCountRef = useRef<number>(0);

  activeSlotRef.current = activeSlot;
  slotIndexARef.current = slotIndexA;
  slotIndexBRef.current = slotIndexB;

  // Detect portrait <-> landscape switches
  useEffect(() => {
    const handleOrientation = () => {
      const next = getOrientation();
      setOrientation((prev) => (prev !== next ? next : prev));
    };
    window.addEventListener('resize', handleOrientation);
    window.addEventListener('orientationchange', handleOrientation);
    return () => {
      window.removeEventListener('resize', handleOrientation);
      window.removeEventListener('orientationchange', handleOrientation);
    };
  }, []);

  // Fetch enabled .mov videos for current orientation and shuffle into a new random playlist
  useEffect(() => {
    let cancelled = false;
    if (cleanupTimerRef.current) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    crossfadingRef.current = false;
    errorCountRef.current = 0;
    setDeckAReady(false);
    setDeckBReady(false);
    setActiveSlot('A');
    setSlotIndexA(0);
    setSlotIndexB(1);

    const loadPlaylist = async () => {
      try {
        const res = await fetch(
          `${HOME_VIDEOS_API}?action=list&orientation=${orientation}&only_enabled=1&_t=${Date.now()}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const urls: string[] = Array.isArray(data?.videos)
          ? data.videos.map((v: any) => v?.url).filter(Boolean)
          : [];

        if (cancelled) return;

        if (urls.length > 0) {
          setPlaylist(shuffleArray(urls));
          setUsingFallbackBlossom(false);
        } else {
          setPlaylist([]);
          setUsingFallbackBlossom(true);
        }
      } catch {
        if (cancelled) return;
        setPlaylist([]);
        setUsingFallbackBlossom(true);
      }
    };

    loadPlaylist();
    return () => {
      cancelled = true;
    };
  }, [orientation]);

  const isLoopingSingle = usingFallbackBlossom || playlist.length <= 1;

  const srcA =
    usingFallbackBlossom || playlist.length === 0
      ? DEFAULT_HERO_VIDEO
      : playlist[slotIndexA % playlist.length];

  const srcB =
    !isLoopingSingle && playlist.length > 1
      ? playlist[slotIndexB % playlist.length]
      : '';

  // Start playback on deck A when playlist initializes or switches to fallback
  useEffect(() => {
    const elA = videoRefA.current;
    if (!elA || !srcA) return;
    if (activeSlotRef.current !== 'A') return;
    elA.muted = true;
    elA.defaultMuted = true;
    const t = window.setTimeout(() => {
      if (!document.hidden && videoRefA.current && activeSlotRef.current === 'A') {
        videoRefA.current.play().catch(() => {});
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [srcA, orientation, usingFallbackBlossom]);

  // Subscribe to persistent homepage soundtrack controller (survives navigation with fade-out & resume fade-in)
  useEffect(() => {
    const unsubscribe = homeSoundtrack.subscribe(setSoundtrackState);
    return unsubscribe;
  }, []);

  // Start / resume homepage soundtrack when Home mounts, fade out & pause when navigating away
  useEffect(() => {
    reportVideoAudioStatus(true);
    homeSoundtrack.enterHome();
    return () => {
      homeSoundtrack.leaveHome();
      reportVideoAudioStatus(false);
    };
  }, [reportVideoAudioStatus]);

  // Fade out & pause soundtrack when user scrolls hero video out of view;
  // resume & fade in only when hero video is more than 50% back in view.
  useEffect(() => {
    const heroEl = heroSectionRef.current;
    if (!heroEl || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const ratio = entry.intersectionRatio;

        if (heroInViewRef.current && ratio <= 0.05) {
          heroInViewRef.current = false;
          homeSoundtrack.setHeroInView(false);
          const activeEl = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
          activeEl?.pause();
        } else if (!heroInViewRef.current && ratio > 0.5) {
          heroInViewRef.current = true;
          homeSoundtrack.setHeroInView(true);
          const activeEl = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
          if (activeEl && !document.hidden) {
            activeEl.muted = true;
            activeEl.play().catch(() => {});
          }
        }
      },
      { threshold: [0, 0.05, 0.25, 0.5, 0.52, 0.75] }
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  // Pause playback when homepage tab is hidden, resume active deck when visible again
  useEffect(() => {
    const onVisibilityChange = () => {
      const activeEl = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
      const idleEl = activeSlotRef.current === 'A' ? videoRefB.current : videoRefA.current;
      homeSoundtrack.handleVisibilityChange(document.hidden);
      if (document.hidden) {
        activeEl?.pause();
        idleEl?.pause();
      } else if (activeEl) {
        activeEl.muted = true;
        activeEl.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Mobile (both portrait AND landscape on phones): auto-hide hero text after 10s of inactivity
  // so the .mov shines in full glory; bring it back immediately on tap/click/swipe and restart the 10s timer.
  useEffect(() => {
    const clearTextTimer = () => {
      if (heroTextTimerRef.current) {
        window.clearTimeout(heroTextTimerRef.current);
        heroTextTimerRef.current = null;
      }
    };

    if (!getIsPhoneOrPortrait() || usingFallbackBlossom) {
      clearTextTimer();
      setHeroTextVisible(true);
      return;
    }

    const scheduleHide = () => {
      clearTextTimer();
      heroTextTimerRef.current = window.setTimeout(() => {
        setHeroTextVisible(false);
      }, 10000);
    };

    const handleUserActivity = () => {
      setHeroTextVisible(true);
      scheduleHide();
    };

    setHeroTextVisible(true);
    scheduleHide();

    window.addEventListener('pointerdown', handleUserActivity, { passive: true });
    window.addEventListener('touchstart', handleUserActivity, { passive: true });
    window.addEventListener('touchmove', handleUserActivity, { passive: true });
    window.addEventListener('click', handleUserActivity, { passive: true });
    window.addEventListener('scroll', handleUserActivity, { passive: true });

    return () => {
      clearTextTimer();
      window.removeEventListener('pointerdown', handleUserActivity);
      window.removeEventListener('touchstart', handleUserActivity);
      window.removeEventListener('touchmove', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [orientation, usingFallbackBlossom]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) {
        window.clearTimeout(cleanupTimerRef.current);
      }
    };
  }, []);

  // Trigger simultaneous crossfade from current active deck to the preloaded other deck
  const triggerCrossfade = useCallback(() => {
    if (crossfadingRef.current || isLoopingSingle || playlist.length <= 1) return;
    crossfadingRef.current = true;

    const outgoingSlot = activeSlotRef.current;
    const incomingSlot: 'A' | 'B' = outgoingSlot === 'A' ? 'B' : 'A';
    const outgoingEl = outgoingSlot === 'A' ? videoRefA.current : videoRefB.current;
    const incomingEl = incomingSlot === 'A' ? videoRefA.current : videoRefB.current;

    if (incomingEl) {
      incomingEl.muted = true;
      incomingEl.defaultMuted = true;
      try {
        if (incomingEl.currentTime > 0.25) incomingEl.currentTime = 0;
      } catch {}
      if (!document.hidden) {
        incomingEl.play().catch(() => {});
      }
    }

    // Flip active slot immediately so outgoing fades out AND incoming fades in at the exact same time
    if (incomingSlot === 'A') setDeckAReady(true);
    else setDeckBReady(true);
    setActiveSlot(incomingSlot);

    // After the crossfade finishes, pause the outgoing deck and preload the next video onto it
    const incomingIdx = incomingSlot === 'A' ? slotIndexARef.current : slotIndexBRef.current;
    const nextPreloadIdx = (incomingIdx + 1) % playlist.length;

    if (cleanupTimerRef.current) window.clearTimeout(cleanupTimerRef.current);
    cleanupTimerRef.current = window.setTimeout(() => {
      if (outgoingEl) {
        outgoingEl.pause();
        try {
          outgoingEl.currentTime = 0;
        } catch {}
      }
      if (outgoingSlot === 'A') {
        setDeckAReady(false);
        setSlotIndexA(nextPreloadIdx);
      } else {
        setDeckBReady(false);
        setSlotIndexB(nextPreloadIdx);
      }
      crossfadingRef.current = false;
    }, CROSSFADE_MS + 100);
  }, [isLoopingSingle, playlist.length]);

  const handleTimeUpdate = (slot: 'A' | 'B') => {
    if (isLoopingSingle || crossfadingRef.current || activeSlotRef.current !== slot) return;
    const el = slot === 'A' ? videoRefA.current : videoRefB.current;
    if (!el || !el.duration || !isFinite(el.duration)) return;
    const remaining = el.duration - el.currentTime;
    if (remaining > 0 && remaining <= CROSSFADE_LEAD_SEC) {
      triggerCrossfade();
    }
  };

  const handleEnded = (slot: 'A' | 'B') => {
    if (isLoopingSingle || activeSlotRef.current !== slot) return;
    triggerCrossfade();
  };

  const handleError = (slot: 'A' | 'B') => {
    if (usingFallbackBlossom) return;
    errorCountRef.current += 1;
    if (playlist.length <= 1 || errorCountRef.current >= playlist.length) {
      setUsingFallbackBlossom(true);
      return;
    }
    if (slot === activeSlotRef.current) {
      crossfadingRef.current = false;
      triggerCrossfade();
    } else {
      // Skip broken preloaded video on idle deck
      const curIdx = slot === 'A' ? slotIndexARef.current : slotIndexBRef.current;
      const nextIdx = (curIdx + 1) % playlist.length;
      if (slot === 'A') setSlotIndexA(nextIdx);
      else setSlotIndexB(nextIdx);
    }
  };

  const deckAVisible = activeSlot === 'A' && deckAReady;
  const deckBVisible = activeSlot === 'B' && deckBReady;

  return (
    <div className="flex flex-col">
      {/* Hero Section — fills the full viewport below the fixed navbar in both portrait & landscape */}
      <section
        ref={heroSectionRef}
        className="relative min-h-[calc(100svh-4rem)] md:min-h-[calc(100svh-5rem)] flex items-center bg-earth-dark pt-4"
      >
        <div className="absolute inset-0 z-0 overflow-hidden bg-earth-dark">
          {/* Deck A */}
          {srcA && (
            <video
              key={`A:${orientation}:${srcA}`}
              ref={videoRefA}
              src={srcA}
              autoPlay={activeSlot === 'A'}
              muted
              loop={isLoopingSingle}
              playsInline
              preload="auto"
              onPlaying={() => {
                errorCountRef.current = 0;
                setDeckAReady(true);
              }}
              onCanPlay={() => {
                if (activeSlotRef.current === 'A') setDeckAReady(true);
              }}
              onTimeUpdate={() => handleTimeUpdate('A')}
              onEnded={() => handleEnded('A')}
              onError={() => handleError('A')}
              style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
              className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity ease-in-out ${
                deckAVisible
                  ? heroTextVisible
                    ? 'opacity-80 z-[2]'
                    : 'opacity-100 z-[2]'
                  : 'opacity-0 z-[1]'
              }`}
            />
          )}

          {/* Deck B (preloaded & crossfaded simultaneously with Deck A) */}
          {srcB && (
            <video
              key={`B:${orientation}:${srcB}`}
              ref={videoRefB}
              src={srcB}
              autoPlay={activeSlot === 'B'}
              muted
              loop={false}
              playsInline
              preload="auto"
              onPlaying={() => {
                errorCountRef.current = 0;
                setDeckBReady(true);
              }}
              onCanPlay={() => {
                if (activeSlotRef.current === 'B') setDeckBReady(true);
              }}
              onTimeUpdate={() => handleTimeUpdate('B')}
              onEnded={() => handleEnded('B')}
              onError={() => handleError('B')}
              style={{ transitionDuration: `${CROSSFADE_MS}ms` }}
              className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity ease-in-out ${
                deckBVisible
                  ? heroTextVisible
                    ? 'opacity-80 z-[2]'
                    : 'opacity-100 z-[2]'
                  : 'opacity-0 z-[1]'
              }`}
            />
          )}

          {/* Moody overlays for high contrast and atmosphere — soften in portrait when text fades out */}
          <div
            className={`absolute inset-0 z-[3] bg-black/20 pointer-events-none transition-opacity duration-1000 ${
              heroTextVisible ? 'opacity-100' : 'opacity-20'
            }`}
          />
          <div
            className={`absolute inset-0 z-[3] bg-gradient-to-r from-earth-dark/95 via-earth-dark/50 to-transparent pointer-events-none transition-opacity duration-1000 ${
              heroTextVisible ? 'opacity-100' : 'opacity-10'
            }`}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-6 md:py-12 lg:py-16">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{
              opacity: heroTextVisible ? 1 : 0,
              x: 0,
            }}
            transition={{ duration: 0.85, ease: 'easeInOut' }}
            className={`flex flex-col justify-center text-center lg:text-left items-center lg:items-start ${
              heroTextVisible ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            <span className="inline-block text-earth-gold uppercase tracking-[0.25em] text-[10px] md:text-[11px] font-bold mb-4 drop-shadow-sm">
              Vier boeken over het koesteren van het leven
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-7xl font-serif italic text-white leading-[1.1] mb-6 drop-shadow-lg">
              Van zwijgen <br />
              <span className="text-earth-gold drop-shadow-md">naar spreken.</span>
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-white/80 mb-10 max-w-lg leading-relaxed font-light">
              Een tumor als keerpunt. Ontdek mijn persoonlijke verhaal door een unieke literaire reis van geboorte tot aan de diepste echo&apos;s van mijn hart.
            </p>
            <div className="flex flex-wrap gap-6 items-center justify-center lg:justify-start">
              <Link to="/boeken" className="btn-primary flex items-center gap-2 shadow-xl hover:-translate-y-1 transition-all duration-300">
                Ontdek de reeks <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>

          {/* Dog photo only shown when falling back to original blossom video */}
          {usingFallbackBlossom && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="md:block relative self-center w-full max-w-sm mx-auto mt-8 lg:mt-0"
            >
              <motion.div
                initial={{ rotate: 2 }}
                animate={{ rotate: isPhotoHovered ? 0 : 2 }}
                onMouseEnter={() => setIsPhotoHovered(true)}
                onMouseLeave={() => setIsPhotoHovered(false)}
                onTapStart={() => setIsPhotoHovered(true)}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="relative z-10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-[280px] lg:max-w-sm mx-auto cursor-pointer"
              >
                <img
                  src={page9Img}
                  alt="Hoofdstuk 9"
                  className="w-full h-auto block"
                />
              </motion.div>

              <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-earth-gold/10 rounded-full blur-3xl" />
              <div className="absolute -top-6 -right-6 w-32 h-32 bg-earth-moss/10 rounded-full blur-3xl" />
            </motion.div>
          )}
        </div>
          {/* Prominent Song Credit Badge at the start of each track */}
          <AnimatePresence mode="wait">
            {soundtrackState?.showTitleBadge && soundtrackState?.track && (
              <motion.div
                key={`home-song-credit-${soundtrackState.track.index}`}
                initial={{ opacity: 0, y: 18, scale: 0.96, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: 12, scale: 0.97, filter: 'blur(6px)' }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-4 sm:left-8 md:left-12 bottom-7 sm:bottom-10 md:bottom-12 z-40 pointer-events-none select-none max-w-[90%] sm:max-w-md md:max-w-lg"
              >
                <div className="flex items-center gap-3.5 sm:gap-4 bg-black/80 backdrop-blur-xl px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl border border-earth-gold/55 shadow-[0_14px_40px_rgba(0,0,0,0.85),0_0_28px_rgba(212,175,55,0.22)] ring-1 ring-white/10">
                  <div className="shrink-0">
                    <div className="animate-pendant-dangle w-8 h-9 sm:w-9 sm:h-10 flex items-center justify-center drop-shadow-[0_3px_10px_rgba(212,175,55,0.45)]">
                      <IvoryHeartPendant size="md" className="w-8 h-8 sm:w-9 sm:h-9" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-earth-gold font-serif italic font-semibold tracking-wide text-lg sm:text-2xl md:text-3xl leading-tight truncate"
                      style={{
                        textShadow: '0 2px 6px #000, 0 0 14px rgba(0,0,0,0.95), 1px 1px 2px #000',
                      }}
                    >
                      &ldquo;{soundtrackState.track.title}&rdquo;
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Dedicated Homepage Soundtrack Speaker & Volume Control (bottom-right of Hero) */}
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className={`absolute right-4 sm:right-8 md:right-12 bottom-7 sm:bottom-10 md:bottom-12 z-40 flex items-center gap-2.5 bg-black/75 backdrop-blur-xl px-3.5 py-2 rounded-full border border-earth-gold/45 shadow-[0_10px_30px_rgba(0,0,0,0.75)] transition-opacity duration-700 ${
              heroTextVisible ? 'opacity-100' : 'opacity-35 hover:opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={() => homeSoundtrack.toggleMute()}
              aria-label={soundtrackState?.muted ? 'Geluid aanzetten' : 'Geluid dempen'}
              title={soundtrackState?.muted ? 'Geluid aanzetten' : 'Geluid dempen'}
              className="text-earth-gold hover:text-amber-300 transition-colors cursor-pointer shrink-0 flex items-center justify-center"
            >
              {soundtrackState?.muted || (soundtrackState?.volume ?? 0.65) <= 0.01 ? (
                <VolumeX className="w-5 h-5" />
              ) : (soundtrackState?.volume ?? 0.65) < 0.5 ? (
                <Volume1 className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={
                soundtrackState?.muted
                  ? 0
                  : Math.round((soundtrackState?.volume ?? 0.65) * 100)
              }
              onChange={(e) => homeSoundtrack.setVolume(Number(e.target.value) / 100)}
              aria-label="Volume homepage soundtrack"
              className="w-20 sm:w-28 h-1.5 rounded-lg appearance-none cursor-pointer bg-white/20 accent-[#e0bd82]"
            />

            <span className="hidden sm:inline text-[11px] font-mono text-stone-300 w-8 text-right select-none">
              {soundtrackState?.muted
                ? '0%'
                : `${Math.round((soundtrackState?.volume ?? 0.65) * 100)}%`}
            </span>
          </div>
        </section>

      {/* Logboek Sectie — net voor Het keerpunt */}
      <LogboekPreviewSection />

      {/* Intro Section */}
      <section className="section-padding bg-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="flex flex-col items-center justify-center mb-6">
            <IvoryHeartPendant size="lg" />
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-8 text-earth-dark">Het keerpunt</h2>
          <div className="space-y-6 text-lg text-earth-warm leading-relaxed">
            <p>
              Veertig jaar lang heb ik gezwegen. En dat zwijgen heeft me bijna kapotgemaakt. Een tumor dwong mij eindelijk te kijken naar wat ik zo wanhopig had weggestopt: de schaamte, de verlamming, de spijt die elke nacht aan me vrat. Wat volgde was geen verhaal, maar een bloederige ontleding — van de verstikkende cocon van mijn jeugd, via de korte, wilde ontwaking van de leeuw, naar de diepe, zwarte afgrond waarin één seconde van lafheid een heel leven kan vernietigen.
            </p>
            <p>
              Dit vierluik is geen boek. Dit is het openrijten van oude wonden. Dit is de echo die veertig jaar in mijn ziel huilt en vreet. Dit is de pijn die ik niemand gun. Durf je écht naar binnen te kijken?
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
