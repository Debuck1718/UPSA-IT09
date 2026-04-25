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
  
  // NEW: Program Narrowing Elements
  const isGlobalCheckbox = document.getElementById("isGlobal");
  const programGroup = document.getElementById("programGroup"); // Ensure this ID is in your HTML
  const programDropdown = document.getElementById("programDropdown"); // Ensure this ID is in your HTML

  let currentUser = null;

  async function init() {
    try {
      const session = await window.api.fetch("/api/session");
      if (session && session.user) {
        currentUser = session.user;

        if (currentUser.role === "admin" || currentUser.is_leader || currentUser.is_creator) {
          adminOptions.classList.remove("d-none");
        }
      }

      // 1. Fetch Categories
      const categories = await window.api.fetch("/api/categories");
      if (Array.isArray(categories)) {
        catDropdown.innerHTML = `<option value="" disabled selected>Select category...</option>` +
          categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
      }

      // 2. NEW: Fetch Programs to populate the dropdown
      // This ensures the resource is tagged to a specific class/program
      const programs = await window.api.fetch("/api/programs"); 
      if (Array.isArray(programs)) {
        programDropdown.innerHTML = `<option value="" disabled selected>Select target program...</option>` +
          programs.map((p) => `<option value="${p.program_id}">${p.program_name || p.program}</option>`).join("");
      }

    } catch (e) {
      console.error("Init Error:", e);
    }
  }

  // 3. NEW: Toggle Program Dropdown based on is_global
  if (isGlobalCheckbox) {
    isGlobalCheckbox.addEventListener("change", (e) => {
      if (e.target.checked) {
        programGroup.classList.add("d-none");
        programDropdown.removeAttribute("required");
        programDropdown.value = ""; // Clear selection if global
      } else {
        programGroup.classList.remove("d-none");
        programDropdown.setAttribute("required", "required");
      }
    });
  }

  window.goBack = () => {
    if (!currentUser) {
      window.location.href = "dashboard-modern.html";
      return;
    }
    if (currentUser.role === "admin") {
      window.location.href = "admin.html";
    } else if (currentUser.is_rep || currentUser.is_leader || currentUser.is_creator) {
      window.location.href = "rep-dashboard.html";
    } else {
      window.location.href = "dashboard-modern.html";
    }
  };

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      fileNameDisplay.textContent = `Selected: ${e.target.files[0].name}`;
      fileNameDisplay.classList.remove("d-none");
    }
  });

  sourceType.addEventListener("change", (e) => {
    const val = e.target.value;
    const linkLabel = document.getElementById("linkLabel");
    const linkHint = document.getElementById("linkHint");

    fileGroup.classList.add("d-none");
    linkGroup.classList.add("d-none");

    if (val === "file") {
      fileGroup.classList.remove("d-none");
      fileInput.setAttribute("required", "required");
      urlInput.removeAttribute("required");
    } else {
      linkGroup.classList.remove("d-none");
      fileInput.removeAttribute("required");
      urlInput.setAttribute("required", "required");

      if (val === "youtube") {
        linkLabel.innerText = "YOUTUBE URL";
        linkHint.innerText = "Tutorials, Lectures, or Seminars";
        urlInput.placeholder = "https://youtube.com/watch?v=...";
      } else {
        linkLabel.innerText = "WEBSITE URL";
        linkHint.innerText = "Articles, Drive folders, or Research papers";
        urlInput.placeholder = "https://example.com/file.pdf";
      }
    }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const btnText = document.getElementById("btnText");
    const btnLoader = document.getElementById("btnLoader");

    btnText.classList.add("d-none");
    btnLoader.classList.remove("d-none");

    const formData = new FormData(form);
    const sType = sourceType.value;

    formData.append("type", sType);

    // 4. NEW: Scoping Data (Integrity)
    // Always attach the uploader's institution so it stays within the school
    if (currentUser) {
      formData.append("institution_id", currentUser.institution_id);
      formData.append("uploader_id", currentUser.id);
    }

    // Handle is_global
    formData.set("is_global", isGlobalCheckbox.checked ? "true" : "false");

    if (sType === "file") {
      formData.delete("url");
      formData.delete("youtube_id");
    } else {
      formData.delete("file");
      if (sType === "youtube") {
        const ytId = extractYoutubeId(urlInput.value.trim());
        if (!ytId) {
          alert("Please enter a valid YouTube URL");
          resetBtn();
          return;
        }
        formData.set("youtube_id", ytId);
      } else {
        formData.delete("youtube_id");
      }
    }

    try {
      const result = await window.api.fetch("/api/resources", {
        method: "POST",
        body: formData,
      });

      if (result && (result.ok || result.success)) {
        alert(result.autoApproved ? "Published successfully!" : "Submitted for moderation!");
        window.location.href = "resources.html";
      } else {
        throw new Error(result.message || "Upload failed. Please try again.");
      }
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      resetBtn();
    }

    function resetBtn() {
      btnText.classList.remove("d-none");
      btnLoader.classList.add("d-none");
    }
  };

  function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  init();
});