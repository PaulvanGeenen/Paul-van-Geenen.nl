import { transipPost } from './transip';

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export type SubtitleSize = 'sm' | 'md' | 'lg' | 'xl';

export function getSubtitlePreferences(): { enabled: boolean; lang: 'GB' | 'NL'; size: SubtitleSize } {
  try {
    const cookieEnabled = getCookie('pv_subtitle_enabled');
    const cookieLang = getCookie('pv_subtitle_lang');
    const cookieSize = getCookie('pv_subtitle_size');
    const localEnabled = typeof localStorage !== 'undefined' ? localStorage.getItem('pv_subtitle_enabled') : null;
    const localLang = typeof localStorage !== 'undefined' ? localStorage.getItem('pv_subtitle_lang') : null;
    const localSize = typeof localStorage !== 'undefined' ? localStorage.getItem('pv_subtitle_size') : null;

    let enabled = true;
    if (cookieEnabled === 'false' || localEnabled === 'false') {
      enabled = false;
    } else if (cookieEnabled === 'true' || localEnabled === 'true') {
      enabled = true;
    }

    let lang: 'GB' | 'NL' = 'NL';
    const effectiveLang = cookieLang || localLang;
    if (effectiveLang === 'NL' || effectiveLang === 'nl') {
      lang = 'NL';
    } else if (effectiveLang === 'GB' || effectiveLang === 'gb' || effectiveLang === 'EN' || effectiveLang === 'en') {
      lang = 'GB';
    }

    let size: SubtitleSize = 'md';
    const effectiveSize = (cookieSize || localSize || '').toLowerCase();
    if (effectiveSize === 'sm' || effectiveSize === 'small' || effectiveSize === 'klein') {
      size = 'sm';
    } else if (effectiveSize === 'md' || effectiveSize === 'medium' || effectiveSize === 'normaal') {
      size = 'md';
    } else if (effectiveSize === 'lg' || effectiveSize === 'large' || effectiveSize === 'groot') {
      size = 'lg';
    } else if (effectiveSize === 'xl' || effectiveSize === 'extra-large' || effectiveSize === 'extragroot' || effectiveSize === 'extra_large') {
      size = 'xl';
    }

    return { enabled, lang, size };
  } catch {
    return { enabled: true, lang: 'NL', size: 'md' };
  }
}

export function setSubtitlePreferences(enabled: boolean, lang: 'GB' | 'NL', size: SubtitleSize = 'md'): void {
  if (typeof document !== 'undefined') {
    const maxAge = 365 * 24 * 60 * 60; // 1 year
    document.cookie = `pv_subtitle_enabled=${enabled ? 'true' : 'false'}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `pv_subtitle_lang=${lang}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `pv_subtitle_size=${size}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pv_subtitle_enabled', enabled ? 'true' : 'false');
      localStorage.setItem('pv_subtitle_lang', lang);
      localStorage.setItem('pv_subtitle_size', size);
    }
  } catch {}
}

export function markDeviceAsAdmin(): void {
  if (typeof document !== 'undefined') {
    const maxAge = 5 * 365 * 24 * 60 * 60; // 5 jaar
    document.cookie = `pv_admin_device=true; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `pv_admin_ignore=true; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `pv_admin_token=GONDA1984; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('is_admin_device', 'true');
      localStorage.setItem('ignore_own_analytics', 'true');
      localStorage.setItem('pv_ignore_admin_analytics', 'true');
      localStorage.setItem('krabbels_admin_token', 'GONDA1984');
    }
  } catch {}

  // Wis direct alle tracking data van het IP-adres en eventuele actieve sessie van dit device
  try {
    let currentSessionId: string | null = null;
    if (typeof sessionStorage !== 'undefined') {
      currentSessionId = sessionStorage.getItem('boeken_analytics_session_id');
      if (currentSessionId) {
        sessionStorage.removeItem('boeken_analytics_session_id');
      }
    }

    // 1. Directe TransIP MySQL bridge call
    transipPost('delete_by_ip', { sessionId: currentSessionId }).catch(() => {});

    // 2. Express API route als fallback
    if (typeof fetch !== 'undefined') {
      fetch('/api/analytics/clean-admin-ip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId })
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Analytics] Fout bij wissen admin IP tracking:', err);
  }
}

