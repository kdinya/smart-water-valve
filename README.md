# Water Valve Card

Pure **Lovelace** custom card for Home Assistant.

## Install (HACS Frontend)

1. **HACS → Frontend** (not Integrations)
2. ⋮ → Custom repositories  
   - URL: `https://github.com/kdinya/smart-water-valve`  
   - Category: **Lovelace**
3. Download **Water Valve Card**
4. Hard refresh: **Ctrl+F5**

HACS adds the resource automatically. You do **not** need `/local/` or an integration.

### Clean up old installs

- Remove resource `/local/water-valve-card.js` if present  
- Remove integration **Water Valve Card** / `smart_water_valve` if you added it earlier  
- Restart HA once, then Ctrl+F5  

Console must show: `WATER-VALVE-CARD 4.0.0`

## Add the card

Dashboard → **Add card** → search **Water Valve Card**

Default template (no entities):

```yaml
type: custom:water-valve-card
language: uk
name: Smart Water Valve
```

Then use the **visual editor** to pick the valve and optional leak sensors.

## Version

**4.0.0** — Lovelace-only (HACS Frontend)
