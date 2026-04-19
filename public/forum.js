document.addEventListener('DOMContentLoaded', async () => {
    const feed = document.getElementById('forumFeed');
    const postForm = document.getElementById('postForm');
    const replyForm = document.getElementById('replyForm');
    const userInitial = document.getElementById('userInitial');
    
    // Bootstrap Modal Instances
    const postModal = new bootstrap.Modal(document.getElementById('postModal'));
    const replyModal = new bootstrap.Modal(document.getElementById('replyModal'));

    let currentFilter = 'global';
    let currentUser = null;

    /**
     * Initialize Page & Session
     */
    async function init() {
        try {
            const session = await window.api.fetch('/api/session');
            currentUser = session.user;
            
            if (currentUser && userInitial) {
                userInitial.innerText = currentUser.full_name.charAt(0).toUpperCase();
            }
            
            loadFeed();
        } catch (e) {
            console.error("Session initialization failed", e);
            // Fallback to load feed even if session fails (public view)
            loadFeed();
        }
    }

    /**
     * Fetch and Render the Feed
     */
    async function loadFeed() {
        feed.innerHTML = `
            <div class="text-center p-5">
                <div class="spinner-border text-primary opacity-25" role="status"></div>
                <p class="text-muted small mt-2">Refreshing discussions...</p>
            </div>
        `;

        try {
            const posts = await window.api.fetch(`/api/forum?target=${currentFilter}`);
            renderFeed(posts);
        } catch (e) {
            feed.innerHTML = `
                <div class="alert alert-light border-danger text-danger text-center rounded-4 p-4">
                    <i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i>
                    <span class="fw-bold">Connection Error</span><br>
                    Could not sync with the Acadex servers.
                </div>
            `;
        }
    }

    /**
     * Render Posts and Nested Replies
     */
    function renderFeed(posts) {
        const mainPosts = posts.filter(p => !p.parent_id);
        const replies = posts.filter(p => p.parent_id);

        if (mainPosts.length === 0) {
            feed.innerHTML = `
                <div class="card forum-card text-center p-5">
                    <i class="bi bi-chat-dots text-muted fs-1 opacity-25"></i>
                    <p class="text-muted mt-3 fw-medium">No discussions in the ${currentFilter} square yet.</p>
                    <button class="btn btn-primary btn-sm mx-auto rounded-pill px-4" data-bs-toggle="modal" data-bs-target="#postModal">
                        Start the conversation
                    </button>
                </div>
            `;
            return;
        }

        feed.innerHTML = mainPosts.map(post => {
            const postReplies = replies.filter(r => r.parent_id === post.id);
            const initial = post.full_name ? post.full_name.charAt(0).toUpperCase() : 'U';
            
            // UI logic for target badges
            const targetBadgeClass = {
                'global': 'bg-warning-subtle text-warning-emphasis',
                'program': 'bg-primary-subtle text-primary-emphasis',
                'class': 'bg-info-subtle text-info-emphasis'
            }[post.target_type] || 'bg-light text-muted';

            return `
                <div class="card forum-card mb-3 shadow-sm animate__animated animate__fadeInUp">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <div class="avatar-sm me-3">${initial}</div>
                            <div class="flex-grow-1">
                                <div class="d-flex justify-content-between align-items-start">
                                    <h6 class="fw-bold mb-0">${post.full_name}</h6>
                                    <span class="badge badge-target ${targetBadgeClass}">${post.target_type}</span>
                                </div>
                                <small class="text-muted" style="font-size: 0.75rem;">
                                    ${new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </small>
                            </div>
                        </div>
                        
                        <p class="card-text text-dark" style="line-height: 1.6; white-space: pre-wrap;">${post.content}</p>
                        
                        <div class="mt-3 d-flex align-items-center gap-3">
                            <button class="btn btn-reply btn-sm p-0 fw-bold" onclick="openReplyModal('${post.id}')">
                                <i class="bi bi-chat-left-text me-1"></i> Reply 
                                ${postReplies.length > 0 ? `<span class="ms-1 opacity-50">(${postReplies.length})</span>` : ''}
                            </button>
                        </div>
                    </div>

                    ${postReplies.length > 0 ? `
                        <div class="bg-light bg-opacity-50 pb-3">
                            ${postReplies.map(r => `
                                <div class="reply-card shadow-sm mx-3 mt-2">
                                    <div class="d-flex align-items-center mb-1">
                                        <small class="fw-bold text-primary me-2">${r.full_name}</small>
                                        <small class="text-muted" style="font-size: 0.65rem;">
                                            ${new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </small>
                                    </div>
                                    <p class="small mb-0 text-dark-emphasis">${r.content}</p>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    /**
     * Submit New Discussion
     */
    postForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = postForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Posting...`;

        const data = Object.fromEntries(new FormData(postForm));
        
        try {
            const res = await window.api.post('/api/forum', data);
            if (res.ok) {
                postModal.hide();
                postForm.reset();
                loadFeed();
            }
        } catch (err) {
            alert("Could not post: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = originalText;
        }
    };

    /**
     * Reply Logic
     */
    window.openReplyModal = (id) => {
        document.getElementById('replyParentId').value = id;
        replyModal.show();
    };

    replyForm.onsubmit = async (e) => {
        e.preventDefault();
        const submitBtn = replyForm.querySelector('button[type="submit"]');
        
        submitBtn.disabled = true;

        const data = Object.fromEntries(new FormData(replyForm));
        
        try {
            const res = await window.api.post('/api/forum/reply', data);
            if (res.ok) {
                replyModal.hide();
                replyForm.reset();
                loadFeed();
            }
        } catch (err) {
            alert("Reply failed to send.");
        } finally {
            submitBtn.disabled = false;
        }
    };

    /**
     * Sidebar Navigation / Filters
     */
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.onclick = () => {
            // UI Toggle
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Logic Toggle
            currentFilter = btn.dataset.filter;
            loadFeed();
        };
    });

    init();
});