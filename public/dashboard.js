console.log('dashboard.js loaded');

function debugLog(msg, ...args) {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log(msg, ...args);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  debugLog('DOM fully loaded');

  async function ensureStudentSession() {
    debugLog('Checking session...');
    const data = await window.api.fetch('/api/session');
    debugLog('Session data:', data);
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
    debugLog('Fetching slides...');
    const data = await window.api.fetch('/api/slides');
    debugLog('Slides data:', data);
    const slides = Array.isArray(data.slides) ? data.slides : [];
    const list = document.getElementById('slidesList');
    if (!list) return;
    list.innerHTML = '';
    if (!slides.length) {
      list.innerHTML = `
        <li class="list-group-item bg-light border-0">
          <div class="text-center py-4">
            <i class="bi bi-folder2-open" style="font-size:2rem;color:#6366f1;"></i>
            <div class="mt-2 fw-semibold">No course slides yet</div>
            <div class="text-muted small">Your course rep hasn’t uploaded slides for this class group. Please check back soon.</div>
          </div>
        </li>`;
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
          debugLog('Button clicked:', btn.getAttribute('data-action'), id);
          try {
            const slideId = btn.getAttribute('data-id');
            debugLog('Fetching slide URL for:', slideId);
            const resp = await window.api.fetch(`/api/slides/${encodeURIComponent(slideId)}/url`);
            debugLog('Slide URL response:', resp);
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
          } catch (err) {
            debugLog('Error fetching slide URL:', err);
          }
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
        debugLog('Uploading slide...');
        await window.api.fetch('/api/upload', { method: 'POST', body: fd });
        await loadSlides();
        form.reset();
      } catch (err) {
        debugLog('Upload error:', err);
      }
    });
  }

  async function init() {
    try {
      const user = await ensureStudentSession();
      const nameRaw = user.fullName || user.name || user.username || user.studentId || user.id || 'User';
      const firstName = user.firstName || (String(nameRaw).trim().split(/\s+/)[0] || 'User');
      const role = user.role || '';

      const nameEl = document.getElementById('user-name');
      const roleEl = document.getElementById('user-role');
      const courseEl = document.getElementById('user-course');
      if (nameEl) nameEl.textContent = firstName;
      if (roleEl) roleEl.textContent = role;
      if (courseEl) courseEl.textContent = user.program || '';

      const avatar = document.getElementById('avatar');
      if (avatar) avatar.src = '/public/images/avatar.png';

      debugLog('User loaded:', user);
      await loadSlides();
      wireUpload();
    } catch (err) {
      debugLog('Init error:', err);
      // redirected or no session; nothing else to do
    }
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await window.api.fetch('/api/logout', { method: 'POST' }); } catch (err) { debugLog('Logout error:', err); }
    window.location.assign('/public/index.html');
  });

  // Add listeners for nav links to force reload
  document.querySelectorAll('a.nav-link, button.btn').forEach(el => {
    el.addEventListener('click', (e) => {
      debugLog('Nav/button clicked:', el.textContent);
    });
  });

  init();
});