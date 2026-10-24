import { validatePerformance, percent, escapeHTML as esc, performanceTrend, filterPerformanceMatches, dateKey, modelDecisions, validateLogoIndex } from './domain.mjs';
import { updateShell } from './shell.mjs';

const $ = selector => document.querySelector(selector);
const labels = { awaiting_result: 'Awaiting result', scored: 'Result verified', unscored_timing: 'Completed · no eligible forecast', result_review: 'Result needs review', not_played: 'Postponed, suspended or cancelled' };
const fixed = value => value == null ? '—' : value.toFixed(4);
const rate = value => value == null ? '—' : percent(value);
const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const time = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: localZone, year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', timeZoneName:'short' }).format(new Date(value)) : '—';
const table = (headers, rows) => `<div class="score-table-wrap" tabindex="0" role="region" aria-label="${esc(headers[0])} table"><table class="score-table"><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

let competitionLabels = new Map();
function render(p) {
  const c = p.coverage, m = p.metrics;
  $('#performance-count').textContent = p.scored_matches;
  $('#performance-title').textContent = p.scored_matches ? 'A growing public track record.' : 'Waiting for verified results.';
  $('#performance-description').textContent = `${c.monitored_matches} tracked matches · ${c.counts.awaiting_result || 0} awaiting a verified result. Only eligible completed predictions count toward the success rates below. Small samples fluctuate.`;
  $('#score-updated').textContent = `Results last checked: ${time(p.results_observed_at_utc)}. Public tracking began ${time(p.cohort_started_at_utc)}.`;
  const metricCards = [['Full-time picks correct', rate(m?.accuracy), 'Most likely outcome, one choice per match.'], ['Double-chance picks correct', rate(m?.selected_double_chance_success), 'Success of the highest-probability 1X, 12 or X2 choice.'], ['Log loss', fixed(m?.log_loss), 'Lower is better. Measures the full H/D/A probabilities.'], ['Brier score', fixed(m?.brier_score), 'Lower is better. Sum of three squared errors; range 0–2.']].map(([name, value, detail]) => `<div><strong>${esc(name)}</strong><span class="score-value">${esc(value)}</span><p>${esc(detail)}</p></div>`);
  $('#score-metrics').innerHTML = metricCards.slice(0,2).join('');
  $('#score-technical-metrics').innerHTML = metricCards.slice(2).join('');
  $('#score-coverage').innerHTML = `<p>${c.monitored_matches} monitored matches · ${c.timing_eligible_matches} currently meet the publication rule · ${c.verified_completed_matches} verified completed · completed-match scoring coverage: ${rate(c.scored_completed_fraction)}.</p><ul>${Object.entries(c.counts).map(([key, count]) => `<li>${esc(labels[key] || key)}: <strong>${esc(count)}</strong></li>`).join('')}</ul><p>Late or missing forecasts remain visible below. Future unpublished fixtures join coverage once their kickoff passes. Matches played before public tracking began are excluded.</p>`;
  setupRecord(p.matches);
  const groupTable = (groups, name) => groups.length ? table([name, 'Matches', 'H/D/A accuracy', 'Double chance', 'Log loss', 'Brier'], groups.map(r => [esc(r.group.join(' / ')), esc(r.metrics.matches), rate(r.metrics.accuracy), rate(r.metrics.selected_double_chance_success), fixed(r.metrics.log_loss), fixed(r.metrics.brier_score)])) : '<p>Available after the first eligible completed match.</p>';
  $('#score-leagues').innerHTML = groupTable(p.by_competition, 'Competition');
  $('#score-models').innerHTML = groupTable(p.by_model, 'Model version');
  $('#score-calibration').innerHTML = m ? table(['Predicted draw probability', 'Matches', 'Average prediction', 'Actual draw rate'], m.draw_calibration.filter(r => r.matches).map(r => [`${percent(r.lower)}–${percent(r.upper)}`, esc(r.matches), rate(r.mean_predicted_draw), rate(r.observed_draw_rate)])) : '<p>Draw probability groups will appear once eligible matches have results.</p>';
  $('#score-markets').innerHTML = m ? table(['Double chance', 'Matches', 'Outcome frequency', 'Binary Brier'], Object.entries(m.double_chance_markets).map(([key, r]) => [esc(key), esc(r.matches), rate(r.outcome_frequency), fixed(r.binary_brier)])) : '<p>Available after the first eligible completed match.</p>';
  const selected = $('#score-competition').value;
  const scopes = [...new Map(p.matches.map(r => [`${r.country}|${r.competition_code}`, competitionLabels.get(`${r.country}|${r.competition_code}`) || `${r.country} · ${r.competition_code}`])).entries()].sort((a,b) => a[1].localeCompare(b[1]));
  $('#score-competition').innerHTML = '<option value="all">All competitions</option>' + scopes.map(([key,label]) => `<option value="${esc(key)}">${esc(label)}</option>`).join('');
  if (scopes.some(([key]) => key === selected)) $('#score-competition').value = selected;
  $('#score-competition').onchange = () => renderTrend(p.matches);
  renderTrend(p.matches);
  $('#score-policy').textContent = `Scoring policy fingerprint: ${p.policy_sha256}`;
  $('#score-notice').hidden = true;
  $('#score-report').hidden = false;
  document.dispatchEvent(new Event('controlsupdated'));
}


let recordLimit = 20;
let reportMatches = [];
let badgeMap = new Map();
const brokenBadges = new Set();
const competitionName = row => competitionLabels.get(`${row.country}|${row.competition_code}`) || `${row.country} · ${row.competition_code}`;
function badge(row, name) {
  const path = badgeMap.get(JSON.stringify([row.country,name]));
  const image = path && !brokenBadges.has(path) ? `<img src="./${esc(path)}" alt="" width="32" height="32" loading="lazy" decoding="async">` : '';
  const initials = name.split(/[ -]/).filter(Boolean).map(word=>word[0]).slice(0,2).join('').toUpperCase();
  return `<span class="crest record-badge${image ? ' has-logo' : ''}" aria-hidden="true" style="background:var(--yellow)"><span class="crest-initials">${esc(initials)}</span>${image}</span>`;
}
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.closest('.record-badge')) return;
  const src = image.getAttribute('src'); brokenBadges.add(src.replace(/^\.\//,''));
  document.querySelectorAll('.record-badge img').forEach(other => { if (other.getAttribute('src') === src) { other.parentElement.classList.remove('has-logo'); other.remove(); } });
},true);
function savedDecision(row) {
  if (!row.forecast_id || !row.probabilities || !['home','draw','away','home_or_draw','home_or_away','draw_or_away'].every(key=>Number.isFinite(row.probabilities[key]) && row.probabilities[key]>=0 && row.probabilities[key]<=1)) return null;
  const choice = modelDecisions(row);
  return choice.result.code === row.predicted_result && choice.double.code === row.selected_double_chance ? choice : null;
}
const pickLabel = (row, code) => ({H:`${row.home_team} to win`,D:'Draw',A:`${row.away_team} to win`,'1X':`${row.home_team} or draw`,'12':'Either team wins',X2:`Draw or ${row.away_team}`})[code];
function pickGrade(row, value) {
  if (row.status === 'scored') return `<span class="record-grade ${value ? 'record-won' : 'record-lost'}">${value ? '✓ Won' : '✕ Lost'}</span>`;
  const label = row.status === 'awaiting_result' ? 'Awaiting result' : row.status === 'result_review' ? 'Under review' : 'Not graded';
  return `<span class="record-grade record-pending">${label}</span>`;
}
function recordCard(row) {
  const decision = savedDecision(row);
  const hasResult = ['scored','unscored_timing'].includes(row.status) && row.actual_result;
  const pick = (market, choice, correct) => `<div class="record-pick"><span class="record-pick-label">${market}${choice ? `<b>${esc(choice.code === 'H' ? '1' : choice.code === 'A' ? '2' : choice.code === 'D' ? 'X' : choice.code)}</b>` : ''}</span><strong>${choice ? esc(pickLabel(row,choice.code)) : 'No eligible saved pick'}</strong><div class="record-pick-bottom">${choice ? `<span>${percent(choice.probability)}</span>${pickGrade(row,correct)}` : '<span class="record-grade record-pending">Not graded</span>'}</div></div>`;
  const status = labels[row.status] || 'Status unavailable';
  const probabilities = decision ? `<section class="record-probabilities"><h3>Saved prediction probabilities</h3><div>${[['Home win',row.probabilities.home],['Draw',row.probabilities.draw],['Away win',row.probabilities.away],['Home or draw · 1X',row.probabilities.home_or_draw],['Either team wins · 12',row.probabilities.home_or_away],['Draw or away · X2',row.probabilities.draw_or_away]].map(([label,value])=>`<div><span>${label}</span><strong>${percent(value)}</strong></div>`).join('')}</div></section>` : '';
  const outcome = hasResult ? `<strong class="record-final-score">${esc(row.home_goals)}<span>–</span>${esc(row.away_goals)}</strong><small>Final score</small>` : `<strong class="record-waiting-score">—</strong><small>${row.status === 'result_review' ? 'Under review' : row.status === 'not_played' ? 'Not played' : 'Result pending'}</small>`;
  return `<details class="record-match" data-record="${esc(row.fixture_id)}"><summary><div class="record-match-top"><div class="record-fixture"><span class="record-competition">${esc(competitionName(row))}</span><strong>${badge(row,row.home_team)}<span>${esc(row.home_team)}</span></strong><strong>${badge(row,row.away_team)}<span>${esc(row.away_team)}</span></strong><time datetime="${esc(row.kickoff_utc)}">${esc(time(row.kickoff_utc))}</time></div><div class="record-result">${outcome}<span class="record-state record-state-${esc(row.status)}">${esc(status)}</span></div></div><div class="record-picks">${pick('Full-time result',decision?.result,row.outcome_correct)}${pick('Double chance',decision?.double,row.double_chance_correct)}</div><span class="record-open"><span class="record-open-label">View prediction summary</span><span class="record-close-label">Hide prediction summary</span><span aria-hidden="true">⌄</span></span></summary><div class="record-match-details"><p class="record-explanation">${row.status==='scored' ? 'Both picks above are checked separately against the verified final regulation score.' : row.status==='awaiting_result' ? 'Awaiting a verified final result. Neither pick is counted as won or lost yet.' : row.status==='result_review' ? 'The result is under review. This match is excluded from success rates until it is verified.' : row.status==='not_played' ? 'This match is postponed, suspended or cancelled. Its picks are not graded.' : 'This completed match has no prediction that met the two-hour publication rule. It is excluded from success rates.'}</p>${decision ? `<dl class="record-timeline"><div><dt>Prediction made</dt><dd>${esc(time(row.generated_at_utc))}</dd></div><div><dt>First verified publication</dt><dd>${esc(time(row.first_verified_public_at_utc))}</dd></div>${hasResult ? `<div><dt>Result verified</dt><dd>${esc(time(row.result_verified_at_utc))}</dd></div>` : ''}</dl>` : '<p>No eligible saved prediction is available for this match. We do not generate predictions after the result to fill this gap.</p>'}${probabilities}${row.forecast_id ? `<details class="record-reference"><summary>Prediction reference</summary><dl><dt>Forecast ID</dt><dd>${esc(row.forecast_id)}</dd><dt>Model version</dt><dd>${esc(row.model_version)}</dd></dl></details>` : ''}</div></details>`;
}
function recordFilters() {
  return {search:$('#record-search').value, status:$('#record-status').value, competition:$('#record-competition').value, date:$('#record-date').value, outcome:$('#record-outcome').value, sort:$('#record-sort').value, timezone:localZone};
}
function setupRecord(matches) {
  reportMatches = matches;
  const options = (selector, entries, label) => {
    const select = $(selector), chosen = select.value;
    select.innerHTML = `<option value="all">${label}</option>`+entries.map(([key,text])=>`<option value="${esc(key)}">${esc(text)}</option>`).join('');
    if (entries.some(([key])=>key===chosen)) select.value=chosen;
  };
  const competitions = [...new Map(matches.map(r=>[`${r.country}|${r.competition_code}`,competitionName(r)])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  options('#record-competition',competitions,'All competitions');
  const dates = [...new Set(matches.map(r=>dateKey(r.kickoff_utc,localZone)))].sort().reverse();
  options('#record-date',dates.map(date=>[date,new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`))]),'All dates');
  renderRecord();
}
function renderRecord() {
  const open = new Set([...document.querySelectorAll('.record-match[open]')].map(el=>el.dataset.record));
  const filters=recordFilters(), matches=filterPerformanceMatches(reportMatches,filters);
  $('#record-count').textContent = `Showing ${Math.min(recordLimit,matches.length)} of ${matches.length} matching ${matches.length===1 ? 'match' : 'matches'} · ${reportMatches.length} tracked in total.`;
  const active=Number(filters.status!=='all')+Number(filters.competition!=='all')+Number(filters.date!=='all')+Number(filters.outcome!=='all')+Number(filters.sort!=='results');
  $('#record-filter-count').hidden=!active;$('#record-filter-count').textContent=active;
  $('#score-matches').innerHTML = matches.length ? matches.slice(0,recordLimit).map(recordCard).join('') : '<div class="record-empty"><strong>No matches found</strong><p>Try another team, status or date, or reset the filters.</p><button class="text-button" type="button" data-reset-record>Reset filters</button></div>';
  document.querySelectorAll('.record-match').forEach(el=>{if(open.has(el.dataset.record))el.open=true;});
  $('#score-more').hidden=matches.length<=recordLimit;
}
function resetRecord() {
  $('#record-search').value='';
  for(const id of ['status','competition','date','outcome'])$(`#record-${id}`).value='all';
  $('#record-sort').value='results';recordLimit=20;renderRecord();document.dispatchEvent(new Event('controlsupdated'));
}
$('#record-search').addEventListener('input',()=>{recordLimit=20;renderRecord();});
for(const id of ['status','competition','date','outcome','sort'])$(`#record-${id}`).addEventListener('change',()=>{recordLimit=20;renderRecord();});
$('#record-reset').addEventListener('click',resetRecord);
$('#score-matches').addEventListener('click',event=>{if(event.target.closest('[data-reset-record]'))resetRecord();});
$('#score-more').addEventListener('click',()=>{recordLimit+=20;renderRecord();});

