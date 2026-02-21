const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcryptjs');

const DB_FILE = path.join(__dirname, 'db.sqlite');
const DATA_FILE = path.join(__dirname, 'data.json');

let dbPromise = (async () => {
  // open database
  const db = await open({ filename: DB_FILE, driver: sqlite3.Database });
  await db.exec('PRAGMA journal_mode = WAL;');

  await db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    full_name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    course TEXT,
    is_active INTEGER DEFAULT 0,
    email_token TEXT,
    email_token_expires TEXT,
    created_at TEXT,
    updated_at TEXT
  );`);

  await db.exec(`CREATE TABLE IF NOT EXISTS slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE,
    originalname TEXT,
    uploaded_by TEXT,
    course TEXT,
    created_at TEXT
  );`);

  await db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);');

  // import from data.json if DB is new (no users)
  const row = await db.get('SELECT COUNT(1) as c FROM users');
  if (row && row.c === 0 && fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const j = JSON.parse(raw || '{}');
      const users = j.users || [];
      const slides = j.slides || [];
      const now = new Date().toISOString();
      await db.exec('BEGIN');
      try {
        for (const u of users) {
          const id = u.id || u.username || `U${Date.now()}`;
          const pwd = u.password && u.password.startsWith('$2') ? u.password : bcrypt.hashSync(u.password || 'changeme', 10);
          await db.run(
            'INSERT OR IGNORE INTO users (id, username, full_name, email, password, role, course, is_active, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            id, u.username || id.toLowerCase(), u.full_name || '', u.email || null, pwd, u.role || 'student', u.course || null, u.is_active ? 1 : 0, u.created_at || now
          );
        }
        for (const s of slides) {
          await db.run('INSERT OR IGNORE INTO slides (filename, originalname, uploaded_by, course, created_at) VALUES (?,?,?,?,?)', s.filename, s.originalname, s.uploaded_by, s.course, s.created_at || now);
        }
        await db.exec('COMMIT');
        console.log('Imported data.json into SQLite database');
      } catch (e) {
        await db.exec('ROLLBACK');
        console.error('Failed to import data.json:', e);
      }
    } catch (e) {
      console.error('Failed to read data.json:', e);
    }
  }

  // ensure at least one admin exists
  const admin = await db.get('SELECT COUNT(1) as c FROM users WHERE role = ?', 'admin');
  if (!admin || admin.c === 0) {
    const adminId = process.env.DEFAULT_ADMIN_ID || 'A0001';
    const adminPass = process.env.DEFAULT_ADMIN_PASS || 'adminpass';
    const existsById = await db.get('SELECT 1 FROM users WHERE id = ?', adminId);
    if (!existsById) {
      await db.run('INSERT INTO users (id, username, full_name, password, role, is_active, created_at) VALUES (?,?,?,?,?,?,?)', adminId, 'admin', 'Administrator', bcrypt.hashSync(adminPass, 10), 'admin', 1, new Date().toISOString());
      console.log(`Default admin created: ${adminId} (change DEFAULT_ADMIN_PASS env var to override)`);
    }
  }

  return db;
})();

async function getDb(){
  return dbPromise;
}

// helpers
async function getUser(identifier){
  const db = await getDb();
  return await db.get('SELECT * FROM users WHERE id = ? OR username = ?', identifier, identifier) || null;
}
async function getUserById(id){
  const db = await getDb();
  return await db.get('SELECT * FROM users WHERE id = ?', id) || null;
}
async function getAllUsers(){
  const db = await getDb();
  return await db.all('SELECT id, username, full_name, email, role, course, is_active FROM users');
}
async function addUser(user){
  const db = await getDb();
  await db.run('INSERT INTO users (id, username, full_name, email, password, role, course, is_active, created_at) VALUES (?,?,?,?,?,?,?,?,?)', user.id, user.username, user.full_name, user.email, user.password, user.role, user.course, user.is_active ? 1 : 0, user.created_at || new Date().toISOString());
  return await getUserById(user.id);
}
async function findUserByEmail(email){
  const db = await getDb();
  return await db.get('SELECT * FROM users WHERE email = ?', email) || null;
}
async function setEmailToken(studentId, token){
  const db = await getDb();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  const res = await db.run('UPDATE users SET email_token = ?, email_token_expires = ? WHERE id = ?', token, expires, studentId);
  return res.changes > 0;
}
async function activateUserByToken(token){
  const db = await getDb();
  const now = new Date().toISOString();
  const u = await db.get('SELECT * FROM users WHERE email_token = ? AND email_token_expires > ?', token, now);
  if (!u) return null;
  await db.run('UPDATE users SET is_active = 1, email_token = NULL, email_token_expires = NULL WHERE id = ?', u.id);
  return await getUserById(u.id);
}

async function addSlide(filename, originalname, uploaded_by, course){
  const db = await getDb();
  const created_at = new Date().toISOString();
  await db.run('INSERT INTO slides (filename, originalname, uploaded_by, course, created_at) VALUES (?,?,?,?,?)', filename, originalname, uploaded_by, course, created_at);
  return await db.get('SELECT * FROM slides WHERE filename = ?', filename);
}
async function getSlidesByCourse(course){
  const db = await getDb();
  return await db.all('SELECT * FROM slides WHERE course = ? ORDER BY datetime(created_at) DESC', course || null);
}
async function getSlideByFilename(filename){
  const db = await getDb();
  return await db.get('SELECT * FROM slides WHERE filename = ?', filename) || null;
}
async function getAllSlides(){
  const db = await getDb();
  return await db.all('SELECT * FROM slides');
}
async function setUserRole(id, role){
  const db = await getDb();
  const res = await db.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', role, new Date().toISOString(), id);
  if (res.changes === 0) return null;
  return await getUserById(id);
}

module.exports = { getUser, getUserById, getAllUsers, addUser, findUserByEmail, setEmailToken, activateUserByToken, addSlide, getSlidesByCourse, getSlideByFilename, getAllSlides, setUserRole };
