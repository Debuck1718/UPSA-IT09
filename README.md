🎓 Academic Resource & Course Slide Hub (Production)
🚀 Overview
A scalable, multi-institution digital hub designed to bridge the gap between classroom slides and universal academic resources. The platform supports private class-level access for course slides while providing a global "Resource Center" for program-specific materials, community discussions, and targeted announcements.

🛠️ Tech Stack
Backend: Node.js (Express)

Database: Supabase (PostgreSQL)

Storage: Supabase Storage (Buckets for PDFs/PPTs)

Frontend: EJS, Bootstrap 5, Custom CSS

Hosting: Render

✨ Key Features
Multi-Tier Permissions:

Class Reps: Manage private course slides for their specific class groups.

Content Creators: Contribute approved videos, tools, and past papers to the Global Hub.

Student Leaders: Post targeted announcements (School or Program specific).

Students: Access private slides and explore shared resources.

Universal Resource Center: Curated videos (YouTube embedded), tools, and articles filtered by program (e.g., IT, Business).

Community Forum: Threaded, context-aware discussions linked to resources and classes.

In-App Media: Direct YouTube playback via Iframe API to keep students on-platform.

⚙️ Setup Instructions
1. Environment Configuration
Create a .env file in the root directory and add your Supabase credentials:

Code snippet
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SESSION_SECRET=your_strong_random_secret
NODE_ENV=production
2. Install Dependencies
Bash
npm install
3. Database Migration
Run the SQL scripts provided in the documentation via the Supabase SQL Editor to set up the following tables:

users_app (with boolean permission flags)

resource_categories

resources

announcements

forum_posts

4. Run the Server
Bash
npm start
Access the app at http://localhost:3000.

🌐 Deployment (Render)
This application is optimized for Render Web Services.

Build Command: npm install

Start Command: npm start

Environment Variables: Copy all values from your .env to the Render "Environment" tab.

Health Check: Ensure the app is listening on 0.0.0.0 via process.env.PORT.

🔒 Security & Production Notes
Data Integrity: All resources uploaded by "Creators" enter a pending state for Admin approval.

Session Management: Uses express-session with a persistent store. Ensure trust proxy is enabled on Render for secure cookie handling.

Privacy: Course slides are strictly filtered by class_group_id and institution_id to ensure school-level privacy.

Security Headers: Powered by helmet to mitigate common web vulnerabilities.

Same-Origin Policy: The frontend and API share the same origin to avoid CORS issues and enhance security.

📁 File Management
Slides: Stored in Supabase Storage buckets.

External Content: YouTube videos are embedded via ID to reduce server bandwidth.

Articles: Content is stored directly in the PostgreSQL database for fast indexing and search.

Developed for UPSA and the wider academic community.