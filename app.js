const express = require('express');
const session = require('express-session');
let multer; try { multer = require('multer'); } catch (_) { multer = null; }
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
// Force server port to 3000 so frontend (Live Server) can communicate reliably
const PORT = 3000;

// Database (Postgres via Supabase)
const db = require('./db_pg');
// Validate critical envs (non-fatal warnings)
;(function validateEnv() {
  const missing = [];
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_KEY) missing.push('SUPABASE_SERVICE_KEY');
  if (!process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
  if (missing.length) {
    console.warn('[env] Missing variables:', missing.join(', '));
  }
})();
// Initialize DB schema (store promise to await on server start)
let schemaReady = Promise.resolve();
if (typeof db.initSchema === 'function') {
  schemaReady = db.initSchema().catch(err => {
    console.error('Failed to init database schema:', err);
  });
}
// Small env health endpoint (no secrets)
app.get('/api/env/health', (req, res) => {
  res.json({
    ok: true,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    hasSessionSecret: !!process.env.SESSION_SECRET
  });
});const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { parse } = require('csv-parse/sync');

// Multer setup for file uploads (limits + basic filtering)
let upload;
if (multer) {
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  upload = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per file
    fileFilter: (req, file, cb) => {
      const allowedMimes = new Set([
        'application/pdf',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel'
      ]);
      if (allowedMimes.has(file.mimetype)) return cb(null, true);
      return cb(new Error('Invalid file type'));
    }
  });
} else {
  upload = {
    single: () => (req, res, next) => res.status(503).send('File upload is not available on this server')
  };
}
// Security and parsers
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve static frontend with cache hints
app.use('/public', express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  setHeaders: function (res, filePath) {
    if (/\.(html)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  immutable: false,
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
}));

// Enable CORS for Live Server origins to allow cross-origin login during development
const allowedOrigins = new Set([
  'http://127.0.0.1:5500',
  'http://127.0.0.1:5501',
  'http://localhost:5500',
  'http://localhost:5501'
]);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  exposedHeaders: ['Set-Cookie']
}));
app.options('*', cors());

const pgSession = require('connect-pg-simple')(session);
const isProd = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'your_secret_key';

app.use(session({
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    tableName: 'user_sessions'
  }),
  name: 'sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}))// --- Static pages ---
app.get('/', (req, res) => {
  res.redirect(302, '/public/index.html');
});

// Middleware to sanitize any downstream redirect Location headers (defense-in-depth)
app.use((req, res, next) => {
  const originalRedirect = res.redirect.bind(res);
  res.redirect = (statusOrUrl, maybeUrl) => {
    let status = 302;
    let url = statusOrUrl;
    if (typeof statusOrUrl === 'number') {
      status = statusOrUrl;
      url = maybeUrl;
    }
    if (typeof url === 'string') {
      const isAbsolute = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url);
      if (isAbsolute) {
        try {
          const u = new URL(url);
          if (process.env.NODE_ENV === 'production' || /^localhost$/i.test(u.hostname)) {
            url = '/public/index.html';
          }
        } catch (_) {
          url = '/public/index.html';
        }
      } else {
        const safe = path.posix.normalize(url);
        url = safe.startsWith('/') ? safe : `/${safe}`;
      }
    }
    return originalRedirect(status, url);
  };
  next();
});
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  return res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// --- API: authentication & session ---
app.post('/api/login', async (req, res) => {
  const { studentId, password, redirect: requestedRedirect } = req.body;

  if (!studentId || !password) {
    return res.status(400).json({ ok: false, message: 'Student ID and password are required' });
  }

  const user = await db.findUserByStudentId(studentId);
  // Removed email verification enforcement: login proceeds regardless of email verification status
  if (user && user.password && bcrypt.compareSync(password, user.password)) {
    req.session.user = {
      id: user.id,
      username: user.username || studentId,
      name: user.full_name || user.username || studentId,
      role: user.role || 'student',
      course: user.course || null,
      program: user.program || null,
      classGroup: user.classGroup || user.class_group || null
    };

    // Coerce any requested redirect to a safe relative path only
    let redirect = null;
    const candidate = typeof requestedRedirect === 'string' ? requestedRedirect : (typeof req.query.redirect === 'string' ? req.query.redirect : null);
    if (candidate && candidate.startsWith('/') && !candidate.startsWith('//')) {
      const safe = path.posix.normalize(candidate);
      redirect = safe.startsWith('/') ? safe : `/${safe}`;
    }

    if (redirect) return res.json({ ok: true, redirect });
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, message: 'Invalid credentials' });
});
// signup
app.post('/api/signup', async (req, res) => {
  const { studentId, full_name, email, password, course, program, classGroup, inviteToken } = req.body;
  if (!studentId || !full_name || !email || !password || !course) return res.status(400).json({ ok: false, message: 'Missing fields' });
  // uniqueness
  if (await db.getUser(studentId) || await db.findUserByEmail(email)) return res.status(409).json({ ok: false, message: 'Student ID or email already exists' });
  // default role: student (admin must promote to elevated roles)
  const role = 'student';
  const hashed = bcrypt.hashSync(password, 10);
  const normalizedClassGroup = (typeof db.normalizeClassGroup === 'function'
    ? db.normalizeClassGroup(classGroup)
    : (typeof classGroup === 'string' ? classGroup.trim().toLowerCase() : null));
  const user = { id: studentId, username: studentId.toLowerCase(), full_name, email, password: hashed, role, course, program: program || null, classGroup: normalizedClassGroup, is_active: false, created_at: new Date().toISOString() };
  await db.addUser(user);  // create email token
  const token = uuidv4();
  await db.setEmailToken(studentId, token);
  // send verification email (console for now)
  const verifyUrl = `${req.protocol}://${req.get('host')}/api/verify-email?token=${token}`;
  console.log('SEND EMAIL:', { to: email, subject: 'Verify your account', body: `Click to verify: ${verifyUrl}` });
  return res.json({ ok: true, message: 'Registered. Please check your email to verify your account.' });
});
app.get('/api/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');
  const user = await db.activateUserByToken(token);
  if (!user) return res.status(400).send('Invalid or expired token');
  return res.sendFile(path.join(__dirname, 'public', 'verify-success.html'));
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  return res.json({ ok: true, user: req.session.user });
});

