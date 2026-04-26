(function () {
  const form = document.getElementById('signupForm');
  const alertBox = document.getElementById('alert');
  const instSelect = document.getElementById('institution');
  const otherInput = document.getElementById('otherInstitution');

  // UI Toggle for "Other" institution
  instSelect?.addEventListener('change', () => {
    if (instSelect.value === 'other') {
      otherInput.classList.remove('d-none');
      otherInput.required = true;
      otherInput.focus();
    } else {
      otherInput.classList.add('d-none');
      otherInput.required = false;
      otherInput.value = '';
    }
  });

  function showAlert(msg, isSuccess = false) {
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.className = `alert ${isSuccess ? 'alert-success' : 'alert-danger'} shadow-sm border-0 animate__animated animate__fadeIn`;
    alertBox.classList.remove('d-none');
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    alertBox?.classList.add('d-none');

    const btn = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Validation
    if (data.password !== data.confirmPassword) {
      return showAlert('Passwords do not match.');
    }
    if (data.password.length < 6) {
      return showAlert('Password must be at least 6 characters.');
    }

    // Resolve Institution Value: Use 'other' text if selected
    const finalInstitution = data.institution === 'other' ? data.otherInstitution : data.institution;

    if (!finalInstitution) {
      return showAlert('Please select or enter your institution.');
    }

    const payload = {
      studentId: data.studentId.trim(),
      full_name: data.full_name.trim(),
      email: data.email.trim(),
      password: data.password,
      program: data.program.trim(),
      classGroup: data.classGroup.trim(),
      institutionId: finalInstitution, // Matches your db_pg.js param name
      academicYearStart: Number(data.academicYearStart)
    };

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Creating account...`;

    try {
      // Passing raw object - window.api.fetch handles stringification
      const resp = await window.api.fetch('/api/signup', {
        method: 'POST',
        body: payload 
      });

      if (resp && (resp.ok || resp.id)) {
        showAlert('Account created! Redirecting...', true);
        setTimeout(() => {
          window.location.assign('/dashboard-modern.html');
        }, 1200);
      } else {
        throw new Error(resp.message || 'Signup failed');
      }
    } catch (err) {
      showAlert(err.message || 'Connection error. Please try again.');
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  });
})();