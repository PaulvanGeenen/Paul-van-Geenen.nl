export const isLionBooksDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const host = window.location.hostname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const isHost = host.includes('lionbooks');
    const isSearch = search.includes('source=lionbooks') || search.includes('ref=lionbooks') || search.includes('lionbooks');
    if (isHost || isSearch) {
      sessionStorage.setItem('pv_is_lionbooks', '1');
      return true;
    }
    return sessionStorage.getItem('pv_is_lionbooks') === '1';
  } catch (e) {
    return false;
  }
};

export const getCurrentDomainLabel = (): string => {
  if (typeof window === 'undefined') return 'paulvangeenen.nl';
  return isLionBooksDomain() ? 'lionbooks.nl' : 'paulvangeenen.nl';
};

export const getCurrentDomainUrl = (): string => {
  if (typeof window === 'undefined') return 'https://paulvangeenen.nl';
  return isLionBooksDomain() ? 'https://lionbooks.nl' : 'https://paulvangeenen.nl';
};