export function setAdminCookie(ignore: boolean): void {
  if (typeof document === 'undefined') return;
  const maxAge = 5 * 365 * 24 * 60 * 60; // 5 jaar
  if (ignore) {
    document.cookie = `pv_admin_device=true; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `pv_admin_token=GONDA1984; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.cookie = `pv_admin_ignore=true; path=/; max-age=${maxAge}; SameSite=Lax`;
    try {
      localStorage.setItem('is_admin_device', 'true');
      localStorage.setItem('ignore_own_analytics', 'true');
      localStorage.setItem('pv_ignore_admin_analytics', 'true');
    } catch {}
  } else {
    document.cookie = `pv_admin_ignore=false; path=/; max-age=${maxAge}; SameSite=Lax`;
    try {
      localStorage.setItem('ignore_own_analytics', 'false');
      localStorage.setItem('pv_ignore_admin_analytics', 'false');
    } catch {}
  }
}

export function isOwnAnalyticsIgnored(): boolean {
  try {
    const cookieIgnore = getCookie('pv_admin_ignore');
    const cookieDevice = getCookie('pv_admin_device');
    const cookieToken = getCookie('pv_admin_token');

    const ignoreExplicit = typeof localStorage !== 'undefined' ? localStorage.getItem('ignore_own_analytics') : null;
    const pvIgnore = typeof localStorage !== 'undefined' ? localStorage.getItem('pv_ignore_admin_analytics') : null;
    const isAdminDevice = typeof localStorage !== 'undefined' ? localStorage.getItem('is_admin_device') === 'true' : false;
    const isAdminToken = typeof localStorage !== 'undefined' ? localStorage.getItem('krabbels_admin_token') === 'GONDA1984' : false;

    // Als de beheerder expliciet op 'negeer uitschakelen' heeft geklikt voor testdoeleinden:
    if (cookieIgnore === 'false' || ignoreExplicit === 'false' || pvIgnore === 'false') {
      return false;
    }

    // Als dit apparaat ooit als beheerder is gemarkeerd, ingelogd is of negeren actief staat:
    if (
      cookieDevice === 'true' ||
      cookieIgnore === 'true' ||
      cookieToken === 'GONDA1984' ||
      isAdminDevice ||
      isAdminToken ||
      ignoreExplicit === 'true' ||
      pvIgnore === 'true'
    ) {
      return true;
    }
  } catch (e) {
    console.warn('[Analytics] Error checking ignore mode:', e);
  }

  return false;
}

