import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, BookOpen, RotateCcw } from 'lucide-react';

export function QrVideoPlayer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const src = (searchParams.get('src') || '').trim();
  const nextUrl = (searchParams.get('nextUrl') || '').trim();
  const customLabel = (searchParams.get('nextLabel') || '').trim();
  const buttonLabel =
    customLabel ||
    (nextUrl.toLowerCase().includes('inkijk')
      ? 'Klik hier voor het inkijkexemplaar'
      : 'Ga verder →');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Start with button visible until <video> actually fires 'playing' so mobile browsers never get stuck on a black screen
  const [needsTapToStart, setNeedsTapToStart] = useState<boolean>(true);
  const [phase, setPhase] = useState<'playing' | 'fadingOut' | 'ended'>('playing');

  // Append #t=0.001 so iOS Safari / Android Chrome decode and display the first video frame (Ginger) immediately instead of black
  const videoSrcWithFirstFrame = src
    ? src.includes('#')
      ? src
      : `${src}#t=0.001`
    : '';

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !src) return;

    vid.muted = false;
    const playPromise = vid.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        setNeedsTapToStart(true);
      });
    }
  }, [src]);

  const handleTapToStart = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = false;
    if (vid.currentTime < 0.05) {
      try {
        vid.currentTime = 0;
      } catch {}
    }
    vid
      .play()
      .then(() => {
        setNeedsTapToStart(false);
        setPhase('playing');
      })
      .catch(() => {
        setNeedsTapToStart(true);
      });
  };

  const handleVideoEnded = () => {
    setPhase('fadingOut');
    window.setTimeout(() => {
      setPhase('ended');
    }, 1100);
  };

  const handleReplay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setPhase('playing');
    vid.currentTime = 0;
    vid.muted = false;
    vid.play().catch(() => {
      setNeedsTapToStart(true);
    });
  };

  const handleOpenNext = () => {
    if (!nextUrl) {
      navigate('/');
      return;
    }
    if (nextUrl.toLowerCase().includes('/inkijkexemplaar')) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
    if (nextUrl.startsWith('/')) {
      navigate(nextUrl);
    } else if (nextUrl.startsWith('https://paulvangeenen.nl/') || nextUrl.startsWith('https://www.paulvangeenen.nl/')) {
      try {
        const u = new URL(nextUrl);
        navigate(`${u.pathname}${u.search}`);
      } catch {
        window.location.href = nextUrl;
      }
    } else {
      window.location.href = nextUrl;
    }
  };

  if (!src) {
    return (
      <div className="min-h-screen w-full bg-[#0b0a09] text-stone-200 flex items-center justify-center p-6 text-center">
        <p className="text-sm opacity-75">Geen video opgegeven.</p>
      </div>
    );
  }

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative min-h-screen w-full bg-[#090807] flex items-center justify-center overflow-hidden select-none"
    >
      {/* Fullscreen Video with smooth fade-out at the end */}
      <video
        ref={videoRef}
        src={videoSrcWithFirstFrame}
        playsInline
        preload="auto"
        onPlaying={() => {
          setNeedsTapToStart(false);
          setPhase('playing');
        }}
        onEnded={handleVideoEnded}
        onClick={needsTapToStart ? handleTapToStart : undefined}
        className={`max-h-screen max-w-full w-auto h-auto object-contain transition-opacity duration-1000 ease-in-out ${
          phase === 'fadingOut' || phase === 'ended' ? 'opacity-15' : 'opacity-100'
        }`}
      />

      {/* Familiar bottom golden button if mobile browser requires tap to start with sound */}
      <AnimatePresence>
        {needsTapToStart && phase === 'playing' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-10 left-0 right-0 z-50 flex justify-center px-4"
          >
            <button
              type="button"
              onClick={handleTapToStart}
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-earth-gold hover:bg-amber-400 text-black text-sm sm:text-base font-bold border border-white/30 shadow-[0_10px_40px_rgba(212,175,55,0.65)] cursor-pointer transition-all hover:scale-105 active:scale-95 animate-bounce"
            >
              <Volume2 className="w-4 h-4 text-black shrink-0" />
              <span>Tik hier om af te spelen</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Familiar bottom golden follow-up button after fade-out */}
      <AnimatePresence>
        {phase === 'ended' && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.94 }}
            transition={{ duration: 0.45 }}
            className="fixed bottom-10 left-0 right-0 z-50 flex flex-col items-center gap-4 px-4"
          >
            {nextUrl && (
              <button
                type="button"
                onClick={handleOpenNext}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-earth-gold hover:bg-amber-400 text-black text-sm sm:text-base font-bold border border-white/30 shadow-[0_10px_40px_rgba(212,175,55,0.65)] cursor-pointer transition-all hover:scale-105 active:scale-95 animate-bounce"
              >
                <BookOpen className="w-4 h-4 text-black shrink-0" />
                <span>{buttonLabel}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleReplay}
              className="inline-flex items-center gap-1.5 text-xs text-stone-300/75 hover:text-white transition-colors px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Opnieuw afspelen</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
