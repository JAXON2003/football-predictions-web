export const percent = value => `${(value * 100).toFixed(1)}%`;
export function validatePerformance(performance) {
  if (!performance || performance.status !== 'active' || !Array.isArray(performance.matches) || !performance.coverage || performance.minimum_public_lead_hours !== 2) throw new Error('The performance report is unavailable or invalid.');
  const ids = new Set();
  for (const row of performance.matches) {
    if (!row.fixture_id || ids.has(row.fixture_id) || !row.home_team || !row.away_team || !Number.isFinite(Date.parse(row.kickoff_utc))) throw new Error('The performance report has invalid or duplicate matches.');
    ids.add(row.fixture_id);
    if (row.status === 'scored' && (!row.timing_eligible || !['H', 'D', 'A'].includes(row.actual_result) || !Number.isFinite(row.log_loss) || row.log_loss < 0 || !Number.isFinite(row.brier_score) || row.brier_score < 0 || row.brier_score > 2 || !(Date.parse(row.generated_at_utc) <= Date.parse(row.first_verified_public_at_utc)) || !(Date.parse(row.first_verified_public_at_utc) <= Date.parse(row.kickoff_utc) - 7200000))) throw new Error('A scored forecast fails its timing or result checks.');
  }
  const count = performance.matches.filter(r => r.status === 'scored').length;
  if (count !== performance.scored_matches || performance.coverage.monitored_matches !== performance.matches.length) throw new Error('Performance counts disagree.');
  if (!count && performance.metrics !== null) throw new Error('Empty performance must not claim a success rate.');
  if (count) {
    const m = performance.metrics;
    if (!m || m.matches !== count || ![m.log_loss, m.brier_score, m.accuracy, m.selected_double_chance_success].every(Number.isFinite) || m.log_loss < 0 || m.brier_score < 0 || m.brier_score > 2 || m.accuracy < 0 || m.accuracy > 1 || m.selected_double_chance_success < 0 || m.selected_double_chance_success > 1) throw new Error('The performance metrics are invalid.');
  }
  return performance;
}
export function validateFeed(feed) {
  if (feed.schema_version !== 1 || !Array.isArray(feed.forecasts) || !Number.isFinite(Date.parse(feed.valid_until_utc)) || !feed.publication_id) throw new Error('The prediction feed format is invalid.');
  const ids = new Set();
  for (const row of feed.forecasts) {
    const p = row.probabilities;
    if (!p || ids.has(row.forecast_id) || !row.home_team || !row.away_team || !Number.isFinite(Date.parse(row.kickoff_utc)) || !(Date.parse(row.generated_at_utc) < Date.parse(row.kickoff_utc))) throw new Error('A forecast has invalid identity or timing.');
    ids.add(row.forecast_id);
    if (!Object.values(p).every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1)) throw new Error('A forecast has an invalid probability.');
    const close = (a, b) => Math.abs(a - b) < 1e-9;
    if (!close(p.home + p.draw + p.away, 1) || !close(p.home_or_draw, p.home + p.draw) || !close(p.home_or_away, p.home + p.away) || !close(p.draw_or_away, p.draw + p.away)) throw new Error('The forecast probabilities do not agree.');
    const best = [['H', p.home], ['D', p.draw], ['A', p.away]].reduce((a, b) => b[1] > a[1] ? b : a)[0];
    const dc = [['1X', p.home_or_draw], ['12', p.home_or_away], ['X2', p.draw_or_away]].reduce((a, b) => b[1] > a[1] ? b : a)[0];
    if (row.predicted_result !== best || row.highest_probability_double_chance !== dc) throw new Error('The selected outcome does not match its probabilities.');
  }
  return feed;
}
export const stale = (feed, now = Date.now()) => now >= Date.parse(feed.valid_until_utc);
export function filterForecasts(feed, { view = 'upcoming', competition = 'all', date = 'all', search = '', timezone = 'UTC' } = {}, now = Date.now()) {
  const needle = search.trim().toLocaleLowerCase();
  return feed.forecasts.filter(row =>
    (view === 'saved' || (!stale(feed, now) && Date.parse(row.kickoff_utc) > now)) &&
    (competition === 'all' || `${row.country}|${row.competition_code}` === competition) &&
    (date === 'all' || dateKey(row.kickoff_utc, timezone) === date) &&
    (!needle || `${row.home_team} ${row.away_team}`.toLocaleLowerCase().includes(needle))
  ).sort((a, b) => Date.parse(a.kickoff_utc) - Date.parse(b.kickoff_utc));
}
export function dateKey(value, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const escapeHTML = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
