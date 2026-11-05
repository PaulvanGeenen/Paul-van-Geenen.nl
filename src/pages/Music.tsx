import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Pause, SkipForward, SkipBack, Volume1, Volume2, VolumeX,
  Smartphone, Monitor, List, Music as MusicIcon, BookOpen,
  MessageCircle, Video, RotateCw, X, Sparkles, ChevronRight, ChevronLeft,
  Maximize2, Minimize2, Check, ArrowLeft, Repeat, Repeat1, FlaskConical,
  Share2, Copy, ThumbsUp, ThumbsDown, Subtitles, Languages, Disc3, Layers,
  Music2, Headphones, Film, Type, SlidersHorizontal, Home
} from 'lucide-react';
import { useAudio } from '../context/AudioContext';
import { IvoryHeartPendant } from '../components/ui/IvoryHeartPendant';
import { isOwnAnalyticsIgnored, getUserGeoLocation, getSubtitlePreferences, setSubtitlePreferences, recordMusicPlay, updateMusicPlay, recordMusicRating, SubtitleSize } from '../lib/analytics';
import { EqualizerModal } from '../components/EqualizerModal';
import { getEqualizerPreferences, equalizerEngine, EqualizerPreferences } from '../lib/equalizer';
import {
  MusicLanguage,
  getInitialMusicLanguage,
  setStoredMusicLanguage,
  musicTranslations,
  isCountryNetherlands
} from '../lib/musicTranslations';
import logoHeader from '../assets/logo.jpg';

interface Track {
  id: string;
  order: string;
  albumOrder?: number | string;
  title: string;
  album?: string;
  folderName: string;
  mp3?: string;
  audiobook?: string;
  reflection?: string;
  coverJpg?: string;
  portraitJpg?: string;
  landscapeJpg?: string;
  thumbnailJpg?: string;
  videoMov?: string;
  subtitles?: {
    GB?: string;
    NL?: string;
    [lang: string]: string | undefined;
  };
}

interface Album {
  id: string;
  title: string;
  artist?: string;
  cover?: string;
  description?: string;
  year?: string;
  order?: number | string;
}

interface SubtitleCue {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
}

// Crisp cross-platform SVG Flag components (Render flawlessly on Windows, Mac, iPad, iPhone, Android)
const UkFlag = ({ className = "w-5 h-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 60 30" className={`${className} rounded-[2px] shadow-sm shrink-0 inline-block overflow-hidden`} aria-hidden="true">
    <clipPath id="uk-flag-clip">
      <path d="M0,0 v30 h60 v-30 z"/>
    </clipPath>
    <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" clipPath="url(#uk-flag-clip)"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
  </svg>
);

const NlFlag = ({ className = "w-5 h-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 9 6" className={`${className} rounded-[2px] shadow-sm shrink-0 inline-block overflow-hidden`} aria-hidden="true">
    <rect fill="#AE1C28" width="9" height="2" y="0"/>
    <rect fill="#FFFFFF" width="9" height="2" y="2"/>
    <rect fill="#21468B" width="9" height="2" y="4"/>
  </svg>
);

interface LanguageSelectorProps {
  lang: MusicLanguage;
  onSelect: (lang: MusicLanguage) => void;
  size?: 'sm' | 'md';
  onAction?: () => void;
}

const LanguageSelector = ({
  lang,
  onSelect,
  size = 'sm',
  onAction,
}: LanguageSelectorProps) => {
  if (size === 'md') {
    return (
      <div
        className="inline-flex items-center p-1 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md shadow-md gap-1 shrink-0"
        role="group"
        aria-label="Taalkeuze / Language Selection"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction?.();
            onSelect('nl');
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            lang === 'nl'
              ? 'bg-earth-gold text-black shadow-md font-extrabold ring-1 ring-earth-gold'
              : 'text-white/60 hover:text-white hover:bg-white/10 opacity-60 hover:opacity-100'
          }`}
          title="Nederlands"
        >
          <NlFlag className="w-4 h-3" />
          <span>Nederlands</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction?.();
            onSelect('en');
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            lang === 'en'
              ? 'bg-earth-gold text-black shadow-md font-extrabold ring-1 ring-earth-gold'
              : 'text-white/60 hover:text-white hover:bg-white/10 opacity-60 hover:opacity-100'
          }`}
          title="English"
        >
          <UkFlag className="w-4 h-3" />
          <span>English</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center p-0.5 rounded-full border border-white/15 bg-black/50 backdrop-blur-md shadow-sm gap-0.5 shrink-0"
      role="group"
      aria-label="Taalkeuze / Language Selection"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAction?.();
          onSelect('nl');
        }}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
          lang === 'nl'
            ? 'bg-earth-gold text-black shadow-xs font-black ring-1 ring-earth-gold'
            : 'text-white/60 hover:text-white hover:bg-white/10 opacity-50 hover:opacity-90'
        }`}
        title="Nederlands"
      >
        <NlFlag className="w-3.5 h-2.5" />
        <span className="font-mono text-[9px] leading-none">NL</span>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAction?.();
          onSelect('en');
        }}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
          lang === 'en'
            ? 'bg-earth-gold text-black shadow-xs font-black ring-1 ring-earth-gold'
            : 'text-white/60 hover:text-white hover:bg-white/10 opacity-50 hover:opacity-90'
        }`}
        title="English"
      >
        <UkFlag className="w-3.5 h-2.5" />
        <span className="font-mono text-[9px] leading-none">EN</span>
      </button>
    </div>
  );
};

function parseSRTTime(timeStr: string): number {
  const parts = timeStr.trim().replace(',', '.').split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return 0;
}

function parseSRT(data: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const cleanData = data.replace(/^\uFEFF/, '');
  const normalized = cleanData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);

  let cueId = 1;
  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let timeLineIdx = 0;
    if (!lines[0].includes('-->') && lines.length >= 2) {
      timeLineIdx = 1;
    }

    const timeLine = lines[timeLineIdx];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split('-->');
    const startTime = parseSRTTime(startStr);
    const endTime = parseSRTTime(endStr);
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join('\n');

    if (text && endTime > startTime) {
      cues.push({ id: cueId++, startTime, endTime, text });
    }
  }

  // Bridge micro-gaps between consecutive cues (<= 350ms) to eliminate flickering/blinking between lines
  for (let i = 0; i < cues.length - 1; i++) {
    const current = cues[i];
    const next = cues[i + 1];
    const gap = next.startTime - current.endTime;
    if (gap > 0 && gap <= 0.35) {
      current.endTime = next.startTime;
    }
  }

  return cues;
}

interface MusicResponse {
  startupPortrait: string;
  startupLandscape: string;
  startupPortraitMov?: string;
  startupLandscapeMov?: string;
  startupAudio?: string;
  albums?: Album[];
  tracks: Track[];
}

export const sanitizeMediaUrl = (url?: string): string | undefined => {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim().replace(/^https?:\/\/(www\.)?(paulvangeenen|lionbooks)\.nl/i, '');
  if (!trimmed) return undefined;
  try {
    return encodeURI(decodeURI(trimmed));
  } catch (e) {
    return encodeURI(trimmed);
  }
};

export const getTrackCoverJpg = (t?: Partial<Track> | null): string | undefined => {
  if (!t) return undefined;
  if (t.coverJpg && typeof t.coverJpg === 'string' && t.coverJpg.trim() !== '') {
    return sanitizeMediaUrl(t.coverJpg);
  }
  if (t.mp3 && typeof t.mp3 === 'string') {
    const clean = t.mp3.trim().split('?')[0];
    if (clean.toLowerCase().endsWith('.mp3')) {
      const derived = clean.substring(0, clean.length - 4) + '.jpg';
      return sanitizeMediaUrl(derived) || derived;
    }
  }
  return sanitizeMediaUrl(t.portraitJpg) || sanitizeMediaUrl(t.thumbnailJpg);
};

export const normalizeTrack = (t: Track): Track => {
  const normSubtitles: Record<string, string> = {};
  if (t.subtitles) {
    Object.entries(t.subtitles).forEach(([k, v]) => {
      const s = sanitizeMediaUrl(v);
      if (s) normSubtitles[k] = s;
    });
  }

  const mp3Url = sanitizeMediaUrl(t.mp3);
  let coverJpg = sanitizeMediaUrl(t.coverJpg);
  if (!coverJpg && mp3Url) {
    const clean = mp3Url.split('?')[0];
    if (clean.toLowerCase().endsWith('.mp3')) {
      coverJpg = clean.substring(0, clean.length - 4) + '.jpg';
    }
  }

  const portraitUrl = sanitizeMediaUrl(t.portraitJpg);

  return {
    ...t,
    mp3: mp3Url,
    audiobook: sanitizeMediaUrl(t.audiobook),
    reflection: sanitizeMediaUrl(t.reflection),
    videoMov: sanitizeMediaUrl(t.videoMov),
    coverJpg: coverJpg,
    portraitJpg: portraitUrl || coverJpg,
    landscapeJpg: sanitizeMediaUrl(t.landscapeJpg),
    thumbnailJpg: sanitizeMediaUrl(t.thumbnailJpg) || coverJpg || portraitUrl,
    subtitles: Object.keys(normSubtitles).length > 0 ? normSubtitles : t.subtitles,
  };
};

export const getAlbumCover = (alb?: Album | null, albTracks?: Track[]): string => {
  if (!alb) return '/@music/_albums/Muzikale%20Krabbels%20Album.jpg';
  if (alb.cover && typeof alb.cover === 'string' && alb.cover.trim() !== '') {
    return sanitizeMediaUrl(alb.cover) || alb.cover;
  }
  const titleLower = (alb.title || '').toLowerCase();
  if (titleLower.includes('echo')) {
    return '/@music/_albums/De%20Echo%20Album.jpg';
  }
  if (titleLower.includes('geboorte') || titleLower.includes('leeuw')) {
    return '/@music/_albums/De%20Geboorte%20van%20de%20Leeuw%20Album.jpg';
  }
  if (titleLower.includes('krabbel')) {
    return '/@music/_albums/Muzikale%20Krabbels%20Album.jpg';
  }
  if (albTracks && albTracks.length > 0) {
    const candidate = albTracks[0].thumbnailJpg || albTracks[0].portraitJpg || albTracks[0].landscapeJpg;
    if (candidate) return sanitizeMediaUrl(candidate) || candidate;
  }
  return `/@music/_albums/${encodeURIComponent(alb.title + ' Album.jpg')}`;
};

// YouTube-style encrypted/obfuscated share code generator & direct link helpers
const SHARE_SALT = 0x7a3c9b14;
const formatToCode: Record<string, number> = { mp3: 0, audiobook: 1, reflection: 2, video: 3 };
const codeToFormat: Record<number, 'mp3' | 'audiobook' | 'reflection' | 'video'> = { 0: 'mp3', 1: 'audiobook', 2: 'reflection', 3: 'video' };

const encodeShareCode = (trackId: string, format: 'mp3' | 'audiobook' | 'reflection' | 'video'): string => {
  const fmtCode = formatToCode[format] ?? 0;
  const raw = `${trackId}~${fmtCode}`;
  let encoded = '';
  for (let i = 0; i < raw.length; i++) {
    const charCode = raw.charCodeAt(i);
    const mask = ((i + 1) * 37 + (SHARE_SALT >> (i % 8))) & 0xff;
    encoded += String.fromCharCode(charCode ^ mask);
  }
  return btoa(encoded)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const decodeShareCode = (code: string): { trackIdentifier: string; format: 'mp3' | 'audiobook' | 'reflection' | 'video' } | null => {
  try {
    let base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decodedStr = atob(base64);
    let raw = '';
    for (let i = 0; i < decodedStr.length; i++) {
      const charCode = decodedStr.charCodeAt(i);
      const mask = ((i + 1) * 37 + (SHARE_SALT >> (i % 8))) & 0xff;
      raw += String.fromCharCode(charCode ^ mask);
    }
    const parts = raw.split('~');
    if (parts.length === 2) {
      const trackIdentifier = parts[0];
      const fmtCode = parseInt(parts[1], 10);
      const format = codeToFormat[fmtCode] || 'mp3';
      if (trackIdentifier) {
        return { trackIdentifier, format };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
};

const getAuthoritativeOrientation = (): 'portrait' | 'landscape' => {
  if (typeof window === 'undefined') return 'landscape';

  // 1. Native Modern ScreenOrientation API (Authoritative on modern Android Chrome)
  if (window.screen && window.screen.orientation && window.screen.orientation.type) {
    if (window.screen.orientation.type.startsWith('landscape')) return 'landscape';
    if (window.screen.orientation.type.startsWith('portrait')) return 'portrait';
  }

  // 2. Native ScreenOrientation angle (90 or 270 = landscape, 0 or 180 = portrait)
  if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === 'number') {
    const angle = Math.abs(window.screen.orientation.angle);
    if (angle === 90 || angle === 270) return 'landscape';
    if (angle === 0 || angle === 180) return 'portrait';
  }

  // 3. CSS Media Query (extremely reliable across all mobile browsers)
  if (typeof window.matchMedia === 'function') {
    if (window.matchMedia('(orientation: landscape)').matches) return 'landscape';
    if (window.matchMedia('(orientation: portrait)').matches) return 'portrait';
  }

  // 4. window.orientation (standard for iOS Safari and legacy mobile browsers)
  if (typeof window.orientation !== 'undefined') {
    const wo = Math.abs(Number(window.orientation));
    if (wo === 90 || wo === 270) return 'landscape';
    if (wo === 0 || wo === 180) return 'portrait';
  }

  // 5. Direct Viewport Dimensions Ratio
  if (typeof window !== 'undefined' && window.innerWidth && window.innerHeight) {
    return window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
  }

  return 'portrait';
};

const getDeviceOrientation = getAuthoritativeOrientation;

const checkHasDirectVideoRequest = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    // 1. YouTube-style encrypted share code (?v=...)
    const vParam = urlParams.get('v');
    if (vParam) {
      const decoded = decodeShareCode(vParam);
      if (decoded && decoded.format === 'video') return true;
    }
    // 2. Query parameter (?format=video, ?video=1, ?video=true, ?type=video)
    const formatParam = urlParams.get('format');
    if (formatParam === 'video') return true;
    const videoParam = urlParams.get('video');
    if (videoParam === '1' || videoParam === 'true') return true;
    const typeParam = urlParams.get('type');
    if (typeParam === 'video') return true;

    // 3. Path segments (e.g. /music/001/video or /@music/001/video)
    const rawPathname = window.location.pathname;
    const segments = rawPathname
      .split('/')
      .filter(Boolean)
      .map(s => decodeURIComponent(s).toLowerCase().trim());
    const musicSegIdx = segments.findIndex(s => s === 'music' || s === '@music');
    const pathArgs = musicSegIdx !== -1 ? segments.slice(musicSegIdx + 1) : segments;
    if (pathArgs.some(seg => seg === 'video')) return true;

    // 4. Hash parameter if any
    const rawHash = window.location.hash;
    if (rawHash) {
      const hashLower = decodeURIComponent(rawHash).toLowerCase();
      if (hashLower.includes('format=video') || hashLower.includes('/video') || hashLower === '#video') return true;
    }
  } catch (e) {}
  return false;
};

const checkHasDirectTrackRequest = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('v') || urlParams.get('track')) return true;
    const rawPathname = window.location.pathname;
    const segments = rawPathname.split('/').filter(Boolean).map(s => decodeURIComponent(s).toLowerCase().trim());
    const musicSegIdx = segments.findIndex(s => s === 'music' || s === '@music');
    const pathArgs = musicSegIdx !== -1 ? segments.slice(musicSegIdx + 1) : segments;
    if (pathArgs.length > 0) return true;
  } catch (e) {}
  return false;
};

const checkHasDirectAlbumRequest = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('album')) return true;
  } catch (e) {}
  return false;
};

