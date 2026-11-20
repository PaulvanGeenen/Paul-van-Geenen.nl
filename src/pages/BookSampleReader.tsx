import { useState, useEffect, useCallback, useRef, type TouchEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { BOOKS } from '../data/books';

type ReaderTheme = 'day' | 'sepia' | 'night';

interface ChapterEntry {
  title: string;
  subtitle?: string;
  page: number;
}

const TOTAL_PAGES = 37;

const SAMPLE_CHAPTERS: ChapterEntry[] = [
  { title: 'Omslag', page: 1 },
  { title: 'Inhoudsopgave', page: 5 },
  { title: 'Noot van de auteur', page: 7 },
  { title: 'Proloog', page: 11 },
  { title: '1. Koude vingers', page: 13 },
  { title: '2. As en As', page: 23 },
  { title: '3. Veilige Toetsen', page: 28 },
];

const getPageSrc = (page: number): string =>
  `/inkijk/de-geboorte-van-de-leeuw/page-${String(page).padStart(2, '0')}.jpg`;

export function BookSampleReader() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const book = BOOKS.find((b) => b.slug === slug) ?? BOOKS.find((b) => b.slug === 'de-geboorte-van-de-leeuw');

  // Spread / single-page state.
  // In 2-page spread mode: page 1 is cover (shown alone on right/center),
  // then spreads are [2,3], [4,5], ..., [36,37] so odd pages are always on the right!
  const [isSpread, setIsSpread] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 900 : true
  );
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev' | null>(null);
  const [isFlipping, setIsFlipping] = useState<boolean>(false);
  const [flipActive, setFlipActive] = useState<boolean>(false);
  const [flipSnapshot, setFlipSnapshot] = useState<{ front: number; back: number } | null>(null);

  // Reader GUI controls
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [theme, setTheme] = useState<ReaderTheme>('day');
  const [showToc, setShowToc] = useState<boolean>(false);
  const [showTypography, setShowTypography] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const flipTimerRef = useRef<number | null>(null);

  // Update spread mode on resize
  useEffect(() => {
    const handleResize = () => {
      setIsSpread(window.innerWidth >= 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Normalize currentPage when switching to spread mode so left page is even (or 1 for cover)
  useEffect(() => {
    if (isSpread && currentPage > 1 && currentPage % 2 === 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [isSpread, currentPage]);

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

  // Preload adjacent pages for instant smooth page turns
  useEffect(() => {
    const pagesToPreload = [
      currentPage - 2,
      currentPage - 1,
      currentPage + 1,
      currentPage + 2,
      currentPage + 3,
      currentPage + 4,
    ].filter((p) => p >= 1 && p <= TOTAL_PAGES);

    pagesToPreload.forEach((p) => {
      const img = new Image();
      img.src = getPageSrc(p);
    });
  }, [currentPage]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
    };
  }, []);

  // Compute left & right pages in spread mode
  const leftPage: number | null = isSpread
    ? currentPage === 1
      ? null
      : currentPage % 2 === 0
      ? currentPage
      : currentPage - 1
    : null;

  const rightPage: number | null = isSpread
    ? currentPage === 1
      ? 1
      : leftPage !== null && leftPage + 1 <= TOTAL_PAGES
      ? leftPage + 1
      : null
    : currentPage;

  const canGoPrev = currentPage > 1;
  const canGoNext = isSpread
    ? currentPage === 1 || (leftPage !== null && leftPage + 2 <= TOTAL_PAGES)
    : currentPage < TOTAL_PAGES;

  const triggerFlip = useCallback(
    (targetPage: number, direction: 'next' | 'prev') => {
      if (isFlipping) return;
      const clamped = Math.max(1, Math.min(TOTAL_PAGES, targetPage));
      const normalized =
        isSpread && clamped > 1 && clamped % 2 === 1 ? clamped - 1 : clamped;

      if (normalized === currentPage) return;

      if (isSpread) {
        if (direction === 'next') {
          const curRight = currentPage === 1 ? 1 : currentPage + 1;
          const nextLeft = normalized;
          setFlipSnapshot({ front: curRight, back: nextLeft });
        } else {
          const curLeft = currentPage;
          const prevRight = normalized === 1 ? 1 : normalized + 1;
          setFlipSnapshot({ front: prevRight, back: curLeft });
        }
      } else {
        setFlipSnapshot({ front: currentPage, back: normalized });
      }

      setFlipDirection(direction);
      setFlipActive(false);
      setIsFlipping(true);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setFlipActive(true);
        });
      });

      if (flipTimerRef.current) window.clearTimeout(flipTimerRef.current);
      flipTimerRef.current = window.setTimeout(() => {
        setCurrentPage(normalized);
        setIsFlipping(false);
        setFlipActive(false);
        setFlipDirection(null);
        setFlipSnapshot(null);
      }, 480);
    },
    [currentPage, isFlipping, isSpread]
  );

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    if (isSpread) {
      const next = currentPage === 1 ? 2 : currentPage + 2;
      triggerFlip(next, 'next');
    } else {
      triggerFlip(currentPage + 1, 'next');
    }
  }, [canGoNext, currentPage, isSpread, triggerFlip]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    if (isSpread) {
      const prev = currentPage <= 2 ? 1 : currentPage - 2;
      triggerFlip(prev, 'prev');
    } else {
      triggerFlip(currentPage - 1, 'prev');
    }
  }, [canGoPrev, currentPage, isSpread, triggerFlip]);

  const jumpToPage = (page: number) => {
    setShowToc(false);
    const normalized = isSpread && page > 1 && page % 2 === 1 ? page - 1 : page;
    if (normalized === currentPage) return;
    triggerFlip(normalized, normalized > currentPage ? 'next' : 'prev');
  };

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
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev]);

  // Fullscreen sync
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
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

  // Touch swipe handlers (active when zoom === 100 so zoomed pan doesn't accidentally turn pages)
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (zoomPercent > 100) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (zoomPercent > 100 || touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) goNext();
      else goPrev();
    }
  };

  // Theme styling for pages & iPad screen
  const screenBgClass =
    theme === 'night'
      ? 'bg-[#141416] text-stone-200'
      : theme === 'sepia'
      ? 'bg-[#efe6d5] text-stone-900'
      : 'bg-[#f4f1ea] text-stone-900';

  const toolbarClass =
    theme === 'night'
      ? 'bg-[#1c1c1f]/90 border-white/10 text-stone-200'
      : theme === 'sepia'
      ? 'bg-[#e7dcc7]/90 border-stone-400/25 text-stone-800'
      : 'bg-white/85 border-stone-300/60 text-stone-800';

  const pageFilterStyle =
    theme === 'night'
      ? { filter: 'invert(0.92) hue-rotate(180deg) contrast(0.94) brightness(0.92)' }
      : theme === 'sepia'
      ? { filter: 'sepia(0.28) brightness(0.97) contrast(0.98)' }
      : undefined;

  const pageLabel = isSpread
    ? leftPage && rightPage
      ? `Pagina ${leftPage}–${rightPage} van ${TOTAL_PAGES}`
      : `Omslag • Pagina ${rightPage ?? leftPage} van ${TOTAL_PAGES}`
    : `Pagina ${currentPage} van ${TOTAL_PAGES}`;

  const isAtSampleEnd = isSpread ? (rightPage ?? 0) >= TOTAL_PAGES : currentPage >= TOTAL_PAGES;

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="min-h-screen w-full bg-gradient-to-br from-[#161311] via-[#1f1a17] to-[#0f0d0c] flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 select-none overflow-hidden"
    >
      {/* Hide content if user tries to print */}
      <style>{`
        @media print { body { display: none !important; } }
        .book-perspective { perspective: 2400px; }
        .book-leaf {
          transform-style: preserve-3d;
          transition: transform 480ms cubic-bezier(0.45, 0.05, 0.25, 1);
        }
        .book-leaf-face {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .book-leaf-back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: rotateY(180deg);
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
              {/* Quick A- / A+ inline buttons on desktop, plus AA popover */}
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

              {/* Font size / zoom */}
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

              {/* Paper theme */}
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
                Dit inkijkexemplaar bevat het voorwerk, de proloog en de eerste drie hoofdstukken (tot Warm Porselein).
              </div>
            </div>
          )}

          {/* Main Book Stage */}
          <div
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className="relative flex-1 flex items-center justify-center overflow-auto p-3 sm:p-6 md:p-8"
          >
            {/* Left / Right tap-or-click page-turn arrows */}
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev || isFlipping}
              aria-label="Vorige pagina"
              className="hidden sm:flex absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full items-center justify-center bg-black/10 hover:bg-black/20 backdrop-blur-sm transition-all disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext || isFlipping}
              aria-label="Volgende pagina"
              className="hidden sm:flex absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full items-center justify-center bg-black/10 hover:bg-black/20 backdrop-blur-sm transition-all disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Zoomable Book Wrapper */}
            <div
              className="book-perspective relative flex items-center justify-center transition-transform duration-200 origin-center"
              style={{
                transform: `scale(${zoomPercent / 100})`,
                transformOrigin: zoomPercent > 100 ? 'top center' : 'center center',
              }}
            >
              {isSpread ? (
                /* TWO-PAGE OPEN BOOK SPREAD */
                <div
                  className={`relative flex items-stretch shadow-[0_24px_60px_rgba(0,0,0,0.35)] rounded-sm overflow-hidden ${
                    leftPage === null ? 'w-[340px] md:w-[410px] lg:w-[450px]' : 'w-[680px] md:w-[820px] lg:w-[900px]'
                  } max-w-[92vw]`}
                  style={{
                    height: 'min(70vh, 660px)',
                    width:
                      leftPage === null
                        ? 'calc(min(70vh, 660px) * 0.67)'
                        : 'calc(min(70vh, 660px) * 1.34)',
                  }}
                >
                  {/* Left Page (when past cover) */}
                  {leftPage !== null && (
                    <div
                      onClick={zoomPercent === 100 ? goPrev : undefined}
                      className="relative w-1/2 h-full bg-white overflow-hidden cursor-pointer group"
                      title={canGoPrev ? 'Klik voor vorige pagina' : undefined}
                    >
                      <img
                        src={getPageSrc(leftPage)}
                        alt={`Pagina ${leftPage}`}
                        draggable={false}
                        style={pageFilterStyle}
                        className="w-full h-full object-contain pointer-events-none select-none"
                      />
                      {/* Realistic inner spine shadow */}
                      <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/18 via-black/5 to-transparent pointer-events-none" />
                      {/* Protective transparent shield against save/drag */}
                      <div className="absolute inset-0 z-10" />
                    </div>
                  )}

                  {/* Center Spine Crease */}
                  {leftPage !== null && rightPage !== null && (
                    <div className="w-[1px] bg-black/25 z-20 shrink-0" />
                  )}

                  {/* Right Page */}
                  {rightPage !== null && (
                    <div
                      onClick={zoomPercent === 100 ? goNext : undefined}
                      className={`relative ${
                        leftPage === null ? 'w-full' : 'w-1/2'
                      } h-full bg-white overflow-hidden cursor-pointer`}
                      title={canGoNext ? 'Klik voor volgende pagina' : undefined}
                    >
                      <img
                        src={getPageSrc(rightPage)}
                        alt={`Pagina ${rightPage}`}
                        draggable={false}
                        style={pageFilterStyle}
                        className="w-full h-full object-contain pointer-events-none select-none"
                      />
                      {leftPage !== null && (
                        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/15 via-black/5 to-transparent pointer-events-none" />
                      )}
                      <div className="absolute inset-0 z-10" />
                    </div>
                  )}

                  {/* 3D Animated Turning Leaf Overlay */}
                  {isFlipping && flipSnapshot && leftPage !== null && (
                    <div
                      className="book-leaf absolute top-0 right-0 w-1/2 h-full z-30 pointer-events-none"
                      style={{
                        transformOrigin: 'left center',
                        transform:
                          flipDirection === 'next'
                            ? flipActive
                              ? 'rotateY(-180deg)'
                              : 'rotateY(0deg)'
                            : flipActive
                            ? 'rotateY(0deg)'
                            : 'rotateY(-180deg)',
                      }}
                    >
                      {/* Front of turning leaf */}
                      <div className="book-leaf-face absolute inset-0 bg-white overflow-hidden shadow-xl">
                        <img
                          src={getPageSrc(flipSnapshot.front)}
                          alt=""
                          draggable={false}
                          style={pageFilterStyle}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black/20 to-transparent" />
                      </div>
                      {/* Back of turning leaf */}
                      <div className="book-leaf-back absolute inset-0 bg-white overflow-hidden shadow-xl">
                        <img
                          src={getPageSrc(flipSnapshot.back)}
                          alt=""
                          draggable={false}
                          style={pageFilterStyle}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/20 to-transparent" />
                      </div>
                    </div>
                  )}

                  {/* Cover flip animation (from centered cover to first spread) */}
                  {isFlipping && flipSnapshot && leftPage === null && (
                    <div
                      className="book-leaf absolute inset-0 z-30 pointer-events-none"
                      style={{
                        transformOrigin: 'left center',
                        transform:
                          flipDirection === 'next' && flipActive ? 'rotateY(-110deg)' : 'rotateY(0deg)',
                        opacity: flipDirection === 'next' && flipActive ? 0.25 : 1,
                      }}
                    >
                      <div className="book-leaf-face absolute inset-0 bg-white overflow-hidden shadow-2xl">
                        <img
                          src={getPageSrc(flipSnapshot.front)}
                          alt=""
                          draggable={false}
                          style={pageFilterStyle}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* SINGLE-PAGE MOBILE / PORTRAIT VIEW */
                <div
                  className="relative bg-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] rounded-sm overflow-hidden"
                  style={{
                    height: 'min(72vh, 640px)',
                    width: 'calc(min(72vh, 640px) * 0.67)',
                    maxWidth: '92vw',
                  }}
                >
                  <div
                    className={`w-full h-full transition-all duration-300 ${
                      isFlipping
                        ? flipDirection === 'next'
                          ? '-translate-x-4 opacity-40 scale-[0.98]'
                          : 'translate-x-4 opacity-40 scale-[0.98]'
                        : 'translate-x-0 opacity-100 scale-100'
                    }`}
                  >
                    <img
                      src={getPageSrc(currentPage)}
                      alt={`Pagina ${currentPage}`}
                      draggable={false}
                      style={pageFilterStyle}
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />
                  </div>
                  {/* Tap left / right zones on mobile */}
                  {zoomPercent === 100 && (
                    <>
                      <button
                        type="button"
                        onClick={goPrev}
                        aria-label="Vorige pagina"
                        className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={goNext}
                        aria-label="Volgende pagina"
                        className="absolute inset-y-0 right-0 w-1/3 z-10 cursor-pointer"
                      />
                    </>
                  )}
                </div>
              )}
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

          {/* Bottom Apple Books Scrubber Bar */}
          <footer
            className={`relative z-30 px-4 sm:px-8 py-2.5 border-t backdrop-blur-md flex items-center gap-3 sm:gap-5 ${toolbarClass}`}
          >
            <button
              type="button"
              onClick={goPrev}
              disabled={!canGoPrev || isFlipping}
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
              disabled={!canGoNext || isFlipping}
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
