(function () {
  const form = document.getElementById('loginForm');
  const alertEl = document.getElementById('alert');

  function showAlert(msg) {
    if (!alertEl) return;
    alertEl.textContent = msg || 'Login failed';
    alertEl.className = 'alert alert-danger';
    alertEl.classList.remove('d-none');
    alertEl.style.display = 'block';
  }
  function hideAlert() {
    if (!alertEl) return;
    alertEl.textContent = '';
    alertEl.classList.add('d-none');
    alertEl.style.display = 'none';
  }

  async function login(studentId, password) {
    const body = await window.api.fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ studentId, password })
    });
    return body || {};
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const studentId = (document.getElementById('studentId')?.value || '').trim();
    const password = document.getElementById('password')?.value || '';
    if (!studentId || !password) {
      showAlert('Please fill in both Student ID and Password.');
      return;
    }
    try {
      const data = await login(studentId, password);
      const role = data?.user?.role || '';
      // Prefer server-provided redirect; ensure same-origin path
      let redirect = (typeof data?.redirect === 'string') ? data.redirect.trim() : '';
      try {
        if (!redirect || redirect.startsWith('//') || /^javascript:/i.test(redirect)) {
          redirect = '';
        } else if (/^https?:\/\//i.test(redirect)) {
          const u = new URL(redirect);
          if (u.origin === window.location.origin && !/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(u.host)) {
            redirect = u.pathname + u.search + u.hash;
          } else {
            redirect = '';
          }
        } else {
          redirect = '/' + redirect.replace(/^\/+/, '');
        }
      } catch {
        redirect = '';
      }
      if (!redirect) {
        redirect = role === 'admin' ? '/public/admin.html'
          : role === 'rep' ? '/rep-dashboard'
          : '/dashboard';
      }
      window.location.assign(redirect);
    } catch (err) {
      showAlert(err.message || 'Login failed. Please try again.');
    }
  });
})();