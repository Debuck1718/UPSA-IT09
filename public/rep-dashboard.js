(function () {
  const form = document.getElementById("repDashUploadForm");
  const alertBox = document.getElementById("alert");
  const coursesSlides = document.getElementById("repDashCoursesSlides");
  const coursesEmpty = document.getElementById("repDashCoursesEmpty");

  const statCourses = document.getElementById("statCourses");
  const statSlides = document.getElementById("statSlides");
  const statRecent = document.getElementById("statRecent");

  const selTitle = document.getElementById("repDashCourseTitle");
  const addTitleBtn = document.getElementById("repDashAddTitleBtn");
  const newTitleInput = document.getElementById("repDashNewTitle");

  function showAlert(type, msg) {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove("d-none");
    // Auto-hide success messages after 5 seconds
    if (type === "success") {
      setTimeout(() => alertBox.classList.add("d-none"), 5000);
    }
  }

  // Personalize header with firstName
  (async function personalizeHeader() {
    try {
      const data = await window.api.fetch("/api/session");
      const user = data && data.user ? data.user : null;
      if (!user) return;
      const raw =
        user.fullName || user.name || user.username || user.studentId || "Rep";
      const firstName =
        user.firstName || String(raw).trim().split(/\s+/)[0] || "Rep";
      const nameEl = document.getElementById("repWelcomeName");
      if (nameEl) nameEl.textContent = firstName;
      const av = document.getElementById("repAvatar");
      if (av) av.src = "/public/images/avatar.png";
    } catch (_) {
      // ignore personalization errors
    }
  })();

  function renderTitlesSelect(titles) {
    if (!selTitle) return;
    selTitle.innerHTML = "";
    const optPlaceholder = document.createElement("option");
    optPlaceholder.value = "";
    optPlaceholder.textContent = "Select a course title";
    selTitle.appendChild(optPlaceholder);
    (titles || []).forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      selTitle.appendChild(opt);
    });
  }

  async function loadMyTitles() {
    try {
      const data = await window.api.fetch("/api/courses/mine");
      const titles = Array.isArray(data.titles) ? data.titles : [];
      renderTitlesSelect(titles);
    } catch (e) {
      renderTitlesSelect([]);
    }
  }

  addTitleBtn?.addEventListener("click", () => {
    newTitleInput.classList.toggle("d-none");
    const addingNew = !newTitleInput.classList.contains("d-none");
    if (addingNew) {
      if (selTitle) {
        selTitle.value = "";
        selTitle.setAttribute("disabled", "disabled");
      }
      newTitleInput.focus();
    } else {
      selTitle?.removeAttribute("disabled");
    }
  });

  async function uploadSlide(fd) {
    return window.api.fetch("/api/upload", { method: "POST", body: fd });
  }

  async function loadCourses() {
    if (!coursesSlides) return;
    coursesSlides.innerHTML =
      '<div class="text-center p-3 text-white-50">Loading catalog...</div>';
    coursesEmpty.classList.add("d-none");

    try {
      const data = await window.api.fetch("/api/courses");
      const courses = Array.isArray(data.courses) ? data.courses : [];

      if (!courses.length) {
        coursesSlides.innerHTML = "";
        coursesEmpty.classList.remove("d-none");
        statCourses.textContent = "0";
        statSlides.textContent = "0";
        statRecent.textContent = "0";
        return;
      }

      coursesSlides.innerHTML = "";
      let totalSlides = 0;
      let recentCount = 0;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (let i = 0; i < courses.length; i++) {
        const course = courses[i];
        const slidesResp = await window.api.fetch(
          `/api/slides?courseTitle=${encodeURIComponent(course)}`,
        );
        const slides = Array.isArray(slidesResp.slides)
          ? slidesResp.slides
          : [];

        totalSlides += slides.length;
        recentCount += slides.filter((s) => {
          const t = Date.parse(s.createdAt || s.created_at);
          return !Number.isNaN(t) && t >= sevenDaysAgo;
        }).length;

        const card = document.createElement("div");
        card.className = "accordion-item";
        card.innerHTML = `
          <h2 class="accordion-header" id="heading${i}">
            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${i}">
              <span class="fw-semibold">${course}</span> 
              <span class="badge rounded-pill bg-primary ms-2">${slides.length}</span>
            </button>
          </h2>
          <div id="collapse${i}" class="accordion-collapse collapse" data-bs-parent="#repDashCoursesSlides">
            <div class="accordion-body p-0">
              <ul class="list-group list-group-flush mb-0">
                ${
                  slides.length === 0
                    ? `<li class="list-group-item text-muted small">No slides available.</li>`
                    : slides
                        .map(
                          (s) => `
                  <li class="list-group-item d-flex justify-content-between align-items-center bg-transparent">
                    <div class="text-truncate me-2">
                      <div class="fw-semibold text-dark small">${s.slideTitle || s.originalName || "Untitled Slide"}</div>
                      <small class="text-muted" style="font-size: 0.75rem;">${new Date(s.createdAt || s.created_at).toLocaleDateString()}</small>
                    </div>
                    <div class="btn-group shadow-sm">
                      <button class="btn btn-sm btn-outline-primary" data-action="download" data-id="${s.id}"><i class="bi bi-download"></i></button>
                      <button class="btn btn-sm btn-outline-secondary" data-action="view" data-id="${s.id}"><i class="bi bi-eye"></i></button>
                    </div>
                  </li>
                `,
                        )
                        .join("")
                }
              </ul>
            </div>
          </div>`;
        coursesSlides.appendChild(card);
      }

      statCourses.textContent = courses.length;
      statSlides.textContent = totalSlides;
      statRecent.textContent = recentCount;

      // Attach button events
      coursesSlides.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          // Added 'e' to event
          e.preventDefault(); // Prevent jumpy behavior

          const id = btn.getAttribute("data-id");
          const action = btn.getAttribute("data-action");

          // Safety check: Ensure the ID exists
          if (!id) {
            return showAlert("danger", "Resource ID missing.");
          }

          try {
            const resp = await window.api.fetch(
              `/api/slides/${encodeURIComponent(id)}/url`,
            );

            if (!resp || !resp.url) throw new Error("URL not found");

            if (action === "view") {
              window.open(resp.url, "_blank");
            } else {
              const a = document.createElement("a");
              a.href = resp.url;
              a.download = "";
              document.body.appendChild(a);
              a.click();
              a.remove();
            }
          } catch (e) {
            console.error("Action error:", e);
            showAlert(
              "danger",
              "Unable to access file. Please refresh the page.",
            );
          }
        });
      });
    } catch (e) {
      coursesSlides.innerHTML =
        '<div class="text-danger p-3">Error loading catalog.</div>';
    }
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selectedTitle = selTitle?.value ? String(selTitle.value).trim() : "";
    const newTitle =
      !newTitleInput.classList.contains("d-none") && newTitleInput.value
        ? String(newTitleInput.value).trim()
        : "";
    const finalCourseTitle = newTitle || selectedTitle;
    const slideTitle = document
      .getElementById("repDashSlideTitle")
      ?.value.trim();

    if (!finalCourseTitle)
      return showAlert("danger", "Please select or enter a course title.");
    if (!slideTitle)
      return showAlert("danger", "Please provide a slide title.");

    const fd = new FormData(form);
    fd.set("courseTitle", finalCourseTitle);
    fd.set("course", finalCourseTitle); // Backward compatibility
    fd.set("slideTitle", slideTitle);

    try {
      if (newTitle) {
        await window.api
          .fetch("/api/courses/manage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: newTitle }),
          })
          .catch(() => {}); // Silent catch if title already exists
      }

      await uploadSlide(fd);
      showAlert("success", "Resource uploaded successfully!");

      form.reset();
      newTitleInput.classList.add("d-none");
      selTitle?.removeAttribute("disabled");

      // Full refresh of the UI
      await loadMyTitles();
      await loadCourses();
    } catch (err) {
      showAlert("danger", err.message || "Upload failed.");
    }
  });

  document
    .getElementById("repDashRefreshCourses")
    ?.addEventListener("click", loadCourses);

  // Reusable Logout Function
  async function handleLogout() {
    if (confirm("Sign out of the Rep Dashboard?")) {
      try {
        await window.api.fetch("/api/logout", { method: "POST" });
      } catch (err) {
        console.error("Logout error", err);
      }
      window.location.href = "/public/index.html";
    }
  }

  // Attach to Sidebar Logout
  const repLogoutBtn = document.getElementById("repLogoutBtn");
  if (repLogoutBtn) {
    repLogoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Attach to Mobile Navbar Logout
  const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
  if (mobileLogoutBtn) {
    mobileLogoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Initial Boot
  loadMyTitles();
  loadCourses().catch(() => {
    coursesSlides.innerHTML =
      '<div class="text-danger p-3">System offline.</div>';
  });
})();

// --- Updated Initial Boot ---
  (async function startRepDashboard() {
    try {
      // 1. Load existing titles and course catalog
      await loadMyTitles();
      await loadCourses();

      // 2. Initialize Push Notifications for the Rep
      // This ensures you get notified of replies/announcements
      if (window.api && window.api.initPush) {
        console.log("Acadex Rep: Syncing notification settings...");
        await window.api.initPush();
      }
    } catch (err) {
      console.error("Boot error:", err);
      if (coursesSlides) {
        coursesSlides.innerHTML = '<div class="text-danger p-3">System offline.</div>';
      }
    }
  })();