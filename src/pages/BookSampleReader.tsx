import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  RotateCcw,
  BookOpen,
  Share2,
  Copy,
  Check,
  MessageCircle,
  Type,
} from 'lucide-react';
import { BOOKS } from '../data/books';
import inkijkEpubData from '../data/inkijk-de-geboorte-van-de-leeuw.json';
import { isOwnAnalyticsIgnored, getUserGeoLocation } from '../lib/analytics';
import { transipPost } from '../lib/transip';

type ReaderTheme = 'day' | 'sepia' | 'night';
type ReaderFont = 'serif' | 'garamond' | 'sans';

interface EpubSection {
  id: string;
  index: number;
  title: string;
  tocLabel: string | null;
  type: string;
  html: string;
}

interface PaginatedPage {
  pageNumber: number;
  sectionIndex: number;
  sectionTitle: string;
  kind: 'cover' | 'fpi' | 'centered' | 'text';
  html: string;
}

interface TocEntry {
  title: string;
  sectionIndex: number;
  page: number;
}

const FONT_FAMILIES: Record<ReaderFont, { label: string; css: string }> = {
  serif: {
    label: 'Boek Serif',
    css: "Georgia, 'Palatino Linotype', 'Book Antiqua', Palatino, serif",
  },
  garamond: {
    label: 'Klassiek',
    css: "'Cormorant Garamond', 'Garamond', 'Times New Roman', serif",
  },
  sans: {
    label: 'Helder Sans',
    css: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};

const COVER_IMAGE_URL = '/inkijk/de-geboorte-van-de-leeuw/page-01.jpg';

/**
 * Splits EPUB HTML sections into exact, reflowable book pages matching (pageW x pageH)
 * at the currently chosen fontSize and fontFamily.
 */
function paginateEpubSections(
  sections: EpubSection[],
  pageW: number,
  pageH: number,
  fontSize: number,
  fontFamilyCss: string
): { pages: PaginatedPage[]; sectionStartPages: Record<number, number> } {
  const pages: PaginatedPage[] = [];
  const sectionStartPages: Record<number, number> = {};

  if (typeof document === 'undefined' || pageW < 120 || pageH < 180) {
    return { pages, sectionStartPages };
  }

  const padX = pageW < 360 ? 22 : 34;
  const padTop = pageW < 360 ? 26 : 36;
  const padBottom = pageW < 360 ? 34 : 42; // leave room for subtle page number
  const innerW = Math.max(120, pageW - padX * 2);
  const maxContentH = Math.max(140, pageH - padTop - padBottom);

  // Offscreen measuring box with identical typography — MUST have height: auto (not 100%)!
  const measure = document.createElement('div');
  measure.className = 'epub-page-content epub-measure-box';
  measure.style.position = 'fixed';
  measure.style.left = '-99999px';
  measure.style.top = '0';
  measure.style.visibility = 'hidden';
  measure.style.pointerEvents = 'none';
  measure.style.width = `${innerW}px`;
  measure.style.height = 'auto';
  measure.style.minHeight = '0';
  measure.style.maxHeight = 'none';
  measure.style.overflow = 'visible';
  measure.style.fontSize = `${fontSize}px`;
  measure.style.fontFamily = fontFamilyCss;
  measure.style.lineHeight = '1.62';
  measure.style.boxSizing = 'border-box';
  document.body.appendChild(measure);

  const pushPage = (
    sec: EpubSection,
    kind: PaginatedPage['kind'],
    htmlContent: string
  ) => {
    const pageNumber = pages.length + 1;
    if (sectionStartPages[sec.index] === undefined) {
      sectionStartPages[sec.index] = pageNumber;
    }
    pages.push({
      pageNumber,
      sectionIndex: sec.index,
      sectionTitle: sec.tocLabel || sec.title,
      kind,
      html: htmlContent,
    });
  };

  // Extract flat flow of semantic blocks from Atticus HTML
  const extractBlocks = (htmlStr: string): HTMLElement[] => {
    const temp = document.createElement('div');
    temp.innerHTML = htmlStr;
    const blocks: HTMLElement[] = [];

    const walk = (el: HTMLElement) => {
      const cls = el.className || '';
      const tag = el.tagName.toLowerCase();

      if (
        cls.includes('chapter-title-card') ||
        cls.includes('image') ||
        tag === 'p' ||
        tag === 'h1' ||
        tag === 'h2' ||
        tag === 'h3' ||
        tag === 'blockquote' ||
        tag === 'li'
      ) {
        // Skip completely empty paragraphs
        if (tag === 'p' && !el.textContent?.trim() && !el.querySelector('img')) {
          return;
        }
        blocks.push(el.cloneNode(true) as HTMLElement);
        return;
      }

      if (el.children.length > 0) {
        Array.from(el.children).forEach((child) => walk(child as HTMLElement));
      } else if (el.textContent?.trim()) {
        const p = document.createElement('p');
        p.innerHTML = el.innerHTML;
        blocks.push(p);
      }
    };

    Array.from(temp.children).forEach((child) => walk(child as HTMLElement));
    return blocks;
  };

  // Tokenize a <p> element into word-level HTML atoms while preserving <em>, <strong>, dropcap spans, etc.
  const tokenizeParagraph = (pEl: HTMLElement): string[] => {
    const tokens: string[] = [];

    const walkNode = (node: Node, wrappers: string[]) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        const words = text.split(/\s+/).filter(Boolean);
        for (const w of words) {
          const escaped = w
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          let out = escaped;
          for (let i = wrappers.length - 1; i >= 0; i--) {
            out = `<${wrappers[i]}>${out}</${wrappers[i]}>`;
          }
          tokens.push(out);
        }
        return;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const cls = el.className || '';
        if (tag === 'span' && (cls.includes('dropcap') || cls.includes('lead_word'))) {
          tokens.push(el.outerHTML);
          return;
        }
        if (tag === 'em' || tag === 'i' || tag === 'strong' || tag === 'b') {
          Array.from(el.childNodes).forEach((ch) => walkNode(ch, [...wrappers, tag]));
          return;
        }
        Array.from(el.childNodes).forEach((ch) => walkNode(ch, wrappers));
      }
    };

    Array.from(pEl.childNodes).forEach((ch) => walkNode(ch, []));
    return tokens;
  };

  const joinTokens = (toks: string[]): string => {
    // Join tokens with spaces, except keep dropcap tightly attached to the following lead_word
    let res = '';
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (i > 0 && !toks[i - 1].includes('class="dropcap')) {
        res += ' ';
      }
      res += t;
    }
    // Merge adjacent identical inline tags like </em> <em> -> space
    return res
      .replace(/<\/em>\s+<em>/g, ' ')
      .replace(/<\/i>\s+<i>/g, ' ')
      .replace(/<\/strong>\s+<strong>/g, ' ');
  };

  // Flow a paragraph cleanly across page boundaries so text always fills each page down to the bottom margin
  const flowParagraphAcrossPages = (
    pEl: HTMLElement,
    sec: EpubSection,
    currentHtmlParts: string[]
  ): string[] => {
    const tokens = tokenizeParagraph(pEl);
    if (tokens.length === 0) return currentHtmlParts;

    let remaining = tokens;
    let parts = [...currentHtmlParts];

    while (remaining.length > 0) {
      let low = 1;
      let high = remaining.length;
      let best = 0;

      const baseHtml = parts.join('');
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const isSplit = mid < remaining.length;
        const candidate = `<p${isSplit ? ' class="epub-p-split"' : ''}>${joinTokens(
          remaining.slice(0, mid)
        )}</p>`;
        measure.innerHTML = baseHtml + candidate;
        if (measure.scrollHeight <= maxContentH) {
          best = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      // If fewer than 6 words fit at the bottom of a non-empty page, move the whole paragraph to the next page (avoid 1-line orphans)
      if (parts.length > 0 && best < Math.min(6, remaining.length)) {
        pushPage(sec, 'text', parts.join(''));
        parts = [];
        measure.innerHTML = '';
        continue;
      }

      if (best === 0) {
        best = 1;
      }

      // Widow prevention: avoid spilling just 1–3 lone words (like "pianosnaar.") onto the top of the next page
      const leftover = remaining.length - best;
      if (leftover > 0 && leftover <= 3 && best > 8) {
        best = best - (4 - leftover);
      }

      const isSplit = best < remaining.length;
      const chunkHtml = `<p${isSplit ? ' class="epub-p-split"' : ''}>${joinTokens(
        remaining.slice(0, best)
      )}</p>`;
      parts.push(chunkHtml);
      remaining = remaining.slice(best);

      if (remaining.length > 0) {
        pushPage(sec, 'text', parts.join(''));
        parts = [];
        measure.innerHTML = '';
      } else {
        measure.innerHTML = parts.join('');
      }
    }

    return parts;
  };

  try {
    for (const sec of sections) {
      if (sec.type === 'cover') {
        pushPage(sec, 'cover', sec.html);
        continue;
      }
      if (sec.type === 'fpi') {
        pushPage(sec, 'fpi', sec.html);
        continue;
      }
      if (sec.index === 1 || sec.index === 5) {
        // Title Page & Ginger's proloog QR page look best cleanly centered on 1 page
        pushPage(sec, 'centered', sec.html);
        continue;
      }

      const blocks = extractBlocks(sec.html);
      measure.innerHTML = '';
      let currentParts: string[] = [];

      for (const block of blocks) {
        // Normalize QR image sizing inside measuring box so it never miscalculates height
        const imgs = block.querySelectorAll('img');
        imgs.forEach((im) => {
          im.style.maxHeight = `${Math.min(180, Math.floor(maxContentH * 0.35))}px`;
          im.style.width = 'auto';
          im.style.height = 'auto';
        });

        const blockHtml = block.outerHTML;
        measure.innerHTML = currentParts.join('') + blockHtml;

        if (measure.scrollHeight <= maxContentH) {
          currentParts.push(blockHtml);
        } else if (block.tagName.toLowerCase() === 'p' && !block.querySelector('img')) {
          // Always flow paragraphs seamlessly across the page bottom (like a real book / Apple Books)
          currentParts = flowParagraphAcrossPages(block, sec, currentParts);
        } else if (currentParts.length === 0) {
          pushPage(sec, 'text', blockHtml);
          measure.innerHTML = '';
        } else {
          // Non-paragraph block (heading, image, TOC item): move to next page
          pushPage(sec, 'text', currentParts.join(''));
          currentParts = [blockHtml];
          measure.innerHTML = blockHtml;
        }
      }

      if (currentParts.length > 0) {
        pushPage(sec, 'text', currentParts.join(''));
      }
    }
  } finally {
    document.body.removeChild(measure);
  }

  return { pages, sectionStartPages };
}

