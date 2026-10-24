const configuredApiOrigin = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export function apiUrl(path = '') {
  if (!configuredApiOrigin || !path.startsWith('/api')) return path;
  return `${configuredApiOrigin}${path}`;
}

export function installApiFetch() {
  if (!configuredApiOrigin || window.__rpsApiFetchInstalled) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string') return nativeFetch(apiUrl(input), init);

    if (input instanceof Request) {
      const requestUrl = new URL(input.url, window.location.origin);
      if (requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/api')) {
        return nativeFetch(new Request(apiUrl(`${requestUrl.pathname}${requestUrl.search}`), input), init);
      }
    }

    return nativeFetch(input, init);
  };

  window.__rpsApiFetchInstalled = true;
}

export const apiOrigin = configuredApiOrigin || window.location.origin;
