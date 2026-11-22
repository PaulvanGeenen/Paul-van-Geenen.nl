import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Film,
  Image as ImageIcon,
  Music,
  Play,
  Square,
  Download,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Volume2,
} from 'lucide-react';

type AspectPreset = '9:16' | '1:1' | '16:9';
type WaveStyle = 'bars' | 'mirror' | 'wave';

interface FormatConfig {
  label: string;
  subtitle: string;
  width: number;
  height: number;
}

const FORMATS: Record<AspectPreset, FormatConfig> = {
  '9:16': {
    label: '9:16 Portret (Telefoon / Reels)',
    subtitle: '1080 × 1920',
    width: 1080,
    height: 1920,
  },
  '1:1': {
    label: '1:1 Vierkant (Feed / Post)',
    subtitle: '1080 × 1080',
    width: 1080,
    height: 1080,
  },
  '16:9': {
    label: '16:9 Breedbeeld (YouTube / TV)',
    subtitle: '1920 × 1080',
    width: 1920,
    height: 1080,
  },
};

const COLOR_PRESETS = [
  { name: 'Lion Goud', hex: '#e0bd82' },
  { name: 'Warm Wit', hex: '#f8f5ef' },
  { name: 'Koper', hex: '#c87d4b' },
  { name: 'Robijn', hex: '#e05a6d' },
];

