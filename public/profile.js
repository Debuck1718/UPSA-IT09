document.addEventListener('DOMContentLoaded', async () => {
    const editModalEl = document.getElementById('editBioModal');
    const editModal = new bootstrap.Modal(editModalEl);
    const wrapper = document.getElementById('profileImageWrapper');

    async function init() {
        try {
            const data = await window.api.fetch('/api/user/profile-full');
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
        document.getElementById('userName').innerText = user.full_name || 'Member';
        document.getElementById('userProgram').innerText = `${user.program || 'Student'} • ${user.class_group || ''}`;
        document.getElementById('userBio').innerText = user.bio || 'Add a bio to let others know who you are.';
        document.getElementById('bioInput').value = user.bio || '';
        document.getElementById('userStudentId').innerText = user.student_id || 'N/A';
        document.getElementById('userEmail').innerText = user.email || '';
        document.getElementById('userInstitution').innerText = user.institution_id === 'upsa-id' ? 'UPSA' : user.institution_id;

        // 2. Avatar
        if (user.avatar_url) {
            wrapper.innerHTML = `<img src="${user.avatar_url}" class="profile-img" alt="Avatar">`;
        }

        // 3. Badges (Dynamic check)
        const bc = document.getElementById('badgeContainer');
        bc.innerHTML = '';
        if (user.role === 'admin') bc.innerHTML += `<span class="badge-verified"><i class="bi bi-shield-check"></i> Admin</span>`;
        if (user.is_rep) bc.innerHTML += `<span class="badge-verified"><i class="bi bi-person-badge"></i> Course Rep</span>`;
        if (user.is_leader) bc.innerHTML += `<span class="badge-verified"><i class="bi bi-star-fill"></i> Class Leader</span>`;
        if (user.is_creator) bc.innerHTML += `<span class="badge-verified"><i class="bi bi-patch-check-fill"></i> Creator</span>`;

        // 4. Activity Stats
        if (activity) {
            document.getElementById('postCount').innerText = activity.posts ? activity.posts.length : 0;
            document.getElementById('resourceCount').innerText = activity.resources ? activity.resources.length : 0;
            renderList('postsList', activity.posts || [], 'Discussion');
            renderList('resourcesList', activity.resources || [], 'Resource');
        }
    }

    function renderList(id, items, label) {
        const container = document.getElementById(id);
        if (items.length === 0) return;
        container.innerHTML = items.map(i => `
            <div class="activity-card p-3 shadow-sm d-flex justify-content-between align-items-center mb-2">
                <div>
                    <h6 class="mb-1 fw-bold">${i.title || 'Untitled Activity'}</h6>
                    <small class="text-muted">${new Date(i.created_at).toLocaleDateString()}</small>
                </div>
                <span class="badge bg-light text-primary border">${label}</span>
            </div>
        `).join('');
    }

    // --- Profile Photo Upload ---
    document.getElementById('avatarInput').onchange = async (e) => {
        if (!e.target.files[0]) return;
        
        const formData = new FormData();
        formData.append('avatar', e.target.files[0]);
        
        wrapper.innerHTML = `<div class="spinner-border text-light mt-4"></div>`;

        try {
            const res = await window.api.fetch('/api/user/update-avatar', {
                method: 'POST',
                body: formData
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
    document.getElementById('saveBioBtn').onclick = async () => {
        const bio = document.getElementById('bioInput').value;
        try {
            await window.api.fetch('/api/user/update-bio', {
                method: 'POST',
                body: { bio }
            });
            document.getElementById('userBio').innerText = bio;
            editModal.hide();
        } catch (err) { alert("Error saving bio"); }
    };

    init();
});