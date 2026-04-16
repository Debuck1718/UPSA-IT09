window.seedResources = async () => {
    const confirmSeed = confirm("This will attempt to add sample resources to your library. Proceed?");
    if (!confirmSeed) return;

    // 1. Create Categories First
    const cats = ["Industry Articles", "Past Papers", "Tools & Links", "Video Tutorials"];
    console.log("Creating categories...");
    
    for (const name of cats) {
        try {
            await window.api.fetch('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
        } catch (e) { console.log(`Category ${name} might already exist.`); }
    }

    // 2. Fetch Category IDs
    const currentCats = await window.api.fetch('/api/categories');
    const getID = (name) => currentCats.find(c => c.name === name)?.id;

    // 3. Define Resources
    const resources = [
        { title: "Cybersecurity 2026", url: "https://www.bcs.org/articles-opinion-and-research/cybersecurity-lessons-for-2026/", category_id: getID("Industry Articles") },
        { title: "MIT Algorithms Exam", url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resource-type/exams/", category_id: getID("Past Papers") },
        { title: "Postman API Tool", url: "https://www.postman.com/", category_id: getID("Tools & Links") },
        { title: "JS Full Course 2026", url: "https://www.youtube.com/watch?v=hBfhRlOJlpg", category_id: getID("Video Tutorials") }
    ];

    // 4. Upload
    for (const res of resources) {
        if (!res.category_id) continue;
        try {
            await window.api.fetch('/api/admin/resources/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...res, description: "Automated Seed Resource", file_type: "Link", is_approved: true })
            });
            console.log(`✅ Seeded: ${res.title}`);
        } catch (e) { console.error(`❌ Error seeding ${res.title}`); }
    }

    alert("Seed Process Finished! Refresh the library to see updates.");
    if (typeof loadCategories === 'function') loadCategories();
};