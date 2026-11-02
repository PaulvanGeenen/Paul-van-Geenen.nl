import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BOOKS } from '../data/books';
import type { Book as BookType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Music, AlertCircle, Loader2, Sparkles, Volume2, BookOpen } from 'lucide-react';
import { transipPost, getQrCodeByCode } from '../lib/transip';

// Visual branding and theme overrides matching the physical hardcovers
function getBookTheme(bookId: string) {
  switch (bookId) {
    case '1': // Proloog - Warm Clay / Charcoal Earth
      return {
        bgClass: 'from-[#19110e] via-[#2a1b14] to-[#120d0b]',
        accent: 'text-earth-clay', 
        badgeBg: 'bg-earth-clay/20 text-earth-light border-earth-clay/35',
        glow: 'bg-earth-clay/15',
        progressBar: 'from-earth-clay to-earth-gold',
        cardBorder: 'border-earth-clay/20',
        label: 'Proloog'
      };
    case '2': // Vorming - Rust / Dark Amber
      return {
        bgClass: 'from-[#1a120b] via-[#301c0c] to-[#110b06]',
        accent: 'text-orange-400', 
        badgeBg: 'bg-orange-500/20 text-orange-200 border-orange-500/35',
        glow: 'bg-orange-500/15',
        progressBar: 'from-orange-500 to-yellow-500',
        cardBorder: 'border-orange-500/20',
        label: 'Vorming'
      };
    case '3': // De Echo - Emerald Deep / Antique Gold
      return {
        bgClass: 'from-[#030f0b] via-[#071f14] to-[#010705]',
        accent: 'text-[#cfa153]', 
        badgeBg: 'bg-[#cfa153]/20 text-[#ffe5b8] border-[#cfa153]/35',
        glow: 'bg-[#cfa153]/20',
        progressBar: 'from-[#cfa153] to-[#1DB954]',
        cardBorder: 'border-[#cfa153]/25',
        label: 'De Echo'
      };
    case '4': // De Bestemming - Steel Dark Blue / Silver Slate
      return {
        bgClass: 'from-[#060810] via-[#101424] to-[#020306]',
        accent: 'text-[#8fa3db]', 
        badgeBg: 'bg-[#8fa3db]/20 text-indigo-100 border-[#8fa3db]/35',
        glow: 'bg-indigo-500/15',
        progressBar: 'from-indigo-400 to-[#1DB954]',
        cardBorder: 'border-indigo-400/20',
        label: 'De Bestemming'
      };
    default:
      return {
        bgClass: 'from-earth-dark/95 via-earth-clay/5 to-earth-dark/95',
        accent: 'text-earth-gold',
        badgeBg: 'bg-earth-clay/10 text-earth-light/80 border-white/10',
        glow: 'bg-earth-gold/15',
        progressBar: 'from-earth-gold to-emerald-400',
        cardBorder: 'border-white/10',
        label: 'Muziekfragment'
      };
  }
}

