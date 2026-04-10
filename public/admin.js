document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert');
  const usersBody = document.getElementById('usersBody');
  const userSearch = document.getElementById('userSearch');
  const editModal = new bootstrap.Modal(document.getElementById('editUserModal'));
  
  let allUsers = [];

  // --- Initial Load ---
  async function init() {
    const session = await checkAdmin();
    if (!session) return;
    document.getElementById('adminHeaderName').textContent = session.fullName;
    await Promise.all([loadUsers(), loadCategories(), loadAnnouncements(), loadForumModeration()]);
  }

  async function checkAdmin() {
    const data = await window.api.fetch('/api/session');
    if (!data?.user || data.user.role !== 'admin') {
      window.location.assign('/public/index.html');
      return null;
    }
    return data.user;
  }

  // --- User Management (Permissions & Booleans) ---
  async function loadUsers() {
    const res = await window.api.fetch('/api/admin/users');
    allUsers = Array.isArray(res) ? res : (res.users || []);
    renderUsers(allUsers);
  }

  function renderUsers(items) {
    if (!usersBody) return;
    usersBody.innerHTML = items.map(u => `
      <tr>
        <td>
          <div class="fw-bold">${u.fullName || u.full_name}</div>
          <div class="text-muted small">${u.studentId || u.student_id}</div>
        </td>
        <td>
          <div class="small">${u.program || 'N/A'}</div>
          <span class="badge bg-light text-dark border" style="font-size:10px">${u.classGroup || 'No Group'}</span>
        </td>
        <td>
          <div class="d-flex gap-1 flex-wrap">
            ${u.is_rep ? '<span class="badge bg-success">REP</span>' : ''}
            ${u.is_leader ? '<span class="badge bg-info">LEADER</span>' : ''}
            ${u.is_creator ? '<span class="badge bg-warning text-dark">CREATOR</span>' : ''}
            ${u.role === 'admin' ? '<span class="badge bg-danger">ADMIN</span>' : ''}
          </div>
        </td>
        <td class="text-end px-3">
          <button class="btn btn-sm btn-outline-primary" onclick="openUserModal('${u.studentId || u.student_id}')">Manage</button>
        </td>
      </tr>
    `).join('');
  }

  window.openUserModal = (sid) => {
    const u = allUsers.find(x => (x.studentId || x.student_id) == sid);
    if (!u) return;
    document.getElementById('editStudentId').value = sid;
    document.getElementById('modalUserName').textContent = u.fullName;
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
      showAlert('Permissions updated!', 'success');
      loadUsers();
    } catch (err) { showAlert(err.message); }
  };

  // --- Forum Moderation (FORUM_POSTS table) ---
  async function loadForumModeration() {
    const list = document.getElementById('forumModerationList');
    try {
      const posts = await window.api.fetch('/api/admin/forum/posts');
      if (!posts.length) {
        list.innerHTML = '<div class="p-5 text-center text-muted">No posts found.</div>';
        return;
      }
      list.innerHTML = posts.map(p => `
        <div class="list-group-item p-3">
          <div class="d-flex justify-content-between">
            <span class="fw-bold small text-primary">${p.user_name || 'Anonymous'}</span>
            <span class="badge bg-light text-dark">${p.target_type}</span>
          </div>
          <p class="mb-2 mt-1 small">${p.content}</p>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteForumPost('${p.id}')">Delete Post</button>
        </div>
      `).join('');
    } catch (e) { list.innerHTML = '<div class="p-3 text-danger">Failed to load forum.</div>'; }
  }

  window.deleteForumPost = async (postId) => {
    if (!confirm('Permanently delete this post and its replies?')) return;
    try {
      await window.api.fetch(`/api/admin/forum/posts/${postId}`, { method: 'DELETE' });
      loadForumModeration();
    } catch (e) { showAlert(e.message); }
  };

  // --- Announcements & Categories (Identical to previous logic but updated for new UI) ---
  async function loadAnnouncements() {
    const container = document.getElementById('announcementList');
    const anns = await window.api.fetch('/api/announcements');
    container.innerHTML = anns.map(a => `
      <div class="card card-body shadow-sm border-0">
        <h6 class="fw-bold mb-1">${a.title}</h6>
        <p class="small text-muted mb-2">${a.content}</p>
        <div class="d-flex justify-content-between align-items-center">
          <span class="badge bg-light text-dark small">${a.is_global ? 'Global' : 'Targeted'}</span>
          <button class="btn btn-link btn-sm text-danger" onclick="deleteAnn('${a.id}')">Remove</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('announcementForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title: document.getElementById('annTitle').value,
      content: document.getElementById('annContent').value,
      is_global: document.getElementById('annTarget').value === 'global'
    };
    await window.api.fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    e.target.reset();
    loadAnnouncements();
    showAlert('Announcement posted!', 'success');
  };

  async function loadCategories() {
    const cats = await window.api.fetch('/api/categories');
    document.getElementById('categoryList').innerHTML = cats.map(c => `
      <div class="list-group-item d-flex justify-content-between align-items-center">
        <span><i class="${c.icon_class || 'bi-tag'} me-2"></i>${c.name}</span>
        <button class="btn btn-link btn-sm text-danger" onclick="deleteCategory(${c.id})"><i class="bi bi-trash"></i></button>
      </div>
    `).join('');
  }

  document.getElementById('addCatBtn').onclick = async () => {
    const name = document.getElementById('newCatName').value;
    if (!name) return;
    await window.api.fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    document.getElementById('newCatName').value = '';
    loadCategories();
  };

  // --- Global Helpers ---
  function showAlert(msg, type = 'danger') {
    alertBox.className = `alert alert-${type} shadow-sm d-block`;
    alertBox.textContent = msg;
    setTimeout(() => alertBox.classList.replace('d-block', 'd-none'), 3000);
  }

  userSearch?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderUsers(allUsers.filter(u => `${u.fullName} ${u.studentId}`.toLowerCase().includes(q)));
  });

  document.getElementById('adminLogoutBtn').onclick = () => window.api.fetch('/api/logout', { method: 'POST' }).then(() => window.location.assign('/public/index.html'));

  init();
});