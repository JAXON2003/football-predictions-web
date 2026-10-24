# Football predictions website

Public display repository for a personal football prediction and learning project.

The private engine publishes generated prediction files here. Prospective performance scoring is active; metrics remain blank until eligible completed matches are verified. No API credentials, training data or model artifacts belong in this repository.

Website: https://jaxon2003.github.io/football-predictions-web/

Static HTML, CSS and JavaScript run on GitHub Pages. Open `index.html` through a static HTTP server; the browser fetches the saved `data/predictions.json`, not a football API. Relative paths support the repository subdirectory URL.

The forecast board offers upcoming/saved views, team search, competition/date filters and local, UTC or Tanzania time. It shows all six probabilities, generation/data/model timestamps and limited-history flags. The client stops presenting upcoming forecasts when the feed expires, hides started matches, and reports load failures. The performance page shows verified scores, timing coverage, match records, draw calibration and league/model groups from the private engine. Empty reports show no invented success rate. It explains the two-hour publication rule, provider-recorded kickoff limitation, corrections and the distinction between double-chance hit rate and betting profit.

The private engine's **Automatic football collection and website updates** workflow collects, validates, saves and publishes forecasts daily at 06:17, 14:17 and 22:17 Tanzania time. CSV checks are combined with the Monday/Thursday 06:17 run, respecting saved download cooldowns. GitHub schedules may be delayed. The browser displays actual observation times and pauses expired feeds. All nine approved upcoming league feeds are enabled.

The publisher exports only approved display fields and updates public JSON through a website-only deploy key. It verifies deployed files before saving a conservative first-publication receipt privately. Repeated identical feeds keep their preparation time. A separate manual publication workflow remains available for retrying a saved batch. Collection and prediction do not retrain the fitted model. A separate monthly workflow evaluates a genuine refit and activates it only after quality, serving and recovery checks. The first six-month candidate was rejected; a subsequent full-year evaluation qualified the genuinely fitted 24 October replacement, valid until 24 November 2026.

Run the browser-independent checks with `node tests/domain.test.mjs`. The site uses Google Fonts with system fallbacks; it uses no analytics, third-party scripts or bookmaker feeds. `method.html` explains the model, two-day result delay and double chances. Source attribution is shown in the footer.



Nine leagues now have verified provider mappings: Premier League, Championship,
Bundesliga, Ligue 1, Serie A (Italy), La Liga, Primeira Liga, Eredivisie and
Série A (Brazil). The filters use the leagues actually present in the saved
forecast batch. Public scoring starts independently at each league’s first
verified publication. A pending always-on worker is not advertised as active:
the feed’s private configuration determines whether the site displays scheduled
updates or an activated continuous host. Current production remains scheduled.

The supplied Figma redesign is implemented without its demonstration statistics.
See [design and behavior notes](DESIGN_NOTES.md). Cards give distinct full-time
and double-chance model picks. The track record grades both and plots real
cumulative success as eligible results arrive. Bookmarks and personal full-time
picks use local browser storage; they never enter the model's public scores.


The home screen now puts matches first: teams, kickoff and two model choices.
Search and league selection stay visible; additional filters open under Filters.
All probabilities and personal picks are in View analysis. Technical metadata
and advanced performance metrics open only when requested. Custom dropdowns keep
native-select fallbacks and support keyboard navigation and type-ahead. The
result record loads 20 matches at a time, with Show more for the rest.

The sun/moon button switches all pages between the original light palette and a dark palette. Light is the default. A separate browser preference remembers the selected theme; it also synchronizes between open tabs. The saved choice is applied before the stylesheet loads, and the switch works when browser storage is blocked.

Team badges are cached locally under `assets/teams/` and indexed by exact country/team identity in `data/team-logos.json`. The engine refreshes this index from its approved provider mappings during automatic publication, downloading missing PNGs from football-data.org's crest host without an API token. Content-addressed filenames preserve browser caches. Both cards and analysis use the same badges; unavailable images or indexes fall back to initials. Badge updates do not change forecast IDs, probabilities or historical performance records.

The track record now has team search, match status, competition/date/outcome filters and sorting, with pagination after filtering. Open a match to inspect its saved H/D/A and double-chance choices, six probabilities, forecast/publication times and verified score. Each market is marked won/lost independently only after eligible scoring; pending, disputed, unplayed and ungraded matches remain distinct. Filters affect the match list, not overall headline metrics. Match dates and timestamps use the visitor's local timezone. Historical picks always come from the performance snapshot, never from the current upcoming forecast for the same team.
