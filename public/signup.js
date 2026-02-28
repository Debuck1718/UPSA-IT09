(function () {
  const form = document.getElementById('signupForm');
  const alertBox = document.getElementById('alert');

  function showError(msg) {
    if (!alertBox) return;
    alertBox.textContent = msg || 'Signup failed';
    alertBox.className = 'alert alert-danger';
    alertBox.classList.remove('d-none');
    alertBox.style.display = 'block';
  }
  function showSuccess(msg) {
    if (!alertBox) return;
    alertBox.textContent = msg || 'Account created successfully.';
    alertBox.className = 'alert alert-success';
    alertBox.classList.remove('d-none');
    alertBox.style.display = 'block';
  }
  function clearAlert() {
    if (!alertBox) return;
    alertBox.textContent = '';
    alertBox.classList.add('d-none');
    alertBox.style.display = 'none';
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const studentId = (document.getElementById('studentId')?.value || '').trim();
    const full_name = (document.getElementById('full_name')?.value || '').trim();
    const email = (document.getElementById('email')?.value || '').trim();
    const program = (document.getElementById('program')?.value || '').trim();
    const classGroup = (document.getElementById('classGroup')?.value || '').trim();
    const academicYearStartStr = (document.getElementById('academicYearStart')?.value || '').trim();
    const password = document.getElementById('password')?.value || '';
    const confirm = document.getElementById('confirmPassword')?.value || '';

    if (!studentId || !full_name || !email || !program || !classGroup || !academicYearStartStr || !password || !confirm) {
      return showError('Please complete all required fields.');
    }
    if (password !== confirm) {
      return showError('Passwords do not match.');
    }

    const yearNum = Number(academicYearStartStr);
    const nowYear = new Date().getFullYear();
    if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > nowYear + 1) {
      return showError('Please enter a valid Academic Year Start (e.g., 2024).');
    }

    const payload = { studentId, full_name, email, password, program, classGroup, academicYearStart: yearNum };

    try {
      const resp = await window.api.fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (resp && resp.ok) {
        showSuccess('Account created. Redirecting to login...');
        setTimeout(() => (window.location.href = '/public/index.html'), 800);
      } else {
        showError((resp && resp.message) || 'Signup failed');
      }
    } catch (err) {
      showError(err.message || 'Signup failed. Please try again.');
    }
  });
})();