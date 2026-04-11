document.addEventListener('DOMContentLoaded', async () => {
    const list = document.getElementById('announcementsList');
    const badge = document.getElementById('countBadge');
    const adminAction = document.getElementById('adminAction');

    // Smart Back Logic
    window.goBack = () => {
        const dest = sessionStorage.getItem('dashboard') || 'dashboard-modern.html';
        window.location.href = dest;
    };

    async function loadAnnouncements() {
        // Show Loading State
        list.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="spinner-border text-primary" role="status"></div>
                <p class="mt-2 text-muted">Tuning into the broadcast...</p>
            </div>`;

        try {
            const [data, session] = await Promise.all([
                window.api.fetch('/api/announcements'),
                window.api.fetch('/api/session')
            ]);

            const u = session?.user;
            
            if (u && (u.role === 'admin' || u.is_leader === true || u.is_rep === true)) {
                adminAction.innerHTML = `
                    <a href="create-announcement.html" class="btn btn-primary btn-sm rounded-pill px-3 animate__animated animate__fadeIn">
                        <i class="bi bi-plus-lg me-1"></i> Post
                    </a>`;
            }

            renderAnnouncements(data);
        } catch (e) {
            console.error(e);
            renderError();
        }
    }

    function renderAnnouncements(items) {
        if (!items || items.length === 0) {
            list.innerHTML = `
                <div class="empty-state text-center animate__animated animate__fadeIn">
                    <div class="display-1 text-muted mb-3 opacity-25">
                        <i class="bi bi-chat-dots"></i>
                    </div>
                    <h5 class="fw-bold">All Quiet on Campus</h5>
                    <p class="text-muted">No new announcements today. Check back later!</p>
                </div>`;
            badge.innerText = "0 Updates";
            return;
        }

        badge.innerText = `${items.length} Updates`;
        
        list.innerHTML = items.map((a, i) => {
            const delay = i * 0.1;
            const isGlobal = a.is_global;
            // Show a "NEW" badge if posted in the last 24 hours
            const isNew = (new Date() - new Date(a.created_at)) < (24 * 60 * 60 * 1000);
            
            const date = new Date(a.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            return `
            <div class="col-12 animate__animated animate__fadeInUp" style="animation-delay: ${delay}s">
                <div class="card announcement-card shadow-sm border-0">
                    <div class="status-strip ${isGlobal ? 'bg-global' : 'bg-local'}"></div>
                    <div class="card-body p-4">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="d-flex gap-2">
                                <span class="badge ${isGlobal ? 'bg-warning text-dark' : 'bg-primary bg-opacity-10 text-primary'} rounded-pill small">
                                    ${isGlobal ? '<i class="bi bi-globe me-1"></i> Global' : '<i class="bi bi-building me-1"></i> Campus'}
                                </span>
                                ${isNew ? '<span class="badge bg-danger rounded-pill pulse-badge">NEW</span>' : ''}
                            </div>
                            <small class="text-muted">${date}</small>
                        </div>
                        <h5 class="fw-bold mb-2">${a.title}</h5>
                        <p class="text-secondary mb-3" style="white-space: pre-wrap;">${a.content}</p>
                        <div class="d-flex align-items-center author-info border-top pt-3">
                            <div class="rounded-circle bg-light d-flex align-items-center justify-content-center me-2" style="width: 32px; height: 32px;">
                                <i class="bi bi-patch-check-fill text-primary"></i>
                            </div>
                            <span>
                                <strong>${a.author_name}</strong> 
                                <span class="text-muted mx-1">•</span> 
                                <span class="text-uppercase small fw-bold text-accent">${a.author_role || 'Official'}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    function renderError() {
        list.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-exclamation-triangle display-4 text-danger"></i>
                <p class="mt-3">Failed to load broadcast. Please check your connection.</p>
                <button onclick="location.reload()" class="btn btn-outline-primary btn-sm rounded-pill">Try Again</button>
            </div>`;
    }

    loadAnnouncements();
});