// --- Admin APIs ---
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ ok: false });
  if (req.session.user.role !== 'admin') return res.status(403).json({ ok: false });
  return next();
}

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const all = await db.getAllUsers();
  return res.json({ ok: true, users: all });
});

app.post('/api/admin/promote', requireAdmin, async (req, res) => {
  const { studentId, role } = req.body;
  const allowed = ['student', 'course_rep', 'rep_assistant', 'course_secretary', 'admin'];
  if (!studentId || !role) return res.status(400).json({ ok: false, message: 'Missing fields' });
  if (!allowed.includes(role)) return res.status(400).json({ ok: false, message: 'Invalid role' });
  const u = await db.findUserByStudentId(studentId) || await db.getUserById(studentId);
  if (!u) return res.status(404).json({ ok: false, message: 'User not found' });
  const updated = await db.setUserRole(u.id, role);
  return res.json({ ok: true, user: { id: updated.id, role: updated.role } });
});
app.post('/api/admin/import', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: 'No file' });
  try {
    const content = fs.readFileSync(req.file.path);
    const records = parse(content, { columns: true, skip_empty_lines: true });
    let imported = 0, skipped = 0;
    for (const r of records) {
      const studentId = (r.studentId || r.id || '').trim();
      const username = (r.username || studentId).trim();
      const full_name = (r.full_name || r.name || '').trim();
      const email = (r.email || '').trim() || null;
      const course = (r.course || '').trim() || null;
      const role = (r.role || 'student').trim();
      let password = (r.password || '').trim();
      if (!studentId) { skipped++; continue; }
      if (await db.getUser(studentId) || (email && await db.findUserByEmail(email))) { skipped++; continue; }
      if (!password) password = Math.random().toString(36).slice(2,10) + 'A1!';
      const hashed = require('bcryptjs').hashSync(password, 10);
      const user = { id: studentId, username, full_name, email, password: hashed, role, course, is_active: 1, created_at: new Date().toISOString() };
      await db.addUser(user);
      imported++;
    }
    return res.json({ ok: true, imported, skipped });
  } catch (err) {
    console.error('Import error', err);
    return res.status(500).json({ ok: false, message: 'Import failed' });
  }
});

