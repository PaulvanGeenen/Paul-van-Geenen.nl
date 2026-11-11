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


export async function transipQuerySql<T = any>(sql: string): Promise<T[] | null> {
  const res = await transipPost<{ success: boolean; data: T[] }>('execute_sql', { sql });
  if (res && res.success && Array.isArray(res.data)) {
    return res.data;
  }
  return null;
}

export async function getQrCodeByCode(code: string): Promise<any | null> {
  const clean = code.trim().toUpperCase().replace(/'/g, "''");
  const sql = `SELECT id, boek_id AS boekId, boek_titel AS boekTitel, hoofdstuk_id AS hoofdstukId, hoofdstuk, song, artist, spotify_link AS spotifyLink, qr_image AS qrImage FROM qrcodes WHERE UPPER(id) = '${clean}' LIMIT 1;`;
  const rows = await transipQuerySql(sql);
  return rows && rows.length > 0 ? rows[0] : null;
}

export async function getTransipQrCodes(): Promise<any[]> {
  const sql = `SELECT id, boek_id AS boekId, boek_titel AS boekTitel, hoofdstuk_id AS hoofdstukId, hoofdstuk, song, artist, spotify_link AS spotifyLink, qr_image AS qrImage FROM qrcodes ORDER BY id ASC;`;
  const rows = await transipQuerySql(sql);
  return rows || [];
}

export async function getTransipBoeken(): Promise<any[]> {
  const sql = `SELECT id, volgnummer, boektitel, qr_logo AS qrLogo FROM boeken ORDER BY volgnummer ASC;`;
  const rows = await transipQuerySql(sql);
  if (rows !== null) return rows;
  // Fallback indien oudere schema zonder qr_logo kolom
  const fallbackRows = await transipQuerySql(`SELECT id, volgnummer, boektitel FROM boeken ORDER BY volgnummer ASC;`);
  return fallbackRows || [];
}

export async function getTransipHoofdstukken(boekId?: string): Promise<any[]> {
  const where = boekId ? `WHERE boek_id = '${boekId.replace(/'/g, "''")}'` : '';
  const sql = `SELECT id, boek_id AS boekId, volgnummer, omschrijving FROM hoofdstukken ${where} ORDER BY volgnummer ASC;`;
  const rows = await transipQuerySql(sql);
  return rows || [];
}

export async function saveTransipBoek(boek: { id?: string; volgnummer: number; boektitel: string; qrLogo?: string | null }): Promise<boolean> {
  const cleanId = (boek.id || `bk_${Date.now()}`).replace(/'/g, "''");
  const cleanTitel = (boek.boektitel || '').trim().replace(/'/g, "''");
  const num = parseInt(String(boek.volgnummer), 10) || 1;
  const logoVal = boek.qrLogo ? `'${String(boek.qrLogo).replace(/'/g, "''")}'` : 'NULL';
  const sql = `INSERT INTO boeken (id, volgnummer, boektitel, qr_logo) VALUES ('${cleanId}', ${num}, '${cleanTitel}', ${logoVal}) ON DUPLICATE KEY UPDATE volgnummer = VALUES(volgnummer), boektitel = VALUES(boektitel), qr_logo = VALUES(qr_logo);`;
  const res = await transipQuerySql(sql);
  return res !== null;
}

export async function deleteTransipBoek(id: string): Promise<boolean> {
  const cleanId = id.replace(/'/g, "''");
  const sql = `DELETE FROM boeken WHERE id = '${cleanId}';`;
  const res = await transipQuerySql(sql);
  return res !== null;
}

export async function saveTransipHoofdstuk(hoofdstuk: { id?: string; boekId: string; volgnummer: number; omschrijving: string }): Promise<boolean> {
  const cleanId = (hoofdstuk.id || `ch_${Date.now()}`).replace(/'/g, "''");
  const cleanBoekId = (hoofdstuk.boekId || '').replace(/'/g, "''");
  const cleanOms = (hoofdstuk.omschrijving || '').trim().replace(/'/g, "''");
  const num = parseInt(String(hoofdstuk.volgnummer), 10) || 1;
  const sql = `INSERT INTO hoofdstukken (id, boek_id, volgnummer, omschrijving) VALUES ('${cleanId}', '${cleanBoekId}', ${num}, '${cleanOms}') ON DUPLICATE KEY UPDATE boek_id = VALUES(boek_id), volgnummer = VALUES(volgnummer), omschrijving = VALUES(omschrijving);`;
  const res = await transipQuerySql(sql);
  return res !== null;
}

export async function deleteTransipHoofdstuk(id: string): Promise<boolean> {
  const cleanId = id.replace(/'/g, "''");
  const sql = `DELETE FROM hoofdstukken WHERE id = '${cleanId}';`;
  const res = await transipQuerySql(sql);
  return res !== null;
}

export async function saveTransipQrCode(item: any): Promise<boolean> {
  const cleanId = (item.id || '').toUpperCase().trim().replace(/'/g, "''");
  const cleanBoekId = (item.boekId || '').replace(/'/g, "''");
  const cleanBoekTitel = (item.boekTitel || '').replace(/'/g, "''");
  const cleanHoofdstukId = (item.hoofdstukId || '').replace(/'/g, "''");
  const cleanHoofdstuk = (item.hoofdstuk || '').replace(/'/g, "''");
  const cleanSong = (item.song || '').replace(/'/g, "''");
  const cleanArtist = (item.artist || '').replace(/'/g, "''");
  const cleanSpotifyLink = (item.spotifyLink || '').replace(/'/g, "''");
  const cleanQrImage = (item.qrImage || '').replace(/'/g, "''");

  const sql = `INSERT INTO qrcodes (id, boek_id, boek_titel, hoofdstuk_id, hoofdstuk, song, artist, spotify_link, qr_image)
    VALUES ('${cleanId}', '${cleanBoekId}', '${cleanBoekTitel}', '${cleanHoofdstukId}', '${cleanHoofdstuk}', '${cleanSong}', '${cleanArtist}', '${cleanSpotifyLink}', '${cleanQrImage}')
    ON DUPLICATE KEY UPDATE 
      boek_id = VALUES(boek_id),
      boek_titel = VALUES(boek_titel),
      hoofdstuk_id = VALUES(hoofdstuk_id),
      hoofdstuk = VALUES(hoofdstuk),
      song = VALUES(song),
      artist = VALUES(artist),
      spotify_link = VALUES(spotify_link),
      qr_image = VALUES(qr_image);`;
  const res = await transipQuerySql(sql);
  return res !== null;
}

export async function deleteTransipQrCode(id: string): Promise<boolean> {
  const cleanId = id.toUpperCase().trim().replace(/'/g, "''");
  const sql = `DELETE FROM qrcodes WHERE UPPER(id) = '${cleanId}';`;
  const res = await transipQuerySql(sql);
  return res !== null;
}
