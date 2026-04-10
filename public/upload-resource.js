document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('resourceForm');
    const sourceType = document.getElementById('sourceType');
    const fileGroup = document.getElementById('fileGroup');
    const linkGroup = document.getElementById('linkGroup');
    const catDropdown = document.getElementById('catDropdown');
    const adminOptions = document.getElementById('adminOptions');

    // 1. Initial Permission & Category Load
    async function init() {
        try {
            const [session, categories] = await Promise.all([
                window.api.fetch('/api/session'),
                window.api.fetch('/api/categories')
            ]);

            // Hierarchy Check: Only Admin/Leader/Creator see Global options
            const u = session.user;
            if (u.role === 'admin' || u.is_leader || u.is_creator) {
                adminOptions.classList.remove('d-none');
            }

            // Populate Categories
            catDropdown.innerHTML = categories.map(c => 
                `<option value="${c.id}">${c.name}</option>`
            ).join('');

        } catch (e) {
            console.error("Initialization failed", e);
            alert("Session expired. Please log in again.");
            window.location.href = 'index.html';
        }
    }

    // 2. Toggle UI based on Source Type
    sourceType.addEventListener('change', (e) => {
        const val = e.target.value;
        const linkLabel = document.getElementById('linkLabel');
        const linkHint = document.getElementById('linkHint');

        if (val === 'file') {
            fileGroup.classList.remove('d-none');
            linkGroup.classList.add('d-none');
        } else {
            fileGroup.classList.add('d-none');
            linkGroup.classList.remove('d-none');
            
            if (val === 'youtube') {
                linkLabel.innerText = "YouTube Video URL";
                linkHint.innerText = "Example: https://youtube.com/watch?v=...";
            } else {
                linkLabel.innerText = "External Website URL";
                linkHint.innerText = "Example: https://google.com/drive/folder-link";
            }
        }
    });

    // 3. Handle Submit
    form.onsubmit = async (e) => {
        e.preventDefault();
        const btnText = document.getElementById('btnText');
        const btnLoader = document.getElementById('btnLoader');
        
        btnText.classList.add('d-none');
        btnLoader.classList.remove('d-none');

        const formData = new FormData(form);
        const sType = sourceType.value;

        // Extract YouTube ID if applicable
        if (sType === 'youtube') {
            const url = document.getElementById('urlInput').value;
            const ytId = extractYoutubeId(url);
            formData.append('youtube_id', ytId);
        }

        try {
            const result = await window.api.postMultipart('/api/resources/upload', formData);
            if (result.ok) {
                alert("Resource published successfully!");
                window.location.href = 'resources.html';
            } else {
                alert(result.message || "Upload failed.");
            }
        } catch (err) {
            alert("System error. Check connection.");
        } finally {
            btnText.classList.remove('d-none');
            btnLoader.classList.add('d-none');
        }
    };

    function extractYoutubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : url;
    }

    init();
});