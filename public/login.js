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

  // FIXED: Simplified to use the api.js wrapper properly
  async function login(studentId, password) {
    // We pass a raw object; window.api.fetch handles JSON.stringify and Headers
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

    // Visual feedback
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Signing in...`;

    try {
      const data = await login(studentId, password);
      
      if (data && data.user) {
        const role = data.user.role;
        
        // Logical redirection based on your platform roles
        let redirect = '';
        if (role === 'admin') {
          redirect = '/public/admin.html';
        } else if (role === 'rep') {
          redirect = '/public/rep-dashboard.html'; // Matches your file structure
        } else {
          redirect = '/public/dashboard-modern.html';
        }

        window.location.assign(redirect);
      } else {
        throw new Error(data.message || 'Invalid credentials');
      }
    } catch (err) {
      // The api.js catch block usually passes the server's {message}
      showAlert(err.message || 'Login failed. Check your ID/Password.');
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
})();