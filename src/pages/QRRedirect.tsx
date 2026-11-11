import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BOOKS } from '../data/books';
import type { Book as BookType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Music, AlertCircle, Loader2, Sparkles, Volume2, BookOpen, Lock, LockOpen } from 'lucide-react';
import { transipPost, getQrCodeByCode } from '../lib/transip';
import {
  unlockTrack,
  unlockTrackByRawIdentifier,
  isTrackUnlocked,
  isRawIdentifierUnlockedInStorage,
  playLockUnlockSound
} from '../lib/trackLocks';
import { sanitizeMediaUrl, getTrackCoverJpg } from './Music';

// Visual branding and theme overrides matching the physical hardcovers (100% Book Atmosphere, no Spotify green)
function getBookTheme(bookId: string) {
  switch (bookId) {
    case '1': // Proloog - Warm Clay / Charcoal Earth
      return {
        bgClass: 'from-[#19110e] via-[#2a1b14] to-[#120d0b]',
        accent: 'text-earth-gold',
        badgeBg: 'bg-earth-clay/20 text-earth-light border-earth-clay/35',
        glow: 'bg-earth-clay/25',
        progressBar: 'from-earth-clay via-earth-gold to-amber-300',
        cardBorder: 'border-earth-clay/30',
        buttonClass: 'from-earth-gold via-amber-500 to-earth-clay text-black border-earth-gold/50',
        label: 'Koester het Leven'
      };
    case '2': // Vorming - Rust / Dark Amber
      return {
        bgClass: 'from-[#1a120b] via-[#301c0c] to-[#110b06]',
        accent: 'text-amber-400',
        badgeBg: 'bg-amber-500/20 text-amber-200 border-amber-500/35',
        glow: 'bg-amber-500/20',
        progressBar: 'from-amber-600 via-amber-400 to-yellow-300',
        cardBorder: 'border-amber-500/30',
        buttonClass: 'from-amber-400 via-amber-500 to-orange-500 text-black border-amber-300/50',
        label: 'Mijn eerste 21 jaar'
      };
    case '3': // De Echo - Deep Velvet / Antique Gold
      return {
        bgClass: 'from-[#120d07] via-[#24190c] to-[#090604]',
        accent: 'text-[#cfa153]',
        badgeBg: 'bg-[#cfa153]/20 text-[#ffe5b8] border-[#cfa153]/35',
        glow: 'bg-[#cfa153]/25',
        progressBar: 'from-[#9e7329] via-[#cfa153] to-[#ffe5b8]',
        cardBorder: 'border-[#cfa153]/35',
        buttonClass: 'from-[#cfa153] via-[#e2b86b] to-[#b5893d] text-black border-[#ffe5b8]/50',
        label: 'De Echo'
      };
    case '4': // De Bestemming / De Geboorte van de Leeuw - Cathedral Slate / Warm Gold
      return {
        bgClass: 'from-[#0a0c14] via-[#161b2e] to-[#05060a]',
        accent: 'text-[#d4af37]',
        badgeBg: 'bg-[#d4af37]/20 text-amber-100 border-[#d4af37]/35',
        glow: 'bg-[#d4af37]/20',
        progressBar: 'from-[#8fa3db] via-[#d4af37] to-amber-200',
        cardBorder: 'border-[#d4af37]/30',
        buttonClass: 'from-[#d4af37] via-amber-400 to-[#b5893d] text-black border-amber-200/50',
        label: 'De Geboorte van de Leeuw'
      };
    default:
      return {
        bgClass: 'from-[#140f0a] via-[#241a10] to-[#0a0705]',
        accent: 'text-earth-gold',
        badgeBg: 'bg-earth-gold/15 text-earth-light border-earth-gold/30',
        glow: 'bg-earth-gold/25',
        progressBar: 'from-earth-clay via-earth-gold to-amber-200',
        cardBorder: 'border-earth-gold/30',
        buttonClass: 'from-earth-gold via-amber-400 to-amber-600 text-black border-earth-gold/50',
        label: 'De Geboorte van de Leeuw'
      };
  }
}

