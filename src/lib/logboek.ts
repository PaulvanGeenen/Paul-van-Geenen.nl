export interface LogboekEntry {
  id: number;
  datum: string; // YYYY-MM-DD
  foto?: string | null;
  tekst: string;
  audio_url?: string | null;
  audio_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

const API_CANDIDATES = [
  '/api/logboek_database.php',
  'https://paulvangeenen.nl/api/logboek_database.php',
];

function getApiKey(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('transip_music_api_key') || 'music-secret-key-paul-2026';
  }
  return 'music-secret-key-paul-2026';
}

async function callLogboekApi(action: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<any> {
  let lastError: Error | null = null;
  for (const base of API_CANDIDATES) {
    try {
      const url = `${base}?action=${encodeURIComponent(action)}`;
      const res = await fetch(url, {
        method,
        cache: 'no-store',
        headers: {
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
          'X-API-Key': getApiKey(),
        },
        body: method === 'POST' && body !== undefined ? JSON.stringify(body) : undefined,
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) continue;
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error('Kon logboek API niet bereiken.');
}

/**
 * Haal alle logboek-notities op (vaste sorteervolgorde: nieuwste eerst).
 */
export async function fetchLogboekWithCover(): Promise<{ entries: LogboekEntry[]; coverImage: string | null }> {
  const data = await callLogboekApi('get_logboek', 'GET');
  const rows: any[] = Array.isArray(data?.entries) ? data.entries : [];
  const entries = rows.map((r) => ({
    id: Number(r.id),
    datum: String(r.datum || ''),
    foto: r.foto ? String(r.foto) : null,
    tekst: String(r.tekst || ''),
    audio_url: r.audio_url ? String(r.audio_url) : null,
    audio_enabled: r.audio_enabled === undefined ? true : Boolean(Number(r.audio_enabled) !== 0 && r.audio_enabled !== false),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
  return {
    entries,
    coverImage: data?.cover_image ? String(data.cover_image) : null,
  };
}

export async function fetchLogboekEntries(): Promise<LogboekEntry[]> {
  const { entries } = await fetchLogboekWithCover();
  return entries;
}

export async function saveLogboekCover(coverImage: string | null): Promise<void> {
  await callLogboekApi('save_cover_image', 'POST', { cover_image: coverImage });
  window.dispatchEvent(new CustomEvent('pvg-logboek-changed'));
}

export async function saveLogboekEntry(entry: {
  id?: number;
  datum: string;
  foto?: string | null;
  tekst: string;
  audio_url?: string | null;
  audio_enabled?: boolean;
}): Promise<number> {
  const data = await callLogboekApi('save_entry', 'POST', entry);
  window.dispatchEvent(new CustomEvent('pvg-logboek-changed'));
  return Number(data.id);
}

export async function deleteLogboekEntry(id: number): Promise<void> {
  await callLogboekApi('delete_entry', 'POST', { id });
  window.dispatchEvent(new CustomEvent('pvg-logboek-changed'));
}

export function isLogboekVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('data:video/')) return true;
  const clean = trimmed.split('?')[0].split('#')[0];
  return /\.(mp4|mov|webm|m4v|ogv)$/.test(clean);
}

export async function uploadLogboekPhoto(dataUrl: string): Promise<string> {
  const data = await callLogboekApi('upload_photo', 'POST', { dataUrl });
  return String(data.url);
}

export async function uploadLogboekVideo(file: File): Promise<string> {
  let lastError: Error | null = null;
  for (const base of API_CANDIDATES) {
    try {
      const formData = new FormData();
      formData.append('video', file);
      const url = `${base}?action=upload_video`;
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'X-API-Key': getApiKey(),
        },
        body: formData,
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) continue;
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      return String(data.url);
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError || new Error('Kon filmpje niet uploaden.');
}

export async function uploadLogboekAudio(dataUrl: string): Promise<string> {
  const data = await callLogboekApi('upload_audio', 'POST', { dataUrl });
  return String(data.url);
}

export function setLogboekOverlayOpenState(isOpen: boolean): void {
  window.dispatchEvent(new CustomEvent('pvg-logboek-overlay-state', { detail: { isOpen } }));
}

export function openLogboekOverlay(entryIndex = 0, entryId?: number): void {
  window.dispatchEvent(new CustomEvent('pvg-open-logboek', { detail: { entryIndex, entryId } }));
}

const LOGBOEK_SHARE_SALT = 0x5e8a4d29;

export function encodeLogboekShareCode(entryId: number): string {
  const raw = `lb~${entryId}`;
  let encoded = '';
  for (let i = 0; i < raw.length; i++) {
    const charCode = raw.charCodeAt(i);
    const mask = ((i + 1) * 41 + (LOGBOEK_SHARE_SALT >> (i % 8))) & 0xff;
    encoded += String.fromCharCode(charCode ^ mask);
  }
  return btoa(encoded)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function decodeLogboekShareCode(code: string): number | null {
  try {
    let base64 = code.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decodedStr = atob(base64);
    let raw = '';
    for (let i = 0; i < decodedStr.length; i++) {
      const charCode = decodedStr.charCodeAt(i);
      const mask = ((i + 1) * 41 + (LOGBOEK_SHARE_SALT >> (i % 8))) & 0xff;
      raw += String.fromCharCode(charCode ^ mask);
    }
    if (raw.startsWith('lb~')) {
      const idStr = raw.slice(3);
      if (/^\d+$/.test(idStr)) {
        return Number(idStr);
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function getLogboekShareUrl(entryId: number): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://paulvangeenen.nl';
  return `${origin}/logboek?v=${encodeLogboekShareCode(entryId)}`;
}

export function formatLogboekDatum(datumStr: string): string {
  if (!datumStr) return '';
  const parts = datumStr.split('-');
  if (parts.length !== 3) return datumStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const months = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december',
  ];
  if (month < 0 || month > 11 || !day || !year) return datumStr;
  return `${day} ${months[month]} ${year}`;
}
