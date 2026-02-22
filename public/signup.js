const API_BASE = 'http://localhost:3000';

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const studentId = document.getElementById('studentId').value.trim();
  const full_name = document.getElementById('full_name').value.trim();
  const email = document.getElementById('email').value.trim();
  const program = document.getElementById('program') ? document.getElementById('program').value.trim() : '';
  const classGroup = document.getElementById('classGroup') ? document.getElementById('classGroup').value.trim() : '';
  const academicYearStart = document.getElementById('academicYearStart') ? document.getElementById('academicYearStart').value.trim() : '';
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword').value;
  const alert = document.getElementById('alert');
  alert.style.display = 'none';
  if (password !== confirm) {
    alert.style.display = 'block';
    alert.textContent = 'Passwords do not match';
    return;
  }
  try {
  const payload = { studentId, full_name, email, password };
  if (program) payload.program = program;
  if (classGroup) payload.classGroup = classGroup;
  if (academicYearStart) {
    const yearNum = Number(academicYearStart);
    const nowYear = new Date().getFullYear();
    if (!Number.isInteger(yearNum) || yearNum < 2000 || yearNum > nowYear + 1) {
      alert.style.display = 'block';
      alert.textContent = 'Please enter a valid Academic Year Start (e.g., 2024).';
      return;
    }
    payload.academicYearStart = yearNum;
  }
  const res = await fetch(`${API_BASE}/api/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();    if (!res.ok) {
      alert.style.display = 'block';
      alert.textContent = json.message || 'Signup failed';
      return;
    }
    alert.className = 'alert alert-success';
    alert.style.display = 'block';
    alert.textContent = json.message || 'Registered. Check your email to verify.';
  } catch (err) {
    alert.style.display = 'block';
    alert.textContent = 'Unable to reach server';
  }
});