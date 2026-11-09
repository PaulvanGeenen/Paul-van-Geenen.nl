// Track Lock, Vault & Per-Book GUID System for Book Readers & Admins
// Stored in MySQL (per book/album & track) + localStorage (reader QR unlocks & active GUIDs, no cookies).

const UNLOCKED_TRACKS_STORAGE_KEY = 'pvg_unlocked_tracks_v1';
const LOCK_SYSTEM_ENABLED_KEY = 'pvg_lock_system_enabled_v1';
const ADMIN_USER_FLAG_KEY = 'pvg_is_admin_user_v1';
const BOOK_GUIDS_STORAGE_KEY = 'pvg_book_guids_v1';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface LockableTrack {
  id: string;
  title: string;
  folderName?: string;
  album?: string;
  albumId?: number | string;
  order?: string;
  albumOrder?: number | string;
  alwaysUnlocked?: boolean;
  always_unlocked?: number | boolean;
}

export interface AlbumLockConfig {
  id?: string | number;
  title?: string;
  locksEnabled?: boolean;
  locks_enabled?: number | boolean;
  adminLocksEnabled?: boolean;
  admin_locks_enabled?: number | boolean;
  guid24h?: string | null;
  guid_24h?: string | null;
  guidUnlimited?: string | null;
  guid_unlimited?: string | null;
  freeTrack1?: string | null;
  free_track_1?: string | null;
  freeTrack2?: string | null;
  free_track_2?: string | null;
}

export interface StoredBookGuidEntry {
  guid24h?: {
    guid: string;
    activatedAt: number;
  };
  guidUnlimited?: {
    guid: string;
    activatedAt: number;
  };
}

export type StoredBookGuidsMap = Record<string, StoredBookGuidEntry>;

/**
 * Generate a fresh RFC4122 v4 GUID
 */
export function generateBookGuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().toUpperCase();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16).toUpperCase();
  });
}

/**
 * Check if the current browser belongs to an Admin reader.
 * Automatically set when logging into /admin, and can be toggled in the Admin Locks screen.
 */
export function isAdminUser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const explicit = localStorage.getItem(ADMIN_USER_FLAG_KEY);
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    // Also recognize if browser was marked as admin device in analytics
    if (localStorage.getItem('pvg_is_admin_device') === 'true') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Mark or unmark the current browser as an Admin user
 */
export function setIsAdminUser(isAdmin: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADMIN_USER_FLAG_KEY, isAdmin ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('pvg-locks-changed'));
  } catch (e) {
    console.warn('Could not save admin user flag:', e);
  }
}

/**
 * Helper to check if a track matches a configured free_track_1 or free_track_2 value from the SQL albums table.
 */
export function doesTrackMatchAlbumFreeSlot(track: LockableTrack | undefined | null, slotVal?: string | number | null): boolean {
  if (!track || slotVal === undefined || slotVal === null) return false;
  const raw = String(slotVal).trim();
  if (!raw) return false;

  const rawLower = raw.toLowerCase();

  if (track.id && String(track.id).toLowerCase() === rawLower) return true;
  if (track.folderName && track.folderName.toLowerCase() === rawLower) return true;
  if (track.title && track.title.toLowerCase() === rawLower) return true;

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

  const slotPrefix = extractTrackNumberPrefix(raw);
  if (slotPrefix) {
    if (track.folderName && extractTrackNumberPrefix(track.folderName) === slotPrefix) return true;
    if (track.id && extractTrackNumberPrefix(String(track.id)) === slotPrefix) return true;
  }

  return false;
}

/**
 * Check if locks are enabled for NON-ADMIN readers on a specific book/album (`locks_enabled` in SQL).
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
 * Check if locks are enabled for ADMIN readers on a specific book/album (`admin_locks_enabled` in SQL).
 * Defaults to FALSE (all songs unlocked for admin unless admin enables locks for testing).
 */
export function isAlbumAdminLocksEnabled(albumConfig?: AlbumLockConfig | null): boolean {
  if (!albumConfig) return false;
  if (albumConfig.adminLocksEnabled !== undefined) {
    return Boolean(albumConfig.adminLocksEnabled);
  }
  if (albumConfig.admin_locks_enabled !== undefined && albumConfig.admin_locks_enabled !== null) {
    if (typeof albumConfig.admin_locks_enabled === 'boolean') return albumConfig.admin_locks_enabled;
    return Number(albumConfig.admin_locks_enabled) !== 0;
  }
  return false;
}

