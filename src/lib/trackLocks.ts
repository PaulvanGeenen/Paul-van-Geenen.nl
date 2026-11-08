// Track Lock & Vault System for Book Readers
// First 2 tracks of every album are unlocked by default.
// Remaining tracks are locked until unlocked via QR code scan (stored in localStorage, no cookies).

const UNLOCKED_TRACKS_STORAGE_KEY = 'pvg_unlocked_tracks_v1';
const LOCK_SYSTEM_ENABLED_KEY = 'pvg_lock_system_enabled_v1';

export interface LockableTrack {
  id: string;
  title: string;
  folderName?: string;
  album?: string;
  order?: string;
  albumOrder?: number | string;
}

export interface AlbumLockConfig {
  id?: string | number;
  title?: string;
  locksEnabled?: boolean;
  locks_enabled?: number | boolean;
  freeTrack1?: string | null;
  free_track_1?: string | null;
  freeTrack2?: string | null;
  free_track_2?: string | null;
}

/**
 * Helper to check if a track matches a configured free_track_1 or free_track_2 value from the SQL albums table.
 * Supports matching by foldername (e.g. '001 Leeuw'), title (e.g. 'Leeuw'), track id (e.g. '12'), or track_order (e.g. '1' or '001').
 */
export function doesTrackMatchAlbumFreeSlot(track: LockableTrack | undefined | null, slotVal?: string | number | null): boolean {
  if (!track || slotVal === undefined || slotVal === null) return false;
  const raw = String(slotVal).trim();
  if (!raw) return false;

  const rawLower = raw.toLowerCase();

  // 1. Exact match on track id, folderName, or title
  if (track.id && String(track.id).toLowerCase() === rawLower) return true;
  if (track.folderName && track.folderName.toLowerCase() === rawLower) return true;
  if (track.title && track.title.toLowerCase() === rawLower) return true;

  // 2. Normalized key match on id, folderName, or title
  const normSlot = normalizeTrackKey(raw);
  if (normSlot) {
    if (track.id && normalizeTrackKey(String(track.id)) === normSlot) return true;
    if (track.folderName && normalizeTrackKey(track.folderName) === normSlot) return true;
    if (track.title && normalizeTrackKey(track.title) === normSlot) return true;
    const strippedTitle = (track.title || '').replace(/^\d{1,3}[\s.-]+/, '').trim();
    const strippedSlot = raw.replace(/^\d{1,3}[\s.-]+/, '').trim();
    if (strippedTitle && strippedSlot && normalizeTrackKey(strippedTitle) === normalizeTrackKey(strippedSlot)) {
      return true;
    }
  }

  // 3. Match on 3-digit prefix (e.g. '001 Leeuw' vs '001')
  const slotPrefix = extractTrackNumberPrefix(raw);
  if (slotPrefix) {
    if (track.folderName && extractTrackNumberPrefix(track.folderName) === slotPrefix) return true;
    if (track.id && extractTrackNumberPrefix(String(track.id)) === slotPrefix) return true;
  }

  return false;
}

/**
 * Check if locks are enabled for a specific album according to its SQL database row.
 */
export function isAlbumLocksEnabled(albumConfig?: AlbumLockConfig | null): boolean {
  if (!albumConfig) return true;
  if (albumConfig.locksEnabled !== undefined) {
    return Boolean(albumConfig.locksEnabled);
  }
  if (albumConfig.locks_enabled !== undefined && albumConfig.locks_enabled !== null) {
    if (typeof albumConfig.locks_enabled === 'boolean') return albumConfig.locks_enabled;
    return Number(albumConfig.locks_enabled) !== 0;
  }
  return true;
}

/**
 * Normalize any string identifier (track id, folder name, song title) for resilient matching
 */
export function normalizeTrackKey(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/^\/?@?music\//i, '')
    .replace(/\.(mp3|wav|m4a|mov|mp4)$/i, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract pure numeric prefix if present (e.g. "005 de Echo" -> "005")
 */
export function extractTrackNumberPrefix(str?: string | null): string | null {
  if (!str) return null;
  const match = str.trim().match(/^(\d{3})\b/);
  return match ? match[1] : null;
}

/**
 * Check whether the lock system is currently active.
 * Defaults to TRUE for all visitors. Can be toggled off by Admin for testing.
 */
export function isLockSystemEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const val = localStorage.getItem(LOCK_SYSTEM_ENABLED_KEY);
    if (val === 'false') return false;
    return true;
  } catch {
    return true;
  }
}

/**
 * Toggle the lock system on or off (for Admin testing)
 */
