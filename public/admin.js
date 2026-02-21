async function safeFetch(input, init) {
  const offline = (typeof window !== 'undefined' && (window.ADMIN_OFFLINE || (typeof navigator !== 'undefined' && navigator.onLine === false)));
  if (offline) {
    showAlert('You appear to be offline. Start the server or check your connection to continue.', 'info');
    return null;
  }
  try {
    if (typeof window !== 'undefined' && window.api && typeof window.api.fetch === 'function') {
      try {
        const data = await window.api.fetch(input, init);
        return {
          ok: true,
          json: async () => data,
        };
      } catch (err) {
        const data = err && err.data ? err.data : null;
        return {
          ok: false,
          json: async () => (data || {}),
        };
      }
    }
    const res = await fetch(input, init);
    return res;
  } catch (err) {
    showAlert('Cannot reach the server. Please check your connection and try again.', 'warning');
    return null;
  }
}async function init() {
  try {
    const s = await safeFetch('/api/session');
    if (!s) return;
    if (!s.ok) return window.location = '/';
    const { user } = await s.json();
    if (user.role !== 'admin') return document.body.innerHTML = '<div class="container mt-5 alert alert-danger">Access denied</div>';

    const res = await safeFetch('/api/admin/users');
    if (!res) return;
    const json = await res.json();
    if (!res.ok) return showAlert('Unable to load users');
    const tbody = document.getElementById('usersBody');
    tbody.innerHTML = '';
    json.users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${u.id}</td><td>${u.full_name || ''}</td><td>${u.email || ''}</td><td>${u.program || ''}</td><td>${u.classGroup || ''}</td><td>${u.course || ''}</td><td id="role-${u.id}">${u.role}</td>
        <td>
          <select id="select-${u.id}" class="form-select form-select-sm d-inline-block" style="width:160px;">
            <option value="student">student</option>
            <option value="course_rep">course_rep</option>
            <option value="rep_assistant">rep_assistant</option>
            <option value="course_secretary">course_secretary</option>
            <option value="admin">admin</option>
          </select>
          <button class="btn btn-sm btn-primary ms-2" onclick="promote('${u.id}')">Promote</button>
        </td>`;      tbody.appendChild(tr);
      const sel = document.getElementById(`select-${u.id}`);
      sel.value = u.role || 'student';
    });
  } catch (err) {
    showAlert('Unexpected error');
  }
}

function showAlert(msg, type='danger'){
  const a = document.getElementById('alert');
  a.className = `alert alert-${type}`;
  a.style.display = 'block';
  a.textContent = msg;
}

async function promote(id){
  const sel = document.getElementById(`select-${id}`);
  const role = sel.value;
  try{
    const res = await safeFetch('/api/admin/promote', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ studentId: id, role }) });
    if (!res) return;
    const json = await res.json();
    if (!res.ok) return showAlert(json.message || 'Failed');
    document.getElementById(`role-${id}`).textContent = role;
    showAlert('Role updated', 'success');
  }catch(e){ showAlert('Request failed'); }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    init();
  } catch (_) {
    // In file:// or offline scenarios, init may fail silently
  }

  const form = document.getElementById('importForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('csvfile');
      if (!fileInput || !fileInput.files || !fileInput.files.length) return showAlert('Choose a CSV file');
      const fd = new FormData();
      fd.append('file', fileInput.files[0]);
      try {
        const res = await safeFetch('/api/admin/import', { method: 'POST', body: fd });
        if (!res) return;
        const json = await res.json();
        if (!res.ok) return showAlert(json.message || 'Import failed');
        const resultEl = document.getElementById('importResult');
        if (resultEl) {
          resultEl.textContent = `Imported: ${json.imported}, Skipped: ${json.skipped}`;
        }
        showAlert('Import completed', 'success');
        // refresh user list
        init();
      } catch (err) {
        showAlert('Import failed');
      }
    });
  }

  // Handle slide upload with course
  const slideForm = document.getElementById('slideUploadForm');
  if (slideForm) {
    slideForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('slideFile');
      const courseInput = document.getElementById('slideCourse');
      if (!fileInput || !fileInput.files || !fileInput.files.length) return showAlert('Choose a slide file');
      const fd = new FormData();
      fd.append('file', fileInput.files[0]);
      if (courseInput && courseInput.value) {
        fd.append('course', courseInput.value);
      }
      try {
        let json;
        if (window.api && typeof window.api.fetch === 'function') {
          json = await window.api.fetch('/api/admin/slides/upload', { method: 'POST', body: fd });
        } else {
          const res = await safeFetch('/api/admin/slides/upload', { method: 'POST', body: fd });
          if (!res) return;
          json = await res.json().catch(() => ({}));
          if (!res.ok) return showAlert(json.message || 'Upload failed');
        }
        const resultEl = document.getElementById('uploadSlideResult');
        if (resultEl) {
          resultEl.textContent = json.message || 'Upload successful';
        }
        showAlert('Slide uploaded', 'success');
        slideForm.reset();
      } catch (err) {
        const data = err && err.data ? err.data : null;
        if (data && data.message) return showAlert(data.message);
        showAlert('Upload failed');
      }    });
  }
});