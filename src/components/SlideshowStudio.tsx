import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Images,
  Smartphone,
  Monitor,
  Upload,
  RefreshCw,
  Search,
  Trash2,
  Play,
  Pause,
  X,
  Loader2,
  Eye,
  Film,
  Image as ImageIcon,
  Music,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  FolderOpen,
} from 'lucide-react';

interface TrackSummary {
  folder: string;
  trackNumber: number | null;
  title: string;
  hasSrt: boolean;
  srtFile: string | null;
  hasTxt: boolean;
  audioUrl: string | null;
  coverUrl: string | null;
  portraitCount: number;
  landscapeCount: number;
}

interface SlideMedia {
  mmSs: string;
  filename: string;
  url: string;
  type: 'image' | 'video';
  ext: string;
  size: number;
  updatedAt?: string;
}

interface LyricCue {
  index: number;
  startSeconds: number;
  endSeconds: number;
  mmSs: string;
  text: string;
  sectionId: number;
  sectionType: string;
  sectionLabel: string;
  portrait: SlideMedia | null;
  landscape: SlideMedia | null;
}

interface TrackDetail {
  folder: string;
  title: string;
  srtFile: string | null;
  txtFile: string | null;
  audioUrl: string | null;
  coverUrl: string | null;
  hasSlideshowDir: boolean;
  portraitCount: number;
  landscapeCount: number;
  cues: LyricCue[];
}

const IS_LOCAL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const API_BASE = IS_LOCAL
  ? 'https://paulvangeenen.nl/api/slideshow_studio.php'
  : '/api/slideshow_studio.php';

const MEDIA_ORIGIN = IS_LOCAL ? 'https://paulvangeenen.nl' : '';

const ACCEPT_MEDIA = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm';

const TARGET_DIMENSIONS = {
  portrait: { width: 1080, height: 1920 }, // Exact 9:16
  landscape: { width: 1920, height: 1080 }, // Exact 16:9
} as const;

/**
 * Renders any static image (JPG/PNG/WebP) to exact 9:16 (1080x1920) for Portrait
 * or exact 16:9 (1920x1080) for Landscape using high-quality cover-crop framing.
 * Slightly upper-weighted vertical framing protects faces/heads from being clipped.
 */
async function renderImageToExactAspect(
  source: File | Blob,
  orientation: 'portrait' | 'landscape'
): Promise<File> {
  const { width: targetW, height: targetH } = TARGET_DIMENSIONS[orientation];
  const targetRatio = targetW / targetH;

  const objectUrl = URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Kon afbeelding niet inlezen voor bijsnijden.'));
      el.src = objectUrl;
    });

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) {
      throw new Error('Ongeldige afbeeldingsafmetingen.');
    }

    const srcRatio = srcW / srcH;
    let sx = 0;
    let sy = 0;
    let sw = srcW;
    let sh = srcH;

    if (srcRatio > targetRatio) {
      // Source is wider than target -> crop left & right evenly
      sw = srcH * targetRatio;
      sx = (srcW - sw) / 2;
    } else if (srcRatio < targetRatio) {
      // Source is taller than target -> crop top & bottom (slightly upper-weighted to preserve faces)
      sh = srcW / targetRatio;
      const verticalBias = orientation === 'landscape' ? 0.38 : 0.42;
      sy = (srcH - sh) * verticalBias;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context niet beschikbaar.');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Kon gerenderde afbeelding niet exporteren.'))),
        'image/jpeg',
        0.92
      );
    });

    return new File([blob], `slide_${orientation}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function isStaticImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (type === 'image/gif' || name.endsWith('.gif')) return false;
  return (
    type.startsWith('image/') ||
    /\.(jpe?g|png|webp)$/i.test(name)
  );
}

function toFullMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${MEDIA_ORIGIN}${url}`;
}

