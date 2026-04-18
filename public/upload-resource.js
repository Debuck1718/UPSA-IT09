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

  // Define this at the top level so goBack() can see it
  let currentUser = null;

  async function init() {
    try {
      const session = await window.api.fetch("/api/session");
      if (session && session.user) {
        currentUser = session.user; // Store the user data here

        // Toggle Admin/Rep options
        if (
          currentUser.role === "admin" ||
          currentUser.is_leader ||
          currentUser.is_creator
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

  // Updated goBack function
  window.goBack = () => {
    // If session hasn't loaded yet, just go to default
    if (!currentUser) {
      window.location.href = "dashboard-modern.html";
      return;
    }

    if (currentUser.role === "admin") {
      window.location.href = "admin.html";
    } else if (
      currentUser.is_rep ||
      currentUser.is_leader ||
      currentUser.is_creator
    ) {
      window.location.href = "rep-dashboard.html";
    } else {
      window.location.href = "dashboard-modern.html";
    }
  };

  // UI: Show selected filename
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      fileNameDisplay.textContent = `Selected: ${e.target.files[0].name}`;
      fileNameDisplay.classList.remove("d-none");
    }
  });

  // Toggle UI based on Format
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

    const isGlobalCheckbox = document.getElementById("isGlobal");
    // Send as string "true"/"false" so the backend parser handles it cleanly
    formData.set("is_global", isGlobalCheckbox.checked ? "true" : "false");

    if (sType === "file") {

      formData.delete("url");
      formData.delete("youtube_id");
    } else {
      // If it's a link, remove the file object so we don't send empty binary data
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
      // api.js handles the 'Content-Type' automatically because it sees 'FormData'
      const result = await window.api.fetch("/api/resources", {
        method: "POST",
        body: formData,
      });

      if (result && (result.ok || result.success)) {
        alert(
          result.autoApproved
            ? "Published successfully!"
            : "Submitted for moderation!",
        );
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
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  }

  init();
});
