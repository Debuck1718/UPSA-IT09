(function () {
  const form = document.getElementById('repDashUploadForm');
  const alertBox = document.getElementById('alert');
  const coursesList = document.getElementById('repDashCoursesList');
  const slidesList = document.getElementById('repDashSlidesList');
  const slidesEmpty = document.getElementById('repDashSlidesEmpty');
  const courseTitle = document.getElementById('repDashCourseTitle');

  const statCourses = document.getElementById('statCourses');
  const statSlides = document.getElementById('statSlides');
  const statRecent = document.getElementById('statRecent');

  function showAlert(type, msg) {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('d-none');
  }

  async function api(path, opts) {
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      throw new Error(data.message || `Request failed (${res.status})`);
    }
    return data;
  }

  async function uploadSlide(fd) {
    return api('./api/upload', { method: 'POST', body: fd });
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
          <div class="fw-semibold">${s.originalName || s.filename}</div>
          <small class="text-muted">${new Date(s.createdAt).toLocaleString()}</small>
        </div>
        <div class="btn-group">
          <a class="btn btn-sm btn-outline-primary" href="../uploads/${encodeURIComponent(s.filename)}" download>Download</a>
          <a class="btn btn-sm btn-outline-secondary" href="../uploads/${encodeURIComponent(s.filename)}" target="_blank">View</a>
        </div>
      `;
      slidesList.appendChild(li);
    }
  }

  async function loadCourses() {
    const data = await api('./api/courses');
    coursesList.innerHTML = '';
    (data.courses || []).forEach(c => {
      const li = document.createElement('li');
      li.className = 'list-group-item list-group-item-action';
      li.role = 'button';
      li.textContent = c;
      li.addEventListener('click', () => selectCourse(c));
      coursesList.appendChild(li);
    });
    // stats
    statCourses.textContent = String((data.courses || []).length);
    const allSlides = await api('./api/slides');
    statSlides.textContent = String((allSlides.slides || []).length);
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recent = (allSlides.slides || []).filter(s => Date.parse(s.createdAt) >= sevenDaysAgo).length;
    statRecent.textContent = String(recent);
  }

  async function selectCourse(course) {
    courseTitle.textContent = course;
    const data = await api(`./api/slides?course=${encodeURIComponent(course)}`);
    setSlides(data.slides);
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await uploadSlide(fd);
      showAlert('success', 'Slide uploaded successfully.');
      form.reset();
      await loadCourses();
      const c = fd.get('course');
      if (c) selectCourse(String(c));
    } catch (err) {
      showAlert('danger', err.message || 'Upload failed.');
    }
  });

  document.getElementById('repDashRefreshCourses')?.addEventListener('click', loadCourses);

  // init
  loadCourses().catch(err => {
    coursesList.innerHTML = '<li class="list-group-item text-danger">Failed to load courses.</li>';
  });
})();