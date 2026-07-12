(function () {
  const form = document.getElementById('loginForm');
  const alertEl = document.getElementById('alert');

  function showAlert(msg) {
    if (!alertEl) return;
    alertEl.textContent = msg || 'Login failed';
    alertEl.className = 'alert alert-danger shadow-sm border-0 animate__animated animate__shakeX';
    alertEl.classList.remove('d-none');
    alertEl.style.display = 'block';
  }

  function hideAlert() {
    if (!alertEl) return;
    alertEl.classList.add('d-none');
    alertEl.style.display = 'none';
  }

  async function login(studentId, password) {
    return await window.api.fetch('/api/login', {
      method: 'POST',
      body: { studentId, password } 
    });
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

    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Signing in...`;

    try {
      const data = await login(studentId, password);
      
      if (data && data.user) {
        const role = data.user.role;
        let redirect = role === 'admin' ? '/admin.html' : 
                       role === 'rep' ? '/rep-dashboard.html' : 
                       '/dashboard-modern.html';
        window.location.assign(redirect);
      } else {
        throw new Error(data.message || 'Invalid credentials');
      }
    } catch (err) {
      // SECURITY: Log the real technical error to the console for you
      console.error("DEBUG: Login error details:", err.message);

      // SECURITY: Show the user a generic, friendly message
      const userFriendlyMessage = 'Invalid Student ID or Password. Please double-check your credentials.';
      
      showAlert(userFriendlyMessage);
      
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
})();