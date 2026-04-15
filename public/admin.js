document.addEventListener('DOMContentLoaded', async () => {
    const alertBox = document.getElementById('alert');
    const usersBody = document.getElementById('usersBody');
    const pendingBody = document.getElementById('pendingResourcesBody');
    const approvalBadge = document.getElementById('approvalCount');
    const editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
    
    let allUsers = [];

    // --- Core Initialization ---
    async function init() {
        const session = await checkAdmin();
        if (!session) return;
        
        document.getElementById('adminHeaderName').textContent = session.fullName || "Admin";
        
        loadUsers();
        loadCategories();
        loadAnnouncements();
        loadForumModeration();
        loadPendingResources(); // New call
    }

    async function checkAdmin() {
        try {
            const data = await window.api.fetch('/api/session');
            if (!data?.user || data.user.role !== 'admin') {
                window.location.replace('index.html');
                return null;
            }
            return data.user;
        } catch (e) {
            window.location.replace('index.html');
            return null;
        }
    }

    // --- NEW: Resource Approval Logic ---
    async function loadPendingResources() {
        try {
            // Fetch resources where 'is_approved' is false
            const resources = await window.api.fetch('/api/admin/resources/pending');
            
            if (!resources || resources.length === 0) {
                pendingBody.innerHTML = '<tr><td colspan="3" class="text-center py-5 text-muted">No pending resources to review.</td></tr>';
                approvalBadge.classList.add('d-none');
                return;
            }

            approvalBadge.textContent = resources.length;
            approvalBadge.classList.remove('d-none');

            pendingBody.innerHTML = resources.map(r => `
                <tr>
                    <td class="ps-4">
                        <div class="fw-bold text-dark">${r.title}</div>
                        <div class="small text-muted">${r.category_name} • ${r.file_type || 'File'}</div>
                        <a href="${r.file_url}" target="_blank" class="btn btn-sm btn-link p-0 text-primary small">Review File <i class="bi bi-box-arrow-up-right"></i></a>
                    </td>
                    <td>
                        <div class="small fw-bold">${r.uploader_name || 'User'}</div>
                        <div class="text-muted" style="font-size: 0.75rem;">${new Date(r.created_at).toLocaleDateString()}</div>
                    </td>
                    <td class="text-end pe-4">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-success" onclick="processResource('${r.id}', 'approve')">
                                <i class="bi bi-check-lg"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="processResource('${r.id}', 'deny')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            pendingBody.innerHTML = '<tr><td colspan="3" class="text-center text-danger p-3">Failed to load verification queue.</td></tr>';
        }
    }

    window.processResource = async (id, action) => {
        const confirmMsg = action === 'approve' ? 'Approve this resource for public view?' : 'Deny and delete this resource permanently?';
        if (!confirm(confirmMsg)) return;

        try {
            await window.api.fetch(`/api/admin/resources/${id}/${action}`, {
                method: 'POST'
            });
            showAlert(`Resource ${action === 'approve' ? 'Approved' : 'Removed'} successfully`, 'success');
            loadPendingResources();
        } catch (err) {
            showAlert(err.message);
        }
    };

    // --- User Management ---
    async function loadUsers() {
        try {
            const res = await window.api.fetch('/api/admin/users');
            allUsers = Array.isArray(res) ? res : (res.users || []);
            renderUsers(allUsers);
        } catch (e) { showAlert('Failed to load users'); }
    }

    function renderUsers(items) {
        if (!usersBody) return;
        usersBody.innerHTML = items.map(u => `
            <tr>
                <td class="ps-4">
                    <div class="fw-bold">${u.fullName || u.full_name}</div>
                    <div class="text-muted small">${u.studentId || u.student_id}</div>
                </td>
                <td>
                    <div class="d-flex gap-1 flex-wrap">
                        ${u.is_rep ? '<span class="badge bg-success">REP</span>' : ''}
                        ${u.is_leader ? '<span class="badge bg-info">LEADER</span>' : ''}
                        ${u.is_creator ? '<span class="badge bg-warning text-dark">CREATOR</span>' : ''}
                        ${u.role === 'admin' ? '<span class="badge bg-danger">ADMIN</span>' : ''}
                    </div>
                </td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-primary" onclick="openUserModal('${u.studentId || u.student_id}')">Manage</button>
                </td>
            </tr>
        `).join('');
    }

    window.openUserModal = (sid) => {
        const u = allUsers.find(x => (x.studentId || x.student_id) == sid);
        if (!u) return;
        document.getElementById('editStudentId').value = sid;
        document.getElementById('modalUserName').textContent = u.fullName || u.full_name;
        document.getElementById('editBio').value = u.bio || '';
        document.getElementById('checkIsRep').checked = !!u.is_rep;
        document.getElementById('checkIsLeader').checked = !!u.is_leader;
        document.getElementById('checkIsCreator').checked = !!u.is_creator;
        document.getElementById('checkIsAdmin').checked = u.role === 'admin';
        editModal.show();
    };

    document.getElementById('editUserPermissionsForm').onsubmit = async (e) => {
        e.preventDefault();
        const sid = document.getElementById('editStudentId').value;
        const payload = {
            bio: document.getElementById('editBio').value,
            is_rep: document.getElementById('checkIsRep').checked,
            is_leader: document.getElementById('checkIsLeader').checked,
            is_creator: document.getElementById('checkIsCreator').checked,
            role: document.getElementById('checkIsAdmin').checked ? 'admin' : 'student'
        };
        try {
            await window.api.fetch(`/api/admin/users/${sid}/permissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            editModal.hide();
            showAlert('User credentials updated!', 'success');
            loadUsers();
        } catch (err) { showAlert(err.message); }
    };

    // --- Announcements ---
    async function loadAnnouncements() {
        const container = document.getElementById('announcementList');
        try {
            const anns = await window.api.fetch('/api/announcements');
            container.innerHTML = anns.map(a => `
                <div class="card card-body shadow-sm">
                    <div class="d-flex justify-content-between align-items-start">
                        <h6 class="fw-bold mb-1">${a.title}</h6>
                        <button class="btn btn-link btn-sm text-danger p-0" onclick="deleteAnn('${a.id}')"><i class="bi bi-trash"></i></button>
                    </div>
                    <p class="small text-muted mb-2">${a.content}</p>
                    <span class="badge bg-light text-dark align-self-start">${a.is_global ? 'Global' : 'Local'}</span>
                </div>
            `).join('');
        } catch (e) { container.innerHTML = '<p class="text-muted">No announcements found.</p>'; }
    }

    window.deleteAnn = async (id) => {
        if (!confirm('Permanently delete this announcement?')) return;
        try {
            await window.api.fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
            loadAnnouncements();
            showAlert('Announcement removed.', 'info');
        } catch (e) { showAlert(e.message); }
    };

    document.getElementById('announcementForm').onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            title: document.getElementById('annTitle').value,
            content: document.getElementById('annContent').value,
            is_global: document.getElementById('annTarget').value === 'global'
        };
        try {
            await window.api.fetch('/api/admin/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            e.target.reset();
            loadAnnouncements();
            showAlert('Broadcast published!', 'success');
        } catch (e) { showAlert(e.message); }
    };

    // --- Resource Categories ---
    async function loadCategories() {
        const list = document.getElementById('categoryList');
        try {
            const cats = await window.api.fetch('/api/categories');
            list.innerHTML = cats.map(c => `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-tag me-2"></i>${c.name}</span>
                    <button class="btn btn-link btn-sm text-danger" onclick="deleteCategory(${c.id})"><i class="bi bi-x-circle"></i></button>
                </div>
            `).join('');
        } catch (e) { list.innerHTML = '<div class="p-3">Error loading categories</div>'; }
    }

    window.deleteCategory = async (id) => {
        if (!confirm('Delete this category? (Will affect existing resources)')) return;
        try {
            await window.api.fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
            loadCategories();
        } catch (e) { showAlert(e.message); }
    };

    document.getElementById('addCatBtn').onclick = async () => {
        const name = document.getElementById('newCatName').value;
        if (!name) return;
        try {
            await window.api.fetch('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            document.getElementById('newCatName').value = '';
            loadCategories();
        } catch (e) { showAlert(e.message); }
    };

    // --- Forum Moderation ---
    async function loadForumModeration() {
        const list = document.getElementById('forumModerationList');
        try {
            const posts = await window.api.fetch('/api/admin/forum/posts');
            if (!posts.length) {
                list.innerHTML = '<div class="p-5 text-center text-muted">Zero flagged content. All clear!</div>';
                return;
            }
            list.innerHTML = posts.map(p => `
                <div class="list-group-item p-3 border-start border-4 border-danger">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="fw-bold text-primary">${p.user_name || 'Student'}</span>
                        <span class="badge bg-light text-dark small">${p.target_type}</span>
                    </div>
                    <p class="mb-2 small">${p.content}</p>
                    <button class="btn btn-sm btn-danger" onclick="deleteForumPost('${p.id}')">Remove Content</button>
                </div>
            `).join('');
        } catch (e) { list.innerHTML = '<div class="p-3">Failed to load forum feed.</div>'; }
    }

    window.deleteForumPost = async (id) => {
        if (!confirm('Permanently remove this post?')) return;
        try {
            await window.api.fetch(`/api/admin/forum/posts/${id}`, { method: 'DELETE' });
            loadForumModeration();
        } catch (e) { showAlert(e.message); }
    };

    // --- Helpers ---
    function showAlert(msg, type = 'danger') {
        alertBox.className = `alert alert-${type} shadow-sm d-block text-center fw-bold`;
        alertBox.textContent = msg;
        setTimeout(() => alertBox.classList.replace('d-block', 'd-none'), 3000);
    }

    document.getElementById('userSearch').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        renderUsers(allUsers.filter(u => 
            (u.fullName || u.full_name || '').toLowerCase().includes(q) || 
            (u.studentId || u.student_id || '').toLowerCase().includes(q)
        ));
    });

    document.getElementById('adminLogoutBtn').onclick = () => {
        window.api.fetch('/api/logout', { method: 'POST' }).finally(() => {
            window.location.replace('index.html');
        });
    };

    init();
});