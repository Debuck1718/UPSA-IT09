const API_BASE = 'http://localhost:3000';

async function init() {
  try {
    const session = await fetch(`${API_BASE}/api/session`);
    if (!session.ok) return window.location = `${API_BASE}/`;
    const { user } = await session.json();
    document.getElementById('user-name').textContent = user.name || user.username || user.id;
    document.getElementById('user-role').textContent = user.role;
    document.getElementById('user-course').textContent = user.course;
    document.getElementById('avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.username || user.id)}&background=6366f1&color=fff&size=96`;

    if (['course_rep','rep_assistant','course_secretary','admin'].includes(user.role)) {
      document.querySelectorAll('.upload-link').forEach(e => e.style.display = 'block');
      const up = document.getElementById('upload'); if (up) up.style.display = 'block';
    }
    if (user.role === 'admin') {
      const a = document.getElementById('admin-link'); if (a) a.style.display = 'block';
    }

    // load slides
    await loadSlides();
  } catch (err) {
    window.location = `${API_BASE}/`;
  }
}

async function loadSlides() {
  const res = await fetch(`${API_BASE}/api/slides`);
  if (!res.ok) return;
  const { slides } = await res.json();
  const list = document.getElementById('slidesList');
  list.innerHTML = '';
  if (slides.length === 0) {
    list.innerHTML = '<li class="list-group-item">No slides uploaded yet for your course.</li>';
    return;
  }
  slides.forEach(s => {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    li.innerHTML = `<div><i class="bi bi-file-earmark-text" style="color:#6366f1;font-size:1.3rem;"></i>
      <span class="fw-semibold">${s.originalname}</span>
      <span class="badge bg-info text-dark ms-2">Shared by ${s.uploaded_by}</span></div>
      <a class="btn btn-success btn-sm px-4" href="/download/${s.filename}">Download</a>`;
    list.appendChild(li);
  });
}

// logout
document.getElementById('logoutBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch(`${API_BASE}/api/logout`, { method: 'POST' });
  window.location = `${API_BASE}/`;
});

// init
init();