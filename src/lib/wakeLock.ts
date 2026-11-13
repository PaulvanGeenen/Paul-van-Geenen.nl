/**
 * Screen Wake Lock utility to keep mobile and desktop screens awake during playback.
 * Prevents screens from sleeping/dimming (e.g. Android work phone 5-minute security timeout).
 * Fully transparent to the user: no prompts, no popups, automatically granted upon user gesture.
 * Fails completely silently if not supported by the browser or environment.
 */

let activeSentinel: any = null;
let isRequested = false;

export async function requestScreenWakeLock(): Promise<boolean> {
  isRequested = true;
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return false;
  }

  // If already active and not released, reuse
  if (activeSentinel && !activeSentinel.released) {
    return true;
  }

  try {
    const sentinel = await (navigator as any).wakeLock.request('screen');
    activeSentinel = sentinel;
    sentinel.addEventListener('release', () => {
      if (activeSentinel === sentinel) {
        activeSentinel = null;
      }
    });
    return true;
  } catch (err) {
    // E.g. low battery mode, screen already off, or document hidden
    return false;
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  isRequested = false;
  if (activeSentinel) {
    try {
      await activeSentinel.release();
    } catch (err) {
      // Ignore
    }
    activeSentinel = null;
  }
}

// Automatically re-acquire when user switches back to the tab if lock was active
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isRequested) {
      requestScreenWakeLock();
    }
  });
}
