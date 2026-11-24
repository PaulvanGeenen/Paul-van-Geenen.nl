import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { IvoryHeartPendant } from '../components/ui/IvoryHeartPendant';
import { Link } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import page9Img from '../assets/images/hoofdstuk9.jpg';
import { LogboekPreviewSection } from '../components/LogboekPreviewSection';

const DEFAULT_HERO_VIDEO = '/videos/home.mp4';

const HOME_VIDEOS_API =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://paulvangeenen.nl/api/home_videos.php'
    : '/api/home_videos.php';

function getOrientation(): 'portrait' | 'landscape' {
  if (typeof window === 'undefined') return 'landscape';
  return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
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
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => getOrientation());
  const [playlist, setPlaylist] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [usingFallbackBlossom, setUsingFallbackBlossom] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [isPhotoHovered, setIsPhotoHovered] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const advancingRef = useRef(false);
  const fadeTimerRef = useRef<number | null>(null);
  const errorCountRef = useRef(0);

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
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    advancingRef.current = false;
    errorCountRef.current = 0;
    setVideoVisible(false);

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
          setCurrentIndex(0);
          setUsingFallbackBlossom(false);
        } else {
          setPlaylist([]);
          setCurrentIndex(0);
          setUsingFallbackBlossom(true);
        }
      } catch {
        if (cancelled) return;
        setPlaylist([]);
        setCurrentIndex(0);
        setUsingFallbackBlossom(true);
      }
    };

    loadPlaylist();
    return () => {
      cancelled = true;
    };
  }, [orientation]);

  const currentSrc =
    usingFallbackBlossom || playlist.length === 0
      ? DEFAULT_HERO_VIDEO
      : playlist[currentIndex % playlist.length];

  const isLoopingSingle = usingFallbackBlossom || playlist.length <= 1;

  // Pause playback when homepage tab is hidden, resume when visible again
  useEffect(() => {
    const onVisibilityChange = () => {
      const el = videoRef.current;
      if (!el) return;
      if (document.hidden) {
        el.pause();
      } else {
        el.muted = true;
        el.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // Trigger muted autoplay whenever currentSrc changes
  useEffect(() => {
    if (!currentSrc) return;
    advancingRef.current = false;
    setVideoVisible(false);

    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;

    const timer = window.setTimeout(() => {
      if (!document.hidden && videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }, 60);

    return () => window.clearTimeout(timer);
  }, [currentSrc]);

  // Cleanup fade timer on unmount
  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) {
        window.clearTimeout(fadeTimerRef.current);
      }
    };
  }, []);

  const advanceToNextVideo = useCallback(() => {
    if (advancingRef.current || playlist.length <= 1) return;
    advancingRef.current = true;
    setVideoVisible(false);

    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = window.setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
      advancingRef.current = false;
    }, 250);
  }, [playlist.length]);

  const handleVideoStart = () => {
    errorCountRef.current = 0;
    if (!advancingRef.current) {
      setVideoVisible(true);
    }
  };

  const handleTimeUpdate = () => {
    if (isLoopingSingle || advancingRef.current) return;
    const el = videoRef.current;
    if (!el || !el.duration || !isFinite(el.duration)) return;
    const remaining = el.duration - el.currentTime;
    // Start smooth fade-out ~0.85s before the video ends
    if (remaining > 0 && remaining <= 0.85) {
      setVideoVisible(false);
    }
  };

  const handleVideoEnded = () => {
    if (isLoopingSingle) return;
    advanceToNextVideo();
  };

  const handleVideoError = () => {
    if (usingFallbackBlossom) return;
    errorCountRef.current += 1;
    // If all videos in the playlist fail (e.g. unsupported codec), fall back cleanly to blossom
    if (playlist.length <= 1 || errorCountRef.current >= playlist.length) {
      setUsingFallbackBlossom(true);
      setVideoVisible(false);
      return;
    }
    advancingRef.current = false;
    setCurrentIndex((prev) => (prev + 1) % playlist.length);
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section — fills the full viewport below the fixed navbar in both portrait & landscape */}
      <section className="relative min-h-[calc(100svh-4rem)] md:min-h-[calc(100svh-5rem)] flex items-center bg-earth-dark pt-4">
        <div className="absolute inset-0 z-0 overflow-hidden bg-earth-dark">
          {currentSrc && (
            <video
              key={`${orientation}:${currentIndex}:${currentSrc}`}
              ref={videoRef}
              src={currentSrc}
              autoPlay
              muted
              loop={isLoopingSingle}
              playsInline
              onPlaying={handleVideoStart}
              onCanPlay={handleVideoStart}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              className={`w-full h-full object-cover object-center transition-opacity duration-700 ease-in-out ${
                videoVisible ? 'opacity-80' : 'opacity-0'
              }`}
            />
          )}

          {/* Moody overlays for high contrast and atmosphere */}
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-earth-dark/95 via-earth-dark/50 to-transparent pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-6 md:py-12 lg:py-16">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col justify-center text-center lg:text-left items-center lg:items-start"
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
