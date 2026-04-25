(function (global) {
  const isProd =
    location.hostname.endsWith("onrender.com") ||
    location.protocol === "https:";
  const API_BASE = isProd ? "" : "http://localhost:3000";

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

  async function safeFetch(path, opts = {}) {
    const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = { Accept: "application/json", ...(opts.headers || {}) };

    if (opts.body && !(opts.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(opts.body);
    }

    const res = await fetch(url, {
      credentials: "include",
      ...opts,
      headers: headers,
    });

    let data = null;
    try {
      const text = await res.clone().text();
      data = text ? JSON.parse(text) : null;
    } catch (_) {}

    if (!res.ok || (data && data.ok === false)) {
      const msg =
        (data && (data.message || data.error)) || `Error ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // --- Acadex Push Notification Logic ---
  async function initPushNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    try {
      // FIX 1: Ensure the path is correct relative to your domain root
      const registration = await navigator.serviceWorker.register("/sw.js");
      
      // Wait for it to be ready
      const serviceWorker = await navigator.serviceWorker.ready;

      // 1. Request Permission
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") return;

      // 2. Get/Create Subscription
      let subscription = await serviceWorker.pushManager.getSubscription();

      if (!subscription) {
        const res = await safeFetch("/api/notifications/vapid-key");
        if (!res || !res.publicKey) throw new Error("VAPID key not found");

        subscription = await serviceWorker.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(res.publicKey),
        });
      }

      // 3. Save to Database
      // Only send to server if we have a valid subscription object
      await safeFetch("/api/notifications/save-subscription", {
        method: "POST",
        body: { subscription }, // This matches your users_app 'push_subscription' jsonb column
      });

      console.log("Acadex: Push Registration Successful");
    } catch (err) {
      console.error("Acadex Notification Setup Failed:", err);
    }
  }


  // Export to global scope
  global.api = {
    fetch: safeFetch,
    get: (path, opts) => safeFetch(path, { ...opts, method: "GET" }),
    post: (path, body, opts) =>
      safeFetch(path, { ...opts, method: "POST", body }),
    initPush: initPushNotifications,
  };
})(window);
