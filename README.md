# Water Valve Card

A Lovelace card for Home Assistant that controls a water valve (or switch) with a realistic pipe animation, optional leak sensors, multi-language UI, and configurable actuator timing.

**No integration / no device setup required.** Configure everything on the card itself.

---

## Features

- Visual water-pipe animation while the valve opens or closes
- Control any `switch` or `valve` entity
- Optional separate **state sensor** (e.g. `open` / `closed` / `відкрито`)
- Up to **two optional leak sensors** (`binary_sensor`)
- Custom names for leak sensors (if name is empty, the sensor is hidden)
- **Languages:** Ukrainian (`uk`), Russian (`ru`), English (`en`)
- Manual animation duration (milliseconds)
- **Auto-measure mode:** the card learns how long your actuator takes to travel end-to-end and stores it in the browser

---

## Installation (HACS)

1. Open **HACS → Frontend**
2. Menu **⋮ → Custom repositories**
3. Add:
   - Repository: `https://github.com/kdinya/smart-water-valve`
   - Category: **Lovelace**
4. Find **Water Valve Card** → **Download**
5. Reload the frontend (Ctrl+F5 / Cmd+Shift+R)

### Manual installation

1. Download `water-valve-card.js` from the [latest release](https://github.com/kdinya/smart-water-valve/releases)
2. Place it in `/config/www/water-valve-card.js`
3. **Settings → Dashboards → ⋮ → Resources → Add resource**
   - URL: `/local/water-valve-card.js`
   - Type: **JavaScript Module**
4. Reload the frontend

---

## Adding the card

1. Edit your dashboard → **Add card**
2. Search for **Water Valve Card**
3. Use the configuration form (see below)

By default the template has **no entities pre-filled**. You select everything yourself.

---

## Configuration form (top to bottom)

### 1. Language / Мова / Язык

First field on the form. Options:

| Code | Language |
|------|----------|
| `uk` | Ukrainian |
| `ru` | Russian |
| `en` | English |

All on-card labels change: OPEN / CLOSED, button text, leak text, status messages, etc.

### 2. Card name

Title shown on the card (e.g. `Water valve`, `Main shutoff`).

### 3. Valve entity (required)

Entity that receives open/close commands:

- `switch.*` → services `switch.turn_on` / `switch.turn_off`
- `valve.*` → services `valve.open` / `valve.close`

Example: `switch.kran`

### 4. Valve state sensor (optional)

If your device reports position on a **separate sensor** (not on the switch itself), select it here.

Examples of supported “open” values:

`on`, `open`, `opened`, `відкрито`, `открыто`, `відчинено`

Example: `sensor.kran_valve_state`

If omitted, the card uses the switch/valve entity state.

### 5–6. Leak sensor 1 (optional)

- **Entity** — `binary_sensor` (state `on` = leak)
- **Name** — custom label (e.g. `Bathroom`, `Laundry`)

**Important:** the sensor is shown **only if both entity and name are set**.  
Empty name → sensor block is hidden.

### 7–8. Leak sensor 2 (optional)

Same rules as sensor 1.

Display logic:

| Sensors configured | Result on card |
|--------------------|----------------|
| 0 | No leak blocks |
| 1 | One block |
| 2 | Two blocks |

### 9. Battery sensor (optional)

Numeric `sensor` (percentage). Hidden if not set.

### 10. Valve animation time (ms)

How long the open/close animation and button lock last.

Default: `8000` (8 seconds).

Match this to your real actuator travel time for the best look.

### 11. Auto-measure animation time

When enabled, the card **measures** how long it takes for the valve state to reach the target after you press the button, then stores that value in the browser (`localStorage`) per valve entity.

- Useful when you do not know the exact travel time
- After a few toggles, animation timing should feel natural
- Manual “Animation time (ms)” is used as fallback until a measurement is saved
- Measurements are kept in this browser only (not synced to YAML)

---

## Example YAML

### Minimal

```yaml
type: custom:water-valve-card
language: en
name: Water valve
switch_entity: switch.kran
```

### Full example

```yaml
type: custom:water-valve-card
language: uk
name: Водяний кран
switch_entity: switch.kran
valve_state_entity: sensor.kran_valve_state
bathroom_leak_entity: binary_sensor.datchik_ppotiechki_vanna_water_leak
bathroom_label: Ванна
kitchen_leak_entity: binary_sensor.datchik_ppotiechki_kukhnia_water_leak
kitchen_label: Кухня
kran_battery_entity: sensor.kran_battery
toggle_lock_ms: 8000
auto_toggle_duration: true
```

### English with one leak sensor

```yaml
type: custom:water-valve-card
language: en
name: Main shutoff
switch_entity: switch.water_main
valve_state_entity: sensor.water_main_state
bathroom_leak_entity: binary_sensor.basement_leak
bathroom_label: Basement
toggle_lock_ms: 10000
auto_toggle_duration: true
```

---

## Options reference

| Option | Required | Type | Description |
|--------|----------|------|-------------|
| `language` | no | `uk` / `ru` / `en` | UI language (default `en` in stub) |
| `name` | no | string | Card title |
| `switch_entity` | **yes** | entity | Valve control entity |
| `valve_state_entity` | no | entity | Position/state sensor |
| `bathroom_leak_entity` | no | entity | Leak sensor 1 |
| `bathroom_label` | no | string | Name for sensor 1 (required to show it) |
| `kitchen_leak_entity` | no | entity | Leak sensor 2 |
| `kitchen_label` | no | string | Name for sensor 2 (required to show it) |
| `kran_battery_entity` | no | entity | Battery % sensor |
| `toggle_lock_ms` | no | number | Animation / lock duration in ms |
| `auto_toggle_duration` | no | boolean | Learn duration automatically |

---

## Troubleshooting

**Card does not appear in “Add card”**  
- Confirm the resource is loaded (HACS download + hard refresh)  
- Resource URL must be a JavaScript module

**Buttons do nothing**  
- Check `switch_entity` in Developer Tools → States  
- Test `switch.turn_on` / `turn_off` (or `valve.open` / `close`) manually

**State is wrong**  
- Set `valve_state_entity` if position is reported separately  
- Ensure state values match supported open/closed texts

**Leak blocks missing**  
- Both **entity and name** must be filled for each sensor

**Animation too fast / too slow**  
- Adjust `toggle_lock_ms`, or enable **Auto-measure** and toggle the valve a few times

---

## Version

**3.2.0**

## License

See repository `LICENSE` if present; otherwise treat as personal project software distributed via GitHub releases.
