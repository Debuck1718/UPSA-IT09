const IS_FILE = location.protocol === 'file:';
const IS_LIVE_SERVER = location.host.includes('127.0.0.1:5500') || location.host.includes('127.0.0.1:5501') || location.host.includes('localhost:5500') || location.host.includes('localhost:5501');
const API_BASE = (window.api && typeof window.api.base === 'function')
  ? window.api.base()
  : ((IS_FILE || IS_LIVE_SERVER) ? 'http://localhost:3000' : '');
(function () {
  const form = document.getElementById('loginForm');
  const alertEl = document.getElementById('alert');

  function showAlert(msg) {
    if (!alertEl) return;
    alertEl.textContent = msg;
    alertEl.style.display = 'block';
  }

  function hideAlert() {
    if (!alertEl) return;
    alertEl.textContent = '';
    alertEl.style.display = 'none';
  }

  async function login(studentId, password) {
    try {
      if (IS_FILE || IS_LIVE_SERVER) {
        showAlert('Tip: If login fails from file:// or Live Server, open http://localhost:3000/public/index.html so it is same-origin with the API.');
      }
      const body = await window.api.fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ studentId, password })
      });
      return body || {};
    } catch (e) {
      const msg = (e && e.message) ? e.message : 'Unable to reach the server. Make sure the backend is running.';
      throw new Error(msg);
    }
  }  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();

      const studentIdInput = document.getElementById('studentId');
      const passwordInput = document.getElementById('password');
      const studentId = (studentIdInput && studentIdInput.value ? studentIdInput.value : '').trim();
      const password = passwordInput && passwordInput.value ? passwordInput.value : '';

      if (!studentId || !password) {
        showAlert('Please fill in both Student ID and Password.');
        return;
      }

      try {
        const data = await login(studentId, password);
        const role = (data && data.user && data.user.role) ? data.user.role : '';
        const fallback = role === 'rep' ? '/rep-dashboard' : '/dashboard';
        let redirect = (data && typeof data.redirect === 'string') ? data.redirect.trim() : '';

        try {
          // Reject dangerous or cross-origin redirects and anything pointing to localhost
          if (!redirect || redirect.startsWith('//') || /^javascript:/i.test(redirect)) {
            redirect = '';
          } else if (/^https?:\/\//i.test(redirect)) {
            const u = new URL(redirect);
            const isLocalhost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u.host);
            const sameOrigin = u.origin === window.location.origin;
            if (sameOrigin && !isLocalhost) {
              redirect = u.pathname + u.search + u.hash;
            } else {
              redirect = '';
            }
          } else {
            redirect = '/' + redirect.replace(/^\/+/, '');
          }
        } catch (_) {
          redirect = '';
        }

        if (!redirect) {
          redirect = fallback;
        }

        window.location.assign(redirect);      } catch (err) {        const msg = (err && err.message) ? err.message : 'Unable to reach the server. Make sure the backend is running on http://localhost:3000';        const needsVerification = /verify.*email/i.test(msg) || /email.*verify/i.test(msg);
        if (needsVerification && alertEl) {
          alertEl.innerHTML = '';
          const span = document.createElement('span');
          span.textContent = msg + ' ';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.id = 'resendVerification';
          btn.textContent = 'Resend verification email';
          btn.style.marginLeft = '4px';
          btn.addEventListener('click', async () => {
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Sending...';
            try {
              const payload = await window.api.fetch('/api/resend-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ studentId })
              });
              const successMsg = (payload && payload.message) ? payload.message : 'Verification email sent. Please check your inbox.';
              showAlert(successMsg);            } catch (e) {
              const errMsg = (e && e.message) ? e.message : 'Could not resend verification email. Please try again later.';
              showAlert(errMsg);
            } finally {
              btn.disabled = false;
              btn.textContent = originalText;
            }
          });
          alertEl.appendChild(span);
          alertEl.appendChild(btn);
          alertEl.style.display = 'block';
        } else {
          showAlert(msg);
        }      }    });
  }
})();