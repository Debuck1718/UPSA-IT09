document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('announcementsList');
    const actionArea = document.getElementById('actionArea');

    async function init() {
        try {
            const [session, data] = await Promise.all([
                window.api.fetch('/api/session'),
                window.api.fetch('/api/announcements')
            ]);

            const u = session.user;
            // Hierarchy Check: Show "Create" button for Admins/Reps/Leaders
            if (u.role === 'admin' || u.role === 'rep' || u.is_leader) {
                actionArea.innerHTML = `
                    <a href="create-announcement.html" class="btn btn-primary btn-sm fw-bold">
                        <i class="bi bi-plus-lg me-1"></i> New Post
                    </a>`;
            }

            renderAnnouncements(data);
        } catch (e) {
            list.innerHTML = '<div class="alert alert-danger">Failed to fetch updates.</div>';
        }
    }

    function renderAnnouncements(items) {
        if (!items.length) {
            list.innerHTML = '<div class="text-center p-5 text-muted">No announcements at this time.</div>';
            return;
        }

        list.innerHTML = items.map(item => `
            <div class="card announcement-card mb-3 shadow-sm ${item.is_global ? 'global' : ''}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="author-badge text-uppercase">
                            <i class="bi bi-person-badge me-1"></i> ${item.author_name || 'Administrator'}
                        </span>
                        <small class="text-muted">${new Date(item.created_at).toLocaleDateString()}</small>
                    </div>
                    <h5 class="fw-bold mb-2">${item.title}</h5>
                    <p class="text-secondary mb-0" style="white-space: pre-wrap;">${item.content}</p>
                    ${item.is_global ? '<div class="mt-2"><span class="badge bg-warning text-dark small"><i class="bi bi-globe me-1"></i> Global Announcement</span></div>' : ''}
                </div>
            </div>
        `).join('');
    }

    init();
});