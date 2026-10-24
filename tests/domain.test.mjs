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
