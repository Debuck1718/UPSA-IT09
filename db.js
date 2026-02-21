const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_FILE = path.join(__dirname, 'data.json');

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { users: [], slides: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw || '{}');
}

function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// Seed demo users if empty
const db0 = load();
let changed = false;
if (!db0.users || db0.users.length === 0) {
  db0.users = [
    { id: 'S1001', username: 'student1', full_name: 'John Doe', password: bcrypt.hashSync('studentpass', 10), role: 'student', course: 'IT09', email: null, is_active: true, created_at: new Date().toISOString() },
    { id: 'S2001', username: 'student2', full_name: 'Jane Smith', password: bcrypt.hashSync('studentpass', 10), role: 'student', course: 'IT10', email: null, is_active: true, created_at: new Date().toISOString() },
    { id: 'R3001', username: 'rep1', full_name: 'Mary Representative', password: bcrypt.hashSync('reppass', 10), role: 'course_rep', course: 'IT09', email: null, is_active: true, created_at: new Date().toISOString() },
    { id: 'R4001', username: 'rep2', full_name: 'Paul Representative', password: bcrypt.hashSync('reppass', 10), role: 'course_rep', course: 'IT10', email: null, is_active: true, created_at: new Date().toISOString() }
  ];
  db0.slides = db0.slides || [];
  save(db0);
} else {
  // Migrate any plaintext passwords to bcrypt hashes
  for (const u of db0.users) {
    if (u.password && typeof u.password === 'string' && !u.password.startsWith('$2')) {
      u.password = bcrypt.hashSync(u.password, 10);
      changed = true;
    }
    // ensure fields exist
    if (u.email === undefined) u.email = null;
    if (u.is_active === undefined) u.is_active = false;
    if (!u.created_at) u.created_at = new Date().toISOString();
  }
  if (changed) save(db0);
}

// Ensure at least one admin exists (use env vars for safety)
if (!db0.users.some(u => u.role === 'admin')) {
  const adminId = process.env.DEFAULT_ADMIN_ID || 'A0001';
  const adminPass = process.env.DEFAULT_ADMIN_PASS || 'adminpass';
  const adminExistsById = db0.users.some(u => u.id === adminId);
  if (!adminExistsById) {
    db0.users.push({ id: adminId, username: 'admin', full_name: 'Administrator', password: bcrypt.hashSync(adminPass, 10), role: 'admin', course: null, email: null, is_active: true, created_at: new Date().toISOString() });
    save(db0);
    console.log(`Default admin created: ${adminId} (change DEFAULT_ADMIN_PASS env var to override)`);
  }
}

function getUser(identifier) {
  const db = load();
  return db.users.find(u => u.id === identifier || u.username === identifier) || null;
}

function getUserById(id) {
  const db = load();
  return db.users.find(u => u.id === id) || null;
}

function setUserRole(id, role) {
  const db = load();
  const u = db.users.find(x => x.id === id);
  if (!u) return null;
  u.role = role;
  u.updated_at = new Date().toISOString();
  save(db);
  return u;
}

function createUser(username, password, role, course, classGroup) {
  const db = load();
  const cg = typeof classGroup === 'string' ? classGroup.trim() : null;
  db.users.push({ username, password, role, course, classGroup: (cg && cg.length) ? cg : null });
  save(db);
}
function addUser(user) {
  const db = load();
  db.users.push(user);
  save(db);
  return user;
}

function findUserByEmail(email) {
  const db = load();
  return db.users.find(u => u.email === email) || null;
}

function setEmailToken(studentId, token) {
  const db = load();
  const u = db.users.find(x => x.id === studentId);
  if (!u) return false;
  u.email_token = token;
  u.email_token_expires = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  save(db);
  return true;
}

function activateUserByToken(token) {
  const db = load();
  const u = db.users.find(x => x.email_token === token && new Date(x.email_token_expires) > new Date());
  if (!u) return null;
  u.is_active = true;
  delete u.email_token;
  delete u.email_token_expires;
  save(db);
  return u;
}

function normalizeCourse(course) {
  if (!course || typeof course !== 'string') return null;
  const c = course.trim();
  return c.length ? c : null;
}

// Normalize class/group codes: uppercase, trim, collapse spaces, and strip leading zeroes in numeric suffix
function normalizeClassGroup(input) {
  if (!input || typeof input !== 'string') return null;
  let s = input.trim().toUpperCase().replace(/\s+/g, '');
  if (!s.length) return null;
  const m = s.match(/^([A-Z]+)(\d+)$/);
  if (m) {
    const prefix = m[1];
    let num = m[2];
    if (num.length > 1 && num.startsWith('0')) {
      num = String(parseInt(num, 10));
    }
    return `${prefix}${num}`;
  }
  return s;
}

function normalizeProgram(program) {
  if (!program || typeof program !== 'string') return null;
  const p = program.trim();
  return p.length ? p : null;
}

function addSlide(filename, originalname, uploaded_by, course, classGroup, program) {
  const db = load();
  db.slides = db.slides || [];
  let finalCourse = normalizeCourse(course);
  if (!finalCourse && uploaded_by) {
    const uploader = (db.users || []).find(u => u.id === uploaded_by || u.username === uploaded_by);
    if (uploader && uploader.course) finalCourse = normalizeCourse(uploader.course);
  }
  const slide = {
    id: Date.now(),
    filename,
    originalname,
    uploaded_by,
    course: finalCourse,
    classGroup: normalizeClassGroup(classGroup),
    program: normalizeProgram(program),
    created_at: new Date().toISOString()
  };
  db.slides.push(slide);
  save(db);
  return slide;
}

function getSlidesByCourse(course) {
  const db = load();
  const target = normalizeCourse(course);
  return (db.slides || [])
    .filter(s => normalizeCourse(s.course) === target)
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
}

function getSlidesFiltered({ course, classGroup, program } = {}) {
  const db = load();
  const targetCourse = normalizeCourse(course);
  const cg = normalizeClassGroup(classGroup);
  const prog = normalizeProgram(program);
  return (db.slides || [])
    .filter(s => (targetCourse ? normalizeCourse(s.course) === targetCourse : true))
    .filter(s => (cg ? (normalizeClassGroup(s.classGroup) === cg) : true))
    .filter(s => (prog ? (normalizeProgram(s.program) === prog) : true))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}function listCourses() {
  const db = load();
  const set = new Set();
  for (const s of (db.slides || [])) {
    const c = normalizeCourse(s.course);
    if (c) set.add(c);
  }
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function getSlideByFilename(filename) {
  const db = load();
  return (db.slides || []).find(s => s.filename === filename) || null;
}

function getAllSlides() {
  const db = load();
  return db.slides || [];
}

module.exports = {
  getUser,
  createUser,
  addUser,
  findUserByEmail,
  setEmailToken,
  activateUserByToken,
  addSlide,
  getSlidesByCourse,
  getSlidesFiltered,
  getSlideByFilename,
  getAllSlides,
  getUserById,
  setUserRole,
  listCourses,
  normalizeClassGroup: function (classGroup) {
    if (!classGroup || typeof classGroup !== 'string') return null;
    const g = classGroup.trim();
    return g.length ? g : null;
  }
};