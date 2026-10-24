import { percent, validateFeed, stale, filterForecasts, dateKey, escapeHTML as esc } from './domain.mjs';

const $ = selector => document.querySelector(selector);
let feed = null;
let view = 'upcoming';
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const zone = () => $('#timezone')?.value === 'local' ? localZone : ($('#timezone')?.value || localZone);
const timestamp = value => new Intl.DateTimeFormat('en-GB', { timeZone: zone(), day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
const dayLabel = value => new Intl.DateTimeFormat('en-GB', { timeZone: zone(), weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(value));
const initials = name => name.split(/[ -]/).filter(Boolean).map(word => word[0]).slice(0, 2).join('').toUpperCase();
function relativeKickoff(value) {
  const minutes = Math.ceil((Date.parse(value) - Date.now()) / 60000);
  if (minutes <= 0) return 'Started · saved pre-match forecast';
  if (minutes < 60) return `In ${minutes} min`;
  if (minutes < 1440) return `In ${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return dayLabel(value);
}
function card(row) {
  const p = row.probabilities;
  const single = [['H', 'Home', p.home], ['D', 'Draw', p.draw], ['A', 'Away', p.away]];
  const dc = [['1X', 'Home or draw', p.home_or_draw], ['12', 'Home or away', p.home_or_away], ['X2', 'Draw or away', p.draw_or_away]];
  const pick = { H: 'Home win', D: 'Draw', A: 'Away win' }[row.predicted_result];
  return `<article class="match-card" data-fixture="${esc(row.fixture_id)}" aria-label="${esc(row.home_team)} versus ${esc(row.away_team)}">
    <div class="card-top"><span class="league-label">${esc(row.country)} · ${esc(row.competition)}</span><div class="kickoff"><time datetime="${esc(row.kickoff_utc)}">${esc(timestamp(row.kickoff_utc))}</time><small>${esc(relativeKickoff(row.kickoff_utc))}</small></div></div>
    <div class="teams"><div class="team"><span class="team-badge" aria-hidden="true">${esc(initials(row.home_team))}</span><span>${esc(row.home_team)}</span></div><span class="versus">vs</span><div class="team away"><span>${esc(row.away_team)}</span><span class="team-badge" aria-hidden="true">${esc(initials(row.away_team))}</span></div></div>
    <div class="probability-bar" role="img" aria-label="Home ${percent(p.home)}, draw ${percent(p.draw)}, away ${percent(p.away)}"><span style="width:${p.home * 100}%"></span><span style="width:${p.draw * 100}%"></span><span style="width:${p.away * 100}%"></span></div>
    <div class="probability-grid">${single.map(([code, label, value]) => `<div class="probability ${row.predicted_result === code ? 'best' : ''}"><span>${label}</span><strong>${percent(value)}</strong></div>`).join('')}</div>
    <div class="dc-heading"><span>DOUBLE CHANCE</span><span class="pick">Most likely: ${esc(pick)}</span></div><div class="double-chances">${dc.map(([code, label, value]) => `<div class="${row.highest_probability_double_chance === code ? 'best' : ''}" aria-label="${label}: ${percent(value)}"><span title="${label}">${code}</span><strong>${percent(value)}</strong></div>`).join('')}</div>
    ${row.limited_history ? '<span class="limited-tag">Limited match history — interpret with extra care</span>' : ''}
    <details class="card-details"><summary><span>Generated ${esc(timestamp(row.generated_at_utc))}</span><span>Forecast details</span></summary><dl><dt>Data observed</dt><dd>${esc(timestamp(row.data_observed_at_utc))}</dd><dt>Home / away historical matches</dt><dd>${row.home_history_matches} / ${row.away_history_matches}</dd><dt>Model fitted</dt><dd>${esc(feed.model.fitted_as_of)}</dd></dl><p>Match results are used with a two-calendar-day delay. Probabilities are estimates of the 90-minute result, including stoppage time.</p></details>
  </article>`;
}
function rebuildDates() {
  const selected = $('#match-date').value;
  const dates = [...new Set(feed.forecasts.map(row => dateKey(row.kickoff_utc, zone())))].sort();
  $('#match-date').innerHTML = '<option value="all">All dates</option>' + dates.map(date => `<option value="${date}">${esc(new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`)))}</option>`).join('');
  if (dates.includes(selected)) $('#match-date').value = selected;
}
function render() {
  if (!feed) return;
  const now = Date.now();
  $('#data-time').textContent = timestamp(feed.data_observed_at_utc);
  $('#refresh-mode').textContent = feed.refresh_mode === 'automatic' ? 'Automatic · twice daily' : 'Manual updates';
  $('#model-date').textContent = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(feed.model.fitted_as_of + 'T12:00:00Z'));
  $('#snapshot-count').textContent = `${feed.forecasts.length} saved forecasts`;
  const old = stale(feed, now);
  const notice = $('#feed-notice');
  notice.hidden = false;
  notice.className = 'notice';
  notice.textContent = old ? 'Forecasts paused: this feed needs refreshing or the model needs an update. Saved forecasts remain available with their original timestamps.' : feed.refresh_mode === 'automatic' ? 'Automatic updates are scheduled twice daily. Forecasts are saved snapshots; opening this page does not fetch live match data. Scheduled runs may be delayed.' : 'Manual updates are currently enabled. Forecasts are saved snapshots; opening this page does not fetch live match data.';
  const rows = filterForecasts(feed, { view, competition: $('#competition').value, date: $('#match-date').value, search: $('#search').value, timezone: zone() }, now);
  const opened = new Set([...document.querySelectorAll('.match-card')].filter(el => el.querySelector('details')?.open).map(el => el.dataset.fixture));
  $('#forecast-grid').innerHTML = rows.map(card).join('');
  document.querySelectorAll('.match-card').forEach(el => { if (opened.has(el.dataset.fixture)) el.querySelector('details').open = true; });
  $('#result-count').textContent = `${rows.length} ${rows.length === 1 ? 'match' : 'matches'} ${view === 'upcoming' ? 'coming up' : 'in this saved snapshot'}`;
  $('#board-title').textContent = view === 'upcoming' ? 'What’s coming up' : 'The saved snapshot';
  $('#empty-state').hidden = rows.length !== 0;
  $('#empty-title').textContent = old && view === 'upcoming' ? 'Waiting for a fresh forecast feed' : 'No matching fixtures';
  $('#empty-message').textContent = old && view === 'upcoming' ? 'You can inspect the saved snapshot. Its forecasts retain their original dates and times.' : 'Try another date or team. Started matches appear only in the saved snapshot.';
}
function reset() { $('#competition').value = 'all'; $('#match-date').value = 'all'; $('#search').value = ''; render(); }
async function load() {
  $('#refresh').disabled = true;
  try {
    const response = await fetch('./data/predictions.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`The saved feed is unavailable (${response.status}).`);
    feed = validateFeed(await response.json());
    const chosen = $('#competition').value;
    const competitions = [...new Map(feed.forecasts.map(row => [`${row.country}|${row.competition_code}`, `${row.country} · ${row.competition}`])).entries()];
    $('#competition').innerHTML = '<option value="all">All competitions</option>' + competitions.map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join('');
    if (competitions.some(([key]) => key === chosen)) $('#competition').value = chosen;
    rebuildDates(); render();
  } catch (error) {
    feed = null;
    $('#forecast-grid').replaceChildren();
    $('#feed-notice').hidden = false;
    $('#feed-notice').className = 'notice error';
    $('#feed-notice').textContent = `${error.message} Please try refreshing. No predictions are shown while the feed cannot be verified.`;
    $('#result-count').textContent = 'Forecast feed unavailable';
    $('#snapshot-count').textContent = 'Feed unavailable';
    $('#empty-state').hidden = true;
  } finally { $('#refresh').disabled = false; }
}
if ($('#forecast-grid')) {
  $('#refresh').addEventListener('click', load);
  $('#competition').addEventListener('change', render);
  $('#match-date').addEventListener('change', render);
  $('#search').addEventListener('input', render);
  $('#timezone').addEventListener('change', () => { if (feed) { rebuildDates(); render(); } });
  $('#reset').addEventListener('click', reset); $('#empty-reset').addEventListener('click', reset);
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', String(b === button)); });
    render();
  }));
  load();
  setInterval(() => { if (feed) render(); }, 60000);
}