// --- API: slides ---
app.get('/api/slides', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  const { course, role, classGroup } = req.session.user;
  const normalize = (v) => {
    if (typeof db.normalizeClassGroup === 'function') return db.normalizeClassGroup(v);
    return (typeof v === 'string' ? v.trim().toLowerCase() : '');
  };
  try {
    let slides = await db.getSlidesByCourse(course);

    const qCourseTitle = typeof req.query.courseTitle === 'string' ? req.query.courseTitle.trim() : '';
    const qClassGroup = normalize(typeof req.query.classGroup === 'string' ? req.query.classGroup : '');

    if (Array.isArray(slides)) {
      if (role !== 'admin') {
        const userGroup = normalize(classGroup);
        if (userGroup) {
          slides = slides.filter(s => {
            const slideGroupRaw = s && (s.classGroup ?? s.class_group ?? s.classgroup ?? s.class_group_id ?? s.classGroupId);
            const slideGroup = normalize(slideGroupRaw);
            return slideGroup ? slideGroup === userGroup : true;
          });
        }
      }
      if (qClassGroup) {
        slides = slides.filter(s => {
          const slideGroupRaw = s && (s.classGroup ?? s.class_group ?? s.classgroup ?? s.class_group_id ?? s.classGroupId);
          const slideGroup = normalize(slideGroupRaw);
          return slideGroup === qClassGroup;
        });
      }
      if (qCourseTitle) {
        slides = slides.filter(s => {
          const ct = (s.courseTitle ?? s.course_title ?? s.course ?? '').toString().trim();
          return ct === qCourseTitle;
        });
      }
      slides = slides.map(s => ({
        id: String(s.id ?? s.slide_id ?? s.uuid ?? s.object_id ?? s.filename),
        classGroup: s.classGroup ?? s.class_group ?? s.classgroup ?? s.class_group_id ?? s.classGroupId ?? null,
        course: s.course ?? s.course_title ?? s.courseTitle ?? null,
        courseTitle: s.courseTitle ?? s.course_title ?? s.course ?? null,
        slideTitle: s.slideTitle ?? s.slide_title ?? s.title ?? null,
        filename: s.filename ?? s.object_path ?? s.file ?? s.path ?? s.name,
        originalName: s.originalName ?? s.original_name ?? s.originalname ?? null,
        createdAt: s.createdAt ?? s.created_at ?? null
      }));
    }

    return res.json({ ok: true, slides });
  } catch (e) {
    console.error('Slides list error', e);
    return res.status(500).json({ ok: false, message: 'Failed to load slides' });
  }
});

app.get('/api/slides/:id/url', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  const user = req.session.user;
  const slideId = String(req.params.id);

  try {
    let slide = null;

    if (typeof db.getSlideById === 'function') {
      try {
        slide = await db.getSlideById(slideId);
      } catch (_) {}
    }
    if (!slide) {
      const slides = await db.getSlidesByCourse(user.course);
      if (Array.isArray(slides)) {
        slide = slides.find(s => String(s.id ?? s.slide_id ?? s.uuid ?? s.object_id ?? s.filename) === slideId);
      }
    }

    if (!slide) return res.status(404).json({ ok: false, message: 'Slide not found' });

    const { role, course, classGroup: userClassGroup } = user;

    const slideCourse = slide.course ?? slide.course_title ?? slide.courseTitle ?? null;
    const slideGroup = (typeof db.normalizeClassGroup === 'function')
      ? db.normalizeClassGroup(slide.classGroup ?? slide.class_group ?? slide.classgroup ?? slide.class_group_id ?? slide.classGroupId)
      : ((slide.classGroup ?? slide.class_group ?? slide.classgroup ?? slide.class_group_id ?? slide.classGroupId ?? '').toString().trim().toLowerCase());

    const userGroupNorm = (typeof db.normalizeClassGroup === 'function') ? db.normalizeClassGroup(userClassGroup) : (userClassGroup || '').toString().trim().toLowerCase();

    if (role === 'student') {
      if (slideCourse && slideCourse !== course) return res.status(403).json({ ok: false, message: 'Not allowed' });
      if (slideGroup && userGroupNorm && slideGroup !== userGroupNorm) return res.status(403).json({ ok: false, message: 'Not allowed' });
    }

    const filename = slide.filename || slide.fileName || slide.file || slide.path || slide.name || slide.object_path;
    if (!filename) return res.status(500).json({ ok: false, message: 'Slide filename missing' });

    return res.json({ ok: true, url: `/download/${encodeURIComponent(filename)}` });
  } catch (e) {
    console.error('Signed URL generation error', e);
    return res.status(500).json({ ok: false, message: 'Failed to create URL' });
  }
});

