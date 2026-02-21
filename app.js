const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
// Force server port to 3000 so frontend (Live Server) can communicate reliably
const PORT = 3000;

// Database (SQLite)
const db = require('./db_sqlite');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { parse } = require('csv-parse/sync');


// Multer setup for file uploads (limits + basic filtering)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({
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

const isProd = process.env.NODE_ENV === 'production';
const SQLiteStore = require('connect-sqlite3')(session);
const SESSION_SECRET = process.env.SESSION_SECRET || 'your_secret_key';
const sessionDir = path.join(__dirname, 'data');
if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

app.use(session({
  store: new SQLiteStore({
    dir: sessionDir,
    db: 'sessions.sqlite'
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
}));// --- Static pages ---app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  return res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// --- API: authentication & session ---
app.post('/api/login', async (req, res) => {
  const { username, password, studentId } = req.body;
  const identifier = studentId || username;
  const user = await db.getUser(identifier);
  // Removed email verification enforcement: login proceeds regardless of email verification status
  if (user && user.password && bcrypt.compareSync(password, user.password)) {
    req.session.user = { id: user.id, username: user.username, name: user.full_name || user.username, role: user.role, course: user.course };
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, message: 'Invalid credentials' });
});// signup
app.post('/api/signup', async (req, res) => {
  const { studentId, full_name, email, password, course, inviteToken } = req.body;
  if (!studentId || !full_name || !email || !password || !course) return res.status(400).json({ ok: false, message: 'Missing fields' });
  // uniqueness
  if (await db.getUser(studentId) || await db.findUserByEmail(email)) return res.status(409).json({ ok: false, message: 'Student ID or email already exists' });
  // default role: student (admin must promote to elevated roles)
  const role = 'student';
  const hashed = bcrypt.hashSync(password, 10);
  const user = { id: studentId, username: studentId.toLowerCase(), full_name, email, password: hashed, role, course, is_active: false, created_at: new Date().toISOString() };
  await db.addUser(user);
  // create email token
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
  const u = await db.getUser(studentId) || await db.getUserById(studentId);
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
  const { course } = req.session.user;
  const slides = await db.getSlidesByCourse(course);
  return res.json({ ok: true, slides });
});

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.session.user || !['course_rep','rep_assistant','course_secretary','admin'].includes(req.session.user.role)) {
    return res.status(403).send('Unauthorized');
  }
  if (!req.file) return res.status(400).send('No file');
  await db.addSlide(req.file.filename, req.file.originalname, req.session.user.name, req.session.user.course);
  return res.redirect('/dashboard');
});

app.get('/download/:filename', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  const { role, course } = req.session.user;
  const slide = await db.getSlideByFilename(req.params.filename);
  if (!slide) return res.status(404).send('File not found');
  if (role === 'student' && slide.course !== course) return res.status(403).send('Not allowed');
  return res.download(path.join(__dirname, 'uploads', req.params.filename), slide.originalname);
});

// start
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
