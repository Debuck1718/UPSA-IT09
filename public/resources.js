document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("resourcesGrid");
  const catContainer = document.getElementById("categoryFilters");
  const searchInput = document.getElementById("resourceSearch");
  const uploadAction = document.getElementById("uploadAction");
  const videoModal = new bootstrap.Modal(document.getElementById("videoModal"));

  let allResources = [];
  let currentFilter = "all";

  function extractYouTubeId(value) {
    if (!value) return null;
    const str = String(value).trim();
    const patterns = [
      /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
      /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
      /(?:youtube\.com\/v\/)([A-Za-z0-9_-]{11})/,
      /([A-Za-z0-9_-]{11})/
    ];
    for (const re of patterns) {
      const match = str.match(re);
      if (match && match[1]) return match[1];
    }
    return null;
  }

  async function init() {
    renderSkeletons();

    try {
      const [cats, resourceResponse, session] = await Promise.all([
        window.api.fetch("/api/categories"),
        window.api.fetch("/api/resources"), // This returns { resources: [...] }
        window.api.fetch("/api/session"),
      ]);

      const u = session?.user;
      if (!u) {
        window.location.replace("index.html");
        return;
      }

      const dashboardUrl = u.role === "admin" ? "admin.html" : (u.is_rep ? "rep-dashboard.html" : "dashboard-modern.html");
      const navBrand = document.getElementById("navBrand");
      const backBtn = document.getElementById("backBtn");
      if (navBrand) navBrand.href = dashboardUrl;
      if (backBtn) backBtn.href = dashboardUrl;

      if (u.role === "admin" || u.is_rep || u.is_leader || u.is_creator) {
        if (uploadAction) {
          uploadAction.innerHTML = `
            <a href="upload-resource.html" class="btn btn-primary rounded-pill px-4 animate__animated animate__fadeIn">
                <i class="bi bi-cloud-arrow-up me-2"></i>Upload
            </a>`;
        }
      }

      if (cats && Array.isArray(cats)) {
        catContainer.innerHTML = `<span class="badge rounded-pill category-pill active" data-cat="all">All Resources</span>`;
        catContainer.querySelector('.category-pill').onclick = (e) => filterByCategory("all", e);

        cats.forEach((cat) => {
          const span = document.createElement("span");
          span.className = "badge rounded-pill category-pill";
          span.dataset.cat = cat.id;
          span.textContent = cat.name;
          span.onclick = (e) => filterByCategory(cat.id, e);
          catContainer.appendChild(span);
        });
      }

      // FIX: Unwrap the 'resources' key from the backend object envelope safely
      const rawResources = resourceResponse && Array.isArray(resourceResponse.resources) 
        ? resourceResponse.resources 
        : [];
      
      // Keep your dashboard filtering intact: Hide master files on this marketplace page
      allResources = rawResources.filter(res => {
        const isMaster = 
          res.is_master_compiled === true || 
          res.is_master_compiled === 'true' || 
          res.isMasterCompiled === true ||
          res.isMasterCompiled === 'true';
        return !isMaster;
      });
      
      applyFilters();
    } catch (e) {
      console.error("Initialization Error:", e);
      grid.innerHTML = `<div class="text-center p-5 text-danger">Connection Error. Please refresh.</div>`;
    }
  }

  function applyFilters() {
    const query = searchInput.value.toLowerCase();
    
    const filtered = allResources.filter((r) => {
      const matchesSearch = r.title.toLowerCase().includes(query) || (r.description && r.description.toLowerCase().includes(query));
      const matchesCat = currentFilter === "all" || r.category_id == currentFilter;
      return matchesSearch && matchesCat;
    });
    
    // Completely resets layout container logic if filters are active
    if (currentFilter !== "all" || query.length > 0) {
      grid.innerHTML = `
        <div class="col-12 mb-2"><h5 class="fw-bold"><i class="bi bi-collection me-2"></i>Filtered Results</h5></div>
        <div class="row g-4" id="filteredResourcesRow"></div>
      `;
      renderResources(filtered, "filteredResourcesRow");
    } else {
      // Normal state distribution layout loops
      const topResources = [...filtered]
        .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
        .slice(0, 4);

      grid.innerHTML = `
          <div class="col-12 mb-2"><h5 class="fw-bold"><i class="bi bi-fire text-danger me-2"></i>Trending</h5></div>
          <div class="row g-4 mb-4" id="topResourcesRow"></div>
          <div class="col-12 mb-2"><h5 class="fw-bold"><i class="bi bi-collection me-2"></i>All Resources</h5></div>
          <div class="row g-4" id="allResourcesRow"></div>
      `;

      renderResources(topResources, "topResourcesRow");
      renderResources(filtered, "allResourcesRow");
    }
  }

  function renderResources(items, targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;

    if (!items || !items.length) {
      container.innerHTML = `<div class="col-12 text-center py-5 text-muted">No items found matching your criteria.</div>`;
      return;
    }

    container.innerHTML = items.map((res, index) => {
      let actionBtn = "";
      let mediaPreview = "";

      const youTubeId = extractYouTubeId(res.youtube_id || res.youtubeId);
      if (youTubeId) {
        const safeTitle = String(res.title || "Video").replace(/'/g, "\\'");
        mediaPreview = `
          <div class="youtube-thumb" onclick="playVideo('${youTubeId}', '${safeTitle}', '${res.id}')">
              <img src="https://img.youtube.com/vi/${encodeURIComponent(youTubeId)}/hqdefault.jpg" class="card-img-top" style="height: 160px; object-fit: cover;">
              <i class="bi bi-play-circle-fill play-overlay"></i>
          </div>`;
        actionBtn = `<button class="btn btn-sm btn-outline-danger w-100" onclick="playVideo('${youTubeId}', '${safeTitle}', '${res.id}')">Watch Now</button>`;
      } else {
        mediaPreview = `<div class="p-4 text-center bg-light border-bottom"><i class="bi ${getFileIcon(res.url)} display-5 text-primary"></i></div>`;
        actionBtn = `<a href="${res.url}" target="_blank" class="btn btn-sm btn-outline-primary w-100">Open Resource</a>`;
      }

      return `
        <div class="col-md-4 col-lg-3 animate__animated animate__fadeInUp" style="animation-delay: ${index * 0.05}s">
            <div class="card h-100 shadow-sm resource-card border-0">
                ${mediaPreview}
                <div class="card-body">
                    <h6 class="fw-bold mb-1 text-truncate" title="${res.title}">${res.title}</h6>
                    <div class="d-flex justify-content-between align-items-center mb-3" style="font-size: 0.7rem;">
                        <span class="text-muted"><i class="bi bi-eye me-1"></i>${res.view_count || 0}</span>
                        <span class="text-muted">${new Date(res.created_at).toLocaleDateString()}</span>
                    </div>
                    ${actionBtn}
                </div>
            </div>
        </div>`;
    }).join("");
  }

  function renderSkeletons() {
    grid.innerHTML = Array(4).fill(0).map(() => `
        <div class="col-md-3"><div class="skeleton-card" style="height: 200px; background: #e9ecef; border-radius: 15px; margin-bottom: 20px;"></div></div>
    `).join("");
  }

  window.playVideo = async (id, title, resourceId) => {
    const videoId = extractYouTubeId(id);
    if (!videoId) return;

    document.getElementById("videoTitle").textContent = title;

    document.getElementById("videoPlayerContainer").innerHTML = `
      <iframe 
        src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0" 
        allowfullscreen 
        allow="autoplay; encrypted-media; picture-in-picture" 
        referrerpolicy="no-referrer-when-downgrade"
        style="width:100%; height:100%; border:0;">
      </iframe>`;
    
    videoModal.show();

    try {
      await window.api.post(`resources/${resourceId}/view`);
    } catch (err) {
      console.debug("View count update skipped:", err);
    }
  };

  function getFileIcon(url) {
    if (!url) return "bi-link-45deg";
    const lower = url.toLowerCase();
    if (lower.includes(".pdf")) return "bi-file-earmark-pdf";
    if (lower.includes(".ppt") || lower.includes(".pptx")) return "bi-file-earmark-ppt";
    return "bi-file-earmark-text";
  }

  function filterByCategory(catId, event) {
    document.querySelectorAll(".category-pill").forEach((p) => p.classList.remove("active"));
    event.currentTarget.classList.add("active");
    currentFilter = catId;
    applyFilters();
  }

  searchInput.addEventListener("input", applyFilters);

  document.getElementById("videoModal").addEventListener("hidden.bs.modal", () => {
    document.getElementById("videoPlayerContainer").innerHTML = "";
  });

  init();
});