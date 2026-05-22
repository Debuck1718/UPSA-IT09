(function () {
    let selectedCourseId = null;
    let selectedCourseName = "";
    let userProgram = null;

    // Direct helper to determine if we are running in an api wrapper or standard environment
    const apiFetch = async (url, options = {}) => {
        if (window.api && typeof window.api.fetch === 'function') {
            return window.api.fetch(url, options);
        }
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    };

    const handleLogout = async (e) => {
        if (e) e.preventDefault();
        try { 
            await apiFetch('/api/logout', { method: 'POST' }); 
        } catch (err) { 
            console.error("Logout failed:", err); 
        }
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
            // Ensure both panels display clearly side-by-side on desktop layouts
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
        if (masterBadge) masterBadge.classList.add('d-none');

        if (!selectedCourseId) {
            if (slidesEmptyMessage) slidesEmptyMessage.textContent = 'Click a course to view available slides.';
            slidesEmpty.classList.remove('d-none');
            return;
        }

        try {
            // Strategy Route A: Query primary high-priority Verified Master compiled files
            const masterData = await apiFetch(`/api/resources?courseId=${encodeURIComponent(selectedCourseId)}&master=true`);
            let slides = Array.isArray(masterData.resources) ? masterData.resources : [];
            let isMasterCompiledSource = true;

            // Strategy Route B: If Master Vault query returns dry, fall back to standard Rep uploads
            if (!slides.length) {
                isMasterCompiledSource = false;
                const fallbackData = await apiFetch(`/api/slides?courseTitle=${encodeURIComponent(selectedCourseName)}`);
                slides = Array.isArray(fallbackData.slides) ? fallbackData.slides : [];
            }

            if (!slides.length) {
                slidesEmpty.innerHTML = `
                    <div class="py-5 px-3 text-center text-muted">
                        <i class="bi bi-cloud-slash fs-2 d-block mb-2"></i>
                        No shared reference resources or master slides found for this course yet.
                    </div>`;
                slidesEmpty.classList.remove('d-none');
                return;
            }

            // Dynamically flag the header badge if verified master compiles are present
            if (isMasterCompiledSource && masterBadge) {
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
        if (coursesEmpty) coursesEmpty.classList.add('d-none');

        try {
            // Secure Query Handling using valid search parameter encoding definitions
            const params = new URLSearchParams();
            if (userProgram) params.append('programId', userProgram);

            const data = await apiFetch(`/api/my-program-courses?${params.toString()}`);
            const courses = Array.isArray(data.courses) ? data.courses : [];
            
            if (!courses.length) {
                if (coursesEmpty) {
                    coursesEmpty.textContent = 'No courses found.';
                    coursesEmpty.classList.remove('d-none');
                }
                return;
            }

            courses.forEach(course => {
                const li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action course-card d-flex align-items-center py-3';
                if (selectedCourseId === course.id) li.classList.add('active');

                li.innerHTML = `
                    <i class="bi bi-bookmark-star-fill me-3" style="color:#06b6d4; font-size:1.2rem;"></i> 
                    <div class="overflow-hidden">
                        <span class="fw-bold d-block mb-0 text-truncate">${course.course_code || 'COURSE'}</span>
                        <small class="text-muted text-uppercase text-truncate d-block" style="font-size: 0.7rem">${course.course_name || ''}</small>
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
            console.error("Failed to load curriculum details:", err);
            if (coursesEmpty) {
                coursesEmpty.textContent = 'Failed to load curriculum.';
                coursesEmpty.classList.remove('d-none');
            }
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
        const pEl = banner.querySelector('p');
        if (pEl) pEl.textContent = message;
        
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
            if (window.api && typeof window.api.initPush === 'function') {
                const enabled = await window.api.initPush({ prompt: false });
                if (enabled) {
                    hideBanner();
                    return;
                }
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
            if (window.api && typeof window.api.initPush === 'function') {
                const success = await window.api.initPush({ prompt: true });
                if (success) {
                    hideBanner();
                } else if (Notification.permission === 'denied') {
                    showBanner('Notifications are blocked. Please update your browser permissions.', false);
                } else {
                    showBanner('Notification permission declined. You can try again later.', true);
                }
            } else {
                // Fallback to standard request permission signature syntax
                const permission = await Notification.requestPermission();
                if (permission === 'granted') hideBanner();
                else updateNotificationBanner();
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
                const session = await apiFetch('/api/session');
                if (!session || !session.user) return window.location.assign('/index.html');
                
                const user = session.user;
                userProgram = user.program; 

                const nameEl = document.getElementById('user-firstname');
                if (nameEl) nameEl.textContent = (user.fullName || 'Student').split(' ')[0];
                
                const courseEl = document.getElementById('user-course');
                if (courseEl) courseEl.textContent = user.program || 'Program';
                
                const avatarEl = document.getElementById('avatar');
                if (avatarEl && user.avatar_url) avatarEl.src = user.avatar_url;

                // Handle screen scaling conditions natively
                toggleMobilePanels(!!selectedCourseId);
                window.addEventListener('resize', () => {
                    if (window.innerWidth >= 992) {
                        toggleMobilePanels(false);
                    } else {
                        toggleMobilePanels(!!selectedCourseId);
                    }
                });

                await loadCourses();
                updateNotificationBanner();
            } catch (err) { 
                console.error("Init Error:", err); 
                window.location.assign('/index.html');
            }
        }

        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('mobileLogoutBtn')?.addEventListener('click', handleLogout);
        document.getElementById('refreshSlides')?.addEventListener('click', loadSlides);
        document.getElementById('refreshCourses')?.addEventListener('click', loadCourses);
        document.getElementById('enableNotificationsBtn')?.addEventListener('click', handleEnableNotifications);
        document.getElementById('dismissNotificationsBtn')?.addEventListener('click', handleDismissNotificationBanner);

        // Bind Mobile panel back-navigation triggers cleanly
        document.getElementById('mobileBackToCourses')?.addEventListener('click', (e) => {
            e.preventDefault();
            selectedCourseId = null;
            selectedCourseName = "";
            setSlidesCourseTitle('Select a Course');
            toggleMobilePanels(false);
        });

        init();
    });
})();