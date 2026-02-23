const { Pool } = require('pg');

// Singleton Pool forcing relaxed TLS (Supabase Session Pooler compatible)
function getPool() {
  if (!globalThis.__PG_POOL) {
    const connectionString = process.env.DATABASE_URL || '';
    // Force rejectUnauthorized: false to avoid SELF_SIGNED_CERT_IN_CHAIN
    globalThis.__PG_POOL = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10
    });
  }
  return globalThis.__PG_POOL;
}
const pool = getPool();

// Normalizers and IDs
function normalizeClassGroup(input) {
  if (!input) return '';
  let s = String(input).trim().toUpperCase().replace(/\s+/g, '');
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
function slugify(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function programIdFromName(name) {
  return slugify(name).replace(/-/g, '');
}
function institutionIdFromName(name) {
  return slugify(name).replace(/-/g, '');
}
function makeCohortId(institutionId, programId, academicYearStart) {
  return `${institutionId}|${programId}|${academicYearStart}`;
}
function makeClassGroupId(cohortId, classGroupCode) {
  return `${cohortId}|${normalizeClassGroup(classGroupCode)}`;
}

async function initSchema() {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`
      create table if not exists users_app (
        id serial primary key,
        student_id text unique not null,
        full_name text not null,
        email text unique not null,
        role text not null default 'student',
        institution_id text not null,
        program text,
        program_id text not null,
        cohort_id text not null,
        class_group text,
        class_group_id text not null,
        password_hash text not null,
        email_verified boolean not null default false,
        created_at timestamptz not null default now()
      );
    `);
    await client.query(`
      create table if not exists course_titles (
        id serial primary key,
        class_group_id text not null,
        title text not null,
        created_at timestamptz not null default now(),
        unique(class_group_id, title)
      );
    `);
    await client.query(`
      create table if not exists slides (
        id uuid primary key,
        class_group_id text not null,
        course_title text not null,
        slide_title text not null,
        object_path text not null,
        original_name text not null,
        content_type text,
        size_bytes int,
        uploader_id int,
        institution_id text,
        program_id text,
        cohort_id text,
        created_at timestamptz not null default now()
      );
    `);
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
  }
}

// Users
async function findUserByStudentId(studentId) {
  const { rows } = await pool.query('select * from users_app where student_id=$1', [studentId]);
  return rows[0] || null;
}
async function createUser({ studentId, full_name, email, program, classGroup, password, role, institutionId, academicYearStart }) {
  const programId = programIdFromName(program || 'General');
  const instId = institutionIdFromName(institutionId || 'upsa');
  const cohortId = makeCohortId(instId, programId, academicYearStart || new Date().getFullYear());
  const classGroupCode = normalizeClassGroup(classGroup);
  const classGroupId = makeClassGroupId(cohortId, classGroupCode);
  const crypto = require('crypto');
  const passwordHash = crypto.createHash('sha256').update(String(password)).digest('hex');

  const { rows } = await pool.query(
    `insert into users_app (student_id, full_name, email, role, institution_id, program, program_id, cohort_id, class_group, class_group_id, password_hash)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     returning *`,
    [studentId, full_name, email, role || 'student', instId, program || null, programId, cohortId, classGroupCode, classGroupId, passwordHash]
  );
  return rows[0];
}

// Course titles
async function listCourseTitlesForClassGroupId(classGroupId) {
  const { rows } = await pool.query('select title from course_titles where class_group_id=$1 order by title asc', [classGroupId]);
  return rows.map(r => r.title);
}
async function addCourseTitleForClassGroupId(classGroupId, title) {
  await pool.query(
    'insert into course_titles (class_group_id, title) values ($1,$2) on conflict (class_group_id, title) do nothing',
    [classGroupId, String(title || '').trim()]
  );
}

// Slides
async function insertSlide({ id, classGroupId, courseTitle, slideTitle, objectPath, originalName, contentType, sizeBytes, uploaderId, institutionId, programId, cohortId }) {
  await pool.query(
    `insert into slides (id, class_group_id, course_title, slide_title, object_path, original_name, content_type, size_bytes, uploader_id, institution_id, program_id, cohort_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, classGroupId, courseTitle, slideTitle, objectPath, originalName, contentType || null, sizeBytes || null, uploaderId || null, institutionId || null, programId || null, cohortId || null]
  );
}
async function listSlidesByClassGroupId(classGroupId) {
  const { rows } = await pool.query('select * from slides where class_group_id=$1 order by created_at desc', [classGroupId]);
  return rows;
}
async function getSlideById(id) {
  const { rows } = await pool.query('select * from slides where id=$1', [id]);
  return rows[0] || null;
}

module.exports = {
  pool,
  initSchema,
  // utils
  normalizeClassGroup,
  slugify,
  programIdFromName,
  institutionIdFromName,
  makeCohortId,
  makeClassGroupId,
  // users
  findUserByStudentId,
  createUser,
  // titles
  listCourseTitlesForClassGroupId,
  addCourseTitleForClassGroupId,
  // slides
  insertSlide,
  listSlidesByClassGroupId,
  getSlideById
};