document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert');

  function showAlert(msg, type = 'danger') {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.style.display = 'block';
    alertBox.textContent = msg;
  }

  async function requireAdminSession() {
    try {
      const data = await window.api.fetch('/api/session');
      if (!data || !data.user || data.user.role !== 'admin') {
        document.body.innerHTML = '<div class="container mt-5 alert alert-danger">Access denied</div>';
        throw new Error('Not admin');
      }
      return data.user;
    } catch (e) {
      window.location.href = '/public/index.html';
      throw e;
    }
  }

  // --- Users search/edit feature ---
  const usersBody = document.getElementById('usersBody');
  const userSearch = document.getElementById('userSearch');
  const editModalEl = document.getElementById('editUserModal');
  const editModal = (editModalEl && window.bootstrap) ? new bootstrap.Modal(editModalEl) : null;

  const editStudentId = document.getElementById('editStudentId');
  const editRole = document.getElementById('editRole');
  const editProgram = document.getElementById('editProgram');
  const editYear = document.getElementById('editYear');
  const editClassGroup = document.getElementById('editClassGroup');
  const editUserResult = document.getElementById('editUserResult');
  const saveUserBtn = document.getElementById('saveUserBtn');

  let allUsers = [];

  async function fetchUsers() {
    try {
      const res = await window.api.fetch('/api/admin/users', { method: 'GET' });
      return Array.isArray(res) ? res : (Array.isArray(res.users) ? res.users : []);
    } catch (e) {
      console.warn('Failed to fetch users', e);
      return [];
    }
  }

  function renderUsersTable(items) {
    if (!usersBody) return;
    usersBody.innerHTML = '';
    items.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${u.student_id || u.studentId || u.id || ''}</td>
        <td>${u.full_name || u.name || ''}</td>
        <td class="d-none d-md-table-cell">${u.email || ''}</td>
        <td class="d-none d-md-table-cell">${u.program || ''}</td>
        <td class="d-none d-md-table-cell">${u.class_group || u.classGroup || ''}</td>
        <td>${u.role || ''}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-id="${u.student_id || u.studentId}">Edit</button>
        </td>
      `;
      usersBody.appendChild(tr);
    });

    usersBody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sid = btn.getAttribute('data-id');
        const u = allUsers.find(x => (x.student_id || x.studentId) === sid);
        if (!u || !editModal) return;
        editStudentId.value = u.student_id || u.studentId || '';
        editRole.value = u.role || '';
        editProgram.value = u.program || '';
        editYear.value = '';
        editClassGroup.value = u.class_group || u.classGroup || '';
        if (editUserResult) {
          editUserResult.textContent = '';
          editUserResult.className = 'small';
        }
        editModal.show();
      });
    });
  }

  function filterUsers(q) {
    const term = (q || '').toString().toLowerCase();
    if (!term) return allUsers;
    return allUsers.filter(u => {
      const fields = [
        u.student_id || u.studentId || '',
        u.full_name || u.name || '',
        u.email || '',
        u.program || '',
        u.class_group || u.classGroup || ''
      ].map(x => (x || '').toString().toLowerCase());
      return fields.some(f => f.includes(term));
    });
  }

  userSearch?.addEventListener('input', () => {
    const filtered = filterUsers(userSearch.value);
    renderUsersTable(filtered);
  });

  saveUserBtn?.addEventListener('click', async () => {
    if (!editStudentId?.value) return;
    const sid = editStudentId.value;
    if (editUserResult) {
      editUserResult.textContent = '';
      editUserResult.className = 'small';
    }

    try {
      // Update role if provided
      const role = (editRole?.value || '').trim();
      if (role) {
        await window.api.fetch(`/api/admin/users/${encodeURIComponent(sid)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role })
        });
      }
      // Update cohort/class if provided
      const payload = {};
      if (editProgram?.value) payload.program = editProgram.value.trim();
      if (editYear?.value) payload.academicYearStart = Number(editYear.value);
      if (editClassGroup?.value) payload.classGroup = editClassGroup.value.trim();

      if (Object.keys(payload).length) {
        await window.api.fetch(`/api/admin/users/${encodeURIComponent(sid)}/update-cohort`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (editUserResult) {
        editUserResult.textContent = 'Saved.';
        editUserResult.className = 'small text-success';
      }

      // Refresh table
      allUsers = await fetchUsers();
      renderUsersTable(filterUsers(userSearch?.value || ''));
      setTimeout(() => editModal?.hide(), 700);
    } catch (e) {
      if (editUserResult) {
        editUserResult.textContent = e.message || 'Update failed.';
        editUserResult.className = 'small text-danger';
      }
    }
  });

  // CSV Import
  const importForm = document.getElementById('importForm');
  if (importForm) {
    importForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('csvfile');
      if (!fileInput || !fileInput.files || !fileInput.files.length) return showAlert('Choose a CSV file');
      const fd = new FormData();
      fd.append('file', fileInput.files[0]);
      try {
        const json = await window.api.fetch('/api/admin/import', { method: 'POST', body: fd });
        const resultEl = document.getElementById('importResult');
        if (resultEl) {
          resultEl.textContent = `Imported: ${json.imported || 0}, Skipped: ${json.skipped || 0}`;
        }
        showAlert('Import completed', 'success');
        // refresh user list
        allUsers = await fetchUsers();
        renderUsersTable(filterUsers(userSearch?.value || ''));
      } catch (err) {
        const msg = (err && err.message) || 'Import failed';
        showAlert(msg);
      }
    });
  }

  // Slide upload (admin helper) — uses /api/upload
  const slideForm = document.getElementById('slideUploadForm');
  if (slideForm) {
    slideForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('slideFile');
      const courseInput = document.getElementById('courseName');
      const slideTitleInput = document.getElementById('repSlideTitle') || document.getElementById('slideTitle');
      if (!fileInput || !fileInput.files || !fileInput.files.length) return showAlert('Choose a slide file');
      const fd = new FormData(slideForm);
      // ensure courseTitle and slideTitle are present
      if (courseInput && !fd.get('courseTitle') && courseInput.value) fd.set('courseTitle', courseInput.value);
      if (slideTitleInput && slideTitleInput.value) fd.set('slideTitle', slideTitleInput.value);
      try {
        await window.api.fetch('/api/upload', { method: 'POST', body: fd });
        const resultEl = document.getElementById('uploadSlideResult');
        if (resultEl) resultEl.textContent = 'Uploaded successfully.';
        showAlert('Slide uploaded', 'success');
        slideForm.reset();
      } catch (err) {
        const msg = (err && err.message) || 'Upload failed';
        showAlert(msg);
      }
    });
  }

  // Initial load
  try {
    await requireAdminSession();
    allUsers = await fetchUsers();
    renderUsersTable(filterUsers(''));
  } catch (e) {
    // already redirected or message shown
  }
});