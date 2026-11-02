import React, { createContext, useContext, useState, useEffect } from 'react';

interface AudioContextType {
  ambientMuted: boolean;
  videoMuted: boolean;
  isAmbientPlaying: boolean;
  masterVolume: number;
  setAmbientMuted: (muted: boolean) => void;
  setVideoMuted: (muted: boolean) => void;
  setIsAmbientPlaying: (playing: boolean) => void;
  setMasterVolume: (volume: number) => void;
  fadeAmbient: (direction: 'in' | 'out', duration?: number) => void;
  toggleAmbientMute: () => void;
  toggleVideoMute: () => void;
  reportVideoAudioStatus: (isPlaying: boolean) => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const [ambientMuted, setAmbientMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [isAmbientPlaying, setIsAmbientPlaying] = useState(true);
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
    const handleFirstInteraction = () => {
      if (isAmbientPlaying && !ambientMuted) {
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
  }, [audio, isAmbientPlaying, ambientMuted]);

  // Handle Play/Pause and Volume
  useEffect(() => {
    audio.volume = ambientMuted ? 0 : currentAmbientVolume;
    
    if (isAmbientPlaying && !ambientMuted) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isAmbientPlaying, ambientMuted, currentAmbientVolume, audio]);

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

  const toggleAmbientMute = React.useCallback(() => setAmbientMuted(prev => !prev), []);
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