export function setLockSystemEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCK_SYSTEM_ENABLED_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('pvg-locks-changed'));
  } catch (e) {
    console.warn('Could not save lock system setting:', e);
  }
}

/**
 * Retrieve all unlocked track keys from localStorage
 */
export function getUnlockedTrackKeys(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(UNLOCKED_TRACKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Check if a specific track is unlocked.
 * @param track The track object
 * @param indexInAlbum The 0-based index of the track within its album (fallback if no free_track_1/2 configured)
 * @param forceLockSystem Optional override for global lock system state
 * @param albumConfig Optional per-album SQL configuration (locks_enabled, free_track_1, free_track_2)
 */
export function isTrackUnlocked(
  track: LockableTrack | undefined | null,
  indexInAlbum: number,
  forceLockSystem?: boolean,
  albumConfig?: AlbumLockConfig | null
): boolean {
  if (!track) return false;

  const systemActive = forceLockSystem !== undefined ? forceLockSystem : isLockSystemEnabled();
  if (!systemActive) return true;

  // Rule 1: If locks are disabled for this specific album in SQL (locks_enabled = 0), all tracks in this album are open
  if (albumConfig && !isAlbumLocksEnabled(albumConfig)) {
    return true;
  }

  // Rule 2: Check which 2 tracks are configured as freely visible for this album in SQL (free_track_1 & free_track_2)
  const free1 = (albumConfig?.freeTrack1 ?? albumConfig?.free_track_1 ?? '').toString().trim();
  const free2 = (albumConfig?.freeTrack2 ?? albumConfig?.free_track_2 ?? '').toString().trim();

  if (free1 || free2) {
    if (doesTrackMatchAlbumFreeSlot(track, free1) || doesTrackMatchAlbumFreeSlot(track, free2)) {
      return true;
    }
  } else {
    // Fallback if neither free_track_1 nor free_track_2 is specified in SQL: first 2 tracks (index 0 and 1) are open
    if (indexInAlbum === 0 || indexInAlbum === 1) {
      return true;
    }
  }

  const unlockedKeys = getUnlockedTrackKeys();
  if (unlockedKeys.length === 0) return false;

  const candidateKeys = new Set<string>();
  if (track.id) {
    candidateKeys.add(normalizeTrackKey(track.id));
    const num = extractTrackNumberPrefix(track.id);
    if (num) candidateKeys.add(`num:${num}`);
  }
  if (track.folderName) {
    candidateKeys.add(normalizeTrackKey(track.folderName));
    const num = extractTrackNumberPrefix(track.folderName);
    if (num) candidateKeys.add(`num:${num}`);
  }
  if (track.title) {
    candidateKeys.add(normalizeTrackKey(track.title));
    // Also strip leading track numbers from title if present
    const strippedTitle = track.title.replace(/^\d{1,3}[\s.-]+/, '').trim();
    if (strippedTitle) candidateKeys.add(normalizeTrackKey(strippedTitle));
  }

  for (const key of candidateKeys) {
    if (key && unlockedKeys.includes(key)) {
      return true;
    }
  }

  return false;
}

/**
 * Unlock a track in localStorage so it remains permanently unlocked on this device
 */
export function unlockTrack(track: LockableTrack): boolean {
  if (typeof window === 'undefined' || !track) return false;
  try {
    const existing = new Set<string>(getUnlockedTrackKeys());
    const sizeBefore = existing.size;

    if (track.id) {
      existing.add(normalizeTrackKey(track.id));
      const num = extractTrackNumberPrefix(track.id);
      if (num) existing.add(`num:${num}`);
    }
    if (track.folderName) {
      existing.add(normalizeTrackKey(track.folderName));
      const num = extractTrackNumberPrefix(track.folderName);
      if (num) existing.add(`num:${num}`);
    }
    if (track.title) {
      existing.add(normalizeTrackKey(track.title));
      const strippedTitle = track.title.replace(/^\d{1,3}[\s.-]+/, '').trim();
      if (strippedTitle) existing.add(normalizeTrackKey(strippedTitle));
    }

    existing.delete('');
    const updated = Array.from(existing);
    localStorage.setItem(UNLOCKED_TRACKS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('pvg-locks-changed'));
    return updated.length > sizeBefore;
  } catch (e) {
    console.warn('Could not unlock track in localStorage:', e);
    return false;
  }
}

/**
 * Unlock a track by raw identifier string (e.g. from QRRedirect before full track list loads)
 */
export function unlockTrackByRawIdentifier(identifier?: string | null): void {
  if (typeof window === 'undefined' || !identifier) return;
  try {
    const existing = new Set<string>(getUnlockedTrackKeys());
    const norm = normalizeTrackKey(identifier);
    if (norm) existing.add(norm);
    const num = extractTrackNumberPrefix(identifier);
    if (num) existing.add(`num:${num}`);
    const stripped = identifier.replace(/^\d{1,3}[\s.-]+/, '').trim();
    if (stripped) existing.add(normalizeTrackKey(stripped));

    existing.delete('');
    localStorage.setItem(UNLOCKED_TRACKS_STORAGE_KEY, JSON.stringify(Array.from(existing)));
    window.dispatchEvent(new CustomEvent('pvg-locks-changed'));
  } catch (e) {
    console.warn('Could not unlock raw track identifier:', e);
  }
}

/**
 * Reset all unlocked tracks in localStorage (for Admin testing)
 */
export function resetUnlockedTracks(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(UNLOCKED_TRACKS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('pvg-locks-changed'));
  } catch (e) {
    console.warn('Could not reset unlocked tracks:', e);
  }
}

// Shared AudioContext singleton for crisp mechanical lock sound effects
let lockAudioCtx: AudioContext | null = null;

function getLockAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!lockAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        lockAudioCtx = new AudioCtx();
      }
    }
    if (lockAudioCtx && lockAudioCtx.state === 'suspended') {
      lockAudioCtx.resume().catch(() => {});
    }
    return lockAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Synthesize a realistic heavy metallic padlock rattle sound effect
 * when a reader taps a locked slotje.
 */
