document.addEventListener("DOMContentLoaded", async () => {
    const alertBox = document.getElementById("alert");
    const usersBody = document.getElementById("usersBody");
    const pendingBody = document.getElementById("pendingResourcesBody");
    const approvalBadge = document.getElementById("approvalCount");
    const editModal = new bootstrap.Modal(document.getElementById("editUserModal"));

    let allUsers = [];

    async function init() {
        const session = await checkAdmin();
        if (!session) return;

        document.getElementById("adminHeaderName").textContent = session.full_name || session.fullName || "Admin";

        // Initial data load
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

            if (!resources || resources.length === 0) {
                if (pendingBody) pendingBody.innerHTML = '<tr><td colspan="3" class="text-center py-5 text-muted">Queue is empty.</td></tr>';
                if (approvalBadge) approvalBadge.classList.add("d-none");
                return;
            }

            if (approvalBadge) {
                approvalBadge.textContent = resources.length;
                approvalBadge.classList.remove("d-none");
            }

            if (pendingBody) {
                pendingBody.innerHTML = resources.map(r => `
                    <tr>
                        <td class="ps-4">
                            <div class="fw-bold">${r.title}</div>
                            <div class="small text-muted">${r.category_name || 'Uncategorized'}</div>
                        </td>
                        <td><div class="small">${r.uploader_name || "Student"}</div></td>
                        <td class="text-end pe-4">
                            <div class="btn-group">
                                <button class="btn btn-sm btn-success" onclick="processResource('${r.id}', 'approve')"><i class="bi bi-check"></i></button>
                                <button class="btn btn-sm btn-outline-danger" onclick="processResource('${r.id}', 'deny')"><i class="bi bi-x"></i></button>
                            </div>
                        </td>
                    </tr>
                `).join("");
            }
        } catch (e) {
            console.error("Load Resources Error:", e);
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
            loadPendingResources();
        } catch (err) {
            showAlert(err.message);
        }
    };

    // --- User Management ---
    async function loadUsers() {
        try {
            const res = await window.api.fetch("/api/admin/users");
            // Handle both {users: []} and direct array responses
            allUsers = Array.isArray(res) ? res : (res.users || []);
            renderUsers(allUsers);
        } catch (e) {
            showAlert("Failed to load users");
        }
    }

    function renderUsers(items) {
        if (!usersBody) return;
        usersBody.innerHTML = items.map(u => {
            const sid = u.student_id || u.studentId;
            const name = u.full_name || u.fullName;
            return `
                <tr>
                    <td class="ps-4">
                        <div class="fw-bold">${name}</div>
                        <div class="text-muted small">${sid}</div>
                    </td>
                    <td>
                        <span class="badge bg-light text-dark border">${u.class_group || "No Class"}</span>
                    </td>
                    <td>
                        <div class="d-flex gap-1 flex-wrap">
                            ${u.role === "admin" ? '<span class="badge bg-danger">ADMIN</span>' : ""}
                            ${u.is_rep ? '<span class="badge bg-success">REP</span>' : ""}
                            ${u.is_leader ? '<span class="badge bg-primary">LEADER</span>' : ""}
                            ${u.is_creator ? '<span class="badge bg-info">CREATOR</span>' : ""}
                            ${(!u.is_rep && !u.is_leader && u.role !== 'admin') ? '<span class="badge bg-secondary">STUDENT</span>' : ""}
                        </div>
                    </td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-primary" onclick="openUserModal('${sid}')">Manage</button>
                    </td>
                </tr>
            `;
        }).join("");
    }

    window.openUserModal = (sid) => {
        const u = allUsers.find(x => (x.student_id || x.studentId) == sid);
        if (!u) return;

        document.getElementById("editStudentId").value = sid;
        document.getElementById("modalUserName").textContent = u.full_name || u.fullName;
        document.getElementById("editBio").value = u.bio || "";
        document.getElementById("checkIsRep").checked = !!u.is_rep;
        document.getElementById("checkIsLeader").checked = !!u.is_leader;
        document.getElementById("checkIsAdmin").checked = (u.role === "admin");
        
        editModal.show();
    };

    document.getElementById("editUserPermissionsForm").onsubmit = async (e) => {
        e.preventDefault();
        const sid = document.getElementById("editStudentId").value;
        
        const payload = {
            bio: document.getElementById("editBio").value.trim(),
            is_rep: document.getElementById("checkIsRep").checked,
            is_leader: document.getElementById("checkIsLeader").checked,
            role: document.getElementById("checkIsAdmin").checked ? "admin" : "student",
        };

        try {
            // Using the specific permission route to avoid general role conflicts
            await window.api.fetch(`/api/admin/users/${sid}/permissions`, {
                method: "POST",
                body: payload
            });
            
            editModal.hide();
            showAlert("Permissions updated!", "success");
            loadUsers(); 
        } catch (err) {
            showAlert(err.message || "Update failed");
        }
    };

    // --- Announcements ---
    async function loadAnnouncements() {
        const container = document.getElementById("announcementList");
        try {
            const anns = await window.api.fetch("/api/announcements");
            container.innerHTML = anns.map(a => `
                <div class="card card-body shadow-sm mb-2">
                    <div class="d-flex justify-content-between">
                        <h6 class="fw-bold mb-1">${a.title}</h6>
                        <button class="btn btn-sm text-danger" onclick="deleteAnn('${a.id}')"><i class="bi bi-trash"></i></button>
                    </div>
                    <p class="small text-muted mb-2">${a.content}</p>
                    <span class="badge bg-light text-dark align-self-start">${a.is_global ? "Global" : "Local"}</span>
                </div>
            `).join("");
        } catch (e) {
            container.innerHTML = "<p class='text-muted p-3'>No announcements found.</p>";
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
                body: payload
            });
            e.target.reset();
            loadAnnouncements();
            showAlert("Published!", "success");
        } catch (e) {
            showAlert(e.message);
        }
    };

    // --- Search & Search Toggle ---
    document.getElementById("userSearch").addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = allUsers.filter(u => 
            (u.full_name || u.fullName || "").toLowerCase().includes(q) ||
            (u.student_id || u.studentId || "").toLowerCase().includes(q) ||
            (u.class_group || "").toLowerCase().includes(q)
        );
        renderUsers(filtered);
    });

    // --- Categories ---
    async function loadCategories() {
        const list = document.getElementById("categoryList");
        try {
            const cats = await window.api.fetch("/api/categories");
            list.innerHTML = cats.map(c => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${c.name}</span>
                    <button class="btn btn-sm text-danger" onclick="deleteCategory('${c.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `).join("");
        } catch (e) {
            list.innerHTML = '<div class="p-3 text-muted">No categories found.</div>';
        }
    }

    document.getElementById("addCatBtn").onclick = async () => {
        const nameInput = document.getElementById("newCatName");
        const name = nameInput.value.trim();
        if (!name) return;

        try {
            await window.api.fetch("/api/admin/categories", {
                method: "POST",
                body: { name }
            });
            nameInput.value = "";
            loadCategories();
            showAlert("Category added!", "success");
        } catch (e) {
            showAlert(e.message);
        }
    };

    // --- Global Helpers ---
    window.deleteAnn = async (id) => {
        if (!confirm("Delete this broadcast?")) return;
        try {
            await window.api.fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
            loadAnnouncements();
            showAlert("Deleted", "success");
        } catch (e) { showAlert(e.message); }
    };

    document.getElementById("adminLogoutBtn").onclick = () => {
        window.api.fetch("/api/logout", { method: "POST" })
            .finally(() => window.location.replace("index.html"));
    };

    function showAlert(msg, type = "danger") {
        alertBox.className = `alert alert-${type} shadow-sm d-block text-center fw-bold`;
        alertBox.textContent = msg;
        setTimeout(() => alertBox.classList.replace("d-block", "d-none"), 3000);
    }

    // --- Forum Moderation Logic ---
async function loadForumModeration() {
    const list = document.getElementById("forumModerationList");
    if (!list) return;

    try {
        const posts = await window.api.fetch("/api/admin/forum/posts");
        
        if (!posts || posts.length === 0) {
            list.innerHTML = '<div class="p-4 text-center text-muted">No forum posts found.</div>';
            return;
        }

        list.innerHTML = posts.map(p => `
            <div class="list-group-item border-start-0 border-end-0 py-3">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <span class="fw-bold">${p.user_name || 'Anonymous'}</span>
                            <span class="badge bg-light text-dark border small" style="font-size: 0.7rem;">
                                ${p.target_type || 'global'}
                            </span>
                            <span class="text-muted small">${new Date(p.created_at).toLocaleDateString()}</span>
                        </div>
                        <p class="mb-0 small text-secondary">${p.content}</p>
                    </div>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="deleteForumPost('${p.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `).join("");
    } catch (e) {
        list.innerHTML = '<div class="p-3 text-danger small">Failed to load forum moderation data.</div>';
    }
}

// Global function to handle post deletion
window.deleteForumPost = async (id) => {
    if (!confirm("Are you sure you want to remove this post? This action cannot be undone.")) return;

    try {
        await window.api.fetch(`/api/admin/forum/posts/${id}`, {
            method: "DELETE"
        });
        showAlert("Post removed successfully", "success");
        loadForumModeration(); 
    } catch (err) {
        showAlert(err.message || "Failed to delete post");
    }
};

    init();
});
