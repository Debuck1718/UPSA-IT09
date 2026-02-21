(function (global) {
  const isFile = location.protocol === 'file:';
  const isLiveServer =
    location.host.includes('127.0.0.1:5500') ||
    location.host.includes('127.0.0.1:5501') ||
    location.host.includes('localhost:5500') ||
    location.host.includes('localhost:5501');
  const isProd = location.hostname.endsWith('onrender.com') || location.protocol === 'https:';

  const API_BASE = isProd ? '' : ((isFile || isLiveServer) ? 'http://localhost:3000' : '');

  async function safeFetch(path, opts = {}) {
    const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Accept': 'application/json', ...(opts.headers || {}) },
      ...opts
    });
    let data = null;
    try { data = await res.clone().json(); } catch (_) {}
    if (!res.ok || (data && data.ok === false)) {
      const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data ?? res.json();
  }

  global.api = {
    base: () => API_BASE,
    fetch: safeFetch
  };
})(window);