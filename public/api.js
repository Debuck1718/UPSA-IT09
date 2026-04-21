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
      console.warn("Push messaging is not supported");
      return;
    }

    try {
      const registration =
        await navigator.serviceWorker.register("/public/sw.js");
      console.log("Service Worker registered");

      // Wait for it to be active
      await navigator.serviceWorker.ready;

      // 1. Check for notification permission
      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        console.warn("Notification permission denied");
        return;
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const { publicKey } = await safeFetch("/api/notifications/vapid-key");

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        console.log("Acadex: New push subscription created");
      }

      await safeFetch("/api/notifications/save-subscription", {
        method: "POST",
        body: { subscription },
      });
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
