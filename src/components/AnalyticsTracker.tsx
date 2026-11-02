import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { isOwnAnalyticsIgnored, getUserGeoLocation } from '../lib/analytics';
import { transipPost } from '../lib/transip';

function generateSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
}

function parseReferrer(refUrl: string): string {
  if (!refUrl) return 'Direct / Bladwijzer';
  try {
    const url = new URL(refUrl);
    const host = url.hostname.toLowerCase();
    if (host.includes('paulvangeenen.nl') || host.includes('localhost') || host.includes('run.app')) {
      return 'Interne Navigatie';
    }
    if (host.includes('facebook.com') || host.includes('fb.me')) return 'Facebook';
    if (host.includes('instagram.com')) return 'Instagram';
    if (host.includes('t.co') || host.includes('twitter.com') || host.includes('x.com')) return 'X (Twitter)';
    if (host.includes('linkedin.com')) return 'LinkedIn';
    if (host.includes('google.')) return 'Google Zoeken';
    if (host.includes('bing.')) return 'Bing';
    if (host.includes('yahoo.')) return 'Yahoo';
    return url.hostname;
  } catch (e) {
    return refUrl.substring(0, 60);
  }
}

function getDeviceType(ua: string): string {
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) {
    return /mobile/i.test(ua) ? 'Android Telefoon' : 'Android Tablet';
  }
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/macintosh/i.test(ua)) return 'Mac Computer';
  if (/linux/i.test(ua)) return 'Linux computer';
  return 'Bureaublad computer';
}

export function AnalyticsTracker() {
  const location = useLocation();
  const currentPathRef = useRef(location.pathname);
  const prevPathRef = useRef<string>(location.pathname);
  const initializedSessionRef = useRef(false);

  // Keep path ref updated
  useEffect(() => {
    currentPathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    // 1. Resolve Session ID from storage or generate new
    let sessionId = sessionStorage.getItem('boeken_analytics_session_id');
    const isFirstVisitOfSession = !sessionId;

    if (!sessionId) {
      sessionId = generateSessionId();
      sessionStorage.setItem('boeken_analytics_session_id', sessionId);
    }

    const ua = navigator.userAgent;
    const deviceType = getDeviceType(ua);
    const rawReferrer = document.referrer;
    const referrer = parseReferrer(rawReferrer);

    async function initSession() {
      if (initializedSessionRef.current) return;
      initializedSessionRef.current = true;

      // Check if own analytics should be ignored (Beheerder / Admin mode)
      if (isOwnAnalyticsIgnored()) {
        console.log('[AnalyticsTracker] Skipping session start (Beheerder negeer-modus actief)');
        return;
      }

      // 2. Fetch City info (Fast geolocation)
      const geo = await getUserGeoLocation();
      const city = geo.city;
      const country = geo.country;

      // Log session start DIRECTLY to TransIP MySQL
      try {
        await transipPost('session_start', {
          sessionId,
          userAgent: ua,
          deviceType,
          referrer,
          city,
          country,
          lat: geo.lat,
          lng: geo.lng,
          landingPage: currentPathRef.current || '/'
        });
      } catch (err) {
        console.warn('[AnalyticsTracker] TransIP session_start error:', err);
      }

      // Optional fullstack Express dev ping
      try {
        fetch('/api/analytics/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            userAgent: ua,
            deviceType,
            referrer,
            city,
            country,
            path: currentPathRef.current
          })
        }).catch(() => {});
      } catch {}
    }

    // Initialize once on mount
    if (isFirstVisitOfSession) {
      initSession();
    } else {
      initializedSessionRef.current = true;
    }

    // 3. Periodic heartbeats (every 10s) DIRECTLY to TransIP MySQL
    const intervalTime = 10; // seconds
    const heartbeatTimer = setInterval(async () => {
      if (!sessionId || isOwnAnalyticsIgnored()) return;
      
      transipPost('session_heartbeat', {
        sessionId,
        currentPath: currentPathRef.current,
        pageStaySeconds: intervalTime
      }).catch(() => {});

      try {
        fetch('/api/analytics/session/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            currentPath: currentPathRef.current,
            pageStaySeconds: intervalTime
          })
        }).catch(() => {});
      } catch {}
    }, intervalTime * 1000);

    // 4. Global Interactive clicks DIRECTLY to TransIP MySQL
    const handleGlobalClick = async (e: MouseEvent) => {
      if (!sessionId || isOwnAnalyticsIgnored()) return;
      const target = e.target as HTMLElement;
      const clickableElement = target.closest('button, a, [role="button"], input[type="submit"]');
      if (clickableElement) {
        const text = (clickableElement.textContent || clickableElement.getAttribute('aria-label') || '').trim();
        const id = clickableElement.id || '';
        const tagName = clickableElement.tagName;

        if ((text && text.length < 100) || id) {
          transipPost('session_click', {
            sessionId,
            elementText: text.substring(0, 100),
            elementId: id,
            tagName,
            currentPath: currentPathRef.current
          }).catch(() => {});

          try {
            fetch('/api/analytics/session/click', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sessionId,
                elementText: text,
                elementId: id,
                tagName,
                currentPath: currentPathRef.current
              })
            }).catch(() => {});
          } catch {}
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);

    return () => {
      clearInterval(heartbeatTimer);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // 5. Track page transition view directly to TransIP MySQL
  useEffect(() => {
    const sessionId = sessionStorage.getItem('boeken_analytics_session_id');
    if (!sessionId || isOwnAnalyticsIgnored()) return;

    if (location.pathname === prevPathRef.current) {
      return;
    }
    prevPathRef.current = location.pathname;

    if (initializedSessionRef.current) {
      transipPost('session_pageview', {
        sessionId,
        pagePath: location.pathname,
        pageTitle: typeof document !== 'undefined' ? document.title : ''
      }).catch(() => {});
    }
  }, [location.pathname]);

  return null;
}
