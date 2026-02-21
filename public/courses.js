(async function () {
  const coursesList = document.getElementById('coursesList');
  const slidesList = document.getElementById('slidesList');
  const slidesEmpty = document.getElementById('slidesEmpty');
  const courseTitle = document.getElementById('courseTitle');

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

  try {
    await loadCourses();
  } catch (e) {
    console.error(e);
    coursesList.innerHTML = '<li class="list-group-item text-danger">Failed to load courses.</li>';
  }
})();