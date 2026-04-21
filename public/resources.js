document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("resourcesGrid");
  const catContainer = document.getElementById("categoryFilters");
  const searchInput = document.getElementById("resourceSearch");
  const uploadAction = document.getElementById("uploadAction");
  const videoModal = new bootstrap.Modal(document.getElementById("videoModal"));

  let allResources = [];
  let currentFilter = "all";

  async function init() {
    renderSkeletons();

    try {
      const [cats, resources, session] = await Promise.all([
        window.api.fetch("/api/categories"),
        window.api.fetch("/api/resources"),
        window.api.fetch("/api/session"),
      ]);

      const u = session?.user;
      const currentPage = window.location.pathname;

      if (!u) {
        window.location.replace("index.html");
        return;
      }

      const dashboardUrl =
        u.role === "admin"
          ? "admin.html"
          : u.is_rep
            ? "rep-dashboard.html"
            : "dashboard-modern.html";
      const navBrand = document.getElementById("navBrand");
      const backBtn = document.getElementById("backBtn");
      if (navBrand) navBrand.href = dashboardUrl;
      if (backBtn) backBtn.href = dashboardUrl;

      if (u.role === "admin" || u.is_rep || u.is_leader || u.is_creator) {
        if (uploadAction) {
          uploadAction.innerHTML = `
            <a href="upload-resource.html" class="btn btn-primary rounded-pill px-4 animate__animated animate__fadeIn">
                <i class="bi bi-cloud-arrow-up me-2"></i>Upload Resource
            </a>`;
        }
      }

      if (cats && Array.isArray(cats)) {
        cats.forEach((cat) => {
          const span = document.createElement("span");
          span.className =
            "badge rounded-pill bg-white text-dark border p-2 px-3 category-pill";
          span.dataset.cat = cat.id;
          span.textContent = cat.name;
          span.onclick = (e) => filterByCategory(cat.id, e);
          catContainer.appendChild(span);
        });
      }

      allResources = Array.isArray(resources) ? resources : [];
      setTimeout(() => renderLayout(allResources), 300);
    } catch (e) {
      console.error("Initialization Error:", e);
      grid.innerHTML = `<div class="text-center p-5 text-danger">Connection lost. Please log in again.</div>`;
    }
  }

  function renderLayout(items) {
    if (!items || !items.length) return renderResources([], "resourcesGrid");

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

    if (!items || !items.length) {
      container.innerHTML = `<div class="col-12 text-center py-5 text-muted">No resources found.</div>`;
      return;
    }

    container.innerHTML = items
      .map((res, index) => {
        const delay = (index % 4) * 0.1;
        let actionBtn = "";
        let mediaPreview = "";

        // Handle YouTube Resources
        if (res.youtube_id) {
          mediaPreview = `
    <div class="youtube-thumb" onclick="playVideo('${res.youtube_id}', '${res.title.replace(/'/g, "\\'")}', '${res.id}')">
        <img src="https://img.youtube.com/vi/${res.youtube_id}/hqdefault.jpg" 
             onerror="this.src='https://img.youtube.com/vi/${res.youtube_id}/0.jpg'"
             class="card-img-top" alt="Thumb" style="height: 180px; object-fit: cover;">
        <i class="bi bi-play-circle-fill play-overlay"></i>
    </div>`;

          actionBtn = `<button class="btn btn-sm btn-outline-danger w-100" onclick="playVideo('${res.youtube_id}', '${res.title.replace(/'/g, "\\'")}', '${res.id}')">Watch Video</button>`;
        }
        // Handle File Resources with Safety Check for null/undefined
        else if (res.url && res.url !== "null" && res.url !== "undefined") {
          mediaPreview = `
                <div class="p-4 text-center bg-light border-bottom">
                    <i class="bi ${getFileIcon(res.url)} display-4 text-success"></i>
                </div>`;

          // Construct final link - ensures relative paths don't break if you move to a subfolder
          const finalLink = res.url.startsWith("http") ? res.url : res.url;

          actionBtn = `<a href="${finalLink}" target="_blank" class="btn btn-sm btn-outline-success w-100">Open File</a>`;
        }
        // Fallback for resources with broken links
        else {
          mediaPreview = `
                <div class="p-4 text-center bg-light border-bottom">
                    <i class="bi bi-exclamation-octagon display-4 text-muted"></i>
                </div>`;
          actionBtn = `<button class="btn btn-sm btn-secondary w-100" disabled>Link Unavailable</button>`;
        }

        return `
            <div class="col-md-4 col-lg-3 animate__animated animate__fadeInUp" style="animation-delay: ${delay}s">
                <div class="card h-100 shadow-sm resource-card border-0">
                    ${mediaPreview}
                    <div class="card-body">
                        <h6 class="fw-bold mb-1 text-truncate">${res.title}</h6>
                        <p class="small text-muted mb-3 text-truncate">${res.description || "No description."}</p>
                        <div class="d-flex justify-content-between align-items-center mb-3" style="font-size: 0.75rem;">
                            <span class="badge bg-light text-primary border">${res.view_count || 0} views</span>
                            <span class="text-muted">${new Date(res.created_at).toLocaleDateString()}</span>
                        </div>
                        ${actionBtn}
                    </div>
                </div>
            </div>`;
      })
      .join("");
  }

  function renderSkeletons() {
    grid.innerHTML = Array(4)
      .fill(0)
      .map(
        () => `
        <div class="col-md-3">
            <div class="skeleton-card" style="height: 250px; background: #eee; border-radius: 12px; margin-bottom: 20px;"></div>
        </div>`,
      )
      .join("");
  }

  window.playVideo = async (id, title, resourceId) => {
    document.getElementById("videoTitle").textContent = title;

    // UI Update: Show Video
    document.getElementById("videoPlayerContainer").innerHTML = `
        <iframe src="https://www.youtube.com/embed/${id}?autoplay=1" allowfullscreen allow="autoplay" referrerpolicy="strict-origin-when-cross-origin" style="width:100%; height:100%; border:0;"></iframe>`;
    videoModal.show();

    // UI Update: Increment the view badge immediately (Optimistic UI)
    const viewBadge = document
      .querySelector(`[onclick*="${resourceId}"]`)
      .closest(".card-body")
      .querySelector(".badge");
    if (viewBadge) {
      let currentViews = parseInt(viewBadge.textContent) || 0;
      viewBadge.textContent = `${currentViews + 1} views`;
    }

    // Backend Update
    await window.api.post(`/api/resources/${resourceId}/view`);
  };

  function getFileIcon(url) {
    if (!url) return "bi-link-45deg";
    const lower = url.toLowerCase();
    if (lower.includes(".pdf")) return "bi-file-earmark-pdf";
    if (lower.includes(".ppt")) return "bi-file-earmark-ppt";
    return "bi-file-earmark-text";
  }

  function filterByCategory(catId, event) {
    document
      .querySelectorAll(".category-pill")
      .forEach((p) => p.classList.remove("active"));
    event.currentTarget.classList.add("active");
    currentFilter = catId;
    applyFilters();
  }

  function applyFilters() {
    const query = searchInput.value.toLowerCase();
    const filtered = allResources.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(query) ||
        (r.description && r.description.toLowerCase().includes(query));
      const matchesCat =
        currentFilter === "all" || r.category_id == currentFilter;
      return matchesSearch && matchesCat;
    });
    renderResources(filtered, "resourcesGrid");
  }

  searchInput.addEventListener("input", applyFilters);
  document
    .getElementById("videoModal")
    .addEventListener("hidden.bs.modal", () => {
      document.getElementById("videoPlayerContainer").innerHTML = "";
    });

  init();
});
