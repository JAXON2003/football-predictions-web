# Football predictions website

Public display repository for a personal football prediction and learning project.

The private engine publishes generated prediction files here. Performance scoring is not enabled yet. No API credentials, training data or model artifacts belong in this repository.

Website: https://jaxon2003.github.io/football-predictions-web/

Static HTML, CSS and JavaScript run on GitHub Pages. Open `index.html` through a static HTTP server; the browser fetches the saved `data/predictions.json`, not a football API. Relative paths support the repository subdirectory URL.

The forecast board offers upcoming/saved views, team search, competition/date filters and local, UTC or Tanzania time. It shows all six probabilities, generation/data/model timestamps and limited-history flags. The client stops presenting upcoming forecasts when the feed expires, hides started matches, and reports load failures. The performance page explicitly reports that scoring is not enabled; no success rate is invented.

The private engine's **Automatic football collection and website updates** workflow collects, validates, saves and publishes forecasts daily at 06:17 and 18:17 Tanzania time. CSV checks run Monday/Thursday at 05:17, respecting saved download cooldowns. GitHub schedules may be delayed. The browser displays actual observation times and pauses expired feeds. Only the Premier League upcoming feed is enabled initially.

The publisher exports only approved display fields and updates public JSON through a website-only deploy key. It verifies deployed files before saving a conservative first-publication receipt privately. Repeated identical feeds keep their preparation time. A separate manual publication workflow remains available for retrying a saved batch. Collection and prediction do not retrain the fitted model. A separate monthly workflow evaluates a genuine refit and activates it only after quality, serving and recovery checks. The first candidate was rejected, so the originally published model remains active with its original expiry.

Run the browser-independent checks with `node tests/domain.test.mjs`. The site uses no external fonts, analytics, third-party scripts or bookmaker feeds. `method.html` explains the model, two-day result delay and double chances. Source attribution is shown in the footer.

