import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFeed, filterForecasts, stale, dateKey, escapeHTML } from '../assets/domain.mjs';

const now = Date.parse('2026-10-24T12:00:00Z');
const example = () => ({ schema_version: 1, publication_id: 'test-only', valid_until_utc: '2026-10-25T12:00:00Z', forecasts: [{ forecast_id: 'a', fixture_id: 'a', country: 'England', competition_code: 'E0', home_team: 'Arsenal', away_team: 'Everton', predicted_result: 'H', highest_probability_double_chance: '12', kickoff_utc: '2026-10-24T14:00:00Z', generated_at_utc: '2026-10-24T11:00:00Z', probabilities: { home: .4, draw: .25, away: .35, home_or_draw: .65, home_or_away: .75, draw_or_away: .6 } }] });
test('all six probabilities remain consistent', () => { assert.equal(validateFeed(example()).forecasts.length, 1); const bad = example(); bad.forecasts[0].probabilities.home_or_draw = .1; assert.throws(() => validateFeed(bad)); });
test('expired feed pauses upcoming but preserves explicitly saved view', () => { const feed = example(); const later = now + 2 * 86400000; assert.equal(stale(feed, later), true); assert.equal(filterForecasts(feed, {}, later).length, 0); assert.equal(filterForecasts(feed, { view: 'saved' }, later).length, 1); });
test('started matches disappear from upcoming', () => { const feed = example(); assert.equal(filterForecasts(feed, {}, now + 3 * 3600000).length, 0); });
test('team, competition and date filters combine', () => { const feed = example(); assert.equal(filterForecasts(feed, { search: 'ever', competition: 'England|E0', date: '2026-10-24' }, now).length, 1); assert.equal(filterForecasts(feed, { search: 'chelsea' }, now).length, 0); });
test('dates follow the selected timezone at midnight', () => { assert.equal(dateKey('2026-10-24T23:30:00Z', 'Africa/Dar_es_Salaam'), '2026-10-25'); });
test('provider strings cannot inject HTML', () => { assert.equal(escapeHTML('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;'); });
test('duplicates and post-kickoff generation fail verification', () => { const feed = example(); feed.forecasts.push({ ...feed.forecasts[0] }); assert.throws(() => validateFeed(feed)); const late = example(); late.forecasts[0].generated_at_utc = late.forecasts[0].kickoff_utc; assert.throws(() => validateFeed(late)); });

import { validatePerformance } from '../assets/domain.mjs';
const emptyPerformance = () => ({ status: 'active', matches: [], minimum_public_lead_hours: 2, scored_matches: 0, metrics: null, coverage: { monitored_matches: 0 } });
test('zero completed matches shows no invented accuracy', () => { assert.equal(validatePerformance(emptyPerformance()).metrics, null); const bad = emptyPerformance(); bad.metrics = { accuracy: 1 }; assert.throws(() => validatePerformance(bad)); });
test('performance counts must agree with the match record', () => { const bad = emptyPerformance(); bad.scored_matches = 1; assert.throws(() => validatePerformance(bad)); });
test('a late publication cannot be labelled scored', () => { const bad = emptyPerformance(); bad.matches = [{ fixture_id: 'test', home_team: 'A', away_team: 'B', kickoff_utc: '2026-10-24T14:00:00Z', generated_at_utc: '2026-10-24T11:00:00Z', first_verified_public_at_utc: '2026-10-24T12:01:00Z', status: 'scored', timing_eligible: true, actual_result: 'H', log_loss: 1, brier_score: .5 }]; assert.throws(() => validatePerformance(bad)); });

import { modelDecisions, performanceTrend } from '../assets/domain.mjs';
test('full-time and double chance produce separate choices from the same probabilities', () => {
  const d = modelDecisions(example().forecasts[0]);
  assert.deepEqual(d.result, { code: 'H', label: 'Home win', probability: .4 });
  assert.deepEqual(d.double, { code: '12', label: 'Home or away', probability: .75 });
});
test('exact ties use the same selection order as the engine', () => {
  const row = example().forecasts[0]; row.probabilities = {home:1/3,draw:1/3,away:1/3,home_or_draw:2/3,home_or_away:2/3,draw_or_away:2/3};
  assert.equal(modelDecisions(row).result.code,'H'); assert.equal(modelDecisions(row).double.code,'1X');
});
const scoredRow = (id, day, goals = [2,1]) => ({ ...example().forecasts[0], fixture_id:id, kickoff_utc:`2026-10-${day}T14:00:00Z`, generated_at_utc:`2026-10-${day}T10:00:00Z`, first_verified_public_at_utc:`2026-10-${day}T11:00:00Z`, status:'scored',timing_eligible:true, home_goals:goals[0],away_goals:goals[1],actual_result:goals[0]>goals[1]?'H':goals[0]<goals[1]?'A':'D',selected_double_chance:'12',outcome_correct:Number(goals[0]>goals[1]),double_chance_correct:Number(goals[0]!==goals[1]),log_loss:1,brier_score:.5 });
const reportWith = rows => ({ ...emptyPerformance(), matches:rows, scored_matches:rows.length, coverage:{monitored_matches:rows.length},metrics:{matches:rows.length,log_loss:1,brier_score:.5,accuracy:rows.reduce((n,r)=>n+r.outcome_correct,0)/rows.length,selected_double_chance_success:rows.reduce((n,r)=>n+r.double_chance_correct,0)/rows.length} });
test('grading preserves a double-chance hit when the full-time pick loses', () => {
  const r = scoredRow('away-win','24',[0,2]);
  assert.equal(r.outcome_correct,0);assert.equal(r.double_chance_correct,1);
  assert.equal(validatePerformance(reportWith([r])).scored_matches,1);
});
test('misgraded picks and impossible score/result combinations fail closed', () => {
  const row = scoredRow('test','24');
  for (const change of [{outcome_correct:0},{double_chance_correct:0},{actual_result:'D'},{home_goals:-1},{selected_double_chance:'X2'}]) assert.throws(()=>validatePerformance(reportWith([{...row,...change}])));
});
test('performance graph is empty until eligible scored results exist', () => {
  assert.deepEqual(performanceTrend([]),[]);
  assert.deepEqual(performanceTrend([{...scoredRow('test','24'),status:'awaiting_result'},{...scoredRow('late','24'),timing_eligible:false}]),[]);
});
test('cumulative graph groups UTC days, sorts matches and filters competitions', () => {
  const rows = [scoredRow('third','25',[0,2]),scoredRow('first','24'),scoredRow('second','24',[1,1])];
  assert.deepEqual(performanceTrend(rows),[{date:'2026-10-24',matches:2,full:.5,double:.5},{date:'2026-10-25',matches:3,full:1/3,double:2/3}]);
  assert.equal(performanceTrend(rows,'England|E0').at(-1).matches,3);
  assert.deepEqual(performanceTrend(rows,'Italy|I1'),[]);
  assert.equal(rows[0].fixture_id,'third');
});
test('summary success rates must agree with the underlying scored matches', () => {
  const p = reportWith([scoredRow('test','24')]);p.metrics.accuracy=.3;assert.throws(()=>validatePerformance(p));
});
