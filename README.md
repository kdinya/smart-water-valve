# 🚰 Water Valve Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/kdinya/smart-water-valve.svg?style=for-the-badge)](https://github.com/kdinya/smart-water-valve/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

A custom Home Assistant Lovelace card for a smart water shut-off valve, with animated flowing water, leak-sensor status, battery and signal-strength indicators, a fully dynamic leak-sensor list (up to 4), independent valve/pipes scale controls, and full UK/RU/EN localization.

Current version: **v5.0.6**. See [Changelog](#changelog) for what's new.

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
- Displays up to **four independently configurable leak sensors**, managed as a proper list in the editor (see [Leak sensors](#leak-sensors)), each shown as a square DRY/LEAK block with an icon that changes color and pulses on leak. **A leak block is shown whenever its entity is set — the name is purely optional/cosmetic.**
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
7. Open the browser console (F12) and confirm you see a `WATER-VALVE-CARD` / `5.0.2` log line — this confirms the right version is active.

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
3. The card's built-in editor opens, letting you pick every entity and label from dropdowns — no YAML needed. Fields appear in this order: language, name, valve switch, valve state sensor, battery sensor, signal sensor, animation toggle, text/button overrides, toggle animation timing, min/fixed card height — followed by a **position and scale** section (5 sliders: valve+pipes vertical offset, valve scale on phone/tablet, pipes scale on phone/tablet) and a separate **Leak sensors** list at the bottom (see [Leak sensors](#leak-sensors)). See the [Configuration reference](#configuration-reference) below for what each field does.

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
| `leak_sensors` | `list` of `{ label, entity }` | ❌ | Up to four leak/moisture sensors, managed via the editor's dynamic list — see [Leak sensors](#leak-sensors). | `[]` (no blocks shown) |
| `disable_animations` | `boolean` | ❌ | Turns off the water/bubble canvas animation and every pulsing/blinking CSS effect. The valve-lever rotation on open/close is never affected — see [Animation switch](#animation-switch). **`true` = animations off** — the checkbox in the editor is titled "Disable animations", so the label and the behavior finally point the same direction (see [Changelog](#changelog) v5.0.3). | `false` (animations on) |
| `text_dry` | `string` | ❌ | Text shown on a leak indicator when the corresponding sensor is off (dry). | localized `"СУХО"` / `"DRY"` etc. |
| `text_leak` | `string` | ❌ | Text shown on a leak indicator when the corresponding sensor is on (leak). | localized `"ПРОТІЧКА"` / `"LEAK"` etc. |
| `btn_open` | `string` | ❌ | Label for the open action / state (resting state, valve open). | localized `"ВІДКРИТИ"` / `"OPEN"` etc. |
| `btn_close` | `string` | ❌ | Label for the close action / state (resting state, valve closed). | localized `"ПЕРЕКРИТИ"` / `"CLOSE"` etc. |
| `btn_opening` | `string` | ❌ | *(v5.0.4)* Button text shown **only while the valve is actively opening** (the `toggle_lock_ms` window), instead of the localized "opening…" text. Separate from `btn_open`, which is the resting "tap to open" label. | localized `"ВІДКРИВАЄТЬСЯ..."` / `"OPENING..."` etc. |
| `btn_closing` | `string` | ❌ | *(v5.0.4)* Button text shown **only while the valve is actively closing**. Separate from `btn_close`. | localized `"ЗАКРИВАЄТЬСЯ..."` / `"CLOSING..."` etc. |
| `toggle_lock_ms` | `number` (milliseconds, 500–120000) | ❌ | How long the card shows the transitional "opening…/closing…" state (and disables the button) after you press it. Set this to roughly how long your physical actuator takes to fully open/close. | `8000` (8 seconds) |
| `card_min_height` | `number` (px) | ❌ | Minimum height for the card. On phones (viewport narrower than 600px) the card's height is always set to this value directly — see [Card height on phones vs. tablets/desktop](#card-height-on-phones-vs-tabletsdesktop). `0` means "no minimum". | `0` (auto) |
| `card_height` | `number` (px) | ❌ | Fixed ("current") height for the card, used on tablets/desktop (viewport 600px or wider). `0` means "auto height". | `0` (auto) |
| `valve_vertical_offset` | `number` (%, −50..50) | ❌ | Vertical position of the valve + pipes graphic within its section, as a percentage offset from centered. Set via a **slider with −/+ buttons** in the visual editor. | `0` (centered) |
| `valve_scale_mobile` | `number` (0.5–2.5) | ❌ | Max-size scale multiplier for the **valve graphic only**, used on phones (viewport narrower than 600px). | `1.15` |
| `valve_scale_tablet` | `number` (0.5–2.5) | ❌ | Max-size scale multiplier for the **valve graphic only**, used on tablets/desktop (viewport 600px or wider). | `1.15` |
| `pipes_scale_mobile` | `number` (0.5–2.5) | ❌ | Max-size scale multiplier for the **pipes/water canvas only**, used on phones. | `1.15` |
| `pipes_scale_tablet` | `number` (0.5–2.5) | ❌ | Max-size scale multiplier for the **pipes/water canvas only**, used on tablets/desktop. | `1.15` |

### Leak sensors

Leak sensors are a proper list (`leak_sensors: [{ label, entity }, ...]`). In the visual editor, this shows up as its own **"Leak sensors"** section below the main form: a **"+ Додати датчик протічки" / "+ Add leak sensor"** button adds a name + entity-picker row, with a **✕** button on each row to remove it.

The card supports up to **four** leak-sensor blocks, laid out in this fixed order:

1. Left of the open/close button
2. Right of the open/close button
3. Above sensor 1
4. Above sensor 2

The row above (sensors 3/4) is only shown at all once at least one of them has an entity configured — with just 1 or 2 sensors set, the card looks exactly like the original 2-sensor layout. Each block is a **square**, and controlled **only by its `entity` field** — if the entity is set, the block is shown (with a name if `label` is set, or without one if it's left empty); if the entity is empty, the block doesn't appear, regardless of the label. If you remove a sensor in the editor, every sensor after it automatically shifts up into its place (e.g. removing #1 turns the old #2 into the new #1, #3 into #2, and so on) — you never end up with a gap in the middle of the list.

The editor caps the list at 4 entries to match the card's fixed layout — the underlying config format has no hard limit; raising the on-card limit further is a small change (`MAX_LEAK_SENSORS` in `water-valve-card.js`) plus adding matching blocks to the card's template.

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

`disable_animations: true` freezes the water/bubble canvas (it still redraws once to reflect the current open/closed level, it just stops animating continuously) and disables every CSS `@keyframes` effect on the card — the leak border glow, the status dot pulse/blink, the leak-sensor shake, the shut-off button pulse, and the tap ripple. It deliberately does **not** touch the valve-lever's rotation transition when you open or close it — that's a CSS `transition`, not an `animation`, so the toggle still feels responsive with everything else turned off. Useful on low-powered dashboard hardware (old tablets, kiosk Pis) where 60fps canvas rendering is unnecessary overhead.

> **Upgrading from v5.0.2 or earlier:** the old `animations_enabled` field is automatically migrated to `disable_animations` on load (`animations_enabled: false` → `disable_animations: true`, and vice versa) — nothing is lost. It's renamed because the old field's editor label described the opposite of what the checkbox actually did; `disable_animations` reads the same as the checkbox behaves.

### Card height on phones vs. tablets/desktop

`card_min_height` and `card_height` behave differently depending on the viewport:

- **Phones (viewport narrower than 600px):** the card's height is always set to `card_min_height`, if you've configured one. This keeps the card compact and consistent on a phone screen regardless of what `card_height` is set to.
- **Tablets and desktop (viewport 600px or wider):** the card's height is set to `card_height`, if you've configured one — falling back to `card_min_height`, then to automatic sizing, if `card_height` isn't set.

Either way, the header, status row, and the sensor/button row at the bottom never get clipped — only the valve/pipes graphic in the middle grows or shrinks (flexibly) to fill whatever space is left, and the sensor/button row always stays aligned to the card's bottom edge. The valve+pipes graphic itself is layered **above** the button row (not under it), so on very short cards it can visually extend over the buttons instead of ever hiding behind them — use the vertical offset and scale sliders below to fine-tune how much it does that.

### Valve position slider

The visual editor's **position and scale** section has 5 sliders (each with **−**/**+** buttons alongside them), all backed by real per-config numbers and updated live without ever rebuilding the slider itself while you drag — so dragging is smooth, not jerky:

- **Valve + pipes vertical offset** (`valve_vertical_offset`, −50% to +50% from centered) — nudges the whole graphic up or down within its section. Useful if you've set a short `card_min_height`/`card_height` and want the graphic to sit closer to the top or bottom instead of dead-center.
- **Valve scale — phone / tablet-desktop** (`valve_scale_mobile` / `valve_scale_tablet`, 0.5×–2.5×) — max-size scale for the valve graphic only, set independently for narrow (phone) vs. wide (tablet/desktop) viewports.
- **Pipes scale — phone / tablet-desktop** (`pipes_scale_mobile` / `pipes_scale_tablet`, 0.5×–2.5×) — same idea, but for the pipes/water canvas only.

Valve scale and pipes scale are intentionally independent, since you may want the water canvas cropped tighter than the valve body (or vice versa) on a very short card. Keep them equal if you want the valve and pipes to always look visually connected — setting them far apart can visibly separate the valve body from the pipe ends.

### Long-press for entity details

Holding down (~500ms) on the **valve + pipes graphic** (any of the four leak-sensor blocks) opens that entity's Home Assistant more-info dialog — the same gesture also works on the battery indicator and the signal indicator, each opening its own entity's dialog. **The open/close button itself does not have this behavior** — holding it does nothing extra, only a normal tap toggles the valve, so there's no risk of accidentally opening a dialog while trying to operate the valve quickly.

## Toggle animation timing

Real valve actuators aren't instant — there's a mechanical delay between issuing the command and the valve physically finishing its move. The card models this with a transitional state: set `toggle_lock_ms` to roughly how many milliseconds your actuator needs (measure it once with a stopwatch or check your device's documentation). If the underlying service call fails, the card detects that and resets immediately instead of waiting out the full timer.

**Everything animated during the transition is driven off this one setting, and only this setting:**

- The valve-lever's rotation is a CSS transition whose `transition-duration` is set to `toggle_lock_ms` directly — it always takes exactly that long, no more, no less.
- *(v5.0.4)* The water level inside the pipes reaches ~99% of its new level (full for the output pipe on open, empty on close) within that same `toggle_lock_ms` window. Before v5.0.4 the water used a fixed animation speed regardless of `toggle_lock_ms`, so at the 8-second default the water could finish draining/filling several seconds before the lever visually finished turning — they now always finish together, whatever you set `toggle_lock_ms` to.
- The button's disabled "opening…/closing…" state (optionally customized via `btn_opening`/`btn_closing`) lasts for the same window, then re-enables.

If you change `toggle_lock_ms` live in the editor, both the lever and the water speed pick up the new value immediately — no need to reopen the card.

## Localization

Set `language: uk`, `language: ru` or `language: en` (or pick it from the dropdown in the visual editor) to switch every built-in string — button labels, DRY/LEAK text, and the descriptive status sentences under the valve state (e.g. *"System active, pressure stable"* / *"Leak detected: Kitchen!"* / *"Device is unavailable — check the connection"*). Any of `text_dry`, `text_leak`, `btn_open`, `btn_close`, `btn_opening`, `btn_closing` and `name` you set explicitly will override the localized default for that field only.

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
disable_animations: false
text_dry: DRY
text_leak: LEAK!
btn_open: OPEN
btn_close: SHUT OFF
btn_opening: Opening, please wait…
btn_closing: Shutting off…
toggle_lock_ms: 6000
card_min_height: 260
card_height: 340
valve_vertical_offset: -10
valve_scale_mobile: 1
valve_scale_tablet: 1.15
pipes_scale_mobile: 1
pipes_scale_tablet: 1.15
```

## Minimal YAML example

```yaml
type: custom:water-valve-card
switch_entity: switch.water_valve
```

## How the card behaves

- **Press the open/close button** to toggle the valve — tapping the rest of the card does nothing. While the actuator is moving (per `toggle_lock_ms`), the button shows an "opening…"/"closing…" state and is disabled to avoid conflicting commands.
- **Hold (long-press, ~500ms)** the valve + pipes graphic, any leak-sensor block, the battery indicator, or the signal indicator to open that entity's more-info dialog. A quick tap still just does its normal thing.
- The **left pipe** (supply side) is always shown filled with flowing water; the **right pipe** (output side) fills or empties depending on whether the valve is open or closed. *(v5.0.4)* The two pipes always meet exactly at the center of the graphic, with no gap — see [Changelog](#changelog) v5.0.4.
- The valve + pipes graphic is layered **above** the sensor/button row, so it's never hidden underneath the buttons — even when its position/scale sliders push it lower or bigger than its section.
- If the valve entity is missing or reports `unavailable`, the card shows a distinct grey **"Unavailable"** state instead of implying the valve is safely closed, and the button is disabled (there's nothing useful to call a service on).
- When the valve is closed, the card shows the date/time it closed — regardless of what closed it (this card, another dashboard, an automation). It disappears again as soon as the valve is open.
- If **any** configured leak sensor turns on, the whole card switches to an emergency visual state: red glowing/pulsing border, animated leak drops inside the pipes, and the shut-off button pulses to draw attention. If **more than one** leak sensor is triggered simultaneously, the status text reflects that explicitly.
- The **battery indicator** shows the numeric value from `kran_battery_entity` with a small level bar; it's hidden entirely if you don't configure a battery entity.
- The **signal-strength indicator** sits right next to the battery indicator and shows a 4-bar strength icon plus a percentage, normalized from `kran_signal_entity`; it's hidden entirely if you don't configure a signal entity.
- The water/bubble canvas animation automatically pauses when the browser tab is hidden, the card scrolls out of view, or less than 30% of it is visible, and resumes once it's meaningfully on-screen again — and stays off entirely if you've set `disable_animations: true`.

## Changelog

### v5.0.6

- **Fixed:** the valve/pipe graphic is now anchored with `position: absolute`, centered on the card's own box (plus the configured vertical-offset slider), completely independent of every other element on the card. Previously it was a flexible flow item, so its actual on-screen position was the sum of everything around it — the header's height, whether the "closed at" line was showing, how many leak sensors were configured — any of which visibly moved the valve when they changed. Now nothing but the offset slider can move it.
- **Changed:** adding a 3rd/4th leak sensor no longer shrinks or pushes up the pipe to make room for the second sensor row. The sensor rows and the action button are now grouped together and pinned to the card's bottom edge on their own, independent of the valve; on a short card they're free to visually overlap onto the pipe graphic instead of squeezing it.
- **Changed:** the "closed at HH:MM" text (only ever shown when the valve is closed) has moved from under the header to directly above the toggle button, centered — it reads better next to the control that reopens the valve than next to the state text at the top.
- **Changed:** switching-time measurement (added in v5.0.5) now keeps only the running *maximum* ever measured per direction — a single slow run can no longer be undercut by a later faster one, so "recommended: at least X ms" only ever holds if X only ever grows.
- **Added:** an "auto-apply the measured maximum" checkbox next to the measured-time note in the editor — when enabled, the manual animation-time field is kept in sync with the measured maximum automatically instead of needing to be copied over by hand.
- **Added:** a "Test toggle (measure now)" button in the editor — toggles the real entity and measures the transition time right from the config screen, without needing to go find the card on a dashboard first.

### v5.0.5

- **Fixed:** the battery/signal indicators in the header were laid out with flex `space-between`, which relies on the state-label next to them shrinking to whatever space is left — but the label had no `min-width:0` and no line-wrap control, so a long single-word state (e.g. `ВІДКРИВАЄТЬСЯ`) could force the row wider than the card, throwing off where the indicators actually landed and making them appear to drift left as the state text changed length. The header is now a CSS grid (`1fr auto`) — the indicators column is always exactly as wide as its own content and flush against the card's right edge, completely independent of the state-label; the label itself is now always a single line (ellipsis on overflow) so it can no longer change the header's height either.
- **Fixed:** the valve/pipe graphic could visibly shift position when the state text changed during a toggle (e.g. "ВІДКРИТО" → "ЗАКРИВАЄТЬСЯ" → "ЗАКРИТО"), because the space above it — the status text and the "closed at" timestamp — changed height depending on which text was showing (1 vs 2 line wrap, and the timestamp line being removed from flow entirely via `display:none` when hidden). Both now reserve constant space regardless of content: the status text always reserves 2 lines' worth of height, and the "closed at" line is hidden via `visibility` instead of `display`, so it keeps its slot in the layout even when blank. The valve, pipe, and buttons no longer move on toggle — only their text/color changes.
- **Fixed:** leak-sensor blocks with 3 or 4 sensors configured (2 stacked rows) could render as oversized squares on wide tablet/desktop cards — since each sensor cell was always exactly `1fr` of the row's grid, a wide card made a very tall square, and two of those stacked routinely didn't fit vertically without visually colliding with the pipe above. Scoped strictly to 3-/4-sensor configs (the verified 2-sensor layout is untouched): sensor blocks now cap their size on phones and switch to horizontal rectangles on tablet/desktop instead of tall squares, the icon and text inside scale up to match (they were capped at a small fixed max size regardless of how big the block itself was), and the pipe section can yield a little more of its minimum height to the sensor rows first if a short `card_height` makes both compete for space.
- **Added:** real switching-time measurement. The card now times how long the actual `switch_entity`/`valve_state_entity` takes to confirm each open/close after a toggle (separately for each direction) and remembers the result. The editor now shows this measured value directly under the manual "Toggle animation time" field, with a recommendation to set that field to at least the measured time — setting it lower is what caused the valve animation to visually reach its end position and then snap back briefly before continuing, since the visual animation was finishing before the real actuator had.

### v5.0.4

- **Fixed:** the "closed at" timestamp (added in v4.5.0) fell back to "just now" whenever there was no cached value yet for the current browser — e.g. the very first time the card ever rendered, or if the valve had already been closed long before this card instance existed. It now reads the entity's own `last_changed` from Home Assistant as the primary source of truth (free, accurate, correct on the very first render), and only uses the browser cache as a same-session memory aid, never to invent a timestamp.
- **Fixed:** enlarging the pipes or using different `valve_scale_*` vs. `pipes_scale_*` values could leave a visible unfilled/empty stretch of pipe between the water and the valve body ("a piece with no water"). The v5.0.3 fix measured the valve graphic's actual on-screen position (`getBoundingClientRect`) each time and used that as the water's boundary — but that measurement is taken in transformed screen-pixel space while the canvas draws in its own untransformed pixel space, so the two could still disagree whenever `valve_scale_*` and `pipes_scale_*` differed. **Reworked from scratch:** the pipe is now always drawn as exactly two halves — a supply half (always full) and an output half (drains to empty as the valve closes) — that meet at a single, always-correct point: the exact horizontal center of the water canvas (`WaterValveCard._pipeSplitX()`), the same point the canvas already scales around. No more measuring the valve at all, so there is no longer any way for the two halves to disagree — they're mathematically the same value by construction, at every zoom level.
- **Fixed:** the water level's fill/drain animation used a fixed speed, completely independent of `toggle_lock_ms` — at the 8-second default it actually finished in roughly 4 seconds, so the valve-lever (which *does* honor `toggle_lock_ms` exactly, via a CSS transition) could still be slowly rotating for several seconds after the pipe had already visually finished draining or filling. The water animation now derives its speed from the same `toggle_lock_ms` value the lever's rotation uses, so both always finish together — see [Toggle animation timing](#toggle-animation-timing).
- **Fixed:** the valve graphic could visually overlap the header text above it, inconsistently, depending on phone orientation — and briefly flash oversized for a frame right after rotating. Root cause: the valve was resized with a CSS `transform: scale()`, which changes how big something *paints* but not the layout space reserved for it; the valve's section only ever reserved space for the *unscaled* graphic, so at the default 1.15× scale (or higher) it always painted outside its box, and by how much depended on which of `valve_scale_mobile`/`valve_scale_tablet` the current `@container` breakpoint picked. The valve now scales by actually changing its rendered **width** (with height following automatically via its aspect ratio) instead of a paint-only transform, so the containing section reserves the correct space up front — no overlap, no rotation flash, identical result in either orientation.
- **Fixed:** leak-sensor blocks (icon/name/state) could get visually clipped on small screens or short `card_min_height` values — the layout used fixed pixel sizes (28px icon, 9px/14px text) that didn't shrink with the block. Each block is now its own CSS container and sizes its icon and text with `clamp()` off its own rendered size, and is laid out tightly (drop icon right at the top, name centered, state right at the bottom) instead of loosely centered as one group.
- **Added:** `btn_opening` / `btn_closing` — optional config fields for button text shown specifically **while the valve is opening/closing**, separate from the resting `btn_open`/`btn_close` labels. Falls back to the existing localized "opening…/closing…" text if left blank.
- **Added:** a small dependency-free unit test suite (`tests/`, `npm test`) covering the config migration, valve-state resolution, and the toggle-timing/pipe-split math touched by this release. See `tests/README.md` for scope and how it loads the card's plain-browser-script class under Node.
- **Note:** an earlier `v5.0.4` GitHub Release was published with this changelog text before the corresponding code was actually merged to `main` — that release pointed at v5.0.3's code with a mismatched description. This has been corrected; the `v5.0.4` tag now points at the commit that actually contains everything listed above.

### v5.0.3

- **Fixed:** the valve/pipes could render at the wrong scale — and appear "stuck" larger — after rotating the phone, especially inside a Home Assistant masonry/grid dashboard. Root cause: the phone/tablet breakpoint used a viewport-width `@media` query, but in a multi-column dashboard the *browser viewport* can cross the 600px threshold on rotation even while the *card's own* rendered width barely changes. Replaced with a CSS **container query** (`@container`, based on the card's own width via `container-type: inline-size` on the card element) so the breakpoint reacts to the card's real size, not the phone's. Also added a `ResizeObserver` that forces an immediate redraw whenever the card's actual size changes (rotation, dashboard column changes, etc.), instead of relying solely on the animation loop to eventually catch up.
- **Fixed:** enlarging the pipes could leave empty gaps between the water and the valve body on either side. The water/pipe boundaries used to be computed from a fixed formula that assumed the valve graphic and the pipes/water canvas were always scaled together — since v5.0.2 lets you scale them independently (`valve_scale_*` vs `pipes_scale_*`), that assumption could be wrong. The card now measures the valve graphic's actual on-screen position and sizes the water to start exactly where the valve visually ends, regardless of the two scales configured.
- **Fixed:** leak-sensor blocks weren't reliably square in some WebViews (notably Android system WebView, used by the HA companion app) — `aspect-ratio` on a `flex: 1` item with `flex-basis: 0` isn't computed consistently everywhere. The sensor/button row now uses CSS Grid (`grid-template-columns: 1fr 2fr 1fr`) instead, which gives each sensor cell a real, stable width to base its 1:1 aspect ratio on.
- **Changed:** renamed `animations_enabled` to **`disable_animations`**, with the checkbox's editor label and its actual behavior now pointing the same direction (`true` = animations off). The old field's label described the opposite of what the checkbox did — turning it *on* actually disabled animations while the label implied the reverse. Old configs are migrated automatically; nothing needs to change by hand.
- **Note:** if another tool (an AI assistant, a script, a cached copy of the repo) reports only seeing up to v4.x, that's a caching issue on that tool's side, not the repository — every release through v5.0.3 is published normally (not a draft, not a pre-release) on `main`. Point it at the [Releases page](https://github.com/kdinya/smart-water-valve/releases) directly, or have it re-fetch `water-valve-card.js` from the `main` branch instead of a cached copy.

### v5.0.2

- **Fixed:** when the valve was closed (lever pointing down), the button row could visually cover part of the valve graphic. The valve + pipes section is now explicitly layered above the sensor/button row, so it always renders on top instead of getting hidden behind it.
- **Fixed:** the valve graphic shrank oddly on short/mobile card heights instead of scaling predictably. Valve size is no longer tied to the available container height at all — it's driven purely by the new scale settings below, so it stays exactly as configured regardless of how much vertical space the card has.
- **Fixed:** dragging the vertical-position slider in the editor felt jerky/stuttery. The slider's DOM element was being rebuilt on every drag tick, which dropped the browser's pointer capture mid-drag; it's now updated in place instead, so dragging is smooth.
- **Added:** `valve_scale_mobile` / `valve_scale_tablet` and `pipes_scale_mobile` / `pipes_scale_tablet` — independent max-size scale controls for the valve graphic and the pipes/water canvas, each split by phone vs. tablet/desktop viewport, each with its own slider + −/+ buttons in the editor.
- **Changed:** leak-sensor blocks are now **square**, and the card supports up to **4** of them instead of 2 — laid out as 1: left of the button, 2: right of the button, 3: above sensor 1, 4: above sensor 2. The extra row is only shown once a 3rd/4th sensor is configured, so existing 2-sensor dashboards look unchanged. Removing a sensor in the editor still automatically shifts the rest up into its place.

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
| The "+ Add leak sensor" button is greyed out | You've already reached the 4-sensor limit the card currently supports — remove one first, or see [Leak sensors](#leak-sensors) for how to raise the limit in the code. |
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
