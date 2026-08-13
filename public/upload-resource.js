document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("resourceForm");
  const sourceType = document.getElementById("sourceType");
  const fileGroup = document.getElementById("fileGroup");
  const linkGroup = document.getElementById("linkGroup");
  const urlInput = document.getElementById("urlInput");
  const fileInput = document.getElementById("fileInput");
  const catDropdown = document.getElementById("catDropdown");
  const adminOptions = document.getElementById("adminOptions");
  const fileNameDisplay = document.getElementById("fileNameDisplay");
  const isGlobalCheckbox = document.getElementById("isGlobal");
  const programGroup = document.getElementById("programGroup");
  const programDropdown = document.getElementById("programDropdown");

  let currentUser = null;

  async function init() {
    try {
      const session = await window.api.fetch("/api/session");
      if (session && session.user) {
        currentUser = session.user;
        // Show Global option for Admins/Reps/Leaders
        if (currentUser.role === "admin" || currentUser.is_rep || currentUser.is_leader) {
          adminOptions.classList.remove("d-none");
        }
      }

      if (!window.api) throw new Error("API client not initialized");

      // Populate Categories & Programs independently or safely via Promise.allSettled or Promise.all
      const [categories, programs] = await Promise.all([
        window.api.fetch("/api/categories"),
        window.api.fetch("/api/programs")
      ]);

      console.log("Categories response:", categories);
      console.log("Programs response:", programs);

      if (Array.isArray(categories)) {
        catDropdown.innerHTML = `<option value="" disabled selected>Select category...</option>` +
          categories.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
      } else {
        catDropdown.innerHTML = `<option value="" disabled>Error loading categories</option>`;
      }

      if (Array.isArray(programs)) {
        programDropdown.innerHTML = `<option value="" disabled selected>Select target program...</option>` +
          programs.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
      } else {
        programDropdown.innerHTML = `<option value="" disabled>Error loading programs</option>`;
      }

    } catch (e) {
      console.error("Initialization Error:", e);
    }
  }

  // Handle Global Toggle
  isGlobalCheckbox?.addEventListener("change", (e) => {
    if (e.target.checked) {
      programGroup.classList.add("animate__animated", "animate__fadeOut");
      setTimeout(() => {
        programGroup.classList.add("d-none");
        programDropdown.removeAttribute("required");
      }, 300);
    } else {
      programGroup.classList.remove("d-none", "animate__fadeOut");
      programGroup.classList.add("animate__fadeIn");
      programDropdown.setAttribute("required", "required");
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      fileNameDisplay.innerHTML = `<i class="bi bi-check-circle-fill me-2"></i> Ready: ${e.target.files[0].name}`;
      fileNameDisplay.classList.remove("d-none");
    }
  });

  sourceType.addEventListener("change", (e) => {
    const val = e.target.value;
    fileGroup.classList.toggle("d-none", val !== "file");
    linkGroup.classList.toggle("d-none", val === "file");
    
    if (val === "file") {
      fileInput.setAttribute("required", "required");
      urlInput.removeAttribute("required");
    } else {
      fileInput.removeAttribute("required");
      urlInput.setAttribute("required", "required");
      document.getElementById("linkLabel").innerText = val === "youtube" ? "YOUTUBE URL" : "RESOURCE URL";
    }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    toggleBtn(true);

    const formData = new FormData(form);
    if (currentUser) {
      formData.append("institution_id", currentUser.institution_id);
    }

    if (sourceType.value === "youtube") {
      const ytId = extractYoutubeId(urlInput.value);
      if (!ytId) {
        alert("Please enter a valid YouTube link.");
        toggleBtn(false);
        return;
      }
      formData.append("youtube_id", ytId);
    }

    try {
      const res = await window.api.fetch("/api/resources", { method: "POST", body: formData });
      if (res.success) {
        alert("Resource published successfully!");
        window.location.href = "resources.html";
      } else {
        alert(res.message || "Upload failed.");
      }
    } catch (err) {
      alert("System error. Please try again later.");
    } finally {
      toggleBtn(false);
    }
  };

  function toggleBtn(loading) {
    document.getElementById("btnText").classList.toggle("d-none", loading);
    document.getElementById("btnLoader").classList.toggle("d-none", !loading);
  }

  function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  window.goBack = () => window.history.back();
  init();
});