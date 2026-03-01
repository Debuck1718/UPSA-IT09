const express = require('express');
const session = require('express-session');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { parse } = require('csv-parse/sync');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

// Enable file upload parsing for CSV admin import and (optionally) other uploads
app.use(fileUpload({
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024 },
  abortOnLimit: true
}));

// Database (Postgres via Supabase)
const db = require('./db_pg');

// Supabase Storage client (service role)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'slides';
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_KEY) ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY) : null;

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
    hasSessionSecret: !!process.env.SESSION_SECRET,
    bucket: SUPABASE_BUCKET
  });
});
// Security and parsers
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

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

// CORS: allow in development only
if (process.env.NODE_ENV !== 'production') {
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
    credentials: true
  }));
  app.options('*', cors());
}

const pgSession = require('connect-pg-simple')(session);
const isProd = process.env.RENDER || process.env.NODE_ENV === 'production';
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
  proxy: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));// --- Static pages ---
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
        // Never allow absolute localhost or mismatched host redirects
        try {
          const u = new URL(url);
          if (/^localhost$/i.test(u.hostname) || /^127\.0\.0\.1$/i.test(u.hostname)) {
            url = '/public/index.html';
          } else {
            // Convert any absolute URL to a relative path to stay same-origin
            url = u.pathname + (u.search || '') + (u.hash || '');
          }
        } catch {
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
  // If admin, send to admin page instead of student dashboard
  if (req.session.user.role === 'admin') {
    return res.redirect('/public/admin.html');
  }
  return res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Who am I (quick role check)
app.get('/api/whoami', (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  return res.json({ ok: true, user: req.session.user });
});

// Admin guard
function requireAdmin(req, res, next) {
  const u = req.session?.user;
  if (!u) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  if (u.role !== 'admin') return res.status(403).json({ ok: false, message: 'Forbidden' });
  next();
}

// List users for admin
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.getAllUsers();
    res.json({ ok: true, users });
  } catch (e) {
    console.error('List users error:', e);
    res.status(500).json({ ok: false, message: 'Failed to load users' });
  }
});

