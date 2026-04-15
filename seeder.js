const seedResources = async () => {
  // These should match your actual DB IDs for these categories
  const categories = {
    articles: "cat_id_1",
    pastPapers: "cat_id_2",
    tools: "cat_id_3",
    tutorials: "cat_id_4",
  };

  const resources = [
    {
      title: "Cybersecurity Lessons for 2026",
      description:
        "Focus on AI-powered attacks and Zero Trust architecture for modern systems.",
      url: "https://www.bcs.org/articles-opinion-and-research/cybersecurity-lessons-for-2026/",
      category_id: categories.articles,
      file_type: "Link",
    },
    {
      title: "MIT OpenCourseWare: Algorithms Exam",
      description:
        "Standard past papers and exams for Data Structures & Algorithms (6.006).",
      url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resource-type/exams/",
      category_id: categories.pastPapers,
      file_type: "PDF",
    },
    {
      title: "Postman API Platform",
      description:
        "The essential tool for testing Node.js backends and REST APIs.",
      url: "https://www.postman.com/",
      category_id: categories.tools,
      file_type: "Tool",
    },
    {
      title: "JavaScript Developer Full Course 2026",
      description:
        "Comprehensive 8+ hour guide covering ES6+, Async/Await, and DOM.",
      youtube_id: "hBfhRlOJlpg",
      url: "https://www.youtube.com/watch?v=hBfhRlOJlpg",
      category_id: categories.tutorials,
      file_type: "Video",
    },
  ];

  console.log("🚀 Starting database seed...");

  for (const res of resources) {
    try {
      await window.api.fetch("/api/admin/resources/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(res),
      });
      console.log(`✅ Seeded: ${res.title}`);
    } catch (err) {
      console.error(`❌ Failed to seed ${res.title}:`, err);
    }
  }

  alert("Seeding Complete!");
};
// Add this at the bottom of seeder.js
init().then(() => {
  seedResources();
});
