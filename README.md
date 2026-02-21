# UPSA-IT09 Course Slides Web App (Node.js)

## Features
- User authentication (students, course reps)
- Course reps can upload slides (PDF, PPT, PPTX)
- Students can download slides for their course only
- Modern, personalized dashboard (EJS + Bootstrap)

## Demo Users
- student1 / studentpass (IT09)
- student2 / studentpass (IT10)
- (removed teachers) 
- rep1 / reppass (IT09)
- rep2 / reppass (IT10)

## Setup Instructions

1. **Install dependencies**

   Open a terminal in this folder and run:
   
   ```bash
   npm install
   ```

2. **Run the backend server**

   Start the Node.js backend which serves the API and the dashboard pages:

   ```bash
   npm start
   ```

3. **Open in browser (same-origin recommended)**

   - Recommended: open the app served by the backend at http://localhost:3000 so the frontend and API share the same origin. This avoids CORS/403 errors during login.
   - If you open the static files via a different origin (e.g., Live Server on 127.0.0.1:5500 or file://), login requests will be cross-origin and may be blocked unless CORS is enabled on the backend.

   Troubleshooting 403 on login:
   - Symptom: 403 Forbidden on POST /api/login when opening from a different origin (e.g., Live Server or file://).
   - Fix A (preferred): open the app via http://localhost:3000 so it is same-origin with the API.
   - Fix B: enable CORS on the backend (add cors middleware and restart the server).
   - Ensure your browser allows cookies for localhost and no extensions are blocking requests.

4. **Login**
   Use one of the demo users above.

5. **Upload/Download**

   - Teachers and reps can upload slides.
   - Students can download slides for their course only.

## Notes
- Uploaded files are stored in the `uploads` folder.
- Users and slides are now persisted in an SQLite database (`data.db`) using `better-sqlite3`.
- To add users modify the `db.js` seeding or add them via SQL. For production, use a secure secret key and hashed passwords (bcrypt).

## Deploy to Render

Deploy this app as a Web Service on Render:

- Create a new Web Service on Render and connect this repository.
- Build command: npm ci && npm rebuild better-sqlite3 --build-from-source
- Start command: npm start (the app should listen on process.env.PORT provided by Render)
- Environment:
  - NODE_ENV=production
  - Node version: 20.x (pin via "engines" in package.json or an .nvmrc). If you change Node, rebuild native modules.
- Native modules (better-sqlite3):
  - Render: the build command above compiles better-sqlite3 for the target environment.
  - Local: use Node 20.x (nvm use 20) and run npm install. If you switch Node versions, run: npm rebuild better-sqlite3 --build-from-source
- Persistent disk (recommended): add a Disk and mount it at /opt/render/project/src/uploads to persist uploaded slide files. You may also store data.db on a persistent Disk if you want the SQLite database to survive deploys.
- After deploy, open: https://<your-service>.onrender.com/public/index.html
Production/Security notes:
- Set app.set('trust proxy', 1) on Render so secure cookies work behind the proxy.
- Set cookies with secure: true when NODE_ENV=production and SameSite=Lax (or Strict if appropriate).
- Consider using helmet to add standard security headers.
- Validate and limit uploads (PDF/PPT/PPTX only) and cap size (e.g., 15MB).
- Serve /public with caching for static assets but avoid caching HTML; serve /uploads read-only.
- Prefer same-origin access; keep CORS disabled in production unless explicitly needed.

Troubleshooting:
- If login returns 403 when opened from a different origin, open the app from the same origin as the API (the Render URL), or enable CORS on the backend.