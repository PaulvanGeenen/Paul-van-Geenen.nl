import React, { useEffect, useRef, useState } from 'react';
import {
  Film,
  Smartphone,
  Monitor,
  Upload,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Search,
  Trash2,
  Play,
  X,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

export interface HomeVideoItem {
  orientation: 'portrait' | 'landscape';
  filename: string;
  url: string;
  size: number;
  enabled: boolean;
  updatedAt?: string;
}

const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'https://paulvangeenen.nl/api/home_videos.php'
    : '/api/home_videos.php';

const MEDIA_ORIGIN =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? ''
    : '';

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function VideoThumbCard({
  video,
  busy,
  onToggle,
  onPreview,
  onDelete,
}: {
  video: HomeVideoItem;
  busy: boolean;
  onToggle: (v: HomeVideoItem) => void;
  onPreview: (v: HomeVideoItem) => void;
  onDelete: (v: HomeVideoItem) => void;
}) {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const [hovered, setHovered] = useState(false);

  const fullSrc = `${MEDIA_ORIGIN}${video.url}`;
  const thumbSrc = `${fullSrc}#t=0.5`;

  const handleMouseEnter = () => {
    setHovered(true);
    const el = vidRef.current;
    if (el) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setHovered(false);
    const el = vidRef.current;
    if (el) {
      el.pause();
      try {
        el.currentTime = 0.5;
      } catch {}
    }
  };

  return (
    <div
      className={`group rounded-2xl border overflow-hidden transition-all flex flex-col ${
        video.enabled
          ? 'bg-stone-900/70 border-earth-gold/35 shadow-[0_8px_24px_rgba(0,0,0,0.35)]'
          : 'bg-stone-950/60 border-white/10 opacity-60 hover:opacity-90'
      }`}
    >
      {/* Video Thumbnail */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={() => onPreview(video)}
        className={`relative w-full bg-black overflow-hidden cursor-pointer ${
          video.orientation === 'portrait' ? 'aspect-[9/16]' : 'aspect-video'
        }`}
      >
        <video
          ref={vidRef}
          src={thumbSrc}
          muted
          loop
          playsInline
          preload="metadata"
          className={`w-full h-full object-cover transition-transform duration-500 ${
            hovered ? 'scale-105' : 'scale-100'
          }`}
        />

        {/* Status badge top-left */}
        <div className="absolute top-2 left-2 z-10">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border ${
              video.enabled
                ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40'
                : 'bg-black/65 text-stone-400 border-white/15'
            }`}
          >
            {video.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {video.enabled ? 'Aan' : 'Uit'}
          </span>
        </div>

        {/* Preview play badge */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-black/60 border border-white/25 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>

        {/* File size badge bottom-right */}
        <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-mono text-stone-300 backdrop-blur-sm">
          {formatSize(video.size)}
        </span>
      </div>

      {/* Footer info & toggle */}
      <div className="p-3 flex flex-col gap-2.5">
        <p
          className="text-xs font-medium text-stone-200 truncate"
          title={video.filename}
        >
          {video.filename}
        </p>

        <div className="flex items-center justify-between gap-2">
          {/* Toggle switch */}
          <button
            type="button"
            disabled={busy}
            onClick={() => onToggle(video)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
              video.enabled
                ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/35'
                : 'bg-white/5 hover:bg-white/10 text-stone-300 border-white/15'
            }`}
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : video.enabled ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            <span>{video.enabled ? 'Zichtbaar' : 'Verborgen'}</span>
          </button>

          {/* Delete button */}
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(video)}
            title="Verwijder bestand van server"
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/20 transition-colors cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function HomeVideosManager() {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [portraitVideos, setPortraitVideos] = useState<HomeVideoItem[]>([]);
  const [landscapeVideos, setLandscapeVideos] = useState<HomeVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [previewVideo, setPreviewVideo] = useState<HomeVideoItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}?action=list&orientation=all&_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Kon video’s niet laden.');
      setPortraitVideos(Array.isArray(data.portrait) ? data.portrait : []);
      setLandscapeVideos(Array.isArray(data.landscape) ? data.landscape : []);
    } catch (err: any) {
      setError(err?.message || 'Kon homepage-video’s niet ophalen.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const currentList = orientation === 'portrait' ? portraitVideos : landscapeVideos;
  const setCurrentList = (updater: (prev: HomeVideoItem[]) => HomeVideoItem[]) => {
    if (orientation === 'portrait') {
      setPortraitVideos(updater);
    } else {
      setLandscapeVideos(updater);
    }
  };

  const handleToggle = async (video: HomeVideoItem) => {
    const key = `${video.orientation}:${video.filename}`;
    const nextEnabled = !video.enabled;
    setBusyKey(key);
    setStatusMessage(null);
    setError(null);

    // Optimistic update
    setCurrentList((prev) =>
      prev.map((item) =>
        item.filename === video.filename ? { ...item, enabled: nextEnabled } : item
      )
    );

    try {
      const res = await fetch(`${API_BASE}?action=toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orientation: video.orientation,
          filename: video.filename,
          enabled: nextEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Opslaan mislukt');
      }
    } catch (err: any) {
      // Revert on failure
      setCurrentList((prev) =>
        prev.map((item) =>
          item.filename === video.filename ? { ...item, enabled: video.enabled } : item
        )
      );
      setError(err?.message || 'Kon status niet opslaan.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleBulkToggle = async (enabled: boolean) => {
    setBulkBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}?action=bulk_toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orientation, enabled }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Actie mislukt');
      setCurrentList((prev) => prev.map((v) => ({ ...v, enabled })));
      setStatusMessage(
        `Alle ${orientation === 'portrait' ? 'Portrait' : 'Landscape'}-video’s staan nu ${
          enabled ? 'AAN' : 'UIT'
        }.`
      );
    } catch (err: any) {
      setError(err?.message || 'Bulk-actie mislukt.');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.mov'));
    if (validFiles.length === 0) {
      setError('Selecteer één of meer .mov bestanden.');
      return;
    }

    setUploading(true);
    setError(null);
    setStatusMessage(null);

    try {
      let uploadedCount = 0;
      const uploadErrors: string[] = [];

      // Upload bestand voor bestand zodat grote .mov files nooit tegen PHP post_max_size aanlopen
      for (const file of validFiles) {
        const fd = new FormData();
        fd.append('action', 'upload');
        fd.append('orientation', orientation);
        fd.append('file', file);

        const res = await fetch(`${API_BASE}?action=upload`, {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (res.ok && data.success) {
          uploadedCount += Array.isArray(data.uploaded) ? data.uploaded.length : 1;
        } else {
          uploadErrors.push(`${file.name}: ${data.error || 'Upload mislukt'}`);
        }
      }

      if (uploadedCount > 0) {
        setStatusMessage(
          `${uploadedCount} .mov bestand${uploadedCount === 1 ? '' : 'en'} geüpload naar ${
            orientation === 'portrait' ? 'Portrait' : 'Landscape'
          } (direct ingeschakeld).`
        );
        await loadVideos();
      }
      if (uploadErrors.length > 0) {
        setError(uploadErrors.join(' | '));
      }
    } catch (err: any) {
      setError(err?.message || 'Uploaden mislukt.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (video: HomeVideoItem) => {
    if (!window.confirm(`Weet je zeker dat je "${video.filename}" definitief wilt verwijderen?`)) {
      return;
    }
    const key = `${video.orientation}:${video.filename}`;
    setBusyKey(key);
    setError(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`${API_BASE}?action=delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orientation: video.orientation,
          filename: video.filename,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Verwijderen mislukt');
      setCurrentList((prev) => prev.filter((item) => item.filename !== video.filename));
      setStatusMessage(`"${video.filename}" is verwijderd.`);
    } catch (err: any) {
      setError(err?.message || 'Verwijderen mislukt.');
    } finally {
      setBusyKey(null);
    }
  };

  const portraitEnabledCount = portraitVideos.filter((v) => v.enabled).length;
  const landscapeEnabledCount = landscapeVideos.filter((v) => v.enabled).length;

  const filteredVideos = currentList.filter((v) => {
    if (filterMode === 'enabled' && !v.enabled) return false;
    if (filterMode === 'disabled' && v.enabled) return false;
    if (searchQuery.trim() && !v.filename.toLowerCase().includes(searchQuery.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-stone-900/60 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-earth-gold/15 border border-earth-gold/30 flex items-center justify-center text-earth-gold shrink-0">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-serif text-white">Homepage Achtergrondvideo&apos;s</h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Beheer welke <code className="text-earth-gold">.mov</code> bestanden in willekeurige volgorde met fade-overgangen op de homepage worden afgespeeld.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".mov,video/quicktime"
              multiple
              onChange={(e) => handleUploadFiles(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-earth-gold hover:bg-amber-400 text-black text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-lg"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>
                {uploading
                  ? 'Uploaden...'
                  : `.mov uploaden (${orientation === 'portrait' ? 'Portrait' : 'Landscape'})`}
              </span>
            </button>

            <button
              type="button"
              onClick={loadVideos}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-200 text-xs font-medium border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Vernieuwen</span>
            </button>
          </div>
        </div>

        {/* Orientation Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
          <div className="inline-flex p-1 rounded-xl bg-black/40 border border-white/10">
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                orientation === 'portrait'
                  ? 'bg-earth-gold text-black shadow-md'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Portrait (Mobiel)</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  orientation === 'portrait'
                    ? 'bg-black/20 text-black'
                    : 'bg-white/10 text-stone-300'
                }`}
              >
                {portraitEnabledCount}/{portraitVideos.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                orientation === 'landscape'
                  ? 'bg-earth-gold text-black shadow-md'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              <Monitor className="w-4 h-4" />
              <span>Landscape (Desktop/Tablet)</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  orientation === 'landscape'
                    ? 'bg-black/20 text-black'
                    : 'bg-white/10 text-stone-300'
                }`}
              >
                {landscapeEnabledCount}/{landscapeVideos.length}
              </span>
            </button>
          </div>

          {/* Bulk & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Zoek bestandsnaam..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-earth-gold/50 w-44"
              />
            </div>

            <div className="inline-flex rounded-lg bg-black/40 border border-white/10 p-0.5 text-[11px]">
              {(['all', 'enabled', 'disabled'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFilterMode(mode)}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    filterMode === mode
                      ? 'bg-white/15 text-white'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {mode === 'all' ? 'Alle' : mode === 'enabled' ? 'Aan' : 'Uit'}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={bulkBusy || currentList.length === 0}
              onClick={() => handleBulkToggle(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              Alles aan
            </button>
            <button
              type="button"
              disabled={bulkBusy || currentList.length === 0}
              onClick={() => handleBulkToggle(false)}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 text-xs font-semibold cursor-pointer disabled:opacity-40"
            >
              Alles uit
            </button>
          </div>
        </div>

        {/* Feedback Banners */}
        {statusMessage && (
          <div className="px-4 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs">
            {statusMessage}
          </div>
        )}
        {error && (
          <div className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Thumbnail Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-stone-400 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-earth-gold" />
          <span>Video&apos;s laden...</span>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-16 bg-stone-900/40 border border-white/10 rounded-2xl text-stone-400 text-sm">
          Geen <code className="text-earth-gold">.mov</code> bestanden gevonden voor deze selectie.
        </div>
      ) : (
        <div
          className={
            orientation === 'portrait'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
          }
        >
          {filteredVideos.map((video) => (
            <VideoThumbCard
              key={`${video.orientation}:${video.filename}`}
              video={video}
              busy={busyKey === `${video.orientation}:${video.filename}`}
              onToggle={handleToggle}
              onPreview={setPreviewVideo}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewVideo && (
        <div
          onClick={() => setPreviewVideo(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl w-full bg-stone-950 border border-white/15 rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{previewVideo.filename}</p>
                <p className="text-[11px] text-stone-400">
                  {previewVideo.orientation === 'portrait' ? 'Portrait' : 'Landscape'} •{' '}
                  {formatSize(previewVideo.size)} • {previewVideo.enabled ? 'Zichtbaar op homepage' : 'Uitgeschakeld'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-black flex items-center justify-center max-h-[75vh]">
              <video
                src={previewVideo.url}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="max-h-[75vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
