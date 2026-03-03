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
      slidesEmpty.innerHTML = `
        <div class="text-center py-4">
          <i class="bi bi-folder2-open" style="font-size:2rem;color:#6366f1;"></i>
          <div class="mt-2 fw-semibold">No slides for this course</div>
          <div class="text-muted small">Please choose another course or check back later.</div>
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
            alert('Could not generate link. Please try again.');
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
    if (!data.courses || !data.courses.length) {
      coursesList.innerHTML = `
        <li class="list-group-item bg-light border-0">
          <div class="text-center py-4">
            <i class="bi bi-journal-x" style="font-size:2rem;color:#6366f1;"></i>
            <div class="mt-2 fw-semibold">No courses available</div>
            <div class="text-muted small">There are no course titles to browse yet. Please check back later.</div>
          </div>
        </li>`;
      return;
    }
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
    const data = await window.api.fetch(`/api/slides?courseTitle=${encodeURIComponent(course)}`);
    if (!data.ok) {
      setSlides([]);
      return;
    }
    if (courseTitle.textContent !== course) return;
    setSlides(data.slides);
  }
  try {
    await loadCourses();
  } catch (e) {
    console.error(e);
    coursesList.innerHTML = '<li class="list-group-item text-danger">Failed to load courses.</li>';
  }
})();