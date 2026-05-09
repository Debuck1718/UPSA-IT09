(function (global) {
  // --- CONFIGURATION ---
  const isProd =
    location.hostname === "evantrahub.me" ||
    location.hostname.endsWith("onrender.com") ||
    location.protocol === "https:";

  const API_BASE = isProd ? location.origin : "http://localhost:3000";

  // Helper: Convert VAPID key for the browser
  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // --- CORE FETCH ENGINE ---
  async function safeFetch(path, opts = {}) {
    const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = { Accept: "application/json", ...(opts.headers || {}) };

    if (opts.body && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }

    const fetchOpts = {
      credentials: "include",
      method: opts.method || "GET",
      ...opts,
      headers: headers,
    };

    console.debug(`[API] ${fetchOpts.method} ${url}`);

    const res = await fetch(url, fetchOpts);

    let data = null;
    try {
      const text = await res.clone().text();
      data = text ? JSON.parse(text) : null;
    } catch (_) {}

    // Handle session expiration (auto-redirect)
    if (res.status === 401) {
        window.location.assign('/index.html');
        return;
    }

    if (!res.ok || (data && data.ok === false)) {
      const msg =
        (data && (data.message || data.error)) || `Error ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // --- EVANTRAHUB PUSH NOTIFICATION LOGIC ---
  async function initPushNotifications(options = {}) {
    const { prompt = false } = options || {};
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const serviceWorker = await navigator.serviceWorker.ready;

      let permission = Notification.permission;
      if (permission === "default") {
        if (!prompt) {
          console.info("Evantrahub push: permission not requested until user interaction.");
          return false;
        }
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        console.warn("Evantrahub push: permission not granted", permission);
        return false;
      }

      let subscription = await serviceWorker.pushManager.getSubscription();

      if (!subscription) {
        const res = await safeFetch("/api/notifications/vapid-key");
        if (!res || !res.publicKey) throw new Error("VAPID key not found");

        subscription = await serviceWorker.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(res.publicKey),
        });
      }

      await safeFetch("/api/notifications/save-subscription", {
        method: "POST",
        body: { subscription },
      });

      console.log("Evantrahub: Push Registration Successful");
      return true;
    } catch (err) {
      console.error("Evantrahub Notification Setup Failed:", err);
      return false;
    }
  }

 
  async function getMyCurriculum() {
    return safeFetch("/api/my-program-courses");
  }

  /**
   * Fetches verified/compiled PDFs (Master Vault) for a course
   */
  async function getMasterResources(courseId) {
    return safeFetch(`/api/resources?courseId=${courseId}&master=true`);
  }

  // --- EXPORTS ---
  global.api = {
    fetch: safeFetch,
    get: (path, opts) => safeFetch(path, { ...opts, method: "GET" }),
    post: (path, body, opts) =>
      safeFetch(path, { ...opts, method: "POST", body }),
    unsubscribePush: () => safeFetch("/api/notifications/unsubscribe", { method: "POST" }),
    
    // Domain Specific Logic
    getCurriculum: getMyCurriculum,
    getMasterVault: getMasterResources,
    
    initPush: initPushNotifications,
  };
})(window);
