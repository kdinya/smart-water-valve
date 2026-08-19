# 🚰 Water Valve Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/kdinya/smart-water-valve.svg?style=for-the-badge)](https://github.com/kdinya/smart-water-valve/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

A custom Home Assistant Lovelace card for a smart water shut-off valve, with animated flowing water, leak-sensor status, a battery indicator and full UK/RU/EN localization.

Current version: **v4.1.0**. See [Changelog](#changelog) for what's new.

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
- [Troubleshooting](#troubleshooting)
- [Versioning](#versioning)
- [License](#license)

---

## What this card does

The card is a self-contained visual control for a water valve actuator:

- Renders two full-width animated pipes with flowing water, bubbles, glass reflections and a lever that smoothly animates when the valve opens/closes.
- Tapping the card toggles the valve (calls `switch.toggle` / `valve` service on your configured entity) and shows an "opening…"/"closing…" transitional state while the action is in progress, based on a configurable (or auto-measured) timing.
- Displays up to **two independently labeled leak sensors** (e.g. "Bathroom" / "Kitchen", or anything you name them), each shown as DRY/LEAK with an icon that changes color and pulses on leak.
- Shows a battery level for the valve actuator, if you provide a battery sensor.
- Switches into a visual emergency state (red glowing border, pulsing "leak" indicator, animated leak drops, pulsing shut-off button) whenever any configured leak sensor is triggered.
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
7. Open the browser console (F12) and confirm you see a `WATER-VALVE-CARD` / `4.1.0` log line — this confirms the right version is active.

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
2. Search for **"Water Valve"** or **"Водяний"** — the card should appear in the picker (if it doesn't, see [Troubleshooting](#troubleshooting)).
3. The card's built-in editor will open, letting you pick every entity and label from dropdowns — no YAML needed. See the [Configuration reference](#configuration-reference) below for what each field does.

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
| `switch_entity` | `string` (entity id) | ✅ | The `switch` (or `valve`-domain) entity that opens/closes the water valve. Tapping the card calls this entity's toggle service. | — |
| `name` | `string` | ❌ | Card / device title shown at the top. | `"Водяний кран"` / `"Водяной кран"` / `"Water valve"` depending on `language` |
| `language` | `string`: `uk` \| `ru` \| `en` | ❌ | UI language for every built-in label, status sentence and button text (see [Localization](#localization)). | `uk` |
| `valve_state_entity` | `string` (entity id) | ❌ | A separate `sensor`/`binary_sensor` reporting the valve's **real physical position** (open/closed), if your hardware reports it independently from the switch command state. | falls back to `switch_entity`'s own state |
| `kran_battery_entity` | `string` (entity id) | ❌ | A `sensor` entity with the battery level of the valve actuator (numeric, e.g. `%`). | none (battery indicator hidden) |
| `bathroom_leak_entity` | `string` (entity id) | ❌ | First `binary_sensor` leak/moisture sensor. | none |
| `bathroom_label` | `string` | ❌ | Display label for the first leak sensor. **Leave empty to hide this leak indicator entirely**, even if an entity is set. | — |
| `kitchen_leak_entity` | `string` (entity id) | ❌ | Second `binary_sensor` leak/moisture sensor. | none |
| `kitchen_label` | `string` | ❌ | Display label for the second leak sensor. **Leave empty to hide this leak indicator entirely**, even if an entity is set. | — |
| `text_dry` | `string` | ❌ | Text shown on a leak indicator when the corresponding sensor is off (dry). | localized `"СУХО"` / `"DRY"` etc. |
| `text_leak` | `string` | ❌ | Text shown on a leak indicator when the corresponding sensor is on (leak). | localized `"ПРОТІЧКА"` / `"LEAK"` etc. |
| `btn_open` | `string` | ❌ | Label for the open action / state. | localized `"ВІДКРИТИ"` / `"OPEN"` etc. |
| `btn_close` | `string` | ❌ | Label for the close action / state. | localized `"ПЕРЕКРИТИ"` / `"CLOSE"` etc. |
| `toggle_lock_ms` | `number` (milliseconds, 500–120000) | ❌ | How long the card shows the transitional "opening…/closing…" state (and blocks re-tapping) after you toggle the valve. Set this to roughly how long your physical actuator takes to fully open/close. | `8000` (8 seconds) |
| `auto_toggle_duration` | `boolean` | ❌ | If `true`, the card automatically measures how long your actuator actually takes to reach the target state (using `valve_state_entity` or `switch_entity`) and remembers that duration per-browser for next time, instead of using a fixed `toggle_lock_ms`. | `false` |

> Both leak sensors are fully independent and optional — set only one, both, or neither. A leak indicator is only rendered if **both** its entity and its label are set (an empty label hides it even with an entity configured, which is handy for temporarily disabling a zone without deleting the entity reference).

## Toggle animation timing

Real valve actuators aren't instant — there's a mechanical delay between issuing the command and the valve physically finishing its move. The card models this with a transitional state:

- **Manual**: set `toggle_lock_ms` to however many milliseconds your actuator needs (measure it once with a stopwatch).
- **Automatic**: set `auto_toggle_duration: true` and the card will watch `valve_state_entity` (or `switch_entity` if you didn't set one) after each toggle, record how long it actually took to reach the new state, and reuse that measured value (persisted in the browser's `localStorage`, keyed per `switch_entity`) for all future toggles — so it self-calibrates over time.

## Localization

Set `language: uk`, `language: ru` or `language: en` (or pick it from the dropdown in the visual editor) to switch every built-in string — button labels, DRY/LEAK text, and the descriptive status sentences under the valve state (e.g. *"System active, pressure stable"* / *"Leak detected: Kitchen!"*). Any of `text_dry`, `text_leak`, `btn_open`, `btn_close` and `name` you set explicitly will override the localized default for that field only.

## Full YAML example

```yaml
type: custom:water-valve-card
language: en
name: Water Shut-off Valve
switch_entity: switch.water_valve
valve_state_entity: sensor.valve_state
kran_battery_entity: sensor.kran_battery
bathroom_leak_entity: binary_sensor.leak_bathroom
bathroom_label: Bathroom
kitchen_leak_entity: binary_sensor.leak_kitchen
kitchen_label: Kitchen
text_dry: DRY
text_leak: LEAK!
btn_open: OPEN
btn_close: SHUT OFF
toggle_lock_ms: 6000
auto_toggle_duration: false
```

## Minimal YAML example

```yaml
type: custom:water-valve-card
switch_entity: switch.water_valve
```

## How the card behaves

- **Tap** the card body to toggle the valve. While the actuator is moving (per `toggle_lock_ms` / auto-measured duration), the card shows an "opening…"/"closing…" state and ignores further taps to avoid conflicting commands.
- The **left pipe** (supply side) is always shown filled with flowing water; the **right pipe** (output side) fills or empties depending on whether the valve is open or closed.
- If **any** configured leak sensor turns on, the whole card switches to an emergency visual state: red glowing/pulsing border, animated leak drops inside the pipes, and the shut-off button pulses to draw attention. If **both** leak sensors are triggered simultaneously, the status text reflects that explicitly.
- The **battery indicator** shows the numeric value from `kran_battery_entity` with a small level bar; it's hidden entirely if you don't configure a battery entity.

## Changelog

### v4.1.0

- **Fixed:** toggling a `valve`-domain entity called the wrong services (`valve.open`/`valve.close`, which don't exist) — now correctly calls `valve.open_valve`/`valve.close_valve`. `switch`-domain entities were never affected.
- **Fixed:** if the card was detached from the DOM mid-toggle (e.g. you switched dashboard tabs while the valve was opening/closing), it could get permanently stuck showing "opening…/closing…" until a hard page reload. The card now resets and re-renders from the real entity state when reattached.
- **Fixed:** `text_dry`, `text_leak`, `btn_open` and `btn_close` were accepted in the config but silently ignored by the renderer (it always used the localized text instead). They now correctly override the localized defaults, and are also exposed in the visual editor.
- **Changed:** live preview thumbnails are enabled again in the card picker (previously disabled defensively; the card's empty/unconfigured state was already safe to render).
- **Changed:** `name` and the valve entity are now marked as required fields in the visual editor.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Card doesn't appear when searching "Water Valve" in **Add card** | The JavaScript resource isn't loaded. Check **Settings → Dashboards → Resources** for `water-valve-card.js` (type must be **JavaScript Module**), then hard-refresh (**Ctrl+F5**). |
| Browser console doesn't show a `WATER-VALVE-CARD` / version log line | The old cached file is still being served. Clear the browser cache, bump the resource URL with a `?v=...` query string, or remove and re-add the resource. |
| Card shows a config error about a missing entity | `switch_entity` isn't set — it's the only required field. |
| A leak indicator doesn't show even though I set the entity | Make sure you also set the matching `*_label` field — a leak indicator only renders when **both** its entity and label are present. |
| Leak indicator doesn't visually flip to LEAK | Confirm the `binary_sensor` actually reports state `on` (not `unavailable`/`unknown`) — moisture/problem `device_class` sensors work best. |
| Valve toggles but the card gets "stuck" showing opening/closing | `toggle_lock_ms` is probably shorter/longer than your actuator's real travel time — either adjust it manually or enable `auto_toggle_duration`. |
| Old manual install conflicts with a new HACS install | Remove the old `/local/water-valve-card.js` resource entry (manual install) if you switch to installing via HACS, to avoid two versions being registered. |

## Versioning

This project follows `MAJOR.MINOR.PATCH`. See the [Releases](https://github.com/kdinya/smart-water-valve/releases) page for the changelog of each version.

## License

MIT — see [LICENSE](LICENSE).

---

Made with ❤️ for the Home Assistant community.
