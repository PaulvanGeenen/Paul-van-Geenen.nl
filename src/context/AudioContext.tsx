import React, { createContext, useContext, useState, useEffect } from 'react';

interface AudioContextType {
  ambientMuted: boolean;
  videoMuted: boolean;
  isAmbientPlaying: boolean;
  masterVolume: number;
  setAmbientMuted: (muted: boolean) => void;
  setVideoMuted: (muted: boolean) => void;
  setIsAmbientPlaying: (playing: boolean) => void;
  setIsAdminRoute: (isAdmin: boolean) => void;
  setMasterVolume: (volume: number) => void;
  fadeAmbient: (direction: 'in' | 'out', duration?: number) => void;
  toggleAmbientMute: () => void;
  toggleVideoMute: () => void;
  reportVideoAudioStatus: (isPlaying: boolean) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

const AMBIENT_MUTED_KEY = 'pv_ambient_muted';

function readStoredAmbientMuted(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = localStorage.getItem(AMBIENT_MUTED_KEY);
      if (val === 'true') return true;
      if (val === 'false') return false;
    }
    if (typeof document !== 'undefined') {
      const m = document.cookie.match(new RegExp(`(^| )${AMBIENT_MUTED_KEY}=([^;]+)`));
      if (m) return decodeURIComponent(m[2]) === 'true';
    }
  } catch {
    // Ignore storage access errors
  }
  return false;
}

function writeStoredAmbientMuted(muted: boolean): void {
  const val = muted ? 'true' : 'false';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AMBIENT_MUTED_KEY, val);
    }
  } catch {
    // Ignore storage access errors
  }
  try {
    if (typeof document !== 'undefined') {
      const maxAge = 365 * 24 * 60 * 60; // 1 jaar
      document.cookie = `${AMBIENT_MUTED_KEY}=${val}; path=/; max-age=${maxAge}; SameSite=Lax`;
    }
  } catch {
    // Ignore cookie errors
  }
}

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [ambientMuted, setAmbientMutedState] = useState<boolean>(() => readStoredAmbientMuted());
  const setAmbientMuted = React.useCallback((muted: boolean) => {
    setAmbientMutedState(muted);
    writeStoredAmbientMuted(muted);
  }, []);
  const [videoMuted, setVideoMuted] = useState(true);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(true);
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const p = window.location.pathname.toLowerCase();
    return p.startsWith('/beheer') || p.startsWith('/inkijkexemplaar');
  });
  const [masterVolume, setMasterVolume] = useState(0.4);
  const [currentAmbientVolume, setCurrentAmbientVolume] = useState(0.4);
  const [videoPlayingCount, setVideoPlayingCount] = useState(0);
  const [audio] = useState(() => {
    const a = new Audio('/audio/ambient.ogg');
    a.loop = true;
    return a;
  });

  // Track if any video is playing unmuted audio
  useEffect(() => {
    if (videoPlayingCount > 0) {
      setIsAmbientPlaying(false);
    } else {
      setIsAmbientPlaying(true);
    }
  }, [videoPlayingCount]);

  useEffect(() => {
    if (isAdminRoute) return;

    const handleFirstInteraction = () => {
      if (isAmbientPlaying && !ambientMuted && !isAdminRoute) {
        audio.play().catch(() => {});
      }
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [audio, isAmbientPlaying, ambientMuted, isAdminRoute]);

  // Handle Play/Pause and Volume (altijd stil in /beheer)
  useEffect(() => {
    audio.volume = ambientMuted || isAdminRoute ? 0 : currentAmbientVolume;
    
    if (isAmbientPlaying && !ambientMuted && !isAdminRoute) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isAmbientPlaying, ambientMuted, isAdminRoute, currentAmbientVolume, audio]);

  // Sync currentAmbientVolume with masterVolume when not fading
  useEffect(() => {
    setCurrentAmbientVolume(masterVolume);
  }, [masterVolume]);

  const fadeAmbient = (direction: 'in' | 'out', duration: number = 1000) => {
    const steps = 20;
    const interval = duration / steps;
    const volumeStep = masterVolume / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (direction === 'out') {
        setCurrentAmbientVolume(prev => Math.max(0, prev - volumeStep));
      } else {
        setCurrentAmbientVolume(prev => Math.min(masterVolume, prev + volumeStep));
      }
      
      if (currentStep >= steps) {
        clearInterval(timer);
        if (direction === 'out') {
          setCurrentAmbientVolume(0);
          setIsAmbientPlaying(false);
        } else {
          setCurrentAmbientVolume(masterVolume);
          setIsAmbientPlaying(true);
        }
      }
    }, interval);
  };

  const toggleAmbientMute = React.useCallback(() => {
    setAmbientMutedState(prev => {
      const next = !prev;
      writeStoredAmbientMuted(next);
      return next;
    });
  }, []);
  const toggleVideoMute = React.useCallback(() => setVideoMuted(prev => !prev), []);

  const reportVideoAudioStatus = React.useCallback((isPlaying: boolean) => {
    setVideoPlayingCount(prev => isPlaying ? prev + 1 : Math.max(0, prev - 1));
  }, []);

  return (
    <AudioContext.Provider value={{ 
      ambientMuted, 
      videoMuted, 
      isAmbientPlaying,
      masterVolume,
      setAmbientMuted, 
      setVideoMuted,
      setIsAmbientPlaying,
      setIsAdminRoute,
      setMasterVolume,
      fadeAmbient,
      toggleAmbientMute, 
      toggleVideoMute,
      reportVideoAudioStatus
    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
}
