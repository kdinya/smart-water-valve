# 🚰 Water Valve Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/kdinya/smart-water-valve.svg?style=for-the-badge)](https://github.com/kdinya/smart-water-valve/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

A custom Home Assistant Lovelace card for a smart water shut-off valve, with animated flowing water, leak-sensor status, a battery indicator and full UK/RU/EN localization.

Current version: **v4.4.0**. See [Changelog](#changelog) for what's new.

---

## Table of contents

- [What this card does](#what-this-card-does)
- [Requirements](#requirements)
- [Installation](#installation)
  - [Install via HACS](#install-via-hacs)
  - [Manual installation](#manual-installation)
- [Adding the card to a dashboard](#adding-the-card-to-a-dashboard)
  - [Using the visual editor](#using-the-visual-editor)
  - [Using YAML](#using-yaml)
- [Configuration reference](#configuration-reference)
- [Toggle animation timing](#toggle-animation-timing)
- [Localization](#localization)
- [Full YAML example](#full-yaml-example)
- [Minimal YAML example](#minimal-yaml-example)
- [How the card behaves](#how-the-card-behaves)
- [Changelog](#changelog)
- [Troubleshooting](#troubleshooting)
- [Versioning](#versioning)
- [License](#license)

---

## What this card does

The card is a self-contained visual control for a water valve actuator:

- Renders two full-width animated pipes with flowing water, bubbles, glass reflections and a lever that smoothly animates when the valve opens/closes.
- Pressing the **open/close button** toggles the valve (calls the appropriate service on your configured entity — `switch.turn_on`/`turn_off` or `valve.open_valve`/`close_valve`) and shows an "opening…"/"closing…" transitional state while the action is in progress. **Only the button is a tap target — tapping elsewhere on the card body does nothing**, to avoid accidental toggles.
- Displays up to **two independently configurable leak sensors** (e.g. "Bathroom" / "Kitchen", or anything you name them, or no name at all), each shown as DRY/LEAK with an icon that changes color and pulses on leak. **A leak block is shown whenever its entity is set — the name is purely optional/cosmetic.**
- Shows a battery level for the valve actuator, if you provide a battery sensor.
- Shows a distinct grey **"Unavailable"** state (separate from "Closed") if the valve entity is missing or reporting `unavailable` — so a disconnected actuator never looks like a safely shut valve.
- Switches into a visual emergency state (red glowing border, pulsing "leak" indicator, animated leak drops, pulsing shut-off button) whenever any configured leak sensor is triggered.
- Automatically resets out of a stuck "opening…/closing…" state if the underlying service call fails, or if the card is reattached to the DOM after being detached mid-toggle (e.g. you switched dashboard tabs while the valve was moving).
- Pauses its water/bubble canvas animation when the browser tab is hidden or the card is scrolled out of view, to save CPU.
- Ships with a **visual (UI) editor** — no YAML required to configure it.
- Fully localized: Ukrainian, Russian and English, switchable per-card.

## Requirements

- Home Assistant with Lovelace (any recent version; developed against `2024.1.0`+).
- An existing `switch` (or `valve`) entity that controls your physical water valve actuator (e.g. from Zigbee2MQTT, Tuya, ESPHome, Z-Wave, etc.). This card is a **frontend visualization only** — it does not talk to hardware directly, it just calls services on entities you already have in Home Assistant.
- Optionally: a `sensor`/`binary_sensor` reporting the valve's real physical state, a battery `sensor`, and up to two `binary_sensor` leak/moisture sensors.

## Installation

### Install via HACS

1. Open **HACS** → **Frontend**.
2. Click the **⋮** menu (top right) → **Custom repositories**.
3. Add this repository:
   ```
   https://github.com/kdinya/smart-water-valve
   ```
   Category: **Lovelace**.
4. Find **Water Valve Card** in the list and click **Download**.
5. Make sure the resource `water-valve-card.js` was added automatically under **Settings → Dashboards → ⋮ → Resources** (HACS does this for you).
6. Hard-refresh your browser (**Ctrl+F5** / **Cmd+Shift+R**) so the new JavaScript is loaded, not a cached copy.
7. Open the browser console (F12) and confirm you see a `WATER-VALVE-CARD` / `4.4.0` log line — this confirms the right version is active.

### Manual installation

1. Download `water-valve-card.js` from this repository and copy it to `<config>/www/water-valve-card.js`.
2. Go to **Settings → Dashboards → ⋮ (top right) → Resources → Add resource**:
   ```
   URL: /local/water-valve-card.js
   Resource type: JavaScript module
   ```
3. Hard-refresh the browser (**Ctrl+F5**).
4. If you're upgrading from an older manual install, **remove the previous `/local/water-valve-card.js` resource entry** first (or clear the browser cache) so the old version isn't served instead.

## Adding the card to a dashboard

### Using the visual editor

1. Edit your dashboard → **Add card**.
2. Search for **"Water Valve"** or **"Водяний"**.
3. The card's built-in editor opens, letting you pick every entity and label from dropdowns — no YAML needed. Fields appear in this order: language, name, valve switch, valve state sensor, battery sensor, then each leak sensor's **name first, entity second**, then text/button overrides, then animation timing. See the [Configuration reference](#configuration-reference) below for what each field does.

### Using YAML

Switch the card editor to **"Edit in YAML"**, or add it directly to your dashboard YAML:

```yaml
type: custom:water-valve-card
switch_entity: switch.water_valve
```

`switch_entity` is the only field you truly need — everything else has sensible defaults and can be added incrementally.

## Configuration reference

| Parameter | Type | Required | Description | Default |
|---|---|:---:|---|---|
| `switch_entity` | `string` (entity id) | ✅ | The `switch` (or `valve`-domain) entity that opens/closes the water valve. Pressing the open/close button calls this entity's service. | — |
| `name` | `string` | ❌ | Card / device title shown at the top. | `"Водяний кран"` / `"Водяной кран"` / `"Water valve"` depending on `language` |
| `language` | `string`: `uk` \| `ru` \| `en` | ❌ | UI language for every built-in label, status sentence and button text (see [Localization](#localization)). | `uk` |
| `valve_state_entity` | `string` (entity id) | ❌ | A separate `sensor`/`binary_sensor` reporting the valve's **real physical position** (open/closed), if your hardware reports it independently from the switch command state. | falls back to `switch_entity`'s own state |
| `kran_battery_entity` | `string` (entity id) | ❌ | A `sensor` entity with the battery level of the valve actuator (numeric, e.g. `%`). | none (battery indicator hidden) |
| `bathroom_label` | `string` | ❌ | Display name for the first leak sensor block. **Purely cosmetic** — leave empty to show the block without a name. | — |
| `bathroom_leak_entity` | `string` (entity id) | ❌ | First `binary_sensor` leak/moisture sensor. **This is what controls whether the block is shown at all** — set it and the block appears (named or not); leave it empty and the block is hidden. | none (block hidden) |
| `kitchen_label` | `string` | ❌ | Display name for the second leak sensor block. **Purely cosmetic** — leave empty to show the block without a name. | — |
| `kitchen_leak_entity` | `string` (entity id) | ❌ | Second `binary_sensor` leak/moisture sensor. **This is what controls whether the block is shown at all.** | none (block hidden) |
| `text_dry` | `string` | ❌ | Text shown on a leak indicator when the corresponding sensor is off (dry). | localized `"СУХО"` / `"DRY"` etc. |
| `text_leak` | `string` | ❌ | Text shown on a leak indicator when the corresponding sensor is on (leak). | localized `"ПРОТІЧКА"` / `"LEAK"` etc. |
| `btn_open` | `string` | ❌ | Label for the open action / state. | localized `"ВІДКРИТИ"` / `"OPEN"` etc. |
| `btn_close` | `string` | ❌ | Label for the close action / state. | localized `"ПЕРЕКРИТИ"` / `"CLOSE"` etc. |
| `toggle_lock_ms` | `number` (milliseconds, 500–120000) | ❌ | How long the card shows the transitional "opening…/closing…" state (and disables the button) after you press it. Set this to roughly how long your physical actuator takes to fully open/close. | `8000` (8 seconds) |

> Each leak sensor block is controlled **only by its `*_leak_entity` field**. If the entity is set, the block is shown — with a name if `*_label` is set, or without one if it's left empty. If the entity is not set, the block doesn't appear at all, regardless of the label.

## Toggle animation timing

Real valve actuators aren't instant — there's a mechanical delay between issuing the command and the valve physically finishing its move. The card models this with a transitional state: set `toggle_lock_ms` to roughly how many milliseconds your actuator needs (measure it once with a stopwatch or check your device's documentation). If the underlying service call fails, the card detects that and resets immediately instead of waiting out the full timer.

## Localization

Set `language: uk`, `language: ru` or `language: en` (or pick it from the dropdown in the visual editor) to switch every built-in string — button labels, DRY/LEAK text, and the descriptive status sentences under the valve state (e.g. *"System active, pressure stable"* / *"Leak detected: Kitchen!"* / *"Device is unavailable — check the connection"*). Any of `text_dry`, `text_leak`, `btn_open`, `btn_close` and `name` you set explicitly will override the localized default for that field only.

## Full YAML example

```yaml
type: custom:water-valve-card
language: en
name: Water Shut-off Valve
switch_entity: switch.water_valve
valve_state_entity: sensor.valve_state
kran_battery_entity: sensor.kran_battery
bathroom_label: Bathroom
bathroom_leak_entity: binary_sensor.leak_bathroom
kitchen_label: Kitchen
kitchen_leak_entity: binary_sensor.leak_kitchen
text_dry: DRY
text_leak: LEAK!
btn_open: OPEN
btn_close: SHUT OFF
toggle_lock_ms: 6000
```

## Minimal YAML example

```yaml
type: custom:water-valve-card
switch_entity: switch.water_valve
```

## How the card behaves

- **Press the open/close button** to toggle the valve — tapping the rest of the card does nothing. While the actuator is moving (per `toggle_lock_ms`), the button shows an "opening…"/"closing…" state and is disabled to avoid conflicting commands.
- The **left pipe** (supply side) is always shown filled with flowing water; the **right pipe** (output side) fills or empties depending on whether the valve is open or closed.
- If the valve entity is missing or reports `unavailable`, the card shows a distinct grey **"Unavailable"** state instead of implying the valve is safely closed, and the button is disabled (there's nothing useful to call a service on).
- If **any** configured leak sensor turns on, the whole card switches to an emergency visual state: red glowing/pulsing border, animated leak drops inside the pipes, and the shut-off button pulses to draw attention. If **both** leak sensors are triggered simultaneously, the status text reflects that explicitly.
- The **battery indicator** shows the numeric value from `kran_battery_entity` with a small level bar; it's hidden entirely if you don't configure a battery entity.
- The water/bubble canvas animation automatically pauses when the browser tab is hidden or the card scrolls out of view, and resumes when it's visible again.

## Changelog

### v4.4.0

- **Removed:** the "Auto-measure animation time" feature (`auto_toggle_duration`) has been removed entirely — it measured actuator timing unreliably and could silently override your manually configured `toggle_lock_ms` with a bad value (including its `localStorage` persistence). `toggle_lock_ms` is now always the single, predictable source of truth for the transitional-state duration.
- **Changed:** in the visual editor, each leak sensor's **name field now comes before its entity field** (previously entity was first), and the **battery sensor field has been moved to right after the valve state sensor field** (previously it was after both leak sensor pairs).
- **Fixed:** the leak-entity field labels in the visual editor still said "(empty = hide)", which was no longer accurate since v4.3.0 decoupled visibility from the label — labels now correctly read "(empty = block hidden)" on the entity field itself.

### v4.3.0

- **Fixed:** the card could get permanently stuck showing "opening…/closing…" if the underlying service call failed (not just if the card was detached from the DOM) — it now resets on a failed `callService` too.
- **Added:** a distinct **"Unavailable"** state, shown when the valve entity is missing or reports `unavailable`, instead of misleadingly looking like "Closed".
- **Changed:** toggling now only happens via the action button — tapping the rest of the card body no longer does anything.
- **Changed:** a leak sensor block's visibility now depends only on whether its entity is configured; the label is purely cosmetic.
- **Added:** the water/bubble canvas animation now pauses when the browser tab is hidden or the card is scrolled out of view (`IntersectionObserver` + `visibilitychange`), reducing CPU usage on dashboards you're not actively looking at.

### v4.1.0

- **Fixed:** toggling a `valve`-domain entity called the wrong services (`valve.open`/`valve.close`, which don't exist) — now correctly calls `valve.open_valve`/`valve.close_valve`.
- **Fixed:** `text_dry`, `text_leak`, `btn_open` and `btn_close` were accepted in the config but silently ignored by the renderer — they now correctly override the localized defaults, and are exposed in the visual editor.
- **Changed:** live preview thumbnails re-enabled in the card picker.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Card doesn't appear when searching "Water Valve" in **Add card** | The JavaScript resource isn't loaded. Check **Settings → Dashboards → Resources** for `water-valve-card.js` (type must be **JavaScript Module**), then hard-refresh (**Ctrl+F5**). |
| Browser console doesn't show a `WATER-VALVE-CARD` / version log line | The old cached file is still being served. Clear the browser cache, bump the resource URL with a `?v=...` query string, or remove and re-add the resource. |
| Card shows a config error about a missing entity | `switch_entity` isn't set — it's the only required field. |
| A leak block doesn't show even though I set the entity | Double-check the entity id is spelled correctly — as of v4.3.0+, the block always shows once a valid `*_leak_entity` is set, with or without a label. |
| Tapping the card body does nothing | Expected — only the open/close button toggles the valve, to avoid accidental taps. |
| Card shows "Unavailable" instead of Open/Closed | The `switch_entity` (or `valve_state_entity`) is missing or reporting `unavailable` in Home Assistant — check the entity itself, not the card. |
| Valve toggles but the card gets "stuck" showing opening/closing | `toggle_lock_ms` is probably shorter than your actuator's real travel time — increase it. If the service call itself is failing, the card should now reset automatically instead of staying stuck. |
| Old manual install conflicts with a new HACS install | Remove the old `/local/water-valve-card.js` resource entry (manual install) if you switch to installing via HACS, to avoid two versions being registered. |

## Versioning

This project follows `MAJOR.MINOR.PATCH`. See the [Releases](https://github.com/kdinya/smart-water-valve/releases) page for the changelog of each version.

## License

MIT — see [LICENSE](LICENSE).

---

Made with ❤️ for the Home Assistant community.
