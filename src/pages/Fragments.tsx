import { Link } from 'react-router-dom';
import { BOOKS } from '../data/books';
import { motion, AnimatePresence } from 'motion/react';
import { Quote, BookOpen, Volume2, VolumeX, Info, RotateCcw } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { useAudio } from '../context/AudioContext';
import { cn } from '../lib/utils';

// Known mobile assets based on user project state
const KNOWN_MOBILE_ASSETS = [
  '/images/banner-boek-1-mobile.jpg',
  '/images/banner-boek-2-mobile.jpg',
  '/images/banner-boek-3-mobile.jpg',
  '/images/banner-boek-4-mobile.jpg',
  '/videos/fragment-boek-1-mobile.mp4',
  '/videos/fragment-boek-2-mobile.mov',
  '/videos/fragment-boek-3-mobile.mov',
  '/videos/fragment-boek-4-mobile.mov',
  '/videos/leeuw-in-de-kerk-mobile.mov',
  '/videos/luna-story-mobile.mov'
];

function useMobileMedia() {
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.matchMedia("(orientation: portrait)").matches;
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobilePortrait(isSmallScreen && isPortrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return isMobilePortrait;
}

function getMediaUrl(originalUrl: string | undefined, isMobilePortrait: boolean) {
  if (!originalUrl) return originalUrl;
  if (!isMobilePortrait) return originalUrl;

  const parts = originalUrl.split('.');
  const ext = parts.pop();
  const base = parts.join('.');
  
  // Try different extensions for mobile videos since the user provided both .mov and .mp4
  const videoExtensions = ['mov', 'mp4'];
  
  if (ext === 'mp4' || ext === 'mov') {
    for (const vExt of videoExtensions) {
      const mobileUrl = `${base}-mobile.${vExt}`;
      if (KNOWN_MOBILE_ASSETS.includes(mobileUrl)) {
        return mobileUrl;
      }
    }
  }

  const mobileUrl = `${base}-mobile.${ext}`;
  return KNOWN_MOBILE_ASSETS.includes(mobileUrl) ? mobileUrl : originalUrl;
}

function VideoFragment({ book, index }: { book: any; index: number }) {
  const { videoMuted, toggleVideoMute, setIsAmbientPlaying, masterVolume, reportVideoAudioStatus } = useAudio();
  const [activeMedia, setActiveMedia] = useState<'video' | 'image'>('video');
  const [isVisible, setIsVisible] = useState(false);
  const mediaContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const isMobilePortrait = useMobileMedia();
  
  const videoUrl = useMemo(() => getMediaUrl(book.fragmentVideoUrl, isMobilePortrait), [book.fragmentVideoUrl, isMobilePortrait]);
  const bannerUrl = useMemo(() => getMediaUrl(book.bannerUrl, isMobilePortrait), [book.bannerUrl, isMobilePortrait]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { 
        threshold: isMobilePortrait ? 0.3 : 0.8, // More lenient on mobile
        rootMargin: "0px"
      }
    );

    if (mediaContainerRef.current) {
      observer.observe(mediaContainerRef.current);
    }

    return () => observer.disconnect();
  }, [isMobilePortrait]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = videoMuted;
      videoRef.current.volume = masterVolume;
    }
  }, [videoMuted, masterVolume]);

  useEffect(() => {
    const playVideo = async () => {
      const video = videoRef.current;
      if (video) {
        try {
          if (isVisible && activeMedia === 'video') {
            // Force muted if we're trying to autoplay without user interaction
            if (videoMuted) {
              video.muted = true;
            }
            await video.play();
          } else {
            video.pause();
          }
        } catch (e) {
          console.warn("Video playback failed:", e);
        }
      }
    };
    playVideo();
  }, [isVisible, activeMedia, videoUrl, videoMuted]);

  // Handle ambient sound when video is playing
  useEffect(() => {
    let wasReporting = false;
    if (isVisible && activeMedia === 'video' && !videoMuted) {
      reportVideoAudioStatus(true);
      wasReporting = true;
    }

    return () => {
      if (wasReporting) {
        reportVideoAudioStatus(false);
      }
    };
  }, [isVisible, activeMedia, videoMuted, reportVideoAudioStatus]);

  // Verwijder de auto-switch van image naar video. 
  // Gebruiker wenst dat de banner blijft staan als deze getoond wordt.

  return (
    <motion.section
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="max-w-5xl mx-auto"
    >
      {/* Header for the Fragment */}
      <div className="text-center mb-12">
        <span className="text-earth-clay/60 font-bold tracking-[0.3em] uppercase text-[10px] mb-3 block">
          Boek {index + 1}
        </span>
        <h2 className="text-4xl md:text-5xl font-serif text-earth-dark mb-4">{book.title}</h2>
        <div className="w-12 h-px bg-earth-clay mx-auto opacity-30" />
      </div>

      {/* Cinematic Presence with Cross-fade */}
      <div className="relative mb-16 group">
        <div 
          ref={mediaContainerRef}
          style={{ aspectRatio: isMobilePortrait ? '9/16' : undefined }}
          className={cn(
            "rounded-3xl overflow-hidden shadow-2xl relative bg-earth-dark ring-1 ring-white/5 transition-all duration-700 mx-auto",
            isMobilePortrait 
              ? "w-[90%] max-w-[450px]" 
              : "aspect-[21/9] md:aspect-[16/7] w-full"
          )}
        >
          <AnimatePresence mode="wait">
            {activeMedia === 'video' ? (
              <motion.div
                key="video"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute inset-0 w-full h-full"
              >
                <video 
                  ref={videoRef}
                  key={videoUrl} // Force re-render when switching to mobile video
                  muted={videoMuted}
                  playsInline
                  autoPlay={activeMedia === 'video'}
                  preload="auto"
                  onEnded={() => setActiveMedia('image')}
                  className="w-full h-full object-cover opacity-100"
                >
                  <source src={videoUrl} type="video/mp4" />
                </video>
                
                {/* Controls Overlay */}
                <div className="absolute bottom-6 right-6 flex items-center gap-3 z-20">
                  {/* Speaker Control Overlay voor Video Geluid */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVideoMute();
                    }}
                    className="p-4 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all border border-white/10 group/btn"
                    aria-label={videoMuted ? "Unmute video" : "Mute video"}
                  >
                    {videoMuted ? (
                      <VolumeX className="w-5 h-5 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
                    ) : (
                      <Volume2 className="w-5 h-5 text-white" />
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="image"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute inset-0 w-full h-full"
              >
                {bannerUrl ? (
                  <>
                    <img 
                      src={bannerUrl} 
                      alt={book.title}
                      className="w-full h-full object-cover opacity-80"
                    />
                    {/* Replay Button Overlay */}
                    <div className="absolute bottom-6 right-6 z-20">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMedia('video');
                        }}
                        className="p-4 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all border border-white/10 group/btn"
                        aria-label="Video opnieuw starten"
                        title="Video opnieuw starten"
                      >
                        <RotateCcw className="w-5 h-5 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-earth-clay/10 italic">
                    Fragment pauze
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
        </div>
        
        {/* Decorative floating elements */}
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-earth-clay/5 blur-3xl rounded-full" />
        <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-earth-clay/5 blur-3xl rounded-full" />
      </div>

      {/* Fragment Content */}
      <div className="px-6 md:px-12">
        <div className="relative max-w-3xl mx-auto">
          <Quote className="absolute -top-12 -left-8 md:-left-16 w-20 h-20 text-earth-clay opacity-10" />
          
          <div className="space-y-8 text-xl md:text-2xl text-earth-dark/90 font-serif leading-relaxed italic text-left whitespace-pre-wrap">
            {book.fragmentText}
          </div>

          <div className="mt-20 flex flex-col items-center gap-8">
            <div className="h-px w-32 bg-earth-clay/20" />
            <Link 
              to={`/boeken/${book.slug}`}
              className="group flex flex-col items-center gap-3 no-underline"
            >
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-earth-clay/60 group-hover:text-earth-clay transition-colors">
                Ontdek meer over dit deel
              </span>
              <div className="flex items-center gap-2 text-earth-dark font-serif italic text-lg group-hover:text-earth-clay transition-colors">
                <BookOpen className="w-5 h-5 text-earth-clay" />
                <span>Naar {book.title}</span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export function Fragments() {
  const { ambientMuted, toggleAmbientMute, masterVolume } = useAudio();
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);

  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    if (heroVideoRef.current) {
      heroVideoRef.current.volume = masterVolume;
    }
  }, [masterVolume]);

  useEffect(() => {
    const playVideo = async () => {
      if (heroVideoRef.current) {
        heroVideoRef.current.muted = true;
        heroVideoRef.current.volume = masterVolume;
        try {
          // Small delay to ensure browser acknowledges initialization
          await new Promise(resolve => setTimeout(resolve, 100));
          await heroVideoRef.current.play();
        } catch (err) {
          console.log("Hero autoplay blocked, waiting for interaction");
        }
      }
    };
    playVideo();
  }, [masterVolume]);

  return (
    <div className="flex flex-col min-h-screen bg-earth-light">
      {/* Intro Header (Hero Video) */}
      <section className="relative h-[65vh] w-full flex items-center justify-center overflow-hidden bg-black text-white">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-500"
          style={{ backgroundImage: 'url(/images/fragment-bg.jpg)' }}
        >
          <video 
            ref={heroVideoRef}
            autoPlay 
            muted 
            loop 
            playsInline
            poster="/images/fragment-bg.jpg"
            onPlaying={() => setVideoLoaded(true)}
            onLoadedData={() => setVideoLoaded(true)}
            onCanPlay={() => setVideoLoaded(true)}
            onError={(e) => {
              console.error("Hero video error:", e);
              // Ensure we show something if video fails
              setVideoLoaded(true);
            }}
            className="w-full h-full object-cover transition-opacity duration-1000"
          >
            <source src="/videos/fragments-bg.mp4" type="video/mp4" />
            <source src="/videos/home.mp4" type="video/mp4" />
          </video>
          {/* Contrast-enhancing overlay removed or lightened as per user request */}
          <div className="absolute inset-0 bg-black/10 bg-gradient-to-b from-black/20 via-transparent to-black/30" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center w-full">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-serif font-bold mb-6 text-white drop-shadow-2xl"
            style={{ textShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
          >
            Fragmenten
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl font-bold italic mb-10 font-serif text-white/95"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}
          >
            "Woorden zijn de echo van de ziel."
          </motion.p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-20">
        {/* Header - Nu meer een introductie tekst onder de hero */}
        <header className="mb-20 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-earth-clay font-bold tracking-[0.2em] uppercase text-xs mb-4 block">Een voorproefje van de reeks</span>
            <p className="text-lg text-gray-600 leading-relaxed italic">
              "Laat je meevoeren door de momenten die de stilte doorbraken."
            </p>
          </motion.div>
        </header>

        {/* Spoiler waarschuwing */}
        <div className="max-w-4xl mx-auto mb-20 bg-amber-50 border border-amber-200 p-6 rounded-2xl flex gap-4 items-start shadow-sm">
          <Info className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
          <div>
            <p className="font-bold text-amber-800">Spoiler-waarschuwing</p>
            <p className="text-amber-700 text-sm">
              De audio-fragmenten en teksten hieronder bevatten cruciale passages uit de boeken. 
              Als je de verhaallijnen puur wilt ervaren bij het lezen, wees dan voorzichtig met het beluisteren of bekijken van deze fragmenten.
            </p>
          </div>
        </div>

        {/* Fragments List */}
        <div className="space-y-48">
          {BOOKS.map((book, index) => (
            <VideoFragment 
              key={book.id} 
              book={book} 
              index={index} 
            />
          ))}
        </div>

        {/* Closing */}
        <footer className="mt-48 pb-20 border-t border-earth-clay/10 pt-20">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="space-y-8"
            >
              <Quote className="w-10 h-10 text-earth-clay mx-auto opacity-20" />
              <p className="text-3xl md:text-4xl font-serif italic text-earth-dark/80 leading-snug">
                "Elk hoofdstuk is een stap dichter bij de bestemming."
              </p>
              <div className="flex justify-center items-center gap-4 text-earth-clay/40 uppercase tracking-[0.4em] text-[10px] font-bold">
                <span className="h-px w-8 bg-current" />
                <span>Paul van Geenen</span>
                <span className="h-px w-8 bg-current" />
              </div>
            </motion.div>
          </div>
        </footer>
      </div>
    </div>
  );
}
