(function (global) {
  const isProd = location.hostname.endsWith('onrender.com') || location.protocol === 'https:';
  const API_BASE = isProd ? '' : 'http://localhost:3000';

  async function safeFetch(path, opts = {}) {
    const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
    
    // Initialize headers
    const headers = { 'Accept': 'application/json', ...(opts.headers || {}) };

    if (opts.body && !(opts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, {
      credentials: 'include',
      ...opts,
      headers: headers
    });

    let data = null;
    try { 
      const text = await res.clone().text();
      data = text ? JSON.parse(text) : null; 
    } catch (_) {}

    if (!res.ok || (data && data.ok === false)) {
      const msg = (data && (data.message || data.error)) || `Error ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  global.api = { fetch: safeFetch };
})(window);