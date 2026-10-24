# Football predictions website

Public display repository for a personal football prediction and learning project.

The private engine will publish generated prediction and performance files here. No API credentials, training data or model artifacts belong in this repository.

Website: https://jaxon2003.github.io/football-predictions-web/

Static HTML, CSS and JavaScript run on GitHub Pages. Open `index.html` through a static HTTP server; the browser fetches the saved `data/predictions.json`, not a football API. Relative paths support the repository subdirectory URL.

The forecast board offers upcoming/saved views, team search, competition/date filters and local, UTC or Tanzania time. It shows all six probabilities, generation/data/model timestamps and limited-history flags. The client stops presenting upcoming forecasts when the feed expires, hides started matches, and reports load failures. The performance page explicitly reports that scoring is not enabled; no success rate is invented.

The private engine's manual **Publish verified football website data** workflow exports only approved display fields and updates the public JSON through a website-only deploy key. It verifies the deployed files before saving a conservative first-publication receipt privately. Repeated identical feeds keep their preparation time. Automatic updates are not enabled yet.

Run the browser-independent checks with `node tests/domain.test.mjs`. The site uses no external fonts, analytics, third-party scripts or bookmaker feeds. `method.html` explains the model, two-day result delay and double chances. Source attribution is shown in the footer.

