import { validatePerformance, percent, escapeHTML as esc } from './domain.mjs';

const $ = selector => document.querySelector(selector);
const labels = { awaiting_result: 'Awaiting verified result', scored: 'Scored', unscored_timing: 'Completed · no eligible forecast', result_review: 'Result needs review', not_played: 'Postponed, suspended or cancelled' };
const fixed = value => value == null ? '—' : value.toFixed(4);
const rate = value => value == null ? '—' : percent(value);
const time = value => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' UTC' : '—';
const table = (headers, rows) => `<div class="score-table-wrap" tabindex="0" role="region" aria-label="${esc(headers[0])} table"><table class="score-table"><thead><tr>${headers.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(cells => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

function render(p) {
  const c = p.coverage, m = p.metrics;
  $('#performance-count').textContent = p.scored_matches;
  $('#performance-title').textContent = p.scored_matches ? 'A growing public track record.' : 'Waiting for the first eligible final result.';
  $('#performance-description').textContent = p.scored_matches ? 'These are prospective website forecasts checked against accepted regulation results. A small sample cannot establish reliable performance.' : 'Scoring is active. Accuracy and success rates stay blank until a forecast passes the publication rule and its completed result is verified.';
  $('#score-updated').textContent = `Results last checked: ${time(p.results_observed_at_utc)}. Public tracking began ${time(p.cohort_started_at_utc)}.`;
  $('#score-metrics').innerHTML = [['H/D/A accuracy', rate(m?.accuracy), 'Most likely outcome, one choice per match.'], ['Selected double chance', rate(m?.selected_double_chance_success), 'Success of the highest-probability 1X, 12 or X2 choice.'], ['Log loss', fixed(m?.log_loss), 'Lower is better. Measures the full H/D/A probabilities.'], ['Brier score', fixed(m?.brier_score), 'Lower is better. Sum of three squared errors; range 0–2.']].map(([name, value, detail]) => `<div><strong>${esc(name)}</strong><span class="score-value">${esc(value)}</span><p>${esc(detail)}</p></div>`).join('');
  $('#score-coverage').innerHTML = `<p>${c.monitored_matches} monitored matches · ${c.timing_eligible_matches} currently meet the publication rule · ${c.verified_completed_matches} verified completed · completed-match scoring coverage: ${rate(c.scored_completed_fraction)}.</p><ul>${Object.entries(c.counts).map(([key, count]) => `<li>${esc(labels[key] || key)}: <strong>${count}</strong></li>`).join('')}</ul><p>Late or missing forecasts remain visible below. Future unpublished fixtures join coverage once their kickoff passes. Matches played before public tracking began are excluded.</p>`;
  $('#score-matches').innerHTML = p.matches.length ? table(['Match / kickoff (UTC)', 'Result', 'Scoring status', 'Saved selection', 'Publication proof'], p.matches.slice().reverse().map(r => [
    `${esc(r.home_team)} – ${esc(r.away_team)}<small>${esc(time(r.kickoff_utc))}</small>`,
    r.actual_result ? `${r.home_goals}–${r.away_goals} (${esc(r.actual_result)})` : '—',
    `${esc(labels[r.status] || r.status)}${!r.timing_eligible ? '<small>No eligible two-hour publication</small>' : ''}`,
    r.forecast_id ? `${esc(r.predicted_result)} / ${esc(r.selected_double_chance)}${r.status === 'scored' ? `<small>H/D/A ${r.outcome_correct ? 'correct' : 'incorrect'} · double chance ${r.double_chance_correct ? 'correct' : 'incorrect'}</small>` : ''}` : '—',
    r.forecast_id ? `${esc(time(r.first_verified_public_at_utc))}<small>Generated ${esc(time(r.generated_at_utc))}</small><small>Forecast ${esc(r.forecast_id)} · model ${esc(r.model_version)}</small>` : '—'
  ])) : '<p>No matches in the public tracking period yet.</p>';
  const groupTable = (groups, name) => groups.length ? table([name, 'Matches', 'H/D/A accuracy', 'Double chance', 'Log loss', 'Brier'], groups.map(r => [esc(r.group.join(' / ')), r.metrics.matches, rate(r.metrics.accuracy), rate(r.metrics.selected_double_chance_success), fixed(r.metrics.log_loss), fixed(r.metrics.brier_score)])) : '<p>Available after the first eligible completed match.</p>';
  $('#score-leagues').innerHTML = groupTable(p.by_competition, 'Competition');
  $('#score-models').innerHTML = groupTable(p.by_model, 'Model version');
  $('#score-calibration').innerHTML = m ? table(['Predicted draw probability', 'Matches', 'Average prediction', 'Actual draw rate'], m.draw_calibration.filter(r => r.matches).map(r => [`${percent(r.lower)}–${percent(r.upper)}`, r.matches, rate(r.mean_predicted_draw), rate(r.observed_draw_rate)])) : '<p>Draw probability groups will appear once eligible matches have results.</p>';
  $('#score-markets').innerHTML = m ? table(['Double chance', 'Matches', 'Outcome frequency', 'Binary Brier'], Object.entries(m.double_chance_markets).map(([key, r]) => [esc(key), r.matches, rate(r.outcome_frequency), fixed(r.binary_brier)])) : '<p>Available after the first eligible completed match.</p>';
  $('#score-policy').textContent = `Scoring policy fingerprint: ${p.policy_sha256}`;
  $('#score-notice').hidden = true;
  $('#score-report').hidden = false;
}

async function load() {
  $('#score-refresh').disabled = true;
  try {
    const response = await fetch('./data/predictions.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`The saved report is unavailable (${response.status}).`);
    const feed = await response.json();
    render(validatePerformance(feed.performance));
  } catch (error) {
    $('#score-report').hidden = true;
    $('#score-notice').hidden = false;
    $('#score-notice').className = 'notice error';
    $('#score-notice').textContent = `${error.message} No performance figures are shown while the report cannot be verified.`;
  } finally { $('#score-refresh').disabled = false; }
}
$('#score-refresh').addEventListener('click', load);
load();
