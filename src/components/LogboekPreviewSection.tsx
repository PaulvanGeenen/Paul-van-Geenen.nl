import React, { useEffect, useState } from 'react';
import {
  LogboekEntry,
  fetchLogboekWithCover,
  formatLogboekDatum,
  openLogboekOverlay,
} from '../lib/logboek';
import logboekCoverRed from '../assets/images/logboek-cover-red.jpg';

export function LogboekPreviewSection() {
  const [latestEntry, setLatestEntry] = useState<LogboekEntry | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [customCover, setCustomCover] = useState<string | null>(null);
  const [overlayOpen, setOverlayOpen] = useState<boolean>(false);

  const loadLatest = async () => {
    try {
      const { entries, coverImage } = await fetchLogboekWithCover();
      setTotalCount(entries.length);
      setLatestEntry(entries[0] || null);
      setCustomCover(coverImage);
    } catch {
      // Negeer stil op homepage als API even niet bereikbaar is
    }
  };

  useEffect(() => {
    loadLatest();
    const onChanged = () => loadLatest();
    const onOverlayState = (e: Event) => {
      const custom = e as CustomEvent<{ isOpen?: boolean }>;
      setOverlayOpen(Boolean(custom.detail?.isOpen));
    };
    window.addEventListener('pvg-logboek-changed', onChanged);
    window.addEventListener('pvg-logboek-overlay-state', onOverlayState);
    return () => {
      window.removeEventListener('pvg-logboek-changed', onChanged);
      window.removeEventListener('pvg-logboek-overlay-state', onOverlayState);
    };
  }, []);

  const isLongText =
    latestEntry &&
    (latestEntry.tekst.length > 175 || latestEntry.tekst.split(/\r?\n/).length > 3);

  return (
    <section
      id="logboek"
      className="relative py-20 md:py-28 bg-[#f7f2e7] text-[#1c1917] border-t border-stone-300/60 overflow-hidden"
    >
      {/* Subtiele papierstructuur / los briefje sfeer */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 15% 25%, rgba(168, 125, 72, 0.10) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(124, 34, 24, 0.06) 0%, transparent 40%)',
        }}
      />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Links: Interactief Rood Leren Logboek (Hover opent leren wrapper + kaft, Klik = fullpage, verdwijnt zolang open) */}
          <div
            className={`md:col-span-5 flex flex-col items-center transition-all duration-300 ${
              overlayOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
            }`}
          >
            <button
              type="button"
              onClick={() => openLogboekOverlay(0)}
              className="group relative w-[270px] sm:w-[310px] aspect-square cursor-pointer focus:outline-none text-left"
              style={{ perspective: '1400px' }}
              title="Klik om het logboek te openen"
              aria-label="Open het logboek"
            >
              {/* Vergeelde binnenpagina die zichtbaar wordt zodra de leren wrapper & kaft op hover opengaan */}
              <div
                className="absolute inset-y-[5%] left-[19%] right-[17%] rounded-r-md shadow-inner border border-stone-300/80 p-4 flex flex-col justify-between overflow-hidden"
                style={{
                  backgroundColor: '#f3e8ce',
                  backgroundImage:
                    'repeating-linear-gradient(transparent, transparent 21px, rgba(130, 108, 82, 0.14) 21px, rgba(130, 108, 82, 0.14) 22px)',
                }}
              >
                <div className="pl-3">
                  <span
                    style={{ fontFamily: "'Patrick Hand', cursive" }}
                    className="text-xs text-[#7c2218] block mb-1"
                  >
                    {latestEntry ? formatLogboekDatum(latestEntry.datum) : 'Logboek'}
                  </span>
                  <p
                    style={{ fontFamily: "'Caveat', cursive" }}
                    className="text-base leading-snug text-stone-800 line-clamp-5"
                  >
                    {latestEntry
                      ? latestEntry.tekst
                      : 'Vluchtige momenten, gedachten onderweg en korte notities...'}
                  </p>
                </div>
                <span
                  style={{ fontFamily: "'Patrick Hand', cursive" }}
                  className="text-[11px] text-stone-500 self-end"
                >
                  klik om te bladeren →
                </span>
              </div>

              {/* Rode leren kaft die op hover in 3D opendraait (nadat de leren wrapper loskomt) */}
              <div
                className="relative w-full h-full rounded-xl overflow-hidden shadow-[0_18px_40px_rgba(35,20,10,0.22)] transition-transform duration-500 delay-75 ease-out group-hover:[transform:rotateY(-38deg)_translateX(-4px)]"
                style={{ transformOrigin: '18% center', transformStyle: 'preserve-3d' }}
              >
                <img
                  src={customCover || logboekCoverRed}
                  alt="Rood leren Logboek van Paul van Geenen"
                  className="w-full h-full object-cover block"
                />
              </div>

              {/* Leren wrapper (sluitband) die het boekje dicht houdt en bij hover losklikt/opengaat */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-[49%] left-[14%] right-[16%] h-6 -translate-y-1/2 z-20 transition-all duration-300 ease-out group-hover:opacity-0 group-hover:-translate-x-6 group-hover:scale-x-75 group-hover:-rotate-3"
              >
                <div className="w-full h-2.5 rounded-full bg-gradient-to-r from-[#5a160e] via-[#8c2d1f] to-[#4e120b] shadow-[0_3px_8px_rgba(0,0,0,0.45)] border-y border-[#b84c3a]/40" />
                <div className="absolute left-[26%] top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gradient-to-br from-[#6e1e14] to-[#3f0e08] border border-[#c79d52]/60 shadow-md flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#c79d52]/80" />
                </div>
              </div>
            </button>

            <span
              style={{ fontFamily: "'Patrick Hand', cursive" }}
              className="mt-3 text-sm text-stone-500 tracking-wide"
            >
              Beweeg om open te slaan · klik om te lezen
            </span>
          </div>

          {/* Rechts: Los briefje met de laatste aantekening */}
          <div className="md:col-span-7">
            <div className="mb-3 flex items-center gap-3">
              <span
                style={{ fontFamily: "'Patrick Hand', cursive" }}
                className="text-xs uppercase tracking-[0.22em] text-[#7c2218] font-bold"
              >
                Logboek
              </span>
              {totalCount > 0 && (
                <span
                  style={{ fontFamily: "'Patrick Hand', cursive" }}
                  className="text-xs text-stone-500"
                >
                  · {totalCount} {totalCount === 1 ? 'aantekening' : 'aantekeningen'}
                </span>
              )}
            </div>

            <div
              onClick={() => openLogboekOverlay(0)}
              className="relative bg-[#fcf8ee] border border-stone-300/80 rounded-sm p-6 sm:p-8 shadow-[0_10px_28px_rgba(40,28,15,0.09)] -rotate-[0.4deg] hover:rotate-0 transition-transform duration-300 cursor-pointer"
            >
              {/* Slordig plakbandje rechtsboven op het losse briefje */}
              <div className="pointer-events-none absolute -top-3 right-10 w-20 h-6 bg-[#e7d6a8]/75 rotate-[4deg] border-x border-[#c9b480]/40 shadow-sm" />

              {latestEntry ? (
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <div className="flex-1 min-w-0">
                    <time
                      dateTime={latestEntry.datum}
                      style={{ fontFamily: "'Patrick Hand', cursive" }}
                      className="inline-block text-lg text-[#7c2218] mb-2 border-b border-[#7c2218]/25"
                    >
                      {formatLogboekDatum(latestEntry.datum)}
                    </time>

                    <p
                      style={{ fontFamily: "'Caveat', cursive" }}
                      className="text-2xl leading-[1.4] text-[#171412] line-clamp-3 whitespace-pre-wrap break-words"
                    >
                      {latestEntry.tekst}
                    </p>

                    {isLongText ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLogboekOverlay(0);
                        }}
                        style={{ fontFamily: "'Patrick Hand', cursive" }}
                        className="mt-2 text-sm text-[#7c2218] hover:underline cursor-pointer"
                      >
                        lees meer →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openLogboekOverlay(0);
                        }}
                        style={{ fontFamily: "'Patrick Hand', cursive" }}
                        className="mt-3 text-sm text-stone-500 hover:text-[#7c2218] transition-colors cursor-pointer"
                      >
                        open logboek →
                      </button>
                    )}
                  </div>

                  {latestEntry.foto && (
                    <div className="shrink-0 bg-white p-1.5 pb-4 shadow-md border border-stone-200 rotate-2 w-28 sm:w-32 relative">
                      <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-3.5 bg-[#e7d6a8]/80 -rotate-3" />
                      <img
                        src={latestEntry.foto}
                        alt=""
                        className="w-full aspect-square object-cover sepia-[0.1]"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p
                    style={{ fontFamily: "'Caveat', cursive" }}
                    className="text-2xl text-stone-700 leading-relaxed"
                  >
                    Vluchtige momenten onderweg — een upload, een testdruk, een losse gedachte.
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openLogboekOverlay(0);
                    }}
                    style={{ fontFamily: "'Patrick Hand', cursive" }}
                    className="mt-3 text-sm text-[#7c2218] hover:underline cursor-pointer"
                  >
                    open het logboek →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
