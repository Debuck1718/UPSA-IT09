(function () {
    let selectedCourseId = null;
    let selectedCourseName = "";
    let userProgram = null;

    const handleLogout = async (e) => {
        if (e) e.preventDefault();
        try { 
            await window.api.fetch('/api/logout', { method: 'POST' }); 
        } catch (err) { console.error("Logout failed:", err); }
        window.location.assign('/index.html');
    };

    // Unified Mobile Window Layout Toggle Orchestration
    function toggleMobilePanels(showSlides) {
        const coursesCol = document.getElementById('coursesPanelColumn');
        const slidesCol = document.getElementById('slidesPanelColumn');
        if (!coursesCol || !slidesCol) return;

        if (window.innerWidth < 992) {
            if (showSlides) {
                coursesCol.classList.add('d-none');
                slidesCol.classList.remove('d-none');
            } else {
                coursesCol.classList.remove('d-none');
                slidesCol.classList.add('d-none');
            }
        } else {
            // Force reset when resizing back onto desktop browser footprints
            coursesCol.classList.remove('d-none');
            slidesCol.classList.remove('d-none');
        }
    }

    async function loadSlides() {
        const slidesList = document.getElementById('slidesList');
        const slidesEmpty = document.getElementById('slidesEmpty');
        const slidesEmptyMessage = document.getElementById('slidesEmptyMessage');
        const masterBadge = document.getElementById('masterBadge');
        if (!slidesList || !slidesEmpty) return;

        slidesList.innerHTML = '';
        slidesEmpty.classList.add('d-none');
        masterBadge.classList.add('d-none');

        if (!selectedCourseId) {
            if (slidesEmptyMessage) slidesEmptyMessage.textContent = 'Click a course to view available slides.';
            slidesEmpty.classList.remove('d-none');
            return;
        }

        try {
            // Strategy Route A: Query primary high-priority Verified Master compiled files
            const masterData = await window.api.fetch(`/api/resources?courseId=${selectedCourseId}&master=true`);
            let slides = Array.isArray(masterData.resources) ? masterData.resources : [];
            let isMasterCompiledSource = true;

            // Strategy Route B: If Master Vault query returns dry, fall back to standard Rep uploads
            if (!slides.length) {
                isMasterCompiledSource = false;
                const fallbackData = await window.api.fetch(`/api/slides?courseTitle=${encodeURIComponent(selectedCourseName)}`);
                slides = Array.isArray(fallbackData.slides) ? fallbackData.slides : [];
            }

            if (!slides.length) {
                slidesEmpty.innerHTML = `<div class="py-5 px-3 text-center text-muted"><i class="bi bi-cloud-slash fs-2 d-block mb-2"></i>No shared reference resources or master slides found for this course yet.</div>`;
                slidesEmpty.classList.remove('d-none');
                return;
            }

            // Dynamically flag the header badge if verified master compiles are present
            if (isMasterCompiledSource) {
                masterBadge.classList.remove('d-none');
            }

            slides.forEach(s => {
                const li = document.createElement('li');
                li.className = `list-group-item d-flex justify-content-between align-items-center p-3 border-start border-4 ${isMasterCompiledSource ? 'border-success' : 'border-info-subtle'}`;
                
                // Route attributes normalize discrepancies between standard upload structures and table maps
                const cleanTitle = s.title || s.slideTitle || s.originalName || "Untitled Document";
                const downloadUrl = s.url || "#";
                const metaCaption = isMasterCompiledSource ? "Verified Compiled Resource" : `Class Rep Contribution • ${new Date(s.createdAt || s.created_at).toLocaleDateString()}`;

                li.innerHTML = `
                    <div class="d-flex align-items-center overflow-hidden me-2">
                        <i class="bi bi-file-earmark-pdf-fill text-danger fs-3 me-3 flex-shrink-0"></i>
                        <div class="text-truncate">
                            <span class="fw-bold d-block text-dark text-truncate" title="${cleanTitle}">${cleanTitle}</span>
                            <small class="text-muted d-block text-truncate">${metaCaption}</small>
                        </div>
                    </div>
                    <div class="btn-group flex-shrink-0">
                        <a href="${downloadUrl}" target="_blank" class="btn ${isMasterCompiledSource ? 'btn-success' : 'btn-primary'} btn-sm px-3 rounded-pill">
                            <i class="bi bi-eye me-1"></i> View
                        </a>
                    </div>
                `;
                slidesList.appendChild(li);
            });
        } catch (err) {
            console.error("Vault mapping connection issue:", err);
            slidesEmpty.innerHTML = `<div class="py-5 text-center text-danger">Error connecting to resource channels.</div>`;
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
                    <div class="overflow-hidden">
                        <span class="fw-bold d-block mb-0 text-truncate">${course.course_code}</span>
                        <small class="text-muted text-uppercase text-truncate d-block" style="font-size: 0.7rem">${course.course_name}</small>
                    </div>
                `;
                li.addEventListener('click', () => {
                    selectedCourseId = course.id;
                    selectedCourseName = course.course_name;
                    setSlidesCourseTitle(course.course_name);
                    
                    document.querySelectorAll('.course-card').forEach(el => el.classList.remove('active'));
                    li.classList.add('active');
                    
                    // Route focus panel toggle forward on Mobile views
                    toggleMobilePanels(true);
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

                document.getElementById('user-firstname').textContent = (user.fullName || '').split(' ')[0];
                document.getElementById('user-course').textContent = user.program;
                if (user.avatar_url) document.getElementById('avatar').src = user.avatar_url;

                // Configure viewports layout state mapping upon entry execution
                toggleMobilePanels(false);
                window.addEventListener('resize', () => {
                    if (window.innerWidth >= 992) {
                        toggleMobilePanels(false);
                    }
                });

                await loadCourses();
                updateNotificationBanner();
            } catch (err) { console.error("Init Error:", err); }
        }

        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('refreshSlides')?.addEventListener('click', loadSlides);
        document.getElementById('refreshCourses')?.addEventListener('click', loadCourses);
        document.getElementById('enableNotificationsBtn')?.addEventListener('click', handleEnableNotifications);
        document.getElementById('dismissNotificationsBtn')?.addEventListener('click', handleDismissNotificationBanner);

        // Bind Mobile panel back-navigation triggers cleanly
        document.getElementById('mobileBackToCourses')?.addEventListener('click', (e) => {
            e.preventDefault();
            toggleMobilePanels(false);
        });

        init();
    });
})();