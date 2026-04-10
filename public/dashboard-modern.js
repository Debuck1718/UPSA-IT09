  let selectedCourse = null;

  async function loadSlides() {
    const slidesList = document.getElementById('slidesList');
    const slidesEmpty = document.getElementById('slidesEmpty');
    slidesList.innerHTML = '';
    slidesEmpty.classList.add('d-none');
    if (!selectedCourse) {
      slidesEmpty.textContent = 'Select a course to view slides.';
      slidesEmpty.classList.remove('d-none');
      return;
    }
    try {
      const data = await window.api.fetch(`/api/slides?courseTitle=${encodeURIComponent(selectedCourse)}`);
      const slides = Array.isArray(data.slides) ? data.slides : [];
      if (!slides.length) {
        slidesEmpty.classList.remove('d-none');
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
        slidesList.appendChild(li);
      });
    } catch {
      slidesEmpty.textContent = 'Failed to load slides.';
      slidesEmpty.classList.remove('d-none');
    }
  }

  async function loadCourses() {
    const coursesList = document.getElementById('coursesList');
    const coursesEmpty = document.getElementById('coursesEmpty');
    coursesList.innerHTML = '';
    coursesEmpty.classList.add('d-none');
    try {
      const data = await window.api.fetch('/api/courses');
      const courses = Array.isArray(data.courses) ? data.courses : [];
      if (!courses.length) {
        coursesEmpty.classList.remove('d-none');
        return;
      }
      courses.forEach(title => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action d-flex align-items-center';
        li.innerHTML = `<i class="bi bi-bookmark-star me-2" style="color:#06b6d4;font-size:1.2rem;"></i> <span class="fw-semibold">${title}</span>`;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
          selectedCourse = title;
          setSlidesCourseTitle(title);
          loadSlides();
        });
        coursesList.appendChild(li);
      });
    } catch {
      coursesEmpty.textContent = 'Failed to load courses.';
      coursesEmpty.classList.remove('d-none');
    }
  }

  function setSlidesCourseTitle(title) {
    const el = document.getElementById('slidesCourseTitle');
    if (el) {
      el.innerHTML = `<i class="bi bi-folder2-open me-2" style="color:#6366f1;font-size:1.5rem;"></i> ${title ? title : 'Select a course to view slides'}`;
    }
  }
document.addEventListener('DOMContentLoaded', function() {
  async function fetchSession() {
    try {
      const data = await window.api.fetch('/api/session');
      if (!data || !data.user) throw new Error('No session');
      return data.user;
    } catch {
      window.location.assign('/public/index.html');
      throw new Error('No session');
    }
  }

  function setUserInfo(user) {
    const nameRaw = user.fullName || user.name || user.username || user.studentId || user.id || 'User';
    const firstName = user.firstName || (String(nameRaw).trim().split(/\s+/)[0] || 'User');
    document.getElementById('user-firstname').textContent = firstName;
    document.getElementById('user-role').textContent = user.role || '';
    document.getElementById('user-course').textContent = user.program || '';
    const avatar = document.getElementById('avatar');
    if (avatar) avatar.src = '/public/images/avatar.png';
  }

  async function loadSlides() {
    const slidesList = document.getElementById('slidesList');
    const slidesEmpty = document.getElementById('slidesEmpty');
    slidesList.innerHTML = '';
    slidesEmpty.classList.add('d-none');
    if (!selectedCourse) {
      slidesEmpty.textContent = 'Select a course to view slides.';
      slidesEmpty.classList.remove('d-none');
      return;
    }
    try {
      const data = await window.api.fetch(`/api/slides?courseTitle=${encodeURIComponent(selectedCourse)}`);
      const slides = Array.isArray(data.slides) ? data.slides : [];
      if (!slides.length) {
        slidesEmpty.classList.remove('d-none');
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
        slidesList.appendChild(li);
      });
    } catch {
      slidesEmpty.textContent = 'Failed to load slides.';
      slidesEmpty.classList.remove('d-none');
    }
  }

  document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try { await window.api.fetch('/api/logout', { method: 'POST' }); } catch {}
    window.location.assign('/public/index.html');
  });

  document.getElementById('refreshSlides')?.addEventListener('click', loadSlides);
  document.getElementById('refreshCourses')?.addEventListener('click', loadCourses);

  (async function init() {
    const user = await fetchSession();
    setUserInfo(user);
    await loadCourses();
    setSlidesCourseTitle(null);
    selectedCourse = null;
    loadSlides();
  })();
});

