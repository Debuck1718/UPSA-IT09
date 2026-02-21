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
