const IS_FILE = location.protocol === 'file:';
const IS_LIVE_SERVER = location.host.includes('127.0.0.1:5500') || location.host.includes('127.0.0.1:5501') || location.host.includes('localhost:5500') || location.host.includes('localhost:5501');
const API_BASE = (IS_FILE || IS_LIVE_SERVER) ? 'http://localhost:3000' : '';

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
    let res;
    try {
      if (IS_FILE || IS_LIVE_SERVER) {
        showAlert('Tip: If login fails from file:// or Live Server, open http://localhost:3000/public/index.html so it is same-origin with the API.');
      }
      res = await fetch(API_BASE + '/api/login', {
        method: 'POST',
        mode: (IS_FILE || IS_LIVE_SERVER) ? 'cors' : 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ studentId, password })
      });
    } catch (e) {
      throw new Error('Unable to reach the server. Make sure the backend is running.');
    }

    let text = '';
    try { text = await res.text(); } catch (_) {}

    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) {}

    if (!res.ok) {
      let serverMsg = (body && (body.message || body.error)) || text || 'Login failed';
      if (res.status === 400) serverMsg = (body && (body.message || body.error)) || 'Please enter your Student ID and Password.';
      if (res.status === 401) serverMsg = (body && (body.message || body.error)) || 'Incorrect Student ID or Password.';
      if (res.status === 403) {
        serverMsg = (body && (body.message || body.error)) || 'Access forbidden. Please contact support if this persists.';
      }      throw new Error(serverMsg);
    }

    return body || {};
  }
  if (form) {
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
        let redirect = data && data.redirect ? data.redirect : ((data && data.user && data.user.role === 'rep') ? '/rep-dashboard' : '/dashboard');
        if (!/^https?:\/\//i.test(redirect)) {
          redirect = '/' + redirect.replace(/^\/+/, '');
        }
        window.location = redirect;      } catch (err) {
        const msg = (err && err.message) ? err.message : 'Unable to reach the server. Make sure the backend is running on http://localhost:3000';
        const needsVerification = /verify.*email/i.test(msg) || /email.*verify/i.test(msg);
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
              const res = await fetch(API_BASE + '/api/resend-verification', {
                method: 'POST',
                mode: (IS_FILE || IS_LIVE_SERVER) ? 'cors' : 'same-origin',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ studentId })
              });
              const ok = res.ok;
              let payload = {};
              try { payload = await res.json(); } catch (_) {}
              if (!ok) {
                const errMsg = (payload && payload.message) ? payload.message : 'Failed to resend verification email.';
                throw new Error(errMsg);
              }
              const successMsg = (payload && payload.message) ? payload.message : 'Verification email sent. Please check your inbox.';
              showAlert(successMsg);
            } catch (e) {
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