// --- Section Switching Logic ---
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('d-none');
    });

    // Remove active class from all links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Show selected section
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.remove('d-none');
    }

    // Set clicked link as active
    const activeLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Trigger data fetch if section requires it
    if (sectionId === 'announcements-section') loadAnnouncements();
    if (sectionId === 'resource-hub') loadResources();
}

/**
 * Handle Permissions for UI Elements
 */
async function checkPermissions() {
    try {
        const session = await window.api.fetch('/api/session');
        const user = session.user;

        // Update UI with name/program
        document.getElementById('user-firstname').innerText = user.full_name.split(' ')[0];
        document.getElementById('user-course').innerText = user.program;

        // Hierarchy Check: Show "Create" buttons only for authorized roles
        if (user.role === 'admin' || user.is_leader || user.is_creator) {
            document.getElementById('uploadBtn')?.classList.remove('d-none');
            document.getElementById('announceBtn')?.classList.remove('d-none');
        }
    } catch (e) {
        console.error("Permission check failed", e);
    }
}
// --- Resource Hub Logic ---
async function loadResources() {
    const grid = document.getElementById('resourceGrid');
    grid.innerHTML = '<div class="text-center p-5 text-white">Loading resources...</div>';
    
    try {
        // Fetches resources filtered by user's program_id (Handled by your existing API pattern)
        const data = await window.api.fetch('/api/resources');
        grid.innerHTML = '';
        
        if (!data.resources?.length) {
            grid.innerHTML = '<div class="text-center text-white-50">No resources available for your program yet.</div>';
            return;
        }

        data.resources.forEach(res => {
            const card = document.createElement('div');
            card.className = 'col-md-6 col-lg-4';
            card.innerHTML = `
                <div class="card h-100 border-0 shadow-sm bg-white">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-2">
                            <i class="bi ${res.category_icon || 'bi-play-circle'} text-primary fs-4 me-2"></i>
                            <span class="badge bg-light text-dark text-uppercase">${res.category_name}</span>
                        </div>
                        <h6 class="fw-bold">${res.title}</h6>
                        <p class="small text-muted text-truncate">${res.description || 'No description provided.'}</p>
                        <button class="btn btn-sm w-100 ${res.youtube_id ? 'btn-danger' : 'btn-primary'}" 
                                onclick="handleResourceClick('${res.youtube_id}', '${res.url}', '${res.title}', '${res.description}')">
                            ${res.youtube_id ? '<i class="bi bi-youtube"></i> Watch Video' : '<i class="bi bi-box-arrow-up-right"></i> Open Link'}
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (e) {
        grid.innerHTML = '<div class="text-center text-danger">Failed to load resource hub.</div>';
    }
}

function handleResourceClick(youtubeId, url, title, desc) {
    if (youtubeId && youtubeId !== 'null') {
        const modal = new bootstrap.Modal(document.getElementById('videoModal'));
        document.getElementById('videoTitle').innerText = title;
        document.getElementById('videoDescription').innerText = desc;
        document.getElementById('videoContainer').innerHTML = 
            `<iframe src="https://www.youtube.com/embed/${youtubeId}" allowfullscreen></iframe>`;
        modal.show();
        
        // Clear iframe on close to stop audio
        document.getElementById('videoModal').addEventListener('hidden.bs.modal', () => {
            document.getElementById('videoContainer').innerHTML = '';
        }, {once: true});
    } else {
        window.open(url, '_blank');
    }
}