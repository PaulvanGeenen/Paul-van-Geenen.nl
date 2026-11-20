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
} from 'lucide-react';
import { BOOKS } from '../data/books';

type ReaderTheme = 'day' | 'sepia' | 'night';

interface ChapterEntry {
  title: string;
  page: number;
}

const TOTAL_PAGES = 37;
const ILLUSTRATION_PAGES = new Set([1, 10, 22, 27, 32, 37]);

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

  const book =
    BOOKS.find((b) => b.slug === slug) ??
    BOOKS.find((b) => b.slug === 'de-geboorte-van-de-leeuw');

  // 1-based current page number for UI display
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');

  // Reader GUI controls
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [theme, setTheme] = useState<ReaderTheme>('day');
  const [showToc, setShowToc] = useState<boolean>(false);
  const [showTypography, setShowTypography] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookHostRef = useRef<HTMLDivElement | null>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);

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
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'inkijk-page';
      pageDiv.dataset.page = String(p);
      pageDiv.dataset.illustration = ILLUSTRATION_PAGES.has(p) ? '1' : '0';
      if (p === 1) {
        pageDiv.dataset.density = 'hard';
      }

      const img = document.createElement('img');
      img.src = getPageSrc(p);
      img.alt = `Pagina ${p}`;
      img.draggable = false;
      img.loading = p <= 6 ? 'eager' : 'lazy';
      img.className = 'inkijk-page-img';

      const shield = document.createElement('div');
      shield.className = 'inkijk-page-shield';

      pageDiv.appendChild(img);
      pageDiv.appendChild(shield);
      bookEl.appendChild(pageDiv);
      pageNodes.push(pageDiv);
    }

    host.appendChild(bookEl);

    const isMobile = window.innerWidth < 768;
    const pageFlip = new PageFlip(bookEl, {
      width: 440,
      height: 656,
      size: 'stretch',
      minWidth: isMobile ? 260 : 300,
      maxWidth: 520,
      minHeight: isMobile ? 385 : 445,
      maxHeight: 775,
      drawShadow: true,
      maxShadowOpacity: 0.48,
      flippingTime: 780,
      usePortrait: true,
      showCover: true,
      autoSize: true,
      showPageCorners: true,
      useMouseEvents: true,
      mobileScrollSupport: false,
      swipeDistance: 30,
      startPage: 0,
    });

    pageFlip.loadFromHTML(pageNodes);

    pageFlip.on('init', (e) => {
      if (e.data?.mode) setOrientation(e.data.mode);
      if (typeof e.data?.page === 'number') setCurrentPage(e.data.page + 1);
    });

    pageFlip.on('flip', (e) => {
      if (typeof e.data === 'number') {
        setCurrentPage(e.data + 1);
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
  }, []);

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
          height: min(72vh, 690px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .inkijk-page {
          position: relative;
          width: 100%;
          height: 100%;
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
          <div className="relative flex-1 flex items-center justify-center overflow-auto p-2 sm:p-5 md:p-6">
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

            {/* Zoomable FlipBook Host */}
            <div
              className="inkijk-flipbook-stage transition-transform duration-200"
              style={{
                transform: `scale(${zoomPercent / 100})`,
                transformOrigin: zoomPercent > 100 ? 'top center' : 'center center',
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