async function recordScan(redirectCode: string, data: any, book: BookType | null) {
  try {
    let city = 'Onbekend';
    let country = 'Onbekend';
    try {
      const geoRes = await fetch('https://ipapi.co/json/');
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        city = geoData.city || 'Onbekend';
        country = geoData.country_name || 'Onbekend';
      }
    } catch (e) {
      console.warn('[Analytics] Geolocation lookup failed:', e);
    }

    const ua = navigator.userAgent;
    let deviceType = 'Onbekend';
    if (/iphone/i.test(ua)) {
      deviceType = 'iPhone';
    } else if (/ipad/i.test(ua)) {
      deviceType = 'iPad';
    } else if (/android/i.test(ua)) {
      deviceType = /mobile/i.test(ua) ? 'Android Telefoon' : 'Android Tablet';
    } else if (/windows/i.test(ua)) {
      deviceType = 'Windows PC';
    } else if (/macintosh/i.test(ua)) {
      deviceType = 'Mac computer';
    }

    const scanPayload = {
      redirectCode: redirectCode.toUpperCase().trim(),
      city,
      country,
      timestamp: new Date().toISOString(),
      userAgent: ua,
      deviceType,
      bookId: book?.id || data.boekId || '',
      bookTitle: book?.title || data.boekTitel || 'De Geboorte van de Leeuw',
      chapter: data.hoofdstuk || '',
      song: data.song || '',
      artist: data.artist || ''
    };

    try {
      await transipPost('qr_scan', scanPayload);
    } catch (transipErr) {
      console.warn('[Analytics] Direct TransIP scan logging warning:', transipErr);
    }

    try {
      fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scanPayload)
      }).catch(() => {});
    } catch {}
  } catch (err) {
    console.error('[Analytics] Failed to log scan event entirely:', err);
  }
}

/**
 * Resolve the target URL on our own music player with single=1 & ceremony=done
 * so the player opens the track in single mode (plays 1x and stops) right after our 5s cover reveal!
 */
function resolvePlayerTargetUrl(rawLink: string, songTitle: string, matchedTrackId?: string): string {
  const cleanLink = (rawLink || '').trim();

  try {
    if (cleanLink) {
      const isInternalMusic =
        cleanLink.startsWith('/music') ||
        cleanLink.startsWith('/@music') ||
        cleanLink.includes('paulvangeenen.nl/music') ||
        cleanLink.includes('lionbooks.nl/music');

      if (isInternalMusic) {
        const urlObj = new URL(cleanLink, window.location.origin);
        urlObj.searchParams.set('single', '1');
        urlObj.searchParams.set('ceremony', 'done');
        return `${urlObj.pathname}${urlObj.search}`;
      }
    }
  } catch {}

  const targetIdentifier = matchedTrackId || (songTitle && songTitle !== 'Onbekend nummer' ? songTitle.trim() : '');
  if (targetIdentifier) {
    return `/music?track=${encodeURIComponent(targetIdentifier)}&single=1&ceremony=done`;
  }

  if (cleanLink) {
    return cleanLink;
  }

  return '/music';
}

function findMatchingCatalogTrack(tracks: any[], searchVal: string): any | null {
  if (!searchVal || !Array.isArray(tracks) || tracks.length === 0) return null;
  const target = searchVal.toLowerCase().trim();
  if (!target) return null;

  let match = tracks.find(t =>
    (t.id && String(t.id).toLowerCase() === target) ||
    (t.folderName && String(t.folderName).toLowerCase() === target) ||
    (t.title && String(t.title).toLowerCase() === target)
  );
  if (match) return match;

  const normTarget = target.replace(/[\s\-_]+/g, '');
  match = tracks.find(t =>
    (t.title && String(t.title).toLowerCase().replace(/[\s\-_]+/g, '') === normTarget) ||
    (t.folderName && String(t.folderName).toLowerCase().replace(/[\s\-_]+/g, '') === normTarget)
  );
  if (match) return match;

  match = tracks.find(t =>
    (t.title && String(t.title).toLowerCase().includes(target)) ||
    (t.folderName && String(t.folderName).toLowerCase().includes(target)) ||
    (t.title && target.includes(String(t.title).toLowerCase()))
  );
  return match || null;
}