function pickSupportedRecorderMime(): { mimeType: string; ext: 'mp4' | 'webm' } {
  if (typeof MediaRecorder === 'undefined') {
    return { mimeType: '', ext: 'mp4' };
  }
  const candidates: Array<{ mimeType: string; ext: 'mp4' | 'webm' }> = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', ext: 'mp4' },
    { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
    } catch {
      // ignore
    }
  }
  return { mimeType: '', ext: 'webm' };
}

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AudioVideoStudio() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  const [aspect, setAspect] = useState<AspectPreset>('9:16');
  const [waveStyle, setWaveStyle] = useState<WaveStyle>('mirror');
  const [waveColor, setWaveColor] = useState<string>('#e0bd82');
  const [waveHeightPct, setWaveHeightPct] = useState<number>(16);
  const [showBottomFade, setShowBottomFade] = useState<boolean>(true);
  const [captionText, setCaptionText] = useState<string>('');

  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const [renderedExt, setRenderedExt] = useState<'mp4' | 'webm'>('mp4');
  const [statusError, setStatusError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const smoothedBarsRef = useRef<Float32Array>(new Float32Array(64));

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (renderedVideoUrl) URL.revokeObjectURL(renderedVideoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImagePick = (file: File | undefined) => {
    if (!file) return;
    setStatusError(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setImageFile(file);
    setImageUrl(url);

    const img = new Image();
    img.onload = () => setImageEl(img);
    img.src = url;
  };

  const handleAudioPick = (file: File | undefined) => {
    if (!file) return;
    setStatusError(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(file);
    setAudioFile(file);
    setAudioUrl(url);

    const probe = new Audio(url);
    probe.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(probe.duration)) {
        setAudioDuration(probe.duration);
      }
    });
  };

  // Draw one frame (image cover-fit + optional vignette + live/idle audio waveform)
  const drawFrame = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      freqData: Uint8Array | null,
      timeData: Uint8Array | null,
      idlePhase: number
    ) => {
      // Background
      ctx.fillStyle = '#0e0d0c';
      ctx.fillRect(0, 0, w, h);

      // Image (object-cover centered)
      if (imageEl) {
        const imgRatio = imageEl.naturalWidth / Math.max(1, imageEl.naturalHeight);
        const canvasRatio = w / h;
        let drawW = w;
        let drawH = h;
        let dx = 0;
        let dy = 0;
        if (imgRatio > canvasRatio) {
          drawH = h;
          drawW = h * imgRatio;
          dx = (w - drawW) / 2;
        } else {
          drawW = w;
          drawH = w / imgRatio;
          dy = (h - drawH) / 2;
        }
        ctx.drawImage(imageEl, dx, dy, drawW, drawH);
      } else {
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(224, 189, 130, 0.35)';
        ctx.font = `600 ${Math.round(w * 0.035)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Kies een afbeelding en audio-bestand', w / 2, h / 2);
      }

      // Subtle bottom dark gradient so the soundwave is always crisp & readable
      if (showBottomFade) {
        const grad = ctx.createLinearGradient(0, h * 0.62, 0, h);
        grad.addColorStop(0, 'rgba(10, 9, 8, 0)');
        grad.addColorStop(0.55, 'rgba(10, 9, 8, 0.55)');
        grad.addColorStop(1, 'rgba(10, 9, 8, 0.88)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, h * 0.62, w, h * 0.38);
      }

      // Optional caption above wave
      const waveAreaH = Math.round((h * waveHeightPct) / 100);
      const bottomMargin = Math.round(h * 0.055);
      const waveCenterY = h - bottomMargin - waveAreaH / 2;

      if (captionText.trim()) {
        ctx.save();
        ctx.font = `italic 600 ${Math.round(w * 0.034)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 250, 240, 0.92)';
        ctx.shadowColor = 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = 12;
        ctx.fillText(captionText.trim(), w / 2, waveCenterY - waveAreaH / 2 - Math.round(h * 0.024));
        ctx.restore();
      }

      // Draw waveform / equalizer
      const sidePad = Math.round(w * 0.08);
      const waveW = w - sidePad * 2;
      const barCount = 56;
      const smoothed = smoothedBarsRef.current;

      ctx.save();
      ctx.shadowColor = waveColor;
      ctx.shadowBlur = Math.round(w * 0.012);

      if (waveStyle === 'wave') {
        ctx.beginPath();
        ctx.strokeStyle = waveColor;
        ctx.lineWidth = Math.max(3, Math.round(w * 0.0055));
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const points = 120;
        for (let i = 0; i <= points; i++) {
          const t = i / points;
          const x = sidePad + t * waveW;
          // Smooth envelope so edges taper gracefully to zero
          const env = Math.sin(t * Math.PI);
          let sample = 0;
          if (timeData && timeData.length > 0) {
            const idx = Math.floor(t * (timeData.length - 1));
            sample = ((timeData[idx] - 128) / 128) * 1.45;
          } else {
            sample =
              Math.sin(t * 14 + idlePhase) * 0.25 +
              Math.sin(t * 27 - idlePhase * 1.3) * 0.12;
          }
          const y = waveCenterY + sample * (waveAreaH * 0.55) * env;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        const gap = Math.max(3, Math.round(waveW / (barCount * 3.1)));
        const barW = Math.max(3, (waveW - gap * (barCount - 1)) / barCount);

        for (let i = 0; i < barCount; i++) {
          const t = i / (barCount - 1);
          const env = 0.28 + 0.72 * Math.sin(t * Math.PI);
          let targetVal = 0.08;

          if (freqData && freqData.length > 0) {
            // Focus on voice/music frequencies (lower 65% of FFT spectrum)
            const bin = Math.floor(Math.pow(t, 1.15) * (freqData.length * 0.58));
            const raw = freqData[Math.min(freqData.length - 1, bin)] / 255;
            targetVal = Math.max(0.06, Math.min(1, raw * 1.18 * env));
          } else {
            targetVal =
              (0.14 +
                0.18 * Math.abs(Math.sin(i * 0.35 + idlePhase)) +
                0.1 * Math.abs(Math.cos(i * 0.6 - idlePhase * 0.7))) *
              env;
          }

          smoothed[i] = smoothed[i] * 0.62 + targetVal * 0.38;
          const barH = Math.max(barW, smoothed[i] * waveAreaH);
          const x = sidePad + i * (barW + gap);
          const radius = barW / 2;

          ctx.fillStyle = waveColor;
          if (waveStyle === 'mirror') {
            const y = waveCenterY - barH / 2;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, radius);
            ctx.fill();
          } else {
            const y = waveCenterY + waveAreaH / 2 - barH;
            ctx.beginPath();
            ctx.roundRect(x, y, barW, barH, radius);
            ctx.fill();
          }
        }
      }

      ctx.restore();
    },
    [imageEl, showBottomFade, waveHeightPct, captionText, waveColor, waveStyle]
  );

  // Redraw static/idle preview whenever settings or image change while not playing/rendering
  useEffect(() => {
    if (isPreviewing || isRendering) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cfg = FORMATS[aspect];
    canvas.width = cfg.width;
    canvas.height = cfg.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawFrame(ctx, cfg.width, cfg.height, null, null, 0.8);
  }, [aspect, drawFrame, isPreviewing, isRendering]);

  const stopAll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
      audioElRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsPreviewing(false);
    setIsRendering(false);
  }, []);

  const startSession = async (record: boolean) => {
    if (!imageEl || !audioUrl) {
      setStatusError('Kies eerst zowel een afbeelding als een audiobestand (.wav of .mp3).');
      return;
    }

    stopAll();
    setStatusError(null);
    if (record) {
      if (renderedVideoUrl) {
        URL.revokeObjectURL(renderedVideoUrl);
        setRenderedVideoUrl(null);
      }
      setRenderProgress(0);
      setIsRendering(true);
    } else {
      setIsPreviewing(true);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const cfg = FORMATS[aspect];
    canvas.width = cfg.width;
    canvas.height = cfg.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const audio = new Audio(audioUrl);
      audio.crossOrigin = 'anonymous';
      audioElRef.current = audio;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaElementSource(audio);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      source.connect(analyser);

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const timeData = new Uint8Array(analyser.fftSize);

      if (record) {
        const dest = audioCtx.createMediaStreamDestination();
        analyser.connect(dest);
        // Also monitor softly or mute? Keep audible so user can hear sync while rendering
        analyser.connect(audioCtx.destination);

        const canvasStream = canvas.captureStream(30);
        const combinedStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);

        const { mimeType, ext } = pickSupportedRecorderMime();
        setRenderedExt(ext);
        const chunks: BlobPart[] = [];
        const recorder = new MediaRecorder(
          combinedStream,
          mimeType
            ? { mimeType, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 192_000 }
            : { videoBitsPerSecond: 6_000_000 }
        );
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) chunks.push(ev.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType || `video/${ext}` });
          const url = URL.createObjectURL(blob);
          setRenderedVideoUrl(url);
          setRenderProgress(100);
          setIsRendering(false);
        };

        recorder.start(250);
      } else {
        analyser.connect(audioCtx.destination);
      }

      const loop = () => {
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);
        drawFrame(ctx, cfg.width, cfg.height, freqData, timeData, performance.now() / 600);

        if (record && audio.duration > 0) {
          setRenderProgress(Math.min(99, Math.round((audio.currentTime / audio.duration) * 100)));
        }

        if (!audio.paused && !audio.ended) {
          rafRef.current = requestAnimationFrame(loop);
        }
      };

      audio.onended = () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (record && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {});
          audioCtxRef.current = null;
        }
        setIsPreviewing(false);
      };

      await audio.play();
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      console.error('[AudioVideoStudio] error:', err);
      setStatusError('Kon de audio/video-render niet starten. Controleer of je browser geluid mag afspelen.');
      stopAll();
    }
  };

  const downloadFilename = (() => {
    const base = (audioFile?.name || imageFile?.name || 'lion-books-video')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_');
    return `${base}_${aspect.replace(':', 'x')}.${renderedExt}`;
  })();

  const supportedInfo = pickSupportedRecorderMime();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Film className="w-5 h-5 text-earth-gold" />
            <h2 className="text-2xl font-serif font-bold text-white">Audio → Video Studio</h2>
          </div>
          <p className="text-sm text-earth-light/60 mt-1">
            Combineer een afbeelding met een <code>.wav</code> of <code>.mp3</code> bestand tot een video met bewegende geluidsgolf onderaan.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-earth-gold/10 border border-earth-gold/25 text-xs text-earth-gold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Exportformaat in deze browser: <strong>.{supportedInfo.ext.toUpperCase()}</strong></span>
        </div>
      </div>

      {statusError && (
        <div className="bg-red-500/10 border border-red-500/25 text-red-300 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{statusError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Controls */}
        <div className="lg:col-span-5 space-y-5">
          {/* 1. Image & Audio Upload */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-earth-gold font-mono">
              1. Bestanden kiezen
            </h3>

            {/* Image picker */}
            <label className="block cursor-pointer group">
              <span className="block text-xs text-earth-light/60 mb-1.5">Afbeelding (JPG / PNG / WebP)</span>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/30 border border-white/10 group-hover:border-earth-gold/60 transition-colors">
                <ImageIcon className="w-5 h-5 text-earth-gold shrink-0" />
                <span className="text-sm text-white truncate flex-1">
                  {imageFile ? imageFile.name : 'Klik om een afbeelding te kiezen...'}
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleImagePick(e.target.files?.[0])}
              />
            </label>

            {/* Audio picker */}
            <label className="block cursor-pointer group">
              <span className="block text-xs text-earth-light/60 mb-1.5">Audiobestand (.wav / .mp3 / .m4a)</span>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/30 border border-white/10 group-hover:border-earth-gold/60 transition-colors">
                <Music className="w-5 h-5 text-earth-gold shrink-0" />
                <span className="text-sm text-white truncate flex-1">
                  {audioFile
                    ? `${audioFile.name} (${formatSec(audioDuration)})`
                    : 'Klik om een WAV of MP3 te kiezen...'}
                </span>
              </div>
              <input
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.ogg"
                className="hidden"
                onChange={(e) => handleAudioPick(e.target.files?.[0])}
              />
            </label>
          </div>

          {/* 2. Video Format & Waveform Style */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-earth-gold font-mono flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5" />
              2. Videoformaat &amp; Geluidsgolf
            </h3>

            {/* Aspect ratio */}
            <div>
              <span className="block text-xs text-earth-light/60 mb-2">Formaat</span>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(FORMATS) as AspectPreset[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={isRendering}
                    onClick={() => setAspect(key)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                      aspect === key
                        ? 'bg-earth-gold/15 border-earth-gold text-white'
                        : 'bg-black/25 border-white/10 text-earth-light/70 hover:border-white/25'
                    }`}
                  >
                    <span className="text-sm font-medium">{FORMATS[key].label}</span>
                    <span className="text-xs font-mono opacity-70">{FORMATS[key].subtitle}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Waveform style */}
            <div>
              <span className="block text-xs text-earth-light/60 mb-2">Stijl van de geluidsgolf</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'mirror' as WaveStyle, label: 'Gespiegeld' },
                  { id: 'bars' as WaveStyle, label: 'Equalizer' },
                  { id: 'wave' as WaveStyle, label: 'Lijngolf' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    disabled={isRendering}
                    onClick={() => setWaveStyle(st.id)}
                    className={`py-2 px-2 rounded-xl border text-xs font-medium transition-all ${
                      waveStyle === st.id
                        ? 'bg-earth-gold/20 border-earth-gold text-earth-gold'
                        : 'bg-black/25 border-white/10 text-earth-light/70 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Color & Height */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs text-earth-light/60 mb-2">Kleur golf</span>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      disabled={isRendering}
                      onClick={() => setWaveColor(c.hex)}
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        waveColor.toLowerCase() === c.hex.toLowerCase()
                          ? 'border-white scale-110'
                          : 'border-black/40 opacity-80 hover:opacity-100'
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={waveColor}
                    disabled={isRendering}
                    onChange={(e) => setWaveColor(e.target.value)}
                    className="w-7 h-7 rounded-full bg-transparent border-0 cursor-pointer"
                    title="Eigen kleur kiezen"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs text-earth-light/60 mb-2">
                  Hoogte golf ({waveHeightPct}%)
                </span>
                <input
                  type="range"
                  min={8}
                  max={28}
                  value={waveHeightPct}
                  disabled={isRendering}
                  onChange={(e) => setWaveHeightPct(Number(e.target.value))}
                  className="w-full accent-[#e0bd82]"
                />
              </div>
            </div>

            {/* Optional subtitle / caption & fade toggle */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs text-earth-light/60 mb-1.5">
                  Optionele tekst boven de golf (bijv. &ldquo;Ginger spreekt...&rdquo;)
                </label>
                <input
                  type="text"
                  value={captionText}
                  disabled={isRendering}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Laat leeg voor alleen afbeelding + geluidsgolf"
                  className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-earth-light/30 focus:outline-none focus:border-earth-gold"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-earth-light/75 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showBottomFade}
                  disabled={isRendering}
                  onChange={(e) => setShowBottomFade(e.target.checked)}
                  className="accent-[#e0bd82] rounded"
                />
                <span>Subtiele donkere schaduw onderaan (zodat de golf beter zichtbaar is)</span>
              </label>
            </div>
          </div>

          {/* 3. Actions */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="flex gap-3">
              {isPreviewing || isRendering ? (
                <button
                  type="button"
                  onClick={stopAll}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stoppen</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startSession(false)}
                    disabled={!imageEl || !audioUrl}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-35"
                  >
                    <Play className="w-4 h-4" />
                    <span>Voorbeeld</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => startSession(true)}
                    disabled={!imageEl || !audioUrl}
                    className="flex-[1.3] py-3 px-4 rounded-xl bg-earth-gold hover:bg-earth-gold/90 text-black font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-35"
                  >
                    <Film className="w-4 h-4" />
                    <span>Maak video (.{supportedInfo.ext})</span>
                  </button>
                </>
              )}
            </div>

            {isRendering && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs text-earth-gold">
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Video wordt opgenomen op echte snelheid...
                  </span>
                  <span className="font-mono font-bold">{renderProgress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-black/40 overflow-hidden">
                  <div
                    className="h-full bg-earth-gold transition-all duration-200"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
              </div>
            )}

            {renderedVideoUrl && !isRendering && (
              <div className="pt-2 space-y-2.5 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Je video is klaar!</span>
                </div>
                <a
                  href={renderedVideoUrl}
                  download={downloadFilename}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download {downloadFilename}</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Live Canvas Preview */}
        <div className="lg:col-span-7 bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[460px]">
          <div className="flex items-center justify-between w-full mb-4 text-xs text-earth-light/50">
            <span className="font-mono uppercase tracking-widest">Live Voorbeeld</span>
            <span className="inline-flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-earth-gold" />
              {FORMATS[aspect].subtitle} • 30 fps
            </span>
          </div>

          <div className="relative flex items-center justify-center w-full">
            <canvas
              ref={canvasRef}
              className="rounded-xl shadow-2xl border border-white/10 bg-black max-w-full"
              style={{
                maxHeight: '62vh',
                width: 'auto',
                height: 'auto',
                aspectRatio: `${FORMATS[aspect].width} / ${FORMATS[aspect].height}`,
              }}
            />
          </div>

          {renderedVideoUrl && !isRendering && (
            <div className="w-full mt-6 pt-5 border-t border-white/10">
              <span className="block text-xs font-mono uppercase tracking-widest text-emerald-300 mb-3">
                Gegenereerde video afspelen:
              </span>
              <video
                src={renderedVideoUrl}
                controls
                playsInline
                className="w-full max-h-[420px] rounded-xl border border-white/10 bg-black"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
