# 🚰 Water Valve Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/kdinya/smart-water-valve.svg?style=for-the-badge)](https://github.com/kdinya/smart-water-valve/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

A custom Home Assistant Lovelace card for a smart water shut-off valve, with animated flowing water, leak-sensor status, battery and signal-strength indicators, a fully dynamic leak-sensor list, and full UK/RU/EN localization.

Current version: **v5.0.1**. See [Changelog](#changelog) for what's new.

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
  - [Leak sensors](#leak-sensors)
  - [Signal strength sensor](#signal-strength-sensor)
  - [Animation switch](#animation-switch)
  - [Card height on phones vs. tablets/desktop](#card-height-on-phones-vs-tabletsdesktop)
  - [Valve position slider](#valve-position-slider)
  - [Long-press for entity details](#long-press-for-entity-details)
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
- Displays up to **two independently configurable leak sensors**, managed as a proper list in the editor (see [Leak sensors](#leak-sensors)), each shown as DRY/LEAK with an icon that changes color and pulses on leak. **A leak block is shown whenever its entity is set — the name is purely optional/cosmetic.**
- Shows a battery level for the valve actuator, if you provide a battery sensor.
- Shows a **signal-strength indicator** next to the battery indicator, if you provide a signal sensor (Wi-Fi RSSI in dBm, Zigbee LQI, or a plain percentage — auto-detected).
- Lets you set a **minimum** and/or a **fixed height** for the card, useful for masonry/sections dashboard layouts where you want consistent card sizing.
- Has an **animation on/off switch**: turning it off freezes the water/bubble canvas and disables every pulsing/blinking CSS effect (leak glow, sensor shake, button pulse, ripple) — **except** the valve-lever rotation when you open/close it, which always stays animated so the toggle still feels responsive.
- Shows a distinct grey **"Unavailable"** state (separate from "Closed") if the valve entity is missing or reporting `unavailable` — so a disconnected actuator never looks like a safely shut valve.
- Switches into a visual emergency state (red glowing border, pulsing "leak" indicator, animated leak drops, pulsing shut-off button) whenever any configured leak sensor is triggered.
- Automatically resets out of a stuck "opening…/closing…" state if the underlying service call fails, or if the card is reattached to the DOM after being detached mid-toggle (e.g. you switched dashboard tabs while the valve was moving).
- Pauses its water/bubble canvas animation when the browser tab is hidden or the card is scrolled out of view, to save CPU.
- Ships with a **visual (UI) editor** — no YAML required to configure it.
- Fully localized: Ukrainian, Russian and English, switchable per-card.

## Requirements

- Home Assistant with Lovelace (any recent version; developed against `2024.1.0`+).
- An existing `switch` (or `valve`) entity that controls your physical water valve actuator (e.g. from Zigbee2MQTT, Tuya, ESPHome, Z-Wave, etc.). This card is a **frontend visualization only** — it does not talk to hardware directly, it just calls services on entities you already have in Home Assistant.
- Optionally: a `sensor`/`binary_sensor` reporting the valve's real physical state, a battery `sensor`, a signal-strength `sensor`, and up to two `binary_sensor` leak/moisture sensors.

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
7. Open the browser console (F12) and confirm you see a `WATER-VALVE-CARD` / `5.0.1` log line — this confirms the right version is active.

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
3. The card's built-in editor opens, letting you pick every entity and label from dropdowns — no YAML needed. Fields appear in this order: language, name, valve switch, valve state sensor, battery sensor, signal sensor, animation toggle, text/button overrides, toggle animation timing, min/fixed card height — followed by a separate **Leak sensors** list at the bottom of the editor (see [Leak sensors](#leak-sensors)). See the [Configuration reference](#configuration-reference) below for what each field does.

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
| `kran_signal_entity` | `string` (entity id) | ❌ | A `sensor` entity with the signal strength of the valve actuator. Shown next to the battery indicator. Accepts Wi-Fi RSSI in `dBm`, a plain `%` sensor, or a unitless value in the 0–255 range (treated as Zigbee LQI) — see [Signal strength sensor](#signal-strength-sensor). | none (signal indicator hidden) |
| `leak_sensors` | `list` of `{ label, entity }` | ❌ | Up to two leak/moisture sensors, managed via the editor's dynamic list — see [Leak sensors](#leak-sensors). | `[]` (no blocks shown) |
| `animations_enabled` | `boolean` | ❌ | Turns off the water/bubble canvas animation and every pulsing/blinking CSS effect. The valve-lever rotation on open/close is never affected — see [Animation switch](#animation-switch). | `true` |
| `text_dry` | `string` | ❌ | Text shown on a leak indicator when the corresponding sensor is off (dry). | localized `"СУХО"` / `"DRY"` etc. |
| `text_leak` | `string` | ❌ | Text shown on a leak indicator when the corresponding sensor is on (leak). | localized `"ПРОТІЧКА"` / `"LEAK"` etc. |
| `btn_open` | `string` | ❌ | Label for the open action / state. | localized `"ВІДКРИТИ"` / `"OPEN"` etc. |
| `btn_close` | `string` | ❌ | Label for the close action / state. | localized `"ПЕРЕКРИТИ"` / `"CLOSE"` etc. |
| `toggle_lock_ms` | `number` (milliseconds, 500–120000) | ❌ | How long the card shows the transitional "opening…/closing…" state (and disables the button) after you press it. Set this to roughly how long your physical actuator takes to fully open/close. | `8000` (8 seconds) |
| `card_min_height` | `number` (px) | ❌ | Minimum height for the card. On phones (viewport narrower than 600px) the card's height is always set to this value directly — see [Card height on phones vs. tablets/desktop](#card-height-on-phones-vs-tabletsdesktop). `0` means "no minimum". | `0` (auto) |
| `card_height` | `number` (px) | ❌ | Fixed ("current") height for the card, used on tablets/desktop (viewport 600px or wider). `0` means "auto height". | `0` (auto) |
| `valve_vertical_offset` | `number` (%, −50..50) | ❌ | Vertical position of the valve + pipes graphic within its section, as a percentage offset from centered. Set via the **slider with −/+ buttons** in the visual editor. | `0` (centered) |

### Leak sensors

As of v5.0.0, leak sensors are a proper list (`leak_sensors: [{ label, entity }, ...]`) instead of two hardcoded fields. In the visual editor, this shows up as its own **"Leak sensors"** section below the main form: a **"+ Додати датчик протічки" / "+ Add leak sensor"** button adds a name + entity-picker row, with a **✕** button on each row to remove it.

The card itself still only has **two** leak-sensor blocks in its layout, so the editor currently caps the list at 2 entries — but the underlying config format has no hard limit. Raising the on-card limit later is a small change (`MAX_LEAK_SENSORS` in `water-valve-card.js`) plus adding matching blocks to the card's template; the data model doesn't need to change.

Each block is controlled **only by its `entity` field**. If the entity is set, the block is shown — with a name if `label` is set, or without one if it's left empty. If the entity is empty, the block doesn't appear at all, regardless of the label.

```yaml
leak_sensors:
  - label: Bathroom
    entity: binary_sensor.leak_bathroom
  - label: Kitchen
    entity: binary_sensor.leak_kitchen
```

**Upgrading from before v5.0.0:** if your existing config still has `bathroom_label` / `bathroom_leak_entity` / `kitchen_label` / `kitchen_leak_entity` and no `leak_sensors` yet, the card automatically migrates them into `leak_sensors` the first time it loads — nothing is lost, and you don't need to touch your dashboard YAML by hand. The old fields are dropped the next time you save the card from the visual editor.

### Signal strength sensor

`kran_signal_entity` accepts whatever numeric signal sensor your actuator exposes, and the card normalizes it to a 0–100% bar automatically:

- **`dBm`** (typical Wi-Fi RSSI, e.g. an ESPHome `wifi_signal` sensor) — mapped from roughly `-100dBm` (0%) to `-50dBm` (100%).
- **`%`** — used as-is.
- **Unitless, 0–255** — treated as Zigbee LQI (link quality) and scaled to a percentage.

### Animation switch

`animations_enabled: false` freezes the water/bubble canvas (it still redraws once to reflect the current open/closed level, it just stops animating continuously) and disables every CSS `@keyframes` effect on the card — the leak border glow, the status dot pulse/blink, the leak-sensor shake, the shut-off button pulse, and the tap ripple. It deliberately does **not** touch the valve-lever's rotation transition when you open or close it — that's a CSS `transition`, not an `animation`, so the toggle still feels responsive with everything else turned off. Useful on low-powered dashboard hardware (old tablets, kiosk Pis) where 60fps canvas rendering is unnecessary overhead.

### Card height on phones vs. tablets/desktop

`card_min_height` and `card_height` behave differently depending on the viewport:

- **Phones (viewport narrower than 600px):** the card's height is always set to `card_min_height`, if you've configured one. This keeps the card compact and consistent on a phone screen regardless of what `card_height` is set to.
- **Tablets and desktop (viewport 600px or wider):** the card's height is set to `card_height`, if you've configured one — falling back to `card_min_height`, then to automatic sizing, if `card_height` isn't set.

Either way, the header, status row, and the sensor/button row at the bottom never get clipped by `overflow: hidden` — only the valve/pipes graphic in the middle shrinks or grows to fill whatever space is left, and the sensor/button row always stays aligned to the card's bottom edge.

### Valve position slider

The visual editor has a **"Valve + pipes position"** slider (with **−**/**+** buttons alongside it) that lets you nudge the valve-and-pipes graphic up or down within its section, as a percentage offset from centered (`valve_vertical_offset`, −50% to +50%). Useful if you've set a short `card_min_height`/`card_height` and want the graphic to sit closer to the top or bottom instead of dead-center.

### Long-press for entity details

Holding down (~500ms) on the **valve + pipes graphic** opens that entity's Home Assistant more-info dialog — the same gesture also works on the battery indicator, the signal indicator, and each leak-sensor block, each opening its own entity's dialog. **The open/close button itself does not have this behavior** — holding it does nothing extra, only a normal tap toggles the valve, so there's no risk of accidentally opening a dialog while trying to operate the valve quickly.

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
kran_signal_entity: sensor.kran_wifi_signal
leak_sensors:
  - label: Bathroom
    entity: binary_sensor.leak_bathroom
  - label: Kitchen
    entity: binary_sensor.leak_kitchen
animations_enabled: true
text_dry: DRY
text_leak: LEAK!
btn_open: OPEN
btn_close: SHUT OFF
toggle_lock_ms: 6000
card_min_height: 260
valve_vertical_offset: -10
```

## Minimal YAML example

```yaml
type: custom:water-valve-card
switch_entity: switch.water_valve
```

## How the card behaves

- **Press the open/close button** to toggle the valve — tapping the rest of the card does nothing. While the actuator is moving (per `toggle_lock_ms`), the button shows an "opening…"/"closing…" state and is disabled to avoid conflicting commands.
- **Hold (long-press, ~500ms)** the action button, either leak-sensor block, or the battery indicator to open that entity's more-info dialog. A quick tap still just does its normal thing.
- The **left pipe** (supply side) is always shown filled with flowing water; the **right pipe** (output side) fills or empties depending on whether the valve is open or closed.
- If the valve entity is missing or reports `unavailable`, the card shows a distinct grey **"Unavailable"** state instead of implying the valve is safely closed, and the button is disabled (there's nothing useful to call a service on).
- When the valve is closed, the card shows the date/time it closed — regardless of what closed it (this card, another dashboard, an automation). It disappears again as soon as the valve is open.
- If **any** configured leak sensor turns on, the whole card switches to an emergency visual state: red glowing/pulsing border, animated leak drops inside the pipes, and the shut-off button pulses to draw attention. If **both** leak sensors are triggered simultaneously, the status text reflects that explicitly.
- The **battery indicator** shows the numeric value from `kran_battery_entity` with a small level bar; it's hidden entirely if you don't configure a battery entity.
- The **signal-strength indicator** sits right next to the battery indicator and shows a 4-bar strength icon plus a percentage, normalized from `kran_signal_entity`; it's hidden entirely if you don't configure a signal entity.
- The water/bubble canvas animation automatically pauses when the browser tab is hidden, the card scrolls out of view, or less than 30% of it is visible, and resumes once it's meaningfully on-screen again — and stays off entirely if you've set `animations_enabled: false`.

## Changelog

### v5.0.1

- **Fixed:** leak sensor rows in the editor were cramped into a narrow flex row where the name field was barely visible. They're now full-width stacked blocks with explicit left-aligned "Name" / "Entity" field labels.
- **Fixed:** the sensor/button row could get clipped by the card's `overflow: hidden` when a short `card_min_height`/`card_height` was configured. The card and its content are now a flex column, the valve/pipes graphic is the part that shrinks first, and the sensor/button row always stays visible, pinned to the bottom edge.
- **Changed:** `card_min_height`/`card_height` are now viewport-aware — phones (narrower than 600px) always use `card_min_height`; tablets/desktop (600px+) use `card_height`, falling back to `card_min_height`. See [Card height on phones vs. tablets/desktop](#card-height-on-phones-vs-tabletsdesktop).
- **Added:** `valve_vertical_offset` config option and a matching slider (with −/+ buttons) in the visual editor, to nudge the valve + pipes graphic up or down within its section, as a percentage from centered.
- **Changed:** long-press-for-details moved from the open/close button to the valve + pipes graphic itself. The button no longer has a hold behavior — only a plain tap, so there's no risk of it firing accidentally while operating the valve.

### v5.0.0

- **Added:** a signal-strength indicator next to the battery indicator (`kran_signal_entity`), auto-normalizing Wi-Fi `dBm`, plain `%`, or unitless Zigbee-LQI-style (0–255) sensors into a 4-bar strength icon.
- **Added:** an animation on/off switch (`animations_enabled`). Turning it off freezes the water/bubble canvas and disables every pulsing/blinking CSS effect on the card, while deliberately leaving the valve-lever's own open/close rotation animated.
- **Changed:** leak sensors are now a proper list (`leak_sensors: [{ label, entity }, ...]`) instead of two hardcoded `bathroom_*`/`kitchen_*` fields. The visual editor gained a dedicated **"Leak sensors"** section with a **"+ Add leak sensor"** button and a **✕** remove button per row, currently capped at 2 entries to match the card's fixed layout — the config format itself has no hard limit.
- **Added:** automatic one-time migration — if your config still has the old `bathroom_leak_entity`/`kitchen_leak_entity` (etc.) fields and no `leak_sensors` yet, they're picked up as the first entries of the new list on load, so upgrading doesn't lose your existing setup. The old fields are cleaned up the next time you save from the visual editor.
- **Added:** `card_min_height` and `card_height` config options to control the card's height explicitly — handy for masonry/sections dashboard layouts.

### v4.5.0

- **Added:** long-press (~500ms hold) on the action button, either leak-sensor block, or the battery indicator now opens that entity's Home Assistant more-info dialog. A regular tap/click still just does its normal thing (toggle, or nothing).
- **Added:** when the valve becomes closed — from this card, another dashboard, or an automation, it doesn't matter — the card shows the date/time it closed. The moment it's seen open again, the timestamp is cleared. Persisted per-entity, so it survives a page reload.
- **Fixed:** the "glass pipe" outline and its reflections don't depend on time at all, yet were being fully recomputed (gradients, strokes) on every single animation frame. They're now cached on an offscreen canvas and only redrawn when the card is resized.
- **Changed:** the card now needs to be at least 30% visible in the viewport (not just barely on-screen) before its animation resumes — mostly-scrolled-off cards stay paused.
- **Changed:** the visual editor's field labels now follow the selected `language` (Ukrainian / Russian / English) instead of always being in English, and update immediately when you switch the language dropdown — no need to leave and reopen the editor.

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
| A leak block doesn't show even though I set the entity | Double-check the entity id is spelled correctly — the block always shows once a valid `entity` is set on that `leak_sensors` row, with or without a label. |
| The "+ Add leak sensor" button is greyed out | You've already reached the 2-sensor limit the card currently supports — remove one first, or see [Leak sensors](#leak-sensors) for how to raise the limit in the code. |
| My old `bathroom_leak_entity`/`kitchen_leak_entity` config disappeared after upgrading | It shouldn't — the card migrates those fields into `leak_sensors` automatically on load (see [Leak sensors](#leak-sensors)). If something still looks wrong, open the card in the visual editor and check the **Leak sensors** section; saving from there will persist the migrated config to your dashboard YAML. |
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
