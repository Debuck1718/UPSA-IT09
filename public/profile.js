document.addEventListener('DOMContentLoaded', async () => {
    const editModal = new bootstrap.Modal(document.getElementById('editBioModal'));

    async function init() {
        try {
            const data = await window.api.fetch('/api/user/profile-full');
            renderProfile(data);
        } catch (e) {
            console.error(e);
            window.location.href = 'index.html';
        }
    }

    function renderProfile(data) {
        const { user, activity } = data;
        
        // Basic Info
        document.getElementById('userName').innerText = user.full_name;
        document.getElementById('userProgram').innerText = `${user.program} • ${user.class_group}`;
        document.getElementById('userBio').innerText = user.bio || 'Tell the campus community about yourself!';
        document.getElementById('userInstitution').innerText = user.institution_id || 'Campus Member';
        document.getElementById('userEmail').innerText = user.email;

        // Badge Hierarchy Logic
        const badgeContainer = document.getElementById('badgeContainer');
        badgeContainer.innerHTML = '';

        if (user.role === 'admin') {
            badgeContainer.innerHTML += `<span class="badge-verified"><i class="bi bi-shield-check me-1"></i> System Admin</span>`;
        }
        if (user.is_leader) {
            badgeContainer.innerHTML += `<span class="badge-verified"><i class="bi bi-star-fill me-1"></i> Class Leader</span>`;
        }
        if (user.is_creator) {
            badgeContainer.innerHTML += `<span class="badge-verified"><i class="bi bi-patch-check-fill me-1"></i> Verified Creator</span>`;
        }

        // Stats
        document.getElementById('postCount').innerText = activity.posts.length;
        document.getElementById('resourceCount').innerText = activity.resources.length;

        // Activity Lists
        renderList('postsList', activity.posts, 'Post');
        renderList('resourcesList', activity.resources, 'Resource');
    }

    function renderList(elementId, items, type) {
        const container = document.getElementById(elementId);
        if (!items.length) return;

        container.innerHTML = items.map(item => `
            <div class="activity-card p-3 shadow-sm d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1 fw-bold">${item.title || item.content.substring(0, 40) + '...'}</h6>
                    <small class="text-muted">${new Date(item.created_at).toLocaleDateString()}</small>
                </div>
                <span class="badge bg-light text-dark border">${type}</span>
            </div>
        `).join('');
    }

    // Save Bio Logic
    document.getElementById('saveBioBtn').onclick = async () => {
        const bio = document.getElementById('bioInput').value;
        const res = await window.api.post('/api/user/update-bio', { bio });
        if (res.ok) {
            document.getElementById('userBio').innerText = bio;
            editModal.hide();
        }
    };

    init();
});