document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("resourcesGrid");
  const catContainer = document.getElementById("categoryFilters");
  const searchInput = document.getElementById("resourceSearch");
  const videoModal = new bootstrap.Modal(document.getElementById("videoModal"));

  let allResources = [];
  let currentFilter = "all";

  async function init() {
    await Promise.all([loadCategories(), loadResources()]);
  }

  async function loadCategories() {
    try {
      const cats = await window.api.fetch("/api/categories");
      cats.forEach((cat) => {
        const span = document.createElement("span");
        span.className =
          "badge rounded-pill bg-white text-dark border p-2 px-3 category-pill";
        span.dataset.cat = cat.id;
        span.textContent = cat.name;
        span.onclick = () => filterByCategory(cat.id);
        catContainer.appendChild(span);
      });
    } catch (e) {
      console.error("Cat error", e);
    }
  }

  async function loadResources() {
    try {
      // This hits an endpoint that selects * from resources where status='approved'
      const data = await window.api.fetch("/api/resources");
      allResources = data;
      renderResources(allResources);
    } catch (e) {
      grid.innerHTML = `<div class="text-center p-5 text-danger">Failed to connect to library.</div>`;
    }
  }

  function renderResources(items) {
    if (!items.length) {
      grid.innerHTML = `
        <div class="col-12 text-center py-5">
            <i class="bi bi-folder-x display-1 text-muted"></i>
            <p class="mt-3 fs-5 text-secondary">We couldn't find any resources for "${searchInput.value}"</p>
            <button class="btn btn-primary btn-sm" onclick="location.reload()">Clear Filters</button>
        </div>`;
      return;
    }

    grid.innerHTML = items
      .map((res) => {
        let actionBtn = "";
        let mediaPreview = "";

        if (res.youtube_id) {
          mediaPreview = `
    <div class="youtube-thumb" onclick="playVideo('${res.youtube_id}', '${res.title}')">
        <img src="https://img.youtube.com/vi/${res.youtube_id}/hqdefault.jpg" 
             class="card-img-top" 
             alt="Thumb" 
             style="height: 180px; object-fit: cover;">
        <i class="bi bi-play-circle-fill play-overlay"></i>
    </div>`;
          actionBtn = `<button class="btn btn-sm btn-outline-danger w-100" onclick="playVideo('${res.youtube_id}', '${res.title}')">Watch Video</button>`;
        } else if (res.url.startsWith("http")) {
          // It's a web link (Google Drive, Article, etc)
          mediaPreview = `
        <div class="p-4 text-center bg-light border-bottom">
            <i class="bi bi-link-45deg display-4 text-success"></i>
        </div>`;
          actionBtn = `<a href="${res.url}" target="_blank" class="btn btn-sm btn-outline-success w-100">Open Link</a>`;
        }

        return `
                <div class="col-md-4 col-lg-3">
                    <div class="card h-100 shadow-sm resource-card">
                        ${mediaPreview}
                        <div class="card-body">
                            <h6 class="fw-bold mb-1 text-truncate">${res.title}</h6>
                            <p class="small text-muted mb-3" style="font-size: 0.75rem;">${res.description || "No description provided."}</p>
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <span class="badge bg-light text-primary border">${res.view_count || 0} views</span>
                                <span class="small text-muted">${new Date(res.created_at).toLocaleDateString()}</span>
                            </div>
                            ${actionBtn}
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  window.playVideo = (id, title) => {
    document.getElementById("videoTitle").textContent = title;
    document.getElementById("videoPlayerContainer").innerHTML = `
            <iframe src="https://www.youtube.com/embed/${id}?autoplay=1" allowfullscreen allow="autoplay"></iframe>
        `;
    videoModal.show();
  };

  function getFileIcon(url) {
    if (url.includes(".pdf")) return "bi-file-earmark-pdf";
    if (url.includes(".ppt")) return "bi-file-earmark-ppt";
    return "bi-file-earmark-text";
  }

  function filterByCategory(catId) {
    document
      .querySelectorAll(".category-pill")
      .forEach((p) => p.classList.remove("active"));
    event.target.classList.add("active");
    currentFilter = catId;
    applyFilters();
  }

  function applyFilters() {
    const query = searchInput.value.toLowerCase();
    const filtered = allResources.filter((r) => {
      const matchesSearch = r.title.toLowerCase().includes(query);
      const matchesCat =
        currentFilter === "all" || r.category_id == currentFilter;
      return matchesSearch && matchesCat;
    });
    renderResources(filtered);
  }

  searchInput.addEventListener("input", applyFilters);

  // Stop video when modal closes
  document
    .getElementById("videoModal")
    .addEventListener("hidden.bs.modal", () => {
      document.getElementById("videoPlayerContainer").innerHTML = "";
    });

  init();
});
