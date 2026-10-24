import { percent, validateFeed, stale, filterForecasts, dateKey, escapeHTML as esc, modelDecisions, validateLogoIndex } from './domain.mjs';
import { preferences, savePreferences, updateShell } from './shell.mjs';

const $ = selector => document.querySelector(selector);
let feed = null;
let teamLogos = new Map();
const failedLogos = new Set();
const allowedViews = ['upcoming', 'bookmarks', 'picks', 'saved'];
let view = new URLSearchParams(location.search).get('view') || 'upcoming';
if (!allowedViews.includes(view)) view = 'upcoming';
let user = preferences();
let openFixture = null;
let returnFocus = null;
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const zone = () => $('#timezone').value === 'local' ? localZone : $('#timezone').value;
const timestamp = value => new Intl.DateTimeFormat('en-GB', { timeZone: zone(), day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
const initials = name => name.split(/[ -]/).filter(Boolean).map(word => word[0]).slice(0, 2).join('').toUpperCase();
function crest(name, country) {
  const path = teamLogos.get(JSON.stringify([country, name]));
  const image = path && !failedLogos.has(path) ? `<img src="./${esc(path)}" alt="" width="44" height="44" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';
  return `<span class="crest${image ? ' has-logo' : ''}" aria-hidden="true" style="width:44px;height:44px;background:${['#ffdd57', '#6cbfe6', '#ff5b35'][[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 3]}"><span class="crest-initials">${esc(initials(name))}</span>${image}</span>`;
}
// Capture image errors, including dynamically rendered cards and the drawer.
document.addEventListener('error', event => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement) || !img.closest('.crest')) return;
  const path = img.getAttribute('src').replace(/^\.\//, '');
  failedLogos.add(path);
  document.querySelectorAll('.crest img').forEach(other => {
    if (other.getAttribute('src') === img.getAttribute('src')) {
      other.parentElement.classList.remove('has-logo'); other.remove();
    }
  });
}, true);
const bar = p => `<div class="prob-bar" role="img" aria-label="Home ${percent(p.home)}, draw ${percent(p.draw)}, away ${percent(p.away)}">${[['h', p.home], ['d', p.draw], ['a', p.away]].map(([c, v]) => `<span class="${c}" style="width:${v * 100}%">${v >= .14 ? percent(v) : ''}</span>`).join('')}</div>`;
const starIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m12 3 2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17l-5.6 3 1.3-6.2L3 9.5l6.3-.7z"/></svg>';
const actualChoice = (code, r) => ({ H: r.home_team, D: 'Draw', A: r.away_team, '1X': `${r.home_team} or draw`, '12': 'Either team wins', X2: `Draw or ${r.away_team}` })[code];
function decisions(row) {
  const d = modelDecisions(row);
  const winner = d.result.code === 'D' ? 'Draw' : `${actualChoice(d.result.code, row)} to win`;
  return `<div class="decisions"><div class="decision"><span>Full-time result <i>${d.result.code === 'H' ? '1' : d.result.code === 'A' ? '2' : 'X'}</i></span><b>${esc(winner)}</b><strong>${percent(d.result.probability)}</strong></div><div class="decision"><span>Double chance <i>${d.double.code}</i></span><b>${esc(actualChoice(d.double.code, row))}</b><strong>${percent(d.double.probability)}</strong></div></div>`;
}
function personalChoice(row) {
  const mine = user.picks[row.fixture_id], disabled = Date.parse(row.kickoff_utc) <= Date.now() || stale(feed);
  return `<details class="disclosure" id="personal-choice"><summary>Make your own prediction <span aria-hidden="true">+</span></summary><div class="disclosure-content"><p>Your full-time pick is saved in this browser. It does not change the model’s public record.</p><div class="pick-buttons" role="group" aria-label="Your full-time prediction">${[['H','1'],['D','X'],['A','2']].map(([code,label]) => `<button type="button" data-pick="${code}" data-id="${esc(row.fixture_id)}" class="${mine?.result === code ? 'on' : ''}" aria-pressed="${mine?.result === code}" aria-label="Your pick: ${esc(actualChoice(code,row))}" ${disabled ? 'disabled' : ''}>${label}</button>`).join('')}</div><p>${disabled ? 'Picks are closed because kickoff has passed or the feed has expired.' : '1 = home win · X = draw · 2 = away win.'}</p></div></details>`;
}
function card(row, i) {
  const saved = user.saved.includes(row.fixture_id), started = Date.parse(row.kickoff_utc) <= Date.now();
  return `<article class="card match-card" data-fixture="${esc(row.fixture_id)}" style="--i:${Math.min(i,7)}" aria-label="${esc(row.home_team)} versus ${esc(row.away_team)}"><header class="card-head"><span class="league">${esc(row.competition)}<small>${esc(row.country)}</small></span><time class="when" datetime="${esc(row.kickoff_utc)}">${esc(timestamp(row.kickoff_utc))}</time><button class="star ${saved ? 'on' : ''}" data-save="${esc(row.fixture_id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save match'}">${starIcon}</button></header><button class="card-body" data-open="${esc(row.fixture_id)}" aria-label="Open analysis for ${esc(row.home_team)} versus ${esc(row.away_team)}"><div class="teams"><div class="team">${crest(row.home_team, row.country)}<strong>${esc(row.home_team)}</strong><small>HOME</small></div><span class="match-versus">vs</span><div class="team right">${crest(row.away_team, row.country)}<strong>${esc(row.away_team)}</strong><small>AWAY</small></div></div>${decisions(row)}<span class="card-more"><span>${row.limited_history ? 'Limited team history' : started ? 'Saved pre-match forecast' : 'Model estimates'}</span><b>View analysis <span aria-hidden="true">↗</span></b></span></button></article>`;
}
function rebuildDates() {
  const selected = $('#match-date').value;
  const dates = [...new Set(feed.forecasts.map(row => dateKey(row.kickoff_utc, zone())))].sort();
  $('#match-date').innerHTML = '<option value="all">All dates</option>' + dates.map(date => `<option value="${date}">${esc(new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00Z`)))}</option>`).join('');
  if (dates.includes(selected)) $('#match-date').value = selected;
}
function render() {
  if (!feed) return;
  $('#data-time').textContent = timestamp(feed.data_observed_at_utc);
  $('#refresh-mode').textContent = feed.refresh_mode === 'continuous' ? 'Automatic · repeated collection' : feed.refresh_mode === 'automatic' ? 'Automatic · three daily updates' : 'Manual updates';
  $('#model-date').textContent = feed.model.fitted_as_of;
  $('#snapshot-count').textContent = `${feed.forecasts.length} saved forecasts`;
  const old = stale(feed), notice = $('#feed-notice'); notice.hidden = !old; notice.className = 'notice';
  notice.textContent = old ? 'Forecasts paused: the feed or model needs updating. Saved forecasts retain their original timestamps; use Feed snapshot to inspect them.' : feed.refresh_mode === 'continuous' ? 'The cloud worker repeats rate-limited collection across nine leagues. These are saved forecasts; source results and collection can be delayed.' : feed.refresh_mode === 'automatic' ? 'Automatic updates are scheduled at 06:17, 14:17 and 22:17 Tanzania time. These are saved forecasts, not live scores. The continuous cloud worker is not active.' : 'These are saved forecasts. Updates are currently manual.';
  $('#update-description').textContent = notice.textContent;
  $('#short-update').textContent = `Updated ${timestamp(feed.data_observed_at_utc)}`;
  let rows = filterForecasts(feed, { view: view === 'upcoming' ? 'upcoming' : 'saved', competition: $('#competition').value, date: $('#match-date').value, search: $('#search').value, timezone: zone() });
  if (view === 'bookmarks') rows = rows.filter(row => user.saved.includes(row.fixture_id));
  if (view === 'picks') rows = rows.filter(row => user.picks[row.fixture_id]);
  if ($('#strong-only').checked) rows = rows.filter(row => modelDecisions(row).result.probability >= .55);
  const sort = $('#sort').value;
  if (sort !== 'time') rows.sort((a,b) => (sort === 'confidence' ? -1 : 1) * (modelDecisions(a).result.probability - modelDecisions(b).result.probability));
  const opened = new Set([...document.querySelectorAll('.match-card')].filter(el => el.querySelector('details')?.open).map(el => el.dataset.fixture));
  $('#forecast-grid').innerHTML = rows.map(card).join('');
  document.querySelectorAll('.match-card').forEach(el => { if (opened.has(el.dataset.fixture)) el.querySelector('details').open = true; });
  $('#result-count').textContent = `${rows.length} ${rows.length === 1 ? 'match' : 'matches'}`;
  const titles = { upcoming: 'Upcoming matches', saved: 'The feed snapshot', bookmarks: 'Saved matches', picks: 'My picks' };
  $('#board-title').textContent = titles[view];
  $('#local-note').hidden = !['bookmarks','picks'].includes(view);
  $('#empty-state').hidden = rows.length !== 0;
  $('#empty-title').textContent = old && view === 'upcoming' ? 'Waiting for a fresh forecast feed' : view === 'bookmarks' ? 'No saved matches in this feed' : view === 'picks' ? 'No personal picks in this feed' : 'No matching fixtures';
  $('#empty-message').textContent = view === 'bookmarks' ? 'Star a match to keep it here while it remains in the saved feed.' : view === 'picks' ? 'Open a match, then choose Make your own prediction. Your choices stay in this browser.' : 'Try another date or team. Started matches appear in the feed snapshot.';
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b.dataset.view === view); b.setAttribute('aria-pressed', String(b.dataset.view === view)); });
  const nav = view === 'bookmarks' ? 'saved' : view === 'picks' ? 'picks' : 'matches';
  document.querySelectorAll('[data-nav]').forEach(a => { a.classList.toggle('active', a.dataset.nav === nav); if (a.dataset.nav === nav) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  document.querySelectorAll('[data-league]').forEach(b => { b.classList.toggle('active', b.dataset.league === $('#competition').value); b.setAttribute('aria-pressed', String(b.dataset.league === $('#competition').value)); });
  const active = Number($('#match-date').value !== 'all') + Number($('#sort').value !== 'time') + Number($('#strong-only').checked) + Number(view === 'saved');
  $('#filter-count').hidden = !active; $('#filter-count').textContent = active;
  document.dispatchEvent(new Event('controlsupdated'));
  updateShell(feed);
}
function reset() { $('#competition').value = 'all'; $('#match-date').value = 'all'; $('#search').value = ''; $('#strong-only').checked = false; $('#sort').value = 'time'; render(); }
function showAnalysis(id, trigger) {
  const row = feed.forecasts.find(r => r.fixture_id === id); if (!row) return;
  openFixture = id; returnFocus = trigger;
  const d = modelDecisions(row), p = row.probabilities;
  $('#analysis-title').textContent = `${row.home_team} versus ${row.away_team}`;
  $('#analysis-content').innerHTML = `<div class="d-teams"><div>${crest(row.home_team, row.country)}<strong>${esc(row.home_team)}</strong></div><span class="d-score" style="font-size:28px;letter-spacing:0">VS</span><div>${crest(row.away_team, row.country)}<strong>${esc(row.away_team)}</strong></div></div><p class="d-caption">${esc(row.country)} · ${esc(row.competition)} · ${esc(timestamp(row.kickoff_utc))}</p><section><h3>Two model decisions</h3>${decisions(row)}<p>Full time: ${esc(actualChoice(d.result.code, row))}. Double chance: ${esc(actualChoice(d.double.code, row))}. These are the highest-probability choices in each market.</p></section><section><h3>Full-time probabilities</h3>${bar(p)}<div class="outcomes"><span>Home<b>${percent(p.home)}</b></span><span>Draw<b>${percent(p.draw)}</b></span><span>Away<b>${percent(p.away)}</b></span></div></section><section><h3>Every double chance</h3><div class="markets">${[['1X','Home or draw',p.home_or_draw],['12','Either team wins',p.home_or_away],['X2','Draw or away',p.draw_or_away]].map(([code,label,v]) => `<div><b>${percent(v)}</b><span>${code} · ${label}</span></div>`).join('')}</div><p>Each combines two full-time outcomes. A higher hit rate is expected because two results are covered; it does not establish betting value.</p></section><details class="disclosure"><summary>Data &amp; model details <span aria-hidden="true">+</span></summary><div class="disclosure-content"><dl><dt>Generated</dt><dd>${esc(timestamp(row.generated_at_utc))}</dd><dt>Data observed</dt><dd>${esc(timestamp(row.data_observed_at_utc))}</dd><dt>Model fitted</dt><dd>${esc(feed.model.fitted_as_of)}</dd><dt>Historical matches</dt><dd>${esc(row.home_history_matches)} home team / ${esc(row.away_history_matches)} away team</dd><dt>Forecast ID</dt><dd>${esc(row.forecast_id)}</dd><dt>Model version</dt><dd>${esc(feed.model.version)}</dd></dl><p>Historical results create 56 inputs. No shots or bookmaker odds. Results enter features after a two-calendar-day delay.${row.limited_history ? ' This match has limited team history.' : ''}</p></div></details><details class="disclosure"><summary>How results are checked <span aria-hidden="true">+</span></summary><div class="disclosure-content"><p>The track record checks the saved full-time and double-chance picks separately against the verified regulation result. Only forecasts publicly verified at least two hours before kickoff qualify. Private notes do not enter those totals.</p><a class="text-button" href="./performance.html">Explore track record →</a></div></details>${personalChoice(row)}`;
  if (!$('#analysis-dialog').open) { $('#analysis-dialog').showModal(); document.body.style.overflow = 'hidden'; }
}
function closeAnalysis() { $('#analysis-dialog').close(); }
$('#analysis-dialog').addEventListener('close', () => {
  document.body.style.overflow = ''; openFixture = null;
  if (returnFocus?.isConnected) returnFocus.focus(); else $('#refresh').focus();
});
$('#close-analysis').addEventListener('click', closeAnalysis);
$('#analysis-dialog').addEventListener('click', e => { if (e.target === $('#analysis-dialog')) { const b = e.target.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) closeAnalysis(); } });
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !feed) return;
  if (b.dataset.open) { showAnalysis(b.dataset.open, b); return; }
  if (b.dataset.save) {
    const id = b.dataset.save; if (user.saved.includes(id)) user.saved = user.saved.filter(x => x !== id); else user.saved.push(id);
    savePreferences(user); render(); document.querySelector(`[data-save="${CSS.escape(id)}"]`)?.focus();
  }
  if (b.dataset.pick) {
    const row = feed.forecasts.find(r => r.fixture_id === b.dataset.id);
    if (!row || Date.parse(row.kickoff_utc) <= Date.now() || stale(feed)) return;
    if (user.picks[row.fixture_id]?.result === b.dataset.pick) delete user.picks[row.fixture_id];
    else user.picks[row.fixture_id] = { result: b.dataset.pick, selected_at_utc: new Date().toISOString(), forecast_id: row.forecast_id };
    savePreferences(user); render();
    document.querySelectorAll('[data-pick]').forEach(button => { const selected = user.picks[row.fixture_id]?.result === button.dataset.pick; button.classList.toggle('on',selected); button.setAttribute('aria-pressed',String(selected)); });
  }
  if (b.dataset.league) { $('#competition').value = b.dataset.league; render(); }
});
async function load() {
  if ($('#refresh').disabled) return;
  $('#refresh').disabled = true;
  try {
    const [response] = await Promise.all([
      fetch('./data/predictions.json', { cache: 'no-store' }),
      fetch('./data/team-logos.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('Badges unavailable'); return r.json(); }).then(index => { teamLogos = validateLogoIndex(index); }).catch(() => { /* Keep initials and continue showing verified predictions. */ })
    ]);
    if (!response.ok) throw new Error(`The saved feed is unavailable (${response.status}).`);
    feed = validateFeed(await response.json());
    const chosen = $('#competition').value;
    const competitions = [...new Map(feed.forecasts.map(row => [`${row.country}|${row.competition_code}`, `${row.country} · ${row.competition}`])).entries()].sort((a,b) => a[1].localeCompare(b[1]));
    $('#competition').innerHTML = '<option value="all">All competitions</option>' + competitions.map(([key,label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join('');
    if (competitions.some(([key]) => key === chosen)) $('#competition').value = chosen;
    rebuildDates(); render();
    if (openFixture) { const row = feed.forecasts.find(r => r.fixture_id === openFixture); if (row) showAnalysis(openFixture, returnFocus); else closeAnalysis(); }
  } catch (error) {
    feed = null; $('#forecast-grid').replaceChildren(); $('#short-update').textContent = 'Update unavailable';
    if ($('#analysis-dialog').open) closeAnalysis();
    $('#feed-notice').hidden = false; $('#feed-notice').className = 'notice error';
    $('#feed-notice').textContent = `${error.message} No predictions are shown while the feed cannot be verified.`;
    $('#result-count').textContent = 'Forecast feed unavailable'; $('#snapshot-count').textContent = 'Feed unavailable'; $('#empty-state').hidden = true;
    $('#data-time').textContent = '—'; $('#model-date').textContent = '—'; $('#refresh-mode').textContent = 'Unavailable';
    $('#pulse-rate').textContent = '—'; $('#pulse-note').textContent = 'Verified feed unavailable.'; $('#pulse-meter').style.width = '0%';
  } finally { $('#refresh').disabled = false; }
}
$('#refresh').addEventListener('click', load);
for (const id of ['competition','match-date','strong-only','sort']) $(`#${id}`).addEventListener('change', render);
$('#search').addEventListener('input', render);
$('#timezone').addEventListener('change', () => { if (feed) { rebuildDates(); render(); if (openFixture) showAnalysis(openFixture, returnFocus); } });
$('#reset').addEventListener('click', reset); $('#empty-reset').addEventListener('click', () => { if (['picks','bookmarks'].includes(view)) changeView('upcoming'); reset(); });
function changeView(next) { view = next; const url = new URL(location.href); if (view === 'upcoming') url.searchParams.delete('view'); else url.searchParams.set('view',view); history.replaceState(null,'',url); render(); }
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => changeView(button.dataset.view)));
document.querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', e => { const next = { matches: 'upcoming', picks: 'picks', saved: 'bookmarks' }[a.dataset.nav]; if (next) { e.preventDefault(); changeView(next); window.scrollTo({top:0}); } }));
document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && !$('#analysis-dialog').open) { e.preventDefault(); $('#search').focus(); } });
window.addEventListener('storage', e => { if (!e.key || e.key.startsWith('matchday:')) { user = preferences(); render(); } });
load();
// Refreshing reads the public feed only. It never calls the football API.
setInterval(() => { if (feed && !document.hidden && !$('#analysis-dialog').open && !/INPUT|SELECT/.test(document.activeElement?.tagName) && !document.querySelector('[data-select-for][aria-expanded="true"]') && !$('#filters-panel').open) render(); }, 60000);

setInterval(() => { if (!document.hidden && !$('#analysis-dialog').open && !/INPUT|SELECT/.test(document.activeElement?.tagName) && !document.querySelector('[data-select-for][aria-expanded="true"]') && !$('#filters-panel').open) load(); }, 300000);

// Close the floating filter panel when users move back to the matches.
document.addEventListener('pointerdown', event => {
  if (!event.target.closest('#filters-panel') && !event.target.closest('.select-menu')) $('#filters-panel').open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !event.defaultPrevented && $('#filters-panel').open) { $('#filters-panel').open = false; $('#filters-panel > summary').focus(); }
});
