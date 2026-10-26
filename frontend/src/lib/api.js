import {invalidateScreenData} from './screenData';
const configuredApiOrigin = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');

export function apiUrl(path = '') {
  if (!configuredApiOrigin || !path.startsWith('/api')) return path;
  return `${configuredApiOrigin}${path}`;
}

export function installApiFetch() {
  if (window.__rpsApiFetchInstalled) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const original=input;
    if (typeof input === 'string') input=apiUrl(input);

    if (input instanceof Request) {
      const requestUrl = new URL(input.url, window.location.origin);
      if (requestUrl.origin === window.location.origin && requestUrl.pathname.startsWith('/api')) {
        input=new Request(apiUrl(`${requestUrl.pathname}${requestUrl.search}`), input);
      }
    }

    const requestUrl=new URL(typeof original==='string'?original:original instanceof URL?original.href:original.url,window.location.origin);
    const method=(init?.method || (original instanceof Request?original.method:'GET')).toUpperCase();
    const mutation=requestUrl.pathname.startsWith('/api/') && ['POST','PUT','PATCH','DELETE'].includes(method)
      && [window.location.origin,configuredApiOrigin].includes(requestUrl.origin);
    if(mutation)invalidateScreenData();
    const response=await nativeFetch(input, init);
    if(mutation && response.ok)invalidateScreenData();
    return response;
  };

  window.__rpsApiFetchInstalled = true;
}

export const apiOrigin = configuredApiOrigin || window.location.origin;
