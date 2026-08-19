# Water Valve Card

Lovelace card for controlling a water valve with optional leak sensors.

**Install once via HACS — the card JS is registered automatically. No copying to `/local/`.**

## Install (recommended)

1. **HACS → Integrations** (not Frontend)
2. **⋮ → Custom repositories**
   - URL: `https://github.com/kdinya/smart-water-valve`
   - Category: **Integration**
3. Download **Water Valve Card**
4. **Restart Home Assistant**
5. Hard refresh the browser (**Ctrl+F5**)

The integration only loads the card. It does **not** create devices.

### Remove old manual resource (important)

If you previously used `/local/water-valve-card.js`:

1. **Settings → Dashboards → Resources**
2. Delete `/local/water-valve-card.js`
3. Restart HA → Ctrl+F5

The card is now served from: `/smart_water_valve/water-valve-card.js`

## Add the card

Dashboard → Add card → **Water Valve Card**

Default config (no entities):

```yaml
type: custom:water-valve-card
language: uk
name: Smart Water Valve
```

### Visual editor

- Language: uk / ru / en  
- Valve entity (required)  
- Optional state sensor  
- Up to 2 leak sensors + custom names (both needed to show)  
- Battery (optional)  
- Animation duration (ms) + auto-measure  

## Version

**3.4.0**
