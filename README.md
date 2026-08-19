# Water Valve Card v3.5.0

## Critical: remove `/local/water-valve-card.js`

If this resource exists, Home Assistant loads the **old** card first. The visual editor will **not** work and default entities will be wrong.

1. **Settings → Dashboards → Resources** → delete `/local/water-valve-card.js`
2. Delete file `config/www/water-valve-card.js` if present
3. Install/update via HACS (below)
4. Restart Home Assistant
5. **Ctrl+F5**
6. Console must show: `WATER-VALVE-CARD 3.5.0`

## Install

1. HACS → **Integrations** → Custom repositories  
   `https://github.com/kdinya/smart-water-valve` → **Integration**
2. Download → **Restart HA**
3. Settings → Devices & services → **Add integration** → Water Valve Card
4. Ctrl+F5
5. Add card → **Water Valve Card** → visual editor

Default YAML:

```yaml
type: custom:water-valve-card
language: uk
name: Smart Water Valve
```