async function recordScan(redirectCode: string, data: any, book: BookType | null) {
  try {
    // 1. Client-side IP Geolocation for high precision (free lookup)
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

    // 2. Identify human device type from userAgent
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

    // 3. Post event registration directly to TransIP MySQL database
    try {
      await transipPost('qr_scan', scanPayload);
      console.log('[Analytics] QR Scan successfully registered in TransIP MySQL database.');
    } catch (transipErr) {
      console.warn('[Analytics] Direct TransIP scan logging warning:', transipErr);
    }

    // 4. Also notify Express backend if running in fullstack dev
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

// Converts standard Spotify URLs to app-launching native URI links
function convertToSpotifyUri(url: string): string | null {
  try {
    const cleanUrl = url.trim();
    // Match track format
    const trackMatch = cleanUrl.match(/\/track\/([a-zA-Z0-9]+)/);
    if (trackMatch) {
      const trackId = trackMatch[1];
      // Get context parameter (like playlist backlink) if present
      const contextMatch = cleanUrl.match(/[?&]context=([^&]+)/);
      const context = contextMatch ? decodeURIComponent(contextMatch[1]) : '';
      return `spotify:track:${trackId}${context ? `?context=${context}` : ''}`;
    }
    
    // Match playlist format
    const playlistMatch = cleanUrl.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (playlistMatch) {
      const playlistId = playlistMatch[1];
      return `spotify:playlist:${playlistId}`;
    }

    // Match album format
    const albumMatch = cleanUrl.match(/\/album\/([a-zA-Z0-9]+)/);
    if (albumMatch) {
      const albumId = albumMatch[1];
      return `spotify:album:${albumId}`;
    }
  } catch (e) {
    console.warn('[Spotify Uri Conversion] Error:', e);
  }
  return null;
}

// Helper to enrich a track link with the books' playlist context if context is missing
function enrichSpotifyLink(url: string, bookId: string): string {
  try {
    const cleanUrl = url.trim();
    // Only enrich standard track links that don't already have a context parameter
    if (cleanUrl.includes('/track/') && !cleanUrl.includes('context=')) {
      // Books 3 (De Echo) and 4 (De Bestemming) use the same primary book soundtrack playlist on Spotify
      const playlistId = '3hHvf4bx4V0vFpKhmdXloJ';
      const separator = cleanUrl.includes('?') ? '&' : '?';
      const enriched = `${cleanUrl}${separator}context=spotify:playlist:${playlistId}`;
      console.log('[Spotify Enricher] Inline linked track to playlist context:', enriched);
      return enriched;
    }
  } catch (err) {
    console.warn('[Spotify Enricher] Error enrich:', err);
  }
  return url;
}

export function QRRedirect() {
  const { qrCode } = useParams<{ qrCode: string }>();
  const navigate = useNavigate();
  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(7); // 7 seconds screen allows looking at the beautiful cover
  
  const [songInfo, setSongInfo] = useState<{
    song: string;
    artist: string;
    spotifyLink: string;
    hoofdstuk?: string;
    boekId?: string;
    boekTitel?: string;
  } | null>(null);
  
  const [matchedBook, setMatchedBook] = useState<BookType | null>(null);

  // Fetch mapping details from Firestore
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

      // Instantly dismiss any static system/asset file paths
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
          if (data.spotifyLink) {
            // Locate target book details to extract physical cover and style theme
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

            if (active) {
              setMatchedBook(foundBook);
              const bookIdStr = String(data.boekId || foundBook?.id || '');
              const enrichedLink = enrichSpotifyLink(data.spotifyLink || '', bookIdStr);

              setSongInfo({
                song: data.song || 'Onbekend nummer',
                artist: data.artist || 'Onbekende artiest',
                spotifyLink: enrichedLink,
                hoofdstuk: data.hoofdstuk || 'Onbekend fragment',
                boekId: data.boekId,
                boekTitel: data.boekTitel
              });
              setLoading(false);
              
              // Record scan details
              recordScan(cleanCode, data, foundBook);
            }
          } else {
            if (active) {
              setError('Deze QR-code is geregistreerd, maar bevat momenteel geen gekoppelde Spotify link.');
              setLoading(false);
            }
          }
        } else {
          if (active) {
            setError(`Deze fragmentlink "${cleanCode}" bestaat niet of is gewijzigd.`);
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

  // Helper to trigger deep link or web fallback
  const triggerSpotifyRedirect = (spotifyWebUrl: string) => {
    const nativeUri = convertToSpotifyUri(spotifyWebUrl);
    if (isMobile) {
      if (nativeUri) {
        console.log('[Spotify Redirect] Mobile auto redirection directly to native URI:', nativeUri);
        // By setting location.href directly to the native URI (spotify:track:...), the OS trigger prompt to open Spotify
        // is issued instantly. We do NOT replace standard location automatically to prevent force-loading the unlogged browser player.
        window.location.href = nativeUri;
      } else {
        console.log('[Spotify Redirect] Mobile auto redirection fallback to safe HTTPS URL:', spotifyWebUrl);
        window.location.replace(spotifyWebUrl);
      }
    } else {
      if (nativeUri) {
        console.log('[Spotify Redirect] Opening native Spotify App link on desktop:', nativeUri);
        window.location.href = nativeUri;
        
        setTimeout(() => {
          window.location.replace(spotifyWebUrl);
        }, 4000);
      } else {
        console.log('[Spotify Redirect] Falling back to standard web redirect:', spotifyWebUrl);
        window.location.replace(spotifyWebUrl);
      }
    }
  };

  // Handle countdown and seamless silent redirect
  useEffect(() => {
    if (loading || error || !songInfo) return;

    let timer: NodeJS.Timeout | null = null;

    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else {
      console.log('[QR Redirect] Triggering seamless automatic redirection:', songInfo.spotifyLink);
      triggerSpotifyRedirect(songInfo.spotifyLink);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown, loading, error, songInfo, isMobile]);

  // Handle immediate forward when clicked by the user
  const handleProceedImmediately = () => {
    if (songInfo) {
      triggerSpotifyRedirect(songInfo.spotifyLink);
    }
  };

  const theme = getBookTheme(matchedBook?.id || '');

  return (
    <div className={`min-h-screen bg-gradient-to-b ${theme.bgClass} text-white flex flex-col justify-center items-center px-4 py-8 md:py-12 transition-all duration-1000 select-none`}>
      {/* Top running progress bar requested by user */}
      {!loading && !error && songInfo && (
        <div className="fixed top-0 left-0 w-full h-[6px] bg-white/5 z-50">
          <motion.div
            className={`bg-gradient-to-r ${theme.progressBar} h-full`}
            initial={{ width: "0%" }}
            animate={{ width: `${((7 - countdown) / 7) * 100}%` }}
            transition={{ duration: 1, ease: 'linear' }}
          />
        </div>
      )}

      {/* Immersive Background Blur Visual */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] rounded-full blur-[100px] sm:blur-[140px] opacity-20 mix-blend-screen transition-all duration-1000 animate-pulse ${theme.glow}`} />

      <div className="w-full max-w-lg z-10">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-black/45 border border-white/5 p-8 rounded-[28px] shadow-2xl backdrop-blur-md text-center space-y-6"
            >
              <div className="relative flex justify-center">
                <div className="absolute inset-0 bg-earth-gold/20 rounded-full blur-xl w-20 h-20 mx-auto animate-pulse" />
                <div className="relative w-14 h-14 bg-gradient-to-tr from-earth-gold to-yellow-300 rounded-full flex items-center justify-center text-earth-dark shadow-lg">
                  <Music className="w-7 h-7 animate-bounce" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-serif font-medium text-white tracking-wide">Paginacontext ophalen...</h3>
                <p className="text-earth-light/50 text-xs">Muziekfragment wordt ingeladen</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-earth-light/30 text-[11px] font-mono">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-earth-gold" />
                <span>Synchroniseren...</span>
              </div>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="bg-black/55 border border-red-500/10 p-8 rounded-[28px] shadow-2xl backdrop-blur-md text-center space-y-6"
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
                  onClick={() => navigate('/')}
                  className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full font-medium text-xs tracking-wider uppercase transition-all"
                >
                  Terug naar website
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="companion"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className={`bg-black/45 border ${theme.cardBorder} p-6 sm:p-8 rounded-[36px] shadow-[0_30px_70px_rgba(0,0,0,0.8)] backdrop-blur-xl text-center space-y-6 relative overflow-hidden`}
            >
              {/* Cover block styled strictly for book readers */}
              <div className="pt-4 flex justify-center">
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, rotate: -2 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{ delay: 0.1, duration: 0.6 }}
                  className="relative group"
                >
                  <div className={`absolute -inset-2.5 rounded-xl blur-xl opacity-40 ${theme.glow}`} />
                  {matchedBook ? (
                    <img
                      src={matchedBook.coverUrl}
                      alt={matchedBook.title}
                      className="relative w-40 sm:w-44 h-auto object-cover rounded-lg shadow-[0_20px_45px_rgba(0,0,0,0.7)] border border-white/5"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-36 h-48 bg-white/5 border border-white/5 rounded-lg flex flex-col items-center justify-center text-earth-light/35">
                      <BookOpen className="w-10 h-10 mb-1" />
                      <span className="text-[10px]">Muziek fragment</span>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Creative Copy framing the visual space */}
              <div className="space-y-1">
                <span className="text-earth-gold/60 text-[10px] tracking-widest uppercase font-mono flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 animate-pulse" />
                  Boeksoundtrack activeert...
                </span>
                
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide leading-tight max-w-sm mx-auto">
                  {songInfo?.hoofdstuk}
                </h2>
                
                <p className="text-[#ffe5b8]/80 text-xs max-w-xs mx-auto animate-pulse font-semibold">
                  {isMobile ? (
                    countdown > 0 
                      ? "De Spotify-app start over enkele seconden..." 
                      : "Verbindingsverzoek verstuurd naar de Spotify-app! ⚡"
                  ) : (
                    "De Spotify-app start over enkele seconden..."
                  )}
                </p>
              </div>

              {/* Seamless, minimal record strip */}
              <div className="bg-black/20 border border-white/5 rounded-2xl p-4 flex items-center gap-4 text-left">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1DB954] to-[#1ed760] flex items-center justify-center text-black shrink-0 relative overflow-hidden">
                  <Music className="w-5 h-5 fill-current animate-pulse text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate font-serif">{songInfo?.song}</h4>
                  <p className={`text-xs font-semibold truncate ${theme.accent}`}>{songInfo?.artist}</p>
                </div>
              </div>

              {/* Progress status layout with countdown */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between items-center text-[10px] text-earth-light/55 font-mono">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider">
                    <Volume2 className="w-3.5 h-3.5 text-earth-gold animate-pulse" />
                    App-koppeling gereed
                  </span>
                  <span className="font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/5">
                    {countdown > 0 ? `0:0${countdown}s` : 'App wordt geopend'}
                  </span>
                </div>
              </div>

              {/* Non-intrusive action buttons & instructions */}
              <div className="pt-2 space-y-3">
                {isMobile ? (
                  <a
                    href={songInfo ? (convertToSpotifyUri(songInfo.spotifyLink) || songInfo.spotifyLink) : undefined}
                    className="w-full py-3 bg-[#1DB954] active:bg-[#1ed760] text-black font-bold rounded-full text-xs sm:text-sm transition-all transform active:scale-98 uppercase tracking-wider shadow-lg shadow-[#1DB954]/10 hover:shadow-[#1DB954]/25 inline-flex items-center justify-center gap-2 cursor-pointer border border-[#1b9a47]"
                  >
                    <Music className="w-4 h-4" />
                    Open direct in Spotify App
                  </a>
                ) : (
                  <button
                    onClick={handleProceedImmediately}
                    className="w-full py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold rounded-full text-xs sm:text-sm transition-all transform active:scale-98 uppercase tracking-wider shadow-lg shadow-[#1DB954]/10 hover:shadow-[#1DB954]/25 inline-flex items-center justify-center gap-2 cursor-pointer border border-[#1b9a47]"
                  >
                    <Music className="w-4 h-4" />
                    Direct doorgaan naar Spotify
                  </button>
                )}

                {isMobile && (
                  <div className="text-center pt-0.5">
                    <a
                      href={songInfo?.spotifyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-earth-gold/80 hover:text-earth-gold underline text-[11px] transition-colors inline-block font-sans font-medium"
                    >
                      Geen Spotify app geïnstalleerd? Luister via de website &rarr;
                    </a>
                  </div>
                )}

                {/* Autoplay restriction disclaimer phrased beautifully */}
                <p className="text-earth-light/45 text-[11px] leading-relaxed max-w-sm mx-auto">
                  💡 <strong className="text-earth-gold">Belangrijke tip:</strong> Klik zometeen gerust op <strong className="text-white">"Openen"</strong> of <strong className="text-white">"Toestaan"</strong> als uw telefoon om toestemming vraagt. Zo opent en speelt het geluidsfragment meteen in uw eigen, ingelogde app!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
