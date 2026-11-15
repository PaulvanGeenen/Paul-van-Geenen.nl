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
export async function fetchLogboekEntries(): Promise<LogboekEntry[]> {
  const data = await callLogboekApi('get_logboek', 'GET');
  const rows: any[] = Array.isArray(data?.entries) ? data.entries : [];
  return rows.map((r) => ({
    id: Number(r.id),
    datum: String(r.datum || ''),
    foto: r.foto ? String(r.foto) : null,
    tekst: String(r.tekst || ''),
    audio_url: r.audio_url ? String(r.audio_url) : null,
    audio_enabled: r.audio_enabled === undefined ? true : Boolean(Number(r.audio_enabled) !== 0 && r.audio_enabled !== false),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
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

export async function uploadLogboekPhoto(dataUrl: string): Promise<string> {
  const data = await callLogboekApi('upload_photo', 'POST', { dataUrl });
  return String(data.url);
}

export async function uploadLogboekAudio(dataUrl: string): Promise<string> {
  const data = await callLogboekApi('upload_audio', 'POST', { dataUrl });
  return String(data.url);
}

export function setLogboekOverlayOpenState(isOpen: boolean): void {
  window.dispatchEvent(new CustomEvent('pvg-logboek-overlay-state', { detail: { isOpen } }));
}

export function openLogboekOverlay(entryIndex = 0): void {
  window.dispatchEvent(new CustomEvent('pvg-open-logboek', { detail: { entryIndex } }));
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