function renderTrend(matches) {
  const points = performanceTrend(matches, $('#score-competition').value);
  const count = points.at(-1)?.matches || 0;
  $('#trend-count').textContent = `${count} eligible completed ${count === 1 ? 'match' : 'matches'}`;
  if (!points.length) {
    $('#score-trend').innerHTML = '<div class="chart-empty">Your track record starts with the first eligible verified result. Both lines will appear here as results arrive.</div>';
    return;
  }
  const width = 680, height = 240, left = 50, top = 16, plotW = 610, plotH = 180;
  const x = i => left + (points.length === 1 ? plotW / 2 : plotW * i / (points.length - 1));
  const y = rate => top + (1 - rate) * plotH;
  const path = key => points.map((p,i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(p[key]).toFixed(2)}`).join(' ');
  const grid = [0,.25,.5,.75,1].map(v => `<line class="chart-grid" x1="${left}" x2="${left+plotW}" y1="${y(v)}" y2="${y(v)}"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${Math.round(v*100)}%</text>`).join('');
  const dots = points.map((p,i) => ['full','double'].map(key => `<circle tabindex="0" class="chart-point-${key === 'full' ? 'ft' : 'dc'}" cx="${x(i)}" cy="${y(p[key])}" r="4" aria-label="${p.date}, ${key === 'full' ? 'full-time' : 'double-chance'} ${percent(p[key])}, ${p.matches} matches"><title>${p.date} · ${key === 'full' ? 'Full-time' : 'Double chance'}: ${percent(p[key])} · ${p.matches} matches</title></circle>`).join('')).join('');
  $('#score-trend').innerHTML = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="trend-svg-title trend-svg-desc"><title id="trend-svg-title">Cumulative full-time and double-chance success</title><desc id="trend-svg-desc">${count} eligible completed matches. Latest full-time ${percent(points.at(-1).full)}, double chance ${percent(points.at(-1).double)}. Match-by-match results appear below.</desc>${grid}<path class="trend-ft" d="${path('full')}"/><path class="trend-dc" d="${path('double')}"/>${dots}<text x="${left}" y="225">${points[0].date}</text><text x="${left+plotW}" y="225" text-anchor="end">${points.at(-1).date}</text></svg><p class="local-note">Latest cumulative full-time: ${percent(points.at(-1).full)} · double chance: ${percent(points.at(-1).double)} · ${count} matches. Small samples fluctuate.</p>`;
}

async function load() {
  if ($('#score-refresh').disabled) return;
  $('#score-refresh').disabled = true;
  try {
    const [response] = await Promise.all([
      fetch('./data/predictions.json', { cache: 'no-store' }),
      fetch('./data/team-logos.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('Badges unavailable');return r.json();}).then(index=>{badgeMap=validateLogoIndex(index);}).catch(()=>{})
    ]);
    if (!response.ok) throw new Error(`The saved report is unavailable (${response.status}).`);
    const feed = await response.json();
    competitionLabels = new Map((feed.forecasts || []).map(r => [`${r.country}|${r.competition_code}`, `${r.country} · ${r.competition}`]));
    render(validatePerformance(feed.performance));
    updateShell(feed);
  } catch (error) {
    $('#score-report').hidden = true;
    $('#pulse-rate').textContent = '—'; $('#pulse-meter').style.width = '0%'; $('#pulse-note').textContent = 'Performance report unavailable.';
    $('#score-notice').hidden = false;
    $('#score-notice').className = 'notice error';
    $('#score-notice').textContent = `${error.message} No performance figures are shown while the report cannot be verified.`;
  } finally { $('#score-refresh').disabled = false; }
}
$('#score-refresh').addEventListener('click', load);
load();

setInterval(() => { if (!document.hidden) load(); }, 300000);