function MediaSlot({
  orientation,
  media,
  busy,
  onUpload,
  onDelete,
  onPreview,
}: {
  orientation: 'portrait' | 'landscape';
  media: SlideMedia | null;
  busy: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
  onPreview: (media: SlideMedia) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const isPortrait = orientation === 'portrait';
  const boxSizeClass = isPortrait ? 'w-[76px] h-[112px]' : 'w-[144px] h-[86px]';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  const fullSrc = media ? toFullMediaUrl(media.url) : '';

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_MEDIA}
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={handleDrop}
        onClick={() => {
          if (busy) return;
          if (media) {
            onPreview(media);
          } else {
            inputRef.current?.click();
          }
        }}
        className={`relative group rounded-xl overflow-hidden border transition-all cursor-pointer select-none flex items-center justify-center ${boxSizeClass} ${
          dragOver
            ? 'border-earth-gold bg-earth-gold/20 scale-[1.03] shadow-lg shadow-earth-gold/20'
            : media
              ? 'border-earth-gold/50 bg-black shadow-md shadow-black/40'
              : 'border-dashed border-white/20 bg-white/[0.03] hover:border-earth-gold/60 hover:bg-earth-gold/[0.07]'
        }`}
        title={
          media
            ? `Klik om te bekijken • Sleep een nieuw bestand om te vervangen`
            : `Klik of sleep een ${isPortrait ? 'Portrait' : 'Landscape'} afbeelding of video`
        }
      >
        {busy ? (
          <div className="flex flex-col items-center justify-center gap-1 text-earth-gold">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[9px] uppercase tracking-wider font-semibold">Opslaan…</span>
          </div>
        ) : media ? (
          <>
            {media.type === 'video' ? (
              <video
                src={`${fullSrc}#t=0.3`}
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={fullSrc}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
              />
            )}

            {/* Type badge top-left */}
            <div className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded bg-black/75 border border-white/15 flex items-center gap-0.5 text-[9px] font-bold uppercase text-white/90">
              {media.type === 'video' ? (
                <Film className="w-2.5 h-2.5 text-amber-300" />
              ) : (
                <ImageIcon className="w-2.5 h-2.5 text-emerald-300" />
              )}
            </div>

            {/* Hover action bar */}
            <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 z-20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(media);
                }}
                className="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer"
                title="Bekijken"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
                className="p-1.5 rounded-lg bg-earth-gold/80 hover:bg-earth-gold text-black transition-colors cursor-pointer"
                title="Vervangen"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded-lg bg-rose-600/85 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                title="Verwijderen"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 text-white/40 group-hover:text-earth-gold transition-colors px-1 text-center">
            {isPortrait ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
            <span className="text-[10px] font-medium leading-tight">
              {isPortrait ? 'Portrait' : 'Landscape'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function SlideshowStudio() {
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [trackSearch, setTrackSearch] = useState('');
  const [onlyWithSrt, setOnlyWithSrt] = useState(true);

  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [trackDetail, setTrackDetail] = useState<TrackDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [selectedCueIndex, setSelectedCueIndex] = useState<number | null>(null);
  const [cueFilter, setCueFilter] = useState<'all' | 'filled' | 'empty'>('all');
  const [busySlots, setBusySlots] = useState<Record<string, boolean>>({});
  const [batchResizing, setBatchResizing] = useState(false);

  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [previewModal, setPreviewModal] = useState<{
    media: SlideMedia;
    lyric: string;
    orientation: 'portrait' | 'landscape';
  } | null>(null);

  // Subtle audio audition state (optional play from any lyric line)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingCueIndex, setPlayingCueIndex] = useState<number | null>(null);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3800);
  };

  const fetchTracks = async (autoSelect = false) => {
    setLoadingTracks(true);
    try {
      const res = await fetch(`${API_BASE}?action=list_tracks&_=${Date.now()}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Kon tracks niet laden.');
      const list: TrackSummary[] = data.tracks || [];
      setTracks(list);

      if (autoSelect && !selectedFolder && list.length > 0) {
        const lonely = list.find((t) => t.folder.toLowerCase().includes('lonely christmas'));
        const firstWithSrt = list.find((t) => t.hasSrt);
        const initial = lonely || firstWithSrt || list[0];
        if (initial) {
          setSelectedFolder(initial.folder);
        }
      }
    } catch (err: any) {
      showToast('err', err.message || 'Fout bij ophalen van muziekmappen.');
    } finally {
      setLoadingTracks(false);
    }
  };

  const fetchTrackDetail = async (folder: string) => {
    if (!folder) return;
    setLoadingDetail(true);
    stopAudio();
    try {
      const res = await fetch(
        `${API_BASE}?action=get_track&folder=${encodeURIComponent(folder)}&_=${Date.now()}`
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Kon trackdetails niet laden.');
      setTrackDetail(data.track);
      setSelectedCueIndex(null);
    } catch (err: any) {
      showToast('err', err.message || 'Fout bij laden van songtekst/SRT.');
      setTrackDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    fetchTracks(true);
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      fetchTrackDetail(selectedFolder);
    }
  }, [selectedFolder]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingCueIndex(null);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const handleTogglePlayCue = (cue: LyricCue) => {
    if (!trackDetail?.audioUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    if (playingCueIndex === cue.index && !audio.paused) {
      audio.pause();
      setPlayingCueIndex(null);
      return;
    }

    const fullAudioUrl = toFullMediaUrl(trackDetail.audioUrl);
    if (audio.src !== fullAudioUrl) {
      audio.src = fullAudioUrl;
    }
    try {
      audio.currentTime = Math.max(0, cue.startSeconds);
    } catch {
      // ignore if metadata not yet loaded
    }
    audio.play().catch(() => {});
    setPlayingCueIndex(cue.index);
  };

  const handleUploadSlot = async (
    cue: LyricCue,
    orientation: 'portrait' | 'landscape',
    file: File
  ) => {
    if (!trackDetail) return;
    const slotKey = `${cue.mmSs}:${orientation}`;
    setBusySlots((prev) => ({ ...prev, [slotKey]: true }));

    try {
      // Automatisch bijsnijden & renderen naar exact 9:16 (Portrait) of 16:9 (Landscape) voor foto's
      let fileToUpload: File = file;
      let wasRendered = false;
      if (isStaticImageFile(file)) {
        fileToUpload = await renderImageToExactAspect(file, orientation);
        wasRendered = true;
      }

      const formData = new FormData();
      formData.append('action', 'upload');
      formData.append('folder', trackDetail.folder);
      formData.append('orientation', orientation);
      formData.append('mmSs', cue.mmSs);
      formData.append('lyricText', cue.text);
      formData.append('file', fileToUpload);

      const res = await fetch(API_BASE, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload mislukt.');

      const savedItem: SlideMedia = data.item;

      // Update detail state immediately
      setTrackDetail((prev) => {
        if (!prev) return prev;
        const nextCues = prev.cues.map((c) => {
          if (c.mmSs !== cue.mmSs) return c;
          return {
            ...c,
            [orientation]: savedItem,
          };
        });
        const portraitCount = nextCues.filter((c) => c.portrait).length;
        const landscapeCount = nextCues.filter((c) => c.landscape).length;
        return {
          ...prev,
          hasSlideshowDir: true,
          portraitCount,
          landscapeCount,
          cues: nextCues,
        };
      });

      // Update sidebar counts
      setTracks((prev) =>
        prev.map((t) => {
          if (t.folder !== trackDetail.folder) return t;
          const hadAlready = orientation === 'portrait' ? !!cue.portrait : !!cue.landscape;
          return {
            ...t,
            portraitCount:
              orientation === 'portrait' && !hadAlready ? t.portraitCount + 1 : t.portraitCount,
            landscapeCount:
              orientation === 'landscape' && !hadAlready ? t.landscapeCount + 1 : t.landscapeCount,
          };
        })
      );

      showToast(
        'ok',
        wasRendered
          ? `${orientation === 'portrait' ? 'Portrait (9:16)' : 'Landscape (16:9)'} gerenderd & opgeslagen!`
          : `${orientation === 'portrait' ? 'Portrait' : 'Landscape'} opgeslagen in slideshow/${orientation}/`
      );
    } catch (err: any) {
      showToast('err', err.message || 'Kon bestand niet opslaan.');
    } finally {
      setBusySlots((prev) => {
        const copy = { ...prev };
        delete copy[slotKey];
        return copy;
      });
    }
  };

  const handleBatchRenderExisting = async () => {
    if (!trackDetail || batchResizing) return;
    const jobs: Array<{ cue: LyricCue; orientation: 'portrait' | 'landscape'; media: SlideMedia }> = [];
    for (const cue of trackDetail.cues) {
      if (cue.portrait && cue.portrait.type === 'image' && cue.portrait.ext !== 'gif') {
        jobs.push({ cue, orientation: 'portrait', media: cue.portrait });
      }
      if (cue.landscape && cue.landscape.type === 'image' && cue.landscape.ext !== 'gif') {
        jobs.push({ cue, orientation: 'landscape', media: cue.landscape });
      }
    }
    if (jobs.length === 0) {
      showToast('err', 'Geen bestaande afbeeldingen gevonden om te renderen.');
      return;
    }

    setBatchResizing(true);
    let okCount = 0;
    try {
      for (const job of jobs) {
        const slotKey = `${job.cue.mmSs}:${job.orientation}`;
        setBusySlots((prev) => ({ ...prev, [slotKey]: true }));
        try {
          const resp = await fetch(toFullMediaUrl(job.media.url));
          if (!resp.ok) throw new Error('Kon bronafbeelding niet ophalen.');
          const srcBlob = await resp.blob();
          const renderedFile = await renderImageToExactAspect(srcBlob, job.orientation);

          const formData = new FormData();
          formData.append('action', 'upload');
          formData.append('folder', trackDetail.folder);
          formData.append('orientation', job.orientation);
          formData.append('mmSs', job.cue.mmSs);
          formData.append('lyricText', job.cue.text);
          formData.append('file', renderedFile);

          const upRes = await fetch(API_BASE, { method: 'POST', body: formData });
          const upData = await upRes.json();
          if (upData.success && upData.item) {
            okCount++;
            setTrackDetail((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                cues: prev.cues.map((c) =>
                  c.mmSs === job.cue.mmSs ? { ...c, [job.orientation]: upData.item } : c
                ),
              };
            });
          }
        } catch {
          // continue with next image
        } finally {
          setBusySlots((prev) => {
            const copy = { ...prev };
            delete copy[slotKey];
            return copy;
          });
        }
      }
      showToast('ok', `${okCount} bestaande foto('s) exact gerenderd naar 9:16 & 16:9!`);
    } finally {
      setBatchResizing(false);
    }
  };

  const handleDeleteSlot = async (cue: LyricCue, orientation: 'portrait' | 'landscape') => {
    if (!trackDetail) return;
    const slotKey = `${cue.mmSs}:${orientation}`;
    setBusySlots((prev) => ({ ...prev, [slotKey]: true }));

    try {
      const res = await fetch(`${API_BASE}?action=delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: trackDetail.folder,
          orientation,
          mmSs: cue.mmSs,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Verwijderen mislukt.');

      setTrackDetail((prev) => {
        if (!prev) return prev;
        const nextCues = prev.cues.map((c) => {
          if (c.mmSs !== cue.mmSs) return c;
          return {
            ...c,
            [orientation]: null,
          };
        });
        return {
          ...prev,
          portraitCount: nextCues.filter((c) => c.portrait).length,
          landscapeCount: nextCues.filter((c) => c.landscape).length,
          cues: nextCues,
        };
      });

      setTracks((prev) =>
        prev.map((t) => {
          if (t.folder !== trackDetail.folder) return t;
          return {
            ...t,
            portraitCount:
              orientation === 'portrait' ? Math.max(0, t.portraitCount - 1) : t.portraitCount,
            landscapeCount:
              orientation === 'landscape' ? Math.max(0, t.landscapeCount - 1) : t.landscapeCount,
          };
        })
      );

      showToast('ok', `${orientation === 'portrait' ? 'Portrait' : 'Landscape'} verwijderd.`);
    } catch (err: any) {
      showToast('err', err.message || 'Kon bestand niet verwijderen.');
    } finally {
      setBusySlots((prev) => {
        const copy = { ...prev };
        delete copy[slotKey];
        return copy;
      });
    }
  };

  const filteredTracks = useMemo(() => {
    const q = trackSearch.trim().toLowerCase();
    return tracks
      .filter((t) => (!onlyWithSrt ? true : t.hasSrt))
      .filter((t) => (!q ? true : t.folder.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)))
      .slice()
      .sort((a, b) => {
        // Put tracks with slideshow media or higher track numbers cleanly in natural descending order?
        // Keep highest track number first when filtering by SRT so 136..142 appear right at the top!
        const numA = a.trackNumber ?? -1;
        const numB = b.trackNumber ?? -1;
        if (numA !== numB) return numB - numA;
        return a.folder.localeCompare(b.folder);
      });
  }, [tracks, trackSearch, onlyWithSrt]);

  const groupedSections = useMemo(() => {
    if (!trackDetail) return [];
    const filteredCues = trackDetail.cues.filter((cue) => {
      if (cueFilter === 'filled') return Boolean(cue.portrait || cue.landscape);
      if (cueFilter === 'empty') return !cue.portrait && !cue.landscape;
      return true;
    });

    const groups: Array<{
      key: string;
      sectionId: number;
      sectionType: string;
      sectionLabel: string;
      cues: LyricCue[];
    }> = [];

    for (const cue of filteredCues) {
      const last = groups[groups.length - 1];
      if (last && last.sectionId === cue.sectionId && last.sectionLabel === cue.sectionLabel) {
        last.cues.push(cue);
      } else {
        groups.push({
          key: `${cue.sectionId}-${cue.sectionLabel}-${groups.length}`,
          sectionId: cue.sectionId,
          sectionType: cue.sectionType,
          sectionLabel: cue.sectionLabel,
          cues: [cue],
        });
      }
    }
    return groups;
  }, [trackDetail, cueFilter]);

  const totalCues = trackDetail?.cues.length || 0;
  const filledPortrait = trackDetail?.cues.filter((c) => c.portrait).length || 0;
  const filledLandscape = trackDetail?.cues.filter((c) => c.landscape).length || 0;
  const linesWithAnyMedia = trackDetail?.cues.filter((c) => c.portrait || c.landscape).length || 0;

  return (
    <div className="space-y-6">
      <audio ref={audioRef} onEnded={() => setPlayingCueIndex(null)} className="hidden" />

      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900/70 border border-earth-gold/25 rounded-2xl p-5">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-earth-gold/15 border border-earth-gold/30 flex items-center justify-center shrink-0">
            <Images className="w-5 h-5 text-earth-gold" />
          </div>
          <div>
            <h2 className="font-serif text-2xl text-white flex items-center gap-2">
              Slideshow Studio
              <span className="text-[11px] font-sans uppercase tracking-wider px-2 py-0.5 rounded-full bg-earth-gold/15 text-earth-gold border border-earth-gold/30">
                Portrait & Landscape
              </span>
            </h2>
            <p className="text-xs text-earth-light/65 mt-1 max-w-2xl">
              Kies een nummer en koppel per gezongen regel een afbeelding of video voor Portrait en/of Landscape.
              Mappen (<code className="text-earth-gold/90">slideshow/portrait</code> en{' '}
              <code className="text-earth-gold/90">slideshow/landscape</code>) en de bestandsnaam met tijdcode worden automatisch geregeld.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchTracks(false);
            if (selectedFolder) fetchTrackDetail(selectedFolder);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs text-white/90 transition-colors cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingTracks || loadingDetail ? 'animate-spin' : ''}`} />
          <span>Vernieuwen</span>
        </button>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-medium ${
            toast.type === 'ok'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Main 2-column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: TRACK PICKER */}
        <div className="lg:col-span-4 xl:col-span-3 bg-stone-900/60 border border-white/10 rounded-2xl overflow-hidden flex flex-col max-h-[78vh]">
          <div className="p-3.5 border-b border-white/10 space-y-2.5 bg-black/30">
            <div className="relative">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={trackSearch}
                onChange={(e) => setTrackSearch(e.target.value)}
                placeholder="Zoek nummer..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-earth-gold"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setOnlyWithSrt(true)}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                  onlyWithSrt
                    ? 'bg-earth-gold text-black border-earth-gold font-bold'
                    : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
                }`}
              >
                Met SRT ({tracks.filter((t) => t.hasSrt).length})
              </button>
              <button
                type="button"
                onClick={() => setOnlyWithSrt(false)}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                  !onlyWithSrt
                    ? 'bg-earth-gold text-black border-earth-gold font-bold'
                    : 'bg-white/5 text-white/70 border-white/10 hover:text-white'
                }`}
              >
                Alle ({tracks.length})
              </button>
            </div>
          </div>

          <div className="overflow-y-auto divide-y divide-white/5 flex-1">
            {loadingTracks ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2 text-white/50 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-earth-gold" />
                <span>Muziekmappen laden…</span>
              </div>
            ) : filteredTracks.length === 0 ? (
              <div className="p-6 text-center text-xs text-white/45">
                Geen nummers gevonden.
              </div>
            ) : (
              filteredTracks.map((track) => {
                const active = track.folder === selectedFolder;
                const totalSlides = track.portraitCount + track.landscapeCount;
                return (
                  <button
                    key={track.folder}
                    type="button"
                    onClick={() => setSelectedFolder(track.folder)}
                    className={`w-full text-left p-3 flex items-center gap-3 transition-colors cursor-pointer ${
                      active
                        ? 'bg-earth-gold/15 border-l-2 border-l-earth-gold'
                        : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/60 border border-white/10 shrink-0 flex items-center justify-center">
                      {track.coverUrl ? (
                        <img
                          src={toFullMediaUrl(track.coverUrl)}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-4 h-4 text-white/30" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {track.trackNumber !== null && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-earth-gold shrink-0">
                            {track.trackNumber}
                          </span>
                        )}
                        <span
                          className={`text-xs font-medium truncate ${
                            active ? 'text-white font-semibold' : 'text-white/85'
                          }`}
                        >
                          {track.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        {track.hasSrt ? (
                          <span className="text-emerald-400/90">SRT gereed</span>
                        ) : (
                          <span className="text-white/35">Geen SRT</span>
                        )}

                        {totalSlides > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-earth-gold/20 text-earth-gold font-semibold">
                            P:{track.portraitCount} · L:{track.landscapeCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LYRIC OVERVIEW & SLOTS */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {loadingDetail ? (
            <div className="bg-stone-900/60 border border-white/10 rounded-2xl p-16 flex flex-col items-center justify-center gap-3 text-white/55">
              <Loader2 className="w-7 h-7 animate-spin text-earth-gold" />
              <span className="text-sm">Songtekst en slideshow laden…</span>
            </div>
          ) : !trackDetail ? (
            <div className="bg-stone-900/60 border border-white/10 rounded-2xl p-16 text-center text-white/50 text-sm">
              Kies links een nummer om de songtekst te openen.
            </div>
          ) : (
            <>
              {/* Track Overview Card */}
              <div className="bg-stone-900/75 border border-earth-gold/25 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-black border border-earth-gold/30 shrink-0 flex items-center justify-center">
                    {trackDetail.coverUrl ? (
                      <img
                        src={toFullMediaUrl(trackDetail.coverUrl)}
                        alt={trackDetail.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-6 h-6 text-white/30" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-serif text-xl sm:text-2xl text-white truncate">
                      {trackDetail.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/75">
                        <FolderOpen className="w-3 h-3 text-earth-gold" />
                        {trackDetail.folder}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 font-medium">
                        <Smartphone className="w-3 h-3" />
                        Portrait: {filledPortrait} / {totalCues}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-200 font-medium">
                        <Monitor className="w-3 h-3" />
                        Landscape: {filledLandscape} / {totalCues}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Filter & Batch Render buttons */}
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
                  {linesWithAnyMedia > 0 && (
                    <button
                      type="button"
                      disabled={batchResizing}
                      onClick={handleBatchRenderExisting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-earth-gold/15 hover:bg-earth-gold/25 border border-earth-gold/40 text-earth-gold text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                      title="Snijd alle al geüploade foto's van dit nummer automatisch bij naar exact 9:16 (Portrait) en 16:9 (Landscape)"
                    >
                      {batchResizing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{batchResizing ? 'Renderen…' : 'Bestaande → 9:16 / 16:9'}</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setCueFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        cueFilter === 'all'
                          ? 'bg-earth-gold text-black font-bold'
                          : 'text-white/65 hover:text-white'
                      }`}
                    >
                      Alles ({totalCues})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCueFilter('filled')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        cueFilter === 'filled'
                          ? 'bg-earth-gold text-black font-bold'
                          : 'text-white/65 hover:text-white'
                      }`}
                    >
                      Met beeld ({linesWithAnyMedia})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCueFilter('empty')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        cueFilter === 'empty'
                          ? 'bg-earth-gold text-black font-bold'
                          : 'text-white/65 hover:text-white'
                      }`}
                    >
                      Nog leeg ({totalCues - linesWithAnyMedia})
                    </button>
                  </div>
                </div>
              </div>

              {/* No SRT notice */}
              {!trackDetail.srtFile || trackDetail.cues.length === 0 ? (
                <div className="bg-stone-900/60 border border-amber-500/30 rounded-2xl p-10 text-center space-y-2">
                  <AlertCircle className="w-7 h-7 text-amber-400 mx-auto" />
                  <p className="text-sm text-white font-medium">
                    Geen Engelse SRT gevonden in {trackDetail.folder}
                  </p>
                  <p className="text-xs text-white/55">
                    Plaats eerst een <code className="text-amber-300">_EN.srt</code> bestand in deze trackmap om de regels te kunnen koppelen.
                  </p>
                </div>
              ) : groupedSections.length === 0 ? (
                <div className="bg-stone-900/60 border border-white/10 rounded-2xl p-10 text-center text-xs text-white/50">
                  Geen regels in dit filter.
                </div>
              ) : (
                /* Sections & Lyric Lines */
                <div className="space-y-5">
                  {groupedSections.map((group) => {
                    const isChorus = group.sectionType.includes('chorus');
                    const isBridge = group.sectionType.includes('bridge');
                    return (
                      <div
                        key={group.key}
                        className={`rounded-2xl border overflow-hidden ${
                          isChorus
                            ? 'bg-gradient-to-b from-earth-gold/[0.08] to-stone-950/80 border-earth-gold/35'
                            : isBridge
                              ? 'bg-gradient-to-b from-amber-500/[0.07] to-stone-950/80 border-amber-400/25'
                              : 'bg-stone-900/60 border-white/10'
                        }`}
                      >
                        {/* Section Header */}
                        <div
                          className={`px-4 py-2.5 border-b flex items-center justify-between ${
                            isChorus
                              ? 'bg-earth-gold/15 border-earth-gold/25'
                              : 'bg-black/30 border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles
                              className={`w-3.5 h-3.5 ${
                                isChorus ? 'text-earth-gold' : 'text-white/45'
                              }`}
                            />
                            <span
                              className={`text-xs font-bold uppercase tracking-widest ${
                                isChorus ? 'text-earth-gold' : 'text-white/75'
                              }`}
                            >
                              {group.sectionLabel}
                            </span>
                          </div>
                          <span className="text-[11px] text-white/45">
                            {group.cues.filter((c) => c.portrait || c.landscape).length} /{' '}
                            {group.cues.length} regels gekoppeld
                          </span>
                        </div>

                        {/* Lyric Rows */}
                        <div className="divide-y divide-white/[0.06]">
                          {group.cues.map((cue) => {
                            const isSelected = selectedCueIndex === cue.index;
                            const isPlaying = playingCueIndex === cue.index;
                            const hasAny = Boolean(cue.portrait || cue.landscape);

                            return (
                              <div
                                key={cue.index}
                                onClick={() => setSelectedCueIndex(cue.index)}
                                className={`px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-earth-gold/[0.09]'
                                    : hasAny
                                      ? 'bg-white/[0.015] hover:bg-white/[0.04]'
                                      : 'hover:bg-white/[0.03]'
                                }`}
                              >
                                {/* Left: Clean Lyric Line (NO timestamp shown!) */}
                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                  {trackDetail.audioUrl && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleTogglePlayCue(cue);
                                      }}
                                      className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-all cursor-pointer ${
                                        isPlaying
                                          ? 'bg-earth-gold text-black border-earth-gold shadow-md shadow-earth-gold/30'
                                          : 'bg-white/5 text-white/60 border-white/15 hover:border-earth-gold hover:text-earth-gold'
                                      }`}
                                      title={isPlaying ? 'Pauzeer voorbeluistering' : 'Beluister vanaf deze regel'}
                                    >
                                      {isPlaying ? (
                                        <Pause className="w-3.5 h-3.5" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 ml-0.5" />
                                      )}
                                    </button>
                                  )}

                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`font-serif text-base sm:text-lg leading-snug ${
                                        hasAny ? 'text-white' : 'text-white/85'
                                      }`}
                                    >
                                      {cue.text}
                                    </p>

                                    {hasAny && (
                                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                        {cue.portrait && (
                                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/25">
                                            <Smartphone className="w-2.5 h-2.5" />
                                            Portrait gekoppeld
                                          </span>
                                        )}
                                        {cue.landscape && (
                                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-400/25">
                                            <Monitor className="w-2.5 h-2.5" />
                                            Landscape gekoppeld
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right: Portrait + Landscape Media Slots */}
                                <div
                                  className="flex items-center gap-3 self-end md:self-center shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MediaSlot
                                    orientation="portrait"
                                    media={cue.portrait}
                                    busy={Boolean(busySlots[`${cue.mmSs}:portrait`])}
                                    onUpload={(file) => handleUploadSlot(cue, 'portrait', file)}
                                    onDelete={() => handleDeleteSlot(cue, 'portrait')}
                                    onPreview={(media) =>
                                      setPreviewModal({
                                        media,
                                        lyric: cue.text,
                                        orientation: 'portrait',
                                      })
                                    }
                                  />
                                  <MediaSlot
                                    orientation="landscape"
                                    media={cue.landscape}
                                    busy={Boolean(busySlots[`${cue.mmSs}:landscape`])}
                                    onUpload={(file) => handleUploadSlot(cue, 'landscape', file)}
                                    onDelete={() => handleDeleteSlot(cue, 'landscape')}
                                    onPreview={(media) =>
                                      setPreviewModal({
                                        media,
                                        lyric: cue.text,
                                        orientation: 'landscape',
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox Preview Modal */}
      {previewModal && (
        <div
          onClick={() => setPreviewModal(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full bg-stone-950 border border-earth-gold/30 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-medium text-earth-gold uppercase tracking-wider">
                {previewModal.orientation === 'portrait' ? (
                  <Smartphone className="w-4 h-4" />
                ) : (
                  <Monitor className="w-4 h-4" />
                )}
                <span>{previewModal.orientation === 'portrait' ? 'Portrait' : 'Landscape'}</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black flex items-center justify-center max-h-[70vh] overflow-hidden p-3">
              {previewModal.media.type === 'video' ? (
                <video
                  src={toFullMediaUrl(previewModal.media.url)}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="max-h-[66vh] max-w-full rounded-lg object-contain"
                />
              ) : (
                <img
                  src={toFullMediaUrl(previewModal.media.url)}
                  alt={previewModal.lyric}
                  className="max-h-[66vh] max-w-full rounded-lg object-contain"
                />
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/10 space-y-1">
              <p className="font-serif text-lg text-white">“{previewModal.lyric}”</p>
              <p className="text-[11px] font-mono text-white/40 truncate">
                slideshow/{previewModal.orientation}/{previewModal.media.filename}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