export function playLockRattleSound(): void {
  const ctx = getLockAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    // 4 quick metallic clanks simulating rattling a heavy brass/iron padlock
    const hitOffsets = [0, 0.085, 0.165, 0.26, 0.34];
    const baseFreqs = [520, 680, 460, 740, 590];

    hitOffsets.forEach((offset, idx) => {
      const startTime = now + offset;
      const duration = 0.065;

      // 1. Metallic impact transient (high-Q bandpass filtered noise burst)
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800 + (idx % 2) * 650, startTime);
      filter.Q.setValueAtTime(6.0, startTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.005, startTime + duration);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(startTime);
      noise.stop(startTime + duration);

      // 2. Metallic body clank (inharmonic dual-oscillator clang)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc2.type = 'square';

      const f = baseFreqs[idx];
      osc1.frequency.setValueAtTime(f, startTime);
      osc1.frequency.exponentialRampToValueAtTime(f * 0.72, startTime + duration);

      osc2.frequency.setValueAtTime(f * 2.41, startTime); // inharmonic metallic ratio
      osc2.frequency.exponentialRampToValueAtTime(f * 1.9, startTime + duration);

      const clankGain = ctx.createGain();
      clankGain.gain.setValueAtTime(0.22, startTime);
      clankGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc1.connect(clankGain);
      osc2.connect(clankGain);
      clankGain.connect(ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);
    });
  } catch (e) {
    // Ignore audio context restrictions if any
  }
}

/**
 * Synthesize the cinematic lock rattling + heavy unlatch click when a track is unlocked!
 */
export function playLockUnlockSound(): void {
  const ctx = getLockAudioContext();
  if (!ctx) return;

  try {
    // First rattle the lock
    playLockRattleSound();

    const now = ctx.currentTime;
    const unlatchTime = now + 0.52;

    // Heavy spring latch release ("CLUNK-CLICK")
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, unlatchTime);
    osc.frequency.exponentialRampToValueAtTime(980, unlatchTime + 0.045);
    osc.frequency.exponentialRampToValueAtTime(440, unlatchTime + 0.14);

    const latchGain = ctx.createGain();
    latchGain.gain.setValueAtTime(0.3, unlatchTime);
    latchGain.gain.exponentialRampToValueAtTime(0.005, unlatchTime + 0.16);

    osc.connect(latchGain);
    latchGain.connect(ctx.destination);
    osc.start(unlatchTime);
    osc.stop(unlatchTime + 0.16);

    // Subtle warm golden resonance chime at 0.68s
    const chimeTime = now + 0.68;
    const chimeFreqs = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    chimeFreqs.forEach((freq, i) => {
      const cOsc = ctx.createOscillator();
      cOsc.type = 'sine';
      cOsc.frequency.setValueAtTime(freq, chimeTime + i * 0.035);

      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.08, chimeTime + i * 0.035);
      cGain.gain.exponentialRampToValueAtTime(0.0008, chimeTime + i * 0.035 + 0.85);

      cOsc.connect(cGain);
      cGain.connect(ctx.destination);
      cOsc.start(chimeTime + i * 0.035);
      cOsc.stop(chimeTime + i * 0.035 + 0.9);
    });
  } catch (e) {
    // Ignore audio context restrictions
  }
}