/**
 * Check if a track is marked as "Never Locked" (`always_unlocked` = 1 in SQL).
 */
export function isTrackAlwaysUnlocked(
  track: LockableTrack | undefined | null,
  albumConfig?: AlbumLockConfig | null
): boolean {
  if (!track) return false;
  if (track.alwaysUnlocked !== undefined) {
    return Boolean(track.alwaysUnlocked);
  }
  if (track.always_unlocked !== undefined && track.always_unlocked !== null) {
    if (typeof track.always_unlocked === 'boolean') return track.always_unlocked;
    return Number(track.always_unlocked) === 1;
  }
  // Legacy fallback only if always_unlocked was not present on the track object
  const free1 = (albumConfig?.freeTrack1 ?? albumConfig?.free_track_1 ?? '').toString().trim();
  const free2 = (albumConfig?.freeTrack2 ?? albumConfig?.free_track_2 ?? '').toString().trim();
  if (free1 || free2) {
    return doesTrackMatchAlbumFreeSlot(track, free1) || doesTrackMatchAlbumFreeSlot(track, free2);
  }
  return false;
}

/**
 * Normalize book key for storing per-book GUID state in localStorage
 */
function getAlbumStorageKeys(albumConfig?: AlbumLockConfig | null): string[] {
  if (!albumConfig) return [];
  const keys: string[] = [];
  if (albumConfig.id !== undefined && albumConfig.id !== null && String(albumConfig.id).trim() !== '') {
    keys.push(`id:${String(albumConfig.id).trim().toLowerCase()}`);
  }
  if (albumConfig.title && albumConfig.title.trim() !== '') {
    keys.push(`title:${albumConfig.title.trim().toLowerCase()}`);
  }
  return keys;
}

export function getStoredBookGuidsMap(): StoredBookGuidsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(BOOK_GUIDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredBookGuidsMap(map: StoredBookGuidsMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BOOK_GUIDS_STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent('pvg-locks-changed'));
  } catch (e) {
    console.warn('Could not save book GUIDs in localStorage:', e);
  }
}

/**
 * Check if the reader has an active, valid 24-hour unlock GUID for this book.
 * Automatically invalidated if 24 hours pass OR if the admin changes guid_24h in SQL.
 */
