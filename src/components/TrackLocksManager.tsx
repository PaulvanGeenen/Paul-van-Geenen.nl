import React, { useState, useEffect } from 'react';
import {
  Lock, LockOpen, RefreshCw, Sparkles, Copy, Check, RotateCcw,
  Clock, Shield, Music, BookOpen, KeyRound, AlertCircle, CheckCircle2, Trash2, ExternalLink
} from 'lucide-react';
import { cn } from '../lib/utils';
import {
  isAdminUser,
  setIsAdminUser,
  resetUnlockedTracks,
  getUnlockedTrackKeys,
  isAlbumLocksEnabled,
  isAlbumAdminLocksEnabled,
  isTrackAlwaysUnlocked,
  generateBookGuid,
  playLockRattleSound,
  playLockUnlockSound
} from '../lib/trackLocks';

interface DbAlbum {
  id: number;
  title: string;
  artist: string;
  description: string;
  order_num: number;
  cover?: string;
  locks_enabled?: number | boolean;
  admin_locks_enabled?: number | boolean;
  guid_24h?: string | null;
  guid_unlimited?: string | null;
  free_track_1?: string | null;
  free_track_2?: string | null;
}

interface DbTrack {
  id: number;
  album_id: number;
  track_order: number;
  title: string;
  foldername: string;
  always_unlocked?: number | boolean;
}

