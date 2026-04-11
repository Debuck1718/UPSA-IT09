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

  let userRole = "student";

  // 1. Initial Permission & Category Load
  async function init() {
    try {
      const session = await window.api.fetch("/api/session");
      if (session && session.user) {
        userRole = session.user.role;
        // Admins, Leaders, or Reps see the Global switch
        if (
          userRole === "admin" ||
          session.user.is_leader ||
          session.user.is_creator
        ) {
          adminOptions.classList.remove("d-none");
        }
      }

      const categories = await window.api.fetch("/api/categories");
      if (Array.isArray(categories)) {
        catDropdown.innerHTML =
          `<option value="" disabled selected>Select category...</option>` +
          categories
            .map((c) => `<option value="${c.id}">${c.name}</option>`)
            .join("");
      }
    } catch (e) {
      console.error("Init Error:", e);
    }
  }

  // Smart Back Button / Route Protection
  window.goBack = () => {
    // 1. Check for Admin first
    if (userRole === "admin") {
      window.location.href = "admin-dashboard.html";
      return;
    }


    if (userData.is_rep || userData.is_leader) {
      window.location.href = "rep-dashboard.html";
      // Or wherever your reps manage their class
      return;
    }

    // 3. Default for standard students
    window.location.href = "dashboard-modern.html";
  };

  // UI: Show selected filename
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      fileNameDisplay.textContent = `Selected: ${e.target.files[0].name}`;
      fileNameDisplay.classList.remove("d-none");
    }
  });

  // 2. Toggle UI based on Format
  sourceType.addEventListener("change", (e) => {
    const val = e.target.value;
    const linkLabel = document.getElementById("linkLabel");
    const linkHint = document.getElementById("linkHint");

    // Reset visibility
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

  // 3. Handle Form Submission
  form.onsubmit = async (e) => {
    e.preventDefault();

    const btnText = document.getElementById("btnText");
    const btnLoader = document.getElementById("btnLoader");

    btnText.classList.add("d-none");
    btnLoader.classList.remove("d-none");

    const formData = new FormData(form);
    const sType = sourceType.value;
    formData.append("type", sType);

    if (sType === "youtube") {
      const ytId = extractYoutubeId(urlInput.value.trim());
      if (!ytId) {
        alert("Invalid YouTube URL");
        resetBtn();
        return;
      }
      formData.append("youtube_id", ytId);
    }

    try {
      // Updated endpoint to match our new structure
      const result = await window.api.fetch("/api/resources", {
        method: "POST",
        body: formData,
      });

      if (result && result.ok) {
        alert(
          result.autoApproved
            ? "Published successfully!"
            : "Submitted for moderation!",
        );
        window.location.href = "resources.html";
      } else {
        throw new Error(result.message || "Action failed");
      }
    } catch (err) {
      alert(err.message);
    } finally {
      resetBtn();
    }

    function resetBtn() {
      btnText.classList.remove("d-none");
      btnLoader.classList.add("d-none");
    }
  };

  function extractYoutubeId(url) {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  init();
});
