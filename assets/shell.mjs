import { validateFeed, validatePerformance, percent } from './domain.mjs';
export const storageKey = 'matchday:preferences:v1';
export function preferences() {
  try {
    const p = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return { saved: Array.isArray(p.saved) ? p.saved.filter(v => typeof v === 'string').slice(0, 500) : [], picks: p.picks && typeof p.picks === 'object' && !Array.isArray(p.picks) ? p.picks : {} };
  } catch { return { saved: [], picks: {} }; }
}
export function savePreferences(p) {
  try { localStorage.setItem(storageKey, JSON.stringify(p)); return true; }
  catch { const n = document.querySelector('#storage-notice'); if (n) { n.hidden = false; n.textContent = 'Browser storage is unavailable. Your choices work for this visit but cannot be saved.'; } return false; }
}
export function updateShell(feed) {
  const p = preferences();
  const ids = new Set(feed?.forecasts.map(r => r.fixture_id) || []);
  const counts = { matches: feed?.forecasts.length, saved: p.saved.filter(id => ids.has(id)).length, picks: Object.keys(p.picks).filter(id => ids.has(id)).length };
  document.querySelectorAll('[data-count]').forEach(el => { el.textContent = counts[el.dataset.count] || ''; });
  if (!feed) return;
  try {
    const report = validatePerformance(feed.performance);
    document.querySelector('#pulse-rate').textContent = report.metrics ? percent(report.metrics.accuracy) : '—';
    document.querySelector('#pulse-note').textContent = report.scored_matches ? `${report.scored_matches} eligible completed matches. Double chance: ${percent(report.metrics.selected_double_chance_success)}. Small samples fluctuate.` : 'Awaiting eligible completed matches. No hit rate claimed yet.';
    document.querySelector('#pulse-meter').style.width = `${(report.metrics?.accuracy || 0) * 100}%`;
  } catch {
    document.querySelector('#pulse-rate').textContent = '—';
    document.querySelector('#pulse-meter').style.width = '0%';
    document.querySelector('#pulse-note').textContent = 'Performance report unavailable.';
  }
  document.querySelector('#sidebar-updated').textContent = `Data observed ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(feed.data_observed_at_utc))} UTC`;
}
// Forecast pages pass their already validated feed; other pages load only the public file.
if (!document.querySelector('#forecast-grid')) {
  fetch('./data/predictions.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('Unavailable'); return r.json(); }).then(data => updateShell(validateFeed(data))).catch(() => { document.querySelector('#pulse-note').textContent = 'Verified feed unavailable.'; });
}
