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
