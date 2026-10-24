import { validatePerformance, percent, escapeHTML as esc, performanceTrend } from './domain.mjs';
import { updateShell } from './shell.mjs';

const $ = selector => document.querySelector(selector);
const labels = { awaiting_result: 'Waiting for result', scored: 'Result verified', unscored_timing: 'Completed · no eligible forecast', result_review: 'Result needs review', not_played: 'Postponed, suspended or cancelled' };
const fixed = value => value == null ? '—' : value.toFixed(4);
const rate = value => value == null ? '—' : percent(value);
const time = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' UTC' : '—';
const table = (headers, rows) => `<div class="score-table-wrap" tabindex="0" role="region" aria-label="${esc(headers[0])} table"><table class="score-table"><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

let competitionLabels = new Map();
function render(p) {
  const c = p.coverage, m = p.metrics;
  $('#performance-count').textContent = p.scored_matches;
  $('#performance-title').textContent = p.scored_matches ? 'A growing public track record.' : 'Waiting for verified results.';
  $('#performance-description').textContent = p.scored_matches ? 'These are prospective website forecasts checked against accepted regulation results. A small sample cannot establish reliable performance.' : 'We’ll show success rates once eligible pre-match predictions have verified final results.';
  $('#score-updated').textContent = `Results last checked: ${time(p.results_observed_at_utc)}. Public tracking began ${time(p.cohort_started_at_utc)}.`;
  const metricCards = [['Full-time picks correct', rate(m?.accuracy), 'Most likely outcome, one choice per match.'], ['Double-chance picks correct', rate(m?.selected_double_chance_success), 'Success of the highest-probability 1X, 12 or X2 choice.'], ['Log loss', fixed(m?.log_loss), 'Lower is better. Measures the full H/D/A probabilities.'], ['Brier score', fixed(m?.brier_score), 'Lower is better. Sum of three squared errors; range 0–2.']].map(([name, value, detail]) => `<div><strong>${esc(name)}</strong><span class="score-value">${esc(value)}</span><p>${esc(detail)}</p></div>`);
  $('#score-metrics').innerHTML = metricCards.slice(0,2).join('');
  $('#score-technical-metrics').innerHTML = metricCards.slice(2).join('');
  $('#score-coverage').innerHTML = `<p>${c.monitored_matches} monitored matches · ${c.timing_eligible_matches} currently meet the publication rule · ${c.verified_completed_matches} verified completed · completed-match scoring coverage: ${rate(c.scored_completed_fraction)}.</p><ul>${Object.entries(c.counts).map(([key, count]) => `<li>${esc(labels[key] || key)}: <strong>${esc(count)}</strong></li>`).join('')}</ul><p>Late or missing forecasts remain visible below. Future unpublished fixtures join coverage once their kickoff passes. Matches played before public tracking began are excluded.</p>`;
  renderRecord(p.matches);
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
function renderRecord(matches) {
  const ordered = [...matches].sort((a,b) => {
    if ((a.status === 'scored') !== (b.status === 'scored')) return a.status === 'scored' ? -1 : 1;
    return (a.status === 'scored' ? -1 : 1) * (Date.parse(a.kickoff_utc) - Date.parse(b.kickoff_utc));
  });
  $('#record-count').textContent = `Showing ${Math.min(recordLimit,matches.length)} of ${matches.length} tracked matches. Only eligible verified results count toward success rates.`;
  const grade = (row, correct) => `<small class="${row.status === 'scored' ? correct ? 'hit' : 'miss' : 'pending'}">${row.status === 'scored' ? correct ? '✓ Correct' : '✕ Incorrect' : row.status === 'not_played' ? 'Not graded · not played' : row.status === 'result_review' ? 'Under review' : 'Pending · not graded'}</small>`;
  $('#score-matches').innerHTML = matches.length ? table(['Match', 'Final result', 'Full-time pick', 'Double-chance pick'], ordered.slice(0,recordLimit).map(r => [
    `<b>${esc(r.home_team)} – ${esc(r.away_team)}</b><small>${esc(time(r.kickoff_utc))}</small><small>${esc(labels[r.status] || r.status)}</small>${r.forecast_id ? `<details class="score-proof"><summary>Prediction details</summary><small>Published ${esc(time(r.first_verified_public_at_utc))}</small><small>Generated ${esc(time(r.generated_at_utc))}</small><small>Forecast ${esc(r.forecast_id)} · model ${esc(r.model_version)}</small></details>` : ''}`,
    r.actual_result ? `${esc(r.home_goals)}–${esc(r.away_goals)}` : r.status === 'not_played' ? 'Not played' : r.status === 'result_review' ? 'Under review' : 'Awaiting result',
    r.forecast_id ? `${esc({H:'Home win',D:'Draw',A:'Away win'}[r.predicted_result])}${grade(r,r.outcome_correct)}` : 'No eligible pick',
    r.forecast_id ? `${esc({'1X':'Home or draw','12':'Either team wins',X2:'Draw or away'}[r.selected_double_chance])} (${esc(r.selected_double_chance)})${grade(r,r.double_chance_correct)}` : 'No eligible pick'
  ])) : '<p>No matches in the public tracking period yet.</p>';
  $('#score-more').hidden = matches.length <= recordLimit;
  $('#score-more').onclick = () => { recordLimit += 20; renderRecord(matches); };
}

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
    const response = await fetch('./data/predictions.json', { cache: 'no-store' });
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
