document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('resourceForm');
    const sourceType = document.getElementById('sourceType');
    const fileGroup = document.getElementById('fileGroup');
    const linkGroup = document.getElementById('linkGroup');
    const urlInput = document.getElementById('urlInput');
    const fileInput = document.getElementById('fileInput');
    const catDropdown = document.getElementById('catDropdown');
    const adminOptions = document.getElementById('adminOptions');

    // 1. Initial Permission & Category Load
    async function init() {
        try {
            // Check session to see if user has permission for "Global" uploads
            const data = await window.api.fetch('/api/session');
            const user = data && data.user ? data.user : null;

            if (user) {
                // If user is admin or a designated leader, show Global switch
                if (user.role === 'admin' || user.is_leader || user.is_creator) {
                    adminOptions.classList.remove('d-none');
                }
            }

            // Populate Categories from Backend
            const categories = await window.api.fetch('/api/categories');
            if (Array.isArray(categories)) {
                catDropdown.innerHTML = categories.map(c => 
                    `<option value="${c.id}">${c.name}</option>`
                ).join('');
            }

        } catch (e) {
            console.error("Initialization failed", e);
            // Optional: Redirect if session is strictly required
            // window.location.assign('index.html');
        }
    }

    // 2. Toggle UI based on Source Type (File vs YouTube vs Link)
    sourceType.addEventListener('change', (e) => {
        const val = e.target.value;
        const linkLabel = document.getElementById('linkLabel');
        const linkHint = document.getElementById('linkHint');

        if (val === 'file') {
            fileGroup.classList.remove('d-none');
            linkGroup.classList.add('d-none');
            fileInput.setAttribute('required', 'required');
            urlInput.removeAttribute('required');
            urlInput.value = ""; // Clear URL if switching to file
        } else {
            fileGroup.classList.add('d-none');
            linkGroup.classList.remove('d-none');
            fileInput.removeAttribute('required');
            fileInput.value = ""; // Clear file if switching to link
            urlInput.setAttribute('required', 'required');
            
            if (val === 'youtube') {
                linkLabel.innerText = "YouTube Video URL";
                linkHint.innerText = "Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ";
                urlInput.placeholder = "Paste YouTube link here...";
            } else {
                linkLabel.innerText = "External Website URL";
                linkHint.innerText = "Link to an article, PDF on Drive, or website.";
                urlInput.placeholder = "https://example.com/resource";
            }
        }
    });

    // 3. Handle Form Submission
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const btnText = document.getElementById('btnText');
        const btnLoader = document.getElementById('btnLoader');
        
        // UI Feedback: Start Loading
        btnText.classList.add('d-none');
        btnLoader.classList.remove('d-none');

        const formData = new FormData(form);
        const sType = sourceType.value;
        formData.append('type', sType); // Explicitly send the source type

        // Logic for YouTube specific processing
        if (sType === 'youtube') {
            const url = urlInput.value.trim();
            const ytId = extractYoutubeId(url);
            
            if (!ytId) {
                alert("Please enter a valid YouTube URL.");
                resetBtn();
                return;
            }
            formData.append('youtube_id', ytId);
        }

        try {
            // Use postMultipart to handle potential file uploads
            const result = await window.api.fetch('/api/resources/upload', {
                method: 'POST',
                body: formData
                // Note: fetch automatically sets content-type for FormData
            });

            if (result && (result.ok || result.success)) {
                alert("Resource published successfully!");
                window.location.assign('resources.html');
            } else {
                throw new Error(result.message || "Upload failed.");
            }
        } catch (err) {
            console.error("Upload Error:", err);
            alert(err.message || "System error. Please try again.");
        } finally {
            resetBtn();
        }

        function resetBtn() {
            btnText.classList.remove('d-none');
            btnLoader.classList.add('d-none');
        }
    };

    /**
     * Helper to get the 11-character Video ID from various YT link formats
     */
    function extractYoutubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }

    init();
});