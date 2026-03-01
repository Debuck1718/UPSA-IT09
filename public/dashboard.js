(function () {
  async function ensureStudentSession() {
    const data = await window.api.fetch('/api/session');
    if (!data || !data.user) {
      window.location.assign('/public/index.html');
      throw new Error('No session');
    }
    const user = data.user;
    // Route non-students to their dashboards immediately to avoid loops
    if (user.role === 'admin') {
      window.location.assign('/public/admin.html');
      throw new Error('Admin redirected');
    }
    if (user.role === 'rep') {
      window.location.assign('/rep-dashboard');
      throw new Error('Rep redirected');
    }
    return user;
  }

  async function loadSlides() {
    const data = await window.api.fetch('/api/slides');
    const slides = Array.isArray(data.slides) ? data.slides : [];
    const list = document.getElementById('slidesList');
    if (!list) return;
    list.innerHTML = '';
    if (!slides.length) {
      list.innerHTML = '<li class="list-group-item">No slides uploaded yet for your class.</li>';
      return;
    }
    slides.forEach(s => {
      const id = s.id;
      const title = s.originalName || s.original_name || s.slideTitle || s.slide_title || s.filename || 'Slide';
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `
        <div><i class="bi bi-file-earmark-text" style="color:#6366f1;font-size:1.3rem;"></i>
          <span class="fw-semibold">${title}</span>
        </div>
        <div class="btn-group">
          <button class="btn btn-success btn-sm px-3" data-action="download" data-id="${id}">Download</button>
          <button class="btn btn-outline-secondary btn-sm px-3" data-action="view" data-id="${id}">View</button>
        </div>
      `;
      li.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const slideId = btn.getAttribute('data-id');
            const resp = await window.api.fetch(`/api/slides/${encodeURIComponent(slideId)}/url`);
            const url = resp.url;
            if (btn.getAttribute('data-action') === 'view') {
              window.open(url, '_blank');
            } else {
              const a = document.createElement('a');
              a.href = url;
              a.download = '';
              document.body.appendChild(a);
              a.click();
              a.remove();
            }
          } catch {}
        });
      });
      list.appendChild(li);
    });
  }

  function wireUpload() {
    const form = document.getElementById('uploadForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      try {
        await window.api.fetch('/api/upload', { method: 'POST', body: fd });
        await loadSlides();
        form.reset();
      } catch {}
    });
  }

  async function init() {
    try {
      const user = await ensureStudentSession();
      const name = user.name || user.username || user.studentId || user.id || 'User';
      const role = user.role || '';
      document.getElementById('user-name')?.append(name);
      document.getElementById('user-role')?.append(role);
      document.getElementById('user-course')?.append(user.program || '');
      const avatar = document.getElementById('avatar');
      if (avatar) avatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=96`;

      await loadSlides();
      wireUpload();
    } catch {
      // redirected or no session; nothing else to do
    }
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await window.api.fetch('/api/logout', { method: 'POST' }); } catch {}
    window.location.assign('/public/index.html');
  });

  init();
})();