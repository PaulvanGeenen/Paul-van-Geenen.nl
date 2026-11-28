import { useEffect, useState } from 'react';

const ADMIN_PREVIEW_KEY = 'pvg_christmas_admin_preview';
const PREVIEW_EVENT = 'pvg-christmas-preview-changed';

/**
 * Returns true automatically from December 6 (after Sinterklaas)
 * through January 6 (Drie Koningen / Epiphany), inclusive.
 */
export function isChristmasSeason(date: Date = new Date()): boolean {
  const month = date.getMonth(); // 0 = Jan, 11 = Dec
  const day = date.getDate();
  if (month === 11 && day >= 6) return true;
  if (month === 0 && day <= 6) return true;
  return false;
}

export function getChristmasAdminPreview(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ADMIN_PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

export function setChristmasAdminPreview(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(ADMIN_PREVIEW_KEY, '1');
    } else {
      window.localStorage.removeItem(ADMIN_PREVIEW_KEY);
    }
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: { enabled } }));
}

export function useChristmasTheme() {
  const [isAdminPreview, setIsAdminPreview] = useState<boolean>(() => getChristmasAdminPreview());
  const [isSeason, setIsSeason] = useState<boolean>(() => isChristmasSeason());

  useEffect(() => {
    const sync = () => {
      setIsAdminPreview(getChristmasAdminPreview());
      setIsSeason(isChristmasSeason());
    };

    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<{ enabled?: boolean }>).detail;
      if (typeof detail?.enabled === 'boolean') {
        setIsAdminPreview(detail.enabled);
      } else {
        sync();
      }
    };

    window.addEventListener(PREVIEW_EVENT, onCustom);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, onCustom);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return {
    isActive: isSeason || isAdminPreview,
    isSeason,
    isAdminPreview,
  };
}
