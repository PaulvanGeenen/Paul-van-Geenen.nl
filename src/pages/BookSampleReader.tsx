import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { PageFlip } from 'page-flip';
import {
  ChevronLeft,
  ChevronRight,
  List,
  X,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Sun,
  Coffee,
  Moon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
  Share2,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react';
import { BOOKS } from '../data/books';
import { isOwnAnalyticsIgnored, getUserGeoLocation } from '../lib/analytics';
import { transipPost } from '../lib/transip';

type ReaderTheme = 'day' | 'sepia' | 'night';

interface ChapterEntry {
  title: string;
  page: number;
}

// Skip blank page 2 (empty verso after cover) so it is never shown forward or backward
const SAMPLE_PAGES: number[] = [1, ...Array.from({ length: 35 }, (_, i) => i + 3)];
const TOTAL_PAGES = SAMPLE_PAGES.length;
const ILLUSTRATION_PDF_PAGES = new Set([1, 10, 22, 27, 32, 37]);

const pdfPageToReaderPage = (pdfPage: number): number => {
  const idx = SAMPLE_PAGES.indexOf(pdfPage);
  return idx >= 0 ? idx + 1 : 1;
};

const SAMPLE_CHAPTERS: ChapterEntry[] = [
  { title: 'Omslag', page: pdfPageToReaderPage(1) },
  { title: 'Inhoudsopgave', page: pdfPageToReaderPage(5) },
  { title: 'Noot van de auteur', page: pdfPageToReaderPage(7) },
  { title: 'Proloog', page: pdfPageToReaderPage(11) },
  { title: '1. Koude vingers', page: pdfPageToReaderPage(13) },
  { title: '2. As en As', page: pdfPageToReaderPage(23) },
  { title: '3. Veilige Toetsen', page: pdfPageToReaderPage(28) },
];

const getPageSrc = (pdfPage: number): string =>
  `/inkijk/de-geboorte-van-de-leeuw/page-${String(pdfPage).padStart(2, '0')}.jpg`;

export function BookSampleReader() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const book =
    BOOKS.find((b) => b.slug === slug) ??
    BOOKS.find((b) => b.slug === 'de-geboorte-van-de-leeuw');

  // 1-based current page number for UI display
  const [currentPage, setCurrentPage] = useState<number>(1);
  const currentPageRef = useRef<number>(1);
  const [isPortraitViewport, setIsPortraitViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(() =>
    typeof window !== 'undefined' && window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  );

  // Keep ref in sync so orientation switch preserves reading position
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Listen for viewport orientation changes (portrait = 1 page, landscape = 2 pages)
  useEffect(() => {
    const updateViewportOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortraitViewport(portrait);
    };
    window.addEventListener('resize', updateViewportOrientation);
    window.addEventListener('orientationchange', updateViewportOrientation);
    return () => {
      window.removeEventListener('resize', updateViewportOrientation);
      window.removeEventListener('orientationchange', updateViewportOrientation);
    };
  }, []);

  // Reader GUI controls
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [theme, setTheme] = useState<ReaderTheme>('day');
  const [showToc, setShowToc] = useState<boolean>(false);
  const [showTypography, setShowTypography] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const shareSlug = book?.slug ?? 'de-geboorte-van-de-leeuw';
  const shareUrl = `https://paulvangeenen.nl/inkijkexemplaar/${shareSlug}`;
  const shareTitle = `Inkijkexemplaar — ${book?.title ?? 'De Geboorte van de Leeuw'}`;
  const shareText = `Lees het inkijkexemplaar van "${book?.title ?? 'De Geboorte van de Leeuw'}" van Paul van Geenen:`;

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareUrl(true);
      window.setTimeout(() => setCopiedShareUrl(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed
      }
    }
    handleCopyShareLink();
  };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const bookHostRef = useRef<HTMLDivElement | null>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);
  const zoomPercentRef = useRef<number>(100);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchStartRef = useRef<{ dist: number; zoom: number } | null>(null);
  const panDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    isPanning: boolean;
  } | null>(null);

  useEffect(() => {
    zoomPercentRef.current = zoomPercent;
    if (zoomPercent <= 100) {
      setPan({ x: 0, y: 0 });
    }
  }, [zoomPercent]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  // Native 2-finger pinch-to-zoom & 1-finger pan/scroll when zoomed in (capture phase so StPageFlip doesn't flip)
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const getTouchDist = (t: TouchList) =>
      Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        panDragRef.current = null;
        pinchStartRef.current = {
          dist: Math.max(10, getTouchDist(e.touches)),
          zoom: zoomPercentRef.current,
        };
      } else if (e.touches.length === 1 && zoomPercentRef.current > 100) {
        panDragRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          originX: panRef.current.x,
          originY: panRef.current.y,
          isPanning: false,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchStartRef.current) {
        e.preventDefault();
        e.stopPropagation();
        const dist = getTouchDist(e.touches);
        const scaleRatio = dist / pinchStartRef.current.dist;
        const nextZoom = Math.round(
          Math.max(85, Math.min(220, pinchStartRef.current.zoom * scaleRatio))
        );
        setZoomPercent(nextZoom);
      } else if (e.touches.length === 1 && panDragRef.current && zoomPercentRef.current > 100) {
        const dx = e.touches[0].clientX - panDragRef.current.startX;
        const dy = e.touches[0].clientY - panDragRef.current.startY;
        if (panDragRef.current.isPanning || Math.hypot(dx, dy) > 6) {
          panDragRef.current.isPanning = true;
          e.preventDefault();
          e.stopPropagation();

          const scale = zoomPercentRef.current / 100;
          const rect = stage.getBoundingClientRect();
          const maxPanX = Math.max(40, ((rect.width * (scale - 1)) / 2) + 40);
          const maxPanY = Math.max(80, ((rect.height * (scale - 1)) / 2) + 120);

          const nextX = Math.max(-maxPanX, Math.min(maxPanX, panDragRef.current.originX + dx));
          const nextY = Math.max(-maxPanY, Math.min(maxPanY, panDragRef.current.originY + dy));
          setPan({ x: nextX, y: nextY });
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        pinchStartRef.current = null;
      }
      if (e.touches.length === 0) {
        if (panDragRef.current?.isPanning) {
          e.stopPropagation();
        }
        panDragRef.current = null;
      }
    };

    stage.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
    stage.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    stage.addEventListener('touchend', onTouchEnd, { passive: true, capture: true });
    stage.addEventListener('touchcancel', onTouchEnd, { passive: true, capture: true });

    return () => {
      stage.removeEventListener('touchstart', onTouchStart, { capture: true });
      stage.removeEventListener('touchmove', onTouchMove, { capture: true });
      stage.removeEventListener('touchend', onTouchEnd, { capture: true });
      stage.removeEventListener('touchcancel', onTouchEnd, { capture: true });
    };
  }, []);

  // Track Inkijkexemplaar view (location, date & time) — automatically skips admin devices & admin IPs
  const loggedViewRef = useRef<boolean>(false);
  useEffect(() => {
    if (loggedViewRef.current) return;
    loggedViewRef.current = true;

    if (isOwnAnalyticsIgnored()) return;

    const detectDevice = (ua: string): string => {
      if (/iphone/i.test(ua)) return 'iPhone';
      if (/ipad/i.test(ua)) return 'iPad';
      if (/android/i.test(ua)) return /mobile/i.test(ua) ? 'Android Telefoon' : 'Android Tablet';
      if (/windows/i.test(ua)) return 'Windows PC';
      if (/macintosh/i.test(ua)) return 'Mac';
      if (/linux/i.test(ua)) return 'Linux';
      return 'Computer';
    };

    (async () => {
      try {
        const geo = await getUserGeoLocation();
        const sessionId = sessionStorage.getItem('boeken_analytics_session_id') || '';
        await transipPost('inkijk_view', {
          sessionId,
          bookSlug: book?.slug ?? 'de-geboorte-van-de-leeuw',
          bookTitle: book?.title ?? 'De Geboorte van de Leeuw',
          city: geo.city || 'Onbekend',
          country: geo.country || 'Nederland',
          lat: geo.lat ?? null,
          lng: geo.lng ?? null,
          deviceType: detectDevice(navigator.userAgent),
        });
      } catch {
        // Silent fail: never interrupt reading experience
      }
    })();
  }, [book?.slug, book?.title]);

  // Block Ctrl+S / Ctrl+P / Cmd+S / Cmd+P to protect sample pages
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Initialize StPageFlip (authentic iPad curved page-curl & drag-to-flip engine)
  useEffect(() => {
    const host = bookHostRef.current;
    if (!host) return;

    host.innerHTML = '';
    const bookEl = document.createElement('div');
    bookEl.className = 'inkijk-flipbook';

    const pageNodes: HTMLElement[] = [];
    for (let i = 0; i < SAMPLE_PAGES.length; i++) {
      const pdfPage = SAMPLE_PAGES[i];
      const readerPage = i + 1;
      const pageDiv = document.createElement('div');
      pageDiv.className = 'inkijk-page';
      pageDiv.dataset.page = String(readerPage);
      pageDiv.dataset.illustration = ILLUSTRATION_PDF_PAGES.has(pdfPage) ? '1' : '0';
      if (readerPage === 1) {
        pageDiv.dataset.density = 'hard';
      }

      const img = document.createElement('img');
      img.src = getPageSrc(pdfPage);
      img.alt = `Pagina ${readerPage}`;
      img.draggable = false;
      img.loading = 'eager';
      img.decoding = 'async';
      img.className = 'inkijk-page-img';

      const shield = document.createElement('div');
      shield.className = 'inkijk-page-shield';

      pageDiv.appendChild(img);
      pageDiv.appendChild(shield);
      bookEl.appendChild(pageDiv);
      pageNodes.push(pageDiv);
    }

    host.appendChild(bookEl);

    const aspect = 440 / 656;
    const isSmallScreen = window.innerWidth < 640;
    const availW = Math.max(240, window.innerWidth - (isSmallScreen ? 20 : 96));
    const availH = Math.max(340, window.innerHeight - (isSmallScreen ? 135 : 185));
    const portraitPageW = Math.floor(Math.min(availW, availH * aspect));
    const portraitPageH = Math.floor(portraitPageW / aspect);

    if (isPortraitViewport) {
      bookEl.style.width = `${portraitPageW}px`;
      bookEl.style.height = `${portraitPageH}px`;
    }

    const pageFlip = new PageFlip(bookEl, isPortraitViewport
      ? {
          width: portraitPageW,
          height: portraitPageH,
          size: 'fixed',
          minWidth: portraitPageW,
          maxWidth: portraitPageW,
          minHeight: portraitPageH,
          maxHeight: portraitPageH,
          drawShadow: true,
          maxShadowOpacity: 0.45,
          flippingTime: 700,
          usePortrait: true,
          showCover: true,
          autoSize: false,
          showPageCorners: true,
          useMouseEvents: true,
          mobileScrollSupport: false,
          swipeDistance: 30,
          startPage: Math.max(0, currentPageRef.current - 1),
        }
      : {
          width: 440,
          height: 656,
          size: 'stretch',
          minWidth: 220,
          maxWidth: 520,
          minHeight: 320,
          maxHeight: 775,
          drawShadow: true,
          maxShadowOpacity: 0.48,
          flippingTime: 780,
          usePortrait: false,
          showCover: true,
          autoSize: true,
          showPageCorners: true,
          useMouseEvents: true,
          mobileScrollSupport: false,
          swipeDistance: 30,
          startPage: Math.max(0, currentPageRef.current - 1),
        }
    );

    pageFlip.loadFromHTML(pageNodes);

    pageFlip.on('init', (e) => {
      if (e.data?.mode) setOrientation(e.data.mode);
      if (typeof e.data?.page === 'number') setCurrentPage(e.data.page + 1);
    });

    pageFlip.on('flip', (e) => {
      if (typeof e.data === 'number') {
        setCurrentPage(e.data + 1);
        setPan({ x: 0, y: 0 });
      }
    });

    pageFlip.on('changeOrientation', (e) => {
      if (e.data === 'landscape' || e.data === 'portrait') {
        setOrientation(e.data);
      }
    });

    pageFlipRef.current = pageFlip;

    const handleResize = () => {
      try {
        pageFlip.update();
      } catch {
        // Ignore resize race during unmount
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      pageFlipRef.current = null;
      try {
        pageFlip.destroy();
      } catch {
        // Ignore cleanup errors
      }
      if (host) host.innerHTML = '';
    };
  }, [isPortraitViewport]);

  const canGoPrev = currentPage > 1;
  const canGoNext =
    orientation === 'landscape'
      ? currentPage === 1 || currentPage + 1 < TOTAL_PAGES
      : currentPage < TOTAL_PAGES;

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    pageFlipRef.current?.flipNext('bottom');
  }, [canGoNext]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    pageFlipRef.current?.flipPrev('bottom');
  }, [canGoPrev]);

  const jumpToPage = useCallback((page: number) => {
    setShowToc(false);
    const idx = Math.max(0, Math.min(TOTAL_PAGES - 1, page - 1));
    const pf = pageFlipRef.current;
    if (!pf) return;
    const curIdx = pf.getCurrentPageIndex();
    if (Math.abs(idx - curIdx) <= 2) {
      pf.flip(idx, 'bottom');
    } else {
      pf.turnToPage(idx);
      setCurrentPage(idx + 1);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        setShowToc(false);
        setShowTypography(false);
        setShowShareModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev]);

  // Fullscreen sync
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => {
        try {
          pageFlipRef.current?.update();
        } catch {
          // ignore
        }
      }, 120);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen may be blocked by browser policy
    }
  };

  // Theme classes
  const screenBgClass =
    theme === 'night'
      ? 'bg-[#141416] text-stone-200 reader-theme-night'
      : theme === 'sepia'
      ? 'bg-[#efe6d5] text-stone-900 reader-theme-sepia'
      : 'bg-[#f4f1ea] text-stone-900 reader-theme-day';

  const toolbarClass =
    theme === 'night'
      ? 'bg-[#1c1c1f]/90 border-white/10 text-stone-200'
      : theme === 'sepia'
      ? 'bg-[#e7dcc7]/90 border-stone-400/25 text-stone-800'
      : 'bg-white/85 border-stone-300/60 text-stone-800';

  const isSpread = orientation === 'landscape';
  const leftPage = isSpread && currentPage > 1 ? currentPage : null;
  const rightPage =
    isSpread && currentPage > 1
      ? Math.min(TOTAL_PAGES, currentPage + 1)
      : currentPage;

  const pageLabel = isSpread
    ? currentPage === 1
      ? `Omslag • Pagina 1 van ${TOTAL_PAGES}`
      : leftPage !== null && rightPage !== leftPage
      ? `Pagina ${leftPage}–${rightPage} van ${TOTAL_PAGES}`
      : `Pagina ${currentPage} van ${TOTAL_PAGES}`
    : `Pagina ${currentPage} van ${TOTAL_PAGES}`;

  const isAtSampleEnd = isSpread ? rightPage >= TOTAL_PAGES : currentPage >= TOTAL_PAGES;

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="min-h-screen w-full bg-gradient-to-br from-[#161311] via-[#1f1a17] to-[#0f0d0c] flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 select-none overflow-hidden"
    >
      {/* Anti-print + PageFlip styling + Theme filters */}
      <style>{`
        @media print { body { display: none !important; } }

        .inkijk-flipbook-stage {
          width: 100%;
          max-width: 960px;
          height: min(76vh, 880px);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        @media (orientation: landscape) {
          .inkijk-flipbook-stage {
            height: min(72vh, 690px);
          }
        }

        .inkijk-page {
          background: #ffffff;
          overflow: hidden;
          box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.04);
        }

        .inkijk-page-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
          display: block;
        }

        .inkijk-page-shield {
          position: absolute;
          inset: 0;
          z-index: 5;
        }

        /* Subtle spine crease inside open pages */
        .inkijk-page.--left::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 28px;
          background: linear-gradient(to left, rgba(0,0,0,0.16), rgba(0,0,0,0.04) 45%, transparent);
          pointer-events: none;
          z-index: 6;
        }

        .inkijk-page.--right::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 28px;
          background: linear-gradient(to right, rgba(0,0,0,0.14), rgba(0,0,0,0.04) 45%, transparent);
          pointer-events: none;
          z-index: 6;
        }

        /* Night mode: invert text pages cleanly, keep illustrations natural & dimmed */
        .reader-theme-night .inkijk-page {
          background: #141416;
        }
        .reader-theme-night .inkijk-page[data-illustration="0"] .inkijk-page-img {
          filter: invert(0.92) hue-rotate(180deg) contrast(0.94) brightness(0.92);
        }
        .reader-theme-night .inkijk-page[data-illustration="1"] .inkijk-page-img {
          filter: brightness(0.84) contrast(1.04);
        }

        /* Sepia mode: warm paper tint for text, gentle warmth for illustrations */
        .reader-theme-sepia .inkijk-page {
          background: #f5ecdc;
        }
        .reader-theme-sepia .inkijk-page[data-illustration="0"] .inkijk-page-img {
          filter: sepia(0.28) brightness(0.97) contrast(0.98);
        }
        .reader-theme-sepia .inkijk-page[data-illustration="1"] .inkijk-page-img {
          filter: sepia(0.08) brightness(0.96);
        }
      `}</style>

      {/* Realistic iPad Hardware Bezel */}
      <div className="relative w-full max-w-[1280px] h-screen sm:h-[calc(100vh-2rem)] md:h-[calc(100vh-3rem)] sm:rounded-[34px] sm:p-[13px] md:p-[16px] bg-gradient-to-b from-[#2b2a29] via-[#181716] to-[#111010] sm:shadow-[0_32px_90px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.18)] sm:ring-1 sm:ring-white/10 flex flex-col">
        {/* Top-center iPad front camera */}
        <div className="hidden sm:flex items-center justify-center absolute top-[6px] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-[#09090b] ring-1 ring-white/10 flex items-center justify-center">
            <div className="w-0.5 h-0.5 rounded-full bg-sky-900/80" />
          </div>
        </div>

        {/* iPad Display Screen */}
        <div
          className={`relative flex-1 flex flex-col sm:rounded-[22px] overflow-hidden transition-colors duration-300 ${screenBgClass}`}
        >
          {/* Top Apple Books Style Reader Toolbar */}
          <header
            className={`relative z-30 flex items-center justify-between px-3 sm:px-5 py-2.5 border-b backdrop-blur-md transition-colors duration-300 ${toolbarClass}`}
          >
            {/* Left controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => navigate(`/boeken/${book?.slug ?? 'de-geboorte-van-de-leeuw'}`)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title="Terug naar boekpagina"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Terug</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowToc((v) => !v);
                  setShowTypography(false);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showToc ? 'bg-earth-clay/20 text-earth-clay' : 'hover:bg-black/5'
                }`}
                title="Inhoudsopgave"
              >
                <List className="w-4 h-4" />
                <span className="hidden md:inline">Inhoud</span>
              </button>
            </div>

            {/* Center title */}
            <div className="flex flex-col items-center text-center min-w-0 px-2">
              <span className="text-xs sm:text-sm font-serif font-semibold truncate max-w-[180px] sm:max-w-[340px]">
                {book?.title ?? 'De Geboorte van de Leeuw'}
              </span>
              <span className="text-[10px] tracking-wide opacity-65">
                Inkijkexemplaar • {pageLabel}
              </span>
            </div>

            {/* Right controls: AA (Font/Zoom + Theme) & Fullscreen */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="hidden md:flex items-center gap-0.5 rounded-lg border border-current/15 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setZoomPercent((z) => Math.max(85, z - 15))}
                  disabled={zoomPercent <= 85}
                  className="px-2 py-1 rounded text-xs font-serif font-semibold disabled:opacity-35 hover:bg-black/5 transition-colors"
                  title="Kleiner lettertype"
                >
                  A<span className="text-[10px]">-</span>
                </button>
                <span className="text-[11px] font-medium px-1.5 min-w-[42px] text-center opacity-75">
                  {zoomPercent}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomPercent((z) => Math.min(190, z + 15))}
                  disabled={zoomPercent >= 190}
                  className="px-2 py-1 rounded text-sm font-serif font-semibold disabled:opacity-35 hover:bg-black/5 transition-colors"
                  title="Groter lettertype"
                >
                  A<span className="text-[10px]">+</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowTypography((v) => !v);
                  setShowToc(false);
                  setShowShareModal(false);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-serif font-bold tracking-tight transition-colors ${
                  showTypography ? 'bg-earth-clay/20 text-earth-clay' : 'hover:bg-black/5'
                }`}
                title="Lettergrootte en leesmodus"
              >
                <span className="text-xs">A</span>
                <span className="text-sm">A</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowShareModal(true);
                  setShowToc(false);
                  setShowTypography(false);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-black/5 transition-colors"
                title="Deel inkijkexemplaar op socials"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Deel</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="hidden sm:inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                title={isFullscreen ? 'Volledig scherm sluiten' : 'Volledig scherm'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </header>

          {/* Typography / Font-Size & Reading Theme Popover */}
          {showTypography && (
            <div
              className={`absolute top-14 right-3 sm:right-5 z-40 w-72 rounded-2xl shadow-2xl border p-4 backdrop-blur-xl ${
                theme === 'night'
                  ? 'bg-[#232326]/95 border-white/15 text-stone-100'
                  : 'bg-white/95 border-stone-200 text-stone-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                  Weergave & Lettergrootte
                </span>
                <button
                  type="button"
                  onClick={() => setShowTypography(false)}
                  className="p-1 rounded-md opacity-60 hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="opacity-75">Lettergrootte</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{zoomPercent}%</span>
                    {zoomPercent !== 100 && (
                      <button
                        type="button"
                        onClick={() => setZoomPercent(100)}
                        className="inline-flex items-center gap-1 text-[11px] text-earth-clay hover:underline"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.max(85, z - 15))}
                    disabled={zoomPercent <= 85}
                    className="flex-1 py-2 rounded-xl border border-current/15 flex items-center justify-center gap-1.5 text-sm font-serif disabled:opacity-35 hover:bg-black/5"
                  >
                    <ZoomOut className="w-3.5 h-3.5" /> A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.min(190, z + 15))}
                    disabled={zoomPercent >= 190}
                    className="flex-1 py-2 rounded-xl border border-current/15 flex items-center justify-center gap-1.5 text-base font-serif font-semibold disabled:opacity-35 hover:bg-black/5"
                  >
                    <ZoomIn className="w-3.5 h-3.5" /> A+
                  </button>
                </div>
                <input
                  type="range"
                  min={85}
                  max={190}
                  step={5}
                  value={zoomPercent}
                  onChange={(e) => setZoomPercent(Number(e.target.value))}
                  className="w-full mt-2.5 accent-[#9A6B4C]"
                  aria-label="Lettergrootte schuifregelaar"
                />
              </div>

              <div>
                <span className="block text-xs opacity-75 mb-2">Leesmodus</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('day')}
                    className={`py-2 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      theme === 'day'
                        ? 'border-[#9A6B4C] ring-2 ring-[#9A6B4C]/30 bg-[#f8f6f1] text-stone-900'
                        : 'border-current/15 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Dag
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('sepia')}
                    className={`py-2 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      theme === 'sepia'
                        ? 'border-[#9A6B4C] ring-2 ring-[#9A6B4C]/30 bg-[#efe6d5] text-stone-900'
                        : 'border-current/15 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <Coffee className="w-4 h-4" />
                    Sepia
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('night')}
                    className={`py-2 px-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
                      theme === 'night'
                        ? 'border-[#9A6B4C] ring-2 ring-[#9A6B4C]/30 bg-[#18181b] text-stone-100'
                        : 'border-current/15 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Nacht
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Slide-over Table of Contents */}
          {showToc && (
            <div className="absolute inset-y-0 left-0 z-40 w-72 sm:w-80 shadow-2xl border-r border-current/10 backdrop-blur-xl bg-inherit flex flex-col pt-14">
              <div className="flex items-center justify-between px-5 py-3 border-b border-current/10">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-earth-clay" />
                  <span className="text-sm font-serif font-semibold">Inhoudsopgave</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToc(false)}
                  className="p-1 rounded-md opacity-60 hover:opacity-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {SAMPLE_CHAPTERS.map((ch) => {
                  const isActive =
                    currentPage === ch.page ||
                    (isSpread && (leftPage === ch.page || rightPage === ch.page));
                  return (
                    <button
                      key={ch.page}
                      type="button"
                      onClick={() => jumpToPage(ch.page)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm flex items-center justify-between transition-colors ${
                        isActive
                          ? 'bg-earth-clay/15 text-earth-clay font-semibold'
                          : 'hover:bg-black/5'
                      }`}
                    >
                      <span className="truncate pr-3">{ch.title}</span>
                      <span className="text-xs opacity-55 shrink-0">p. {ch.page}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-current/10 text-[11px] opacity-65 leading-relaxed">
                Sleep met je vinger of muis aan een hoek van de pagina, of klik op de pijlen om de pagina echt om te slaan.
              </div>
            </div>
          )}

          {/* Main Book Stage */}
          <div
            ref={stageRef}
            className={`relative flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-5 md:p-6 ${
              zoomPercent > 100 ? 'touch-none cursor-grab active:cursor-grabbing' : ''
            }`}
          >
            {/* Left / Right page-curl buttons */}
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              aria-label="Vorige pagina"
              className="hidden sm:flex absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full items-center justify-center bg-black/10 hover:bg-black/20 backdrop-blur-sm transition-all disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              aria-label="Volgende pagina"
              className="hidden sm:flex absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full items-center justify-center bg-black/10 hover:bg-black/20 backdrop-blur-sm transition-all disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Zoomable & Pannable FlipBook Host */}
            <div
              className="inkijk-flipbook-stage"
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoomPercent / 100})`,
                transformOrigin: 'center center',
                willChange: 'transform',
              }}
            >
              <div
                ref={bookHostRef}
                className="w-full h-full flex items-center justify-center drop-shadow-[0_24px_50px_rgba(0,0,0,0.32)]"
              />
            </div>
          </div>

          {/* End-of-sample subtle footer banner */}
          {isAtSampleEnd && (
            <div className="px-4 py-2 bg-earth-clay/15 border-t border-earth-clay/25 flex flex-wrap items-center justify-center gap-3 text-xs">
              <span className="font-medium">
                Einde van het inkijkexemplaar — verder lezen vanaf hoofdstuk 4 (<em>Warm Porselein</em>) in het volledige boek.
              </span>
              <Link
                to={`/boeken/${book?.slug ?? 'de-geboorte-van-de-leeuw'}`}
                className="font-semibold text-earth-clay hover:underline"
              >
                Terug naar boekinformatie →
              </Link>
            </div>
          )}

          {/* Share Modal */}
          {showShareModal && (
            <div
              onClick={() => setShowShareModal(false)}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md rounded-2xl bg-[#1c1917] text-stone-100 border border-[#c6a26c]/25 shadow-2xl p-6"
              >
                <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#c6a26c]/15 border border-[#c6a26c]/30 flex items-center justify-center text-[#e0bd82]">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-semibold leading-tight">
                        Deel inkijkexemplaar
                      </h3>
                      <p className="text-xs text-stone-400">
                        Directe link met mooie social-preview
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Sluiten"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Book preview card */}
                <div className="mt-4 p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3.5">
                  <img
                    src={getPageSrc(1)}
                    alt={book?.title ?? 'De Geboorte van de Leeuw'}
                    className="w-12 h-16 rounded-md object-cover shadow-md border border-white/15 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#e0bd82]">
                      Inkijkexemplaar • {TOTAL_PAGES} pagina&apos;s
                    </span>
                    <span className="block font-serif font-semibold text-sm text-white truncate mt-0.5">
                      {book?.title ?? 'De Geboorte van de Leeuw'}
                    </span>
                    <span className="block text-xs text-stone-400">
                      Paul van Geenen • Lion Books Publishing
                    </span>
                  </div>
                </div>

                {/* URL box */}
                <div className="mt-4">
                  <span className="block text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1.5">
                    Link naar inkijkexemplaar:
                  </span>
                  <div className="px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-[#e0bd82] truncate select-all">
                    {shareUrl}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-4 space-y-2.5">
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#e0bd82] hover:bg-[#ebd09f] text-stone-950 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    {copiedShareUrl ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Link gekopieerd!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Kopieer link naar klembord</span>
                      </>
                    )}
                  </button>

                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1a472a] hover:bg-[#215935] border border-[#2d7a49]/50 text-[#6ee79b] font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Deel direct via WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 text-stone-100 font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Share2 className="w-4 h-4 text-[#e0bd82]" />
                    <span>Deel via app...</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Apple Books Scrubber Bar */}
          <footer
            className={`relative z-30 px-4 sm:px-8 py-2.5 border-t backdrop-blur-md flex items-center gap-3 sm:gap-5 ${toolbarClass}`}
          >
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev}
              className="sm:hidden p-1.5 rounded-lg disabled:opacity-30"
              aria-label="Vorige pagina"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-[11px] font-medium opacity-65 shrink-0 hidden sm:inline">
              p. 1
            </span>

            <input
              type="range"
              min={1}
              max={TOTAL_PAGES}
              value={currentPage}
              onChange={(e) => jumpToPage(Number(e.target.value))}
              className="flex-1 h-1.5 accent-[#9A6B4C] cursor-pointer"
              aria-label="Paginaschuifregelaar"
            />

            <span className="text-[11px] font-medium opacity-65 shrink-0">
              {currentPage} / {TOTAL_PAGES}
            </span>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              className="sm:hidden p-1.5 rounded-lg disabled:opacity-30"
              aria-label="Volgende pagina"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