// --- API: authentication & session ---
app.post('/api/login', async (req, res) => {
  try {
    const sid = (req.body?.studentId || '').trim();
    const password = req.body?.password || '';
    if (!sid || !password) {
      return res.status(400).json({ ok: false, message: 'Student ID and password are required' });
    }
    const user = await db.findUserByStudentId(sid);
    if (!user) return res.status(401).json({ ok: false, message: 'Invalid credentials' });

    // Current users created via signup use SHA-256; admin bootstrap uses bcrypt.
    const crypto = require('crypto');
    const shaValid = (user.password_hash && user.password_hash.length === 64 && user.password_hash === crypto.createHash('sha256').update(String(password)).digest('hex'));
    const bcryptValid = (user.password_hash && user.password_hash.startsWith('$2') && bcrypt.compareSync(password, user.password_hash));
    if (!shaValid && !bcryptValid) return res.status(401).json({ ok: false, message: 'Invalid credentials' });

    const sessionUser = {
      id: user.id,
      role: user.role,
      studentId: user.student_id,
      institutionId: user.institution_id,
      program: user.program || null,
      programId: user.program_id,
      cohortId: user.cohort_id,
      classGroup: user.class_group,
      classGroupId: user.class_group_id
    };
    req.session.user = sessionUser;
    res.cookie('sid', req.sessionID, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.json({ ok: true, user: sessionUser });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { studentId, full_name, email, password, program, classGroup, academicYearStart, institution } = req.body || {};
    if (!studentId || !full_name || !email || !password || !program || !classGroup || !academicYearStart) {
      return res.status(400).json({ ok: false, message: 'Missing fields' });
    }

    // Enforce Student ID 6–12 digits to support different schools (UPSA is 8)
    const idOk = /^\d{6,12}$/.test(String(studentId).trim());
    if (!idOk) {
      return res.status(400).json({ ok: false, message: 'Please enter a valid Student ID (6–12 digits).' });
    }

    // Uniqueness checks
    const [byId, byEmail] = await Promise.all([
      db.findUserByStudentId(studentId),
      db.findUserByEmail(email)
    ]);
    if (byId) return res.status(409).json({ ok: false, message: 'Student ID already exists.' });
    if (byEmail) return res.status(409).json({ ok: false, message: 'Email already registered.' });

    const user = await db.createUser({
      studentId,
      full_name,
      email,
      program,
      classGroup: db.normalizeClassGroup(classGroup),
      password, // db_pg hashes to sha256
      role: 'student',
      institutionId: institution || 'upsa',
      academicYearStart: Number(academicYearStart)
    });
    // Provide a redirect hint; client will navigate to /dashboard by default
    return res.json({ ok: true, user: { id: user.id, role: user.role }, redirect: '/dashboard' });
  } catch (e) {
    // Handle unique constraint gracefully if it still happens (race)
    if (e && e.code === '23505') {
      const msg = (e.detail && /Key \(email\)/.test(e.detail)) ? 'Email already registered.' : 'Student ID already exists.';
      return res.status(409).json({ ok: false, message: msg });
    }
    console.error('Signup error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// Availability check for signup
// GET /api/check-availability?studentId=&email=
app.get('/api/check-availability', async (req, res) => {
  try {
    const sid = (req.query.studentId || '').toString().trim();
    const email = (req.query.email || '').toString().trim().toLowerCase();
    let studentIdAvailable = true;
    let emailAvailable = true;

    if (sid) {
      const u = await db.findUserByStudentId(sid);
      studentIdAvailable = !u;
    }
    if (email) {
      const e = await db.findUserByEmail(email);
      emailAvailable = !e;
    }
    return res.json({ ok: true, studentIdAvailable, emailAvailable });
  } catch (err) {
    console.error('Availability check error:', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});
// Email verification flow not used in current production path (skipped)

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  return res.json({ ok: true, user: req.session.user });
});


app.post('/api/admin/create', async (req, res) => {
  try {
    const setupSecret = process.env.ADMIN_SETUP_SECRET;
    const provided = req.get('X-Admin-Setup-Secret') || req.get('x-admin-setup-secret');
    if (!setupSecret || !provided || setupSecret !== provided) {
      return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    const { studentId, full_name, email, password } = req.body || {};
    if (!studentId || !full_name || !email || !password) {
      return res.status(400).json({ ok: false, message: 'Missing required fields' });
    }

    // Avoid duplicates
    const exists = await db.findUserByStudentId(studentId);
    if (exists) {
      return res.status(409).json({ ok: false, message: 'Student ID already exists' });
    }

    
    const currentYear = new Date().getFullYear();
    const institutionId = 'upsa';
    const program = 'Administration';
    const programId = (db.programIdFromName ? db.programIdFromName(program) : 'administration');
    const cohortId = (db.makeCohortId ? db.makeCohortId(institutionId, programId, currentYear) : `${institutionId}|${programId}|${currentYear}`);
    const classGroup = (db.normalizeClassGroup ? db.normalizeClassGroup('ADM') : 'ADM');
    const classGroupId = (db.makeClassGroupId ? db.makeClassGroupId(cohortId, classGroup) : `${cohortId}|${classGroup}`);

    // Hash password (bcrypt) to align with current bcrypt usage in this file
    const hashed = bcrypt.hashSync(password, 10);

    // Insert directly with elevated role using db.createUser if it supports role, else create+update
    let user = null;
    if (typeof db.createUser === 'function') {
      user = await db.createUser({
        studentId,
        full_name,
        email,
        program,
        classGroup,
        password, // db_pg.createUser hashes with sha256 by default; we want bcrypt here for app.js compatibility
        role: 'admin',
        institutionId,
        academicYearStart: currentYear
      });
      // If db.createUser hashed differently, force-set bcrypt by updating password_hash
      if (user && user.id && db.pool) {
        try {
          await db.pool.query('update users_app set role=$1, password_hash=$2, program=$3, program_id=$4, institution_id=$5, cohort_id=$6, class_group=$7, class_group_id=$8 where id=$9', [
            'admin', hashed, program, programId, institutionId, cohortId, classGroup, classGroupId, user.id
          ]);
          const r = await db.findUserByStudentId(studentId);
          user = r || user;
        } catch (_) {}
      }
    } else if (db.pool) {
      
      const { rows } = await db.pool.query(
        `insert into users_app (student_id, full_name, email, role, institution_id, program, program_id, cohort_id, class_group, class_group_id, password_hash)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         returning *`,
        [studentId, full_name, email, 'admin', institutionId, program, programId, cohortId, classGroup, classGroupId, hashed]
      );
      user = rows[0];
    } else {
      return res.status(500).json({ ok: false, message: 'DB not available' });
    }

    if (!user) {
      return res.status(500).json({ ok: false, message: 'Failed to create admin' });
    }

    return res.json({ ok: true, user: { id: user.id, student_id: user.student_id || studentId, role: 'admin' } });
  } catch (e) {
    console.error('Admin create error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
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
app.post('/api/admin/import', requireAdmin, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ ok: false, message: 'No file uploaded' });
    }

    const file = req.files.file;
    const name = String(file.name || '').toLowerCase();
    if (!name.endsWith('.csv')) {
      return res.status(400).json({ ok: false, message: 'Please upload a CSV file' });
    }

    const data = file.data || (file.tempFilePath ? fs.readFileSync(file.tempFilePath) : null);
    if (!data || !data.length) {
      return res.status(400).json({ ok: false, message: 'Empty file' });
    }

    let records = [];
    try {
      records = parse(data, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (e) {
      console.error('CSV parse error:', e);
      return res.status(400).json({ ok: false, message: 'Invalid CSV format' });
    }

    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ ok: false, message: 'No rows found in CSV' });
    }

    const results = { ok: true, imported: 0, skipped: 0, errors: [] };
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      try {
        const studentId = (row.studentId || row.student_id || '').toString().trim();
        const full_name = (row.full_name || row.name || '').toString().trim();
        const email = (row.email || '').toString().trim();
        const program = (row.program || '').toString().trim();
        const classGroupRaw = (row.classGroup || row.class_group || '').toString().trim();
        const classGroup = db.normalizeClassGroup ? db.normalizeClassGroup(classGroupRaw) : classGroupRaw;
        const academicYearStart = Number(row.academicYearStart || row.academic_year_start || currentYear);
        const role = ((row.role || '').toString().trim() || 'student');
        const password = (row.password || '').toString();

        if (!studentId || !full_name || !email || !program || !classGroup) {
          results.skipped++;
          results.errors.push({ row: i + 1, error: 'Missing required fields (studentId, full_name, email, program, classGroup)' });
          continue;
        }

        const byId = await db.findUserByStudentId(studentId);
        const byEmail = email ? await db.findUserByEmail(email) : null;
        if (byId || byEmail) {
          results.skipped++;
          results.errors.push({ row: i + 1, studentId, error: 'Duplicate studentId or email' });
          continue;
        }

        const created = await db.createUser({
          studentId,
          full_name,
          email,
          program,
          classGroup,
          password: password || uuidv4().slice(0, 10),
          role,
          institutionId: 'upsa',
          academicYearStart
        });

        if (!created) {
          results.skipped++;
          results.errors.push({ row: i + 1, studentId, error: 'Failed to insert' });
          continue;
        }

        results.imported++;
      } catch (e) {
        console.error('Row import error:', e);
        results.skipped++;
        results.errors.push({ row: i + 1, error: e.message || 'Unknown error' });
      }
    }

    return res.json(results);
  } catch (e) {
    console.error('Admin import error:', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});
// --- API: slides ---
app.get('/api/slides', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ ok: false });
  try {
    const user = req.session.user;
    const qCourseTitle = typeof req.query.courseTitle === 'string' ? req.query.courseTitle.trim() : '';
    let rows = await db.listSlidesByClassGroupId(user.classGroupId);
    if (qCourseTitle) {
      rows = rows.filter(s => (s.course_title || '').trim() === qCourseTitle);
    }
    const slides = rows.map(s => ({
      id: s.id,
      classGroup: s.class_group_id,
      courseTitle: s.course_title,
      slideTitle: s.slide_title,
      filename: s.object_path,
      originalName: s.original_name,
      createdAt: s.created_at
    }));
    return res.json({ ok: true, slides });
  } catch (e) {
    console.error('Slides list error', e);
    return res.status(500).json({ ok: false, message: 'Failed to load slides' });
  }
});

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
    console.log(`Server listening on port ${PORT}`);
    // Self-ping keepalive (optional) using relative path to avoid localhost construction
    if (process.env.KEEPALIVE === 'true') {
      const urlPath = '/healthz';
      const intervalMs = Number(process.env.KEEPALIVE_INTERVAL_MS || 60000);
      console.log(`[keepalive] enabled; pinging ${urlPath} every ${intervalMs}ms`);
      setInterval(() => {
        // Use fetch relative to current origin (Node 18+ has global fetch)
        fetch(urlPath).catch(() => {});
      }, intervalMs);
    }
  });
})();