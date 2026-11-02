/**
 * TransIP Dedicated Database Client
 * Direct REST communication with TransIP MySQL bridge (visitor_database.php)
 * Database: paulw6_Analytics (MySQL op TransIP Webhosting)
 */

export const TRANSIP_API_KEY = "visitor-secret-key-paul-2026";

export function getTransipApiUrl(action: string): string {
  // If running directly on production domain (paulvangeenen.nl):
  if (typeof window !== 'undefined' && window.location.hostname.includes('paulvangeenen.nl')) {
    return `/api/visitor_database.php?key=${TRANSIP_API_KEY}&action=${action}`;
  }
  // If in preview / local / container environment:
  return `https://www.paulvangeenen.nl/api/visitor_database.php?key=${TRANSIP_API_KEY}&action=${action}`;
}

export async function transipPost<T = any>(action: string, payload: any): Promise<T | null> {
  const url = getTransipApiUrl(action);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TRANSIP_API_KEY
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      return data as T;
    }
  } catch (err) {
    console.warn(`[TransIP] POST action '${action}' error:`, err);
  }
  return null;
}

export async function transipGet<T = any>(action: string): Promise<T | null> {
  const url = getTransipApiUrl(action);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-API-Key': TRANSIP_API_KEY
      }
    });
    if (res.ok) {
      const data = await res.json();
      return data as T;
    }
  } catch (err) {
    console.warn(`[TransIP] GET action '${action}' error:`, err);
  }
  return null;
}