export async function getUserGeoLocation(): Promise<{
  city: string;
  country: string;
  lat?: number;
  lng?: number;
}> {
  try {
    // 1. Check sessionStorage cache
    if (typeof sessionStorage !== 'undefined') {
      const cachedCity = sessionStorage.getItem('pv_user_city');
      const cachedCountry = sessionStorage.getItem('pv_user_country');
      const cachedLat = sessionStorage.getItem('pv_user_lat');
      const cachedLng = sessionStorage.getItem('pv_user_lng');

      if (cachedCity && cachedCity !== 'Onbekend') {
        return {
          city: cachedCity,
          country: cachedCountry || 'Nederland',
          lat: cachedLat ? parseFloat(cachedLat) : undefined,
          lng: cachedLng ? parseFloat(cachedLng) : undefined
        };
      }
    }

    // 2. Try ipwho.is (fast & reliable)
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('https://ipwho.is/', { signal: controller.signal }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.city) {
          const city = data.city;
          const country = data.country || 'Nederland';
          const lat = data.latitude;
          const lng = data.longitude;

          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('pv_user_city', city);
            sessionStorage.setItem('pv_user_country', country);
            if (lat) sessionStorage.setItem('pv_user_lat', String(lat));
            if (lng) sessionStorage.setItem('pv_user_lng', String(lng));
          }

          return { city, country, lat, lng };
        }
      }
    } catch {}

    // 3. Fallback: ipapi.co
    try {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 2000);
      const res2 = await fetch('https://ipapi.co/json/', { signal: controller2.signal }).catch(() => null);
      clearTimeout(timeout2);

      if (res2 && res2.ok) {
        const data2 = await res2.json().catch(() => null);
        if (data2 && data2.city) {
          const city = data2.city;
          const country = data2.country_name || 'Nederland';
          const lat = data2.latitude;
          const lng = data2.longitude;

          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('pv_user_city', city);
            sessionStorage.setItem('pv_user_country', country);
            if (lat) sessionStorage.setItem('pv_user_lat', String(lat));
            if (lng) sessionStorage.setItem('pv_user_lng', String(lng));
          }

          return { city, country, lat, lng };
        }
      }
    } catch {}

    // 4. Fallback: geojs.io
    try {
      const controller3 = new AbortController();
      const timeout3 = setTimeout(() => controller3.abort(), 2000);
      const res3 = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: controller3.signal }).catch(() => null);
      clearTimeout(timeout3);

      if (res3 && res3.ok) {
        const data3 = await res3.json().catch(() => null);
        if (data3 && data3.city) {
          const city = data3.city;
          const country = data3.country || 'Nederland';
          const lat = parseFloat(data3.latitude);
          const lng = parseFloat(data3.longitude);

          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('pv_user_city', city);
            sessionStorage.setItem('pv_user_country', country);
            if (!isNaN(lat)) sessionStorage.setItem('pv_user_lat', String(lat));
            if (!isNaN(lng)) sessionStorage.setItem('pv_user_lng', String(lng));
          }

          return { city, country, lat: isNaN(lat) ? undefined : lat, lng: isNaN(lng) ? undefined : lng };
        }
      }
    } catch {}
  } catch (e) {
    console.warn('[Analytics] Geo IP lookup failed:', e);
  }

  return { city: 'Onbekend', country: 'Nederland' };
}

/**
 * Universal, ultra-resilient music listen recorder.
 * Writes directly to Firestore and triggers backend Express endpoint.
 */
export async function recordMusicPlay(
  track: { id?: string; title?: string; order?: string; folderName?: string; album?: string },
  format: 'mp3' | 'audiobook' | 'reflection' | 'video',
  customRating: 'up' | 'down' | null = null,
  completed: boolean = false,
  durationSeconds: number = 0
): Promise<string | number | null> {
  if (isOwnAnalyticsIgnored()) {
    console.log('[Analytics] Overriding music play recording (Admin/Beheerder negeer-modus actief)');
    return null;
  }

  const trackId = track.id || track.folderName || track.order || 'Onbekend';
  const trackTitle = track.title || track.folderName || track.id || 'Muzieknummer';
  const album = track.album || 'De Echo';

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const deviceType = isMobile ? 'Mobiel' : 'Bureaublad computer';

  let city = 'Onbekend';
  let country = 'Nederland';
  let lat: number | undefined = 52.3676;
  let lng: number | undefined = 4.9041;

  if (typeof sessionStorage !== 'undefined') {
    const cachedCity = sessionStorage.getItem('pv_user_city');
    const cachedCountry = sessionStorage.getItem('pv_user_country');
    const cachedLat = sessionStorage.getItem('pv_user_lat');
    const cachedLng = sessionStorage.getItem('pv_user_lng');
    if (cachedCity && cachedCity !== 'Onbekend') {
      city = cachedCity;
      country = cachedCountry || 'Nederland';
      if (cachedLat) lat = parseFloat(cachedLat);
      if (cachedLng) lng = parseFloat(cachedLng);
    }
  }

  const nowIso = new Date().toISOString();
  const payload = {
    trackId,
    trackTitle,
    album,
    format: format || 'mp3',
    rating: customRating,
    completed: Boolean(completed),
    durationSeconds: Math.floor(durationSeconds || 0),
    deviceType,
    userAgent: ua,
    city,
    country,
    lat,
    lng,
    timestamp: nowIso,
    password: 'GONDA1984'
  };

  let recordId: string | number | null = null;

  // 1. Send DIRECTLY to TransIP MySQL Database Bridge
  try {
    const dataFb = await transipPost<{ success: boolean; id: string | number }>('music_play', payload);
    if (dataFb && dataFb.id) {
      recordId = dataFb.id;
    }
  } catch (err) {
    console.warn('[Analytics] Direct TransIP music_play recording warning:', err);
  }

  // Also notify Express backend if running in fullstack dev
  try {
    fetch('/api/analytics/music/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(res => {
      if (!recordId && res.ok) {
        res.json().then(data => { if (data?.id) recordId = data.id; }).catch(() => {});
      }
    }).catch(() => {});
  } catch {}

  // 2. If city was unknown, update in background
  if (city === 'Onbekend') {
    getUserGeoLocation().then(geo => {
      if (geo && geo.city && geo.city !== 'Onbekend') {
        sessionStorage.setItem('pv_user_city', geo.city);
        sessionStorage.setItem('pv_user_country', geo.country);
        if (geo.lat) sessionStorage.setItem('pv_user_lat', String(geo.lat));
        if (geo.lng) sessionStorage.setItem('pv_user_lng', String(geo.lng));
      }
    }).catch(() => {});
  }

  return recordId;
}

