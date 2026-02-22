(function () {
  const form = document.getElementById('repUploadForm');
  const alertBox = document.getElementById('alert');
  const coursesList = document.getElementById('repCoursesList');
  const slidesList = document.getElementById('repSlidesList');
  const slidesEmpty = document.getElementById('repSlidesEmpty');
  const courseTitle = document.getElementById('repCourseTitle');

  function showAlert(type, msg) {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
  }

  async function uploadSlide(fd) {
    // Ensure classGroup is present
    if (!fd.get('classGroup')) {
      throw new Error('Please provide Class/Group.');
    }
    const data = await window.api.fetch('/api/upload', { method: 'POST', body: fd });
    return data;
  }

  // Manage/select course titles
  const selTitle = document.getElementById('repCourseTitle');
  const addTitleBtn = document.getElementById('repAddTitleBtn');
  const newTitleInput = document.getElementById('repNewTitle');
  const titlesCards = document.getElementById('repTitlesCards');

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

  function renderTitleCards(titles) {
    if (!titlesCards) return;
    titlesCards.innerHTML = '';
    (titles || []).forEach(t => {
      const col = document.createElement('div');
      col.className = 'col-6 col-md-4';
      col.innerHTML = `
        <div class="card shadow-sm h-100">
          <div class="card-body py-2">
            <div class="small fw-semibold">${t}</div>
          </div>
        </div>
      `;
      titlesCards.appendChild(col);
    });
  }

  addTitleBtn?.addEventListener('click', () => {
    newTitleInput.classList.toggle('d-none');
    if (!newTitleInput.classList.contains('d-none')) newTitleInput.focus();
  });

  document.getElementById('repManageCourses')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('repManageTitle')?.value.trim();
    if (!title) return;
    try {
      const data = await window.api.fetch('/api/courses/manage', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title })
      });
      // Refresh titles
      await loadMyTitles();
      document.getElementById('repManageTitle').value = '';
    } catch (e) {
      showAlert('danger', e.message || 'Failed to add title');
    }
  });

  async function loadMyTitles() {
    try {
      const data = await window.api.fetch('/api/courses/mine');
      const titles = Array.isArray(data.titles) ? data.titles : [];
      renderTitlesSelect(titles);
      renderTitleCards(titles);
      if (!titles.length && alertBox) {
        alertBox.className = 'alert alert-info';
        alertBox.textContent = 'No course titles yet. Add a title to organize your uploads.';
        alertBox.classList.remove('d-none');
      }
    } catch (e) {
      renderTitlesSelect([]);
      renderTitleCards([]);
      showAlert('danger', e.message || 'Failed to load course titles.');
    }
  }

  function setSlides(items) {
    slidesList.innerHTML = '';
    if (!items || !items.length) {
      slidesList.classList.add('d-none');
      slidesEmpty.classList.remove('d-none');
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
    const data = await window.api.fetch('/api/courses');
    if (!data.ok) throw new Error('Failed to load courses');
    coursesList.innerHTML = '';
    for (const c of data.courses) {
      const li = document.createElement('li');
      li.className = 'list-group-item list-group-item-action';
      li.role = 'button';
      li.textContent = c;
      li.addEventListener('click', () => selectCourse(c));
      coursesList.appendChild(li);
    }
  }

  async function selectCourse(course) {
    courseTitle.textContent = course;
    const data = await window.api.fetch(`/api/slides?course=${encodeURIComponent(course)}`);
    if (!data.ok) {
      setSlides([]);
      return;
    }
    setSlides(data.slides);
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    await ensureCourseTitleOnForm(fd);
    // Backward compat: set 'course' from courseTitle so legacy views bucket by this
    const chosenTitle = fd.get('courseTitle');
    if (chosenTitle && !fd.get('course')) {
      fd.set('course', String(chosenTitle));
    }

    try {
      await uploadSlide(fd);
      showAlert('success', 'Slide uploaded successfully.');
      form.reset();
      // refresh side lists
      await loadCourses();
      const c = fd.get('course');
      if (c) selectCourse(String(c));
    } catch (err) {
      showAlert('danger', err.message || 'Upload failed.');
    }
  });

  document.getElementById('refreshCourses')?.addEventListener('click', loadCourses);

  async function ensureCourseTitleOnForm(fd) {
    const newTitle = newTitleInput?.value.trim();
    if (newTitle) {
      fd.set('courseTitle', newTitle);
    } else if (selTitle && selTitle.value) {
      fd.set('courseTitle', selTitle.value);
    }
    const ct = fd.get('courseTitle');
    if (!ct || String(ct).trim() === '') {
      throw new Error('Please select or add a Course Title.');
    }
    const st = document.getElementById('repSlideTitle')?.value.trim();
    if (!st) throw new Error('Please provide a Slide Title.');
    fd.set('slideTitle', st);
  }

  // init
  loadCourses().catch(err => {
    coursesList.innerHTML = '<li class="list-group-item text-danger">Failed to load courses.</li>';
  });
  loadMyTitles();
})();