app.get('/api/slides/:id/url', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  const user = req.session.user;
  const slideId = String(req.params.id);

  try {
    let slide = null;

    if (typeof db.getSlideById === 'function') {
      try {
        slide = await db.getSlideById(slideId);
      } catch (_) {}
    }
    if (!slide) {
      const slides = await db.getSlidesByCourse(user.course);
      if (Array.isArray(slides)) {
        slide = slides.find(s => String(s.id ?? s.slide_id ?? s.uuid ?? s.object_id ?? s.filename) === slideId);
      }
    }

    if (!slide) return res.status(404).json({ ok: false, message: 'Slide not found' });

    const { role, course, classGroup: userClassGroup } = user;

    const slideCourse = slide.course ?? slide.course_title ?? slide.courseTitle ?? null;
    const slideGroup = (typeof db.normalizeClassGroup === 'function')
      ? db.normalizeClassGroup(slide.classGroup ?? slide.class_group ?? slide.classgroup ?? slide.class_group_id ?? slide.classGroupId)
      : ((slide.classGroup ?? slide.class_group ?? slide.classgroup ?? slide.class_group_id ?? slide.classGroupId ?? '').toString().trim().toLowerCase());

    const userGroupNorm = (typeof db.normalizeClassGroup === 'function') ? db.normalizeClassGroup(userClassGroup) : (userClassGroup || '').toString().trim().toLowerCase();

    if (role === 'student') {
      if (slideCourse && slideCourse !== course) return res.status(403).json({ ok: false, message: 'Not allowed' });
      if (slideGroup && userGroupNorm && slideGroup !== userGroupNorm) return res.status(403).json({ ok: false, message: 'Not allowed' });
    }

    const filename = slide.filename || slide.fileName || slide.file || slide.path || slide.name || slide.object_path;
    if (!filename) return res.status(500).json({ ok: false, message: 'Slide filename missing' });

    return res.json({ ok: true, url: `/download/${encodeURIComponent(filename)}` });
  } catch (e) {
    console.error('Signed URL generation error', e);
    return res.status(500).json({ ok: false, message: 'Failed to create URL' });
  }
});
// Signed URL-like endpoint for a slide (by id) that returns a safe download URL
app.get('/api/slides/:id/url', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  const user = req.session.user;
  const slideId = String(req.params.id);

  try {
    let slide = null;

    if (typeof db.getSlideById === 'function') {
      try {
        slide = await db.getSlideById(slideId);
      } catch (_) {}
    }
    if (!slide) {
      const slides = await db.getSlidesByCourse(user.course);
      if (Array.isArray(slides)) {
        slide = slides.find(s => String(s.id ?? s.slide_id ?? s.uuid ?? s.object_id ?? s.filename ?? s.object_path) === slideId);
      }
    }

    if (!slide) return res.status(404).json({ ok: false, message: 'Slide not found' });

    const { role, course, classGroup: userClassGroup } = user;

    const normalizeGroup = (v) => {
      if (typeof db.normalizeClassGroup === 'function') return db.normalizeClassGroup(v);
      return (v ?? '').toString().trim().toLowerCase();
    };

    const slideCourse = slide.course ?? slide.course_title ?? slide.courseTitle ?? null;
    const slideGroup = normalizeGroup(slide.classGroup ?? slide.class_group ?? slide.classgroup ?? slide.class_group_id ?? slide.classGroupId);
    const userGroupNorm = normalizeGroup(userClassGroup);

    if (role === 'student') {
      if (slideCourse && slideCourse !== course) return res.status(403).json({ ok: false, message: 'Not allowed' });
      if (slideGroup && userGroupNorm && slideGroup !== userGroupNorm) return res.status(403).json({ ok: false, message: 'Not allowed' });
    }

    const filename = slide.object_path || slide.filename || slide.fileName || slide.file || slide.path || slide.name;
    if (!filename) return res.status(500).json({ ok: false, message: 'Slide filename missing' });

    const normalized = {
      id: slide.id ?? slide.slide_id ?? slide.uuid ?? slide.object_id ?? filename,
      classGroup: slide.classGroup ?? slide.class_group ?? slide.classgroup ?? slide.class_group_id ?? slide.classGroupId ?? null,
      course: slide.course ?? null,
      courseTitle: slide.courseTitle ?? slide.course_title ?? slide.course ?? null,
      slideTitle: slide.slideTitle ?? slide.slide_title ?? slide.title ?? null,
      filename,
      originalname: slide.originalname ?? slide.original_name ?? slide.originalName ?? null,
      createdAt: slide.createdAt ?? slide.created_at ?? null
    };

    return res.json({ ok: true, url: `/download/${encodeURIComponent(filename)}`, slide: normalized });
  } catch (e) {
    console.error('Signed URL generation error', e);
    return res.status(500).json({ ok: false, message: 'Failed to create URL' });
  }
});
app.post('/upload', upload.single('file'), async (req, res) => {  if (!req.session.user || !['course_rep','rep_assistant','course_secretary','admin'].includes(req.session.user.role)) {
    return res.status(403).send('Unauthorized');
  }
  if (!req.file) return res.status(400).send('No file');

  // Strictly validate file extension for slides and cleanup on failure
  try {
    const originalName = req.file.originalname || '';
    const ext = path.extname(originalName).toLowerCase();
    const allowedExt = new Set(['.pdf', '.ppt', '.pptx']);
    if (!allowedExt.has(ext)) {
      try { fs.unlinkSync(path.join(__dirname, 'uploads', req.file.filename)); } catch (_) {}
      return res.status(400).send('Only PDF, PPT, or PPTX files are allowed.');
    }
  } catch (_) {
    // If validation throws, treat as bad request
    try { fs.unlinkSync(path.join(__dirname, 'uploads', req.file.filename)); } catch (_) {}
    return res.status(400).send('Invalid file upload.');
  }

  const rawClassGroup = (req.body && typeof req.body.classGroup === 'string') ? req.body.classGroup.trim() : '';
  const classGroup = (typeof db.normalizeClassGroup === 'function') ? db.normalizeClassGroup(rawClassGroup) : (rawClassGroup || '').trim().toLowerCase();
  const program = (req.session && req.session.user && typeof req.session.user.program === 'string')
    ? req.session.user.program
    : null;

  if (!classGroup) {
    return res.status(400).send('classGroup is required');
  }
  if (classGroup.length > 100) {
    return res.status(400).send('classGroup is too long');
  }

  try {
    const slideTitle = (req.body && typeof req.body.slideTitle === 'string') ? req.body.slideTitle.trim() : '';
    const rawCourseTitle = (req.body && typeof req.body.courseTitle === 'string') ? req.body.courseTitle.trim() : '';
    const explicitCourse = (req.body && typeof req.body.course === 'string') ? req.body.course.trim() : '';

    if (!slideTitle) {
      return res.status(400).send('Slide Title is required.');
    }
    if (!rawCourseTitle && !explicitCourse) {
      return res.status(400).send('Course Title is required.');
    }
    if (slideTitle.length > 200 || rawCourseTitle.length > 200) {
      return res.status(400).send('Titles are too long (max 200 chars).');
    }

    const legacyCourse = explicitCourse || rawCourseTitle || (req.session.user && req.session.user.course) || 'Uncategorized';

    await db.insertSlide({
      filename: req.file.filename,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
      sizeBytes: req.file.size,
      uploaderId: (req.session && req.session.user && req.session.user.id) ? req.session.user.id : 'unknown',
      uploaderName: req.session.user.name,
      course: legacyCourse,
      classGroup,
      program,
      slideTitle,
      courseTitle: rawCourseTitle || legacyCourse,
      createdAt: new Date().toISOString()
    });
    if (rawCourseTitle && typeof db.addCourseTitleForClass === 'function') {
      await db.addCourseTitleForClass(classGroup, rawCourseTitle);
    }
    return res.redirect('/dashboard');
  } catch (e) {
    console.error('Upload save error', e);
    return res.status(500).send('Upload failed');
  }
});app.get('/download/:filename', async (req, res) => {  if (!req.session.user) return res.redirect('/');
  const { role, course, classGroup: userClassGroup } = req.session.user;
  const slide = await db.getSlideByFilename(req.params.filename);
  if (!slide) return res.status(404).send('File not found');
  if (role === 'student') {
    if (slide.course !== course) return res.status(403).send('Not allowed');
    if (slide.classGroup && userClassGroup && slide.classGroup !== userClassGroup) return res.status(403).send('Not allowed');
  }
  return res.download(path.join(__dirname, 'uploads', req.params.filename), slide.originalname);
});// start
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// health endpoint for keepalive
app.get('/healthz', (req, res) => res.status(200).send('ok'));

(async () => {
  try {
    if (typeof db.initSchema === 'function') {
      await db.initSchema();
    }
  } catch (err) {
    console.warn('Continuing without confirmed schema init; errors may occur until DB is ready.', err);
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Self-ping keepalive (optional)
    if (process.env.KEEPALIVE === 'true') {
      const origin = process.env.KEEPALIVE_URL || `http://localhost:${PORT}`;
      const url = `${origin.replace(/\/+$/, '')}/healthz`;
      const intervalMs = Number(process.env.KEEPALIVE_INTERVAL_MS || 60000);
      console.log(`[keepalive] enabled; pinging ${url} every ${intervalMs}ms`);
      const mod = url.startsWith('https') ? require('https') : require('http');
      setInterval(() => {
        try {
          const req = mod.get(url, (res) => { res.resume(); });
          req.on('error', () => {});
        } catch (_) {}
      }, intervalMs);
    }
  });
})();