/**
 * Universal music play updater (marks completed = true when track finishes or updates duration).
 */
export async function updateMusicPlay(
  recordId: string | number,
  completed: boolean,
  durationSeconds: number
): Promise<void> {
  if (!recordId) return;
  if (isOwnAnalyticsIgnored()) return;

  const payload = {
    id: recordId,
    completed: Boolean(completed),
    durationSeconds: Math.floor(durationSeconds || 0),
    duration: Math.floor(durationSeconds || 0),
    password: 'GONDA1984'
  };

  // Direct TransIP MySQL update
  transipPost('music_update', payload).catch(() => {});

  // Optional backend API ping
  try {
    fetch('/api/analytics/music/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch {}
}

/**
 * Universal music rating recorder (Thumbs Up / Thumbs Down).
 */
export async function recordMusicRating(
  track: { id?: string; title?: string; order?: string; folderName?: string; album?: string },
  format: 'mp3' | 'audiobook' | 'reflection' | 'video',
  rating: 'up' | 'down' | null
): Promise<void> {
  if (isOwnAnalyticsIgnored()) {
    console.log('[Analytics] Skipping music rating (Admin/Beheerder negeer-modus actief)');
    return;
  }

  const trackId = track.id || track.folderName || track.order || 'Onbekend';
  const trackTitle = track.title || track.folderName || track.id || 'Muzieknummer';
  const album = track.album || 'De Echo';

  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const deviceType = isMobile ? 'Mobiel' : 'Bureaublad computer';

  let city = 'Onbekend';
  let country = 'Nederland';
  let lat: number | undefined = 52.3676;
  let lng: number | undefined = 4.9041;

  if (typeof sessionStorage !== 'undefined') {
    const cachedCity = sessionStorage.getItem('pv_user_city');
    const cachedCountry = sessionStorage.getItem('pv_user_country');
    const cachedLat = sessionStorage.getItem('pv_user_lat');
    const cachedLng = sessionStorage.getItem('pv_user_lng');
    if (cachedCity && cachedCity !== 'Onbekend') {
      city = cachedCity;
      country = cachedCountry || 'Nederland';
      if (cachedLat) lat = parseFloat(cachedLat);
      if (cachedLng) lng = parseFloat(cachedLng);
    }
  }

  const nowIso = new Date().toISOString();
  const payload = {
    trackId,
    trackTitle,
    album,
    format: format || 'mp3',
    rating,
    deviceType,
    userAgent: ua,
    city,
    country,
    lat,
    lng,
    timestamp: nowIso,
    password: 'GONDA1984'
  };

  // 1. Direct save in TransIP MySQL
  transipPost('music_rate', payload).catch(() => {});

  // 2. Optional Express backend ping
  try {
    fetch('/api/analytics/music/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch {}
}

