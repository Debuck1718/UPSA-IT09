window.seedResources = async () => {
    const confirmSeed = confirm("Ready to populate the library with sample data?");
    if (!confirmSeed) return;

    console.log("🚀 Starting Seed Process...");

    // 1. Get current categories so we have valid category_ids
    let currentCats = [];
    try {
        currentCats = await window.api.fetch('/api/categories');
    } catch (e) {
        console.error("Could not fetch categories", e);
    }

    const getCategoryId = (name) => {
        const found = currentCats.find(c => c.name.toLowerCase() === name.toLowerCase());
        return found ? found.id : null;
    };

    // 2. Sample Data
    const seedData = [
        { 
            title: "Cybersecurity 2026", 
            cat: "Industry Articles", 
            url: "https://www.bcs.org/articles-opinion-and-research/cybersecurity-lessons-for-2026/",
            desc: "Critical cybersecurity trends and forecasts for the 2026 digital economy."
        },
        { 
            title: "MIT Algorithms Exam", 
            cat: "Past Papers", 
            url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resource-type/exams/",
            desc: "Practice exam materials for data structures and algorithm analysis."
        },
        { 
            title: "Postman API Tool", 
            cat: "Tools & Links", 
            url: "https://www.postman.com/",
            desc: "The industry standard platform for building and using APIs."
        },
        { 
            title: "JS Full Course 2026", 
            cat: "Video Tutorials", 
            url: "https://www.youtube.com/watch?v=hBfhRlOJlpg",
            desc: "Comprehensive JavaScript masterclass updated for modern standards."
        }
    ];

    // 3. Loop and Upload
    for (const item of seedData) {
        const catId = getCategoryId(item.cat);
        
        if (!catId) {
            console.warn(`⚠️ Skipping "${item.title}": Category "${item.cat}" does not exist in your database.`);
            continue;
        }

        try {
            const payload = {
                title: item.title,
                description: item.desc,
                url: item.url,
                youtube_id: item.url.includes('youtube.com') ? new URL(item.url).searchParams.get('v') : null,
                category_id: catId,
                is_global: true,
                status: 'approved' // Match the backend 'approved' default
            };

            const response = await window.api.fetch('/api/admin/resources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok || response.resource) {
                console.log(`✅ Successfully Seeded: ${item.title}`);
            }
        } catch (e) {
            console.error(`❌ Error seeding ${item.title}:`, e);
        }
    }

    alert("Seeding complete! Check your console for details.");
    if (typeof loadPendingResources === 'function') loadPendingResources();
};