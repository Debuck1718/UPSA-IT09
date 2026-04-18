document.addEventListener("DOMContentLoaded", async () => {
  const alertBox = document.getElementById("alert");
  const usersBody = document.getElementById("usersBody");
  const pendingBody = document.getElementById("pendingResourcesBody");
  const approvalBadge = document.getElementById("approvalCount");
  const editModal = new bootstrap.Modal(
    document.getElementById("editUserModal"),
  );

  let allUsers = [];

  async function init() {
    const session = await checkAdmin();
    if (!session) return;

    document.getElementById("adminHeaderName").textContent =
      session.fullName || "Admin";

    loadUsers();
    loadCategories();
    loadAnnouncements();
    loadForumModeration();
    loadPendingResources();
  }

  async function checkAdmin() {
    try {
      const data = await window.api.fetch("/api/session");
      if (!data?.user || data.user.role !== "admin") {
        window.location.replace("index.html");
        return null;
      }
      return data.user;
    } catch (e) {
      window.location.replace("index.html");
      return null;
    }
  }

  // --- Resource Verification Logic ---
  async function loadPendingResources() {
    try {
      const resources = await window.api.fetch("/api/admin/resources/pending");

      // Fix: Actually reading and updating the badge count
      if (!resources || resources.length === 0) {
        if (pendingBody)
          pendingBody.innerHTML =
            '<tr><td colspan="3" class="text-center py-5 text-muted">Queue is empty.</td></tr>';
        if (approvalBadge) approvalBadge.classList.add("d-none");
        return;
      }

      if (approvalBadge) {
        approvalBadge.textContent = resources.length;
        approvalBadge.classList.remove("d-none");
      }

      if (pendingBody) {
        pendingBody.innerHTML = resources
          .map(
            (r) => `
                    <tr>
                        <td class="ps-4">
                            <div class="fw-bold">${r.title}</div>
                            <div class="small text-muted">${r.category_name}</div>
                        </td>
                        <td><div class="small">${r.uploader_name || "Student"}</div></td>
                        <td class="text-end pe-4">
                            <div class="btn-group">
                                <button class="btn btn-sm btn-success" onclick="processResource('${r.id}', 'approve')"><i class="bi bi-check"></i></button>
                                <button class="btn btn-sm btn-outline-danger" onclick="processResource('${r.id}', 'deny')"><i class="bi bi-x"></i></button>
                            </div>
                        </td>
                    </tr>
                `,
          )
          .join("");
      }
    } catch (e) {
      console.error(e);
    }
  }

  window.processResource = async (id, action) => {
    const status = action === 'approve' ? 'approved' : 'rejected';
    
    if (!confirm(`Are you sure you want to ${action} this?`)) return;

    try {
        await window.api.fetch(`/api/admin/resources/${id}/status`, {
            method: "PATCH",
            body: { status: status } 
        });

        showAlert(`Resource ${status} successfully`, "success");
        
        // Refresh the UI
        if (typeof loadPendingResources === "function") {
            loadPendingResources();
        }
    } catch (err) {
        showAlert(err.message);
    }
};

  // --- User Management (With Class Group) ---
  async function loadUsers() {
    try {
      const res = await window.api.fetch("/api/admin/users");
      allUsers = Array.isArray(res) ? res : res.users || [];
      renderUsers(allUsers);
    } catch (e) {
      showAlert("Failed to load users");
    }
  }

  function renderUsers(items) {
    if (!usersBody) return;
    usersBody.innerHTML = items
      .map(
        (u) => `
            <tr>
                <td class="ps-4">
                    <div class="fw-bold">${u.fullName || u.full_name}</div>
                    <div class="text-muted small">${u.studentId || u.student_id}</div>
                </td>
                <td>
                    <span class="badge bg-light text-dark border">${u.class_group || "No Class"}</span>
                </td>
                <td>
                    <div class="d-flex gap-1 flex-wrap">
                        ${u.is_rep ? '<span class="badge bg-success">REP</span>' : ""}
                        ${u.role === "admin" ? '<span class="badge bg-danger">ADMIN</span>' : ""}
                    </div>
                </td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary" onclick="openUserModal('${u.studentId || u.student_id}')">Manage</button>
                </td>
            </tr>
        `,
      )
      .join("");
  }

  window.openUserModal = (sid) => {
    const u = allUsers.find((x) => (x.studentId || x.student_id) == sid);
    if (!u) return;
    document.getElementById("editStudentId").value = sid;
    document.getElementById("modalUserName").textContent =
      u.fullName || u.full_name;
    document.getElementById("editBio").value = u.bio || "";
    document.getElementById("checkIsRep").checked = !!u.is_rep;
    document.getElementById("checkIsAdmin").checked = u.role === "admin";
    editModal.show();
  };

  document.getElementById("editUserPermissionsForm").onsubmit = async (e) => {
    e.preventDefault();
    const sid = document.getElementById("editStudentId").value;
    const payload = {
      bio: document.getElementById("editBio").value,
      is_rep: document.getElementById("checkIsRep").checked,
      role: document.getElementById("checkIsAdmin").checked
        ? "admin"
        : "student",
    };
    try {
      await window.api.fetch(`/api/admin/users/${sid}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      editModal.hide();
      showAlert("Updated!", "success");
      loadUsers();
    } catch (err) {
      showAlert(err.message);
    }
  };

  // --- Announcements & Others ---
  async function loadAnnouncements() {
    const container = document.getElementById("announcementList");
    try {
      const anns = await window.api.fetch("/api/announcements");
      container.innerHTML = anns
        .map(
          (a) => `
                <div class="card card-body shadow-sm">
                    <div class="d-flex justify-content-between">
                        <h6 class="fw-bold mb-1">${a.title}</h6>
                        <button class="btn btn-sm text-danger" onclick="deleteAnn('${a.id}')"><i class="bi bi-trash"></i></button>
                    </div>
                    <p class="small text-muted mb-2">${a.content}</p>
                    <span class="badge bg-light text-dark align-self-start">${a.is_global ? "Global" : "Local"}</span>
                </div>
            `,
        )
        .join("");
    } catch (e) {
      container.innerHTML = "<p>No announcements found.</p>";
    }
  }

  document.getElementById("announcementForm").onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById("annTitle").value,
      content: document.getElementById("annContent").value,
      is_global: document.getElementById("annTarget").value === "global",
    };
    try {
      await window.api.fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      e.target.reset();
      loadAnnouncements();
      showAlert("Published!", "success");
    } catch (e) {
      showAlert(e.message);
    }
  };

  // --- Search & Logout ---
  document.getElementById("userSearch").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    renderUsers(
      allUsers.filter(
        (u) =>
          (u.fullName || u.full_name || "").toLowerCase().includes(q) ||
          (u.studentId || u.student_id || "").toLowerCase().includes(q) ||
          (u.class_group || "").toLowerCase().includes(q),
      ),
    );
  });

  document.getElementById("adminLogoutBtn").onclick = () => {
    window.api
      .fetch("/api/logout", { method: "POST" })
      .finally(() => window.location.replace("index.html"));
  };

  function showAlert(msg, type = "danger") {
    alertBox.className = `alert alert-${type} shadow-sm d-block text-center fw-bold`;
    alertBox.textContent = msg;
    setTimeout(() => alertBox.classList.replace("d-block", "d-none"), 3000);
  }

  // --- ADD THESE TO THE BOTTOM OF admin.js ---

  async function loadCategories() {
    const list = document.getElementById("categoryList");
    try {
      const cats = await window.api.fetch("/api/categories");
      list.innerHTML = cats
        .map(
          (c) => `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <span>${c.name}</span>
                <button class="btn btn-sm text-danger" onclick="deleteCategory('${c.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `,
        )
        .join("");
    } catch (e) {
      list.innerHTML = '<div class="p-3 text-muted">No categories found.</div>';
    }
  }

  // Function to handle adding new categories
  document.getElementById("addCatBtn").onclick = async () => {
    const nameInput = document.getElementById("newCatName");
    const name = nameInput.value.trim();
    if (!name) return;

    try {
      await window.api.fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      nameInput.value = "";
      loadCategories();
      showAlert("Category added!", "success");
    } catch (e) {
      showAlert(e.message);
    }
  };

  // Placeholder for other missing calls to prevent errors
  async function loadForumModeration() {
    const list = document.getElementById("forumModerationList");
    if (list)
      list.innerHTML =
        '<div class="p-3 text-center text-muted small">Forum moderation coming soon.</div>';
  }

  // Global function to delete announcements
  window.deleteAnn = async (id) => {
    if (!confirm("Delete this broadcast?")) return;
    try {
      await window.api.fetch(`/api/admin/announcements/${id}`, {
        method: "DELETE",
      });
      loadAnnouncements();
      showAlert("Deleted", "success");
    } catch (e) {
      showAlert(e.message);
    }
  };

  init();
});
