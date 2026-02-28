(async function () {
  async function init() {
    try {
      const data = await window.api.fetch('/api/session');
      if (!data || !data.user) {
        window.location.assign('/public/index.html');
        return;
      }
      const user = data.user;
      const name = user.name || user.username || user.studentId || user.id || 'User';
      const userNameEl = document.getElementById('user-name');
      const userRoleEl = document.getElementById('user-role');
      const userCourseEl = document.getElementById('user-course');
      const avatarEl = document.getElementById('avatar');

      if (userNameEl) userNameEl.textContent = name;
      if (userRoleEl) userRoleEl.textContent = user.role || '';
      if (userCourseEl) userCourseEl.textContent = user.program || '';
      if (avatarEl) {
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=96`;
      }

      if (['rep','course_rep','rep_assistant','course_secretary','admin'].includes(user.role)) {
        document.querySelectorAll('.upload-link').forEach(e => e.style.display = 'block');
        const up = document.getElementById('upload'); if (up) up.style.display = 'block';
      }
      if (user.role === 'admin') {
        const a = document.getElementById('admin-link'); if (a) a.style.display = 'block';
      }

      await loadSlides();
    } catch (err) {
      window.location.assign('/public/index.html');
    }
  }

  async function loadSlides() {
    try {
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
            } catch {
              // optionally show a message
            }
          });
        });
        list.appendChild(li);
      });
    } catch {
      // optionally show a message
    }
  }

  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await window.api.fetch('/api/logout', { method: 'POST' });
    } catch {}
    window.location.assign('/public/index.html');
  });

  init();
})();