(function () {
    let selectedCourse = null;

    // --- SLIDE LOADING LOGIC ---
    async function loadSlides() {
        const slidesList = document.getElementById('slidesList');
        const slidesEmpty = document.getElementById('slidesEmpty');
        if (!slidesList || !slidesEmpty) return;

        slidesList.innerHTML = '';
        slidesEmpty.classList.add('d-none');

        if (!selectedCourse) {
            slidesEmpty.textContent = 'Select a course to view slides.';
            slidesEmpty.classList.remove('d-none');
            return;
        }

        try {
            const data = await window.api.fetch(`/api/slides?courseTitle=${encodeURIComponent(selectedCourse)}`);
            const slides = Array.isArray(data.slides) ? data.slides : [];
            
            if (!slides.length) {
                slidesEmpty.classList.remove('d-none');
                return;
            }

            slides.forEach(s => {
                const id = s.id;
                const title = s.originalName || s.original_name || s.slideTitle || s.slide_title || s.filename || 'Slide';
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center';
                li.innerHTML = `
                    <div><i class="bi bi-file-earmark-text" style="color:#6366f1;font-size:1.3rem;"></i>
                        <span class="fw-semibold">${title}</span>
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-success btn-sm px-3" data-action="download" data-id="${id}">Download</button>
                        <button class="btn btn-outline-secondary btn-sm px-3" data-action="view" data-id="${id}">View</button>
                    </div>
                `;

                li.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        try {
                            const slideId = btn.getAttribute('data-id');
                            const resp = await window.api.fetch(`/api/slides/${encodeURIComponent(slideId)}/url`);
                            if (btn.getAttribute('data-action') === 'view') {
                                window.open(resp.url, '_blank');
                            } else {
                                const a = document.createElement('a');
                                a.href = resp.url;
                                a.download = '';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                            }
                        } catch (err) { console.error("Action failed", err); }
                    });
                });
                slidesList.appendChild(li);
            });
        } catch (err) {
            slidesEmpty.textContent = 'Failed to load slides.';
            slidesEmpty.classList.remove('d-none');
        }
    }

    // --- COURSE LOADING LOGIC ---
    async function loadCourses() {
        const coursesList = document.getElementById('coursesList');
        const coursesEmpty = document.getElementById('coursesEmpty');
        if (!coursesList) return;

        coursesList.innerHTML = '';
        try {
            const data = await window.api.fetch('/api/courses');
            const courses = Array.isArray(data.courses) ? data.courses : [];
            
            if (!courses.length) {
                coursesEmpty?.classList.remove('d-none');
                return;
            }

            courses.forEach(title => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action d-flex align-items-center';
                li.innerHTML = `<i class="bi bi-bookmark-star me-2" style="color:#06b6d4;font-size:1.2rem;"></i> <span class="fw-semibold">${title}</span>`;
                li.style.cursor = 'pointer';
                li.addEventListener('click', () => {
                    selectedCourse = title;
                    setSlidesCourseTitle(title);
                    loadSlides();
                });
                coursesList.appendChild(li);
            });
        } catch (err) {
            if (coursesEmpty) coursesEmpty.textContent = 'Failed to load courses.';
        }
    }

    function setSlidesCourseTitle(title) {
        const el = document.getElementById('slidesCourseTitle');
        if (el) {
            el.innerHTML = `<i class="bi bi-folder2-open me-2" style="color:#6366f1;font-size:1.5rem;"></i> ${title || 'Select a course to view slides'}`;
        }
    }

    // --- MAIN DOM INITIALIZATION ---
    document.addEventListener('DOMContentLoaded', function() {
        
        async function fetchSession() {
            try {
                const data = await window.api.fetch('/api/session');
                if (!data || !data.user) throw new Error('No session');
                return data.user;
            } catch {
                window.location.assign('/public/index.html');
                throw new Error('No session');
            }
        }

        function setUserInfo(user) {
            const nameRaw = user.full_name || 'Student';
            const firstName = String(nameRaw).trim().split(/\s+/)[0];

            if (document.getElementById('user-firstname')) document.getElementById('user-firstname').textContent = firstName;
            if (document.getElementById('user-course')) document.getElementById('user-course').textContent = user.program || 'No Program';
            if (document.getElementById('user-role')) document.getElementById('user-role').textContent = user.role || '';

            const avatar = document.getElementById('avatar');
            if (avatar && user.avatar_url) avatar.src = user.avatar_url;

            // Permission Based UI
            if (user.role === 'admin' || user.is_leader || user.is_creator) {
                document.getElementById('uploadBtn')?.classList.remove('d-none');
                document.getElementById('announceBtn')?.classList.remove('d-none');
            }
        }

        // Event Listeners
        document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            try { await window.api.fetch('/api/logout', { method: 'POST' }); } catch {}
            window.location.assign('/public/index.html');
        });

        document.getElementById('refreshSlides')?.addEventListener('click', loadSlides);
        document.getElementById('refreshCourses')?.addEventListener('click', loadCourses);

        // --- DASHBOARD STARTUP SEQUENCE ---
        (async function init() {
            try {
                const user = await fetchSession();
                setUserInfo(user);
                await loadCourses();
                setSlidesCourseTitle(null);
                loadSlides();

                // Initialize Push Notifications once user is verified
                if (window.api && window.api.initPush) {
                    console.log("Acadex: Initializing Push Subscriptions...");
                    await window.api.initPush();
                }
            } catch (err) {
                console.error("Dashboard Init Error:", err);
            }
        })();
    });

    // --- GLOBAL UI HELPERS (Exported to window) ---
    window.showSection = function(sectionId) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.add('d-none'));
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

        const target = document.getElementById(sectionId);
        if (target) target.classList.remove('d-none');

        const activeLink = document.querySelector(`[onclick="showSection('${sectionId}')"]`);
        if (activeLink) activeLink.classList.add('active');

        if (sectionId === 'announcements-section') loadAnnouncements();
        if (sectionId === 'resource-hub') loadResources();
    };

    async function loadResources() {
        const grid = document.getElementById('resourceGrid');
        if (!grid) return;
        grid.innerHTML = '<div class="text-center p-5 text-white">Loading resources...</div>';
        
        try {
            const data = await window.api.fetch('/api/resources');
            grid.innerHTML = '';
            
            if (!data.resources?.length) {
                grid.innerHTML = '<div class="text-center text-white-50">No resources available.</div>';
                return;
            }

            data.resources.forEach(res => {
                const card = document.createElement('div');
                card.className = 'col-md-6 col-lg-4 mb-3';
                card.innerHTML = `
                    <div class="card h-100 border-0 shadow-sm bg-white">
                        <div class="card-body">
                            <div class="d-flex align-items-center mb-2">
                                <i class="bi ${res.category_icon || 'bi-play-circle'} text-primary fs-4 me-2"></i>
                                <span class="badge bg-light text-dark text-uppercase">${res.category_name || 'Resource'}</span>
                            </div>
                            <h6 class="fw-bold">${res.title}</h6>
                            <p class="small text-muted text-truncate">${res.description || ''}</p>
                            <button class="btn btn-sm w-100 ${res.youtube_id ? 'btn-danger' : 'btn-primary'}" 
                                    onclick="handleResourceClick('${res.youtube_id}', '${res.url}', '${res.title}', '${res.description}')">
                                ${res.youtube_id ? '<i class="bi bi-youtube"></i> Watch' : '<i class="bi bi-box-arrow-up-right"></i> Open'}
                            </button>
                        </div>
                    </div>
                `;
                grid.appendChild(card);
            });
        } catch (e) {
            grid.innerHTML = '<div class="text-center text-danger">Failed to load resource hub.</div>';
        }
    }

    window.handleResourceClick = function(youtubeId, url, title, desc) {
        if (youtubeId && youtubeId !== 'null') {
            const modal = new bootstrap.Modal(document.getElementById('videoModal'));
            document.getElementById('videoTitle').innerText = title;
            document.getElementById('videoDescription').innerText = desc;
            document.getElementById('videoContainer').innerHTML = `<iframe src="https://www.youtube.com/embed/${youtubeId}" allowfullscreen style="width:100%; height:315px; border:0;"></iframe>`;
            modal.show();
            document.getElementById('videoModal').addEventListener('hidden.bs.modal', () => {
                document.getElementById('videoContainer').innerHTML = '';
            }, {once: true});
        } else {
            window.open(url, '_blank');
        }
    };

})();