import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BOOKS } from '../data/books';
import type { Book as BookType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Music, AlertCircle, Loader2, Sparkles, Volume2, BookOpen, LockOpen } from 'lucide-react';
import { transipPost, getQrCodeByCode } from '../lib/transip';
import { unlockTrackByRawIdentifier } from '../lib/trackLocks';

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
    case '4': // De Bestemming - Cathedral Slate / Warm Gold
      return {
        bgClass: 'from-[#0a0c14] via-[#161b2e] to-[#05060a]',
        accent: 'text-[#d4af37]',
        badgeBg: 'bg-[#d4af37]/20 text-amber-100 border-[#d4af37]/35',
        glow: 'bg-[#d4af37]/20',
        progressBar: 'from-[#8fa3db] via-[#d4af37] to-amber-200',
        cardBorder: 'border-[#d4af37]/30',
        buttonClass: 'from-[#d4af37] via-amber-400 to-[#b5893d] text-black border-amber-200/50',
        label: 'De Bestemming'
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
        label: 'Boeksoundtrack'
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
      bookTitle: book?.title || data.boekTitel || '',
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
 * Resolve the target URL on our own music player and append ?unlock=1
 * so the player triggers the cinematic lock-rattle-unlock-fade sequence!
 */
function resolvePlayerTargetUrl(rawLink: string, songTitle: string): string {
  const cleanLink = (rawLink || '').trim();

  // Check if the link points to our website's music player (e.g. https://paulvangeenen.nl/music?v=... or /music/...)
  try {
    if (cleanLink) {
      const isInternalMusic =
        cleanLink.startsWith('/music') ||
        cleanLink.startsWith('/@music') ||
        cleanLink.includes('paulvangeenen.nl/music') ||
        cleanLink.includes('lionbooks.nl/music');

      if (isInternalMusic) {
        const urlObj = new URL(cleanLink, window.location.origin);
        urlObj.searchParams.set('unlock', '1');
        return `${urlObj.pathname}${urlObj.search}`;
      }
    }
  } catch {}

  // If link was a legacy Spotify URL or empty, route directly to the track in our internal Music player!
  if (songTitle && songTitle !== 'Onbekend nummer') {
    return `/music?track=${encodeURIComponent(songTitle.trim())}&unlock=1`;
  }

  if (cleanLink) {
    return cleanLink;
  }

  return '/music';
}

export function QRRedirect() {
  const { qrCode } = useParams<{ qrCode: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const TOTAL_SECONDS = 4;
  const [countdown, setCountdown] = useState(TOTAL_SECONDS);

  const [songInfo, setSongInfo] = useState<{
    song: string;
    artist: string;
    targetUrl: string;
    hoofdstuk?: string;
    boekId?: string;
    boekTitel?: string;
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
          // Default fallback to Book 3 (De Echo) or Book 1 so a physical hardcover photo is always shown
          if (!foundBook) {
            foundBook = BOOKS[2] || BOOKS[0] || null;
          }

          const songTitle = data.song || 'Onbekend nummer';
          // Immediately unlock this track in localStorage on the reader's device!
          if (data.song) {
            unlockTrackByRawIdentifier(data.song);
          }
          if (data.hoofdstuk) {
            unlockTrackByRawIdentifier(data.hoofdstuk);
          }

          const targetUrl = resolvePlayerTargetUrl(data.spotifyLink || '', songTitle);

          if (active) {
            setMatchedBook(foundBook);
            setSongInfo({
              song: songTitle,
              artist: data.artist || 'Paul van Geenen',
              targetUrl,
              hoofdstuk: data.hoofdstuk || 'Boekfragment',
              boekId: data.boekId,
              boekTitel: data.boekTitel || foundBook?.title
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

  const triggerPlayerRedirect = (targetUrl: string) => {
    if (targetUrl.startsWith('/')) {
      navigate(targetUrl, { replace: true });
    } else {
      window.location.replace(targetUrl);
    }
  };

  useEffect(() => {
    if (loading || error || !songInfo) return;

    let timer: NodeJS.Timeout | null = null;

    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else {
      triggerPlayerRedirect(songInfo.targetUrl);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown, loading, error, songInfo]);

  const handleProceedImmediately = () => {
    if (songInfo) {
      triggerPlayerRedirect(songInfo.targetUrl);
    }
  };

  const theme = getBookTheme(matchedBook?.id || '');
  const displayBookCover = matchedBook?.coverUrl || BOOKS[2]?.coverUrl || BOOKS[0]?.coverUrl;
  const displayBookTitle = songInfo?.boekTitel || matchedBook?.title || 'De Geboorte van de Leeuw';

  return (
    <div className={`min-h-screen bg-gradient-to-b ${theme.bgClass} text-white flex flex-col justify-center items-center px-4 py-8 md:py-12 transition-all duration-1000 select-none relative overflow-hidden`}>
      {/* Top running golden progress bar */}
      {!loading && !error && songInfo && (
        <div className="fixed top-0 left-0 w-full h-[5px] bg-white/5 z-50">
          <motion.div
            className={`bg-gradient-to-r ${theme.progressBar} h-full shadow-[0_0_15px_rgba(212,175,55,0.6)]`}
            initial={{ width: '0%' }}
            animate={{ width: `${((TOTAL_SECONDS - countdown) / TOTAL_SECONDS) * 100}%` }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </div>
      )}

      {/* Immersive Book Atmosphere Background Glow */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[520px] h-[320px] sm:h-[520px] rounded-full blur-[110px] sm:blur-[150px] opacity-30 mix-blend-screen transition-all duration-1000 animate-pulse ${theme.glow}`} />

      <div className="w-full max-w-lg z-10">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-black/55 border border-earth-gold/20 p-8 rounded-[28px] shadow-2xl backdrop-blur-md text-center space-y-6"
            >
              <div className="relative flex justify-center">
                <div className="absolute inset-0 bg-earth-gold/20 rounded-full blur-xl w-20 h-20 mx-auto animate-pulse" />
                <div className="relative w-14 h-14 bg-gradient-to-tr from-earth-gold to-amber-300 rounded-full flex items-center justify-center text-earth-dark shadow-lg">
                  <BookOpen className="w-7 h-7 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-serif font-medium text-white tracking-wide">Hoofdstuk ontgrendelen...</h3>
                <p className="text-earth-light/60 text-xs">Soundtrack van het boek wordt voorbereid</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-earth-gold/60 text-[11px] font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-earth-gold" />
                <span>Moment geduld...</span>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-black/55 border border-red-500/20 p-8 rounded-[28px] shadow-2xl backdrop-blur-md text-center space-y-6"
            >
              <div className="w-14 h-14 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center text-red-400 mx-auto shadow-inner">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-serif font-medium text-white">Fragment niet bereikbaar</h3>
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
          ) : (
            <motion.div
              key="companion"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className={`bg-black/60 border ${theme.cardBorder} p-6 sm:p-8 rounded-[36px] shadow-[0_30px_80px_rgba(0,0,0,0.9)] backdrop-blur-xl text-center space-y-6 relative overflow-hidden`}
            >
              {/* Book Badge */}
              <div className="flex justify-center">
                <span className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold border ${theme.badgeBg}`}>
                  <LockOpen className="w-3 h-3 text-earth-gold" />
                  <span>{displayBookTitle}</span>
                </span>
              </div>

              {/* Physical Book Cover Showcase */}
              <div className="pt-1 flex justify-center">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.6 }}
                  className="relative group"
                >
                  <div className={`absolute -inset-4 rounded-2xl blur-2xl opacity-55 ${theme.glow}`} />
                  <img
                    src={displayBookCover}
                    alt={displayBookTitle}
                    className="relative w-44 sm:w-52 h-auto object-cover rounded-xl shadow-[0_25px_55px_rgba(0,0,0,0.85)] border border-earth-gold/30"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              </div>

              {/* Chapter & Unlock Announcement */}
              <div className="space-y-1.5">
                <span className="text-earth-gold/80 text-[10px] tracking-[0.2em] uppercase font-mono flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3 h-3 animate-pulse text-earth-gold" />
                  Hoofdstuk Soundtrack Ontgrendeld
                </span>

                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide leading-tight max-w-sm mx-auto">
                  {songInfo?.hoofdstuk}
                </h2>
              </div>

              {/* Soundtrack Card in Pure Book Style */}
              <div className="bg-gradient-to-r from-white/[0.04] via-earth-gold/[0.08] to-white/[0.04] border border-earth-gold/25 rounded-2xl p-4 flex items-center gap-4 text-left shadow-inner">
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-earth-clay via-earth-gold to-amber-200 flex items-center justify-center text-black shrink-0 relative overflow-hidden shadow-lg shadow-earth-gold/20">
                  <Music className="w-5 h-5 fill-current animate-pulse text-black" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm sm:text-base font-bold text-white truncate font-serif">{songInfo?.song}</h4>
                  <p className={`text-xs font-medium truncate ${theme.accent}`}>{songInfo?.artist}</p>
                </div>
              </div>

              {/* Countdown & Action Button */}
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center text-[10px] text-earth-light/60 font-mono px-1">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Volume2 className="w-3.5 h-3.5 text-earth-gold animate-pulse" />
                    Muziekspeler wordt geopend
                  </span>
                  <span className="font-bold text-earth-gold bg-earth-gold/10 px-2.5 py-0.5 rounded-full border border-earth-gold/25">
                    {countdown > 0 ? `0:0${countdown}s` : 'Nu starten...'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleProceedImmediately}
                  className={`w-full py-3.5 bg-gradient-to-r ${theme.buttonClass} font-bold rounded-full text-xs sm:text-sm transition-all transform active:scale-98 uppercase tracking-wider shadow-xl shadow-earth-gold/15 hover:shadow-earth-gold/30 inline-flex items-center justify-center gap-2 cursor-pointer border`}
                >
                  <LockOpen className="w-4 h-4" />
                  <span>Ontgrendel & Luister Direct</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
