(function () {
    let selectedCourseId = null;
    let userProgram = null;

    const handleLogout = async (e) => {
        if (e) e.preventDefault();
        try { 
            await window.api.fetch('/api/logout', { method: 'POST' }); 
        } catch (err) { console.error("Logout failed:", err); }
        window.location.assign('/index.html');
    };

  
    async function loadSlides() {
        const slidesList = document.getElementById('slidesList');
        const slidesEmpty = document.getElementById('slidesEmpty');
        const masterBadge = document.getElementById('masterBadge');
        if (!slidesList || !slidesEmpty) return;

        slidesList.innerHTML = '';
        slidesEmpty.classList.add('d-none');
        masterBadge.classList.add('d-none');

        if (!selectedCourseId) {
            slidesEmpty.classList.remove('d-none');
            return;
        }

        try {

            const data = await window.api.fetch(`/api/resources?courseId=${selectedCourseId}&master=true`);
            const slides = Array.isArray(data.resources) ? data.resources : [];
            
            if (!slides.length) {
                slidesEmpty.innerHTML = `<div class="py-5"><i class="bi bi-cloud-slash fs-2 d-block mb-2"></i>No master slides found for this course yet.</div>`;
                slidesEmpty.classList.remove('d-none');
                return;
            }

            masterBadge.classList.remove('d-none');
            slides.forEach(s => {
                const li = document.createElement('li');
                li.className = 'list-group-item d-flex justify-content-between align-items-center p-3 border-start border-4 border-info-subtle';
                li.innerHTML = `
                    <div class="d-flex align-items-center">
                        <i class="bi bi-file-earmark-pdf-fill text-danger fs-3 me-3"></i>
                        <div>
                            <span class="fw-bold d-block text-dark">${s.title}</span>
                            <small class="text-muted">Verified Compiled Resource</small>
                        </div>
                    </div>
                    <div class="btn-group">
                        <a href="${s.url}" target="_blank" class="btn btn-primary btn-sm px-3 rounded-pill">
                            <i class="bi bi-eye me-1"></i> View
                        </a>
                    </div>
                `;
                slidesList.appendChild(li);
            });
        } catch (err) {
            slidesEmpty.textContent = 'Error connecting to the vault.';
            slidesEmpty.classList.remove('d-none');
        }
    }


    async function loadCourses() {
        const coursesList = document.getElementById('coursesList');
        const coursesEmpty = document.getElementById('coursesEmpty');
        if (!coursesList) return;

        coursesList.innerHTML = '';
        try {

            const data = await window.api.fetch(`/api/my-program-courses?programId=${userProgram}`);
            const courses = Array.isArray(data.courses) ? data.courses : [];
            
            if (!courses.length) {
                coursesEmpty?.classList.remove('d-none');
                return;
            }

            courses.forEach(course => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action course-card d-flex align-items-center py-3';
                li.innerHTML = `
                    <i class="bi bi-bookmark-star-fill me-3" style="color:#06b6d4; font-size:1.2rem;"></i> 
                    <div>
                        <span class="fw-bold d-block mb-0">${course.course_code}</span>
                        <small class="text-muted text-uppercase" style="font-size: 0.7rem">${course.course_name}</small>
                    </div>
                `;
                li.addEventListener('click', () => {
                    selectedCourseId = course.id;
                    setSlidesCourseTitle(course.course_name);
                    
                    document.querySelectorAll('.course-card').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');
                    
                    loadSlides();
                });
                coursesList.appendChild(li);
            });
        } catch (err) {
            if (coursesEmpty) coursesEmpty.textContent = 'Failed to load curriculum.';
        }
    }

    function setSlidesCourseTitle(title) {
        const el = document.getElementById('slidesCourseTitle');
        if (el) el.textContent = title || 'Select a Course';
    }

    function getBannerElements() {
        return {
            banner: document.getElementById('notificationBanner'),
            enableBtn: document.getElementById('enableNotificationsBtn'),
            dismissBtn: document.getElementById('dismissNotificationsBtn'),
        };
    }

    function showBanner(message, showEnable = true) {
        const { banner, enableBtn, dismissBtn } = getBannerElements();
        if (!banner) return;
        banner.style.display = 'flex';
        banner.querySelector('p').textContent = message;
        if (enableBtn) enableBtn.style.display = showEnable ? 'inline-flex' : 'none';
        if (dismissBtn) dismissBtn.style.display = 'inline-flex';
    }

    function hideBanner() {
        const { banner } = getBannerElements();
        if (banner) banner.style.display = 'none';
    }

    async function updateNotificationBanner() {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            showBanner('Browser notifications are not supported here.', false);
            return;
        }

        if (Notification.permission === 'granted') {
            const enabled = await window.api.initPush({ prompt: false });
            if (enabled) {
                hideBanner();
                return;
            }
            showBanner('Notifications are enabled in your browser. Click enable to complete setup.', true);
            return;
        }

        if (Notification.permission === 'denied') {
            showBanner('Notifications are blocked. Please allow them in your browser settings to stay updated.', false);
            return;
        }

        showBanner('Enable browser notifications to receive announcements, upload alerts, and forum activity instantly.', true);
    }

    async function handleEnableNotifications() {
        const { enableBtn } = getBannerElements();
        if (enableBtn) {
            enableBtn.disabled = true;
            enableBtn.textContent = 'Enabling...';
        }
        try {
            const success = await window.api.initPush({ prompt: true });
            if (success) {
                hideBanner();
            } else if (Notification.permission === 'denied') {
                showBanner('Notifications are blocked. Please update your browser permissions.', false);
            } else {
                showBanner('Notification permission declined. You can try again later.', true);
            }
        } catch (err) {
            console.error('Notification enable error:', err);
            showBanner('Could not enable notifications. Try again later.', true);
        } finally {
            if (enableBtn) {
                enableBtn.disabled = false;
                enableBtn.textContent = 'Enable Notifications';
            }
        }
    }

    function handleDismissNotificationBanner() {
        hideBanner();
    }

    
    document.addEventListener('DOMContentLoaded', function() {
        async function init() {
            try {
                const session = await window.api.fetch('/api/session');
                if (!session || !session.user) return window.location.assign('/index.html');
                
                const user = session.user;
                userProgram = user.program; 

                // UI setup
                document.getElementById('user-firstname').textContent = (user.fullName || '').split(' ')[0];
                document.getElementById('user-course').textContent = user.program;
                if (user.avatar_url) document.getElementById('avatar').src = user.avatar_url;

                await loadCourses();
                updateNotificationBanner();
            } catch (err) { console.error("Init Error:", err); }
        }

        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('refreshSlides')?.addEventListener('click', loadSlides);
        document.getElementById('refreshCourses')?.addEventListener('click', loadCourses);
        document.getElementById('enableNotificationsBtn')?.addEventListener('click', handleEnableNotifications);
        document.getElementById('dismissNotificationsBtn')?.addEventListener('click', handleDismissNotificationBanner);

        init();
    });
})();