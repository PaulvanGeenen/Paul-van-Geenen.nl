import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ECHO_CHAPTERS, BOOKS } from '../data/books';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Quote, Lock, Info, Volume2, VolumeX, RotateCcw, Play, Pause, Unlock, Key } from 'lucide-react';

import { useAudio } from '../context/AudioContext';
import { cn } from '../lib/utils';
import { isOwnAnalyticsIgnored, getUserGeoLocation } from '../lib/analytics';

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
  '/videos/luna-story-mobile.mov',
  '/videos/vlaai-mobile.mov',
  '/videos/Ik_ben_hier_Paul_ik_ga_nergens_heen-mobile.mov',
  '/videos/LunaWorriedFuneral-mobile.mov'
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

function ChapterAudio({ 
  url, 
  autoPlay = false, 
  isMediaOverlay = false, 
  onPlayStateChange, 
  onTimeUpdate,
  onEnded,
  isBgActive = false
}: { 
  url: string; 
  autoPlay?: boolean; 
  isMediaOverlay?: boolean; 
  onPlayStateChange?: (playing: boolean) => void; 
  onTimeUpdate?: (time: number) => void;
  onEnded?: () => void;
  isBgActive?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fadeTimerRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [suppressHover, setSuppressHover] = useState(false);
  const { masterVolume, reportVideoAudioStatus } = useAudio();
  const isMobilePortrait = useMobileMedia();

  // Handle suppression logic for background videos
  useEffect(() => {
    if (isBgActive) {
      setSuppressHover(true);
    } else {
      setSuppressHover(false);
    }
  }, [isBgActive]);

  useEffect(() => {
    if (!isHovered) {
      setSuppressHover(false);
    }
  }, [isHovered]);

  // Restore position from localStorage
  useEffect(() => {
    const savedTime = localStorage.getItem(`audio-pos-${url}`);
    if (savedTime && audioRef.current) {
      const time = parseFloat(savedTime);
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, [url]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = masterVolume;
    }
  }, [masterVolume]);

  // Auto-play once when autoPlay changes to true
  const hasAutoPlayed = useRef(false);
  useEffect(() => {
    if (autoPlay && !hasAutoPlayed.current && audioRef.current) {
      audioRef.current.play().catch(err => console.log("Audio autoplay blocked:", err));
      setIsPlaying(true);
      hasAutoPlayed.current = true;
    }
  }, [autoPlay]);

  const hasRegisteredEchoListen = useRef(false);

  // Handle ambient sound reporting & analytics
  useEffect(() => {
    reportVideoAudioStatus(isPlaying);
    if (isPlaying && !hasRegisteredEchoListen.current) {
      hasRegisteredEchoListen.current = true;
      if (!isOwnAnalyticsIgnored()) {
        getUserGeoLocation().then(geo => {
          const payload = {
            trackId: '005 de Echo',
            trackTitle: 'de Echo',
            format: 'mp3',
            rating: null,
            deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'Mobiel' : 'Desktop',
            userAgent: navigator.userAgent,
            city: geo.city,
            country: geo.country,
            lat: geo.lat,
            lng: geo.lng,
            password: 'GONDA1984',
            timestamp: new Date().toISOString()
          };
          fetch('/api/analytics/music/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(() => {});
        });
      }
    }
  }, [isPlaying, reportVideoAudioStatus]);

  useEffect(() => {
    if (onPlayStateChange) {
      onPlayStateChange(isPlaying);
    }
  }, [isPlaying, onPlayStateChange]);

  const clearFadeTimer = () => {
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  };

  const fadeToVolume = (
    el: HTMLMediaElement | null,
    targetVolume: number,
    durationMs = 250,
    onComplete?: () => void
  ) => {
    if (!el) {
      if (onComplete) onComplete();
      return;
    }
    clearFadeTimer();

    const startVol = el.volume;
    if (Math.abs(startVol - targetVolume) < 0.01) {
      el.volume = targetVolume;
      if (onComplete) onComplete();
      return;
    }

    const steps = 12;
    const intervalMs = Math.max(10, Math.round(durationMs / steps));
    let step = 0;

    fadeTimerRef.current = setInterval(() => {
      step++;
      const progress = step / steps;
      const currentVol = Math.max(0, Math.min(1, startVol + (targetVolume - startVol) * progress));
      if (el) el.volume = currentVol;

      if (step >= steps) {
        clearFadeTimer();
        if (el) el.volume = targetVolume;
        if (onComplete) onComplete();
      }
    }, intervalMs);
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = audioRef.current;
    if (!el) return;

    const targetVol = masterVolume;

    if (isPlaying) {
      setIsPlaying(false);
      fadeToVolume(el, 0, 250, () => {
        try { el.pause(); } catch (err) {}
      });
    } else {
      setIsPlaying(true);
      if (el.paused) {
        el.volume = 0;
        const p = el.play();
        const runRamp = () => {
          fadeToVolume(el, targetVol, 250);
        };
        if (p !== undefined) {
          p.then(runRamp).catch(err => {
            console.error("Playback failed:", err);
            setIsPlaying(false);
          });
        } else {
          runRamp();
        }
      } else {
        fadeToVolume(el, targetVol, 250);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      // Save position
      localStorage.setItem(`audio-pos-${url}`, time.toString());
      if (onTimeUpdate) onTimeUpdate(time);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      className={cn(
        "relative w-full flex items-center justify-center",
        isMobilePortrait ? "p-4" : "p-6"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={cn(
          "w-full max-w-2xl rounded-3xl relative overflow-hidden group/audio transition-all duration-700",
          isMobilePortrait ? "p-5" : "p-8",
          // Show white background if either no background video is active OR if user is actively hovering (and not suppressed)
          (!isBgActive || (isHovered && !suppressHover)) ? 'bg-white shadow-2xl border border-earth-clay/20' : 'bg-transparent',
          // Hide player if media overlay is active, background video is active, and not hovered/suppressed
          isMediaOverlay && isBgActive && (!isHovered || suppressHover) ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        )}
      >
        <audio 
          ref={audioRef}
          src={url}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => {
            setIsPlaying(false);
            if (onEnded) onEnded();
          }}
        />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-8">
          <button 
            onClick={togglePlay}
            className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-earth-clay text-white flex items-center justify-center hover:bg-earth-clay/90 hover:scale-110 active:scale-95 transition-all shrink-0 shadow-lg relative z-20"
          >
            {isPlaying ? <Pause className="w-6 h-6 md:w-10 md:h-10" /> : <Play className="w-6 h-6 md:w-10 md:h-10 ml-0.5 md:ml-1" />}
          </button>

          <div className="flex-1 w-full space-y-4">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 ${isBgActive ? 'text-white' : 'text-earth-dark/70'}`}>
                <span className={`w-1 h-1 rounded-full bg-earth-clay ${isPlaying ? 'animate-pulse' : ''}`} /> 
                {isPlaying ? 'Bezig met afspelen' : 'Gepauzeerd'}
              </span>
              <div className={`flex gap-4 text-[11px] font-mono font-bold tabular-nums ${isBgActive ? 'text-white' : 'text-earth-dark'}`}>
                <span className="text-earth-clay">{formatTime(currentTime)}</span>
                <span className="opacity-30">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            <div className="relative group/rail">
              <input 
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-earth-clay relative z-10 bg-earth-clay/20"
              />
              {/* Progress bar decoration */}
              <div 
                className="absolute top-1/2 left-0 h-1.5 bg-earth-clay rounded-full -translate-y-1/2 pointer-events-none"
                style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}
              />
            </div>
            
            <p className={`text-[9px] md:text-[10px] italic uppercase tracking-[0.2em] text-right font-medium ${isBgActive ? 'text-white/60' : 'text-earth-dark/40'}`}>
              Volume via menubalk
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterMedia({ chapter, bannerUrl: originalBannerUrl, index, isUnlocked = true }: { chapter: any; bannerUrl?: string; index: number; isUnlocked?: boolean }) {
  const { videoMuted, toggleVideoMute, setIsAmbientPlaying, masterVolume, reportVideoAudioStatus } = useAudio();
  const [activeMedia, setActiveMedia] = useState<'video' | 'image' | 'audio'>('video');
  const [isVisible, setIsVisible] = useState(false);
  const [bgVideoPlaying, setBgVideoPlaying] = useState(false);
  const [audioTime, setAudioTime] = useState(0);
  const [audioFinished, setAudioFinished] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);

  const isMobilePortrait = useMobileMedia();
  
  const videoUrl = useMemo(() => getMediaUrl(chapter.videoUrl, isMobilePortrait), [chapter.videoUrl, isMobilePortrait]);
  const bannerUrl = useMemo(() => getMediaUrl(originalBannerUrl || chapter.imageUrl, isMobilePortrait), [originalBannerUrl, chapter.imageUrl, isMobilePortrait]);
  const endBannerUrl = useMemo(() => getMediaUrl('/images/banner-boek-3.jpg', isMobilePortrait), [isMobilePortrait]);
  const vlaaiVideoUrl = useMemo(() => getMediaUrl('/videos/vlaai.mov', isMobilePortrait), [isMobilePortrait]);
  const paulVideoUrl = useMemo(() => getMediaUrl('/videos/Ik_ben_hier_Paul_ik_ga_nergens_heen.mov', isMobilePortrait), [isMobilePortrait]);

  const VLAAI_TRIGGER = 597; // 09:57
  const VLAAI_STOP = 634;    // 10:34
  const TRIGGER_TIME = 1090; // 18:10
  const STOP_TIME = 1112;    // 18:32

  useEffect(() => {
    if (chapter.audioUrl) {
      setActiveMedia('audio');
      setAudioFinished(false);
    } else if (chapter.videoUrl) {
      setActiveMedia('video');
    } else {
      setActiveMedia('image');
    }
  }, [chapter.audioUrl, chapter.videoUrl, chapter.imageUrl]);

  useEffect(() => {
    // Scroll media into view when it appears (after expansion animation)
    const timeout = setTimeout(() => {
      if (mediaContainerRef.current) {
        mediaContainerRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 600); // Slightly more than the height animation duration
    
    return () => clearTimeout(timeout);
  }, []);

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  const wasAboveTrigger = useRef(false);

  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsAudioPlaying(playing);
    if (playing) setAudioFinished(false);
  }, []);

  const handleAudioEnded = useCallback(() => {
    setAudioFinished(true);
  }, []);

  const vlaaiVideoRef = useRef<HTMLVideoElement>(null);

  // Sync background video with audio trigger and play state
  useEffect(() => {
    const isAboveVlaai = audioTime >= VLAAI_TRIGGER;
    const isPastVlaaiStop = audioTime >= VLAAI_STOP;
    const isAbovePaul = audioTime >= TRIGGER_TIME;
    const isPastStop = audioTime >= STOP_TIME;
    
    const vlaaiVideo = vlaaiVideoRef.current;
    const paulVideo = bgVideoRef.current;
    
    // Vlaai Video Logic
    if (isAboveVlaai && !isPastVlaaiStop) {
      if (vlaaiVideo) {
        vlaaiVideo.playbackRate = 0.5;
        if (isAudioPlaying) {
          vlaaiVideo.play().catch(() => {});
        } else {
          vlaaiVideo.pause();
        }
      }
    } else if (isPastVlaaiStop) {
      vlaaiVideo?.pause();
    } else {
      if (vlaaiVideo) {
        vlaaiVideo.pause();
        vlaaiVideo.currentTime = 0;
      }
    }

    // Paul Video Logic
    if (isAbovePaul && !wasAboveTrigger.current) {
      if (paulVideo) paulVideo.currentTime = 0;
    }
    
    if (isAbovePaul && !isPastStop) {
      if (isAudioPlaying) {
        paulVideo?.play().catch(() => {});
      } else {
        paulVideo?.pause();
      }
    } else if (isPastStop) {
      paulVideo?.pause();
    } else {
      if (paulVideo) {
        paulVideo.pause();
        paulVideo.currentTime = 0;
      }
    }
    
    wasAboveTrigger.current = isAbovePaul;
  }, [audioTime >= VLAAI_TRIGGER, audioTime >= VLAAI_STOP, audioTime >= TRIGGER_TIME, audioTime >= STOP_TIME, isAudioPlaying]);

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

  // Video afspelen/pauzeren op basis van zichtbaarheid
  useEffect(() => {
    const playVideo = async () => {
      const video = videoRef.current;
      if (video) {
        try {
          if (isVisible && activeMedia === 'video') {
            // Force muted if we're trying to autoplay
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

  // Schakel ambient geluid uit als een fragment video speelt
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

  if (!chapter.videoUrl && !chapter.imageUrl && !chapter.audioUrl) return null;

  return (
    <div 
      ref={mediaContainerRef} 
      style={{ aspectRatio: isMobilePortrait ? '9/16' : undefined }}
      className={cn(
        "rounded-3xl overflow-hidden shadow-2xl relative transition-all duration-1000 ease-in-out mx-auto ring-1 ring-white/5",
        isMobilePortrait 
          ? "w-[90%] max-w-[450px] bg-white" 
          : activeMedia === 'audio' 
            ? "w-[95%] bg-white" 
            : "w-full aspect-video bg-earth-dark"
      )}
    >
      <AnimatePresence mode="wait">
        {activeMedia === 'audio' ? (
          <motion.div
            key="audio"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "w-full flex items-center justify-center relative",
              isMobilePortrait ? "h-full py-8 px-4" : "py-12 md:py-24 px-6"
            )}
          >
            {/* Banner Image Background (Initial) */}
            <img 
              src={bannerUrl} 
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[5000ms] grayscale ${(audioTime >= TRIGGER_TIME && audioTime < STOP_TIME) ? 'opacity-0' : 'opacity-20'}`}
              referrerPolicy="no-referrer"
            />

            {/* Vlaai Video - Triggered at 09:57, Fades out at 10:34 */}
            <video 
              ref={vlaaiVideoRef}
              key={vlaaiVideoUrl}
              muted
              playsInline
              loop
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[5000ms] pointer-events-none ${(audioTime >= VLAAI_TRIGGER && audioTime < VLAAI_STOP) ? 'opacity-100' : 'opacity-0'}`}
            >
              <source src={vlaaiVideoUrl} type="video/mp4" />
            </video>

            {/* Background Video - Triggered at 18:10, Fades out at 18:47 */}
            <video 
              ref={bgVideoRef}
              key={paulVideoUrl}
              muted
              playsInline
              onPlaying={() => setBgVideoPlaying(true)}
              onPause={() => setBgVideoPlaying(false)}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[5000ms] pointer-events-none ${(audioTime >= TRIGGER_TIME && audioTime < STOP_TIME) ? 'opacity-100' : 'opacity-0'}`}
            >
              <source src={paulVideoUrl} type="video/mp4" />
            </video>

            {/* End Banner - Gradually fades in when audio finishes */}
            <img 
              src={endBannerUrl} 
              alt=""
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-[10000ms] z-10 pointer-events-none ${audioFinished ? 'opacity-100' : 'opacity-0'}`}
              referrerPolicy="no-referrer"
            />

            <div className="w-full max-w-4xl relative z-20">
              <ChapterAudio 
                url={chapter.audioUrl} 
                autoPlay={isUnlocked && chapter.isLocked} 
                isMediaOverlay 
                onPlayStateChange={handlePlayStateChange}
                onTimeUpdate={setAudioTime}
                onEnded={handleAudioEnded}
                isBgActive={(audioTime >= VLAAI_TRIGGER && audioTime < VLAAI_STOP) || (audioTime >= TRIGGER_TIME && audioTime < STOP_TIME)}
              />
            </div>
          </motion.div>
        ) : activeMedia === 'video' ? (
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
              key={videoUrl}
              muted={videoMuted}
              playsInline
              autoPlay={activeMedia === 'video'}
              preload="auto"
              onEnded={() => setActiveMedia('image')}
              className="w-full h-full object-cover"
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
            
            {/* Controls Overlay */}
            <div className="absolute bottom-6 right-6 flex items-center gap-3 z-20">
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
            <img 
              src={bannerUrl} 
              alt={chapter.title}
              className="w-full h-full object-cover opacity-80"
              referrerPolicy="no-referrer"
            />
            {chapter.videoUrl && (
              <div className="absolute bottom-6 right-6 z-20">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMedia('video');
                  }}
                  className="p-4 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md transition-all border border-white/10 group/btn"
                >
                  <RotateCcw className="w-5 h-5 opacity-70 group-hover/btn:opacity-100 transition-opacity" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {activeMedia !== 'audio' && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
      )}
    </div>
  );
}

export function Echo() {
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [unlockedChapters, setUnlockedChapters] = useState<Record<string, boolean>>({});
  const [lockAttempt, setLockAttempt] = useState<Record<string, string>>({});
  const [lockError, setLockError] = useState<Record<string, boolean>>({});

  const { ambientMuted, toggleAmbientMute, masterVolume } = useAudio();
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const echoBook = BOOKS.find(b => b.slug === 'de-echo');

  const tryUnlock = (chapterId: string, code: string, correctCode: string) => {
    if (code.trim().toUpperCase() === correctCode.toUpperCase()) {
      setUnlockedChapters(prev => ({ ...prev, [chapterId]: true }));
      setLockError(prev => ({ ...prev, [chapterId]: false }));
    } else {
      setLockError(prev => ({ ...prev, [chapterId]: true }));
      // Error feedback timer
      setTimeout(() => setLockError(prev => ({ ...prev, [chapterId]: false })), 2000);
    }
  };

  useEffect(() => {
    if (heroVideoRef.current) {
      heroVideoRef.current.volume = masterVolume;
    }
  }, [masterVolume]);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    // Force muted property to true (Chrome requires this explicitly sometimes)
    video.muted = true;

    const playVideo = async () => {
      try {
        await video.play();
      } catch (err) {
        console.log("Autoplay blocked, waiting for interaction");
        // Fallback: play on first user interaction
        const startOnInteraction = () => {
          video.play().catch(() => {});
          window.removeEventListener('click', startOnInteraction);
          window.removeEventListener('scroll', startOnInteraction);
        };
        window.addEventListener('click', startOnInteraction);
        window.addEventListener('scroll', startOnInteraction);
      }
    };

    playVideo();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-earth-light">
      {/* Intro Header */}
      <section className="relative h-[65vh] w-full flex items-center justify-center overflow-hidden bg-black text-white">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-500"
          style={{ backgroundImage: 'url(/images/echo-bg.jpg)' }}
        >
          <video 
            ref={heroVideoRef}
            autoPlay 
            muted 
            loop 
            playsInline
            poster="/images/echo-bg.jpg"
            onLoadedData={() => setVideoLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-1000 ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
          >
            <source src="/videos/echo-bg.mp4" type="video/mp4" />
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
            Achter de schermen
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl font-bold italic mb-10 font-serif text-white/95"
            style={{ textShadow: '0 2px 10px rgba(0,0,0,0.6)' }}
          >
            "Het schrijven van De Echo was een emotionele rollercoaster..."
          </motion.p>
        </div>
      </section>

      {/* Behind the Scenes Content */}
      <section className="section-padding">
        <div className="max-w-4xl mx-auto px-6">
          {/* Spoiler waarschuwing */}
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl mb-12 flex gap-4 items-start shadow-sm">
            <Info className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
            <div>
              <p className="font-bold text-amber-800">Spoiler-waarschuwing</p>
              <p className="text-amber-700 text-sm">
                De teksten hieronder bevatten achtergrondinformatie die verhaallijnen uit het boek 'De Echo' kunnen onthullen. 
                Het wordt aanbevolen om eerst het boek te lezen.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {ECHO_CHAPTERS.map((chapter, idx) => (
              <div 
                key={chapter.id} 
                id={chapter.id}
                className="bg-white rounded-3xl border border-border-subtle overflow-hidden shadow-sm hover:shadow-md transition-shadow scroll-mt-24"
              >
                <button
                  onClick={() => {
                    const isOpening = activeChapter !== chapter.id;
                    setActiveChapter(isOpening ? chapter.id : null);
                    
                    if (isOpening) {
                      // Slight delay to allow animation to start and state to update
                      setTimeout(() => {
                        const element = document.getElementById(chapter.id);
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }, 100);
                    }
                  }}
                  className="w-full px-8 py-6 flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-6">
                    <div>
                      <h3 className="text-2xl font-serif font-bold text-earth-dark group-hover:text-earth-clay transition-colors">
                        {chapter.title}
                      </h3>
                      <p className="text-earth-warm text-sm mt-1 italic">{chapter.teaser}</p>
                    </div>
                  </div>
                  {activeChapter === chapter.id ? <ChevronUp className="text-earth-warm" /> : <ChevronDown className="text-earth-warm" />}
                </button>

                <AnimatePresence>
                  {activeChapter === chapter.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border-subtle"
                    >
                      {chapter.isLocked && !unlockedChapters[chapter.id] ? (
                        <div className="p-8 md:p-16 flex flex-col items-center justify-center text-center bg-earth-light/30">
                          <div className="w-20 h-20 bg-earth-clay/10 rounded-full flex items-center justify-center mb-6">
                            <Lock className="w-10 h-10 text-earth-clay" />
                          </div>
                          <h4 className="text-2xl font-serif font-bold text-earth-dark mb-4">Dit item is beveiligd</h4>
                          <p className="text-earth-warm max-w-sm mb-8">
                            Voer de code uit het boek in om toegang te krijgen tot deze exclusieve content.
                          </p>
                          
                          <div className="flex flex-col gap-3 w-full max-w-xs">
                            <div className="relative">
                              <motion.input 
                                autoFocus
                                type="text"
                                placeholder="Voer code in..."
                                value={lockAttempt[chapter.id] || ''}
                                animate={lockError[chapter.id] ? { x: [-10, 10, -10, 10, 0] } : {}}
                                onChange={(e) => setLockAttempt(prev => ({ ...prev, [chapter.id]: e.target.value.toUpperCase() }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    tryUnlock(chapter.id, lockAttempt[chapter.id] || '', chapter.unlockCode || '');
                                  }
                                }}
                                className={`w-full px-6 py-4 bg-white border-2 rounded-xl text-center font-bold tracking-[0.2em] outline-none transition-all ${
                                  lockError[chapter.id] 
                                    ? 'border-red-400' 
                                    : 'border-earth-clay/20 focus:border-earth-clay'
                                }`}
                              />
                              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-earth-warm opacity-30" />
                            </div>
                            <button 
                              onClick={() => tryUnlock(chapter.id, lockAttempt[chapter.id] || '', chapter.unlockCode || '')}
                              className="w-full py-4 bg-earth-clay text-white rounded-xl font-bold hover:bg-earth-clay/90 transition-all flex items-center justify-center gap-2 group"
                            >
                              <Unlock className="w-4 h-4 group-hover:scale-110 transition-transform" />
                              Toegang krijgen
                            </button>
                            {lockError[chapter.id] && (
                              <motion.p 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-red-500 text-xs font-bold"
                              >
                                Ongeldige code. Probeer het opnieuw.
                              </motion.p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          <ChapterMedia 
                            chapter={chapter} 
                            bannerUrl={echoBook?.bannerUrl} 
                            index={idx}
                            isUnlocked={unlockedChapters[chapter.id]}
                          />
                          
                          <div className="p-8 md:p-12 space-y-12">
                            {/* Quote box */}
                            <div className="bg-earth-clay-subtle p-8 rounded-2xl relative">
                              <Quote className="absolute -top-4 -left-4 w-12 h-12 text-earth-clay opacity-20" />
                              <p className="text-2xl font-serif italic text-earth-dark text-center uppercase tracking-tight">
                                {chapter.quote}
                              </p>
                            </div>

                            {/* Achtergrondverhaal met nette alinea's */}
                            <div className="prose prose-lg prose-earth max-w-none">
                              <h4 className="text-earth-clay font-bold flex items-center gap-2 mb-6">
                                <Info className="w-4 h-4" /> Achtergrondverhaal
                              </h4>
                              
                              <div className="space-y-6 text-earth-dark/90 leading-relaxed text-[17px]">
                                {Array.isArray(chapter.backgroundStory) 
                                  ? chapter.backgroundStory.map((paragraph, index) => (
                                      <p key={index}>
                                        {paragraph}
                                      </p>
                                    ))
                                  : <p>{chapter.backgroundStory}</p>
                                }
                              </div>
                            </div>

                            {/* Clickable QR Code for interactive experience - Visible only for the Lion chapter */}
                            {chapter.id === 'ch1' && (
                              <div className="flex flex-col items-center gap-4 py-8">
                                <div className="relative group">
                                  <a 
                                    href="https://open.spotify.com/track/0vTKR5TQD03kASmEGlyDF3?si=4c1a40da21fe43bb" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block relative w-48 h-48 bg-white p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border-4 border-earth-clay/30 transition-all transform hover:scale-110 active:scale-95 overflow-hidden"
                                    title="Klik om de soundtrack op Spotify te openen"
                                  >
                                    <img 
                                      src="/images/qr-bonjovi.jpg" 
                                      alt="Bon Jovi Soundtrack QR Code"
                                      className="w-full h-full object-contain relative z-10"
                                      referrerPolicy="no-referrer"
                                    />
                                    {/* Hover glow effect */}
                                    <div className="absolute inset-0 bg-earth-clay/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
