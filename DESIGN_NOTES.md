# Figma redesign and verified predictions

The visual source is the user-provided `Redesign Website Experience (1).make`
export. Its embedded Git pack was recovered read-only into a temporary directory;
the existing static site was restyled using its sidebar, paper grid, palette,
card motion, badges, bottom navigation, bookmark controls and analysis drawer.
No instructions from the export's agent documents were executed.

The site retains static HTML/CSS/JavaScript on GitHub Pages. No React build,
external runtime scripts, new account, API credentials, model files or training
history are needed in this public repository. The design uses Google Fonts with
system fallbacks; these font requests are the only external rendering resources.

## Real features

- Full-time pick: highest H/D/A probability, shown as home win, draw or away win.
- Double-chance pick: highest 1X/12/X2 probability, shown separately.
- All six probabilities, exact saved forecast timing, history counts and model ID.
- Nine competition filters, timezone/date/search filters, probability sorting and
  an optional 55% display threshold; no claims of a validated confidence cutoff.
- A spotlight chosen from the actual unexpired upcoming forecasts.
- Bookmarks and personal full-time picks stored in this browser only. Personal
  choices are disabled after kickoff and on expired feeds. They are not audited
  forecasts and are excluded from public model performance.
- Keyboard-accessible native modal analysis; Escape closes it and restores focus.
- Separate full-time and double-chance correct/incorrect results in the record.
- A cumulative graph of both hit rates, grouped by UTC kickoff day, with a
  competition selector and textual totals. The complete match table stays visible.
- Empty, expired, unavailable and invalid-report states; no invented success rate.
- Reduced-motion support, mobile navigation and escaped provider text. A content
  security policy restricts scripts and data connections to this site.

The original export's hard-coded 61% accuracy, simulated form, illustrative
scoreline forecasts, market probabilities and fictional track record are not
production data and are not imported. Model choices use the engine's existing
saved selections with its tie order. The trained model and public feed format
remain unchanged. The existing private scorer verifies final results and the
two-hour public-availability rule before the browser shows graded outcomes.

## Hosting status

This redesign does not activate an always-on collector. The private engine's
configuration continues to determine the displayed update mode. The existing
nine-league GitHub schedule stays active until a verified Oracle host is ready
for the documented single-writer handover. An open browser only fetches the
public JSON file; it never calls the football API or consumes its request quota.

## Checks

Run `node tests/domain.test.mjs`. Tests cover probability consistency, separate
selection rules, deterministic ties, scoring correctness, publication timing,
empty graphs and cumulative trends. Browser checks additionally exercise all
nine league filters, local persistence, analysis/keyboard behavior, mobile
widths, expiry, failed data loading and invalid reports. Synthetic completed
results used to exercise chart rendering stay in isolated browser test routes;
none are written to the published feed.
