import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BOOKS } from '../data/books';
import type { Book as BookType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';
import { transipPost, getQrCodeByCode } from '../lib/transip';
import {
  unlockTrack,
  unlockTrackByRawIdentifier
} from '../lib/trackLocks';
import { sanitizeMediaUrl, getTrackCoverJpg } from './Music';

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

  // Pure visual fade-in / fade-out sequence (no clutter text or buttons):
  // 'book-in' (fade in & 3s hold) -> 'cover-in' (fade in & 5s hold) -> 'cover-out' (fade to black) -> music player
  const [visualStage, setVisualStage] = useState<'book-in' | 'cover-in' | 'cover-out'>('book-in');
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

          const boekTitelVal = data.boekTitel || matchedAlbum?.title || 'De Geboorte van de Leeuw';
          const titleLower = boekTitelVal.toLowerCase();
          const isLeeuwBook =
            !titleLower ||
            titleLower.includes('geboorte') ||
            titleLower.includes('leeuw') ||
            titleLower.includes('bestemming') ||
            foundBook?.id === '3' ||
            foundBook?.id === '4';
          const resolvedBookCover = isLeeuwBook
            ? GEBOORTE_VAN_DE_LEEUW_BOOK_COVER
            : (foundBook?.coverUrl || GEBOORTE_VAN_DE_LEEUW_BOOK_COVER);

          // Resolve the SoundTrack's own album/art cover for the 5-second fade-in showcase
          const soundtrackCoverUrl = matchedTrack
            ? (getTrackCoverJpg(matchedTrack) ||
               sanitizeMediaUrl(matchedTrack.portraitJpg) ||
               sanitizeMediaUrl(matchedTrack.thumbnailJpg) ||
               sanitizeMediaUrl(matchedTrack.landscapeJpg) ||
               GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK)
            : GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK;

          // Wait briefly for the book cover image to decode so fade-in starts crisp, while preloading soundtrack & player art
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (!done) {
                done = true;
                resolve();
              }
            };
            const timer = setTimeout(finish, 900);
            const bookImg = new Image();
            bookImg.onload = () => { clearTimeout(timer); finish(); };
            bookImg.onerror = () => { clearTimeout(timer); finish(); };
            bookImg.src = resolvedBookCover;
          });

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
            setMatchedBook(foundBook);
            setSongInfo({
              song: matchedTrack?.title || songTitle,
              targetUrl,
              hoofdstuk: data.hoofdstuk || 'Boekfragment',
              boekId: data.boekId,
              boekTitel: boekTitelVal,
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

  const triggerPlayerRedirect = (targetUrl: string) => {
    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    sequenceTimersRef.current.forEach(t => clearTimeout(t));
    sequenceTimersRef.current = [];
    setIsFadingToBlack(true);
    performNavigation(targetUrl);
  };

  // Pure visual sequence:
  // 1. Book cover fades in and remains visible for 3 seconds
  // 2. Book cover fades out, SoundTrack cover fades in and remains visible for 5 seconds
  // 3. SoundTrack cover fades out to pure black and launches the Music Player
  useEffect(() => {
    if (loading || error || !songInfo) return;

    sequenceTimersRef.current.forEach(t => clearTimeout(t));
    sequenceTimersRef.current = [];

    setVisualStage('book-in');

    const tCoverIn = setTimeout(() => {
      setVisualStage('cover-in');
    }, 3000);

    const tCoverOut = setTimeout(() => {
      setVisualStage('cover-out');
      setIsFadingToBlack(true);
    }, 8650);

    const tRedirect = setTimeout(() => {
      triggerPlayerRedirect(songInfo.targetUrl);
    }, 9500);

    sequenceTimersRef.current = [tCoverIn, tCoverOut, tRedirect];

    return () => {
      sequenceTimersRef.current.forEach(t => clearTimeout(t));
      sequenceTimersRef.current = [];
    };
  }, [loading, error, songInfo]);

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
    <div className="min-h-screen w-full bg-black text-white flex flex-col justify-center items-center p-4 sm:p-8 select-none relative overflow-hidden">
      <div className="w-full h-full flex items-center justify-center z-10">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full h-full"
            />
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="bg-black/80 border border-red-500/20 p-8 rounded-[28px] shadow-2xl backdrop-blur-md text-center space-y-6 max-w-md"
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
            /* STAGE 2: Pure SoundTrack Cover Fade-in (holds 5 seconds, then fades out cleanly to player) */
            <motion.div
              key="soundtrack-cover-showcase"
              initial={{ opacity: 0 }}
              animate={{ opacity: visualStage === 'cover-out' ? 0 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-center"
            >
              <img
                src={songInfo?.soundtrackCoverUrl || GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK}
                alt={songInfo?.song || 'SoundTrack Cover'}
                className="w-[min(86vw,440px)] sm:w-[min(72vh,500px)] aspect-square object-contain rounded-2xl shadow-[0_25px_85px_rgba(0,0,0,0.95)]"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK && !target.src.endsWith('Leeuw%20Album.jpg')) {
                    target.src = GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK;
                  }
                }}
              />
            </motion.div>
          ) : (
            /* STAGE 1: Pure Book Cover Fade-in (3 seconds hold, zero text or buttons) */
            <motion.div
              key="book-stage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="flex items-center justify-center"
            >
              <img
                src={displayBookCover}
                alt={displayBookTitle}
                className="max-h-[80vh] max-w-[88vw] w-auto h-auto object-contain rounded-2xl shadow-[0_25px_85px_rgba(0,0,0,0.95)]"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src !== GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK && !target.src.endsWith('Leeuw%20Album.jpg')) {
                    target.src = GEBOORTE_VAN_DE_LEEUW_ALBUM_FALLBACK;
                  }
                }}
              />
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
