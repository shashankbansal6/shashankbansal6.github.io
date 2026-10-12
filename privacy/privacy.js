import '../src/fonts.css';
import './privacy.css';
import { initAnalytics } from '../src/analytics.js';

const isWC = document.documentElement.dataset.theme === 'watercolor';
document.querySelectorAll('.theme-switch button').forEach((b) => {
  const on = b.dataset.set === (isWC ? 'watercolor' : 'ink');
  b.setAttribute('aria-pressed', String(on));
  b.addEventListener('click', () => {
    if (on) return;
    try { localStorage.setItem('theme', b.dataset.set); } catch { /* storage unavailable */ }
    const u = new URL(location.href);
    u.searchParams.set('theme', b.dataset.set);
    location.href = u.toString();
  });
});
document.getElementById('year').textContent = new Date().getFullYear();
initAnalytics();