// Primary expected path for the book cover of "De Geboorte van de Leeuw"
const GEBOORTE_VAN_DE_LEEUW_BOOK_COVER = '/images/de-geboorte-van-de-leeuw-boek.jpg';
const GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK = '/@music/_albums/De%20Geboorte%20van%20de%20Leeuw%20Album.jpg';

export function QRRedirect() {
  const { qrCode } = useParams<{ qrCode: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Visual Sequence Stages:
  // 'book-locked' -> 'book-rattling' -> 'book-opened' -> 'cover-in' (5s hold) -> 'cover-out' -> redirect to music player
  const [visualStage, setVisualStage] = useState<'book-locked' | 'book-rattling' | 'book-opened' | 'cover-in' | 'cover-out'>('book-locked');
  const [wasAlreadyUnlocked, setWasAlreadyUnlocked] = useState<boolean>(false);
  const [coverRemainingSecs, setCoverRemainingSecs] = useState<number>(5);
  const [isFadingToBlack, setIsFadingToBlack] = useState<boolean>(false);
  const isRedirectingRef = useRef<boolean>(false);
  const sequenceTimersRef = useRef<NodeJS.Timeout[]>([]);

  const [songInfo, setSongInfo] = useState<{
    song: string;
    targetUrl: string;
    hoofdstuk?: string;
    boekId?: string;
    boekTitel?: string;
    soundtrackCoverUrl?: string;
  } | null>(null);

  const [matchedBook, setMatchedBook] = useState<BookType | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchRedirect() {
      if (!qrCode) {
        if (active) {
          setError('Geen QR-code opgegeven.');
          setLoading(false);
        }
        return;
      }

      const cleanCode = qrCode.trim().toUpperCase();

      if (cleanCode.includes('.') || cleanCode === '') {
        if (active) navigate('/', { replace: true });
        return;
      }

      try {
        // Fetch QR code mapping and Music Catalog in parallel so we have the exact SoundTrack cover & lock status
        const catalogPromise = (async () => {
          try {
            const bridgeUrl = localStorage.getItem('transip_music_api_url') || '/api/music_database.php';
            const apiKey = localStorage.getItem('transip_music_api_key') || 'music-secret-key-paul-2026';
            const url = bridgeUrl.includes('?') ? `${bridgeUrl}&action=get_catalog` : `${bridgeUrl}?action=get_catalog`;
            let res = await fetch(url, { cache: 'no-store', headers: { 'X-API-Key': apiKey } });
            if (!res.ok || !(res.headers.get('content-type') || '').includes('application/json')) {
              res = await fetch('https://paulvangeenen.nl/api/music_database.php?action=get_catalog', {
                cache: 'no-store',
                headers: { 'X-API-Key': apiKey }
              });
            }
            if (res.ok) {
              return await res.json();
            }
          } catch {}
          return null;
        })();

        let data = await getQrCodeByCode(cleanCode);
        if (!data) {
          try {
            const res = await fetch(`/api/qrcodes/${encodeURIComponent(cleanCode)}`);
            if (res.ok) {
              const json = await res.json();
              if (json?.qrcode) data = json.qrcode;
            }
          } catch {}
        }

        const catalogData = await catalogPromise;

        if (data) {
          let foundBook: BookType | null = null;
          if (data.boekId) {
            foundBook = BOOKS.find(b => b.id === String(data.boekId)) || null;
          }
          if (!foundBook && data.boekTitel) {
            const searchTitle = data.boekTitel.toLowerCase().trim();
            foundBook = BOOKS.find(b =>
              b.title.toLowerCase().trim().includes(searchTitle) ||
              searchTitle.includes(b.title.toLowerCase().trim())
            ) || null;
          }

          const songTitle = data.song || 'Onbekend nummer';
          const catalogTracks: any[] = catalogData?.tracks || [];
          const catalogAlbums: any[] = catalogData?.albums || [];

          const matchedTrack =
            findMatchingCatalogTrack(catalogTracks, songTitle) ||
            (data.hoofdstuk ? findMatchingCatalogTrack(catalogTracks, data.hoofdstuk) : null);

          let matchedAlbum: any = null;
          if (matchedTrack) {
            matchedAlbum = catalogAlbums.find(
              a =>
                (matchedTrack.albumId && String(a.id) === String(matchedTrack.albumId)) ||
                (a.title && String(a.title).toLowerCase() === String(matchedTrack.album || '').toLowerCase())
            ) || null;
          }

          // Determine if this SoundTrack was ALREADY unlocked BEFORE we unlock it now!
          let alreadyOpen = false;
          if (matchedTrack) {
            const albTracks = catalogTracks.filter(
              t => String(t.album || '').toLowerCase() === String(matchedTrack.album || '').toLowerCase()
            );
            const idxInAlb = albTracks.findIndex(t => t.id === matchedTrack.id);
            alreadyOpen = isTrackUnlocked(matchedTrack, idxInAlb !== -1 ? idxInAlb : 99, undefined, matchedAlbum);
          } else {
            alreadyOpen =
              isRawIdentifierUnlockedInStorage(songTitle) ||
              (data.hoofdstuk ? isRawIdentifierUnlockedInStorage(data.hoofdstuk) : false);
          }

          // Now unlock the SoundTrack in localStorage on the reader's device
          if (matchedTrack) {
            unlockTrack(matchedTrack);
          }
          if (data.song) {
            unlockTrackByRawIdentifier(data.song);
          }
          if (data.hoofdstuk) {
            unlockTrackByRawIdentifier(data.hoofdstuk);
          }

          // Resolve the SoundTrack's own album/art cover for the 5-second fade-in showcase
          const soundtrackCoverUrl = matchedTrack
            ? (getTrackCoverJpg(matchedTrack) ||
               sanitizeMediaUrl(matchedTrack.portraitJpg) ||
               sanitizeMediaUrl(matchedTrack.thumbnailJpg) ||
               sanitizeMediaUrl(matchedTrack.landscapeJpg) ||
               GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK)
            : GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK;

          // Preload the soundtrack cover and full player images so every fade-in is instant and crisp
          const preloadUrls = new Set<string>();
          if (soundtrackCoverUrl) preloadUrls.add(soundtrackCoverUrl);
          if (matchedTrack) {
            [matchedTrack.portraitJpg, matchedTrack.landscapeJpg, matchedTrack.thumbnailJpg]
              .map((u) => sanitizeMediaUrl(u))
              .filter(Boolean)
              .forEach((u) => preloadUrls.add(u as string));
          }
          preloadUrls.forEach((u) => {
            const preloadImg = new Image();
            preloadImg.src = u;
          });

          const targetUrl = resolvePlayerTargetUrl(
            data.spotifyLink || '',
            songTitle,
            matchedTrack?.id || matchedTrack?.folderName || songTitle
          );

          if (active) {
            setWasAlreadyUnlocked(alreadyOpen);
            setMatchedBook(foundBook);
            setSongInfo({
              song: matchedTrack?.title || songTitle,
              targetUrl,
              hoofdstuk: data.hoofdstuk || 'Boekfragment',
              boekId: data.boekId,
              boekTitel: data.boekTitel || matchedAlbum?.title || 'De Geboorte van de Leeuw',
              soundtrackCoverUrl
            });
            setLoading(false);

            recordScan(cleanCode, data, foundBook);
          }
        } else {
          if (active) {
            setError(`Deze boekcode "${cleanCode}" bestaat niet of is gewijzigd.`);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('[QR Redirect] Database fetch error:', err);
        if (active) {
          setError('Kan geen verbinding maken met de database. Controleer uw verbinding.');
          setLoading(false);
        }
      }
    }

    fetchRedirect();

    return () => {
      active = false;
    };
  }, [qrCode, navigate]);

  const performNavigation = (targetUrl: string) => {
    if (targetUrl.startsWith('/')) {
      navigate(targetUrl, { replace: true });
    } else {
      window.location.replace(targetUrl);
    }
  };

  const triggerPlayerRedirect = (targetUrl: string, skipBlackFadeWait = false) => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    sequenceTimersRef.current.forEach(t => clearTimeout(t));
    sequenceTimersRef.current = [];
    setIsFadingToBlack(true);

    if (skipBlackFadeWait) {
      performNavigation(targetUrl);
      return;
    }

    // Smooth fade to black before opening the player so there is never an abrupt jump
    setTimeout(() => {
      performNavigation(targetUrl);
    }, 550);
  };

  // Orchestrate the visual unlock + 5-second soundtrack cover fade-in/out sequence
  useEffect(() => {
    if (loading || error || !songInfo) return;

    sequenceTimersRef.current.forEach(t => clearTimeout(t));
    sequenceTimersRef.current = [];

    if (!wasAlreadyUnlocked) {
      // Newly unlocked SoundTrack:
      // 1. Show book cover + closed lock (0ms - 450ms)
      // 2. Rattle lock with sound (450ms - 1150ms)
      // 3. Open lock (1150ms - 2400ms)
      // 4. Fade out book card smoothly & fade in SoundTrack cover (2400ms - 7900ms)
      // 5. Fade out SoundTrack cover to pure black (7900ms - 8800ms)
      // 6. Open music player silently on black & fade in track (8850ms)
      setVisualStage('book-locked');

      const tRattle = setTimeout(() => {
        setVisualStage('book-rattling');
        playLockUnlockSound();
      }, 450);

      const tOpened = setTimeout(() => {
        setVisualStage('book-opened');
      }, 1150);

      const tCoverIn = setTimeout(() => {
        setVisualStage('cover-in');
        setCoverRemainingSecs(5);
      }, 2400);

      const tSec4 = setTimeout(() => setCoverRemainingSecs(4), 3500);
      const tSec3 = setTimeout(() => setCoverRemainingSecs(3), 4600);
      const tSec2 = setTimeout(() => setCoverRemainingSecs(2), 5700);
      const tSec1 = setTimeout(() => setCoverRemainingSecs(1), 6800);

      const tCoverOut = setTimeout(() => {
        setVisualStage('cover-out');
        setIsFadingToBlack(true);
      }, 7900);

      const tRedirect = setTimeout(() => {
        triggerPlayerRedirect(songInfo.targetUrl, true);
      }, 8850);

      sequenceTimersRef.current = [
        tRattle,
        tOpened,
        tCoverIn,
        tSec4,
        tSec3,
        tSec2,
        tSec1,
        tCoverOut,
        tRedirect
      ];
    } else {
      // Already unlocked SoundTrack:
      // Smooth fade-in -> hold -> smooth crossfade to SoundTrack cover -> fade to black -> player fade-in
      setVisualStage('book-opened');

      const tCoverIn = setTimeout(() => {
        setVisualStage('cover-in');
        setCoverRemainingSecs(5);
      }, 1900);

      const tSec4 = setTimeout(() => setCoverRemainingSecs(4), 3000);
      const tSec3 = setTimeout(() => setCoverRemainingSecs(3), 4100);
      const tSec2 = setTimeout(() => setCoverRemainingSecs(2), 5200);
      const tSec1 = setTimeout(() => setCoverRemainingSecs(1), 6300);

      const tCoverOut = setTimeout(() => {
        setVisualStage('cover-out');
        setIsFadingToBlack(true);
      }, 7400);

      const tRedirect = setTimeout(() => {
        triggerPlayerRedirect(songInfo.targetUrl, true);
      }, 8350);

      sequenceTimersRef.current = [
        tCoverIn,
        tSec4,
        tSec3,
        tSec2,
        tSec1,
        tCoverOut,
        tRedirect
      ];
    }

    return () => {
      sequenceTimersRef.current.forEach(t => clearTimeout(t));
      sequenceTimersRef.current = [];
    };
  }, [loading, error, songInfo, wasAlreadyUnlocked]);

  const handleProceedImmediately = () => {
    if (songInfo) {
      triggerPlayerRedirect(songInfo.targetUrl, false);
    }
  };

  const theme = getBookTheme(matchedBook?.id || '4');

  // Book cover: use De Geboorte van de Leeuw book cover by default (or specific book cover if book 1/2), never De Echo when scanning De Geboorte van de Leeuw
  const bookTitleLower = (songInfo?.boekTitel || '').toLowerCase();
  const isGeboorteVanDeLeeuw =
    !bookTitleLower ||
    bookTitleLower.includes('geboorte') ||
    bookTitleLower.includes('leeuw') ||
    bookTitleLower.includes('bestemming') ||
    matchedBook?.id === '3' ||
    matchedBook?.id === '4';

  const displayBookCover = isGeboorteVanDeLeeuw
    ? GEBOORTE_VAN_DE_LEEUW_BOOK_COVER
    : (matchedBook?.coverUrl || GEBOORTE_VAN_DE_LEEUW_BOOK_COVER);

  const displayBookTitle = isGeboorteVanDeLeeuw
    ? 'De Geboorte van de Leeuw'
    : (songInfo?.boekTitel || matchedBook?.title || 'De Geboorte van de Leeuw');

  const isShowingSoundtrackCover = visualStage === 'cover-in' || visualStage === 'cover-out';

  return (
    <div className={`min-h-screen bg-gradient-to-b ${theme.bgClass} text-white flex flex-col justify-center items-center px-4 py-8 md:py-12 transition-all duration-1000 select-none relative overflow-hidden`}>
      {/* Immersive Book Atmosphere Background Glow */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[520px] h-[320px] sm:h-[520px] rounded-full blur-[110px] sm:blur-[150px] opacity-30 mix-blend-screen transition-all duration-1000 animate-pulse ${theme.glow}`} />

      <div className="w-full max-w-lg z-10">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="bg-black/55 border border-earth-gold/20 p-8 rounded-[28px] shadow-2xl backdrop-blur-md text-center space-y-6"
            >
              <div className="relative flex justify-center">
                <div className="absolute inset-0 bg-earth-gold/20 rounded-full blur-xl w-20 h-20 mx-auto animate-pulse" />
                <div className="relative w-14 h-14 bg-gradient-to-tr from-earth-gold to-amber-300 rounded-full flex items-center justify-center text-earth-dark shadow-lg">
                  <BookOpen className="w-7 h-7 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-serif font-medium text-white tracking-wide">
                  SoundTrack voorbereiden...
                </h3>
                <p className="text-earth-light/60 text-xs">SoundTrack van het boek wordt geladen</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-earth-gold/60 text-[11px] font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-earth-gold" />
                <span>Moment geduld...</span>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="bg-black/55 border border-red-500/20 p-8 rounded-[28px] shadow-2xl backdrop-blur-md text-center space-y-6"
            >
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-400 mx-auto shadow-inner">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-medium text-white">SoundTrack niet bereikbaar</h3>
                <p className="text-earth-light/65 text-xs leading-relaxed max-w-xs mx-auto">
                  {error}
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => navigate('/music')}
                  className="px-6 py-2.5 bg-earth-gold/15 border border-earth-gold/30 hover:bg-earth-gold/25 text-earth-gold rounded-full font-medium text-xs tracking-wider uppercase transition-all cursor-pointer"
                >
                  Naar de Muziekspeler
                </button>
              </div>
            </motion.div>
          ) : isShowingSoundtrackCover ? (
            /* STAGE 2: Fade-in of the unlocked SoundTrack's Album Cover (holds for 5 seconds, then fades smoothly to black) */
            <motion.div
              key="soundtrack-cover-showcase"
              initial={{ opacity: 0 }}
              animate={{
                opacity: visualStage === 'cover-out' ? 0 : 1
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: visualStage === 'cover-out' ? 0.85 : 0.85,
                ease: [0.22, 1, 0.36, 1]
              }}
              className={`bg-black/75 border ${theme.cardBorder} p-6 sm:p-8 rounded-[36px] shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-xl text-center space-y-6 relative overflow-hidden`}
            >
              {/* Book Title Pill */}
              <div className="flex justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold border ${theme.badgeBg}`}>
                  <Music className="w-3 h-3 text-earth-gold" />
                  <span>{displayBookTitle}</span>
                </span>
              </div>

              {/* Full Square SoundTrack Art Cover */}
              <div className="pt-1 flex justify-center">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-2xl overflow-hidden shadow-[0_25px_65px_rgba(0,0,0,0.9)] border-2 border-earth-gold/50 bg-black/90">
                  <img
                    src={songInfo?.soundtrackCoverUrl || GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK}
                    alt={songInfo?.song || 'SoundTrack Cover'}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK && !target.src.endsWith('Leeuw%20Album.jpg')) {
                        target.src = GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK;
                      }
                    }}
                  />
                </div>
              </div>

              {/* SoundTrack Title (Author name omitted per user specification) */}
              <div className="space-y-1.5">
                {songInfo?.hoofdstuk && (
                  <p className="text-earth-light/65 text-xs font-serif italic">
                    {songInfo.hoofdstuk}
                  </p>
                )}
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-earth-gold tracking-wide leading-tight">
                  {songInfo?.song}
                </h2>
              </div>

              {/* Subtle status bar & immediate start option */}
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center text-[10px] text-earth-light/60 font-mono px-1">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Volume2 className="w-3.5 h-3.5 text-earth-gold animate-pulse" />
                    Muziekspeler start zo
                  </span>
                  <span className="font-bold text-earth-gold bg-earth-gold/10 px-2.5 py-0.5 rounded-full border border-earth-gold/25">
                    0:0{coverRemainingSecs}s
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleProceedImmediately}
                  className={`w-full py-3 bg-gradient-to-r ${theme.buttonClass} font-bold rounded-full text-xs sm:text-sm transition-all transform active:scale-98 uppercase tracking-wider shadow-xl shadow-earth-gold/15 hover:shadow-earth-gold/30 inline-flex items-center justify-center gap-2 cursor-pointer border`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Nu Direct Afspelen</span>
                </button>
              </div>
            </motion.div>
          ) : (
            /* STAGE 1: Book Cover of De Geboorte van de Leeuw + Lock Unlocking Animation (if not already unlocked) */
            <motion.div
              key="book-stage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className={`bg-black/65 border ${theme.cardBorder} p-6 sm:p-8 rounded-[36px] shadow-[0_30px_80px_rgba(0,0,0,0.9)] backdrop-blur-xl text-center space-y-6 relative overflow-hidden`}
            >
              {/* Book Badge (without lock icon if already unlocked) */}
              <div className="flex justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold border ${theme.badgeBg}`}>
                  <BookOpen className="w-3 h-3 text-earth-gold" />
                  <span>{displayBookTitle}</span>
                </span>
              </div>

              {/* Physical Book Cover Showcase + Animated Lock Overlay (ONLY when newly unlocking!) */}
              <div className="pt-1 flex justify-center">
                <div className="relative group">
                  <div className={`absolute -inset-4 rounded-2xl blur-2xl opacity-55 ${theme.glow}`} />
                  <img
                    src={displayBookCover}
                    alt={displayBookTitle}
                    className="relative w-44 sm:w-52 h-auto object-cover rounded-xl shadow-[0_25px_55px_rgba(0,0,0,0.85)] border border-earth-gold/30"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src !== GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK && !target.src.endsWith('Leeuw%20Album.jpg')) {
                        target.src = GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK;
                      }
                    }}
                  />

                  {/* Animated Lock Badge over Book Cover ONLY if !wasAlreadyUnlocked */}
                  {!wasAlreadyUnlocked && (
                    <motion.div
                      animate={
                        visualStage === 'book-rattling'
                          ? {
                              rotate: [0, -18, 18, -15, 15, -10, 10, -5, 5, 0],
                              x: [0, -6, 6, -5, 5, -3, 3, 0],
                              scale: [1, 1.12, 1.08, 1.14, 1.05, 1]
                            }
                          : visualStage === 'book-opened'
                          ? { scale: [1, 1.2, 1.08], rotate: 0, x: 0 }
                          : { scale: 1, rotate: 0, x: 0 }
                      }
                      transition={{ duration: 0.6, ease: 'easeInOut' }}
                      className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-14 h-14 rounded-2xl bg-gradient-to-b from-[#2a2118] via-[#15100c] to-[#080604] border-2 border-earth-gold shadow-[0_10px_30px_rgba(0,0,0,0.9)] flex items-center justify-center z-20"
                    >
                      {visualStage === 'book-opened' ? (
                        <LockOpen className="w-7 h-7 text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.85)]" />
                      ) : (
                        <Lock className="w-7 h-7 text-earth-gold" />
                      )}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Chapter & SoundTrack Announcement (omits "SoundTrack Ontgrendeld" text & icon when already unlocked) */}
              <div className="space-y-1.5 pt-2">
                {!wasAlreadyUnlocked && (
                  <span className="text-earth-gold/90 text-[11px] tracking-[0.2em] uppercase font-mono flex items-center justify-center gap-1.5 font-bold">
                    <Sparkles className="w-3.5 h-3.5 animate-pulse text-earth-gold" />
                    SoundTrack Ontgrendeld
                  </span>
                )}

                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide leading-tight max-w-sm mx-auto">
                  {songInfo?.hoofdstuk}
                </h2>
              </div>

              {/* SoundTrack Card in Pure Book Style (Author name omitted per user specification) */}
              <div className="bg-gradient-to-r from-white/[0.04] via-earth-gold/[0.08] to-white/[0.04] border border-earth-gold/25 rounded-2xl p-4 flex items-center gap-4 text-left shadow-inner">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-earth-clay via-earth-gold to-amber-200 flex items-center justify-center text-black shrink-0 relative overflow-hidden shadow-lg shadow-earth-gold/20">
                  <Music className="w-5 h-5 fill-current animate-pulse text-black" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase tracking-widest text-earth-gold/75 font-mono block">
                    SoundTrack
                  </span>
                  <h4 className="text-base sm:text-lg font-bold text-white truncate font-serif">
                    {songInfo?.song}
                  </h4>
                </div>
              </div>

              {/* Immediate skip button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleProceedImmediately}
                  className={`w-full py-3.5 bg-gradient-to-r ${theme.buttonClass} font-bold rounded-full text-xs sm:text-sm transition-all transform active:scale-98 uppercase tracking-wider shadow-xl shadow-earth-gold/15 hover:shadow-earth-gold/30 inline-flex items-center justify-center gap-2 cursor-pointer border`}
                >
                  {!wasAlreadyUnlocked ? (
                    <>
                      <LockOpen className="w-4 h-4" />
                      <span>Ontgrendel & Luister Direct</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4" />
                      <span>Luister Direct</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Smooth full-screen fade-to-black curtain so the transition into the Music Player has zero jump */}
      <motion.div
        initial={false}
        animate={{ opacity: isFadingToBlack ? 1 : 0 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 bg-black z-50 pointer-events-none"
      />
    </div>
  );
}
