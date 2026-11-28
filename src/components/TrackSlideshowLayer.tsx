import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface SlideshowMediaItem {
  seconds: number;
  mmSs: string;
  url: string;
  type: 'image' | 'video';
  filename?: string;
}

interface TimedSlide extends SlideshowMediaItem {
  triggerAt: number;
}

interface VisualLayer {
  key: string;
  url: string;
  type: 'image' | 'video';
}

interface TrackSlideshowLayerProps {
  baseImageUrl: string;
  alt: string;
  fallbackImageUrl?: string;
  slides: SlideshowMediaItem[];
  currentTime: number;
  isPlaying: boolean;
  trackKey: string;
}

const CROSSFADE_MS = 1350;

/**
 * Generates subtle, organic human-feeling timing offsets per slide (-0.65s to +0.65s)
 * so transitions breathe naturally slightly before or after the subtitle tick
 * instead of feeling mechanically locked to the subtitle timestamp.
 */
function buildOrganicSchedule(slides: SlideshowMediaItem[]): TimedSlide[] {
  if (!slides || slides.length === 0) return [];
  const sorted = slides.slice().sort((a, b) => a.seconds - b.seconds);
  const result: TimedSlide[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const slide = sorted[i];
    // Pick a gentle offset between -0.65s and +0.65s, avoiding exact 0.0
    let jitter = (Math.random() * 1.3) - 0.65;
    if (Math.abs(jitter) < 0.15) {
      jitter = jitter < 0 ? -0.22 : 0.22;
    }
    let triggerAt = Math.max(0.8, slide.seconds + jitter);

    // Ensure strictly ascending spacing of at least 1.1s so slides never collide
    if (i > 0) {
      const prevTrigger = result[i - 1].triggerAt;
      if (triggerAt < prevTrigger + 1.1) {
        triggerAt = prevTrigger + 1.1;
      }
    }

    result.push({
      ...slide,
      triggerAt: Math.round(triggerAt * 100) / 100,
    });
  }

  return result;
}

