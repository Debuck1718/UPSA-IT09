document.addEventListener('DOMContentLoaded', async () => {
    // Correct way to initialize the modal with Bootstrap 5
    const editModalEl = document.getElementById('editBioModal');
    const editModal = new bootstrap.Modal(editModalEl);

    async function init() {
        try {
            // Ensure the endpoint matches your backend
            const data = await window.api.fetch('/api/user/profile-full');
            
            if (!data) {
                throw new Error("No data received from server");
            }
            
            renderProfile(data);
        } catch (e) {
            console.error("Profile Fetch Error:", e);
            // Optional: alert("Failed to load profile. Please log in again.");
            // window.location.href = 'index.html';
        }
    }

    function renderProfile(data) {
        const { user, activity } = data;
        
        // 1. Basic Info with Fallbacks
        document.getElementById('userName').innerText = user.full_name || 'Campus Member';
        document.getElementById('userProgram').innerText = `${user.program || 'Student'} • ${user.class_group || 'Year 1'}`;
        document.getElementById('userBio').innerText = user.bio || 'Tell the campus community about yourself!';
        document.getElementById('bioInput').value = user.bio || ''; // Pre-fill modal
        document.getElementById('userInstitution').innerText = user.institution_id || 'UPSA Member';
        document.getElementById('userEmail').innerText = user.email || '';

        // 2. Profile Image/Avatar
        if (user.avatar_url) {
            const wrapper = document.getElementById('profileImageWrapper');
            wrapper.innerHTML = `<img src="${user.avatar_url}" class="profile-img" alt="Avatar">`;
        }

        // 3. Badge Hierarchy Logic
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

        // 4. Stats Check
        if (activity) {
            document.getElementById('postCount').innerText = activity.posts ? activity.posts.length : 0;
            document.getElementById('resourceCount').innerText = activity.resources ? activity.resources.length : 0;

            // 5. Activity Lists
            renderList('postsList', activity.posts || [], 'Post');
            renderList('resourcesList', activity.resources || [], 'Resource');
        }
    }

    function renderList(elementId, items, type) {
        const container = document.getElementById(elementId);
        if (!items || items.length === 0) return;

        container.innerHTML = items.map(item => `
            <div class="activity-card p-3 shadow-sm d-flex justify-content-between align-items-center mb-2">
                <div>
                    <h6 class="mb-1 fw-bold text-dark">${item.title || (item.content ? item.content.substring(0, 40) + '...' : 'Untitled')}</h6>
                    <small class="text-muted">${new Date(item.created_at).toLocaleDateString()}</small>
                </div>
                <span class="badge bg-light text-primary border">${type}</span>
            </div>
        `).join('');
    }

    // Save Bio Logic
    document.getElementById('saveBioBtn').onclick = async () => {
        const bio = document.getElementById('bioInput').value;
        const btn = document.getElementById('saveBioBtn');
        
        btn.disabled = true;
        btn.innerText = "Saving...";

        try {
            const res = await window.api.post('/api/user/update-bio', { bio });
            if (res.ok || res.success) {
                document.getElementById('userBio').innerText = bio;
                editModal.hide();
            }
        } catch (err) {
            alert("Failed to update bio.");
        } finally {
            btn.disabled = false;
            btn.innerText = "Save Bio";
        }
    };

    init();
});