# Contributing

Thanks for considering a contribution to Water Valve Card! This is a small,
single-file custom Lovelace card, so the workflow is intentionally simple.

## Before you start

- For a bug report or a small fix, just open an issue or a pull request.
- For a bigger change (new config option, layout rework), please open an
  issue first to discuss the approach — it avoids wasted work if the
  direction needs adjusting.

## Project structure

- `water-valve-card.js` — the entire card (custom element + visual editor),
  vanilla JS, no build step, no dependencies.
- `tests/water-valve-card.test.js` — unit tests for the pure logic (timing
  math, valve-state resolution, the pipe-split helper, etc.) using a small
  DOM shim in `tests/dom-shim.js`, run with plain Node (`npm test`), no test
  framework required.
- `hacs.json` — HACS metadata.
- `README.md` — user docs and the [Changelog](README.md#changelog).

## Making a change

1. Fork the repo and create a branch off `main`.
2. Edit `water-valve-card.js` directly — there's no build/bundle step.
3. Run the tests:
   ```bash
   npm test
   ```
4. If you can, load the card in a real Home Assistant dev instance (copy the
   file into `www/` and add it as a resource) to sanity-check the visual
   result — the unit tests only cover logic, not rendering.
5. Update `README.md` if you changed or added a config option (the
   [Configuration reference](README.md#configuration-reference) table) or a
   user-visible behavior (add a line to the [Changelog](README.md#changelog)).
6. Open a pull request. GitHub Actions will run the unit tests and the HACS
   validation action automatically.

## Code style

- No build tooling on purpose — keep it a single file that HACS/browsers can
  load directly.
- Match the existing style: template-literal HTML/CSS blocks, `_`-prefixed
  private methods, comments explaining *why* a non-obvious CSS/JS choice was
  made (there are a lot of these — they exist because the reasoning wasn't
  obvious the first time either).
- Keep new config options backward-compatible: add a sensible default so
  existing YAML configs and dashboards keep working unchanged.

## Reporting bugs

Please use the bug report issue template and include:

- Your card configuration (YAML), with any secrets/entity IDs you'd rather
  not share replaced by placeholders.
- Home Assistant version and whether you're on phone, tablet, or desktop.
- A screenshot or screen recording if it's a visual issue.
- The browser console log line (`WATER-VALVE-CARD ...`) so the exact loaded
  version is known.