function SlideSlotView({
  visual,
  isActive,
  alt,
  fallbackImageUrl,
  isPlaying,
}: {
  visual: VisualLayer | null;
  isActive: boolean;
  alt: string;
  fallbackImageUrl?: string;
  isPlaying: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!visual || visual.type !== 'video') return;
    const fg = videoRef.current;
    if (isActive && isPlaying) {
      if (fg) fg.play().catch(() => {});
    } else if (!isActive) {
      // Pause after fade-out completes so the outgoing video doesn't freeze mid-fade
      const timer = window.setTimeout(() => {
        if (fg) fg.pause();
      }, CROSSFADE_MS + 100);
      return () => window.clearTimeout(timer);
    } else if (!isPlaying) {
      if (fg) fg.pause();
    }
  }, [visual, isActive, isPlaying]);

  if (!visual) return null;

  return (
    <div
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
      style={{
        opacity: isActive ? 1 : 0,
        zIndex: isActive ? 12 : 11,
        transition: `opacity ${CROSSFADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        willChange: 'opacity',
      }}
    >
      {visual.type === 'video' ? (
        <video
          ref={videoRef}
          key={`fg-vid-${visual.key}`}
          src={visual.url}
          muted
          loop
          playsInline
          autoPlay={isActive && isPlaying}
          preload="auto"
          className="w-full h-full object-cover object-center select-none pointer-events-none"
        />
      ) : (
        <img
          key={`fg-img-${visual.key}`}
          src={visual.url}
          alt={alt}
          className="w-full h-full object-cover object-center select-none pointer-events-none"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.currentTarget;
            if (fallbackImageUrl && target.src !== fallbackImageUrl) {
              target.src = fallbackImageUrl;
            }
          }}
        />
      )}
    </div>
  );
}

export const TrackSlideshowLayer: React.FC<TrackSlideshowLayerProps> = ({
  baseImageUrl,
  alt,
  fallbackImageUrl,
  slides,
  currentTime,
  isPlaying,
  trackKey,
}) => {
  // Recompute subtle organic timing schedule once per track + slide-set
  const scheduleKey = useMemo(
    () => `${trackKey}::${slides.map((s) => `${s.mmSs}:${s.url}`).join('|')}`,
    [trackKey, slides]
  );

  const scheduledSlides = useMemo(() => buildOrganicSchedule(slides), [scheduleKey]);

  // Determine which visual should be shown at the current playback time
  const targetVisual: VisualLayer = useMemo(() => {
    if (scheduledSlides.length > 0) {
      let active: TimedSlide | null = null;
      for (let i = 0; i < scheduledSlides.length; i++) {
        if (currentTime >= scheduledSlides[i].triggerAt) {
          active = scheduledSlides[i];
        } else {
          break;
        }
      }
      if (active) {
        return {
          key: `slide:${active.url}`,
          url: active.url,
          type: active.type,
        };
      }
    }
    return {
      key: `base:${baseImageUrl}`,
      url: baseImageUrl,
      type: 'image',
    };
  }, [scheduledSlides, currentTime, baseImageUrl]);

  // Dual-layer crossfade decks
  const [slotA, setSlotA] = useState<VisualLayer | null>(targetVisual);
  const [slotB, setSlotB] = useState<VisualLayer | null>(null);
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');

  const activeSlotRef = useRef<'A' | 'B'>('A');
  const currentKeyRef = useRef<string>(targetVisual.key);
  const prevTrackKeyRef = useRef<string>(trackKey);
  const transitionTokenRef = useRef<number>(0);

  // Instant reset when switching tracks (so swipe/next track never crossfades from previous track)
  useEffect(() => {
    if (prevTrackKeyRef.current !== trackKey) {
      prevTrackKeyRef.current = trackKey;
      transitionTokenRef.current += 1;
      const initial: VisualLayer = {
        key: `base:${baseImageUrl}`,
        url: baseImageUrl,
        type: 'image',
      };
      currentKeyRef.current = initial.key;
      activeSlotRef.current = 'A';
      setSlotA(initial);
      setSlotB(null);
      setActiveSlot('A');
    }
  }, [trackKey, baseImageUrl]);

  // Preload upcoming 3 image slides for zero-flicker transitions
  useEffect(() => {
    if (scheduledSlides.length === 0) return;
    let nextIdx = scheduledSlides.findIndex((s) => s.triggerAt > currentTime);
    if (nextIdx === -1) nextIdx = 0;
    const toPreload = scheduledSlides.slice(nextIdx, nextIdx + 3);
    toPreload.forEach((s) => {
      if (s.type === 'image') {
        const img = new Image();
        img.src = s.url;
      }
    });
  }, [scheduledSlides, Math.floor(currentTime / 2)]);

  // Trigger simultaneous crossfade whenever targetVisual changes
  useEffect(() => {
    if (targetVisual.key === currentKeyRef.current) return;

    const token = ++transitionTokenRef.current;
    const nextSlot: 'A' | 'B' = activeSlotRef.current === 'A' ? 'B' : 'A';

    const commitCrossfade = () => {
      if (transitionTokenRef.current !== token) return;
      currentKeyRef.current = targetVisual.key;
      if (nextSlot === 'A') {
        setSlotA(targetVisual);
      } else {
        setSlotB(targetVisual);
      }
      // Double rAF guarantees the newly mounted layer paints at opacity 0 before fading to 1
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (transitionTokenRef.current !== token) return;
          activeSlotRef.current = nextSlot;
          setActiveSlot(nextSlot);
        });
      });
    };

    if (targetVisual.type === 'image') {
      const preloader = new Image();
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        commitCrossfade();
      };
      const safetyTimer = window.setTimeout(done, 750);
      preloader.onload = () => {
        window.clearTimeout(safetyTimer);
        done();
      };
      preloader.onerror = () => {
        window.clearTimeout(safetyTimer);
        done();
      };
      preloader.src = targetVisual.url;
      if (preloader.complete) {
        window.clearTimeout(safetyTimer);
        done();
      }
      return () => {
        window.clearTimeout(safetyTimer);
      };
    } else {
      commitCrossfade();
    }
  }, [targetVisual]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      <SlideSlotView
        visual={slotA}
        isActive={activeSlot === 'A'}
        alt={alt}
        fallbackImageUrl={fallbackImageUrl}
        isPlaying={isPlaying}
      />
      <SlideSlotView
        visual={slotB}
        isActive={activeSlot === 'B'}
        alt={alt}
        fallbackImageUrl={fallbackImageUrl}
        isPlaying={isPlaying}
      />
    </div>
  );
};
