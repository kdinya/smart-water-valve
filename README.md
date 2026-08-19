# Water Valve Card v3.3.1

Lovelace card for a water valve with optional leak sensors.

## Important if you use `/local/water-valve-card.js`

HACS does **not** update that file. You must replace it manually:

1. Download `water-valve-card.js` from the [latest release](https://github.com/kdinya/smart-water-valve/releases/latest)
2. Copy to `config/www/water-valve-card.js` (overwrite)
3. Hard refresh browser: **Ctrl+F5**
4. In browser console (F12) you must see: `WATER-VALVE-CARD v3.3.1`
5. Delete the old card from the dashboard and add **Water Valve Card** again

### Expected default YAML (no entities)

```yaml
type: custom:water-valve-card
language: uk
name: Smart Water Valve
```

### Resource

**Settings → Dashboards → Resources**

- URL: `/local/water-valve-card.js`
- Type: **JavaScript Module**

## Visual editor fields

1. Language (uk / ru / en)
2. Card name
3. Valve entity (required)
4. Valve state sensor (optional)
5. Leak sensor 1 + name (optional; both required to show)
6. Leak sensor 2 + name (optional; both required to show)
7. Battery sensor (optional)
8. Animation time (ms)
9. Auto-measure animation time

## HACS install

Frontend → Lovelace → `https://github.com/kdinya/smart-water-valve`
