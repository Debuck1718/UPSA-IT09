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
    const res = await fetch('./api/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.message || 'Upload failed');
    return data;
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
    const res = await fetch('./api/courses');
    const data = await res.json();
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
    const res = await fetch(`./api/slides?course=${encodeURIComponent(course)}`);
    const data = await res.json();
    if (!data.ok) {
      setSlides([]);
      return;
    }
    setSlides(data.slides);
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
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

  // init
  loadCourses().catch(err => {
    coursesList.innerHTML = '<li class="list-group-item text-danger">Failed to load courses.</li>';
  });
})();