export function TrackLocksManager() {
  const [apiUrl] = useState<string>(() => {
    return localStorage.getItem('transip_music_api_url') || '/api/music_database.php';
  });
  const [apiKey] = useState<string>(() => {
    return localStorage.getItem('transip_music_api_key') || 'music-secret-key-paul-2026';
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [savingId, setSavingId] = useState<string | number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [albums, setAlbums] = useState<DbAlbum[]>([]);
  const [tracks, setTracks] = useState<DbTrack[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);

  // Local browser role & unlocked keys state
  const [browserIsAdmin, setBrowserIsAdmin] = useState<boolean>(() => isAdminUser());
  const [unlockedKeysCount, setUnlockedKeysCount] = useState<number>(() => getUnlockedTrackKeys().length);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Editable GUID inputs for the currently selected book
  const [guid24hInput, setGuid24hInput] = useState<string>('');
  const [guidUnlimitedInput, setGuidUnlimitedInput] = useState<string>('');

  useEffect(() => {
    // Ensure logging into Admin marks this browser as Admin by default if not explicitly set
    if (localStorage.getItem('pvg_is_admin_user_v1') === null) {
      setIsAdminUser(true);
      setBrowserIsAdmin(true);
    }
    const syncLocal = () => {
      setBrowserIsAdmin(isAdminUser());
      setUnlockedKeysCount(getUnlockedTrackKeys().length);
    };
    window.addEventListener('pvg-locks-changed', syncLocal);
    window.addEventListener('storage', syncLocal);
    return () => {
      window.removeEventListener('pvg-locks-changed', syncLocal);
      window.removeEventListener('storage', syncLocal);
    };
  }, []);

  const fetchBridge = async (action: string, method: string = 'GET', body?: any): Promise<any> => {
    const urlsToTry = [apiUrl, '/api/music_database.php', 'https://paulvangeenen.nl/api/music_database.php'];
    let lastError: Error | null = null;

    for (let i = 0; i < urlsToTry.length; i++) {
      const currentTryUrl = urlsToTry[i];
      try {
        const cleanUrl = currentTryUrl.startsWith('http') ? currentTryUrl : `${window.location.origin}${currentTryUrl}`;
        const urlObj = new URL(cleanUrl);
        urlObj.searchParams.set('action', action);

        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
          }
        };

        if (body && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(body);
        }

        const res = await fetch(urlObj.toString(), options);
        const text = await res.text();
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {}

        if (data && (data.success !== undefined || data.albums !== undefined)) {
          return data;
        }
      } catch (err: any) {
        lastError = err;
      }
    }
    throw lastError || new Error('Kon geen verbinding maken met de database bridge.');
  };

  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetchBridge('get_admin_data');
      if (res && res.success) {
        const loadedAlbums: DbAlbum[] = res.albums || [];
        const loadedTracks: DbTrack[] = res.tracks || [];
        setAlbums(loadedAlbums);
        setTracks(loadedTracks);

        if (loadedAlbums.length > 0) {
          const activeId = selectedBookId && loadedAlbums.some(a => a.id === selectedBookId)
            ? selectedBookId
            : loadedAlbums[0].id;
          setSelectedBookId(activeId);
          const currentAlb = loadedAlbums.find(a => a.id === activeId);
          if (currentAlb) {
            setGuid24hInput(currentAlb.guid_24h || '');
            setGuidUnlimitedInput(currentAlb.guid_unlimited || '');
          }
        }
      } else {
        setErrorMessage(res?.error || 'Kon slot-gegevens niet ophalen.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Fout bij ophalen van slot-gegevens.');
    } finally {
      setLoading(false);
    };
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedBook = albums.find(a => a.id === selectedBookId) || albums[0] || null;

  useEffect(() => {
    if (selectedBook) {
      setGuid24hInput(selectedBook.guid_24h || '');
      setGuidUnlimitedInput(selectedBook.guid_unlimited || '');
    }
  }, [selectedBook?.id, selectedBook?.guid_24h, selectedBook?.guid_unlimited]);

  const showTempStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage(prev => (prev === msg ? null : prev));
    }, 4500);
  };

  const copyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(label);
    setTimeout(() => {
      setCopiedField(prev => (prev === label ? null : prev));
    }, 2500);
  };

  // Save book-level lock settings (locks_enabled, admin_locks_enabled, guid_24h, guid_unlimited, or batch always_unlocked_track_ids)
  const updateBookLockSettings = async (
    book: DbAlbum,
    updates: {
      locks_enabled?: number;
      admin_locks_enabled?: number;
      guid_24h?: string | null;
      guid_unlimited?: string | null;
      always_unlocked_track_ids?: number[];
    },
    feedbackMsg?: string
  ) => {
    setSavingId(`book-${book.id}`);
    setErrorMessage(null);
    try {
      const payload = {
        album_id: book.id,
        ...updates
      };
      const res = await fetchBridge('save_book_lock_settings', 'POST', payload);
      if (res && res.success) {
        if (updates.locks_enabled === 0 || updates.admin_locks_enabled === 0) {
          playLockUnlockSound();
        } else if (updates.locks_enabled === 1 || updates.admin_locks_enabled === 1) {
          playLockRattleSound();
        }
        showTempStatus(feedbackMsg || res.message || `Instellingen voor "${book.title}" opgeslagen!`);
        await loadData();
      } else {
        setErrorMessage(res?.error || 'Opslaan mislukt.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Fout bij opslaan.');
    } finally {
      setSavingId(null);
    }
  };

  // Toggle individual track's "always_unlocked" (Nooit op slot) status
  const handleToggleTrackAlwaysUnlocked = async (track: DbTrack) => {
    const currentlyUnlocked = isTrackAlwaysUnlocked({
      id: String(track.id),
      title: track.title,
      folderName: track.foldername,
      always_unlocked: track.always_unlocked
    });
    const nextVal = currentlyUnlocked ? 0 : 1;

    setSavingId(`track-${track.id}`);
    setErrorMessage(null);

    // Optimistic UI update
    setTracks(prev =>
      prev.map(t => (t.id === track.id ? { ...t, always_unlocked: nextVal } : t))
    );

    try {
      const res = await fetchBridge('toggle_track_always_unlocked', 'POST', {
        track_id: track.id,
        always_unlocked: nextVal
      });
      if (res && res.success) {
        if (nextVal === 1) playLockUnlockSound();
        else playLockRattleSound();
        showTempStatus(
          nextVal === 1
            ? `"${track.title}" staat nu op NOOIT OP SLOT (altijd vrij zichtbaar).`
            : `"${track.title}" staat nu weer OP SLOT (tot QR-scan).`
        );
      } else {
        setErrorMessage(res?.error || 'Kon track-status niet wijzigen.');
        await loadData();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Fout bij wijzigen track-status.');
      await loadData();
    } finally {
      setSavingId(null);
    }
  };

  const getBookCover = (alb: DbAlbum) => {
    if (alb.cover) return alb.cover;
    const t = alb.title.toLowerCase();
    if (t.includes('geboorte') || t.includes('leeuw')) return '/@music/_albums/De%20Geboorte%20van%20de%20Leeuw%20Album.jpg';
    if (t.includes('echo')) return '/@music/_albums/De%20Echo%20Album.jpg';
    return '/@music/_albums/Muzikale%20Krabbels%20Album.jpg';
  };

  const bookTracks = selectedBook
    ? tracks
        .filter(t => t.album_id === selectedBook.id)
        .sort((a, b) => a.track_order - b.track_order || a.id - b.id)
    : [];

  const alwaysUnlockedCount = bookTracks.filter(t =>
    isTrackAlwaysUnlocked({
      id: String(t.id),
      title: t.title,
      folderName: t.foldername,
      always_unlocked: t.always_unlocked
    })
  ).length;

  const lockedByDefaultCount = Math.max(0, bookTracks.length - alwaysUnlockedCount);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#1c1610] via-[#181410] to-[#120f0c] border border-earth-gold/35 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-earth-gold/15 border border-earth-gold/40 text-earth-gold shrink-0">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-white">
                Sloten &amp; SoundTracks Beheer (Per Boek)
              </h2>
              <p className="text-xs sm:text-sm text-earth-light/70 mt-1 max-w-2xl leading-relaxed">
                Beheer hier per boek of de slootjes aan of uit staan voor gewone lezers en voor admin-lezers, genereer 24-uurs of onbeperkte ontgrendel-GUIDs, en bepaal zelf welke SoundTracks nooit op slot mogen.
              </p>
            </div>
          </div>

          {/* Admin Browser Role & Local Reset Controls */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-black/50 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
              <Shield className={cn("w-4 h-4", browserIsAdmin ? "text-earth-gold" : "text-white/40")} />
              <div className="text-xs">
                <div className="text-[10px] font-mono uppercase tracking-wider text-earth-light/50">
                  Jouw Huidige Browser-Rol:
                </div>
                <div className="font-bold text-white">
                  {browserIsAdmin ? 'Admin-Lezer' : 'Niet-Admin Lezer (Test)'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = !browserIsAdmin;
                  setIsAdminUser(next);
                  setBrowserIsAdmin(next);
                  showTempStatus(
                    next
                      ? 'Deze browser wordt nu herkend als Admin-lezer.'
                      : 'Deze browser simuleert nu een reguliere (niet-admin) lezer!'
                  );
                }}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer",
                  browserIsAdmin
                    ? "bg-earth-gold/20 border-earth-gold/40 text-earth-gold hover:bg-earth-gold/30"
                    : "bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30"
                )}
              >
                Wissel naar {browserIsAdmin ? 'Lezer' : 'Admin'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                resetUnlockedTracks();
                setUnlockedKeysCount(0);
                playLockRattleSound();
                showTempStatus('Alle lokaal via QR/GUID ontgrendelde tracks in deze browser zijn gereset!');
              }}
              className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-white transition-all flex items-center gap-2 cursor-pointer"
              title="Zet alle via QR-codes of GUIDs ontgrendelde nummers in deze browser weer op slot"
            >
              <RotateCcw className="w-3.5 h-3.5 text-earth-gold" />
              <span>Reset Mijn Browser-Sloten ({unlockedKeysCount > 0 ? 'Actief' : '0'})</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={loadData}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white transition-all cursor-pointer disabled:opacity-40"
              title="Gegevens vernieuwen uit MySQL"
            >
              <RefreshCw className={cn("w-4 h-4 text-earth-gold", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Status / Error Feedback */}
        {statusMessage && (
          <div className="mt-4 pt-3 border-t border-earth-gold/20 text-xs font-mono text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 pt-3 border-t border-rose-500/20 text-xs font-mono text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* STAP 1: KIES HET BOEK / ALBUM */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-mono uppercase tracking-wider text-earth-gold font-bold flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            <span>1. Selecteer een Boek / Soundtrack-Album ({albums.length})</span>
          </h3>
          <span className="text-xs text-earth-light/50">
            Alle onderstaande instellingen gelden specifiek voor het geselecteerde boek
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {albums.map(alb => {
            const isSelected = selectedBook?.id === alb.id;
            const albTracks = tracks.filter(t => t.album_id === alb.id);
            const readerLocksOn = isAlbumLocksEnabled(alb);
            const adminLocksOn = isAlbumAdminLocksEnabled(alb);
            const freeCount = albTracks.filter(t =>
              isTrackAlwaysUnlocked({
                id: String(t.id),
                title: t.title,
                folderName: t.foldername,
                always_unlocked: t.always_unlocked
              })
            ).length;

            return (
              <button
                key={alb.id}
                type="button"
                onClick={() => setSelectedBookId(alb.id)}
                className={cn(
                  "text-left p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-pointer relative overflow-hidden",
                  isSelected
                    ? "bg-earth-gold/10 border-earth-gold shadow-lg shadow-earth-gold/10 ring-1 ring-earth-gold/50"
                    : "bg-[#181818] border-white/10 hover:border-white/25"
                )}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getBookCover(alb)}
                    alt={alb.title}
                    className="w-14 h-14 rounded-xl object-cover border border-white/15 shrink-0 bg-black"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/banner-boek-3.jpg';
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-mono text-earth-gold uppercase">
                      Boek / Album #{alb.id}
                    </div>
                    <h4 className="font-serif font-bold text-white text-base truncate">
                      {alb.title}
                    </h4>
                    <div className="text-xs text-earth-light/60 font-mono">
                      {albTracks.length} SoundTracks ({freeCount} nooit op slot)
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full border font-bold",
                    readerLocksOn
                      ? "bg-earth-gold/15 text-earth-gold border-earth-gold/35"
                      : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  )}>
                    Lezers: {readerLocksOn ? '🔒 Sloten AAN' : '🔓 Sloten UIT'}
                  </span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full border font-bold",
                    adminLocksOn
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/35"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  )}>
                    Admins: {adminLocksOn ? '🔒 Test AAN' : '🔓 Alles Open'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedBook && (
        <>
          {/* STAP 2: SLOTJES AAN/UIT VOOR LEZERS EN VOOR ADMINS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* A. Slootjes voor Niet-Admin Lezers */}
            <div className={cn(
              "border rounded-2xl p-6 shadow-xl flex flex-col justify-between gap-5 transition-all duration-300",
              !isAlbumLocksEnabled(selectedBook)
                ? "bg-emerald-950/60 border-emerald-500/50 shadow-emerald-950/40"
                : "bg-[#181818] border-white/10"
            )}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    "text-[11px] font-mono uppercase tracking-wider font-bold",
                    !isAlbumLocksEnabled(selectedBook) ? "text-emerald-300" : "text-earth-gold"
                  )}>
                    2A. Reguliere Bezoekers (Niet-Admin Lezers)
                  </span>
                  <span className={cn(
                    "text-xs font-mono px-2.5 py-0.5 rounded-full border font-bold",
                    isAlbumLocksEnabled(selectedBook)
                      ? "bg-earth-gold/15 text-earth-gold border-earth-gold/40"
                      : "bg-emerald-500/25 text-emerald-200 border-emerald-400/50"
                  )}>
                    {isAlbumLocksEnabled(selectedBook) ? '🔒 Slootjes AAN' : '🔓 Alles Open'}
                  </span>
                </div>
                <h3 className="text-lg font-serif font-bold text-white">
                  Slootjes voor Niet-Admin Lezers — "{selectedBook.title}"
                </h3>
                <p className={cn(
                  "text-xs leading-relaxed",
                  !isAlbumLocksEnabled(selectedBook) ? "text-emerald-100/80" : "text-earth-light/65"
                )}>
                  Schakel de slootjes aan of uit voor alle reguliere lezers van dit boek. Wanneer dit <strong>AAN</strong> staat, zien lezers alleen de SoundTracks die op <em>"Nooit op slot"</em> staan plus de SoundTracks die zij zelf via een QR-code (of GUID) hebben ontgrendeld.
                </p>
              </div>

              <div className={cn(
                "flex items-center justify-end pt-4 border-t",
                !isAlbumLocksEnabled(selectedBook) ? "border-emerald-500/30" : "border-white/10"
              )}>
                <button
                  type="button"
                  disabled={savingId === `book-${selectedBook.id}`}
                  onClick={() => {
                    const nextVal = isAlbumLocksEnabled(selectedBook) ? 0 : 1;
                    updateBookLockSettings(
                      selectedBook,
                      { locks_enabled: nextVal },
                      nextVal === 1
                        ? `Slootjes voor niet-admin lezers zijn AANGEZET voor "${selectedBook.title}".`
                        : `Slootjes voor niet-admin lezers zijn UITGEZET voor "${selectedBook.title}" (alles open voor lezers).`
                    );
                  }}
                  className={cn(
                    "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg border",
                    isAlbumLocksEnabled(selectedBook)
                      ? "bg-earth-gold text-black border-earth-gold hover:bg-amber-400"
                      : "bg-emerald-500 text-black border-emerald-400 hover:bg-emerald-400"
                  )}
                >
                  {isAlbumLocksEnabled(selectedBook) ? (
                    <>
                      <LockOpen className="w-4 h-4" />
                      <span>Zet Slootjes UIT voor Lezers</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Zet Slootjes AAN voor Lezers</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* B. Slootjes voor Admin-Lezers (Testmodus vs. Alles Open voor Admins) */}
            <div className={cn(
              "border rounded-2xl p-6 shadow-xl flex flex-col justify-between gap-5 transition-all duration-300",
              !isAlbumAdminLocksEnabled(selectedBook)
                ? "bg-emerald-950/60 border-emerald-500/50 shadow-emerald-950/40"
                : "bg-[#181818] border-white/10"
            )}>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn(
                    "text-[11px] font-mono uppercase tracking-wider font-bold",
                    !isAlbumAdminLocksEnabled(selectedBook) ? "text-emerald-300" : "text-amber-400"
                  )}>
                    2B. Alleen voor Admin-Lezers (Testmodus)
                  </span>
                  <span className={cn(
                    "text-xs font-mono px-2.5 py-0.5 rounded-full border font-bold",
                    isAlbumAdminLocksEnabled(selectedBook)
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                      : "bg-emerald-500/25 text-emerald-200 border-emerald-400/50"
                  )}>
                    {isAlbumAdminLocksEnabled(selectedBook) ? '🔒 Slootjes AAN voor Admin' : '🔓 Alles Open voor Admin'}
                  </span>
                </div>
                <h3 className="text-lg font-serif font-bold text-white">
                  Slootjes voor Admin-Lezers — "{selectedBook.title}"
                </h3>
                <p className={cn(
                  "text-xs leading-relaxed",
                  !isAlbumAdminLocksEnabled(selectedBook) ? "text-emerald-100/80" : "text-earth-light/65"
                )}>
                  Hiermee zet je de slootjes aan of uit voor <strong>alleen admin-lezers</strong>. Zet dit <strong>UIT</strong> om voor admins alle songs van dit boek open te zetten (terwijl gewone lezers gewoon de slootjes zien), of zet dit <strong>AAN</strong> zodat een admin de slootjes-functionaliteit zelf kan testen.
                </p>
              </div>

              <div className={cn(
                "flex items-center justify-end pt-4 border-t",
                !isAlbumAdminLocksEnabled(selectedBook) ? "border-emerald-500/30" : "border-white/10"
              )}>
                <button
                  type="button"
                  disabled={savingId === `book-${selectedBook.id}`}
                  onClick={() => {
                    const nextVal = isAlbumAdminLocksEnabled(selectedBook) ? 0 : 1;
                    updateBookLockSettings(
                      selectedBook,
                      { admin_locks_enabled: nextVal },
                      nextVal === 1
                        ? `Slootjes voor Admin-lezers zijn AANGEZET (Testmodus) voor "${selectedBook.title}".`
                        : `Slootjes voor Admin-lezers zijn UITGEZET voor "${selectedBook.title}" (alle songs open voor admins).`
                    );
                  }}
                  className={cn(
                    "px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg border",
                    isAlbumAdminLocksEnabled(selectedBook)
                      ? "bg-amber-400 text-black border-amber-400 hover:bg-amber-300"
                      : "bg-emerald-500 text-black border-emerald-400 hover:bg-emerald-400"
                  )}
                >
                  {isAlbumAdminLocksEnabled(selectedBook) ? (
                    <>
                      <LockOpen className="w-4 h-4" />
                      <span>Zet Alles Open voor Admins (Sloten UIT)</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Zet Slootjes AAN voor Admins (Testen)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* STAP 3: 24-UURS GUID & ONBEPERKTE GUID PER BOEK */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 3A. 24-Uurs Ontgrendel-GUID */}
            <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                      3A. Tijdelijke 24-Uurs Toegang
                    </span>
                    <h3 className="text-lg font-serif font-bold text-white">
                      24-Uurs Ontgrendel-GUID — "{selectedBook.title}"
                    </h3>
                  </div>
                </div>
              </div>

              <p className="text-xs text-earth-light/65 leading-relaxed">
                Met deze GUID kan een lezer gedurende <strong>24 uur</strong> alle SoundTracks van <em>{selectedBook.title}</em> openzetten. Door hieronder een nieuwe GUID te genereren (of de GUID te wijzigen/wissen) sluit je deze toegang direct voor lezers die de oude GUID gebruikten; zij zien dan weer de lijst met alleen de SoundTracks die zij zelf reeds hadden opengelezen.
              </p>

              <div className="space-y-2.5 pt-1">
                <label className="block text-[11px] font-mono text-earth-light/60 uppercase">
                  Actieve 24-uurs GUID (<code>guid_24h</code>):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={guid24hInput}
                    onChange={(e) => setGuid24hInput(e.target.value)}
                    placeholder="Geen 24-uurs GUID ingesteld..."
                    className="flex-1 bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-mono text-cyan-300 focus:border-cyan-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateBookLockSettings(
                      selectedBook,
                      { guid_24h: guid24hInput.trim() || null },
                      `24-uurs GUID bijgewerkt voor "${selectedBook.title}".`
                    )}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 cursor-pointer"
                  >
                    Opslaan
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const newGuid = generateBookGuid();
                      setGuid24hInput(newGuid);
                      updateBookLockSettings(
                        selectedBook,
                        { guid_24h: newGuid },
                        `Nieuwe 24-uurs GUID gegenereerd voor "${selectedBook.title}"! Oude 24-uurs toegang is direct gesloten.`
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Genereer Nieuwe 24-uurs GUID</span>
                  </button>

                  {selectedBook.guid_24h && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyText(selectedBook.guid_24h!, 'guid24h')}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedField === 'guid24h' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-cyan-400" />}
                        <span>{copiedField === 'guid24h' ? 'GUID Gekopieerd!' : 'Kopieer GUID'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            `${window.location.origin}/music?guid=${encodeURIComponent(selectedBook.guid_24h!)}`,
                            'link24h'
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedField === 'link24h' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ExternalLink className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'link24h' ? 'Link Gekopieerd!' : 'Kopieer Directe Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGuid24hInput('');
                          updateBookLockSettings(
                            selectedBook,
                            { guid_24h: null },
                            `24-uurs GUID gewist voor "${selectedBook.title}". Alle 24-uurs toegang is gesloten.`
                          );
                        }}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 cursor-pointer"
                        title="Deactiveer en wis 24-uurs GUID"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 3B. Onbeperkte Ontgrendel-GUID (met toggle-to-lock bij 2e invoer) */}
            <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-xl bg-earth-gold/15 border border-earth-gold/35 text-earth-gold">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-earth-gold font-bold">
                      3B. Onbeperkte Toegang (Aan / Uit Wisselcode)
                    </span>
                    <h3 className="text-lg font-serif font-bold text-white">
                      Onbeperkte GUID — "{selectedBook.title}"
                    </h3>
                  </div>
                </div>
              </div>

              <p className="text-xs text-earth-light/65 leading-relaxed">
                Met deze GUID worden alle SoundTracks van <em>{selectedBook.title}</em> onbeperkt opengemaakt. <strong>Voert die lezer dezelfde code nogmaals in</strong> terwijl de slootjes open zijn, dan gaan de slootjes weer dicht behalve de slootjes die de lezer zelf al geopend heeft. Ook als je deze GUID hier wijzigt gaan bij lezers die de oude GUID gebruikten alle SoundTracks weer op slot behalve hun zelf opengelezen slootjes.
              </p>

              <div className="space-y-2.5 pt-1">
                <label className="block text-[11px] font-mono text-earth-light/60 uppercase">
                  Actieve Onbeperkte GUID (<code>guid_unlimited</code>):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={guidUnlimitedInput}
                    onChange={(e) => setGuidUnlimitedInput(e.target.value)}
                    placeholder="Geen onbeperkte GUID ingesteld..."
                    className="flex-1 bg-black/60 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-mono text-earth-gold focus:border-earth-gold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateBookLockSettings(
                      selectedBook,
                      { guid_unlimited: guidUnlimitedInput.trim() || null },
                      `Onbeperkte GUID bijgewerkt voor "${selectedBook.title}".`
                    )}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 cursor-pointer"
                  >
                    Opslaan
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const newGuid = generateBookGuid();
                      setGuidUnlimitedInput(newGuid);
                      updateBookLockSettings(
                        selectedBook,
                        { guid_unlimited: newGuid },
                        `Nieuwe Onbeperkte GUID gegenereerd voor "${selectedBook.title}"! Lezers met de oude GUID vallen direct terug op hun eigen vrijgelezen nummers.`
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-earth-gold hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Genereer Nieuwe Onbeperkte GUID</span>
                  </button>

                  {selectedBook.guid_unlimited && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyText(selectedBook.guid_unlimited!, 'guidUnl')}
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedField === 'guidUnl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-earth-gold" />}
                        <span>{copiedField === 'guidUnl' ? 'GUID Gekopieerd!' : 'Kopieer GUID'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          copyText(
                            `${window.location.origin}/music?guid=${encodeURIComponent(selectedBook.guid_unlimited!)}`,
                            'linkUnl'
                          )
                        }
                        className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-earth-gold flex items-center gap-1.5 cursor-pointer"
                      >
                        {copiedField === 'linkUnl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ExternalLink className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'linkUnl' ? 'Link Gekopieerd!' : 'Kopieer Directe Link'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setGuidUnlimitedInput('');
                          updateBookLockSettings(
                            selectedBook,
                            { guid_unlimited: null },
                            `Onbeperkte GUID gewist voor "${selectedBook.title}".`
                          );
                        }}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 text-rose-400 cursor-pointer"
                        title="Deactiveer en wis Onbeperkte GUID"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* STAP 4: BEPAAL WELKE SOUNDTRACKS NOOIT OP SLOT MOGEN (VRIJ AANTAL PER BOEK) */}
          <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-earth-gold font-bold">
                  4. Vrij Zichtbare SoundTracks per Boek (Zelf Aantal Bepalen)
                </span>
                <h3 className="text-xl font-serif font-bold text-white flex items-center gap-2 mt-0.5">
                  <Music className="w-5 h-5 text-earth-gold" />
                  <span>Welke SoundTracks van "{selectedBook.title}" mogen NOOIT op slot?</span>
                </h3>
                <p className="text-xs text-earth-light/60 mt-1">
                  Klik op een SoundTrack hieronder om deze op <strong>"Nooit op slot"</strong> (altijd open voor iedere lezer) of <strong>"Op slot"</strong> (pas open na QR-scan in het boek) te zetten. Je bepaalt zelf het aantal.
                </p>
              </div>

              {/* Quick Batch Actions */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs font-mono">
                  <span className="text-emerald-400 font-bold">{alwaysUnlockedCount} nooit op slot</span>
                  <span className="text-white/30 mx-1.5">•</span>
                  <span className="text-earth-gold font-bold">{lockedByDefaultCount} op slot</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const firstTwoIds = bookTracks.slice(0, 2).map(t => t.id);
                    updateBookLockSettings(
                      selectedBook,
                      { always_unlocked_track_ids: firstTwoIds },
                      `Eerste 2 SoundTracks van "${selectedBook.title}" ingesteld op 'Nooit op slot'.`
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-white cursor-pointer"
                >
                  Eerste 2 Vrij
                </button>

                <button
                  type="button"
                  onClick={() => {
                    updateBookLockSettings(
                      selectedBook,
                      { always_unlocked_track_ids: [] },
                      `Alle SoundTracks van "${selectedBook.title}" staan nu standaard op slot (0 vrij).`
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-earth-gold cursor-pointer"
                >
                  Alles op Slot (0 Vrij)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const allIds = bookTracks.map(t => t.id);
                    updateBookLockSettings(
                      selectedBook,
                      { always_unlocked_track_ids: allIds },
                      `Alle ${allIds.length} SoundTracks van "${selectedBook.title}" ingesteld op 'Nooit op slot'.`
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono text-emerald-400 cursor-pointer"
                >
                  Alles Nooit op Slot
                </button>
              </div>
            </div>

            {bookTracks.length === 0 ? (
              <div className="py-10 text-center text-earth-light/40 text-sm">
                Geen SoundTracks gevonden voor dit boek.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bookTracks.map((trk, idx) => {
                  const neverLocked = isTrackAlwaysUnlocked({
                    id: String(trk.id),
                    title: trk.title,
                    folderName: trk.foldername,
                    always_unlocked: trk.always_unlocked
                  });
                  const isBusy = savingId === `track-${trk.id}`;

                  return (
                    <button
                      key={trk.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleToggleTrackAlwaysUnlocked(trk)}
                      className={cn(
                        "p-3.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer group",
                        neverLocked
                          ? "bg-emerald-500/10 border-emerald-500/40 hover:bg-emerald-500/15 shadow-md shadow-emerald-950/20"
                          : "bg-black/40 border-white/10 hover:border-earth-gold/40 hover:bg-white/[0.03]"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-bold border transition-colors",
                          neverLocked
                            ? "bg-emerald-500 text-black border-emerald-400"
                            : "bg-earth-gold/10 text-earth-gold border-earth-gold/30"
                        )}>
                          {neverLocked ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-earth-gold font-bold">
                              #{String(trk.track_order || idx + 1).padStart(2, '0')}
                            </span>
                            <span className="text-sm font-serif font-bold text-white truncate">
                              {trk.title}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-earth-light/45 truncate">
                            {trk.foldername}
                          </div>
                        </div>
                      </div>

                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-mono font-bold shrink-0 border",
                        neverLocked
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-earth-gold/10 text-earth-gold border-earth-gold/30"
                      )}>
                        {neverLocked ? '🔓 Nooit op slot' : '🔒 Op slot'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
