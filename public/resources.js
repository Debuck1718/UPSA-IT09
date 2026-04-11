document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("resourcesGrid");
  const catContainer = document.getElementById("categoryFilters");
  const searchInput = document.getElementById("resourceSearch");
  const uploadAction = document.getElementById("uploadAction");
  const videoModal = new bootstrap.Modal(document.getElementById("videoModal"));

  let allResources = [];
  let currentFilter = "all";

  /**
   * INITIALIZATION
   */
  async function init() {
    // Show skeleton loading state immediately
    renderSkeletons();

    try {
      const [cats, resources, session] = await Promise.all([
        window.api.fetch("/api/categories"),
        window.api.fetch("/api/resources"),
        window.api.fetch("/api/session")
      ]);

      // 1. Permission Check for Upload Button
      const u = session?.user;
      if (u && (u.role === 'admin' || u.is_rep || u.is_leader || u.is_creator)) {
        uploadAction.innerHTML = `
            <a href="upload-resource.html" class="btn btn-primary rounded-pill px-4 animate__animated animate__fadeIn">
                <i class="bi bi-cloud-arrow-up me-2"></i>Upload
            </a>`;
      }

      // 2. Initialize Category Pills
      cats.forEach((cat) => {
        const span = document.createElement("span");
        span.className = "badge rounded-pill bg-white text-dark border p-2 px-3 category-pill";
        span.dataset.cat = cat.id;
        span.textContent = cat.name;
        span.onclick = (e) => filterByCategory(cat.id, e);
        catContainer.appendChild(span);
      });

      // 3. Store and Render Data
      allResources = resources;
      setTimeout(() => renderLayout(allResources), 300);

    } catch (e) {
      console.error("Initialization Error:", e);
      grid.innerHTML = `<div class="text-center p-5 text-danger">Failed to connect to library.</div>`;
    }
  }

 
  function renderLayout(items) {
    if (!items.length) return renderResources([], "resourcesGrid");

    // Sectioning: Most Viewed (Top 4)
    const topResources = [...items]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 4);

    grid.innerHTML = `
        <div class="col-12 mb-2 animate__animated animate__fadeIn">
            <h4 class="fw-bold"><i class="bi bi-fire text-danger me-2"></i>Most Popular</h4>
        </div>
        <div class="row g-4 mb-5" id="topResourcesRow"></div>
        
        <div class="col-12 mb-2 animate__animated animate__fadeIn">
            <h4 class="fw-bold"><i class="bi bi-collection me-2"></i>All Resources</h4>
        </div>
        <div class="row g-4" id="allResourcesRow"></div>
    `;

    renderResources(topResources, "topResourcesRow");
    renderResources(items, "allResourcesRow");
  }

  function renderResources(items, targetId) {
    const container = document.getElementById(targetId) || grid;
    
    if (!items.length) {
      const isSearch = searchInput.value.trim() !== "";
      container.innerHTML = `
        <div class="col-12 text-center py-5 animate__animated animate__fadeIn">
            <div class="empty-state-container">
                <i class="bi bi-search-heart display-1 text-primary opacity-25"></i>
                <h3 class="fw-bold mt-4">No resources found</h3>
                <p class="text-muted mx-auto" style="max-width: 400px;">
                    ${isSearch ? `No matches for "<strong>${searchInput.value}</strong>".` : "The library is empty for now."}
                </p>
                <button class="btn btn-outline-primary rounded-pill px-4" onclick="location.reload()">
                    <i class="bi bi-arrow-clockwise me-2"></i>Reset
                </button>
            </div>
        </div>`;
      return;
    }

    container.innerHTML = items.map((res, index) => {
      const delay = (index % 4) * 0.1;
      let actionBtn = "";
      let mediaPreview = "";

      if (res.youtube_id) {
        mediaPreview = `
          <div class="youtube-thumb" onclick="playVideo('${res.youtube_id}', '${res.title.replace(/'/g, "\\'")}')">
              <img src="https://img.youtube.com/vi/${res.youtube_id}/hqdefault.jpg" class="card-img-top" alt="Thumb" style="height: 180px; object-fit: cover;">
              <i class="bi bi-play-circle-fill play-overlay"></i>
          </div>`;
        actionBtn = `<button class="btn btn-sm btn-outline-danger w-100" onclick="playVideo('${res.youtube_id}', '${res.title.replace(/'/g, "\\'")}')">Watch Video</button>`;
      } else {
        mediaPreview = `
          <div class="p-4 text-center bg-light border-bottom">
              <i class="bi ${getFileIcon(res.url)} display-4 text-success"></i>
          </div>`;
        actionBtn = `<a href="${res.url}" target="_blank" class="btn btn-sm btn-outline-success w-100">Open Resource</a>`;
      }

      return `
        <div class="col-md-4 col-lg-3 animate__animated animate__fadeInUp" style="animation-delay: ${delay}s">
            <div class="card h-100 shadow-sm resource-card">
                ${mediaPreview}
                <div class="card-body">
                    <h6 class="fw-bold mb-1 text-truncate">${res.title}</h6>
                    <p class="small text-muted mb-3" style="font-size: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${res.description || "No description provided."}
                    </p>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <span class="badge bg-light text-primary border">${res.view_count || 0} views</span>
                        <span class="small text-muted" style="font-size: 0.7rem;">${new Date(res.created_at).toLocaleDateString()}</span>
                    </div>
                    ${actionBtn}
                </div>
            </div>
        </div>`;
    }).join("");
  }

  function renderSkeletons() {
    grid.innerHTML = Array(4).fill(0).map(() => `
        <div class="col-md-4 col-lg-3">
            <div class="skeleton-card">
                <div class="skeleton-img"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
                <div class="shimmer"></div>
            </div>
        </div>`).join('');
  }

  /**
   * UTILITIES & EVENT HANDLERS
   */
  window.playVideo = (id, title) => {
    document.getElementById("videoTitle").textContent = title;
    document.getElementById("videoPlayerContainer").innerHTML = `
        <iframe src="https://www.youtube.com/embed/${id}?autoplay=1" allowfullscreen allow="autoplay"></iframe>`;
    videoModal.show();
  };

  function getFileIcon(url) {
    if (!url) return "bi-link-45deg";
    const lower = url.toLowerCase();
    if (lower.includes(".pdf")) return "bi-file-earmark-pdf";
    if (lower.includes(".ppt") || lower.includes(".pptx")) return "bi-file-earmark-ppt";
    if (lower.includes(".doc") || lower.includes(".docx")) return "bi-file-earmark-word";
    return "bi-link-45deg";
  }

  function filterByCategory(catId, event) {
    document.querySelectorAll(".category-pill").forEach((p) => p.classList.remove("active"));
    event.currentTarget.classList.add("active");
    currentFilter = catId;
    applyFilters();
  }

  function applyFilters() {
    const query = searchInput.value.toLowerCase();
    const filtered = allResources.filter((r) => {
      const matchesSearch = r.title.toLowerCase().includes(query) || (r.description && r.description.toLowerCase().includes(query));
      const matchesCat = currentFilter === "all" || r.category_id == currentFilter;
      return matchesSearch && matchesCat;
    });

    // If we are filtering, we bypass the "Layout" (sections) and just show the grid
    renderResources(filtered, "resourcesGrid");
  }

  searchInput.addEventListener("input", applyFilters);

  // Modal Cleanup
  document.getElementById("videoModal").addEventListener("hidden.bs.modal", () => {
    document.getElementById("videoPlayerContainer").innerHTML = "";
  });

  init();
});