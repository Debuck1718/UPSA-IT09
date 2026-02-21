const fetch = global.fetch || require('node-fetch');
const db = require('./db_sqlite');

async function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function run(){
  const API = 'http://127.0.0.1:3000';
  const testId = 'S9999';
  console.log('1) Signing up test user', testId);
  const res = await fetch(`${API}/api/signup`, {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ studentId: testId, full_name: 'Test User', email: 'testuser@example.com', password: 'TestPass123!', course: 'IT09' })
  });
  console.log('Signup status', res.status);
  const j = await res.json().catch(()=>null);
  if (j) console.log('Signup response:', j);

  // wait for DB write
  await sleep(500);

  console.log('2) Reading token from DB');
  const u = await db.getUserById(testId);
  if (!u) return console.error('User not found in DB');
  console.log('User record:', { id: u.id, is_active: u.is_active, email_token: u.email_token });
  const token = u.email_token;
  if (!token) return console.error('No token found');

  console.log('3) Verifying email via API');
  const vres = await fetch(`${API}/api/verify-email?token=${token}`);
  console.log('Verify status', vres.status);

  // wait
  await sleep(300);

  const u2 = await db.getUserById(testId);
  console.log('User after verify:', { id: u2.id, is_active: u2.is_active });

  console.log('4) Promoting user to course_rep via DB helper (simulating admin action)');
  const updated = await db.setUserRole(testId, 'course_rep');
  console.log('Updated role:', updated && updated.role);
}

run().catch(err=>{ console.error('Test flow error', err); process.exit(1); });