export function isBook24hGuidActive(albumConfig?: AlbumLockConfig | null): boolean {
  if (!albumConfig) return false;
  const configuredGuid = String(albumConfig.guid_24h ?? albumConfig.guid24h ?? '').trim();
  if (!configuredGuid) return false;

  const map = getStoredBookGuidsMap();
  const keys = getAlbumStorageKeys(albumConfig);
  const now = Date.now();

  for (const k of keys) {
    const entry = map[k]?.guid24h;
    if (entry && entry.guid && entry.guid.toLowerCase() === configuredGuid.toLowerCase()) {
      const elapsed = now - (entry.activatedAt || 0);
      if (elapsed >= 0 && elapsed < TWENTY_FOUR_HOURS_MS) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Return remaining milliseconds for an active 24h GUID on a book (or 0 if inactive/expired)
 */
export function getBook24hGuidRemainingMs(albumConfig?: AlbumLockConfig | null): number {
  if (!albumConfig) return 0;
  const configuredGuid = String(albumConfig.guid_24h ?? albumConfig.guid24h ?? '').trim();
  if (!configuredGuid) return 0;

  const map = getStoredBookGuidsMap();
  const keys = getAlbumStorageKeys(albumConfig);
  const now = Date.now();

  for (const k of keys) {
    const entry = map[k]?.guid24h;
    if (entry && entry.guid && entry.guid.toLowerCase() === configuredGuid.toLowerCase()) {
      const remaining = TWENTY_FOUR_HOURS_MS - (now - (entry.activatedAt || 0));
      if (remaining > 0) return remaining;
    }
  }
  return 0;
}

/**
 * Check if the reader has an active, valid Unlimited unlock GUID for this book.
 * Automatically invalidated if the admin changes guid_unlimited in SQL, or if the reader enters the code a second time.
 */
export function isBookUnlimitedGuidActive(albumConfig?: AlbumLockConfig | null): boolean {
  if (!albumConfig) return false;
  const configuredGuid = String(albumConfig.guid_unlimited ?? albumConfig.guidUnlimited ?? '').trim();
  if (!configuredGuid) return false;

  const map = getStoredBookGuidsMap();
  const keys = getAlbumStorageKeys(albumConfig);

  for (const k of keys) {
    const entry = map[k]?.guidUnlimited;
    if (entry && entry.guid && entry.guid.toLowerCase() === configuredGuid.toLowerCase()) {
      return true;
    }
  }
  return false;
}

export interface GuidApplyResult {
  success: boolean;
  action: 'unlocked_24h' | 'unlocked_unlimited' | 'relocked' | 'invalid';
  albumTitle?: string;
  albumId?: string | number;
  message: string;
}

/**
 * Apply a 24h or Unlimited GUID entered by a reader (via input or ?guid=... URL).
 * - If it matches a book's guid_24h: unlocks all tracks of that book for 24 hours.
 * - If it matches a book's guid_unlimited:
 *   - If NOT currently active for this reader: unlocks all tracks of that book indefinitely.
 *   - If ALREADY active for this reader: locks all tracks of that book again EXCEPT the tracks the reader personally unlocked via QR codes + always_unlocked tracks!
 */
export function applyBookGuidCode(rawCode: string, albums: AlbumLockConfig[]): GuidApplyResult {
  const code = (rawCode || '').trim();
  if (!code) {
    return {
      success: false,
      action: 'invalid',
      message: 'Voer een geldige code in.'
    };
  }

  const codeLower = code.toLowerCase();
  const map = getStoredBookGuidsMap();
  const now = Date.now();

  for (const alb of albums) {
    const guidUnlimited = String(alb.guid_unlimited ?? alb.guidUnlimited ?? '').trim();
    const guid24h = String(alb.guid_24h ?? alb.guid24h ?? '').trim();
    const keys = getAlbumStorageKeys(alb);

    // 1. Check Unlimited GUID match
    if (guidUnlimited && guidUnlimited.toLowerCase() === codeLower) {
      const currentlyActive = isBookUnlimitedGuidActive(alb);
      if (currentlyActive) {
        // Reader entered the unlimited GUID again while open -> close locks again (except personally QR-unlocked tracks)!
        for (const k of keys) {
          if (map[k]) {
            delete map[k].guidUnlimited;
            delete map[k].guid24h;
          }
        }
        saveStoredBookGuidsMap(map);
        playLockRattleSound();
        return {
          success: true,
          action: 'relocked',
          albumTitle: alb.title,
          albumId: alb.id,
          message: `De slootjes van "${alb.title || 'dit boek'}" zijn weer gesloten (behalve de SoundTracks die je zelf al hebt vrijgelezen).`
        };
      } else {
        // Activate unlimited unlock for this book
        for (const k of keys) {
          map[k] = {
            ...(map[k] || {}),
            guidUnlimited: {
              guid: guidUnlimited,
              activatedAt: now
            }
          };
        }
        saveStoredBookGuidsMap(map);
        playLockUnlockSound();
        return {
          success: true,
          action: 'unlocked_unlimited',
          albumTitle: alb.title,
          albumId: alb.id,
          message: `Alle SoundTracks van "${alb.title || 'dit boek'}" zijn onbeperkt geopend! (Voer de code nogmaals in om ze weer te sluiten).`
        };
      }
    }

    // 2. Check 24-Hour GUID match
    if (guid24h && guid24h.toLowerCase() === codeLower) {
      for (const k of keys) {
        map[k] = {
          ...(map[k] || {}),
          guid24h: {
            guid: guid24h,
            activatedAt: now
          }
        };
      }
      saveStoredBookGuidsMap(map);
      playLockUnlockSound();
      return {
        success: true,
        action: 'unlocked_24h',
        albumTitle: alb.title,
        albumId: alb.id,
        message: `Alle SoundTracks van "${alb.title || 'dit boek'}" zijn voor 24 uur geopend!`
      };
    }
  }

  playLockRattleSound();
  return {
    success: false,
    action: 'invalid',
    message: 'Deze code is ongeldig of niet meer actief.'
  };
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
 * Check whether the global lock system override is enabled in localStorage.
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
 * Toggle the global lock system on or off
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
 * Retrieve all personally QR-unlocked track keys from localStorage
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
 * Check if a track has been personally unlocked via QR code in localStorage
 */
export function isTrackPersonallyUnlockedInStorage(track: LockableTrack | undefined | null): boolean {
  if (!track) return false;
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
 * Check if a raw identifier (e.g. song name from QR code) is already unlocked in localStorage
 */
export function isRawIdentifierUnlockedInStorage(identifier?: string | null): boolean {
  if (!identifier) return false;
  const unlockedKeys = getUnlockedTrackKeys();
  if (unlockedKeys.length === 0) return false;

  const candidates = new Set<string>();
  const norm = normalizeTrackKey(identifier);
  if (norm) candidates.add(norm);
  const num = extractTrackNumberPrefix(identifier);
  if (num) candidates.add(`num:${num}`);
  const stripped = identifier.replace(/^\d{1,3}[\s.-]+/, '').trim();
  if (stripped) candidates.add(normalizeTrackKey(stripped));

  for (const c of candidates) {
    if (c && unlockedKeys.includes(c)) return true;
  }
  return false;
}

/**
 * Check if a specific track is unlocked for the current visitor (Reader or Admin).
 * Evaluates in order:
 * 1. Track is marked "Nooit op slot" (`always_unlocked = 1` in SQL)
 * 2. Visitor is Admin vs Non-Admin reader:
 *    - Admin reader: checks `admin_locks_enabled` for this book (if OFF -> all songs open for Admin!)
 *    - Non-Admin reader: checks `locks_enabled` for this book (if OFF -> all songs open for Non-Admin readers!)
 * 3. Active 24-hour GUID for this book (`guid_24h`)
 * 4. Active Unlimited GUID for this book (`guid_unlimited`)
 * 5. Personally unlocked by the reader via QR code scan (`pvg_unlocked_tracks_v1` in localStorage)
 */
export function isTrackUnlocked(
  track: LockableTrack | undefined | null,
  _indexInAlbum: number,
  forceLockSystem?: boolean,
  albumConfig?: AlbumLockConfig | null
): boolean {
  if (!track) return false;

  // Rule 1: Track is configured as "Never Locked" (always_unlocked = 1)
  if (isTrackAlwaysUnlocked(track, albumConfig)) {
    return true;
  }

  // Rule 2: Admin vs Non-Admin Reader lock switches per book
  const adminVisitor = isAdminUser();
  if (adminVisitor) {
    // Admin visitor: if global admin lock override is off OR this book's admin_locks_enabled is off, all tracks are open for Admin
    const globalEnabled = forceLockSystem !== undefined ? forceLockSystem : isLockSystemEnabled();
    if (!globalEnabled) return true;
    if (albumConfig && !isAlbumAdminLocksEnabled(albumConfig)) {
      return true;
    }
  } else {
    // Non-Admin reader: check this book's locks_enabled in SQL
    if (albumConfig && !isAlbumLocksEnabled(albumConfig)) {
      return true;
    }
  }

  // Rule 3: Active 24-Hour GUID for this book
  if (albumConfig && isBook24hGuidActive(albumConfig)) {
    return true;
  }

  // Rule 4: Active Unlimited GUID for this book
  if (albumConfig && isBookUnlimitedGuidActive(albumConfig)) {
    return true;
  }

  // Rule 5: Personally unlocked via QR scan in localStorage
  return isTrackPersonallyUnlockedInStorage(track);
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
 * Reset all unlocked tracks and active book GUIDs in localStorage (for Admin testing)
 */
export function resetUnlockedTracks(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(UNLOCKED_TRACKS_STORAGE_KEY);
    localStorage.removeItem(BOOK_GUIDS_STORAGE_KEY);
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
    const hitOffsets = [0, 0.085, 0.165, 0.26, 0.34];
    const baseFreqs = [520, 680, 460, 740, 590];

    hitOffsets.forEach((offset, idx) => {
      const startTime = now + offset;
      const duration = 0.065;

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

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc2.type = 'square';

      const f = baseFreqs[idx];
      osc1.frequency.setValueAtTime(f, startTime);
      osc1.frequency.exponentialRampToValueAtTime(f * 0.72, startTime + duration);

      osc2.frequency.setValueAtTime(f * 2.41, startTime);
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
  } catch {
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
    playLockRattleSound();

    const now = ctx.currentTime;
    const unlatchTime = now + 0.52;

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

    const chimeTime = now + 0.68;
    const chimeFreqs = [523.25, 659.25, 783.99, 1046.5];
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
  } catch {
    // Ignore audio context restrictions
  }
}
