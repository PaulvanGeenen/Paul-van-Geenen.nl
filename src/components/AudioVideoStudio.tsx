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
  Subtitles,
  Wand2,
} from 'lucide-react';

type AspectPreset = '9:16' | '1:1' | '16:9';
type WaveStyle = 'bars' | 'mirror' | 'wave';
type SubtitleSizePreset = 'sm' | 'md' | 'lg';

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function parseSrtTime(ts: string): number {
  const m = ts.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return 0;
  return (
    parseInt(m[1], 10) * 3600 +
    parseInt(m[2], 10) * 60 +
    parseInt(m[3], 10) +
    parseInt(m[4].padEnd(3, '0').slice(0, 3), 10) / 1000
  );
}

function formatSrtTime(sec: number): string {
  const s = Math.max(0, sec);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(Math.min(999, ms)).padStart(3, '0')}`;
}

function parseSrtContent(raw: string): SubtitleCue[] {
  const cleaned = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!cleaned) return [];

  const blocks = cleaned.split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const timeLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeLineIdx === -1) continue;
    const [startStr, endStr] = lines[timeLineIdx].split('-->');
    const text = lines
      .slice(timeLineIdx + 1)
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (text) {
      cues.push({
        start: parseSrtTime(startStr),
        end: parseSrtTime(endStr),
        text,
      });
    }
  }
  return cues.sort((a, b) => a.start - b.start);
}

function buildAutoCuesFromPlainText(raw: string, durationSec: number): SubtitleCue[] {
  const cleaned = raw.trim();
  if (!cleaned) return [];
  const duration = durationSec > 2 ? durationSec : 60;
  const chunks = cleaned
    .replace(/\r\n/g, '\n')
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (chunks.length === 0) return [];

  const totalWeight = chunks.reduce((acc, c) => acc + Math.max(8, c.length), 0);
  let cursor = 0.3;
  const usableDuration = Math.max(2, duration - 0.6);

  return chunks.map((chunk) => {
    const share = (Math.max(8, chunk.length) / totalWeight) * usableDuration;
    const start = cursor;
    const end = Math.min(duration, start + Math.max(1.2, share - 0.08));
    cursor = start + share;
    return { start, end, text: chunk };
  });
}

function resolveSubtitleCues(raw: string, durationSec: number): SubtitleCue[] {
  if (!raw.trim()) return [];
  if (raw.includes('-->')) {
    return parseSrtContent(raw);
  }
  return buildAutoCuesFromPlainText(raw, durationSec);
}

function wrapCanvasLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

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
  const [subtitleText, setSubtitleText] = useState<string>('');
  const [subtitleSize, setSubtitleSize] = useState<SubtitleSizePreset>('md');
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);

  // Automatically recompute timed cues whenever text OR audioDuration changes (works for both SRT and plain pasted text!)
  useEffect(() => {
    setSubtitleCues(resolveSubtitleCues(subtitleText, audioDuration));
  }, [subtitleText, audioDuration]);

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

  const handleSrtPick = async (file: File | undefined) => {
    if (!file) return;
    try {
      const content = await file.text();
      setSubtitleText(content);
    } catch {
      setStatusError('Kon het ondertitelbestand (.srt) niet lezen.');
    }
  };

  const handleSubtitleTextChange = (value: string) => {
    setSubtitleText(value);
  };

  // Convert plain text into explicit editable SRT timestamps in the textarea
  const handleAutoTimePlainText = () => {
    const raw = subtitleText.trim();
    if (!raw || raw.includes('-->')) return;
    const cues = buildAutoCuesFromPlainText(raw, audioDuration);
    if (cues.length === 0) return;
    const generated = cues
      .map((c, i) => `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${c.text}`)
      .join('\n\n');
    setSubtitleText(generated);
  };

  // Draw one frame (image cover-fit + optional vignette + live/idle symmetrical audio waveform + synchronized subtitles)
  const drawFrame = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      w: number,
      h: number,
      freqData: Uint8Array | null,
      timeData: Uint8Array | null,
      idlePhase: number,
      currentTimeSec: number
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

      // Subtle bottom dark gradient so the soundwave & spoken text are always crisp & readable
      if (showBottomFade) {
        const fadeStart = subtitleCues.length > 0 ? h * 0.52 : h * 0.62;
        const grad = ctx.createLinearGradient(0, fadeStart, 0, h);
        grad.addColorStop(0, 'rgba(10, 9, 8, 0)');
        grad.addColorStop(0.5, 'rgba(10, 9, 8, 0.58)');
        grad.addColorStop(1, 'rgba(10, 9, 8, 0.9)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, fadeStart, w, h - fadeStart);
      }

      // Wave geometry
      const waveAreaH = Math.round((h * waveHeightPct) / 100);
      const bottomMargin = Math.round(h * 0.05);
      const waveCenterY = h - bottomMargin - waveAreaH / 2;
      const waveTopY = waveCenterY - waveAreaH / 2;

      // Active spoken subtitle (from SRT cues) OR preview of first cue when idle
      let activeSubtitle = '';
      if (subtitleCues.length > 0) {
        if (freqData) {
          const match = subtitleCues.find(
            (c) => currentTimeSec >= c.start && currentTimeSec <= c.end
          );
          if (match) activeSubtitle = match.text;
        } else {
          activeSubtitle = subtitleCues[0].text;
        }
      }

      if (activeSubtitle) {
        const sizeScale = subtitleSize === 'sm' ? 0.031 : subtitleSize === 'lg' ? 0.045 : 0.038;
        const fontPx = Math.max(22, Math.round(Math.min(w, h) * sizeScale));
        const lineH = Math.round(fontPx * 1.35);
        const maxTextW = Math.round(w * 0.84);

        ctx.save();
        ctx.font = `600 ${fontPx}px Georgia, 'Palatino Linotype', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lines = wrapCanvasLines(ctx, activeSubtitle, maxTextW);
        const boxPadX = Math.round(fontPx * 0.7);
        const boxPadY = Math.round(fontPx * 0.45);
        const blockH = lines.length * lineH;
        const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width), 0);
        const boxW = Math.min(w * 0.9, maxLineW + boxPadX * 2);
        const boxH = blockH + boxPadY * 2;
        const boxBottomY = waveTopY - Math.round(h * 0.025);
        const boxTopY = boxBottomY - boxH;

        // Soft glass pill behind spoken text for crisp readability
        ctx.fillStyle = 'rgba(12, 10, 9, 0.58)';
        ctx.beginPath();
        ctx.roundRect((w - boxW) / 2, boxTopY, boxW, boxH, Math.round(fontPx * 0.45));
        ctx.fill();

        ctx.fillStyle = '#fffaf0';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.shadowBlur = 10;
        lines.forEach((line, idx) => {
          const y = boxTopY + boxPadY + lineH * (idx + 0.5);
          ctx.fillText(line, w / 2, y);
        });
        ctx.restore();
      } else if (captionText.trim()) {
        ctx.save();
        ctx.font = `italic 600 ${Math.round(w * 0.034)}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 250, 240, 0.92)';
        ctx.shadowColor = 'rgba(0,0,0,0.75)';
        ctx.shadowBlur = 12;
        ctx.fillText(captionText.trim(), w / 2, waveTopY - Math.round(h * 0.024));
        ctx.restore();
      }

      // Draw waveform / equalizer (symmetrical across full width, tuned for human speech & music)
      const sidePad = Math.round(w * 0.075);
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
        const centerIdx = (barCount - 1) / 2;

        for (let i = 0; i < barCount; i++) {
          const t = i / (barCount - 1);
          const distFromCenter = Math.abs(i - centerIdx) / centerIdx; // 0 at center, 1 at edges
          const env = 0.34 + 0.66 * Math.cos((distFromCenter * Math.PI) / 2);
          let targetVal = 0.08;

          if (freqData && freqData.length > 0) {
            // Map active speech/music range (bins 1..38) symmetrically from center outward so BOTH left & right dance evenly!
            const maxSpeechBin = Math.min(freqData.length - 1, 38);
            const bin = 1 + Math.floor(Math.pow(distFromCenter, 0.92) * (maxSpeechBin - 1));
            const raw = freqData[bin] / 255;
            // Subtle organic shimmer between left & right mirror bars so it feels alive, not robotic
            const shimmer = 0.92 + 0.16 * Math.sin(i * 1.7 + idlePhase * 2.2);
            targetVal = Math.max(0.06, Math.min(1, raw * 1.25 * env * shimmer));
          } else {
            targetVal =
              (0.14 +
                0.2 * Math.abs(Math.sin(distFromCenter * 5.5 + idlePhase)) +
                0.1 * Math.abs(Math.cos(i * 0.55 - idlePhase * 0.7))) *
              env;
          }

          smoothed[i] = smoothed[i] * 0.6 + targetVal * 0.4;
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
    [imageEl, showBottomFade, waveHeightPct, captionText, waveColor, waveStyle, subtitleCues, subtitleSize]
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
    drawFrame(ctx, cfg.width, cfg.height, null, null, 0.8, 0);
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
        drawFrame(
          ctx,
          cfg.width,
          cfg.height,
          freqData,
          timeData,
          performance.now() / 600,
          audio.currentTime
        );

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

          {/* 3. Gesproken tekst / Ondertiteling (.srt of plakken) */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-earth-gold font-mono flex items-center gap-2">
                <Subtitles className="w-3.5 h-3.5" />
                3. Gesproken tekst (Ondertiteling)
              </h3>
              {subtitleCues.length > 0 && (
                <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  {subtitleCues.length} regels actief
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/30 border border-white/10 hover:border-earth-gold/60 text-xs text-white transition-colors">
                <Subtitles className="w-3.5 h-3.5 text-earth-gold" />
                <span>Laad .srt bestand</span>
                <input
                  type="file"
                  accept=".srt,.txt"
                  className="hidden"
                  onChange={(e) => handleSrtPick(e.target.files?.[0])}
                />
              </label>

              <button
                type="button"
                disabled={isRendering || !subtitleText.trim() || subtitleText.includes('-->')}
                onClick={handleAutoTimePlainText}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-earth-gold/15 hover:bg-earth-gold/25 border border-earth-gold/30 text-xs text-earth-gold font-medium transition-colors disabled:opacity-35"
                title="Zet losse zinnen automatisch om in getimede SRT-regels over de duur van de audio"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Verdeel tekst over audio</span>
              </button>

              <div className="ml-auto flex items-center gap-1 bg-black/30 border border-white/10 rounded-lg p-0.5">
                {(
                  [
                    { id: 'sm', label: 'S' },
                    { id: 'md', label: 'M' },
                    { id: 'lg', label: 'L' },
                  ] as const
                ).map((sz) => (
                  <button
                    key={sz.id}
                    type="button"
                    disabled={isRendering}
                    onClick={() => setSubtitleSize(sz.id)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                      subtitleSize === sz.id
                        ? 'bg-earth-gold text-black'
                        : 'text-earth-light/60 hover:text-white'
                    }`}
                  >
                    {sz.label}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              rows={4}
              value={subtitleText}
              disabled={isRendering}
              onChange={(e) => handleSubtitleTextChange(e.target.value)}
              placeholder="Plak hier een .srt-bestand OF typ/plak gewoon de gesproken tekst (elke zin op een nieuwe regel) en klik op 'Verdeel tekst over audio'..."
              className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder:text-earth-light/30 focus:outline-none focus:border-earth-gold resize-y"
            />
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
