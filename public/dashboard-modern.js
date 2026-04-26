(function () {
    let selectedCourse = null;

    // --- LOGOUT SHARED LOGIC ---
    const handleLogout = async (e) => {
        if (e) e.preventDefault();
        try { 
            await window.api.fetch('/api/logout', { method: 'POST' }); 
        } catch (err) {
            console.error("Logout request failed:", err);
        }
        // Always redirect regardless of API success to ensure user is logged out of UI
        window.location.assign('/index.html');
    };

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
                window.location.assign('/index.html');
                throw new Error('No session');
            }
        }

        function setUserInfo(user) {
            const nameRaw = user.full_name || 'Student';
            const firstName = String(nameRaw).trim().split(/\s+/)[0];

            if (document.getElementById('user-firstname')) document.getElementById('user-firstname').textContent = firstName;
            if (document.getElementById('user-course')) document.getElementById('user-course').textContent = user.program || 'No Program';

            const avatar = document.getElementById('avatar');
            if (avatar) {
                if (user.avatar_url) avatar.src = user.avatar_url;
                // Fixed: Navigate correctly to profile page
                avatar.onclick = () => window.location.href = '/profile.html';
            }
        }

        // Initialize Event Listeners
        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('mobileLogoutBtn')?.addEventListener('click', handleLogout);
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

                if (window.api && window.api.initPush) {
                    await window.api.initPush();
                }
            } catch (err) {
                console.error("Dashboard Init Error:", err);
            }
        })();
    });

})();