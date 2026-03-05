(function () {
  const form = document.getElementById('repDashUploadForm');
  const alertBox = document.getElementById('alert');
  const coursesSlides = document.getElementById('repDashCoursesSlides');
  const coursesEmpty = document.getElementById('repDashCoursesEmpty');

  const statCourses = document.getElementById('statCourses');
  const statSlides = document.getElementById('statSlides');
  const statRecent = document.getElementById('statRecent');

  function showAlert(type, msg) {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
  }

  // Personalize header with firstName and local avatar image
  (async function personalizeHeader() {
    try {
      const data = await window.api.fetch('/api/session');
      const user = data && data.user ? data.user : null;
      if (!user) return;
      const raw = user.fullName || user.name || user.username || user.studentId || 'Rep';
      const firstName = user.firstName || (String(raw).trim().split(/\s+/)[0] || 'Rep');
      const nameEl = document.getElementById('repWelcomeName');
      if (nameEl) nameEl.textContent = firstName;
      const av = document.getElementById('repAvatar');
      if (av) av.src = '/public/images/avatar.png';
    } catch (_) {
      // ignore personalization errors
    }
  })();

  // Course titles management
  const selTitle = document.getElementById('repDashCourseTitle');
  const addTitleBtn = document.getElementById('repDashAddTitleBtn');
  const newTitleInput = document.getElementById('repDashNewTitle');

  function renderTitlesSelect(titles) {
    if (!selTitle) return;
    selTitle.innerHTML = '';
    const optPlaceholder = document.createElement('option');
    optPlaceholder.value = '';
    optPlaceholder.textContent = 'Select a course title';
    selTitle.appendChild(optPlaceholder);
    (titles || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      selTitle.appendChild(opt);
    });
  }

  async function loadMyTitles() {
    try {
      const data = await window.api.fetch('/api/courses/mine');
      const titles = Array.isArray(data.titles) ? data.titles : [];
      renderTitlesSelect(titles);
    } catch (e) {
      renderTitlesSelect([]);
      const alert = document.getElementById('alert');
      if (alert) {
        alert.className = 'alert alert-warning';
        alert.textContent = 'Could not load your course titles. You can still add a new one.';
        alert.classList.remove('d-none');
      }
    }
  }

  addTitleBtn?.addEventListener('click', () => {
    newTitleInput.classList.toggle('d-none');
    const addingNew = !newTitleInput.classList.contains('d-none');
    if (addingNew) {
      // When adding a new title, clear and disable the select to avoid native validation prompts
      if (selTitle) {
        selTitle.value = '';
        selTitle.setAttribute('disabled', 'disabled');
      }
      newTitleInput.focus();
    } else {
      // When hiding new-title input, re-enable the select
      selTitle?.removeAttribute('disabled');
    }
  });

  async function uploadSlide(fd) {
    const nt = newTitleInput?.value.trim();
    if (nt) {
      fd.set('courseTitle', nt);
    } else if (selTitle && selTitle.value) {
      fd.set('courseTitle', selTitle.value);
    }
    const ct = fd.get('courseTitle');
    if (!ct || String(ct).trim() === '') throw new Error('Please select or add a Course Title.');
    const st = document.getElementById('repDashSlideTitle')?.value.trim();
    if (!st) throw new Error('Please provide a Slide Title.');
    fd.set('slideTitle', st);
    // Backward compat: set 'course' so legacy list buckets align with courseTitle
    if (!fd.get('course')) {
      fd.set('course', String(ct));
    }

    return window.api.fetch('/api/upload', { method: 'POST', body: fd });
  }

  // Initialize titles on load
  loadMyTitles();

  function setSlides(items) {
    slidesList.innerHTML = '';
    if (!items || !items.length) {
      slidesList.classList.add('d-none');
      slidesEmpty.classList.remove('d-none');
      slidesEmpty.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-folder2-open" style="font-size:2rem;color:#6366f1;"></i>
          <div class="mt-2 fw-semibold">No slides for this course</div>
          <div class="text-muted small">Use “Upload slides” on the left to add the first slide for this course title.</div>
        </div>`;
      return;
    }
    slidesEmpty.classList.add('d-none');
    slidesList.classList.remove('d-none');
    for (const s of items) {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML = `
        <div class="me-2">
          <div class="fw-semibold">${s.originalName || s.original_name || s.slideTitle || s.slide_title || s.filename}</div>
          <small class="text-muted">${new Date(s.createdAt || s.created_at || Date.now()).toLocaleString()}</small>
        </div>
        <div class="btn-group">
          <button class="btn btn-sm btn-outline-primary" data-action="download" data-id="${s.id}">Download</button>
          <button class="btn btn-sm btn-outline-secondary" data-action="view" data-id="${s.id}">View</button>
        </div>
      `;
      li.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-id');
          try {
            const resp = await window.api.fetch(`/api/slides/${encodeURIComponent(id)}/url`);
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
          } catch (e) {
            showAlert('danger', 'Could not generate link. Please try again.');
          }
        });
      });
      slidesList.appendChild(li);
    }
  }

  async function loadCourses() {
    coursesSlides.innerHTML = '';
    coursesEmpty.classList.add('d-none');
    try {
      const data = await window.api.fetch('/api/courses');
      const courses = Array.isArray(data.courses) ? data.courses : [];
      if (!courses.length) {
        coursesEmpty.classList.remove('d-none');
        return;
      }
      // For each course, fetch slides and render as accordion
      for (let i = 0; i < courses.length; i++) {
        const course = courses[i];
        const slidesResp = await window.api.fetch(`/api/slides?courseTitle=${encodeURIComponent(course)}`);
        const slides = Array.isArray(slidesResp.slides) ? slidesResp.slides : [];
        const card = document.createElement('div');
        card.className = 'accordion-item';
        card.innerHTML = `
          <h2 class="accordion-header" id="heading${i}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${i}" aria-expanded="false" aria-controls="collapse${i}">
              <span class="fw-semibold">${course}</span> <span class="badge bg-info ms-2">${slides.length}</span>
            </button>
          </h2>
          <div id="collapse${i}" class="accordion-collapse collapse" aria-labelledby="heading${i}" data-bs-parent="#repDashCoursesSlides">
            <div class="accordion-body p-0">
              <ul class="list-group list-group-flush mb-0">
                ${slides.length === 0 ? `<li class='list-group-item text-muted'>No slides for this course.</li>` : slides.map(s => `
                  <li class='list-group-item d-flex justify-content-between align-items-center'>
                    <div>
                      <span class='fw-semibold'>${s.originalName || s.original_name || s.slideTitle || s.slide_title || s.filename}</span>
                      <small class='text-muted ms-2'>${new Date(s.createdAt || s.created_at || Date.now()).toLocaleString()}</small>
                    </div>
                    <div class='btn-group'>
                      <button class='btn btn-sm btn-outline-primary' data-action='download' data-id='${s.id}'>Download</button>
                      <button class='btn btn-sm btn-outline-secondary' data-action='view' data-id='${s.id}'>View</button>
                    </div>
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        `;
        coursesSlides.appendChild(card);
      }
      // stats
      statCourses.textContent = String(courses.length);
      let allSlidesCount = 0;
      let recent = 0;
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      for (let i = 0; i < courses.length; i++) {
        const slidesResp = await window.api.fetch(`/api/slides?courseTitle=${encodeURIComponent(courses[i])}`);
        const slides = Array.isArray(slidesResp.slides) ? slidesResp.slides : [];
        allSlidesCount += slides.length;
        recent += slides.filter(s => {
          const ts = s.createdAt || s.created_at;
          const t = ts ? Date.parse(ts) : NaN;
          return !Number.isNaN(t) && t >= sevenDaysAgo;
        }).length;
      }
      statSlides.textContent = String(allSlidesCount);
      statRecent.textContent = String(recent);
      // Attach download/view handlers
      coursesSlides.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = btn.getAttribute('data-id');
          const action = btn.getAttribute('data-action');
          try {
            const resp = await window.api.fetch(`/api/slides/${encodeURIComponent(id)}/url`);
            const url = resp.url;
            if (action === 'view') {
              window.open(url, '_blank');
            } else {
              const a = document.createElement('a');
              a.href = url;
              a.download = '';
              document.body.appendChild(a);
              a.click();
              a.remove();
            }
          } catch (e) {
            showAlert('danger', 'Could not generate link. Please try again.');
          }
        });
      });
    } catch (e) {
      coursesEmpty.textContent = 'Failed to load courses.';
      coursesEmpty.classList.remove('d-none');
    }
  }

  async function selectCourse(course) {
    courseTitle.textContent = course;
    const data = await window.api.fetch(`/api/slides?course=${encodeURIComponent(course)}`);
    setSlides(data.slides);
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Determine course title from select or "Add new" input
    const selectEl = document.getElementById('repDashCourseTitle');
    const newTitleEl = document.getElementById('repDashNewTitle');
    const slideTitleEl = document.getElementById('repDashSlideTitle');

    const selectedTitle = (selectEl && selectEl.value) ? String(selectEl.value).trim() : '';
    const newTitle = (newTitleEl && !newTitleEl.classList.contains('d-none') && newTitleEl.value) ? String(newTitleEl.value).trim() : '';
    const finalCourseTitle = newTitle || selectedTitle;

    if (!finalCourseTitle) {
      showAlert('danger', 'Please select a Course Title or click "Add new" and enter one.');
      return;
    }

    if (!slideTitleEl || !slideTitleEl.value.trim()) {
      showAlert('danger', 'Please provide a Slide Title.');
      return;
    }

    const fd = new FormData(form);
    // Ensure courseTitle and slideTitle are explicitly set for the API
    fd.set('courseTitle', finalCourseTitle);
    fd.set('slideTitle', slideTitleEl.value.trim());

    try {
      // If using a brand-new title, optionally add it so it appears in the list immediately
      if (newTitle) {
        try {
          await window.api.fetch('/api/courses/manage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
          });
        } catch (_) {
          // It's okay if this fails; the backend will remember titles from the upload too
        }
      }

      await uploadSlide(fd);
      showAlert('success', 'Slide uploaded successfully.');
      form.reset();

      // Refresh available titles and auto-select the one just used
      await loadCourses();
      if (finalCourseTitle) {
        selectCourse(finalCourseTitle);
      }
    } catch (err) {
      showAlert('danger', err.message || 'Upload failed.');
    }
  });

  document.getElementById('repDashRefreshCourses')?.addEventListener('click', loadCourses);

  // Logout button for rep dashboard
  const repLogoutBtn = document.getElementById('repLogoutBtn');
  repLogoutBtn?.addEventListener('click', async () => {
    try { await window.api.fetch('/api/logout', { method: 'POST' }); } catch {}
    window.location.assign('/public/index.html');
  });

  // init
  loadCourses().catch(err => {
    coursesSlides.innerHTML = '<div class="text-danger p-3">Failed to load courses.</div>';
  });
})();