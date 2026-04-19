window.seedResources = async () => {
    const confirmSeed = confirm("Ready to seed the NEW 2026 resources?");
    if (!confirmSeed) return;

    console.log("🚀 Starting Incremental Seed...");

    try {
        // 1. Get existing data to prevent duplicates
        const [cats, existingResources] = await Promise.all([
            window.api.fetch('/api/categories'),
            window.api.fetch('/api/resources')
        ]);

        const getCategoryId = (name) => {
            const found = cats.find(c => c.name.toLowerCase() === name.toLowerCase());
            return found ? found.id : null;
        };

        // 2. Updated data with verified working YouTube links for 2026
        const newSeedData = [
            { 
                title: "ICT Year 2 Workbook (GES)", 
                cat: "Past Papers", 
                url: "https://curriculumresources.edu.gh/wp-content/uploads/2025/10/ICT-YEAR-2-LV-ONLINE.pdf",
                desc: "Official Ghana Education Service workbook for advanced computing students."
            },
            { 
                title: "Harvard CS50 2026", 
                cat: "Video Tutorials", 
                url: "https://www.youtube.com/watch?v=LfaMVlDaQ24",
                desc: "Harvard University's introduction to the intellectual enterprises of computer science."
            },
            { 
                title: "Python for Beginners Tutorial", 
                cat: "Video Tutorials", 
                url: "https://www.youtube.com/watch?v=_uQrJ0TkZlc", // Updated to verified link
                desc: "Comprehensive Python programming guide, perfect for new coders."
            },
            { 
                title: "Excel for Beginners - Complete Course", 
                cat: "Video Tutorials", 
                url: "https://www.youtube.com/watch?v=wbJcJCkBcMg", // Updated to verified link
                desc: "The complete guide to mastering Excel basics by Technology for Teachers and Students."
            },
            { 
                title: "JavaScript for Beginners - Complete Course by Carnes", 
                cat: "Video Tutorials", 
                url: "https://www.youtube.com/watch?v=PkZNo7MFNFg", // Updated to verified link
                desc: "The complete guide to mastering JavaScript basics by FreeCodeCamp.org and Beau Carnes."
            },
            { 
                title: "Microsoft Word for Beginners", 
                cat: "Video Tutorials", 
                url: "https://www.youtube.com/watch?v=S-nHYzK-BVg",
                desc: "A full beginner's course on Microsoft Word essentials and document formatting."
            },
            { 
                title: "SQL Course for Beginners by Mosh", 
                cat: "Video Tutorials", 
                url: "https://www.youtube.com/watch?v=7S_tz1z_5bA",
                desc: "A full beginner's course on SQL for AI, machine learning and data analysis ."
            },
            { 
                title: "C++ Full Course by Bro Code", 
                cat: "Video Tutorials", 
                url: "https://www.youtube.com/watch?v=-TkoO8Z07hI",
                desc: "A full beginner's course on C++ which will upgrade your skills for video editing, developing gaming softwares and more."
            },
            { 
                title: "Java Full Course for beginners by Mosh", 
                cat: "Video Tutorials", 
                url: "https://www.youtube.com/watch?v=eIrMbAQSU34",
                desc: "A full beginner friendly course on Java."
            },
            { 
                title: "Full Stack Open 2026", 
                cat: "Industry Articles", 
                url: "https://fullstackopen.com/en/",
                desc: "Modern JavaScript development (React, Node, GraphQL) from the University of Helsinki."
            },
            { 
                title: "IT Industry Outlook 2026", 
                cat: "Industry Articles", 
                url: "https://publicsectornetwork.com/insight/it-industry-outlook-2026",
                desc: "Analysis of AI automation and Zero Trust security in the 2026 workforce."
            },
            { 
                title: "Google Responsible AI Foundations", 
                cat: "Tools & Links", 
                url: "https://www.cloudskillsboost.google/course_templates/554",
                desc: "Practical implementation of ethical frameworks in AI development."
            }
        ];

        // 3. Loop and Upload (with Duplicate Check)
        for (const item of newSeedData) {
            if (existingResources.some(r => r.title === item.title)) {
                console.log(`⏭️ Skipping "${item.title}" (Already exists)`);
                continue;
            }

            const catId = getCategoryId(item.cat);
            if (!catId) {
                console.warn(`⚠️ Skipping "${item.title}": Category "${item.cat}" not found.`);
                continue;
            }

            let ytId = null;
            try {
                if (item.url.includes('youtube.com')) {
                    ytId = new URL(item.url).searchParams.get('v');
                } else if (item.url.includes('youtu.be/')) {
                    ytId = item.url.split('youtu.be/')[1].split('?')[0];
                }
            } catch (urlErr) {
                console.warn(`Could not parse ID for ${item.url}`);
            }

            const payload = {
                title: item.title,
                description: item.desc,
                url: item.url,
                youtube_id: ytId,
                category_id: catId,
                is_global: true,
                status: 'approved' 
            };

            await window.api.fetch('/api/admin/resources', {
                method: 'POST',
                body: payload
            });

            console.log(`✅ Successfully Seeded: ${item.title}`);
        }

        alert("New resources added successfully!");
        if (typeof init === 'function') init(); // Refresh the grid

    } catch (e) {
        console.error("❌ Seeding Error:", e);
        alert("Check console for errors.");
    }
};