export function BookSampleReader() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const book =
    BOOKS.find((b) => b.slug === slug) ??
    BOOKS.find((b) => b.slug === 'de-geboorte-van-de-leeuw');

  const sections = inkijkEpubData.sections as EpubSection[];

  // Viewport size & orientation (portrait = 1 page, landscape = 2 pages)
  const [viewport, setViewport] = useState<{ w: number; h: number }>(() =>
    typeof window !== 'undefined'
      ? { w: window.innerWidth, h: window.innerHeight }
      : { w: 1200, h: 800 }
  );

  // Typography & Reader controls
  const [fontSize, setFontSize] = useState<number>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 15 : 16
  );
  const [fontFamily, setFontFamily] = useState<ReaderFont>('serif');
  const [theme, setTheme] = useState<ReaderTheme>('day');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const progressRef = useRef<{ sectionIndex: number; offsetRatio: number }>({
    sectionIndex: 0,
    offsetRatio: 0,
  });

  const [showToc, setShowToc] = useState<boolean>(false);
  const [showTypography, setShowTypography] = useState<boolean>(false);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [copiedShareUrl, setCopiedShareUrl] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );
  const userExitedFullscreenRef = useRef<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bookHostRef = useRef<HTMLDivElement | null>(null);
  const pageFlipRef = useRef<PageFlip | null>(null);

  const shareSlug = book?.slug ?? 'de-geboorte-van-de-leeuw';
  const shareUrl = `https://paulvangeenen.nl/inkijkexemplaar/${shareSlug}`;
  const shareTitle = `Inkijkexemplaar — ${book?.title ?? 'De Geboorte van de Leeuw'}`;
  const shareText = `Lees het inkijkexemplaar van "${book?.title ?? 'De Geboorte van de Leeuw'}" van Paul van Geenen:`;

  // Update viewport dimensions on resize / orientationchange (debounced gently)
  useEffect(() => {
    let timer: number | null = null;
    const onResize = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      }, 120);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const isPortraitViewport = viewport.h > viewport.w;

  // Compute exact single-page dimensions that fit 100% cleanly on screen
  const { pageW, pageH } = useMemo(() => {
    const isSmall = viewport.w < 640;
    const availW = Math.max(260, viewport.w - (isSmall ? 20 : 120));
    const availH = Math.max(360, viewport.h - (isSmall ? 128 : 180));
    const aspect = 0.68;

    if (isPortraitViewport) {
      const w = Math.floor(Math.min(availW, availH * aspect, 560));
      const h = Math.floor(Math.min(availH, w / aspect));
      return { pageW: w, pageH: h };
    } else {
      const maxHalfW = Math.floor(Math.min(availW / 2, 480));
      const hFromW = Math.floor(maxHalfW / aspect);
      if (hFromW <= availH) {
        return { pageW: maxHalfW, pageH: hFromW };
      }
      const h = Math.floor(Math.min(availH, 720));
      const w = Math.floor(h * aspect);
      return { pageW: w, pageH: h };
    }
  }, [viewport.w, viewport.h, isPortraitViewport]);

  // Reflow EPUB sections into exact pages whenever fontSize, fontFamily, or page dimensions change
  const { pages, sectionStartPages } = useMemo(
    () =>
      paginateEpubSections(
        sections,
        pageW,
        pageH,
        fontSize,
        FONT_FAMILIES[fontFamily].css
      ),
    [sections, pageW, pageH, fontSize, fontFamily]
  );

  const totalPages = Math.max(1, pages.length);

  // Build dynamic TOC with exact live page numbers
  const tocEntries: TocEntry[] = useMemo(() => {
    return sections
      .filter((s) => Boolean(s.tocLabel))
      .map((s) => ({
        title: s.tocLabel as string,
        sectionIndex: s.index,
        page: sectionStartPages[s.index] ?? 1,
      }));
  }, [sections, sectionStartPages]);

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
        // Silent fail
      }
    })();
  }, [book?.slug, book?.title]);

  // Block Ctrl+S / Ctrl+P / Cmd+S / Cmd+P to protect sample content
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Initialize StPageFlip whenever paginated pages or dimensions change, preserving reading spot!
  useEffect(() => {
    const host = bookHostRef.current;
    if (!host || pages.length === 0) return;

    host.innerHTML = '';
    const bookEl = document.createElement('div');
    bookEl.className = 'inkijk-flipbook';
    bookEl.style.width = isPortraitViewport ? `${pageW}px` : `${pageW * 2}px`;
    bookEl.style.height = `${pageH}px`;

    const padX = pageW < 360 ? 22 : 34;
    const padTop = pageW < 360 ? 26 : 36;
    const padBottom = pageW < 360 ? 34 : 42;

    const pageNodes: HTMLElement[] = [];
    for (const pg of pages) {
      const pageDiv = document.createElement('div');
      pageDiv.className = `inkijk-page inkijk-page--${pg.kind}`;
      pageDiv.dataset.page = String(pg.pageNumber);
      if (pg.pageNumber === 1) {
        pageDiv.dataset.density = 'hard';
      }

      if (pg.kind === 'cover' || pg.kind === 'fpi') {
        const inner = document.createElement('div');
        inner.className = 'epub-fullbleed';
        inner.innerHTML = pg.html;
        inner.querySelectorAll('img').forEach((im) => {
          im.draggable = false;
        });
        pageDiv.appendChild(inner);
      } else {
        const inner = document.createElement('div');
        inner.className =
          pg.kind === 'centered'
            ? 'epub-page-content epub-page-centered'
            : 'epub-page-content';
        inner.style.padding = `${padTop}px ${padX}px ${padBottom}px ${padX}px`;
        inner.style.fontSize = `${fontSize}px`;
        inner.style.fontFamily = FONT_FAMILIES[fontFamily].css;
        inner.style.lineHeight = '1.62';
        inner.innerHTML = pg.html;

        // Prevent image dragging & keep QR links clickable without triggering page flip
        inner.querySelectorAll('img').forEach((im) => {
          im.draggable = false;
        });
        inner.querySelectorAll('a.epub-qr-link').forEach((linkEl) => {
          linkEl.addEventListener('mousedown', (ev) => ev.stopPropagation());
          linkEl.addEventListener('touchstart', (ev) => ev.stopPropagation(), { passive: true });
          linkEl.addEventListener('click', (ev) => ev.stopPropagation());
        });

        pageDiv.appendChild(inner);

        // Subtle running page number at bottom
        if (pg.pageNumber > 1) {
          const footer = document.createElement('div');
          footer.className = 'epub-page-footer';
          footer.textContent = String(pg.pageNumber);
          pageDiv.appendChild(footer);
        }
      }

      bookEl.appendChild(pageDiv);
      pageNodes.push(pageDiv);
    }

    host.appendChild(bookEl);

    // Restore reading position to the same section & relative offset
    const targetSectionStart = sectionStartPages[progressRef.current.sectionIndex] ?? 1;
    const sameSectionPages = pages.filter(
      (p) => p.sectionIndex === progressRef.current.sectionIndex
    );
    const offsetIndex = Math.round(
      progressRef.current.offsetRatio * Math.max(0, sameSectionPages.length - 1)
    );
    const restoredPage = Math.max(
      1,
      Math.min(pages.length, targetSectionStart + offsetIndex)
    );

    const pageFlip = new PageFlip(bookEl, {
      width: pageW,
      height: pageH,
      size: 'fixed',
      minWidth: pageW,
      maxWidth: pageW,
      minHeight: pageH,
      maxHeight: pageH,
      drawShadow: true,
      maxShadowOpacity: 0.45,
      flippingTime: 720,
      usePortrait: isPortraitViewport,
      showCover: true,
      autoSize: false,
      showPageCorners: true,
      useMouseEvents: true,
      mobileScrollSupport: false,
      swipeDistance: 30,
      startPage: restoredPage - 1,
    });

    pageFlip.loadFromHTML(pageNodes);
    setCurrentPage(restoredPage);

    pageFlip.on('flip', (e) => {
      if (typeof e.data === 'number') {
        const nextPageNum = e.data + 1;
        setCurrentPage(nextPageNum);
        const pg = pages[e.data];
        if (pg) {
          const secPages = pages.filter((p) => p.sectionIndex === pg.sectionIndex);
          const idxInSec = secPages.findIndex((p) => p.pageNumber === pg.pageNumber);
          progressRef.current = {
            sectionIndex: pg.sectionIndex,
            offsetRatio:
              secPages.length > 1 ? Math.max(0, idxInSec) / (secPages.length - 1) : 0,
          };
        }
      }
    });

    pageFlipRef.current = pageFlip;

    return () => {
      pageFlipRef.current = null;
      try {
        pageFlip.destroy();
      } catch {
        // Ignore cleanup errors
      }
      if (host) host.innerHTML = '';
    };
  }, [pages, pageW, pageH, isPortraitViewport, fontSize, fontFamily, sectionStartPages]);

  const isSpread = !isPortraitViewport;
  const canGoPrev = currentPage > 1;
  const canGoNext = isSpread
    ? currentPage === 1 || currentPage + 1 < totalPages
    : currentPage < totalPages;

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    pageFlipRef.current?.flipNext('bottom');
  }, [canGoNext]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    pageFlipRef.current?.flipPrev('bottom');
  }, [canGoPrev]);

  const jumpToPage = useCallback(
    (page: number) => {
      setShowToc(false);
      const clamped = Math.max(1, Math.min(totalPages, page));
      const idx = clamped - 1;
      const pf = pageFlipRef.current;
      if (!pf) return;
      const curIdx = pf.getCurrentPageIndex();
      if (Math.abs(idx - curIdx) <= 2) {
        pf.flip(idx, 'bottom');
      } else {
        pf.turnToPage(idx);
        setCurrentPage(clamped);
        const pg = pages[idx];
        if (pg) {
          progressRef.current = { sectionIndex: pg.sectionIndex, offsetRatio: 0 };
        }
      }
    },
    [totalPages, pages]
  );

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

  // Auto-enter fullscreen on open (immediate attempt + first-interaction fallback for direct links) and exit on unmount
  useEffect(() => {
    const enterFs = () => {
      if (userExitedFullscreenRef.current || document.fullscreenElement) return;
      const target = document.documentElement;
      if (target?.requestFullscreen) {
        target.requestFullscreen().catch(() => {});
      }
    };

    enterFs();

    const onFirstGesture = () => {
      enterFs();
      window.removeEventListener('pointerdown', onFirstGesture, true);
      window.removeEventListener('keydown', onFirstGesture, true);
    };

    window.addEventListener('pointerdown', onFirstGesture, true);
    window.addEventListener('keydown', onFirstGesture, true);

    return () => {
      window.removeEventListener('pointerdown', onFirstGesture, true);
      window.removeEventListener('keydown', onFirstGesture, true);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Fullscreen sync
  useEffect(() => {
    const onFsChange = () => {
      const nowFs = Boolean(document.fullscreenElement);
      setIsFullscreen(nowFs);
      if (!nowFs) {
        userExitedFullscreenRef.current = true;
      }
      setTimeout(() => {
        setViewport({ w: window.innerWidth, h: window.innerHeight });
      }, 120);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        userExitedFullscreenRef.current = false;
        await document.documentElement.requestFullscreen();
      } else {
        userExitedFullscreenRef.current = true;
        await document.exitFullscreen();
      }
    } catch {
      // Blocked by browser policy
    }
  };

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
        // Cancelled
      }
    }
    handleCopyShareLink();
  };

  // Theme classes
  const screenBgClass =
    theme === 'night'
      ? 'bg-[#111113] text-stone-200 reader-theme-night'
      : theme === 'sepia'
      ? 'bg-[#ebe0cb] text-stone-900 reader-theme-sepia'
      : 'bg-[#f1ede4] text-stone-900 reader-theme-day';

  const toolbarClass =
    theme === 'night'
      ? 'bg-[#1c1c1f]/90 border-white/10 text-stone-200'
      : theme === 'sepia'
      ? 'bg-[#e3d6bc]/90 border-stone-400/25 text-stone-800'
      : 'bg-white/85 border-stone-300/60 text-stone-800';

  const leftPage = isSpread && currentPage > 1 ? currentPage : null;
  const rightPage =
    isSpread && currentPage > 1
      ? Math.min(totalPages, currentPage + 1)
      : currentPage;

  const pageLabel = isSpread
    ? currentPage === 1
      ? `Omslag • Pagina 1 van ${totalPages}`
      : leftPage !== null && rightPage !== leftPage
      ? `Pagina ${leftPage}–${rightPage} van ${totalPages}`
      : `Pagina ${currentPage} van ${totalPages}`
    : `Pagina ${currentPage} van ${totalPages}`;

  const isAtSampleEnd = isSpread ? rightPage >= totalPages : currentPage >= totalPages;

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="min-h-screen w-full bg-gradient-to-br from-[#161311] via-[#1f1a17] to-[#0f0d0c] flex flex-col items-center justify-center p-0 sm:p-4 md:p-6 select-none overflow-hidden"
    >
      {/* EPUB Typography, Themes, Dropcap & StPageFlip styling */}
      <style>{`
        @media print { body { display: none !important; } }

        .inkijk-page {
          background: #fffdf9;
          color: #1c1917;
          overflow: hidden;
          box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.04);
        }

        .reader-theme-sepia .inkijk-page {
          background: #f6eedc;
          color: #3a2e21;
        }

        .reader-theme-night .inkijk-page {
          background: #1a1a1d;
          color: #e4e0d8;
        }

        .epub-fullbleed {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #111;
        }
        .epub-fullbleed img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
          user-select: none;
          -webkit-user-drag: none;
        }

        .epub-page-content {
          width: 100%;
          height: 100%;
          box-sizing: border-box;
          text-align: justify;
          hyphens: auto;
          -webkit-hyphens: auto;
          overflow: hidden;
        }

        .epub-page-centered {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .epub-page-content h1 {
          font-size: 1.55em;
          font-weight: 700;
          line-height: 1.25;
          margin: 0 0 0.5em 0;
          text-align: center;
        }

        .epub-page-content h2 {
          font-size: 1.38em;
          font-weight: 600;
          font-style: italic;
          line-height: 1.3;
          margin: 0.2em 0 0.9em 0;
          text-align: center;
        }

        .epub-page-content h3 {
          font-size: 1.05em;
          font-weight: 500;
          font-style: italic;
          opacity: 0.8;
          margin: 0 0 1em 0;
          text-align: center;
        }

        .epub-page-content .chapter-title-card {
          margin-bottom: 1.1em;
          padding-bottom: 0.45em;
          border-bottom: 1px solid currentColor;
          border-color: rgba(154, 107, 76, 0.28);
        }

        .epub-page-content p {
          margin: 0 0 0.72em 0;
        }

        .epub-page-content p.epub-p-split {
          margin-bottom: 0;
        }

        .epub-page-content em {
          font-style: italic;
        }

        .epub-page-content .dropcap {
          float: left;
          font-size: 2.95em;
          line-height: 0.82;
          padding-top: 0.08em;
          padding-right: 0.12em;
          font-weight: 600;
          color: #9A6B4C;
        }

        .reader-theme-night .epub-page-content .dropcap {
          color: #e0bd82;
        }

        .epub-page-content .title-card {
          margin-bottom: 2em;
        }

        .epub-page-content .publisher-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.45em;
          font-size: 0.85em;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.78;
        }

        .epub-page-content .publisher-logo img {
          max-height: 76px;
          width: auto;
          border-radius: 8px;
        }

        .epub-page-content .image {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 1em auto;
        }

        .epub-page-content .image img {
          max-width: 170px;
          max-height: 170px;
          width: auto !important;
          height: auto;
          border-radius: 10px;
          display: block;
        }

        /* Keep QR codes crisp and scannable even in Night mode */
        .reader-theme-night .epub-page-content .image img {
          background: #ffffff;
          padding: 8px;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
        }

        .epub-page-content a.epub-qr-link {
          display: inline-block;
          position: relative;
          z-index: 20;
          pointer-events: auto;
          cursor: pointer;
          transition: transform 160ms ease;
        }
        .epub-page-content a.epub-qr-link:hover {
          transform: scale(1.04);
        }

        .epub-page-content li {
          list-style: none;
          margin: 0 0 0.35em 0;
          font-size: 0.92em;
          text-align: left;
        }

        .epub-page-footer {
          position: absolute;
          bottom: 11px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 11px;
          opacity: 0.45;
          font-family: Georgia, serif;
          pointer-events: none;
        }

        /* Subtle spine crease inside open pages */
        .inkijk-page.--left::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 26px;
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
          width: 26px;
          background: linear-gradient(to right, rgba(0,0,0,0.14), rgba(0,0,0,0.04) 45%, transparent);
          pointer-events: none;
          z-index: 6;
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
                  setShowShareModal(false);
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
              <span className="text-xs sm:text-sm font-serif font-semibold truncate max-w-[165px] sm:max-w-[340px]">
                {book?.title ?? 'De Geboorte van de Leeuw'}
              </span>
              <span className="text-[10px] tracking-wide opacity-65">
                Inkijkexemplaar • {pageLabel}
              </span>
            </div>

            {/* Right controls: A- / A+, AA (Font & Theme), Deel, Fullscreen */}
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden md:flex items-center gap-0.5 rounded-lg border border-current/15 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.max(13, s - 1))}
                  disabled={fontSize <= 13}
                  className="px-2 py-1 rounded text-xs font-serif font-semibold disabled:opacity-35 hover:bg-black/5 transition-colors"
                  title="Kleiner lettertype"
                >
                  A<span className="text-[10px]">-</span>
                </button>
                <span className="text-[11px] font-medium px-1.5 min-w-[36px] text-center opacity-75">
                  {fontSize}px
                </span>
                <button
                  type="button"
                  onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                  disabled={fontSize >= 24}
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
                title="Lettertype, grootte en leesmodus"
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

          {/* Typography: Font Size, Font Family & Reading Theme Popover */}
          {showTypography && (
            <div
              className={`absolute top-14 right-3 sm:right-5 z-40 w-76 rounded-2xl shadow-2xl border p-4 backdrop-blur-xl ${
                theme === 'night'
                  ? 'bg-[#232326]/95 border-white/15 text-stone-100'
                  : 'bg-white/95 border-stone-200 text-stone-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
                  Weergave &amp; Tekstopmaak
                </span>
                <button
                  type="button"
                  onClick={() => setShowTypography(false)}
                  className="p-1 rounded-md opacity-60 hover:opacity-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Font size */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="opacity-75">Lettergrootte</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{fontSize}px</span>
                    {fontSize !== 16 && (
                      <button
                        type="button"
                        onClick={() => setFontSize(16)}
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
                    onClick={() => setFontSize((s) => Math.max(13, s - 1))}
                    disabled={fontSize <= 13}
                    className="flex-1 py-2 rounded-xl border border-current/15 flex items-center justify-center gap-1.5 text-sm font-serif disabled:opacity-35 hover:bg-black/5"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    onClick={() => setFontSize((s) => Math.min(24, s + 1))}
                    disabled={fontSize >= 24}
                    className="flex-1 py-2 rounded-xl border border-current/15 flex items-center justify-center gap-1.5 text-base font-serif font-semibold disabled:opacity-35 hover:bg-black/5"
                  >
                    A+
                  </button>
                </div>
                <input
                  type="range"
                  min={13}
                  max={24}
                  step={1}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full mt-2.5 accent-[#9A6B4C]"
                  aria-label="Lettergrootte schuifregelaar"
                />
              </div>

              {/* Font family */}
              <div className="mb-4">
                <span className="flex items-center gap-1.5 text-xs opacity-75 mb-2">
                  <Type className="w-3.5 h-3.5" /> Lettertype
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(FONT_FAMILIES) as ReaderFont[]).map((fk) => (
                    <button
                      key={fk}
                      type="button"
                      onClick={() => setFontFamily(fk)}
                      style={{ fontFamily: FONT_FAMILIES[fk].css }}
                      className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                        fontFamily === fk
                          ? 'border-[#9A6B4C] ring-2 ring-[#9A6B4C]/30 bg-[#9A6B4C]/10'
                          : 'border-current/15 opacity-75 hover:opacity-100'
                      }`}
                    >
                      {FONT_FAMILIES[fk].label}
                    </button>
                  ))}
                </div>
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
                {tocEntries.map((ch) => {
                  const isActive =
                    currentPage === ch.page ||
                    (isSpread && (leftPage === ch.page || rightPage === ch.page));
                  return (
                    <button
                      key={ch.sectionIndex}
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
                Pas lettergrootte en lettertype aan via <strong>AA</strong> — de tekst vloeit automatisch mee over de pagina&apos;s. Tik of scan een QR-code om de soundtrack te horen.
              </div>
            </div>
          )}

          {/* Main Book Stage */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden p-2 sm:p-5 md:p-6">
            {/* Left / Right page-curl arrows */}
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

            {/* StPageFlip Host */}
            <div
              ref={bookHostRef}
              className="flex items-center justify-center drop-shadow-[0_24px_50px_rgba(0,0,0,0.32)]"
            />
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
                    src={COVER_IMAGE_URL}
                    alt={book?.title ?? 'De Geboorte van de Leeuw'}
                    className="w-12 h-16 rounded-md object-cover shadow-md border border-white/15 shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#e0bd82]">
                      Inkijkexemplaar • Proloog + H1 t/m H3
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
              max={totalPages}
              value={currentPage}
              onChange={(e) => jumpToPage(Number(e.target.value))}
              className="flex-1 h-1.5 accent-[#9A6B4C] cursor-pointer"
              aria-label="Paginaschuifregelaar"
            />

            <span className="text-[11px] font-medium opacity-65 shrink-0">
              {currentPage} / {totalPages}
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