export function Music() {
  const navigate = useNavigate();
  const { setIsAmbientPlaying, reportVideoAudioStatus } = useAudio();

  // Flag indicating if visitor arrived directly via track link (e.g. ?v=... / ?track=...)
  const isDirectTrackRequested = useRef(checkHasDirectTrackRequest());
  const isDirectVideoRequested = useRef(checkHasDirectVideoRequest());

  // Stop ambient bird sounds while visiting /music
  useEffect(() => {
    setIsAmbientPlaying(false);
    reportVideoAudioStatus(true);
    return () => {
      reportVideoAudioStatus(false);
      setIsAmbientPlaying(true);
    };
  }, [setIsAmbientPlaying, reportVideoAudioStatus]);

  // Tracks, Albums & Startup data loaded directly from MySQL database
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [landscapeAlbumIndex, setLandscapeAlbumIndex] = useState(0);
  const [isAlbumSwiping, setIsAlbumSwiping] = useState(false);
  const [albumSwipeOffset, setAlbumSwipeOffset] = useState(0);
  const albumTouchStartXRef = useRef<number>(0);
  const albumTouchStartYRef = useRef<number>(0);

  // Landscape track in list swipe state (1 track per view)
  const [landscapeTrackInListIndex, setLandscapeTrackInListIndex] = useState(0);
  const [isTrackListSwiping, setIsTrackListSwiping] = useState(false);
  const [trackListSwipeOffset, setTrackListSwipeOffset] = useState(0);
  const trackListTouchStartXRef = useRef<number>(0);
  const trackListTouchStartYRef = useRef<number>(0);

  const [startupPortrait, setStartupPortrait] = useState<string>('/images/phone-startup-screen.jpg');
  const [startupLandscape, setStartupLandscape] = useState<string>('/images/phone-startup-screen.jpg');
  const [startupPortraitMov, setStartupPortraitMov] = useState<string | null>('/@music/startup%20portrait.mov');
  const [startupLandscapeMov, setStartupLandscapeMov] = useState<string | null>('/@music/startup%20landscape.mov');
  const [startupAudio, setStartupAudio] = useState<string>('/@music/intro.mp3');
  const [startupVideoFailed, setStartupVideoFailed] = useState<{ portrait: boolean; landscape: boolean }>({
    portrait: false,
    landscape: false
  });
  const [loadingTracks, setLoadingTracks] = useState(true);

  // App Phase: 'startup' (7s splash) | 'albums' (album selection) | 'list' (tracklist view) | 'player' (immersive background view)
  const [phase, setPhase] = useState<'startup' | 'albums' | 'list' | 'player'>(() => {
    if (checkHasDirectTrackRequest()) return 'player';
    if (checkHasDirectAlbumRequest()) return 'list';
    return 'startup';
  });

  // Current playing track & audio version
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);
  const [selectedFormat, setSelectedFormat] = useState<'mp3' | 'audiobook' | 'reflection' | 'video'>(() => {
    if (checkHasDirectVideoRequest()) return 'video';
    return 'mp3';
  });

  // Player controls & state
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isAutoplayMuted, setIsAutoplayMuted] = useState(false);

  // Orientation state: 'portrait' | 'landscape'
  // Detects the actual physical position of the device.
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
    return getDeviceOrientation();
  });
  
  // Desktop display mode: 'iphone' | 'fullscreen'
  // Defaults to 'fullscreen' so the player opens as an immersive native app across all screens
  const [desktopViewMode, setDesktopViewMode] = useState<'iphone' | 'fullscreen'>('fullscreen');
  const checkIsMobile = (): boolean => {
    if (typeof window === 'undefined') return false;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isIPad = typeof navigator !== 'undefined' && (
      navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
    );
    const isCoarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const isTouch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
    const isSmallOrTabletScreen = typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) <= 1366;
    return isMobileUA || isIPad || isCoarse || (isTouch && isSmallOrTabletScreen);
  };

  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(() => {
    return checkIsMobile();
  });
  const [isIOS, setIsIOS] = useState(() => {
    if (typeof navigator !== 'undefined') {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }
    return false;
  });
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [showIosFullscreenGuide, setShowIosFullscreenGuide] = useState(false);

  // Manual orientation override ref (when user clicks the rotate button)
  const manualOrientationOverrideRef = useRef<{ orientation: 'portrait' | 'landscape'; timestamp: number } | null>(null);

  const toggleOrientation = () => {
    setOrientation(prev => {
      const next = prev === 'portrait' ? 'landscape' : 'portrait';
      manualOrientationOverrideRef.current = { orientation: next, timestamp: Date.now() };
      return next;
    });
  };

  // Music Section Localization (Dutch vs English)
  // Automatically detects user country: inside NL -> Dutch, outside NL -> English.
  // Manual override toggle is stored in localStorage ('pv_music_lang').
  const [musicLang, setMusicLangState] = useState<MusicLanguage>(getInitialMusicLanguage);
  const t = musicTranslations[musicLang];

  const setMusicLang = (lang: MusicLanguage) => {
    setMusicLangState(lang);
    setStoredMusicLanguage(lang);
  };

  // Detect country via geolocation to set English if outside Netherlands (only if no manual preference set)
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('pv_music_lang') : null;
    if (!saved) {
      getUserGeoLocation().then(geo => {
        if (geo && geo.country) {
          const inNetherlands = isCountryNetherlands(geo.country);
          const detectedLang: MusicLanguage = inNetherlands ? 'nl' : 'en';
          setMusicLangState(detectedLang);
          if (!localStorage.getItem('krabbels_subtitle_prefs')) {
            setSubtitleLang(detectedLang === 'en' ? 'GB' : 'NL');
          }
        }
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOS(ios);
    }
  }, []);

  // Test modal for format buttons visibility (set to true to show Test button in UI)
  const SHOW_TEST_BUTTON = false;
  const [showTestModal, setShowTestModal] = useState<boolean>(false);

  // Subtitle preferences & synchronization states (Cookies & LocalStorage persistent)
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(() => {
    return getSubtitlePreferences().enabled;
  });
  const [subtitleLang, setSubtitleLang] = useState<'GB' | 'NL'>(() => {
    return getSubtitlePreferences().lang;
  });
  const [subtitleSize, setSubtitleSize] = useState<SubtitleSize>(() => {
    return getSubtitlePreferences().size;
  });
  const [showSubtitleMenu, setShowSubtitleMenu] = useState<boolean>(false);
  const [parsedCues, setParsedCues] = useState<SubtitleCue[]>([]);
  const [currentCue, setCurrentCue] = useState<SubtitleCue | null>(null);
  const subtitleCacheRef = useRef<Map<string, SubtitleCue[]>>(new Map());

  const handleToggleSubtitles = (enabled?: boolean) => {
    const nextVal = enabled !== undefined ? enabled : !subtitlesEnabled;
    setSubtitlesEnabled(nextVal);
    setSubtitlePreferences(nextVal, subtitleLang, subtitleSize);
  };

  const handleSelectSubtitleLang = (lang: 'GB' | 'NL') => {
    setSubtitleLang(lang);
    setSubtitlePreferences(subtitlesEnabled, lang, subtitleSize);
  };

  const handleSelectSubtitleSize = (size: SubtitleSize) => {
    setSubtitleSize(size);
    setSubtitlePreferences(subtitlesEnabled, subtitleLang, size);
  };

  // Equalizer states & preferences (Stored persistently in cookies & localStorage)
  const [showEqualizerModal, setShowEqualizerModal] = useState<boolean>(false);
  const [equalizerPrefs, setEqualizerPrefs] = useState<EqualizerPreferences>(() => {
    return getEqualizerPreferences();
  });


  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      setIsBrowserFullscreen(!!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      ));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleBrowserFullscreen = () => {
    // 1. If currently playing a video, use native iOS WebKit video fullscreen if supported
    if (phase === 'player' && effectiveFormat === 'video' && videoRef.current) {
      const vid = videoRef.current as any;
      if (vid.webkitEnterFullscreen) {
        try {
          vid.webkitEnterFullscreen();
          return;
        } catch (e) {
          console.log('[Fullscreen] webkitEnterFullscreen note:', e);
        }
      } else if (vid.requestFullscreen) {
        vid.requestFullscreen().catch(() => {});
        return;
      }
    }

    // 2. Standard HTML5 Fullscreen API
    const doc = document as any;
    const docEl = document.documentElement as any;

    const isFs = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (isFs) {
      if (doc.exitFullscreen) {
        doc.exitFullscreen().catch((err: any) => {
          if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        });
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
      return;
    }

    let reqPromise: any = null;
    if (docEl.requestFullscreen) {
      reqPromise = docEl.requestFullscreen();
    } else if (docEl.webkitRequestFullscreen) {
      reqPromise = docEl.webkitRequestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
      reqPromise = docEl.mozRequestFullScreen();
    } else if (docEl.msRequestFullscreen) {
      reqPromise = docEl.msRequestFullscreen();
    }

    if (reqPromise && typeof reqPromise.catch === 'function') {
      reqPromise.catch((err: any) => {
        console.warn('requestFullscreen error/blocked:', err);
        if (isIOS) {
          setShowIosFullscreenGuide(true);
        }
      });
    } else if (!reqPromise && isIOS) {
      setShowIosFullscreenGuide(true);
    }
  };

  // Safe helper to automatically request browser native fullscreen on initial user activation or playback
  const enterBrowserFullscreenSafely = () => {
    try {
      if (typeof document === 'undefined') return;
      if (typeof navigator !== 'undefined' && 'userActivation' in navigator && !(navigator as any).userActivation?.isActive) {
        return;
      }
      const doc = document as any;
      const isAlreadyFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      if (isAlreadyFs) return;

      const docEl = document.documentElement as any;
      let reqPromise: any = null;
      if (docEl.requestFullscreen) {
        reqPromise = docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        reqPromise = docEl.webkitRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        reqPromise = docEl.mozRequestFullScreen();
      } else if (docEl.msRequestFullscreen) {
        reqPromise = docEl.msRequestFullscreen();
      }
      if (reqPromise && typeof reqPromise.catch === 'function') {
        reqPromise.catch(() => {});
      }
    } catch (e) {}
  };

  // Automatically request browser fullscreen on first user activation when opening the player
  useEffect(() => {
    const handleInitialUserGesture = () => {
      enterBrowserFullscreenSafely();
    };

    window.addEventListener('click', handleInitialUserGesture, { once: true, passive: true });
    window.addEventListener('touchstart', handleInitialUserGesture, { once: true, passive: true });
    window.addEventListener('pointerdown', handleInitialUserGesture, { once: true, passive: true });

    return () => {
      window.removeEventListener('click', handleInitialUserGesture);
      window.removeEventListener('touchstart', handleInitialUserGesture);
      window.removeEventListener('pointerdown', handleInitialUserGesture);
    };
  }, []);

  // Auto-hide navigation bar timer state
  const [showNavBar, setShowNavBar] = useState(true);
  const navBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoNextTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-fade Thumbs Up / Down rating buttons state (fades out after 3s, reappears on tap/click)
  const [showRatingButtons, setShowRatingButtons] = useState<boolean>(true);
  const ratingButtonsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Loop modes ('all' | 'one' | 'off')
  const [loopMode, setLoopMode] = useState<'all' | 'one' | 'off'>(() => checkHasDirectVideoRequest() ? 'off' : 'all');
  const [loopToast, setLoopToast] = useState<string | null>(null);

  // Share link state
  const [shareToast, setShareToast] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copiedLinkState, setCopiedLinkState] = useState<boolean>(false);
  const initialSharedHandledRef = useRef(false);

  useEffect(() => {
    if (!shareToast) return;
    const timer = setTimeout(() => {
      setShareToast(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [shareToast]);

  // Song Credit Badge overlay state (shows at track start, rotation, or user tap)
  const [songCreditVisible, setSongCreditVisible] = useState(false);
  const songCreditTimeoutRef = useRef<any>(null);

  const triggerSongCredit = (durationMs = 6000) => {
    setSongCreditVisible(true);
    if (songCreditTimeoutRef.current) clearTimeout(songCreditTimeoutRef.current);
    songCreditTimeoutRef.current = setTimeout(() => {
      setSongCreditVisible(false);
    }, durationMs);
  };

  // Audio & Video DOM refs: Dual-Deck system (Deck A & Deck B) for seamless mobile acoustic crossfading
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');

  const getActiveAudioEl = () => (activeDeckRef.current === 'A' ? audioRefA.current : audioRefB.current);
  const getInactiveAudioEl = () => (activeDeckRef.current === 'A' ? audioRefB.current : audioRefA.current);

  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const savedTimeRef = useRef<number>(0);
  const shouldAutoPlayRef = useRef<boolean>(false);
  const hasRegisteredListenRef = useRef<boolean>(false);
  const activeListenRecordIdRef = useRef<string | number | null>(null);
  const isListenCompletedRef = useRef<boolean>(false);
  const autoplayGestureCleanupRef = useRef<(() => void) | null>(null);
  const [autoAdvanceFade, setAutoAdvanceFade] = useState<{ outgoing: string } | null>(null);
  const autoAdvanceFadeTimerRef = useRef<any>(null);

  // End-of-track cinematic transition: image fades out to black -> next image fades in -> next track starts
  const END_FADE_OUT_MS = 1400;
  const END_HOLD_MS = 350;
  const END_FADE_IN_MS = 1400;
  const [endTransitionPhase, setEndTransitionPhase] = useState<'idle' | 'fadingOut' | 'fadingIn'>('idle');
  const endTransitionTimersRef = useRef<any[]>([]);
  const isEndTransitioningRef = useRef<boolean>(false);

  const cancelEndTransition = () => {
    endTransitionTimersRef.current.forEach(t => clearTimeout(t));
    endTransitionTimersRef.current = [];
    if (isEndTransitioningRef.current) {
      isEndTransitioningRef.current = false;
      setEndTransitionPhase('idle');
    }
  };

  const clearElFadeTimer = (targetEl: HTMLMediaElement | null) => {
    if (!targetEl) return;
    if ((targetEl as any)._fadeTimer) {
      clearInterval((targetEl as any)._fadeTimer);
      (targetEl as any)._fadeTimer = null;
    }
  };

  const clearFadeTimer = () => {
    clearElFadeTimer(audioRefA.current);
    clearElFadeTimer(audioRefB.current);
    clearElFadeTimer(videoRef.current);
  };

  const registerTrackListen = async (
    track: Track,
    format: 'mp3' | 'audiobook' | 'reflection' | 'video',
    completed: boolean = false,
    durationSecs: number = 10,
    customRating: 'up' | 'down' | null = null
  ) => {
    if (!track) return;
    try {
      const recId = await recordMusicPlay(track, format, customRating, completed, durationSecs);
      if (recId) {
        activeListenRecordIdRef.current = recId;
      }
    } catch (e) {
      console.error('Error registering track listen:', e);
    }
  };

  const handleMediaTimeUpdate = (el: HTMLMediaElement | null) => {
    if (!el) return;
    const t = el.currentTime;
    setCurrentTime(t);
    savedTimeRef.current = t;
    setDuration(el.duration || 0);

    // Synchronize lock screen progress bar via MediaSession
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        if (el.duration && !isNaN(el.duration) && isFinite(el.duration) && el.duration > 0) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, el.duration),
            playbackRate: el.playbackRate || 1,
            position: Math.min(Math.max(0, t), el.duration)
          });
        }
      } catch (err) {}
    }

    // Registreer als de bezoeker minimaal 10 seconden heeft geluisterd
    // (Als iemand korter dan 10 seconden luistert, wordt er niets opgeslagen; >10s = completed: false)
    if (!hasRegisteredListenRef.current && currentTrack && t >= 10) {
      hasRegisteredListenRef.current = true;
      const effectiveFormat = getEffectiveFormat(currentTrack, selectedFormat);
      const savedRating = localStorage.getItem(`krabbels_rating_${currentTrack.id}_${effectiveFormat}`) as 'up' | 'down' | null;
      registerTrackListen(currentTrack, effectiveFormat, false, Math.floor(t), savedRating);
    }
  };

  // Detect mobile device screen size & window orientation (iPads, tablets, Android & iPhone)
  useEffect(() => {
    const updateDimensionsAndOrientation = () => {
      setIsSwiping(false);
      setIsSwipingRelease(false);
      setDragX(0);

      const isMobile = checkIsMobile();
      setIsMobileDevice(isMobile);

      // On mobile phones/tablets or screens <= 1400px: match physical device viewport orientation
      if (isMobile || (typeof window !== 'undefined' && Math.min(window.innerWidth, window.innerHeight) <= 1400)) {
        const detected = getAuthoritativeOrientation();

        // Check if user manually toggled orientation recently via rotate button
        if (manualOrientationOverrideRef.current) {
          const elapsed = Date.now() - manualOrientationOverrideRef.current.timestamp;
          if (elapsed < 6000) {
            if (detected === manualOrientationOverrideRef.current.orientation) {
              manualOrientationOverrideRef.current = null;
            } else {
              return; // Honor user's manual button choice
            }
          } else {
            manualOrientationOverrideRef.current = null;
          }
        }

        setOrientation(detected);
      }
    };

    const handleResize = () => {
      updateDimensionsAndOrientation();
      // On Android & iOS Safari, viewport dimensions update asynchronously during rotation animation
      setTimeout(updateDimensionsAndOrientation, 50);
      setTimeout(updateDimensionsAndOrientation, 150);
      setTimeout(updateDimensionsAndOrientation, 300);
      setTimeout(updateDimensionsAndOrientation, 600);
      setTimeout(updateDimensionsAndOrientation, 1000);
    };

    // Gyroscope / accelerometer listener for Android devices where system auto-rotate is disabled
    let lastTilt: 'portrait' | 'landscape' | null = null;
    let tiltDebounceTimer: any = null;

    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (typeof e.gamma !== 'number' || typeof e.beta !== 'number') return;
      const absGamma = Math.abs(e.gamma);
      const absBeta = Math.abs(e.beta);

      let tiltDetected: 'portrait' | 'landscape' | null = null;
      // Phone held horizontally in landscape (rotated 90 degrees left or right)
      if (absGamma > 38 && absBeta < 68) {
        tiltDetected = 'landscape';
      } else if (absGamma < 25 && e.beta > 25 && e.beta < 95) {
        // Phone held upright in normal portrait viewing position
        tiltDetected = 'portrait';
      }

      if (tiltDetected && tiltDetected !== lastTilt) {
        lastTilt = tiltDetected;
        if (tiltDebounceTimer) clearTimeout(tiltDebounceTimer);
        tiltDebounceTimer = setTimeout(() => {
          if (manualOrientationOverrideRef.current && Date.now() - manualOrientationOverrideRef.current.timestamp < 3500) {
            return;
          }
          if (tiltDetected) {
            setOrientation(tiltDetected);
          }
        }, 160);
      }
    };

    updateDimensionsAndOrientation();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    if (typeof window !== 'undefined' && 'ondeviceorientation' in window) {
      window.addEventListener('deviceorientation', handleDeviceOrientation, { passive: true });
    }
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleResize);
      window.screen.orientation.onchange = handleResize;
    }
    const portraitMql = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(orientation: portrait)') : null;
    const landscapeMql = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(orientation: landscape)') : null;
    if (portraitMql) {
      if (portraitMql.addEventListener) portraitMql.addEventListener('change', handleResize);
      else if ((portraitMql as any).addListener) (portraitMql as any).addListener(handleResize);
    }
    if (landscapeMql) {
      if (landscapeMql.addEventListener) landscapeMql.addEventListener('change', handleResize);
      else if ((landscapeMql as any).addListener) (landscapeMql as any).addListener(handleResize);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (typeof window !== 'undefined' && 'ondeviceorientation' in window) {
        window.removeEventListener('deviceorientation', handleDeviceOrientation);
      }
      if (tiltDebounceTimer) clearTimeout(tiltDebounceTimer);
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleResize);
        window.screen.orientation.onchange = null;
      }
      if (portraitMql) {
        if (portraitMql.removeEventListener) portraitMql.removeEventListener('change', handleResize);
        else if ((portraitMql as any).removeListener) (portraitMql as any).removeListener(handleResize);
      }
      if (landscapeMql) {
        if (landscapeMql.removeEventListener) landscapeMql.removeEventListener('change', handleResize);
        else if ((landscapeMql as any).removeListener) (landscapeMql as any).removeListener(handleResize);
      }
    };
  }, []);

  // Fetch tracks and albums directly from MySQL database (via PHP bridge / API)
  useEffect(() => {
    let isMounted = true;
    async function loadTracks() {
      let loadedSuccessfully = false;

      // Source 1: Direct TransIP Database Bridge (/api/music_database.php?action=get_catalog)
      try {
        const bridgeUrl = localStorage.getItem('transip_music_api_url') || '/api/music_database.php';
        const apiKey = localStorage.getItem('transip_music_api_key') || 'music-secret-key-paul-2026';
        const targetUrl = bridgeUrl.includes('?') ? `${bridgeUrl}&action=get_catalog` : `${bridgeUrl}?action=get_catalog`;
        let res = await fetch(targetUrl, {
          cache: 'no-store',
          headers: { 'X-API-Key': apiKey }
        });
        let contentType = res.headers.get('content-type') || '';
        if (!res.ok || !contentType.includes('application/json')) {
          res = await fetch('https://paulvangeenen.nl/api/music_database.php?action=get_catalog', {
            cache: 'no-store',
            headers: { 'X-API-Key': apiKey }
          });
          contentType = res.headers.get('content-type') || '';
        }
        if (res.ok && contentType.includes('application/json')) {
          const data: any = await res.json();
          if (isMounted && data.success && data.tracks && data.tracks.length > 0) {
            const normalized = data.tracks.map(normalizeTrack);
            setTracks(normalized);
            if (data.albums && data.albums.length > 0) {
              setAlbums(data.albums);
              setSelectedAlbum((prev) => prev || data.albums[0].title);
            }
            if (data.startupPortrait) setStartupPortrait(sanitizeMediaUrl(data.startupPortrait) || data.startupPortrait);
            if (data.startupLandscape) setStartupLandscape(sanitizeMediaUrl(data.startupLandscape) || data.startupLandscape);
            if (data.startupPortraitMov) setStartupPortraitMov(sanitizeMediaUrl(data.startupPortraitMov) || data.startupPortraitMov);
            if (data.startupLandscapeMov) setStartupLandscapeMov(sanitizeMediaUrl(data.startupLandscapeMov) || data.startupLandscapeMov);
            if (data.startupAudio) setStartupAudio(sanitizeMediaUrl(data.startupAudio) || data.startupAudio);
            loadedSuccessfully = true;
          }
        }
      } catch (e) {
        console.warn('[Music] Direct DB bridge fetch failed, trying proxy endpoint...', e);
      }

      // Source 2: Backend DB Proxy (/api/music/tracks)
      if (!loadedSuccessfully) {
        try {
          const res = await fetch(`/api/music/tracks?t=${Date.now()}`, { cache: 'no-store' });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data: any = await res.json();
            if (isMounted && data.tracks && data.tracks.length > 0) {
              const normalized = data.tracks.map(normalizeTrack);
              setTracks(normalized);
              if (data.albums && data.albums.length > 0) {
                setAlbums(data.albums);
                setSelectedAlbum((prev) => prev || data.albums[0].title);
              }
              if (data.startupPortrait) setStartupPortrait(data.startupPortrait);
              if (data.startupLandscape) setStartupLandscape(data.startupLandscape);
              if (data.startupPortraitMov) setStartupPortraitMov(data.startupPortraitMov);
              if (data.startupLandscapeMov) setStartupLandscapeMov(data.startupLandscapeMov);
              if (data.startupAudio) setStartupAudio(data.startupAudio);
              loadedSuccessfully = true;
            }
          }
        } catch (e) {
          console.warn('[Music] Could not fetch tracks from server API:', e);
        }
      }

      if (isMounted) setLoadingTracks(false);
    }
    loadTracks();
    return () => { isMounted = false; };
  }, []);

  // Helper to strictly match track by query or identifier with exact equality prioritized
  const findTrackMatch = (searchVal: string): number => {
    if (!searchVal || !tracks || tracks.length === 0) return -1;
    const target = searchVal.toLowerCase().trim();
    if (!target) return -1;

    // 1. Exact match on id or folderName
    let idx = tracks.findIndex(t => t.id.toLowerCase() === target || t.folderName.toLowerCase() === target);
    if (idx !== -1) return idx;

    // 2. Exact match on title
    idx = tracks.findIndex(t => t.title.toLowerCase() === target);
    if (idx !== -1) return idx;

    // 3. Exact match on order (e.g. "006")
    idx = tracks.findIndex(t => t.order.toLowerCase() === target);
    if (idx !== -1) return idx;

    // 4. Exact match on space/dash normalized title or folderName
    const normTarget = target.replace(/[\s\-_]+/g, '');
    idx = tracks.findIndex(t => 
      t.title.toLowerCase().replace(/[\s\-_]+/g, '') === normTarget ||
      t.folderName.toLowerCase().replace(/[\s\-_]+/g, '') === normTarget
    );
    if (idx !== -1) return idx;

    // 5. StartsWith match on id/folderName/title
    idx = tracks.findIndex(t => 
      t.id.toLowerCase().startsWith(target) || 
      t.folderName.toLowerCase().startsWith(target) ||
      t.title.toLowerCase().startsWith(target)
    );
    if (idx !== -1) return idx;

    // 6. Substring match as last resort
    return tracks.findIndex(t => 
      t.folderName.toLowerCase().includes(target) ||
      t.title.toLowerCase().includes(target)
    );
  };

  // Construct encrypted YouTube-style share URL (e.g. /music?v=x7K9p2M)
  const getCleanShareUrl = (track: Track, format: 'mp3' | 'audiobook' | 'reflection' | 'video') => {
    const origin = window.location.origin;
    const rawPath = window.location.pathname;

    // Preserve base path (/music or /@music)
    let basePath = '/music';
    if (rawPath.toLowerCase().startsWith('/@music')) {
      basePath = '/@music';
    }

    // Always use unique track identifier (id or folderName) to prevent collision between similar tracks
    const uniqueTrackId = track.id || track.folderName || track.title;
    const encryptedCode = encodeShareCode(uniqueTrackId, format);

    return `${origin}${basePath}?v=${encryptedCode}`;
  };

  // Handle incoming share URLs (encrypted ?v=... codes, legacy ?track=...&format=..., and path parameters)
  useEffect(() => {
    if (loadingTracks || tracks.length === 0 || initialSharedHandledRef.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const encryptedVParam = urlParams.get('v');
    const trackParam = urlParams.get('track');
    const formatParam = urlParams.get('format') as 'mp3' | 'audiobook' | 'reflection' | 'video' | null;

    let matchedIdx = -1;
    let matchedFormat: 'mp3' | 'audiobook' | 'reflection' | 'video' = 'mp3';

    // 1. Check YouTube-style encrypted share parameter (?v=...)
    if (encryptedVParam) {
      const decoded = decodeShareCode(encryptedVParam);
      if (decoded) {
        matchedIdx = findTrackMatch(decoded.trackIdentifier);
        matchedFormat = decoded.format;
      }
    }

    // 2. Fallback: Check legacy query parameters (?track=...&format=...) for full backward compatibility
    if (matchedIdx === -1 && trackParam) {
      const searchVal = decodeURIComponent(trackParam).toLowerCase().trim();
      matchedIdx = findTrackMatch(searchVal);
      if (formatParam && ['mp3', 'audiobook', 'reflection', 'video'].includes(formatParam)) {
        matchedFormat = formatParam;
      }
    }

    // 3. Fallback: Check path parameters (/music/001 or /music/001/audiobook)
    if (matchedIdx === -1) {
      const rawPathname = window.location.pathname;
      const segments = rawPathname
        .split('/')
        .filter(Boolean)
        .map(s => decodeURIComponent(s).toLowerCase().trim());

      const musicSegIdx = segments.findIndex(s => s === 'music' || s === '@music');
      const pathArgs = musicSegIdx !== -1 ? segments.slice(musicSegIdx + 1) : segments;

      if (pathArgs.length > 0) {
        const trackSlug = pathArgs[0];
        const formatSlug = pathArgs[1];

        matchedIdx = findTrackMatch(trackSlug);

        if (formatSlug) {
          if (formatSlug === 'audiobook' || formatSlug === 'audioboek') matchedFormat = 'audiobook';
          else if (formatSlug === 'reflection' || formatSlug === 'reflectie') matchedFormat = 'reflection';
          else if (formatSlug === 'video') matchedFormat = 'video';
          else matchedFormat = 'mp3';
        }
      }
    }

    if (matchedIdx !== -1) {
      initialSharedHandledRef.current = true;
      setCurrentTrackIndex(matchedIdx);
      setSelectedFormat(matchedFormat);

      // Replace ugly URL parameters in the browser address bar with clean route URL
      const matchedTrack = tracks[matchedIdx];
      if (matchedTrack) {
        if (matchedTrack.album) {
          setSelectedAlbum(matchedTrack.album);
        }
        if (window.history && window.history.replaceState) {
          const cleanUrl = getCleanShareUrl(matchedTrack, matchedFormat);
          window.history.replaceState({}, '', cleanUrl);
        }
      }

      // Bypass startup/splash directly into player mode for shared links and start playing immediately
      setPhase('player');
      setShowNavBar(false);
      playTrack(matchedIdx, matchedFormat);

      // Als iemand op de site komt met een link naar een track/video:
      // Altijd fullscreen tonen in de positie waarin het device zich dan bevindt.
      const isVideoLink = matchedFormat === 'video' || (matchedTrack && getEffectiveFormat(matchedTrack, matchedFormat) === 'video');
      if (isVideoLink) {
        isDirectVideoRequested.current = true;
        setLoopMode('off');
        setDesktopViewMode('fullscreen');
        setOrientation(getDeviceOrientation());
      } else if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        setDesktopViewMode('fullscreen');
        setOrientation('landscape');
      }
    } else {
      // Check if direct album URL parameter was specified (?album=...)
      const albumParam = urlParams.get('album');
      if (albumParam) {
        initialSharedHandledRef.current = true;
        const decodedAlb = decodeURIComponent(albumParam).trim();
        const found = albums.find(a => a.id.toLowerCase() === decodedAlb.toLowerCase() || a.title.toLowerCase() === decodedAlb.toLowerCase());
        if (found) {
          setSelectedAlbum(found.title);
        } else {
          setSelectedAlbum(decodedAlb);
        }
        setPhase('list');
      }
    }
  }, [loadingTracks, tracks, albums]);

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => setShareToast('Link gekopieerd naar klembord!'))
        .catch(() => fallbackCopyTextToClipboard(text));
    } else {
      fallbackCopyTextToClipboard(text);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShareToast('Link gekopieerd naar klembord!');
    } catch (err) {
      setShareToast('Kon link niet kopiëren');
    }
  };

  const handleShareTrack = () => {
    setCopiedLinkState(false);
    setShowShareModal(true);
  };

  // Active startup video check based on current orientation
  const activeStartupVideo = orientation === 'portrait' ? startupPortraitMov : startupLandscapeMov;
  const isStartupVideoActive = Boolean(activeStartupVideo && !startupVideoFailed[orientation]);

  // Clean transition from startup phase to albums view
  const endStartupPhase = () => {
    if (introAudioRef.current) {
      try {
        introAudioRef.current.pause();
        introAudioRef.current.currentTime = 0;
      } catch (e) {}
    }
    setPhase('albums');
  };

  // Flag to ensure startup intro triggers reliably on load
  const hasTriggeredStartupIntro = useRef(false);

  // Play intro.mp3 when opening Music page (ONLY if NOT requested via direct track link)
  // The intro mp3 stops immediately when transitioning or when another track starts
  useEffect(() => {
    if (!isDirectTrackRequested.current && !hasTriggeredStartupIntro.current) {
      hasTriggeredStartupIntro.current = true;
      if (introAudioRef.current) {
        introAudioRef.current.currentTime = 0;
        introAudioRef.current.volume = isMuted ? 0 : volume;
        const p = introAudioRef.current.play();
        if (p !== undefined) {
          p.catch((err) => {
            console.log('[Music] Startup intro.mp3 autoplay deferred until user interaction:', err);
          });
        }
      }
    }
  }, []);

  // Cleanup on unmount: stop all audio, video, and detach from equalizer
  useEffect(() => {
    return () => {
      if (introAudioRef.current) {
        try {
          introAudioRef.current.pause();
          introAudioRef.current.currentTime = 0;
        } catch (e) {}
      }
      if (audioRefA.current) {
        try {
          audioRefA.current.pause();
          audioRefA.current.currentTime = 0;
          audioRefA.current.removeAttribute('src');
          equalizerEngine.detachMediaElement(audioRefA.current);
        } catch (e) {}
      }
      if (audioRefB.current) {
        try {
          audioRefB.current.pause();
          audioRefB.current.currentTime = 0;
          audioRefB.current.removeAttribute('src');
          equalizerEngine.detachMediaElement(audioRefB.current);
        } catch (e) {}
      }
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
          equalizerEngine.detachMediaElement(videoRef.current);
        } catch (e) {}
      }
    };
  }, []);

  // Startup splash timer:
  // If video is active, onEnded will trigger transition to 'albums'.
  // A safety timer (12s) prevents getting stuck if autoplay is blocked or video stalls.
  // If static JPG is active, 7-second timer with progress bar triggers the transition.
  useEffect(() => {
    if (phase !== 'startup' || isDirectTrackRequested.current) return;

    const timeoutDuration = isStartupVideoActive ? 12000 : 7000;
    const timer = setTimeout(() => {
      endStartupPhase();
    }, timeoutDuration);

    return () => clearTimeout(timer);
  }, [phase, isStartupVideoActive]);

  // 7-second idle timer when browsing albums/tracks while music is playing => return to 'player' view
  useEffect(() => {
    if (!isPlaying) return;
    if (phase !== 'albums' && phase !== 'list') return;

    let timer: NodeJS.Timeout;
    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setPhase('player');
      }, 7000);
    };

    resetTimer();

    const handleActivity = () => {
      resetTimer();
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('mousedown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('touchmove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('touchmove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [isPlaying, phase]);

  // Handle current background image calculation with smooth crossfade
  const currentTrack = tracks[currentTrackIndex] || tracks[0];

  // Memoized albums strictly respecting the order in tracks.json (or explicit album.order)
  const orderedAlbums = React.useMemo(() => {
    return [...albums].sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined) {
        const numA = parseInt(String(a.order), 10);
        const numB = parseInt(String(b.order), 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
      }
      return 0; // Preserve exact array sequence in tracks.json
    });
  }, [albums]);

  // Synchronize landscape album index when selectedAlbum or orderedAlbums changes
  useEffect(() => {
    if (selectedAlbum && orderedAlbums.length > 0) {
      const idx = orderedAlbums.findIndex(a => a.title.toLowerCase() === selectedAlbum.toLowerCase());
      if (idx !== -1) {
        setLandscapeAlbumIndex(idx);
      }
    }
  }, [selectedAlbum, orderedAlbums]);

  // Memoized tracks belonging to the currently selected album strictly respecting the order in tracks.json
  const currentAlbumTracks = React.useMemo(() => {
    let filtered = tracks;
    if (selectedAlbum && selectedAlbum !== 'Alle Nummers' && selectedAlbum !== 'Alle') {
      filtered = tracks.filter(t => (t.album || 'Muzikale Krabbels').toLowerCase() === selectedAlbum.toLowerCase());
    }
    const listToUse = filtered.length > 0 ? filtered : tracks;
    return [...listToUse].sort((a, b) => {
      const orderA = a.albumOrder !== undefined ? a.albumOrder : a.order;
      const orderB = b.albumOrder !== undefined ? b.albumOrder : b.order;
      if (orderA !== undefined && orderB !== undefined) {
        const numA = parseInt(String(orderA), 10);
        const numB = parseInt(String(orderB), 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
      }
      return 0; // Preserve exact array sequence in tracks.json
    });
  }, [tracks, selectedAlbum]);

  // Keep landscapeTrackInListIndex synchronized when album or playing track changes
  useEffect(() => {
    setLandscapeTrackInListIndex(0);
  }, [selectedAlbum]);

  useEffect(() => {
    if (tracks[currentTrackIndex] && currentAlbumTracks.length > 0) {
      const idxInAlbum = currentAlbumTracks.findIndex(t => t.id === tracks[currentTrackIndex]?.id);
      if (idxInAlbum !== -1) {
        setLandscapeTrackInListIndex(idxInAlbum);
      }
    }
  }, [currentTrackIndex, currentAlbumTracks, tracks]);

  const getTrackBgImage = (track: Track | undefined, orient: 'portrait' | 'landscape') => {
    if (!track) return orient === 'portrait' ? startupPortrait : startupLandscape;
    if (orient === 'portrait') {
      return track.portraitJpg || track.landscapeJpg || startupPortrait;
    } else {
      return track.landscapeJpg || track.portraitJpg || startupLandscape;
    }
  };

  // Calculate effective format for a track based on user preference (sticky mode)
  const getEffectiveFormat = (track: Track | undefined, preferredFormat: 'mp3' | 'audiobook' | 'reflection' | 'video') => {
    if (!track) return 'mp3';
    if (preferredFormat === 'video' && track.videoMov) return 'video';
    if (preferredFormat === 'audiobook' && track.audiobook) return 'audiobook';
    if (preferredFormat === 'reflection' && track.reflection) return 'reflection';
    return 'mp3';
  };

  // Handle media URL retrieval based on effective format
  const getMediaUrl = (track: Track | undefined, format: 'mp3' | 'audiobook' | 'reflection' | 'video') => {
    if (!track) return undefined;
    if (format === 'video' && track.videoMov) return track.videoMov;
    if (format === 'audiobook' && track.audiobook) return track.audiobook;
    if (format === 'reflection' && track.reflection) return track.reflection;
    return track.mp3;
  };

  const effectiveFormat = getEffectiveFormat(currentTrack, selectedFormat);
  const isVideo = effectiveFormat === 'video';
  const effectiveOrientation = orientation;
  const currentMediaUrl = currentTrack ? getMediaUrl(currentTrack, effectiveFormat) : undefined;

  // Subtitle resolution for current track
  const availableSubtitles: Record<string, string | undefined> = React.useMemo(() => {
    if (currentTrack?.subtitles && Object.keys(currentTrack.subtitles).length > 0) {
      return currentTrack.subtitles;
    }
    // Auto-fallback for 010 the Echo screams or tracks matching folder naming
    const folder = currentTrack?.folderName || currentTrack?.id || '';
    if (folder.toLowerCase().includes('010') || folder.toLowerCase().includes('echo screams')) {
      return {
        GB: '/@music/010%20the%20Echo%20screams/the%20Echo%20Screams-EN.srt',
        EN: '/@music/010%20the%20Echo%20screams/the%20Echo%20Screams-EN.srt',
        NL: '/@music/010%20the%20Echo%20screams/the%20Echo%20Screams-NL.srt'
      };
    }
    return {};
  }, [currentTrack]);

  const hasSubtitles = Object.keys(availableSubtitles).length > 0;
  // Subtitles can be viewed in both portrait and landscape mode, but are never shown during reflections
  const areSubtitlesAvailableInCurrentView = hasSubtitles && effectiveFormat !== 'reflection';

  // If user preferred language is available, use it; otherwise fallback to other available subtitle
  const activeSubtitleUrl = availableSubtitles[subtitleLang] 
    || (subtitleLang === 'GB' ? (availableSubtitles.EN || availableSubtitles.NL) : (availableSubtitles.NL || availableSubtitles.GB || availableSubtitles.EN))
    || Object.values(availableSubtitles)[0];
  const activeSubtitleLang: 'GB' | 'NL' = (subtitleLang === 'NL' && availableSubtitles.NL)
    ? 'NL'
    : ((availableSubtitles.GB || availableSubtitles.EN) ? 'GB' : (availableSubtitles.NL ? 'NL' : 'GB'));

  // Load and parse SRT file whenever activeSubtitleUrl changes with robust fallback
  useEffect(() => {
    if (!activeSubtitleUrl) {
      setParsedCues([]);
      setCurrentCue(null);
      return;
    }

    let isMounted = true;
    if (subtitleCacheRef.current.has(activeSubtitleUrl)) {
      setParsedCues(subtitleCacheRef.current.get(activeSubtitleUrl) || []);
      return;
    }

    // Build fallback candidate URLs to try in order (e.g. trying -EN.srt if -GB.srt fails)
    const candidateUrls = [activeSubtitleUrl];
    if (activeSubtitleUrl.includes('-GB.srt')) {
      candidateUrls.push(activeSubtitleUrl.replace('-GB.srt', '-EN.srt'));
      candidateUrls.push(activeSubtitleUrl.replace('-GB.srt', '-gb.srt'));
    } else if (activeSubtitleUrl.includes('-EN.srt')) {
      candidateUrls.push(activeSubtitleUrl.replace('-EN.srt', '-GB.srt'));
      candidateUrls.push(activeSubtitleUrl.replace('-EN.srt', '-en.srt'));
    } else if (activeSubtitleUrl.includes('-NL.srt')) {
      candidateUrls.push(activeSubtitleUrl.replace('-NL.srt', '-nl.srt'));
    }

    async function fetchFirstValidSRT() {
      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) continue;
          const text = await res.text();
          // Verify it is actual SRT content (not HTML index fallback)
          if (text && !text.trim().startsWith('<') && (text.includes('-->') || text.includes(':'))) {
            if (!isMounted) return;
            const cues = parseSRT(text);
            if (cues.length > 0) {
              subtitleCacheRef.current.set(activeSubtitleUrl, cues);
              setParsedCues(cues);
              return;
            }
          }
        } catch (e) {
          // Continue to next candidate
        }
      }
      if (isMounted) setParsedCues([]);
    }

    fetchFirstValidSRT();

    return () => {
      isMounted = false;
    };
  }, [activeSubtitleUrl]);

  // Synchronize current subtitle cue with playback time (with boundary tolerance)
  useEffect(() => {
    if (!subtitlesEnabled || parsedCues.length === 0) {
      if (currentCue !== null) setCurrentCue(null);
      return;
    }

    const active = parsedCues.find(cue => currentTime >= (cue.startTime - 0.02) && currentTime < cue.endTime) || null;
    if (active?.id !== currentCue?.id || active?.text !== currentCue?.text) {
      setCurrentCue(active);
    }
  }, [currentTime, parsedCues, subtitlesEnabled, currentCue]);

  // High-precision playback time synchronization loop for sub-second subtitle accuracy
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const el = isVideo ? videoRef.current : getActiveAudioEl();
      if (el && !el.paused) {
        handleMediaTimeUpdate(el);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [isPlaying, isVideo, selectedFormat, currentTrack]);

  // Ensure video element begins playing automatically as soon as it mounts in player phase
  useEffect(() => {
    if (phase === 'player' && effectiveFormat === 'video' && currentMediaUrl) {
      const vid = videoRef.current;
      if (vid) {
        const targetEncodedUrl = encodeURI(currentMediaUrl);
        const isDifferent =
          !vid.src ||
          (vid.src !== currentMediaUrl &&
            !vid.src.endsWith(targetEncodedUrl) &&
            decodeURIComponent(vid.src) !== decodeURIComponent(currentMediaUrl));
        if (isDifferent) {
          vid.src = currentMediaUrl;
        }
        // During the end-of-track fade transition, only preload; playback starts after the fade-in
        if (vid.paused && !isEndTransitioningRef.current) {
          startPlaybackWithVolumeRamp(vid);
        }
      }
    }
  }, [phase, effectiveFormat, currentMediaUrl, currentTrackIndex]);

  // Track rating state (persisted locally on device per track + format)
  const [userRating, setUserRating] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (currentTrack) {
      const saved = localStorage.getItem(`krabbels_rating_${currentTrack.id}_${effectiveFormat}`);
      setUserRating(saved === 'up' || saved === 'down' ? saved : null);
    } else {
      setUserRating(null);
    }
  }, [currentTrackIndex, effectiveFormat, tracks]);

  const handleRating = (ratingType: 'up' | 'down') => {
    resetRatingButtonsTimer();
    if (!currentTrack) return;
    const newRating = userRating === ratingType ? null : ratingType;
    setUserRating(newRating);

    const storageKey = `krabbels_rating_${currentTrack.id}_${effectiveFormat}`;
    if (newRating) {
      localStorage.setItem(storageKey, newRating);
    } else {
      localStorage.removeItem(storageKey);
    }

    recordMusicRating(currentTrack, effectiveFormat, newRating).catch((err) => {
      console.error('Error logging music rating:', err);
    });
  };

  // Helper to find the next and previous track index based on current album / playlist ordering
  const getNextTrackIndex = () => {
    if (currentAlbumTracks.length === 0) {
      return (currentTrackIndex + 1) % (tracks.length || 1);
    }
    const currentInAlbumIdx = currentAlbumTracks.findIndex(t => t.id === currentTrack?.id);
    const nextInAlbumIdx = currentInAlbumIdx !== -1 ? (currentInAlbumIdx + 1) % currentAlbumTracks.length : 0;
    const nextTrackItem = currentAlbumTracks[nextInAlbumIdx];
    const masterIdx = tracks.findIndex(t => t.id === nextTrackItem?.id);
    return masterIdx !== -1 ? masterIdx : nextInAlbumIdx;
  };

  const getPrevTrackIndex = () => {
    if (currentAlbumTracks.length === 0) {
      return (currentTrackIndex - 1 + tracks.length) % (tracks.length || 1);
    }
    const currentInAlbumIdx = currentAlbumTracks.findIndex(t => t.id === currentTrack?.id);
    const prevInAlbumIdx = currentInAlbumIdx !== -1 ? (currentInAlbumIdx - 1 + currentAlbumTracks.length) % currentAlbumTracks.length : 0;
    const prevTrackItem = currentAlbumTracks[prevInAlbumIdx];
    const masterIdx = tracks.findIndex(t => t.id === prevTrackItem?.id);
    return masterIdx !== -1 ? masterIdx : prevInAlbumIdx;
  };

  // Current track background image synchronously calculated (eliminates 1-frame state lag/flicker)
  const currBgImage = currentTrack ? getTrackBgImage(currentTrack, effectiveOrientation) : null;

  // Calculate background images for current, previous, and next track (for 0-gap side-by-side swipe)
  const prevTrackIndex = getPrevTrackIndex();
  const nextTrackIndex = getNextTrackIndex();
  const prevTrack = tracks[prevTrackIndex];
  const nextTrack = tracks[nextTrackIndex];
  const prevBgImage = prevTrack ? getTrackBgImage(prevTrack, effectiveOrientation) : null;
  const nextBgImage = nextTrack ? getTrackBgImage(nextTrack, effectiveOrientation) : null;

  // Preload all background images in memory to ensure instant seamless crossfades and swipe transitions
  useEffect(() => {
    if (prevBgImage) { const img = new Image(); img.src = prevBgImage; }
    if (currBgImage) { const img = new Image(); img.src = currBgImage; }
    if (nextBgImage) { const img = new Image(); img.src = nextBgImage; }
    
    // Preload entire current tracks list in background
    tracks.forEach(t => {
      const p = getTrackBgImage(t, 'portrait');
      const l = getTrackBgImage(t, 'landscape');
      if (p) { const img = new Image(); img.src = p; }
      if (l) { const img = new Image(); img.src = l; }
    });
  }, [prevBgImage, currBgImage, nextBgImage, tracks]);

  // Auto-hide navbar logic (4 seconds timeout when playing, 5 minutes when paused)
  const resetNavBarTimer = () => {
    setShowNavBar(true);
    if (navBarTimeoutRef.current) clearTimeout(navBarTimeoutRef.current);
    if (phase === 'player') {
      const timeoutDuration = isPlaying ? 4000 : 5 * 60 * 1000; // 4s if playing, 5 minutes (300,000ms) if paused
      navBarTimeoutRef.current = setTimeout(() => {
        setShowNavBar(false);
      }, timeoutDuration);
    }
  };

  // Auto-fade Thumbs Up / Down rating buttons logic:
  // Verschijnt direct, fade-out na 3 seconden inactiviteit, en fade-in bij aanraken of klikken op scherm
  const resetRatingButtonsTimer = useCallback(() => {
    setShowRatingButtons(true);
    if (ratingButtonsTimeoutRef.current) clearTimeout(ratingButtonsTimeoutRef.current);
    ratingButtonsTimeoutRef.current = setTimeout(() => {
      setShowRatingButtons(false);
    }, 3000);
  }, []);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      clearFadeTimer();
      endTransitionTimersRef.current.forEach(t => clearTimeout(t));
      endTransitionTimersRef.current = [];
      if (autoAdvanceFadeTimerRef.current) clearTimeout(autoAdvanceFadeTimerRef.current);
      if (navBarTimeoutRef.current) clearTimeout(navBarTimeoutRef.current);
      if (ratingButtonsTimeoutRef.current) clearTimeout(ratingButtonsTimeoutRef.current);
      if (autoNextTimeoutRef.current) clearTimeout(autoNextTimeoutRef.current);
      if (volumeToastTimerRef.current) clearTimeout(volumeToastTimerRef.current);
      if (autoplayGestureCleanupRef.current) {
        autoplayGestureCleanupRef.current();
        autoplayGestureCleanupRef.current = null;
      }
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.volume = 0;
          equalizerEngine.detachMediaElement(videoRef.current);
        } catch (e) {}
      }
    };
  }, []);

  // Toon duimpjes altijd de eerste 3 seconden bij het laden of wisselen van een nummer in player mode
  useEffect(() => {
    if (phase === 'player') {
      resetRatingButtonsTimer();
      triggerSongCredit(7000);
    }
  }, [phase, currentTrackIndex, resetRatingButtonsTimer]);

  // Toon de titel en het hartje altijd bij het kantelen van het toestel
  useEffect(() => {
    if (phase === 'player' && currentTrack) {
      triggerSongCredit(6000);
    }
  }, [orientation]);

  // Strikte scheiding van actieve bron bij formaatwisseling om dubbele audio te voorkomen:
  useEffect(() => {
    if (effectiveFormat !== 'video' && videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.volume = 0;
        equalizerEngine.detachMediaElement(videoRef.current);
      } catch (e) {}
    } else if (effectiveFormat === 'video') {
      [audioRefA.current, audioRefB.current].forEach(a => {
        if (a) {
          try {
            a.pause();
            a.volume = 0;
            equalizerEngine.detachMediaElement(a);
          } catch (e) {}
        }
      });
    }
  }, [effectiveFormat]);

  // Reliable Auto-hide effect: whenever navbar is visible in player mode, hide after 4s (playing) or 5 minutes (paused)
  useEffect(() => {
    if (phase === 'player' && showNavBar && !showSubtitleMenu && !showShareModal && !showTestModal && !showEqualizerModal) {
      if (navBarTimeoutRef.current) clearTimeout(navBarTimeoutRef.current);
      const timeoutDuration = isPlaying ? 4000 : 5 * 60 * 1000; // 4s if playing, 5 minutes (300,000ms) if paused
      navBarTimeoutRef.current = setTimeout(() => {
        setShowNavBar(false);
      }, timeoutDuration);
    }
    return () => {
      if (navBarTimeoutRef.current) clearTimeout(navBarTimeoutRef.current);
    };
  }, [phase, showNavBar, isPlaying, showSubtitleMenu, showShareModal, showTestModal, showEqualizerModal]);

  // Master fade helper for smooth, acoustic volume ramps
  const fadeToVolume = (
    el: HTMLMediaElement | null,
    targetVolume: number,
    durationMs = 750,
    onComplete?: () => void
  ) => {
    if (!el) {
      if (onComplete) onComplete();
      return;
    }
    clearElFadeTimer(el);

    const startVol = typeof el.volume === 'number' ? el.volume : 0;
    if (Math.abs(startVol - targetVolume) < 0.01) {
      try {
        el.volume = targetVolume;
      } catch (e) {}
      if (onComplete) onComplete();
      return;
    }

    const steps = 30;
    const intervalMs = Math.max(10, Math.round(durationMs / steps));
    let step = 0;

    (el as any)._fadeTimer = setInterval(() => {
      step++;
      const progress = step / steps;
      // Gentle sinusoidal easing (S-curve) for organic acoustic fade in/out
      const easedProgress = targetVolume > startVol
        ? Math.sin((progress * Math.PI) / 2) // smooth ease-out for fade-in
        : 1 - Math.cos((progress * Math.PI) / 2); // smooth ease-in for fade-out
      const currentVol = Math.max(0, Math.min(1, startVol + (targetVolume - startVol) * easedProgress));
      if (el) {
        try {
          el.volume = currentVol;
        } catch (e) {}
      }
      if (step >= steps) {
        clearElFadeTimer(el);
        if (el) {
          try {
            el.volume = targetVolume;
          } catch (e) {}
        }
        if (onComplete) onComplete();
      }
    }, intervalMs);
  };

  // Smooth volume ramp-in helper to fade in gently when starting or resuming playback
  const startPlaybackWithVolumeRamp = (el: HTMLMediaElement | null, durationMs = 750) => {
    if (!el) return;
    clearElFadeTimer(el);
    shouldAutoPlayRef.current = false;

    // Strikte handhaving van actieve bronnen:
    // Als audio wordt gestart, pauzeer en ontkoppel video & intro audio.
    // Als video wordt gestart, pauzeer en ontkoppel intro audio.
    if (el === audioRefA.current || el === audioRefB.current) {
      if (videoRef.current && !videoRef.current.paused) {
        try {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
          equalizerEngine.detachMediaElement(videoRef.current);
        } catch (e) {}
      }
    } else if (el === videoRef.current) {
      [audioRefA.current, audioRefB.current].forEach(a => {
        if (a && a !== el && !a.paused) {
          try {
            a.pause();
            a.currentTime = 0;
            equalizerEngine.detachMediaElement(a);
          } catch (e) {}
        }
      });
    }

    if (introAudioRef.current && !introAudioRef.current.paused) {
      try {
        introAudioRef.current.pause();
        introAudioRef.current.currentTime = 0;
      } catch (e) {}
    }

    if (!isIOS && !isMobileDevice) {
      try {
        equalizerEngine.attachMediaElement(el);
        equalizerEngine.onResumeMediaElement(el, 150);
      } catch (e) {}
    }

    el.muted = isMuted;
    setIsAutoplayMuted(false);

    const targetVol = isMuted ? 0 : volume;
    if (targetVol <= 0) {
      el.volume = 0;
      const p = el.play();
      if (p !== undefined) p.catch(() => {});
      setIsPlaying(true);
      return;
    }

    el.volume = 0;

    const playPromise = el.play();

    const runRamp = () => {
      shouldAutoPlayRef.current = false;
      setIsPlaying(true);
      fadeToVolume(el, targetVol, durationMs);
    };

    if (playPromise !== undefined) {
      playPromise.then(runRamp).catch(e => {
        // Ignore AbortError: this occurs naturally when switching tracks/formats or pausing while loading
        if (!e || e.name === 'AbortError') {
          return;
        }
        // Only fall back to muted autoplay when the browser explicitly blocks unmuted autoplay (NotAllowedError)
        if (e.name !== 'NotAllowedError') {
          console.warn('Media playback error:', e);
          return;
        }

        console.warn('Playback with audio blocked by browser policy:', e);
        el.muted = true;
        setIsAutoplayMuted(true);
        const retryMuted = el.play();
        if (retryMuted !== undefined) {
          retryMuted.then(() => {
            setIsPlaying(true);
            shouldAutoPlayRef.current = false;
          }).catch(err2 => {
            if (err2 && err2.name !== 'AbortError') {
              console.warn('Muted autoplay also blocked:', err2);
              shouldAutoPlayRef.current = true;
            }
          });
        }

        if (autoplayGestureCleanupRef.current) {
          autoplayGestureCleanupRef.current();
          autoplayGestureCleanupRef.current = null;
        }

        const handleUserGesture = () => {
          if (autoplayGestureCleanupRef.current) {
            autoplayGestureCleanupRef.current();
            autoplayGestureCleanupRef.current = null;
          }
          if (!isIOS && !isMobileDevice) {
            try {
              equalizerEngine.onResumeMediaElement(el, 150);
            } catch (err) {}
          }
          if (el) {
            el.muted = isMuted;
            setIsAutoplayMuted(false);
            if (el.paused) {
              el.play().catch(() => {});
            }
            fadeToVolume(el, targetVol, durationMs);
          }
        };

        const cleanup = () => {
          ['click', 'touchstart', 'keydown'].forEach(evt => {
            window.removeEventListener(evt, handleUserGesture);
          });
        };
        autoplayGestureCleanupRef.current = cleanup;

        ['click', 'touchstart', 'keydown'].forEach(evt => {
          window.addEventListener(evt, handleUserGesture, { once: true, passive: true });
        });
      });
    } else {
      runRamp();
    }
  };

  // Smooth volume ramp-out helper to fade out gently before pausing
  const pausePlaybackWithVolumeRamp = (el: HTMLMediaElement | null, durationMs = 750, onPaused?: () => void) => {
    clearElFadeTimer(el);
    setIsPlaying(false);
    shouldAutoPlayRef.current = false;

    if (!el) {
      equalizerEngine.onPauseMediaElement(null);
      if (onPaused) onPaused();
      return;
    }

    if (isIOS || isMobileDevice || el.paused || el.volume === 0) {
      if (!isIOS && !isMobileDevice) {
        equalizerEngine.onPauseMediaElement(el);
      }
      try {
        el.pause();
      } catch (e) {}
      if (onPaused) onPaused();
      return;
    }

    const targetVol = isMuted ? 0 : volume;
    fadeToVolume(el, 0, Math.min(durationMs, 250), () => {
      if (!isIOS && !isMobileDevice) {
        equalizerEngine.onPauseMediaElement(el);
      }
      try {
        el.pause();
        el.volume = targetVol;
      } catch (e) {
        console.warn('Error pausing element after fade out:', e);
      }
      if (onPaused) onPaused();
    });
  };

  // Play / Pause toggle with smooth fade-out on stop and smooth fade-in on play
  const togglePlayPause = () => {
    // Tijdens de filmische eind-overgang start het volgende nummer vanzelf; negeer play/pause dan even
    if (isEndTransitioningRef.current) return;
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    const activeFormat = getEffectiveFormat(currentTrack, selectedFormat);
    const el = activeFormat === 'video' ? videoRef.current : getActiveAudioEl();

    if (isPlaying) {
      pausePlaybackWithVolumeRamp(el, 300);
    } else {
      enterBrowserFullscreenSafely();
      setPhase('player');
      shouldAutoPlayRef.current = false;
      setIsPlaying(true);

      if (isAutoplayMuted && el) {
        if (!isIOS && !isMobileDevice) {
          try {
            equalizerEngine.onResumeMediaElement(el, 150);
          } catch (err) {}
        }
        el.muted = false;
        setIsAutoplayMuted(false);
      }

      if (el) {
        startPlaybackWithVolumeRamp(el, 750);
      }
    }
    resetNavBarTimer();
    resetRatingButtonsTimer();
  };

  // Synchronously switches and starts media playback on the alternate deck with true crossfading
  const startDeckPlayback = (
    targetTrack: Track,
    targetEffectiveFormat: 'mp3' | 'audiobook' | 'reflection' | 'video'
  ) => {
    cancelEndTransition();
    if (introAudioRef.current && !introAudioRef.current.paused) {
      try {
        introAudioRef.current.pause();
        introAudioRef.current.currentTime = 0;
      } catch (e) {}
    }

    const outgoingEl = effectiveFormat === 'video' ? videoRef.current : getActiveAudioEl();

    let incomingEl: HTMLMediaElement | null = null;
    if (targetEffectiveFormat === 'video') {
      incomingEl = videoRef.current;
    } else {
      // Alternate audio deck for true acoustic crossfading
      const nextDeck = activeDeckRef.current === 'A' ? 'B' : 'A';
      activeDeckRef.current = nextDeck;
      incomingEl = nextDeck === 'A' ? audioRefA.current : audioRefB.current;
    }

    if (incomingEl) {
      clearElFadeTimer(incomingEl);
    }

    // Smoothly fade OUT outgoing track over 320ms, then pause and reset
    if (outgoingEl && outgoingEl !== incomingEl) {
      if (!outgoingEl.paused) {
        fadeToVolume(outgoingEl, 0, 320, () => {
          try {
            outgoingEl.pause();
            outgoingEl.currentTime = 0;
            if (!isIOS && !isMobileDevice) {
              equalizerEngine.detachMediaElement(outgoingEl);
            }
          } catch (e) {}
        });
      } else if (!isIOS && !isMobileDevice) {
        try {
          equalizerEngine.detachMediaElement(outgoingEl);
        } catch (e) {}
      }
    }

    const targetMediaUrl = targetTrack ? getMediaUrl(targetTrack, targetEffectiveFormat) : undefined;
    if (incomingEl && targetMediaUrl) {
      const targetEncodedUrl = encodeURI(targetMediaUrl);
      const isDifferent =
        !incomingEl.src ||
        (incomingEl.src !== targetMediaUrl &&
          !incomingEl.src.endsWith(targetEncodedUrl) &&
          decodeURIComponent(incomingEl.src) !== decodeURIComponent(targetMediaUrl));

      if (isDifferent) {
        incomingEl.src = targetMediaUrl;
      } else {
        try {
          incomingEl.currentTime = 0;
        } catch (e) {}
      }

      incomingEl.volume = 0;
      incomingEl.muted = isMuted;
      setIsAutoplayMuted(false);

      // Start playback SYNCHRONOUSLY within the user gesture context!
      // This preserves user activation on Android & iOS and prevents NotAllowedError / silence!
      startPlaybackWithVolumeRamp(incomingEl, 750);
    }
  };

  // Finalizes React state, URL bar, and tracking metrics when track changes
  const finalizeTrackSwitch = (
    index: number,
    format?: 'mp3' | 'audiobook' | 'reflection' | 'video'
  ) => {
    const targetTrack = tracks[index] || tracks[0];
    const newSelectedFormat = format || selectedFormat || 'mp3';
    const targetEffectiveFormat = getEffectiveFormat(targetTrack, newSelectedFormat);

    if (newSelectedFormat === 'reflection' || targetEffectiveFormat === 'reflection') {
      setShowSubtitleMenu(false);
    }

    savedTimeRef.current = 0;
    setCurrentTime(0);
    hasRegisteredListenRef.current = false;
    activeListenRecordIdRef.current = null;
    isListenCompletedRef.current = false;

    setSelectedFormat(newSelectedFormat);
    setCurrentTrackIndex(index);
    setPhase('player');
    setShowNavBar(false);
    resetRatingButtonsTimer();

    if (targetTrack && window.history && window.history.replaceState) {
      try {
        const cleanUrl = getCleanShareUrl(targetTrack, newSelectedFormat);
        window.history.replaceState({}, '', cleanUrl);
      } catch (e) {}
    }
  };

  // Start playing a track directly
  const playTrack = (index: number, format?: 'mp3' | 'audiobook' | 'reflection' | 'video') => {
    cancelEndTransition();
    enterBrowserFullscreenSafely();
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    clearFadeTimer();
    const targetTrack = tracks[index] || tracks[0];
    const newSelectedFormat = format || selectedFormat || 'mp3';
    const targetEffectiveFormat = getEffectiveFormat(targetTrack, newSelectedFormat);
    const targetMediaUrl = targetTrack ? getMediaUrl(targetTrack, targetEffectiveFormat) : undefined;
    const activeEl = targetEffectiveFormat === 'video' ? videoRef.current : getActiveAudioEl();
    const targetEncodedUrl = targetMediaUrl ? encodeURI(targetMediaUrl) : '';
    const isAlreadyLoadedOnActiveEl = Boolean(
      activeEl &&
      activeEl.src &&
      targetMediaUrl &&
      (activeEl.src === targetMediaUrl ||
        activeEl.src.endsWith(targetEncodedUrl) ||
        decodeURIComponent(activeEl.src) === decodeURIComponent(targetMediaUrl))
    );

    // Only restart on the same deck if the exact track + media URL is ALREADY loaded on the active element in player mode:
    if (
      index === currentTrackIndex &&
      targetEffectiveFormat === effectiveFormat &&
      phase === 'player' &&
      isAlreadyLoadedOnActiveEl &&
      activeEl
    ) {
      setShowNavBar(false);
      resetRatingButtonsTimer();
      try {
        activeEl.currentTime = 0;
      } catch (e) {}
      setCurrentTime(0);
      savedTimeRef.current = 0;
      startPlaybackWithVolumeRamp(activeEl, 750);
      return;
    }

    startDeckPlayback(targetTrack, targetEffectiveFormat);
    finalizeTrackSwitch(index, newSelectedFormat);
  };

  // Loop mode handler
  const cycleLoopMode = () => {
    let nextMode: 'all' | 'one' | 'off' = 'all';
    let label = 'Lijst herhalen';

    if (loopMode === 'all') {
      nextMode = 'one';
      label = '1 Nummer herhalen';
    } else if (loopMode === 'one') {
      nextMode = 'off';
      label = '1 Nummer afspelen (stopt na afspelen)';
    } else {
      nextMode = 'all';
      label = 'Lijst herhalen';
    }

    setLoopMode(nextMode);
    setLoopToast(label);
    setTimeout(() => {
      setLoopToast(null);
    }, 2200);
  };

  // Handle Track Ended => Register completed listen in analytics & handle loop mode
  const handleTrackEnded = () => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }

    // Register completed listen event in analytics when the end of a track is reached
    const finishedTrack = tracks[currentTrackIndex];
    if (finishedTrack && !isOwnAnalyticsIgnored()) {
      const finishedEffectiveFormat = getEffectiveFormat(finishedTrack, selectedFormat);
      const savedRating = localStorage.getItem(`krabbels_rating_${finishedTrack.id}_${finishedEffectiveFormat}`) as 'up' | 'down' | null;
      const trackDuration = Math.floor(duration || currentTime || 0);

      if (activeListenRecordIdRef.current) {
        // Upgrade de eerdere meting (na 10 seconden) naar completed: true
        updateMusicPlay(activeListenRecordIdRef.current, true, trackDuration);
      } else {
        // Als nummer direct tot einde is afgespeeld of korter dan 10s: registreer als completed: true
        recordMusicPlay(finishedTrack, finishedEffectiveFormat, savedRating, true, trackDuration);
        hasRegisteredListenRef.current = true;
      }
      isListenCompletedRef.current = true;
    }

    setIsPlaying(false);

    const targetVol = isMuted ? 0 : volume;

    [audioRefA.current, audioRefB.current].forEach(a => {
      if (a) {
        try {
          a.pause();
          a.currentTime = 0;
          a.volume = targetVol;
        } catch (e) {}
      }
    });
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.volume = targetVol;
      } catch (e) {}
    }

    // 1. LIJST (loopMode === 'all') & 2. 1 TRACK (loopMode === 'one'):
    // Rustige filmische overgang: huidige afbeelding fade uit naar zwart -> afbeelding van het
    // (volgende of zelfde) nummer fade in -> pas daarna start het nieuwe nummer.
    if (loopMode === 'all' || loopMode === 'one') {
      const targetIndex = loopMode === 'all' ? getNextTrackIndex() : currentTrackIndex;
      const targetFormat = selectedFormat;
      const targetTrack = tracks[targetIndex] || tracks[0];
      const targetEffectiveFormat = getEffectiveFormat(targetTrack, targetFormat);
      const targetMediaUrl = targetTrack ? getMediaUrl(targetTrack, targetEffectiveFormat) : undefined;

      if (loopMode === 'all') {
        isDirectVideoRequested.current = false;
      }

      cancelEndTransition();
      isEndTransitioningRef.current = true;
      setShowNavBar(false);
      setEndTransitionPhase('fadingOut');

      // Stap A: na fade-out (scherm zwart) wisselen we stil naar het nieuwe nummer en laden de media voor
      const tSwitch = setTimeout(() => {
        finalizeTrackSwitch(targetIndex, targetFormat);
        setShowNavBar(false);

        if (targetMediaUrl) {
          const el = targetEffectiveFormat === 'video' ? videoRef.current : getActiveAudioEl();
          if (el) {
            const encoded = encodeURI(targetMediaUrl);
            const isDifferent =
              !el.src ||
              (el.src !== targetMediaUrl &&
                !el.src.endsWith(encoded) &&
                decodeURIComponent(el.src) !== decodeURIComponent(targetMediaUrl));
            try {
              if (isDifferent) {
                el.src = targetMediaUrl;
              } else {
                el.currentTime = 0;
              }
              el.volume = 0;
            } catch (e) {}
          }
        }

        // Stap B: afbeelding van het nieuwe nummer fade in
        const tFadeIn = setTimeout(() => {
          setEndTransitionPhase('fadingIn');

          // Stap C: na de fade-in start het nieuwe nummer (zacht invaden)
          const tPlay = setTimeout(() => {
            isEndTransitioningRef.current = false;
            setEndTransitionPhase('idle');
            endTransitionTimersRef.current = [];
            const el = targetEffectiveFormat === 'video' ? videoRef.current : getActiveAudioEl();
            if (el && targetMediaUrl) {
              try {
                el.currentTime = 0;
              } catch (e) {}
              savedTimeRef.current = 0;
              startPlaybackWithVolumeRamp(el, 900);
            }
          }, END_FADE_IN_MS);
          endTransitionTimersRef.current.push(tPlay);
        }, END_HOLD_MS);
        endTransitionTimersRef.current.push(tFadeIn);
      }, END_FADE_OUT_MS);
      endTransitionTimersRef.current.push(tSwitch);
      return;
    }

    // 3. 1X (loopMode === 'off'): 1x afspelen en dan stopt de player
    setCurrentTime(0);
    savedTimeRef.current = 0;
    setIsPlaying(false);
    setShowNavBar(true);
  };

  // Swipe gesture & Kobo-style vertical volume control handling
  const [dragX, setDragX] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);
  const [isSwipingRelease, setIsSwipingRelease] = useState<boolean>(false);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>('next');

  // Kobo-style Left Vertical Volume Toast Indicator State
  const [showVolumeToast, setShowVolumeToast] = useState<boolean>(false);
  const volumeToastTimerRef = useRef<any>(null);

  const releaseTimerRef = useRef<any>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartVolumeRef = useRef<number>(0.8);
  const isLeftZoneRef = useRef<boolean>(false);
  const containerHeightRef = useRef<number>(400);
  const gestureTypeRef = useRef<'undecided' | 'volume' | 'track' | 'none'>('none');

  const startGesture = (clientX: number, clientY: number, container: HTMLElement) => {
    resetNavBarTimer();
    resetRatingButtonsTimer();
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    setIsSwipingRelease(false);

    const rect = container.getBoundingClientRect();
    touchStartXRef.current = clientX;
    touchStartYRef.current = clientY;
    touchStartVolumeRef.current = volume;
    containerHeightRef.current = rect.height || 400;

    // Left 40% of the screen/container triggers vertical volume control (Kobo style)
    const relativeX = clientX - rect.left;
    isLeftZoneRef.current = relativeX < rect.width * 0.4;
    gestureTypeRef.current = 'undecided';

    setIsSwiping(true);
  };

  const updateGesture = (clientX: number, clientY: number) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = clientX - touchStartXRef.current;
    const deltaY = clientY - touchStartYRef.current;

    if (gestureTypeRef.current === 'undecided') {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX > 8 || absY > 8) {
        if (isLeftZoneRef.current && absY > absX * 1.1) {
          // Mobile phones have hardware volume buttons; disable touch volume gesture on mobile to prevent accidental hijacking
          if (!isIOS && !isMobileDevice) {
            gestureTypeRef.current = 'volume';
          } else {
            gestureTypeRef.current = 'none';
          }
        } else if (absX > absY * 1.1) {
          gestureTypeRef.current = 'track';
        } else {
          gestureTypeRef.current = 'none';
        }
      }
    }

    if (gestureTypeRef.current === 'volume') {
      // Swiping UP (-deltaY) increases volume, swiping DOWN (+deltaY) decreases volume
      const sensitivityPixels = Math.max(160, containerHeightRef.current * 0.55);
      const volumeChange = -deltaY / sensitivityPixels;
      const newVolume = Math.max(0, Math.min(1, touchStartVolumeRef.current + volumeChange));

      setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
      }

      setShowVolumeToast(true);
      if (volumeToastTimerRef.current) clearTimeout(volumeToastTimerRef.current);
      volumeToastTimerRef.current = setTimeout(() => {
        setShowVolumeToast(false);
      }, 5000);

      setDragX(0);
      setShowNavBar(false);
    } else if (gestureTypeRef.current === 'track') {
      setDragX(deltaX);
      setShowNavBar(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, a')) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      gestureTypeRef.current = 'none';
      return;
    }
    startGesture(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget as HTMLElement);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    updateGesture(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, a')) return;
    startGesture(e.clientX, e.clientY, e.currentTarget as HTMLElement);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    updateGesture(e.clientX, e.clientY);
  };

  const handleScreenTap = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a')) return;

    resetRatingButtonsTimer();

    const activeEl = effectiveFormat === 'video' ? videoRef.current : getActiveAudioEl();
    if (isAutoplayMuted && activeEl) {
      if (!isIOS && !isMobileDevice) {
        try {
          equalizerEngine.onResumeMediaElement(activeEl, 200);
        } catch (err) {}
      }
      activeEl.muted = false;
      setIsAutoplayMuted(false);
      fadeToVolume(activeEl, volume, 400);
    }

    setShowNavBar(prev => {
      const next = !prev;
      if (next) resetNavBarTimer();
      return next;
    });
  };

  const finishGesture = (endX: number, endY: number) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) {
      setDragX(0);
      setIsSwiping(false);
      setIsSwipingRelease(false);
      gestureTypeRef.current = 'none';
      return;
    }

    const deltaX = endX - touchStartXRef.current;
    const deltaY = endY - touchStartYRef.current;
    const isVolumeGesture = gestureTypeRef.current === 'volume';

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (isVolumeGesture) {
      if (volumeToastTimerRef.current) clearTimeout(volumeToastTimerRef.current);
      volumeToastTimerRef.current = setTimeout(() => {
        setShowVolumeToast(false);
      }, 5000);

      gestureTypeRef.current = 'none';
      setIsSwiping(false);
      setDragX(0);
      return;
    }

    // Tap detection: simple finger tap toggles overlay buttons
    if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
      setIsSwiping(false);
      setDragX(0);
      gestureTypeRef.current = 'none';

      resetRatingButtonsTimer();

      const activeEl = effectiveFormat === 'video' ? videoRef.current : getActiveAudioEl();
      if (isAutoplayMuted && activeEl) {
        if (!isIOS && !isMobileDevice) {
          try {
            equalizerEngine.onResumeMediaElement(activeEl, 200);
          } catch (err) {}
        }
        activeEl.muted = false;
        setIsAutoplayMuted(false);
        fadeToVolume(activeEl, volume, 400);
      }

      setShowNavBar(prev => {
        const next = !prev;
        if (next) resetNavBarTimer();
        return next;
      });
      return;
    }

    const minSwipeDistance = 35;
    const isHorizontalSwipe = Math.abs(deltaX) >= minSwipeDistance && Math.abs(deltaX) > Math.abs(deltaY) * 1.2;

    if (isHorizontalSwipe) {
      const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
      setIsSwipingRelease(true);

      const targetIndex = deltaX < 0 ? getNextTrackIndex() : getPrevTrackIndex();
      const targetTrack = tracks[targetIndex] || tracks[0];
      const targetEffectiveFormat = getEffectiveFormat(targetTrack, selectedFormat);
      setDragX(deltaX < 0 ? -containerWidth : containerWidth);

      // Start playback SYNCHRONOUSLY within this touch release event!
      // This preserves user activation on Android & iOS, prevents browser autoplay muting,
      // and triggers the dual-deck acoustic crossfade immediately!
      startDeckPlayback(targetTrack, targetEffectiveFormat);

      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = setTimeout(() => {
        finalizeTrackSwitch(targetIndex, selectedFormat);
        setDragX(0);
        setIsSwiping(false);
        setIsSwipingRelease(false);
      }, 250);
    } else {
      // Snap back to center smoothly
      setIsSwipingRelease(true);
      setDragX(0);
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = setTimeout(() => {
        setIsSwiping(false);
        setIsSwipingRelease(false);
      }, 280);
    }
    gestureTypeRef.current = 'none';
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const endX = e.changedTouches[0]?.clientX ?? 0;
    const endY = e.changedTouches[0]?.clientY ?? 0;
    finishGesture(endX, endY);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    finishGesture(e.clientX, e.clientY);
  };

  // Next / Previous track actions with visual slide and acoustic crossfade (ZERO opacity fade)
  const handleNext = () => {
    resetNavBarTimer();
    setSlideDirection('next');
    const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
    const nextIndex = getNextTrackIndex();
    const targetTrack = tracks[nextIndex] || tracks[0];
    const targetEffectiveFormat = getEffectiveFormat(targetTrack, selectedFormat);
    setIsSwipingRelease(true);
    setDragX(-containerWidth);
    startDeckPlayback(targetTrack, targetEffectiveFormat);

    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => {
      finalizeTrackSwitch(nextIndex, selectedFormat);
      setDragX(0);
      setIsSwiping(false);
      setIsSwipingRelease(false);
    }, 280);
  };

  const handlePrev = () => {
    resetNavBarTimer();
    const effectiveFmt = getEffectiveFormat(currentTrack, selectedFormat);
    const el = effectiveFmt === 'video' ? videoRef.current : getActiveAudioEl();
    const currentProgress = el ? el.currentTime : currentTime;

    // If the track is more than 2 seconds in, restart the current track from the beginning
    if (currentProgress > 2) {
      if (el) {
        el.currentTime = 0;
      }
      setCurrentTime(0);
      savedTimeRef.current = 0;
      return;
    }

    setSlideDirection('prev');
    const containerWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
    const prevIndex = getPrevTrackIndex();
    const targetTrack = tracks[prevIndex] || tracks[0];
    const targetEffectiveFormat = getEffectiveFormat(targetTrack, selectedFormat);
    setIsSwipingRelease(true);
    setDragX(containerWidth);
    startDeckPlayback(targetTrack, targetEffectiveFormat);

    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    releaseTimerRef.current = setTimeout(() => {
      finalizeTrackSwitch(prevIndex, selectedFormat);
      setDragX(0);
      setIsSwiping(false);
      setIsSwipingRelease(false);
    }, 280);
  };

  // Closes the music player, halts all audio/video playback, and navigates back to website homepage
  const handleCloseToHome = () => {
    if (audioRefA.current) {
      try {
        audioRefA.current.pause();
        audioRefA.current.currentTime = 0;
        audioRefA.current.removeAttribute('src');
        audioRefA.current.load();
        equalizerEngine.detachMediaElement(audioRefA.current);
      } catch (e) {}
    }
    if (audioRefB.current) {
      try {
        audioRefB.current.pause();
        audioRefB.current.currentTime = 0;
        audioRefB.current.removeAttribute('src');
        audioRefB.current.load();
        equalizerEngine.detachMediaElement(audioRefB.current);
      } catch (e) {}
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
        equalizerEngine.detachMediaElement(videoRef.current);
      } catch (e) {}
    }
    if (introAudioRef.current) {
      try {
        introAudioRef.current.pause();
        introAudioRef.current.currentTime = 0;
      } catch (e) {}
    }

    clearFadeTimer();
    setIsPlaying(false);

    if (isBrowserFullscreen && typeof document !== 'undefined' && document.fullscreenElement) {
      try {
        document.exitFullscreen().catch(() => {});
      } catch (e) {}
    }

    navigate('/');
  };

  // Time format helper (e.g. 3:45)
  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Synchronize audio volume across all decks and video
  useEffect(() => {
    if (audioRefA.current) {
      audioRefA.current.volume = isMuted ? 0 : volume;
    }
    if (audioRefB.current) {
      audioRefB.current.volume = isMuted ? 0 : volume;
    }
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume;
    }
    if (introAudioRef.current) {
      introAudioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // iOS / Android Lock Screen & Control Center MediaSession Integration
  // Ensures album cover, song title, artist, and playback controls appear on iPhone Lock Screen / Dynamic Island / Apple Watch
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    if (!currentTrack) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const rawArtworkUrl = getTrackBgImage(currentTrack, 'portrait') || '/apple-touch-icon.png';
    const absoluteArtworkUrl = typeof window !== 'undefined'
      ? (rawArtworkUrl?.startsWith('http') ? rawArtworkUrl : `${window.location.origin}${rawArtworkUrl || '/apple-touch-icon.png'}`)
      : rawArtworkUrl;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Paul van Geenen',
        artist: 'Paul van Geenen',
        album: currentTrack.album || 'Paul van Geenen',
        artwork: [
          { src: absoluteArtworkUrl, sizes: '512x512', type: 'image/jpeg' },
          { src: absoluteArtworkUrl, sizes: '384x384', type: 'image/jpeg' },
          { src: absoluteArtworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: absoluteArtworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: absoluteArtworkUrl, sizes: '96x96', type: 'image/jpeg' }
        ]
      });
    } catch (e) {
      console.log('[MediaSession] metadata setup error:', e);
    }
  }, [currentTrack]);

  // Update MediaSession playback state & action handlers (enables lockscreen skip, pause, play, seek)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (e) {}

    const actionHandlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ['play', () => { if (!isPlaying) togglePlayPause(); }],
      ['pause', () => { if (isPlaying) togglePlayPause(); }],
      ['previoustrack', () => { handlePrev(); }],
      ['nexttrack', () => { handleNext(); }],
      ['seekto', (details) => {
        if (details.seekTime != null) {
          const effectiveFmt = getEffectiveFormat(currentTrack, selectedFormat);
          const el = effectiveFmt === 'video' ? videoRef.current : getActiveAudioEl();
          if (el) el.currentTime = details.seekTime;
          setCurrentTime(details.seekTime);
        }
      }],
      ['seekbackward', (details) => {
        const effectiveFmt = getEffectiveFormat(currentTrack, selectedFormat);
        const el = effectiveFmt === 'video' ? videoRef.current : getActiveAudioEl();
        const skip = details.seekOffset || 10;
        if (el) el.currentTime = Math.max(0, el.currentTime - skip);
      }],
      ['seekforward', (details) => {
        const effectiveFmt = getEffectiveFormat(currentTrack, selectedFormat);
        const el = effectiveFmt === 'video' ? videoRef.current : getActiveAudioEl();
        const skip = details.seekOffset || 10;
        if (el) el.currentTime = Math.min(duration || 0, el.currentTime + skip);
      }]
    ];

    actionHandlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (err) {}
    });

    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (err) {}
      });
    };
  }, [isPlaying, currentTrack, selectedFormat, duration]);

  // Main Mobile / Screen Content Component
  const renderScreenContent = () => {
    return (
      <div 
        className="relative w-full h-full bg-black text-white font-sans overflow-hidden select-none flex flex-col justify-between"
      >
        {/* ---------------- 1. STARTUP SPLASH SCREEN ---------------- */}
        <AnimatePresence>
          {phase === 'startup' && !isDirectTrackRequested.current && (
            <motion.div
              key="startup-screen"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
              className="absolute inset-0 z-50 bg-black overflow-hidden flex flex-col items-center justify-center cursor-pointer"
              onClick={() => {
                enterBrowserFullscreenSafely();
                endStartupPhase();
              }}
              onTouchStart={() => {
                enterBrowserFullscreenSafely();
                // Ensure intro audio can start playing if browser blocked initial autoplay
                if (introAudioRef.current && introAudioRef.current.paused) {
                  introAudioRef.current.play().catch(() => {});
                }
              }}
            >
              {isStartupVideoActive && activeStartupVideo ? (
                <video
                  key={`startup-video-${orientation}-${activeStartupVideo}`}
                  src={activeStartupVideo}
                  autoPlay
                  playsInline
                  muted
                  preload="auto"
                  onEnded={endStartupPhase}
                  onError={() => {
                    setStartupVideoFailed(prev => ({ ...prev, [orientation]: true }));
                  }}
                  className="w-full h-full object-cover object-center bg-black pointer-events-none"
                />
              ) : (
                <>
                  <img
                    src={orientation === 'portrait' ? startupPortrait : startupLandscape}
                    alt="Muzikale Albums Startup"
                    className="w-full h-full object-cover object-center bg-black pointer-events-none"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/phone-startup-screen.jpg';
                    }}
                  />

                  {/* Subtiele smalle progressbar voor wachttijd indicatie (alleen getoond bij JPG afbeelding) */}
                  <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-1.5 bg-black/40 border border-white/10 rounded-full overflow-hidden backdrop-blur-md shadow-2xl pointer-events-none">
                    <motion.div
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 7, ease: 'linear' }}
                      className="h-full bg-gradient-to-r from-earth-gold via-amber-200 to-earth-gold rounded-full shadow-[0_0_12px_rgba(212,170,63,0.9)]"
                    />
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------------- 1.5. ALBUM SELECTION VIEW ---------------- */}
        {phase === 'albums' && (
          <div className={`relative z-20 flex flex-col h-full bg-gradient-to-b from-[#141210] via-[#1c1916] to-[#0d0b09] ${effectiveOrientation === 'landscape' ? 'p-2 sm:p-3 overflow-hidden' : 'overflow-y-auto custom-scrollbar p-4 sm:p-5'}`}>
            {/* Top Bar */}
            <div className={`flex items-center justify-between border-b border-white/10 ${effectiveOrientation === 'landscape' ? 'pb-1.5 mb-1.5' : 'pb-3 mb-3 sm:mb-4'}`}>
              <div className="flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-earth-gold animate-spin-slow" />
                <span className="text-xs font-bold uppercase tracking-widest text-earth-gold">
                  {effectiveOrientation === 'landscape' 
                    ? t.albums.albumOf((((landscapeAlbumIndex % (orderedAlbums.length || 1)) + (orderedAlbums.length || 1)) % (orderedAlbums.length || 1)) + 1, orderedAlbums.length)
                    : t.albums.albumsCount(albums.length)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {areSubtitlesAvailableInCurrentView && (
                  <button
                    type="button"
                    onClick={() => setShowSubtitleMenu(true)}
                    className={`p-2 rounded-full border transition-all cursor-pointer shadow-md ${
                      subtitlesEnabled
                        ? 'border-earth-gold/60 bg-earth-gold/20 text-earth-gold hover:bg-earth-gold/30'
                        : 'border-white/10 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                    }`}
                    title={t.player.subtitlesTitle(subtitlesEnabled, subtitleLang)}
                  >
                    <Subtitles className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleBrowserFullscreen}
                  className="p-2 rounded-full border transition-all bg-white/10 hover:bg-white/20 border-white/10 text-white cursor-pointer"
                  title={isBrowserFullscreen ? t.topNav.fullscreenExit : t.topNav.fullscreenEnter}
                >
                  {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                {!isMobileDevice && desktopViewMode === 'fullscreen' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDesktopViewMode('iphone');
                      if (isBrowserFullscreen) toggleBrowserFullscreen();
                    }}
                    className="p-2 rounded-full border transition-all bg-white/10 hover:bg-white/20 border-white/10 text-white cursor-pointer shadow-sm"
                    title={t.desktop.backToSimulator}
                  >
                    <Minimize2 className="w-4 h-4 text-earth-gold" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleOrientation}
                  className="p-2 rounded-full border transition-all bg-white/10 hover:bg-white/20 border-white/10 text-white cursor-pointer"
                  title={t.topNav.rotateScreen}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                {SHOW_TEST_BUTTON && (
                  <button
                    type="button"
                    onClick={() => setShowTestModal(true)}
                    className="px-2.5 py-1.5 rounded-full bg-earth-gold/20 hover:bg-earth-gold/30 text-earth-gold border border-earth-gold/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow"
                    title="Test knoppen zichtbaarheid"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>Test</span>
                  </button>
                )}
              </div>
            </div>

            {/* Album Grid / Carousel: Portrait = Responsive Grid (1 col on mobile, 2 col on tablet/desktop) */}
            {effectiveOrientation === 'portrait' ? (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 content-start">
                {orderedAlbums.map((album) => {
                  const albumTracks = tracks.filter(t => (t.album || 'Muzikale Krabbels').toLowerCase() === album.title.toLowerCase());
                  const trackCount = albumTracks.length > 0 ? albumTracks.length : (album.title === 'Muzikale Krabbels' ? tracks.length : 0);
                  const albumCover = getAlbumCover(album, albumTracks);

                  return (
                    <div
                      key={album.id}
                      onClick={() => {
                        setSelectedAlbum(album.title);
                        setPhase('list');
                      }}
                      className="group relative bg-[#1c1916]/95 hover:bg-[#26201b] border border-earth-gold/30 hover:border-earth-gold/80 rounded-2xl p-3.5 transition-all duration-300 shadow-xl hover:shadow-earth-gold/15 cursor-pointer overflow-hidden flex flex-col justify-between"
                    >
                      <div className="flex items-center gap-3.5">
                        {/* Album Cover with Vinyl Record Accent */}
                        <div className="relative shrink-0">
                          {/* Vinyl Disc poking out */}
                          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#111] border-2 border-[#333] shadow-md flex items-center justify-center group-hover:translate-x-3 transition-transform duration-500">
                            <div className="w-5 h-5 rounded-full bg-earth-gold/60 border border-white/20 flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-black" />
                            </div>
                          </div>

                          {/* Album Thumbnail */}
                          <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-black/70 border border-white/20 shadow-2xl">
                            <img
                              src={albumCover}
                              alt={album.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                const title = (album.title || '').toLowerCase();
                                const fallback = title.includes('echo')
                                  ? '/images/banner-boek-2.jpg'
                                  : title.includes('geboorte')
                                  ? '/images/banner-boek-1.jpg'
                                  : '/images/banner-boek-3.jpg';
                                if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                  target.src = fallback;
                                }
                              }}
                            />
                          </div>
                        </div>

                        {/* Album Info */}
                        <div className="min-w-0 flex-1 pl-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded-full bg-earth-gold/20 text-earth-gold border border-earth-gold/30 text-[10px] font-bold uppercase tracking-wider">
                              {t.albums.tracksCount(trackCount)}
                            </span>
                          </div>
                          <h3 className="font-serif text-base sm:text-lg font-bold text-white group-hover:text-earth-gold transition-colors truncate">
                            {album.title}
                          </h3>
                          <p className="text-xs text-earth-light/80 truncate mb-1">
                            {album.artist || 'Paul van Geenen'}
                          </p>
                          {album.description && (
                            <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">
                              {album.description}
                            </p>
                          )}
                        </div>

                        {/* Chevron indicator */}
                        <div className="shrink-0">
                          <div className="w-8 h-8 rounded-full bg-earth-gold/20 group-hover:bg-earth-gold text-earth-gold group-hover:text-black flex items-center justify-center transition-all shadow-md">
                            <ChevronRight className="w-4 h-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Landscape Mode: Maximized Album Cover with Swipe & Navigation (clean & full size) */
              (() => {
                const totalAlbums = orderedAlbums.length || 1;
                const safeIndex = ((landscapeAlbumIndex % totalAlbums) + totalAlbums) % totalAlbums;
                const currentAlb = orderedAlbums[safeIndex] || orderedAlbums[0];
                if (!currentAlb) return null;
                const albumTracks = tracks.filter(t => (t.album || 'Muzikale Krabbels').toLowerCase() === currentAlb.title.toLowerCase());
                const trackCount = albumTracks.length > 0 ? albumTracks.length : (currentAlb.title === 'Muzikale Krabbels' ? tracks.length : 0);
                const albumCover = getAlbumCover(currentAlb, albumTracks);

                const handlePrevAlbum = (e?: React.MouseEvent) => {
                  if (e) e.stopPropagation();
                  setLandscapeAlbumIndex(prev => (prev - 1 + totalAlbums) % totalAlbums);
                };

                const handleNextAlbum = (e?: React.MouseEvent) => {
                  if (e) e.stopPropagation();
                  setLandscapeAlbumIndex(prev => (prev + 1) % totalAlbums);
                };

                return (
                  <div 
                    className="flex-1 flex flex-col justify-center items-center relative select-none w-full h-full min-h-0 px-2 sm:px-4"
                    onTouchStart={(e) => {
                      albumTouchStartXRef.current = e.touches[0].clientX;
                      albumTouchStartYRef.current = e.touches[0].clientY;
                      setIsAlbumSwiping(true);
                    }}
                    onTouchMove={(e) => {
                      if (!isAlbumSwiping) return;
                      const dx = e.touches[0].clientX - albumTouchStartXRef.current;
                      const dy = Math.abs(e.touches[0].clientY - albumTouchStartYRef.current);
                      if (Math.abs(dx) > dy) {
                        setAlbumSwipeOffset(dx);
                      }
                    }}
                    onTouchEnd={() => {
                      if (isAlbumSwiping) {
                        if (albumSwipeOffset < -40) {
                          handleNextAlbum();
                        } else if (albumSwipeOffset > 40) {
                          handlePrevAlbum();
                        }
                        setAlbumSwipeOffset(0);
                        setIsAlbumSwiping(false);
                      }
                    }}
                    onMouseDown={(e) => {
                      albumTouchStartXRef.current = e.clientX;
                      setIsAlbumSwiping(true);
                    }}
                    onMouseMove={(e) => {
                      if (!isAlbumSwiping) return;
                      const dx = e.clientX - albumTouchStartXRef.current;
                      setAlbumSwipeOffset(dx);
                    }}
                    onMouseUp={() => {
                      if (isAlbumSwiping) {
                        if (albumSwipeOffset < -40) {
                          handleNextAlbum();
                        } else if (albumSwipeOffset > 40) {
                          handlePrevAlbum();
                        }
                        setAlbumSwipeOffset(0);
                        setIsAlbumSwiping(false);
                      }
                    }}
                    onMouseLeave={() => {
                      if (isAlbumSwiping) {
                        setAlbumSwipeOffset(0);
                        setIsAlbumSwiping(false);
                      }
                    }}
                  >
                    {/* Previous Album Button */}
                    <button
                      type="button"
                      onClick={handlePrevAlbum}
                      className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/80 hover:bg-earth-gold text-white hover:text-black border border-white/20 hover:border-earth-gold flex items-center justify-center transition-all shadow-xl active:scale-95 cursor-pointer backdrop-blur-md"
                      title="Vorig album"
                    >
                      <ChevronLeft className="w-6 h-6 -ml-0.5" />
                    </button>

                    {/* Next Album Button */}
                    <button
                      type="button"
                      onClick={handleNextAlbum}
                      className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/80 hover:bg-earth-gold text-white hover:text-black border border-white/20 hover:border-earth-gold flex items-center justify-center transition-all shadow-xl active:scale-95 cursor-pointer backdrop-blur-md"
                      title="Volgend album"
                    >
                      <ChevronRight className="w-6 h-6 ml-0.5" />
                    </button>

                    {/* Full Maximum Size Album Cover Showcase */}
                    <div className="w-full flex-1 flex items-center justify-center min-h-0 py-1 px-12 sm:px-16">
                      <motion.div
                        key={currentAlb.id || currentAlb.title}
                        initial={{ opacity: 0.7, scale: 0.95 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1, 
                          x: albumSwipeOffset 
                        }}
                        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                        onClick={() => {
                          setSelectedAlbum(currentAlb.title);
                          setPhase('list');
                        }}
                        className="relative cursor-pointer group flex items-center justify-center h-full max-h-[calc(100%-0.5rem)] max-w-full aspect-square"
                      >
                        {/* Subtle Vinyl Disc Peek Behind Cover */}
                        <div className="absolute -right-4 sm:-right-6 top-1/2 -translate-y-1/2 h-[90%] aspect-square rounded-full bg-[#111] border-2 border-[#333] shadow-2xl flex items-center justify-center group-hover:translate-x-3 transition-transform duration-500 pointer-events-none">
                          <div className="w-1/3 aspect-square rounded-full bg-earth-gold/60 border border-white/20 flex items-center justify-center">
                            <div className="w-1/3 aspect-square rounded-full bg-black" />
                          </div>
                        </div>

                        {/* Main Album Artwork Cover */}
                        <div className="relative z-10 h-full w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-black/90 border-2 border-earth-gold/60 shadow-[0_10px_40px_rgba(0,0,0,0.8)] group-hover:border-earth-gold transition-all duration-300">
                          <img
                            src={albumCover}
                            alt={currentAlb.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const title = (currentAlb.title || '').toLowerCase();
                              const fallback = title.includes('echo')
                                ? '/images/banner-boek-2.jpg'
                                : title.includes('geboorte')
                                ? '/images/banner-boek-1.jpg'
                                : '/images/banner-boek-3.jpg';
                              if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                target.src = fallback;
                              }
                            }}
                          />
                          {/* Subtle title pill and open hint */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 text-center">
                            <div className="text-[11px] font-bold uppercase tracking-widest text-earth-gold">
                              {currentAlb.title} ({t.albums.tracksCount(trackCount)})
                            </div>
                            <div className="text-xs font-serif font-bold text-white bg-black/70 backdrop-blur-sm px-3.5 py-1.5 rounded-full self-center border border-earth-gold/40 shadow-lg">
                              {t.albums.openAlbum}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Bottom Footer note (portrait only) */}
            {effectiveOrientation === 'portrait' && (
              <div className="pt-2 pb-1 text-center text-[11px] text-white/40 border-t border-white/10 mt-2">
                {t.albums.selectAlbumPrompt}
              </div>
            )}
          </div>
        )}

        {/* ---------------- 2. TRACKLIST VIEW ---------------- */}
        {phase === 'list' && (
          <div className={`relative z-20 flex flex-col h-full bg-gradient-to-b from-[#141210] via-[#1c1916] to-[#0d0b09] ${effectiveOrientation === 'landscape' ? 'p-2 sm:p-3 overflow-hidden' : 'overflow-y-auto custom-scrollbar p-4 sm:p-5'}`}>
            {/* Top Bar with Back to Albums button */}
            <div className={`flex items-center justify-between border-b border-white/10 ${effectiveOrientation === 'landscape' ? 'pb-1.5 mb-1.5' : 'pb-3 mb-3 sm:mb-4'}`}>
              <button
                type="button"
                onClick={() => setPhase('albums')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-earth-gold/15 hover:bg-earth-gold/25 text-earth-gold border border-earth-gold/40 text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.topNav.toAlbums}</span>
              </button>

              <div className="text-center min-w-0 px-2">
                <p className="text-[10px] uppercase tracking-widest text-earth-gold font-bold truncate">
                  {selectedAlbum || 'Muzikale Krabbels'}
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {areSubtitlesAvailableInCurrentView && (
                  <button
                    type="button"
                    onClick={() => setShowSubtitleMenu(true)}
                    className={`p-2 rounded-full border transition-all cursor-pointer shadow-md ${
                      subtitlesEnabled
                        ? 'border-earth-gold/60 bg-earth-gold/20 text-earth-gold hover:bg-earth-gold/30'
                        : 'border-white/10 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white'
                    }`}
                    title={t.player.subtitlesTitle(subtitlesEnabled, subtitleLang)}
                  >
                    <Subtitles className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleShareTrack()}
                  className="p-2 rounded-full border border-earth-gold/30 hover:border-earth-gold bg-earth-gold/10 hover:bg-earth-gold/20 text-earth-gold hover:text-amber-300 cursor-pointer transition-all shadow-md"
                  title={t.topNav.shareTrack}
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleBrowserFullscreen}
                  className="p-2 rounded-full border transition-all bg-white/10 hover:bg-white/20 border-white/10 text-white cursor-pointer"
                  title={isBrowserFullscreen ? t.topNav.fullscreenExit : t.topNav.fullscreenEnter}
                >
                  {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                {!isMobileDevice && desktopViewMode === 'fullscreen' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDesktopViewMode('iphone');
                      if (isBrowserFullscreen) toggleBrowserFullscreen();
                    }}
                    className="p-2 rounded-full border transition-all bg-white/10 hover:bg-white/20 border-white/10 text-white cursor-pointer shadow-sm"
                    title={t.desktop.backToSimulator}
                  >
                    <Minimize2 className="w-4 h-4 text-earth-gold" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleOrientation}
                  className="p-2 rounded-full border transition-all bg-white/10 hover:bg-white/20 border-white/10 text-white cursor-pointer"
                  title={t.topNav.rotateScreen}
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Layout container: In landscape mode, full-bleed landscape photo with track title */}
            {(() => {
              const matchingAlbum = albums.find(a => a.title.toLowerCase() === (selectedAlbum || '').toLowerCase());
              const albumCover = getAlbumCover(matchingAlbum, currentAlbumTracks);

              return effectiveOrientation === 'landscape' ? (
                /* Landscape mode: Full-Height & Full-Width Landscape Track View */
                (() => {
                  const totalTracksInList = currentAlbumTracks.length || 1;
                  const safeTrackIdx = ((landscapeTrackInListIndex % totalTracksInList) + totalTracksInList) % totalTracksInList;
                  const currentTrackInList = currentAlbumTracks[safeTrackIdx] || currentAlbumTracks[0];
                  if (!currentTrackInList) return null;

                  const masterIdx = tracks.findIndex(t => t.id === currentTrackInList.id);
                  const playIdx = masterIdx !== -1 ? masterIdx : safeTrackIdx;
                  const isSelected = currentTrackIndex === playIdx;
                  const isTrackActiveAndPlaying = isSelected && isPlaying;
                  const trackArtwork = currentTrackInList.landscapeJpg || currentTrackInList.portraitJpg || currentTrackInList.thumbnailJpg || albumCover;

                  const handlePrevTrackInList = (e?: React.MouseEvent) => {
                    if (e) e.stopPropagation();
                    setLandscapeTrackInListIndex(prev => (prev - 1 + totalTracksInList) % totalTracksInList);
                  };

                  const handleNextTrackInList = (e?: React.MouseEvent) => {
                    if (e) e.stopPropagation();
                    setLandscapeTrackInListIndex(prev => (prev + 1) % totalTracksInList);
                  };

                  return (
                    <div 
                      className="flex-1 flex flex-col justify-between items-center relative select-none w-full h-full min-h-0 px-2 sm:px-4"
                      onTouchStart={(e) => {
                        trackListTouchStartXRef.current = e.touches[0].clientX;
                        trackListTouchStartYRef.current = e.touches[0].clientY;
                        setIsTrackListSwiping(true);
                      }}
                      onTouchMove={(e) => {
                        if (!isTrackListSwiping) return;
                        const dx = e.touches[0].clientX - trackListTouchStartXRef.current;
                        const dy = Math.abs(e.touches[0].clientY - trackListTouchStartYRef.current);
                        if (Math.abs(dx) > dy) {
                          setTrackListSwipeOffset(dx);
                        }
                      }}
                      onTouchEnd={() => {
                        if (isTrackListSwiping) {
                          if (trackListSwipeOffset < -40) {
                            handleNextTrackInList();
                          } else if (trackListSwipeOffset > 40) {
                            handlePrevTrackInList();
                          }
                          setTrackListSwipeOffset(0);
                          setIsTrackListSwiping(false);
                        }
                      }}
                      onMouseDown={(e) => {
                        trackListTouchStartXRef.current = e.clientX;
                        setIsTrackListSwiping(true);
                      }}
                      onMouseMove={(e) => {
                        if (!isTrackListSwiping) return;
                        const dx = e.clientX - trackListTouchStartXRef.current;
                        setTrackListSwipeOffset(dx);
                      }}
                      onMouseUp={() => {
                        if (isTrackListSwiping) {
                          if (trackListSwipeOffset < -40) {
                            handleNextTrackInList();
                          } else if (trackListSwipeOffset > 40) {
                            handlePrevTrackInList();
                          }
                          setTrackListSwipeOffset(0);
                          setIsTrackListSwiping(false);
                        }
                      }}
                      onMouseLeave={() => {
                        if (isTrackListSwiping) {
                          setTrackListSwipeOffset(0);
                          setIsTrackListSwiping(false);
                        }
                      }}
                    >
                      {/* Previous Track Button */}
                      {totalTracksInList > 1 && (
                        <button
                          type="button"
                          onClick={handlePrevTrackInList}
                          className="absolute left-1 md:left-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/80 hover:bg-earth-gold text-white hover:text-black border border-white/20 hover:border-earth-gold flex items-center justify-center transition-all shadow-2xl active:scale-95 cursor-pointer backdrop-blur-md"
                          title="Vorig nummer"
                        >
                          <ChevronLeft className="w-6 h-6 -ml-0.5" />
                        </button>
                      )}

                      {/* Next Track Button */}
                      {totalTracksInList > 1 && (
                        <button
                          type="button"
                          onClick={handleNextTrackInList}
                          className="absolute right-1 md:right-3 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/80 hover:bg-earth-gold text-white hover:text-black border border-white/20 hover:border-earth-gold flex items-center justify-center transition-all shadow-2xl active:scale-95 cursor-pointer backdrop-blur-md"
                          title="Volgend nummer"
                        >
                          <ChevronRight className="w-6 h-6 ml-0.5" />
                        </button>
                      )}

                      {/* Full Landscape Track Artwork Showcase between top and bottom bars */}
                      <div className="w-full flex-1 flex items-center justify-center min-h-0 px-8 sm:px-12 py-1">
                        <motion.div
                          key={currentTrackInList.id || currentTrackInList.title}
                          initial={{ opacity: 0.6, scale: 0.98 }}
                          animate={{ 
                            opacity: 1, 
                            scale: 1, 
                            x: trackListSwipeOffset 
                          }}
                          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                          onClick={() => playTrack(playIdx)}
                          className="w-full h-full max-h-full rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-2xl border-2 border-earth-gold/40 hover:border-earth-gold transition-all cursor-pointer group bg-black/90 flex flex-col justify-between"
                        >
                          {/* Full Landscape Photo Covering Available Container */}
                          <img
                            src={trackArtwork}
                            alt={currentTrackInList.title}
                            className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 pointer-events-none"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = albumCover;
                            }}
                          />

                          {/* Gradient Vignette for High Legibility */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60 pointer-events-none" />

                          {/* Top Row Overlay: Track Index & Play Indicator */}
                          <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between pointer-events-none">
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-earth-gold border border-earth-gold/40 text-xs sm:text-sm font-bold uppercase tracking-wider shadow-lg">
                                Track {safeTrackIdx + 1} / {totalTracksInList}
                              </span>
                            </div>

                            {/* Play or Equalizer Pulse Badge */}
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 backdrop-blur-md border border-earth-gold/60 text-earth-gold flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:bg-earth-gold group-hover:text-black transition-all">
                              {isTrackActiveAndPlaying ? (
                                <div className="flex items-end gap-1 h-5">
                                  <span className="w-1 bg-current animate-bounce h-full" style={{ animationDelay: '0ms' }} />
                                  <span className="w-1 bg-current animate-bounce h-full" style={{ animationDelay: '150ms' }} />
                                  <span className="w-1 bg-current animate-bounce h-full" style={{ animationDelay: '300ms' }} />
                                </div>
                              ) : (
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                              )}
                            </div>
                          </div>

                          {/* Bottom Row Overlay: Track Title and Artist */}
                          <div className="relative z-10 p-3 sm:p-5 flex flex-col items-start gap-1 pointer-events-none">
                            <h3 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-wide drop-shadow-md">
                              {currentTrackInList.title}
                            </h3>
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <p className="text-xs sm:text-sm text-earth-light font-medium drop-shadow-sm">
                                {matchingAlbum?.artist || 'Paul van Geenen'}
                              </p>
                              <span className="px-2 py-0.5 rounded-md bg-earth-gold/20 text-earth-gold border border-earth-gold/30 text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm">
                                <Music2 className="w-3 h-3" />
                                <span>Muziek</span>
                              </span>
                              {currentTrackInList.audiobook && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-500/30 text-blue-200 border border-blue-400/30 text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm">
                                  <Headphones className="w-3 h-3" />
                                  <span>Audiobook</span>
                                </span>
                              )}
                              {currentTrackInList.reflection && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/30 text-amber-200 border border-amber-400/30 text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm">
                                  <BookOpen className="w-3 h-3" />
                                  <span>Reflectie</span>
                                </span>
                              )}
                              {currentTrackInList.videoMov && (
                                <span className="px-2 py-0.5 rounded-md bg-purple-500/30 text-purple-200 border border-purple-400/30 text-[10px] font-medium flex items-center gap-1 backdrop-blur-sm">
                                  <Film className="w-3 h-3" />
                                  <span>Video</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                /* Portrait Mode: Full Stack Layout */
                <>
                  {/* Album Header Showcase with Full, Clearly Visible Album Cover */}
                  <div className="flex flex-col items-center text-center mb-6 pt-1">
                    {/* Full Album Cover: Clearly and Fully Visible */}
                    <div className="relative w-48 h-48 sm:w-56 sm:h-56 max-w-[80vw] rounded-2xl overflow-hidden bg-black/80 border-2 border-earth-gold/50 shadow-2xl shadow-black/80">
                      <img
                        src={albumCover}
                        alt={selectedAlbum || 'Album'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = logoHeader;
                        }}
                      />
                    </div>

                    {/* Album Details */}
                    <div className="mt-3.5 space-y-1">
                      <h3 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-wide">
                        {selectedAlbum || 'Muzikale Krabbels'}
                      </h3>
                      <p className="text-xs sm:text-sm text-earth-light/80 font-medium">
                        {matchingAlbum?.artist || 'Paul van Geenen'}
                      </p>
                      <span className="inline-block px-3 py-0.5 rounded-full bg-earth-gold/15 text-earth-gold border border-earth-gold/30 text-[11px] font-bold mt-1">
                        {currentAlbumTracks.length} {t.tracklist.tracksCount(currentAlbumTracks.length)}
                      </span>
                    </div>
                  </div>

                  {/* Track List: Responsive Grid in Portrait Mode (1 col on mobile, 2 col on tablet, 3 col on large screens) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 flex-1 pb-4">
                    <div className="flex items-center justify-between mb-1 px-1 col-span-full">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-white/50">
                        {t.tracklist.tracksHeader(currentAlbumTracks.length)}
                      </h4>
                    </div>
                    
                    {currentAlbumTracks.map((track, trackIdx) => {
                      const masterIdx = tracks.findIndex(t => t.id === track.id);
                      const playIdx = masterIdx !== -1 ? masterIdx : trackIdx;
                      const isSelected = currentTrackIndex === playIdx;
                      const trackArtwork = getTrackCoverJpg(track) || track.portraitJpg || track.thumbnailJpg || track.landscapeJpg || albumCover;

                      return (
                        <div
                          key={track.id}
                          onClick={() => playTrack(playIdx)}
                          className={`group relative w-full max-w-sm mx-auto aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-300 cursor-pointer shadow-2xl bg-black/90 active:scale-[0.98] ${
                            isSelected 
                              ? 'border-earth-gold ring-2 ring-earth-gold/40 shadow-earth-gold/20' 
                              : 'border-white/10 hover:border-earth-gold/60'
                          }`}
                        >
                          {/* Ambient blur for soft glow and graceful framing */}
                          <img
                            src={trackArtwork}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-30 pointer-events-none"
                          />

                          {/* Full track cover image */}
                          <img
                            src={trackArtwork}
                            alt={track.title}
                            className="relative z-10 w-full h-full object-contain p-1.5 sm:p-2.5 group-hover:scale-105 transition-transform duration-500 pointer-events-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (albumCover && target.src !== albumCover) {
                                target.src = albumCover;
                              }
                            }}
                          />

                          {/* Playing State Indicator Badge */}
                          {isSelected && isPlaying && (
                            <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-earth-gold/60 flex items-center gap-1.5 shadow-xl">
                              <div className="flex items-end gap-0.5 h-3 text-earth-gold">
                                <span className="w-1 bg-current rounded-full animate-bounce h-full" style={{ animationDelay: '0ms' }} />
                                <span className="w-1 bg-current rounded-full animate-bounce h-2/3" style={{ animationDelay: '150ms' }} />
                                <span className="w-1 bg-current rounded-full animate-bounce h-4/5" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* Bottom Footer note (portrait only) */}
            {effectiveOrientation === 'portrait' && (
              <div className="pt-4 pb-2 text-center text-[11px] text-white/40 border-t border-white/10 mt-4">
                Selecteer een nummer om de visuele speler te starten
              </div>
            )}
          </div>
        )}

        {/* ---------------- 3. IMMERSIVE PLAYER VIEW ---------------- */}
        {phase === 'player' && (
          <div 
            className="relative w-full h-full overflow-hidden bg-black flex flex-col justify-between touch-none select-none cursor-grab active:cursor-grabbing"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {/* Background Image Layer: Ribbon Filmstrip of previous, current, and next track (Pure physical slide, ZERO opacity fade) */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-black">
              {/* Left Panel: Previous Track Image */}
              {prevBgImage && (
                <div
                  className="absolute inset-0 w-full h-full overflow-hidden"
                  style={{
                    transform: `translateX(calc(-100% + ${dragX}px))`,
                    transition: isSwipingRelease ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
                  }}
                >
                  <img
                    src={prevBgImage}
                    alt={prevTrack?.title || 'Previous track'}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* End-of-track cinematic fade: fade to black, switch track, then fade the new image in */}
              <motion.div
                initial={false}
                animate={{ opacity: endTransitionPhase === 'fadingOut' ? 1 : 0 }}
                transition={{
                  duration: (endTransitionPhase === 'fadingOut' ? END_FADE_OUT_MS : END_FADE_IN_MS) / 1000,
                  ease: [0.45, 0, 0.55, 1]
                }}
                className="absolute inset-0 w-full h-full bg-black z-20 pointer-events-none"
              />

              {/* Center Panel: Current Track Image (Always rendered solid at z-10 for seamless cross-dissolve) */}
              {currBgImage && (
                <div
                  className="absolute inset-0 w-full h-full overflow-hidden z-10"
                  style={{
                    transform: `translateX(${dragX}px)`,
                    transition: isSwipingRelease ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
                  }}
                >
                  <img
                    src={currBgImage}
                    alt={currentTrack?.title || 'Current track'}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      const fallback = effectiveOrientation === 'landscape'
                        ? (currentTrack?.portraitJpg || startupLandscape || startupPortrait)
                        : (currentTrack?.landscapeJpg || startupPortrait);
                      if (fallback && target.src !== fallback) {
                        target.src = fallback;
                      }
                    }}
                  />
                </div>
              )}

              {/* Right Panel: Next Track Image */}
              {nextBgImage && (
                <div
                  className="absolute inset-0 w-full h-full overflow-hidden"
                  style={{
                    transform: `translateX(calc(100% + ${dragX}px))`,
                    transition: isSwipingRelease ? 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
                  }}
                >
                  <img
                    src={nextBgImage}
                    alt={nextTrack?.title || 'Next track'}
                    className="w-full h-full object-cover select-none pointer-events-none"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Persistent Video Player: Stays continuously mounted across swiping gestures to eliminate black flickering */}
              <div
                className={`absolute inset-0 w-full h-full overflow-hidden z-10 flex items-center justify-center bg-transparent pointer-events-none ${
                  effectiveFormat === 'video' && currentMediaUrl ? 'opacity-100' : 'opacity-0'
                }`}
                style={{
                  transform: (isSwiping || isSwipingRelease) ? `translateX(${dragX}px)` : 'none',
                  transition: isSwipingRelease ? 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)' : 'none'
                }}
              >
                <video
                  ref={videoRef}
                  playsInline
                  preload="auto"
                  className={`w-full h-full ${effectiveOrientation === 'portrait' ? 'object-cover' : 'object-contain'} bg-transparent`}
                  onTimeUpdate={() => {
                    if (effectiveFormat === 'video') handleMediaTimeUpdate(videoRef.current);
                  }}
                  onCanPlay={() => {
                    if (videoRef.current && (shouldAutoPlayRef.current || isDirectVideoRequested.current) && effectiveFormat === 'video') {
                      shouldAutoPlayRef.current = false;
                      isDirectVideoRequested.current = false;
                      startPlaybackWithVolumeRamp(videoRef.current);
                    }
                  }}
                  onLoadedData={() => {
                    if (videoRef.current && (shouldAutoPlayRef.current || isDirectVideoRequested.current) && effectiveFormat === 'video') {
                      shouldAutoPlayRef.current = false;
                      isDirectVideoRequested.current = false;
                      startPlaybackWithVolumeRamp(videoRef.current);
                    }
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current && effectiveFormat === 'video') {
                      if (savedTimeRef.current > 0) {
                        videoRef.current.currentTime = savedTimeRef.current;
                      }
                      if (shouldAutoPlayRef.current || isDirectVideoRequested.current) {
                        shouldAutoPlayRef.current = false;
                        isDirectVideoRequested.current = false;
                        startPlaybackWithVolumeRamp(videoRef.current);
                      }
                    }
                  }}
                  onEnded={() => {
                    if (effectiveFormat === 'video') handleTrackEnded();
                  }}
                  onPlay={() => {
                    if (effectiveFormat === 'video') setIsPlaying(true);
                  }}
                  onPause={() => {
                    if (effectiveFormat === 'video') setIsPlaying(false);
                  }}
                />
              </div>

              {/* Fallback gradient for contrast when UI is visible; hidden during swipe so ONLY cover images show */}
              <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/60 z-[1] transition-opacity duration-300 ${(isSwiping || !showNavBar) ? 'opacity-0' : 'opacity-100'}`} />
            </div>

            {/* Kobo-style Left Vertical Volume Toast Indicator */}
            <AnimatePresence>
              {showVolumeToast && (
                <motion.div
                  initial={{ opacity: 0, x: -20, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.9 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="absolute top-1/2 left-3 sm:left-5 -translate-y-1/2 h-[80%] z-50 bg-black/85 border border-earth-gold/50 backdrop-blur-md px-3 py-4 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.85)] flex flex-col items-center justify-between text-white pointer-events-none select-none"
                >
                  {/* Top Volume Icon */}
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-red-400 shrink-0" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-5 h-5 text-amber-300 shrink-0" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-earth-gold shrink-0" />
                  )}

                  {/* Vertical Volume Bar Fill (Takes 80% screen height proportion) */}
                  <div className="w-3 flex-1 my-2 bg-white/20 rounded-full overflow-hidden relative flex flex-col justify-end p-0.5 border border-white/10">
                    <div 
                      className="w-full bg-gradient-to-t from-earth-gold via-amber-300 to-yellow-100 rounded-full transition-all duration-75 shadow-[0_0_10px_rgba(212,170,63,0.8)]"
                      style={{ height: `${isMuted ? 0 : Math.round(volume * 100)}%` }}
                    />
                  </div>

                  {/* Percentage Label */}
                  <span className="text-[10px] sm:text-[11px] font-mono font-bold text-earth-gold shrink-0">
                    {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loop Toast Notification Overlay */}
            <AnimatePresence>
              {loopToast && (
                <motion.div
                  initial={{ opacity: 0, y: -15, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-black/85 border border-earth-gold/40 text-earth-gold backdrop-blur-md px-4 py-2 rounded-full text-xs font-medium shadow-2xl flex items-center gap-2 pointer-events-none"
                >
                  {loopMode === 'one' ? <Repeat1 className="w-4 h-4 text-amber-300" /> : <Repeat className="w-4 h-4 text-earth-gold" />}
                  <span>{loopToast}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Share Toast Notification Overlay */}
            <AnimatePresence>
              {shareToast && (
                <motion.div
                  initial={{ opacity: 0, y: -15, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.9 }}
                  transition={{ duration: 0.25 }}
                  className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-earth-gold/60 text-earth-gold backdrop-blur-md px-4 py-2 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 pointer-events-none"
                >
                  <Share2 className="w-4 h-4 text-earth-gold" />
                  <span>{shareToast}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Thumbs Up & Thumbs Down rating buttons overlay vertically centered along the right edge of the screen */}
            <AnimatePresence>
              {showRatingButtons && !isSwiping && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2.5 bg-black/60 backdrop-blur-md p-1.5 sm:p-2 rounded-full border border-white/20 shadow-2xl"
                  onClick={(e) => { e.stopPropagation(); resetRatingButtonsTimer(); }}
                  onTouchStart={(e) => { e.stopPropagation(); resetRatingButtonsTimer(); }}
                  onTouchMove={(e) => { e.stopPropagation(); }}
                  onTouchEnd={(e) => { e.stopPropagation(); }}
                  onMouseDown={(e) => { e.stopPropagation(); }}
                  onMouseMove={(e) => { e.stopPropagation(); }}
                  onMouseUp={(e) => { e.stopPropagation(); }}
                  onPointerDown={(e) => { e.stopPropagation(); }}
                  onPointerUp={(e) => { e.stopPropagation(); }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetRatingButtonsTimer();
                      handleRating('up');
                    }}
                    onTouchStart={(e) => { e.stopPropagation(); resetRatingButtonsTimer(); }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      resetRatingButtonsTimer();
                      handleRating('up');
                    }}
                    onMouseDown={(e) => { e.stopPropagation(); }}
                    onMouseUp={(e) => { e.stopPropagation(); }}
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    className={`p-2.5 sm:p-3 rounded-full transition-all cursor-pointer border active:scale-90 flex items-center justify-center ${
                      userRating === 'up'
                        ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-900/50'
                        : 'bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20'
                    }`}
                    title="Vind ik leuk (Duimpje omhoog)"
                  >
                    <ThumbsUp className={`w-5 h-5 sm:w-6 sm:h-6 pointer-events-none ${userRating === 'up' ? 'fill-current text-emerald-300' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      resetRatingButtonsTimer();
                      handleRating('down');
                    }}
                    onTouchStart={(e) => { e.stopPropagation(); resetRatingButtonsTimer(); }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      resetRatingButtonsTimer();
                      handleRating('down');
                    }}
                    onMouseDown={(e) => { e.stopPropagation(); }}
                    onMouseUp={(e) => { e.stopPropagation(); }}
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    className={`p-2.5 sm:p-3 rounded-full transition-all cursor-pointer border active:scale-90 flex items-center justify-center ${
                      userRating === 'down'
                        ? 'bg-rose-500/30 border-rose-400 text-rose-300 shadow-lg shadow-rose-900/50'
                        : 'bg-white/10 border-white/20 text-white/70 hover:text-white hover:bg-white/20'
                    }`}
                    title="Vind ik niet leuk (Duimpje omlaag)"
                  >
                    <ThumbsDown className={`w-5 h-5 sm:w-6 sm:h-6 pointer-events-none ${userRating === 'down' ? 'fill-current text-rose-300' : ''}`} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Top Bar overlay (fades in/out on tap, strictly hidden when swiping) */}
            <AnimatePresence>
              {showNavBar && !isSwiping && !isSwipingRelease && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.25 }}
                  className="relative z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
                  onClick={(e) => { e.stopPropagation(); resetNavBarTimer(); }}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPhase('albums')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/20 backdrop-blur-md text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
                      title={t.topNav.albumsTitle}
                    >
                      <Disc3 className="w-3.5 h-3.5 text-earth-gold" />
                      <span>{t.topNav.toAlbums}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhase('list')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-earth-gold/20 hover:bg-earth-gold/30 text-earth-gold border border-earth-gold/40 backdrop-blur-md text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                      title={t.topNav.tracksTitle}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>{t.topNav.toTracks}</span>
                    </button>
                  </div>

                  {effectiveOrientation !== 'portrait' ? (
                    <div className="text-center min-w-0 px-2 flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-earth-gold font-bold truncate">
                        {currentTrack?.album || 'Muzikale Krabbels'}
                      </p>
                      <h3 className="text-sm font-serif text-white truncate">{currentTrack?.title}</h3>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0" />
                  )}

                  <div className="flex items-center gap-2">
                    {/* Subtitles CC Button in Top Bar (Only visible in landscape mode when subtitles are available) */}
                    {areSubtitlesAvailableInCurrentView && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetNavBarTimer();
                          setShowSubtitleMenu(prev => !prev);
                        }}
                        className={`p-2 rounded-full border backdrop-blur-md transition-all cursor-pointer shadow-sm flex items-center justify-center ${
                          subtitlesEnabled
                            ? 'bg-earth-gold/20 border-earth-gold/60 text-earth-gold shadow-earth-gold/10'
                            : 'bg-white/10 hover:bg-white/20 border-white/10 text-white/50 hover:text-white'
                        }`}
                        title={t.player.subtitlesTitle(subtitlesEnabled, activeSubtitleLang)}
                      >
                        <Subtitles className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShareTrack();
                      }}
                      className="p-2 rounded-full bg-earth-gold/20 hover:bg-earth-gold/30 text-earth-gold border border-earth-gold/40 backdrop-blur-md transition-all cursor-pointer shadow-md"
                      title={t.topNav.shareTrack}
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    {/* Equalizer / Klank Instellingen Knop */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowEqualizerModal(true);
                      }}
                      className={`p-2 rounded-full backdrop-blur-md transition-all cursor-pointer border ${
                        equalizerPrefs.enabled && equalizerPrefs.presetId !== 'flat'
                          ? 'bg-earth-gold/25 border-earth-gold/60 text-earth-gold shadow-md'
                          : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/80 hover:text-white'
                      }`}
                      title={t.player.eqTitle(equalizerPrefs.enabled, equalizerPrefs.presetId)}
                    >
                      <SlidersHorizontal className="w-4 h-4 text-earth-gold" />
                    </button>
                    <button
                      type="button"
                      onClick={toggleBrowserFullscreen}
                      className="p-2 rounded-full backdrop-blur-md transition-all bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                      title={isBrowserFullscreen ? t.topNav.fullscreenExit : t.topNav.fullscreenEnter}
                    >
                      {isBrowserFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    {!isMobileDevice && desktopViewMode === 'fullscreen' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDesktopViewMode('iphone');
                          if (isBrowserFullscreen) toggleBrowserFullscreen();
                        }}
                        className="p-2 rounded-full backdrop-blur-md transition-all bg-white/10 hover:bg-white/20 border border-white/15 text-white cursor-pointer shadow-sm"
                        title={t.desktop.backToSimulator}
                      >
                        <Minimize2 className="w-4 h-4 text-earth-gold" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={toggleOrientation}
                      className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-all cursor-pointer"
                      title={t.topNav.rotateScreen}
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                    {SHOW_TEST_BUTTON && (
                      <button
                        type="button"
                        onClick={() => setShowTestModal(true)}
                        className="px-2.5 py-1.5 rounded-full bg-earth-gold/20 hover:bg-earth-gold/30 text-earth-gold border border-earth-gold/40 backdrop-blur-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow"
                        title="Test knoppen zichtbaarheid"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>Test</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live Synchronized Subtitle / Lyrics Overlay (Supported in both Portrait & Landscape) */}
            {subtitlesEnabled && areSubtitlesAvailableInCurrentView && !isSwiping && !isSwipingRelease && (
              <div
                className={`absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none text-center px-3 sm:px-4 md:px-6 w-[96vw] max-w-[94vw] flex items-end justify-center transition-[bottom] duration-300 ease-out ${
                  effectiveOrientation === 'portrait'
                    ? (showNavBar ? 'bottom-32 sm:bottom-36' : 'bottom-16 sm:bottom-20')
                    : (showNavBar
                        ? 'bottom-20 sm:bottom-24'
                        : (desktopViewMode === 'fullscreen' || isBrowserFullscreen
                            ? 'bottom-6 sm:bottom-8 md:bottom-10 lg:bottom-12'
                            : 'bottom-3 sm:bottom-5'))
                }`}
              >
                <div
                  className="inline-block text-center select-none w-full max-w-full transition-opacity duration-150 ease-out"
                  style={{ opacity: currentCue?.text ? 1 : 0 }}
                >
                  <div
                    className="text-white font-sans font-bold tracking-normal leading-[1.35] text-center w-full select-none"
                    style={{
                      fontSize: (() => {
                        const isFs = desktopViewMode === 'fullscreen' || isBrowserFullscreen;
                        if (effectiveOrientation === 'portrait') {
                          if (subtitleSize === 'sm') return 'clamp(0.85rem, 3.4vw, 1.05rem)';
                          if (subtitleSize === 'lg') return 'clamp(1.2rem, 4.6vw, 1.45rem)';
                          if (subtitleSize === 'xl') return 'clamp(1.4rem, 5.4vw, 1.75rem)';
                          return 'clamp(1rem, 4vw, 1.25rem)';
                        }
                        if (subtitleSize === 'sm') {
                          return isFs ? 'clamp(0.85rem, 1.25vw, 1.25rem)' : 'clamp(0.7rem, 1.1vw, 0.95rem)';
                        }
                        if (subtitleSize === 'lg') {
                          return isFs ? 'clamp(1.3rem, 2.05vw, 2.05rem)' : 'clamp(1.05rem, 1.75vw, 1.55rem)';
                        }
                        if (subtitleSize === 'xl') {
                          return isFs ? 'clamp(1.6rem, 2.55vw, 2.65rem)' : 'clamp(1.3rem, 2.2vw, 1.95rem)';
                        }
                        // Default 'md'
                        return isFs ? 'clamp(1.05rem, 1.6vw, 1.6rem)' : 'clamp(0.85rem, 1.4vw, 1.2rem)';
                      })(),
                      textShadow: `
                        -2px -2px 0 #000,
                         0   -2px 0 #000,
                         2px -2px 0 #000,
                         2px  0   0 #000,
                         2px  2px 0 #000,
                         0    2px 0 #000,
                        -2px  2px 0 #000,
                        -2px  0   0 #000,
                        -1px -1px 0 #000,
                         1px -1px 0 #000,
                        -1px  1px 0 #000,
                         1px  1px 0 #000,
                         0 2px 8px rgba(0, 0, 0, 0.95),
                         0 4px 16px rgba(0, 0, 0, 0.9)
                      `.replace(/\s+/g, ' ').trim()
                    }}
                  >
                    {(currentCue?.text || '').split('\n').map((line, idx) => (
                      <span key={idx} className="block whitespace-normal sm:whitespace-pre-wrap">
                        {line.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Song & Album Title Overlay (Shows in both portrait & landscape on track start or rotation) */}
            <AnimatePresence>
              {Boolean(
                phase === 'player' &&
                currentTrack &&
                !isSwiping &&
                !isSwipingRelease &&
                (songCreditVisible || (currentTime >= 1.5 && currentTime <= 9.0))
              ) && (() => {
                const matchingAlbumObj = albums.find(a => a.id === selectedAlbum || a.title === currentTrack?.album);
                const songTitle = currentTrack.title ? `"${currentTrack.title}"` : '';
                const rawAlbum = currentTrack.album || matchingAlbumObj?.title || 'De Echo';
                const albumDisplay = rawAlbum === 'De Echo' ? 'De Echo Soundtrack' : rawAlbum;

                return (
                  <motion.div
                    key={`song-credit-${currentTrack.id}`}
                    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className={`absolute left-3 sm:left-4 md:left-6 z-40 pointer-events-none select-none max-w-[78%] sm:max-w-[300px] md:max-w-[340px] transition-all duration-300 ${
                      effectiveOrientation === 'portrait'
                        ? (showNavBar ? 'bottom-32 sm:bottom-36' : 'bottom-10 sm:bottom-12')
                        : (showNavBar
                            ? 'bottom-20 sm:bottom-24'
                            : (desktopViewMode === 'fullscreen' || isBrowserFullscreen
                                ? 'bottom-5 sm:bottom-7 md:bottom-8'
                                : 'bottom-4 sm:bottom-6 pb-[env(safe-area-inset-bottom,0px)]'))
                    }`}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3 bg-black/85 backdrop-blur-xl px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-earth-gold/35 shadow-[0_8px_24px_rgba(0,0,0,0.85)] ring-1 ring-black/50">
                      {/* Dangling Ivory Heart */}
                      <div className="shrink-0 -my-0.5">
                        <div className="animate-pendant-dangle w-5 h-6 sm:w-6 sm:h-7 md:w-7 md:h-8 flex items-center justify-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                          <IvoryHeartPendant size="sm" className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                      </div>

                      {/* Title & Album Text (Compact, Crisp, Balanced Typography) */}
                      <div className="min-w-0 flex-1">
                        {/* Song Title in Quotes */}
                        <p
                          className="text-earth-gold font-sans font-bold tracking-tight text-xs sm:text-sm md:text-base leading-snug truncate"
                          style={{
                            textShadow: '0 1px 3px #000, 0 0 8px rgba(0,0,0,0.9), 1px 1px 1px #000'
                          }}
                        >
                          {songTitle}
                        </p>

                        {/* Album Name */}
                        <p
                          className="text-white font-sans font-medium tracking-normal text-[10px] sm:text-xs md:text-xs leading-snug truncate mt-0.5 opacity-90"
                          style={{
                            textShadow: '0 1px 3px #000, 0 0 6px rgba(0,0,0,0.9), 1px 1px 1px #000'
                          }}
                        >
                          Album: {albumDisplay}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Autoplay Muted Floating Unmute Prompt */}
            <AnimatePresence>
              {isAutoplayMuted && effectiveFormat === 'video' && isPlaying && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        try {
                          equalizerEngine.resume();
                        } catch (err) {}
                        videoRef.current.muted = false;
                        setIsAutoplayMuted(false);
                        fadeToVolume(videoRef.current, volume, 400);
                      }
                    }}
                    className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/85 hover:bg-black text-earth-gold text-xs sm:text-sm font-semibold border border-earth-gold/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.85)] cursor-pointer transition-all hover:scale-105 active:scale-95"
                  >
                    <VolumeX className="w-4 h-4 text-earth-gold animate-pulse" />
                    <span>{musicLang === 'nl' ? 'Geluid aanzetten' : 'Unmute video'}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Subtitle Settings Popover Modal (Centered overlay, responsive and perfectly sized across mobile, desktop, iPad, landscape) */}
            <AnimatePresence>
              {showSubtitleMenu && (
                <div
                  className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm"
                  onClick={(e) => { e.stopPropagation(); setShowSubtitleMenu(false); }}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="w-full max-w-[340px] sm:max-w-[380px] max-h-[90%] overflow-y-auto custom-scrollbar bg-[#171412] border border-earth-gold/50 rounded-2xl p-4 sm:p-5 shadow-[0_16px_48px_rgba(0,0,0,0.95)] space-y-3.5 text-white"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Subtitles className="w-4 h-4 text-earth-gold" />
                        <h4 className="font-serif text-sm font-semibold text-earth-gold">{t.subtitlesModal.title}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowSubtitleMenu(false)}
                        className="p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title={t.subtitlesModal.close}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Current Track Status */}
                    {currentTrack && (
                      <div className="bg-white/5 rounded-xl p-2.5 border border-white/10 flex items-center justify-between text-xs">
                        <div className="min-w-0 pr-2">
                          <span className="text-white/50 text-[10px] uppercase tracking-wider block">{t.subtitlesModal.currentTrack}</span>
                          <span className="font-serif text-white font-medium truncate block">{currentTrack.title}</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                          hasSubtitles 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-white/10 text-white/40'
                        }`}>
                          {hasSubtitles ? `✓ ${t.subtitlesModal.srtAvailable}` : t.subtitlesModal.noSrt}
                        </span>
                      </div>
                    )}

                    {/* Toggle: Ondertitels Aan / Uit */}
                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10">
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-white">{t.subtitlesModal.toggleShow}</div>
                        <div className="text-[11px] text-white/50">{t.subtitlesModal.toggleDescription}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleSubtitles()}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                          subtitlesEnabled ? 'bg-earth-gold' : 'bg-white/20'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-black transition-transform ${
                            subtitlesEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    {/* Language Selection: GB vs NL with SVG flags */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-earth-light/70">{t.subtitlesModal.chooseLanguage}</label>
                      <div className="grid grid-cols-2 gap-2">
                        {/* GB - English */}
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectSubtitleLang('GB');
                            if (!subtitlesEnabled) handleToggleSubtitles(true);
                          }}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                            subtitleLang === 'GB'
                              ? 'bg-earth-gold/25 border-earth-gold text-white font-semibold shadow-inner'
                              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-center">
                            <UkFlag className="w-6 h-4" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span>{t.subtitlesModal.english}</span>
                            {subtitleLang === 'GB' && <Check className="w-3.5 h-3.5 text-earth-gold shrink-0" />}
                          </div>
                          {availableSubtitles.GB || availableSubtitles.EN ? (
                            <span className="text-[9px] text-emerald-400 font-mono mt-0.5 font-bold">{t.subtitlesModal.available}</span>
                          ) : (
                            <span className="text-[9px] text-white/40 font-mono mt-0.5">{t.subtitlesModal.notAvailable}</span>
                          )}
                        </button>

                        {/* NL - Dutch */}
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectSubtitleLang('NL');
                            if (!subtitlesEnabled) handleToggleSubtitles(true);
                          }}
                          className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                            subtitleLang === 'NL'
                              ? 'bg-earth-gold/25 border-earth-gold text-white font-semibold shadow-inner'
                              : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-center">
                            <NlFlag className="w-6 h-4" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span>{t.subtitlesModal.dutch}</span>
                            {subtitleLang === 'NL' && <Check className="w-3.5 h-3.5 text-earth-gold shrink-0" />}
                          </div>
                          {availableSubtitles.NL ? (
                            <span className="text-[9px] text-emerald-400 font-mono mt-0.5 font-bold">{t.subtitlesModal.available}</span>
                          ) : (
                            <span className="text-[9px] text-white/40 font-mono mt-0.5">{t.subtitlesModal.notAvailable}</span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Font Size Selection: Klein, Normaal, Groot, Extra groot */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-earth-light/70 flex items-center gap-1.5">
                          <Type className="w-3.5 h-3.5 text-earth-gold" />
                          <span>{t.subtitlesModal.fontSize}</span>
                        </label>
                        <span className="text-[10px] font-mono text-earth-gold font-semibold">
                          {subtitleSize === 'sm' && `${t.subtitlesModal.sizes.sm} (80%)`}
                          {subtitleSize === 'md' && `${t.subtitlesModal.sizes.md} (100%)`}
                          {subtitleSize === 'lg' && `${t.subtitlesModal.sizes.lg} (125%)`}
                          {subtitleSize === 'xl' && `${t.subtitlesModal.sizes.xl} (150%)`}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 p-1 bg-white/5 rounded-xl border border-white/10">
                        {[
                          { id: 'sm', label: t.subtitlesModal.sizes.sm, symbol: 'A⁻' },
                          { id: 'md', label: t.subtitlesModal.sizes.md, symbol: 'A' },
                          { id: 'lg', label: t.subtitlesModal.sizes.lg, symbol: 'A⁺' },
                          { id: 'xl', label: t.subtitlesModal.sizes.xl, symbol: 'A⁺⁺' },
                        ].map((item) => {
                          const isSelected = subtitleSize === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                handleSelectSubtitleSize(item.id as SubtitleSize);
                                if (!subtitlesEnabled) handleToggleSubtitles(true);
                              }}
                              className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-earth-gold text-black font-bold shadow-[0_2px_8px_rgba(212,175,55,0.4)] scale-[1.02]'
                                  : 'text-white/70 hover:text-white hover:bg-white/10'
                              }`}
                            >
                              <span className={`font-serif leading-none mb-0.5 ${
                                item.id === 'sm' ? 'text-xs' : item.id === 'md' ? 'text-sm' : item.id === 'lg' ? 'text-base font-bold' : 'text-lg font-bold'
                              }`}>
                                {item.symbol}
                              </span>
                              <span className="text-[9px] truncate tracking-tight">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Live interactive sample preview in modal */}
                      <div className="mt-2 px-3 py-2.5 rounded-xl bg-black/60 border border-white/10 text-center flex flex-col items-center justify-center min-h-[58px] overflow-hidden">
                        <span className="text-[9px] uppercase tracking-widest text-white/40 mb-1 font-mono">{t.subtitlesModal.livePreview}</span>
                        <div
                          className="text-white font-sans font-bold tracking-normal leading-snug text-center transition-all duration-200"
                          style={{
                            fontSize: subtitleSize === 'sm' ? '12px' : subtitleSize === 'md' ? '14.5px' : subtitleSize === 'lg' ? '17.5px' : '21px',
                            textShadow: `
                              -1.5px -1.5px 0 #000,
                               1.5px -1.5px 0 #000,
                              -1.5px  1.5px 0 #000,
                               1.5px  1.5px 0 #000,
                               0 2px 6px rgba(0, 0, 0, 0.95)
                            `.replace(/\s+/g, ' ').trim()
                          }}
                        >
                          {t.subtitlesModal.sampleText}
                        </div>
                      </div>
                    </div>

                    <p className="text-[10px] text-white/50 leading-relaxed border-t border-white/10 pt-2 text-center">
                      {t.subtitles.cookieNotice}
                    </p>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Bottom MP3 Navigation Bar (Format switcher, progress bar, play/pause controls, loop mode) */}
            <AnimatePresence>
              {showNavBar && !isSwiping && !isSwipingRelease && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  transition={{ duration: 0.25 }}
                  className="relative z-30 px-4 sm:px-5 pt-2 sm:pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black via-black/95 to-transparent space-y-2 shrink-0"
                  onClick={(e) => { e.stopPropagation(); resetNavBarTimer(); }}
                >
                  {/* Format/Version Switcher Pills (Top row of bottom bar, only shown if 2 or more formats exist) */}
                  {currentTrack && (
                    (() => {
                      const availableFormatsCount = [
                        currentTrack.mp3,
                        currentTrack.audiobook,
                        currentTrack.reflection,
                        currentTrack.videoMov
                      ].filter(Boolean).length;

                      if (availableFormatsCount <= 1) return null;

                      return (
                        <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-h-[32px]">
                          {currentTrack.mp3 && effectiveFormat !== 'mp3' && (
                            <button
                              type="button"
                              onClick={() => playTrack(currentTrackIndex, 'mp3')}
                              className="text-xs sm:text-sm px-3.5 py-1 rounded-full transition-all cursor-pointer font-medium bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/10 active:scale-95 shadow-sm"
                            >
                              {t.player.music}
                            </button>
                          )}

                          {currentTrack.audiobook && effectiveFormat !== 'audiobook' && (
                            <button
                              type="button"
                              onClick={() => playTrack(currentTrackIndex, 'audiobook')}
                              className="text-xs sm:text-sm px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer font-medium bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/10 active:scale-95 shadow-sm"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-amber-300" /> {t.player.audiobook}
                            </button>
                          )}

                          {currentTrack.reflection && effectiveFormat !== 'reflection' && (
                            <button
                              type="button"
                              onClick={() => playTrack(currentTrackIndex, 'reflection')}
                              className="text-xs sm:text-sm px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer font-medium bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/10 active:scale-95 shadow-sm"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-purple-300" /> {t.player.reflection}
                            </button>
                          )}

                          {currentTrack.videoMov && effectiveFormat !== 'video' && (
                            <button
                              type="button"
                              onClick={() => playTrack(currentTrackIndex, 'video')}
                              className="text-xs sm:text-sm px-3.5 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer font-medium bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/10 active:scale-95 shadow-sm"
                            >
                              <Video className="w-3.5 h-3.5 text-blue-300" /> {t.player.video}
                            </button>
                          )}
                        </div>
                      );
                    })()
                  )}

                  {/* Progress Seek Bar */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCurrentTime(val);
                        savedTimeRef.current = val;
                        if (selectedFormat === 'video' && videoRef.current) {
                          videoRef.current.currentTime = val;
                        } else {
                          const activeAudio = getActiveAudioEl();
                          if (activeAudio) activeAudio.currentTime = val;
                        }
                      }}
                      className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-earth-gold"
                    />
                    <div className="flex justify-between items-center text-[11px] font-mono text-white/60">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* Action buttons row: LIJST (loop button) & Subtitle (CC) Button side-by-side with identical size */}
                  <div className="flex items-center justify-start gap-2 pt-0.5 min-h-[32px]">
                    {/* LIJST / Loop Mode Button */}
                    <button
                      type="button"
                      onClick={cycleLoopMode}
                      className={`h-7.5 px-3 rounded-full transition-all cursor-pointer text-xs font-medium border shrink-0 active:scale-95 flex items-center gap-1.5 shadow-sm ${
                        loopMode === 'all'
                          ? 'bg-earth-gold/25 border-earth-gold/70 text-earth-gold font-semibold'
                          : loopMode === 'one'
                          ? 'bg-amber-400/25 border-amber-400/70 text-amber-300 font-semibold'
                          : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/70 hover:text-white'
                      }`}
                      title={loopMode === 'all' ? t.player.loopListTitle : loopMode === 'one' ? t.player.loopOneTitle : t.player.loopOffTitle}
                    >
                      {loopMode === 'one' ? (
                        <Repeat1 className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <Repeat className="w-3.5 h-3.5 text-earth-gold" />
                      )}
                      <span className="text-[10px] font-bold tracking-wider uppercase">
                        {loopMode === 'all' && t.player.loopList}
                        {loopMode === 'one' && t.player.loopOne}
                        {loopMode === 'off' && t.player.loopOff}
                      </span>
                    </button>

                    {/* Subtitle CC Button (Only visible in landscape mode when subtitles are available) */}
                    {areSubtitlesAvailableInCurrentView && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          resetNavBarTimer();
                          setShowSubtitleMenu(prev => !prev);
                        }}
                        className={`h-7.5 px-3 rounded-full transition-all cursor-pointer text-xs font-medium border shrink-0 active:scale-95 flex items-center gap-1.5 shadow-sm ${
                          subtitlesEnabled
                            ? 'bg-earth-gold/25 border-earth-gold/70 text-earth-gold font-semibold'
                            : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/70 hover:text-white'
                        }`}
                        title={t.player.ccTitle(subtitlesEnabled, activeSubtitleLang)}
                      >
                        <Subtitles className="w-3.5 h-3.5 text-earth-gold" />
                        <span className="text-[10px] font-mono font-bold tracking-wider uppercase">
                          {subtitlesEnabled ? `CC ${activeSubtitleLang}` : t.player.ccOff}
                        </span>
                      </button>
                    )}

                    {/* Equalizer (Klank) Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        resetNavBarTimer();
                        setShowEqualizerModal(true);
                      }}
                      className={`h-7.5 px-3 rounded-full transition-all cursor-pointer text-xs font-medium border shrink-0 active:scale-95 flex items-center gap-1.5 shadow-sm ${
                        equalizerPrefs.enabled && equalizerPrefs.presetId !== 'flat'
                          ? 'bg-earth-gold/25 border-earth-gold/70 text-earth-gold font-semibold'
                          : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/70 hover:text-white'
                      }`}
                      title={t.player.eqTitle(equalizerPrefs.enabled, equalizerPrefs.presetId)}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-earth-gold" />
                      <span className="text-[10px] font-mono font-bold tracking-wider uppercase">
                        {equalizerPrefs.enabled && equalizerPrefs.presetId !== 'flat'
                          ? equalizerPrefs.presetId === 'vocal' ? t.player.eqVocal : equalizerPrefs.presetId === 'acoustic' ? t.player.eqAcoustic : equalizerPrefs.presetId === 'bass' ? t.player.eqBass : `EQ ${equalizerPrefs.presetId.toUpperCase()}`
                          : 'EQ'}
                      </span>
                    </button>
                  </div>

                  {/* Main Controls Row: Prev, Play/Pause, Next & Ivory Heart Pendant (Identical & centered in both portrait and landscape) */}
                  <div className="flex items-center justify-between pt-1 w-full gap-2">
                    {/* Left: Home Button to close player and return to website homepage */}
                    <div className="flex-1 flex items-center justify-start">
                      <button
                        type="button"
                        onClick={handleCloseToHome}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/20 backdrop-blur-md text-xs font-semibold transition-all cursor-pointer active:scale-95 shadow-sm"
                        title={t.topNav.homeTitle}
                      >
                        <Home className="w-3.5 h-3.5 text-earth-gold" />
                        <span>{t.topNav.toHome}</span>
                      </button>
                    </div>

                    {/* Middle: Prev, Play/Pause, Next strictly centered */}
                    <div className="flex items-center justify-center gap-3 sm:gap-4 shrink-0">
                      <button
                        type="button"
                        onClick={handlePrev}
                        className="p-2 text-white/80 hover:text-white transition-all cursor-pointer active:scale-90"
                        title={t.player.prevTrack}
                      >
                        <SkipBack className="w-5 h-5 fill-current" />
                      </button>

                      <button
                        type="button"
                        onClick={togglePlayPause}
                        className="w-12 h-12 rounded-full bg-earth-gold hover:bg-earth-gold/90 text-black flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer shrink-0"
                        title={isPlaying ? t.player.pause : t.player.play}
                      >
                        {isPlaying ? (
                          <Pause className="w-5 h-5 fill-black" />
                        ) : (
                          <Play className="w-5 h-5 fill-black ml-0.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleNext}
                        className="p-2 text-white/80 hover:text-white transition-all cursor-pointer active:scale-90"
                        title={t.player.nextTrack}
                      >
                        <SkipForward className="w-5 h-5 fill-current" />
                      </button>
                    </div>

                    {/* Right: Ivory Heart Pendant prominently displayed in place of thumbs */}
                    <div className="flex-1 flex items-center justify-end shrink-0">
                      <IvoryHeartPendant size="md" className="w-14 h-14 sm:w-16 sm:h-16 pointer-events-none drop-shadow-xl" interactive={false} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Global Persistent Audio Decks (Deck A & Deck B) - enables true acoustic crossfading without mobile autoplay blocking */}
      <audio
        ref={audioRefA}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={() => {
          if (activeDeckRef.current === 'A') handleMediaTimeUpdate(audioRefA.current);
        }}
        onCanPlay={() => {
          if (activeDeckRef.current === 'A' && audioRefA.current && shouldAutoPlayRef.current && phase === 'player' && effectiveFormat !== 'video') {
            shouldAutoPlayRef.current = false;
            startPlaybackWithVolumeRamp(audioRefA.current);
          }
        }}
        onCanPlayThrough={() => {
          if (activeDeckRef.current === 'A' && audioRefA.current && shouldAutoPlayRef.current && phase === 'player' && effectiveFormat !== 'video') {
            shouldAutoPlayRef.current = false;
            startPlaybackWithVolumeRamp(audioRefA.current);
          }
        }}
        onLoadedData={() => {
          if (activeDeckRef.current === 'A' && audioRefA.current && shouldAutoPlayRef.current && phase === 'player' && effectiveFormat !== 'video') {
            shouldAutoPlayRef.current = false;
            startPlaybackWithVolumeRamp(audioRefA.current);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRefA.current && activeDeckRef.current === 'A') {
            if (savedTimeRef.current > 0) {
              audioRefA.current.currentTime = savedTimeRef.current;
            }
            if (shouldAutoPlayRef.current && phase === 'player' && effectiveFormat !== 'video') {
              shouldAutoPlayRef.current = false;
              startPlaybackWithVolumeRamp(audioRefA.current);
            }
          }
        }}
        onEnded={() => {
          if (activeDeckRef.current === 'A') handleTrackEnded();
        }}
        onPlay={() => {
          if (activeDeckRef.current === 'A') setIsPlaying(true);
        }}
        onPause={() => {
          if (activeDeckRef.current === 'A') setIsPlaying(false);
        }}
      />

      <audio
        ref={audioRefB}
        preload="auto"
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={() => {
          if (activeDeckRef.current === 'B') handleMediaTimeUpdate(audioRefB.current);
        }}
        onCanPlay={() => {
          if (activeDeckRef.current === 'B' && audioRefB.current && shouldAutoPlayRef.current && phase === 'player' && effectiveFormat !== 'video') {
            shouldAutoPlayRef.current = false;
            startPlaybackWithVolumeRamp(audioRefB.current);
          }
        }}
        onCanPlayThrough={() => {
          if (activeDeckRef.current === 'B' && audioRefB.current && shouldAutoPlayRef.current && phase === 'player' && effectiveFormat !== 'video') {
            shouldAutoPlayRef.current = false;
            startPlaybackWithVolumeRamp(audioRefB.current);
          }
        }}
        onLoadedData={() => {
          if (activeDeckRef.current === 'B' && audioRefB.current && shouldAutoPlayRef.current && phase === 'player' && effectiveFormat !== 'video') {
            shouldAutoPlayRef.current = false;
            startPlaybackWithVolumeRamp(audioRefB.current);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRefB.current && activeDeckRef.current === 'B') {
            if (savedTimeRef.current > 0) {
              audioRefB.current.currentTime = savedTimeRef.current;
            }
            if (shouldAutoPlayRef.current && phase === 'player' && effectiveFormat !== 'video') {
              shouldAutoPlayRef.current = false;
              startPlaybackWithVolumeRamp(audioRefB.current);
            }
          }
        }}
        onEnded={() => {
          if (activeDeckRef.current === 'B') handleTrackEnded();
        }}
        onPlay={() => {
          if (activeDeckRef.current === 'B') setIsPlaying(true);
        }}
        onPause={() => {
          if (activeDeckRef.current === 'B') setIsPlaying(false);
        }}
      />

      {/* Intro Audio element for startup splash */}
      <audio
        ref={introAudioRef}
        src={startupAudio || '/@music/intro.mp3'}
        preload="auto"
        playsInline
        onEnded={endStartupPhase}
        onError={(e) => {
          console.log('[Music] Startup intro.mp3 fallback note:', e);
        }}
      />

      {!isMobileDevice && desktopViewMode === 'iphone' ? (
        <div className="min-h-screen bg-[#0a0908] text-earth-light flex flex-col md:flex-row items-center justify-between p-6 md:p-12 gap-8 relative overflow-hidden">
          {/* Background Atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,163,115,0.1),transparent_50%)] pointer-events-none" />

        {/* Left Side: Desktop Control Panel & Info */}
        <div className="flex-1 max-w-xl space-y-6 z-10">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-4 h-4 text-earth-gold" />
              <span>{t.desktop.backToHome}</span>
            </Link>

            {/* 2-flag Language selector on desktop sidebar */}
            <LanguageSelector
              lang={musicLang}
              onSelect={setMusicLang}
              size="md"
            />
          </div>

          <div className="flex items-center gap-4">
            <h1 className="text-4xl lg:text-5xl font-serif text-white leading-tight">
              {t.desktop.title}
            </h1>
            <IvoryHeartPendant size="md" className="shrink-0 -mt-1" />
          </div>

          <p className="text-earth-light/70 text-sm leading-relaxed">
            {t.desktop.description}
          </p>

          {/* Controls to rotate iPhone & switch views */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4 backdrop-blur-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-earth-gold">{t.desktop.simulationControl}</h3>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={toggleOrientation}
                className="flex items-center gap-2 px-4 py-2.5 font-semibold rounded-xl transition-all shadow-md bg-earth-gold text-black hover:bg-earth-gold/90 cursor-pointer"
                title={t.topNav.rotateScreen}
              >
                <RotateCw className="w-4 h-4" />
                <span>{t.desktop.rotateIphone(orientation === 'portrait' ? t.desktop.standing : t.desktop.lying)}</span>
              </button>

              <button
                type="button"
                onClick={() => setDesktopViewMode('fullscreen')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all bg-white/10 hover:bg-white/20 text-white border-white/15 cursor-pointer shadow-md"
                title={t.desktop.fullscreenBtn}
              >
                <Maximize2 className="w-4 h-4" />
                <span>{t.desktop.fullscreenBtn}</span>
              </button>
            </div>

            <div className="text-xs text-earth-light/50 italic flex flex-wrap items-center gap-1.5">
              <span>{t.desktop.currentOrientation}: <strong className="text-white capitalize">{orientation === 'portrait' ? t.desktop.portraitLabel : t.desktop.landscapeLabel}</strong></span>
              <span>•</span>
              <span>{phase === 'startup' ? t.desktop.phaseStartup : phase === 'list' ? t.desktop.phaseList : t.desktop.phasePlayer}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Realistic iPhone Mockup Frame */}
        <div className="flex-1 flex items-center justify-center z-10 w-full">
          <motion.div 
            layout
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            className={`relative transition-all duration-500 shadow-2xl ${
              effectiveOrientation === 'portrait' 
                ? 'w-[370px] h-[740px]' 
                : 'w-[740px] h-[370px]'
            }`}
          >
            {/* Realistic iPhone Outer Frame */}
            <div className="absolute inset-0 bg-[#1c1c1e] rounded-[48px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] border-4 border-[#3a3a3c] flex flex-col">
              
              {/* Dynamic Island / Notch */}
              <div className={`absolute z-50 bg-black rounded-full flex items-center justify-center ${
                effectiveOrientation === 'portrait'
                  ? 'top-5 left-1/2 -translate-x-1/2 w-28 h-6'
                  : 'left-5 top-1/2 -translate-y-1/2 h-28 w-6'
              }`}>
                <div className="w-3 h-3 rounded-full bg-[#0a0a14] border border-white/10 mr-2" />
                <div className="w-2 h-2 rounded-full bg-[#121228]" />
              </div>

              {/* Screen Inner Display */}
              <div className="relative w-full h-full rounded-[38px] overflow-hidden bg-black border border-white/10">
                {renderScreenContent()}
              </div>

              {/* Home Bar Indicator */}
              <div className={`absolute z-50 bg-white/40 rounded-full ${
                effectiveOrientation === 'portrait'
                  ? 'bottom-4 left-1/2 -translate-x-1/2 w-32 h-1'
                  : 'right-4 top-1/2 -translate-y-1/2 h-32 w-1'
              }`} />
            </div>
          </motion.div>
        </div>
      </div>
      ) : (
        <div className="fixed inset-0 z-50 bg-black w-full h-full h-[100dvh] overflow-hidden">
          {renderScreenContent()}
        </div>
      )}

      {/* iOS Fullscreen & Browser Bar Guide Modal */}
      <AnimatePresence>
        {showIosFullscreenGuide && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowIosFullscreenGuide(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ duration: 0.22 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#181512] border border-earth-gold/40 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl text-earth-light space-y-4"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-earth-gold/15 text-earth-gold border border-earth-gold/30">
                    <Maximize2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-white">Volledig Scherm op iPhone</h3>
                    <p className="text-[11px] text-earth-light/60">Chrome & Safari adresbalk verbergen</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIosFullscreenGuide(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-earth-light/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-earth-light/80 leading-relaxed">
                <p className="text-[11.5px] text-earth-light/75">
                  Apple staat webbrowsers op de iPhone niet toe om de adresbalk automatisch via code te verbergen. U krijgt het scherm zo 100% schermvullend:
                </p>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-earth-gold/25 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-earth-gold text-xs">
                    <Share2 className="w-4 h-4 shrink-0 text-earth-gold" />
                    <span>Optie 1: Zet op beginscherm (Aanbevolen)</span>
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-earth-light/90">
                    <li>Tik op het <strong>Deel-icoon</strong> (of Chrome menu <strong className="text-white">•••</strong>)</li>
                    <li>Kies <strong className="text-earth-gold">"Zet op beginscherm"</strong> (Add to Home Screen)</li>
                    <li>Open de app vanaf uw beginscherm: <strong>100% fullscreen zonder enige browserbalk!</strong></li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-white text-xs">
                    <RotateCw className="w-4 h-4 shrink-0 text-earth-gold" />
                    <span>Optie 2: Draai telefoon horizontaal (Landscape)</span>
                  </div>
                  <p className="text-[11px] text-earth-light/70">
                    Draai uw iPhone op zijn kant voor breedbeeld. Chrome verbergt de adresbalk dan grotendeels automatisch.
                  </p>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowIosFullscreenGuide(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-earth-gold text-black font-semibold text-xs hover:bg-earth-gold/90 transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  Begrepen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Format Buttons Visibility Test Modal */}
      <AnimatePresence>
        {showTestModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowTestModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-[#181614] border border-earth-gold/40 rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4 text-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-earth-gold/20 text-earth-gold">
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-earth-gold font-serif">Test Knoppen Zichtbaarheid</h3>
                    <p className="text-[11px] text-white/60">Zichtbaarheidsanalyse op telefoonscherm</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
                  title="Sluiten"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current Track Context */}
              <div className="px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 font-medium">Geselecteerd nummer:</span>
                  <span className="font-serif font-bold text-earth-gold truncate max-w-[200px]">{currentTrack?.title || 'Geen'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-white/50 pt-1 border-t border-white/10">
                  <span>Server map:</span>
                  <span className="font-mono text-amber-200/80 truncate max-w-[220px]">
                    www.paulvangeenen.nl/@music/{currentTrack?.folderName || '...'}
                  </span>
                </div>
              </div>

              {/* Status List */}
              <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
                {/* Helper function to decode URL for display */}
                {(() => {
                  const cleanPath = (url?: string) => {
                    if (!url) return '';
                    const decoded = decodeURIComponent(url);
                    return `www.paulvangeenen.nl${decoded}`;
                  };
                  const folder = currentTrack?.folderName || '...';

                  return (
                    <>
                      {/* 1. Muziek (MP3) */}
                      <div className={`p-3 rounded-xl border ${currentTrack?.mp3 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 text-white">
                            <MusicIcon className="w-4 h-4 text-earth-gold" /> Muziek (MP3)
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${currentTrack?.mp3 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {currentTrack?.mp3 ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {currentTrack?.mp3 ? 'Zichtbaar' : 'Niet zichtbaar'}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-white/70 leading-relaxed">
                          {currentTrack?.mp3 
                            ? `Gevonden: ${cleanPath(currentTrack.mp3)}`
                            : `Geen MP3 audiobestand gevonden in www.paulvangeenen.nl/@music/${folder}/`}
                        </p>
                      </div>

                      {/* 2. Audiobook */}
                      <div className={`p-3 rounded-xl border ${currentTrack?.audiobook ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 text-white">
                            <BookOpen className="w-4 h-4 text-amber-400" /> Audiobook
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${currentTrack?.audiobook ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {currentTrack?.audiobook ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {currentTrack?.audiobook ? 'Zichtbaar' : 'Niet zichtbaar'}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-white/70 leading-relaxed">
                          {currentTrack?.audiobook 
                            ? `Gevonden: ${cleanPath(currentTrack.audiobook)}`
                            : `Gezochte filenaam: www.paulvangeenen.nl/@music/${folder}/...audiobook... (WAV/MP3)`}
                        </p>
                      </div>

                      {/* 3. Reflectie */}
                      <div className={`p-3 rounded-xl border ${currentTrack?.reflection ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 text-white">
                            <MessageCircle className="w-4 h-4 text-purple-400" /> Reflectie
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${currentTrack?.reflection ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {currentTrack?.reflection ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {currentTrack?.reflection ? 'Zichtbaar' : 'Niet zichtbaar'}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-white/70 leading-relaxed">
                          {currentTrack?.reflection 
                            ? `Gevonden (bevat "reflectie" in naam): ${cleanPath(currentTrack.reflection)}`
                            : `Gezochte filenaam: www.paulvangeenen.nl/@music/${folder}/ met "reflectie" of "reflection" in de naam (MP3/M4A)`}
                        </p>
                      </div>

                      {/* 4. Video */}
                      <div className={`p-3 rounded-xl border ${currentTrack?.videoMov ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 text-white">
                            <Video className="w-4 h-4 text-blue-400" /> Video
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${currentTrack?.videoMov ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {currentTrack?.videoMov ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {currentTrack?.videoMov ? 'Zichtbaar' : 'Niet zichtbaar'}
                          </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-white/70 leading-relaxed">
                          {currentTrack?.videoMov 
                            ? `Gevonden: ${cleanPath(currentTrack.videoMov)}`
                            : `Gezochte filenaam: www.paulvangeenen.nl/@music/${folder}/... .mov`}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Close button */}
              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowTestModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-earth-gold hover:bg-earth-gold/90 text-black font-bold text-xs transition-all cursor-pointer shadow-lg flex items-center gap-1.5"
                >
                  <span>Sluiten</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Share Track Modal Overlay */}
        {showShareModal && currentTrack && (
          <div
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowShareModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-[#1a1714] border border-earth-gold/40 rounded-3xl p-5 sm:p-6 max-w-sm w-full text-white shadow-[0_0_50px_rgba(0,0,0,0.9)] relative space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-full bg-earth-gold/20 text-earth-gold">
                    <Share2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-white leading-tight">{t.shareModal.title}</h3>
                    <p className="text-[11px] text-white/60">{t.shareModal.subtitle}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Track Preview Card */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/50 border border-white/10">
                  <img
                    src={getTrackBgImage(currentTrack, 'portrait')}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-earth-gold uppercase tracking-wider truncate">
                    {currentTrack.album ? `${currentTrack.album} • Track ${currentTrack.order || currentTrack.id}` : `Track ${currentTrack.order || currentTrack.id}`}
                  </div>
                  <div className="text-sm font-semibold text-white truncate">
                    {currentTrack.title}
                  </div>
                  <div className="text-[11px] text-white/60 capitalize flex items-center gap-1 mt-0.5">
                    <span>{t.shareModal.version}:</span>
                    <span className="text-amber-300 font-medium">{selectedFormat === 'mp3' ? t.shareModal.musicMp3 : selectedFormat}</span>
                  </div>
                </div>
              </div>

              {/* Clean URL Box */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-white/70 uppercase tracking-wider block">
                  {t.shareModal.linkLabel}:
                </label>
                <div className="p-3 rounded-xl bg-black/70 border border-earth-gold/30 text-xs font-mono text-earth-gold break-all flex items-center justify-between gap-2">
                  <span className="truncate select-all">{getCleanShareUrl(currentTrack, selectedFormat)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {/* Primary Action: Copy link to clipboard */}
                <button
                  type="button"
                  onClick={() => {
                    const cleanUrl = getCleanShareUrl(currentTrack, selectedFormat);
                    copyToClipboard(cleanUrl);
                    setCopiedLinkState(true);
                    setTimeout(() => setCopiedLinkState(false), 2500);
                  }}
                  className="w-full py-3 px-4 bg-earth-gold hover:bg-amber-400 text-black font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 cursor-pointer"
                >
                  {copiedLinkState ? (
                    <>
                      <Check className="w-4 h-4 text-black" />
                      <span>{t.shareModal.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-black" />
                      <span>{t.shareModal.copyLink}</span>
                    </>
                  )}
                </button>

                {/* Direct WhatsApp Share Button */}
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    musicLang === 'nl'
                      ? `Luister naar "${currentTrack.title}" (${currentTrack.album || 'Muzikale Krabbels'}) van Paul van Geenen:\n${getCleanShareUrl(currentTrack, selectedFormat)}`
                      : `Listen to "${currentTrack.title}" (${currentTrack.album || 'Musical Doodles'}) by Paul van Geenen:\n${getCleanShareUrl(currentTrack, selectedFormat)}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95"
                >
                  <MessageCircle className="w-4 h-4 fill-current" />
                  <span>{t.shareModal.whatsappShare}</span>
                </a>

                {/* Native Share Sheet if available */}
                {navigator.share && (
                  <button
                    type="button"
                    onClick={() => {
                      const cleanUrl = getCleanShareUrl(currentTrack, selectedFormat);
                      const shareData = {
                        title: `${currentTrack.album || 'Muziek'} - ${currentTrack.title}`,
                        text: musicLang === 'nl'
                          ? `Luister naar "${currentTrack.title}" (${currentTrack.album || 'Muziek'}) van Paul van Geenen`
                          : `Listen to "${currentTrack.title}" (${currentTrack.album || 'Music'}) by Paul van Geenen`,
                        url: cleanUrl,
                      };
                      if (navigator.canShare && navigator.canShare(shareData)) {
                        navigator.share(shareData).catch((err) => {
                          if (err.name !== 'AbortError') {
                            copyToClipboard(cleanUrl);
                          }
                        });
                      } else {
                        copyToClipboard(cleanUrl);
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white font-medium text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/15"
                  >
                    <Share2 className="w-4 h-4 text-earth-gold" />
                    <span>{t.shareModal.nativeShare}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Equalizer & Klankprofiel Modal (Met cookies & realtime Web Audio API spectrum) */}
      <EqualizerModal
        isOpen={showEqualizerModal}
        onClose={() => {
          setShowEqualizerModal(false);
          setEqualizerPrefs(getEqualizerPreferences());
        }}
        isPlaying={isPlaying}
        lang={musicLang}
      />
    </>
  );
}
