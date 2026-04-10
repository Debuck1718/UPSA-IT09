document.addEventListener('DOMContentLoaded', async () => {
    const feed = document.getElementById('forumFeed');
    const postForm = document.getElementById('postForm');
    const replyForm = document.getElementById('replyForm');
    const postModal = new bootstrap.Modal(document.getElementById('postModal'));
    const replyModal = new bootstrap.Modal(document.getElementById('replyModal'));

    let currentFilter = 'global';

    async function loadFeed() {
        try {
            // Fetch posts based on current target (global/program/class)
            const posts = await window.api.fetch(`/api/forum?target=${currentFilter}`);
            renderFeed(posts);
        } catch (e) {
            feed.innerHTML = '<div class="alert alert-danger">Failed to load discussions.</div>';
        }
    }

    function renderFeed(posts) {
        // Filter out replies from the main feed array (we'll nest them)
        const mainPosts = posts.filter(p => !p.parent_id);
        const replies = posts.filter(p => p.parent_id);

        if (mainPosts.length === 0) {
            feed.innerHTML = '<div class="text-center p-5 text-muted">No discussions yet. Start one!</div>';
            return;
        }

        feed.innerHTML = mainPosts.map(post => {
            const postReplies = replies.filter(r => r.parent_id === post.id);
            
            return `
                <div class="card forum-card mb-3 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-2">
                            <div class="avatar-sm me-2">${post.full_name?.charAt(0) || 'U'}</div>
                            <div>
                                <div class="fw-bold mb-0" style="font-size: 0.9rem;">${post.full_name}</div>
                                <span class="badge bg-light text-primary badge-target">${post.target_type}</span>
                                <small class="text-muted ms-2">${new Date(post.created_at).toLocaleDateString()}</small>
                            </div>
                        </div>
                        <p class="card-text">${post.content}</p>
                        <hr class="text-muted opacity-25">
                        <div class="d-flex gap-3">
                            <button class="btn btn-sm text-muted fw-bold p-0" onclick="openReplyModal('${post.id}')">
                                <i class="bi bi-chat-left me-1"></i> Reply
                            </button>
                        </div>
                    </div>
                    <div class="pb-2">
                        ${postReplies.map(r => `
                            <div class="reply-card p-2 mb-2 rounded shadow-sm mx-3">
                                <div class="d-flex align-items-center mb-1">
                                    <small class="fw-bold me-2">${r.full_name}</small>
                                    <small class="text-muted" style="font-size: 0.7rem;">${new Date(r.created_at).toLocaleDateString()}</small>
                                </div>
                                <p class="small mb-0 text-secondary">${r.content}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    // Handle New Post
    postForm.onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(postForm));
        const res = await window.api.post('/api/forum', data);
        if (res.ok) {
            postModal.hide();
            postForm.reset();
            loadFeed();
        }
    };

    // Handle Reply
    window.openReplyModal = (id) => {
        document.getElementById('replyParentId').value = id;
        replyModal.show();
    };

    replyForm.onsubmit = async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(replyForm));
        const res = await window.api.post('/api/forum/reply', data);
        if (res.ok) {
            replyModal.hide();
            replyForm.reset();
            loadFeed();
        }
    };

    // Sidebar Filter Logic
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            loadFeed();
        };
    });

    loadFeed();
});