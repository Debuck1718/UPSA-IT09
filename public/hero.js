document.addEventListener('DOMContentLoaded', () => {
  const rotator = document.getElementById('hero-rotator');
  if (!rotator) return;
  const items = Array.from(rotator.querySelectorAll('span'));
  if (items.length === 0) return;
  let idx = 0;
  // initialize
  items.forEach((el, i) => el.classList.toggle('active', i === 0));
  setInterval(() => {
    const prev = items[idx];
    idx = (idx + 1) % items.length;
    const next = items[idx];
    prev.classList.remove('active');
    next.classList.add('active');
  }, 4500); // change every 4.5s
});
