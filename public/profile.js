document.addEventListener("DOMContentLoaded", async () => {
  const editModalEl = document.getElementById("editBioModal");
  const editModal = new bootstrap.Modal(editModalEl);
  const wrapper = document.getElementById("profileImageWrapper");
  const notifToggle = document.getElementById("notificationToggle");
  const notifLabel = document.getElementById("pushStatusLabel");

  async function init() {
    try {
      const data = await window.api.fetch("/api/user/profile-full");
      if (data && data.user) {
        renderProfile(data);
      }
    } catch (e) {
      console.error("Profile Fetch Error:", e);
    }
  }

  function renderProfile(data) {
    const { user, activity } = data;

    // 1. Text Info
    document.getElementById("userName").innerText = (user.fullName || user.firstName || "Member");
    document.getElementById("userProgram").innerText =
      `${user.program || "Student"} • ${user.class_group || ""}`;
    document.getElementById("userBio").innerText =
      user.bio || "Add a bio to let others know who you are.";
    document.getElementById("bioInput").value = user.bio || "";
    document.getElementById("classGroupInput").value = user.class_group || "";
    document.getElementById("userStudentId").innerText =
      user.student_id || "N/A";
    document.getElementById("userEmail").innerText = user.email || "";
    document.getElementById("userInstitution").innerText =
      user.institution_id === "upsa" || user.institution_id === "upsa-id"
        ? "UPSA"
        : user.institution_id;

    // 2. Avatar
    if (user.avatar_url) {
      wrapper.innerHTML = `<img src="${user.avatar_url}" class="profile-img" alt="Avatar">`;
    }

    // 3. Badges (Dynamic check)
    const bc = document.getElementById("badgeContainer");
    bc.innerHTML = "";
    if (user.role === "admin")
      bc.innerHTML += `<span class="badge-verified"><i class="bi bi-shield-check"></i> Admin</span>`;
    if (user.is_rep)
      bc.innerHTML += `<span class="badge-verified"><i class="bi bi-person-badge"></i> Course Rep</span>`;
    if (user.is_leader)
      bc.innerHTML += `<span class="badge-verified"><i class="bi bi-star-fill"></i> Class Leader</span>`;
    if (user.is_creator)
      bc.innerHTML += `<span class="badge-verified"><i class="bi bi-patch-check-fill"></i> Creator</span>`;

    // 4. Activity Stats
    if (activity) {
      document.getElementById("postCount").innerText = activity.posts
        ? activity.posts.length
        : 0;
      document.getElementById("resourceCount").innerText = activity.resources
        ? activity.resources.length
        : 0;
      renderList("postsList", activity.posts || [], "Discussion");
      renderList("resourcesList", activity.resources || [], "Resource");
    }
  }

  function renderList(id, items, label) {
    const container = document.getElementById(id);
    if (items.length === 0) return;
    container.innerHTML = items
      .map(
        (i) => `
            <div class="activity-card p-3 shadow-sm d-flex justify-content-between align-items-center mb-2">
                <div>
                    <h6 class="mb-1 fw-bold">${i.title || "Untitled Activity"}</h6>
                    <small class="text-muted">${new Date(i.created_at).toLocaleDateString()}</small>
                </div>
                <span class="badge bg-light text-primary border">${label}</span>
            </div>
        `,
      )
      .join("");
  }

  // --- Profile Photo Upload ---
  document.getElementById("avatarInput").onchange = async (e) => {
    if (!e.target.files[0]) return;

    const formData = new FormData();
    formData.append("avatar", e.target.files[0]);

    wrapper.innerHTML = `<div class="spinner-border text-light mt-4"></div>`;

    try {
      const res = await window.api.fetch("/api/user/update-avatar", {
        method: "POST",
        body: formData,
      });
      if (res.avatar_url) {
        wrapper.innerHTML = `<img src="${res.avatar_url}" class="profile-img">`;
      }
    } catch (err) {
      alert("Upload failed.");
      init(); // Reset UI
    }
  };

  // --- Bio Save ---
  document.getElementById("saveBioBtn").onclick = async () => {
    const bio = document.getElementById("bioInput").value;
    const classGroup = document.getElementById("classGroupInput").value;
    try {
      await window.api.fetch("/api/user/update-bio", {
        method: "POST",
        body: { bio, classGroup },
      });
      document.getElementById("userBio").innerText = bio;
      document.getElementById("userProgram").innerText =
        `${document.getElementById("userProgram").innerText.split(" • ")[0]} • ${classGroup.trim().toUpperCase()}`;
      editModal.hide();
    } catch (err) {
      alert("Error saving bio");
    }
  };

  async function checkNotificationStatus() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      notifToggle.disabled = true;
      notifLabel.innerText = "Not supported on this browser";
      return;
    }

    if (Notification.permission === "granted") {
      const enabled = await window.api.initPush({ prompt: false });
      if (enabled) {
        notifToggle.checked = true;
        notifLabel.innerText = "Notifications are active";
        notifLabel.classList.remove("text-muted", "text-danger");
        notifLabel.classList.add("text-success");
      } else {
        notifToggle.checked = false;
        notifLabel.innerText = "Enabled in browser; click toggle to activate";
        notifLabel.classList.remove("text-danger", "text-success");
        notifLabel.classList.add("text-muted");
      }
    } else if (Notification.permission === "denied") {
      notifToggle.disabled = true;
      notifToggle.checked = false;
      notifLabel.innerText = "Blocked in browser settings";
      notifLabel.classList.remove("text-success", "text-muted");
      notifLabel.classList.add("text-danger");
    } else {
      notifToggle.checked = false;
      notifLabel.innerText = "Click the toggle to enable notifications";
      notifLabel.classList.remove("text-success", "text-danger");
      notifLabel.classList.add("text-muted");
    }
  }

  // Handle the toggle interaction
  notifToggle.addEventListener("change", async () => {
    if (notifToggle.checked) {
      notifLabel.innerText = "Requesting permission...";
      notifLabel.classList.remove("text-danger", "text-success");
      notifLabel.classList.add("text-muted");
      try {
        const success = await window.api.initPush({ prompt: true });
        if (success) {
          notifToggle.checked = true;
          notifLabel.innerText = "Notifications are active";
          notifLabel.classList.remove("text-muted", "text-danger");
          notifLabel.classList.add("text-success");
        } else {
          notifToggle.checked = false;
          if (Notification.permission === "denied") {
            notifLabel.innerText = "Notifications blocked by browser. Update browser settings to enable.";
            notifLabel.classList.remove("text-muted", "text-success");
            notifLabel.classList.add("text-danger");
          } else {
            notifLabel.innerText = "Setup failed. Try again.";
            notifLabel.classList.remove("text-danger", "text-success");
            notifLabel.classList.add("text-muted");
          }
        }
      } catch (err) {
        notifToggle.checked = false;
        notifLabel.innerText = "Setup failed. Try again.";
        notifLabel.classList.remove("text-danger", "text-success");
        notifLabel.classList.add("text-muted");
        console.error("Notif Error:", err);
      }
    } else {
      notifLabel.innerText = "Disabling notifications...";
      notifLabel.classList.remove("text-success", "text-danger");
      notifLabel.classList.add("text-muted");
      try {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
          }
        }
        await window.api.fetch("/api/notifications/unsubscribe", {
          method: "POST",
        });
        notifLabel.innerText = "Notifications are disabled";
        notifLabel.classList.remove("text-success", "text-danger");
        notifLabel.classList.add("text-muted");
      } catch (err) {
        notifLabel.innerText = "Unable to disable fully. Change browser permissions if needed.";
        notifLabel.classList.remove("text-success", "text-muted");
        notifLabel.classList.add("text-danger");
        console.error("Unsubscribe error:", err);
      }
    }
  });

  checkNotificationStatus();
  init();
});
