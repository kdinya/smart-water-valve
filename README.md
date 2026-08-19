# Water Valve Card

Lovelace card for a water valve. **Install via HACS — no manual file copy to `/local/`.**

## Install

1. **HACS → Integrations**
2. Custom repositories → `https://github.com/kdinya/smart-water-valve` → **Integration**
3. Download **Water Valve Card**
4. **Restart Home Assistant**
5. **Settings → Devices & services → Add integration → Water Valve Card** → Submit  
   (only enables the card; no entities to choose)
6. Browser **Ctrl+F5**
7. Dashboard → Add card → **Water Valve Card**

### Remove old `/local/` setup

1. Settings → Dashboards → Resources → delete `/local/water-valve-card.js`
2. You can delete `config/www/water-valve-card.js` if it exists
3. Restart + Ctrl+F5

## Card defaults

```yaml
type: custom:water-valve-card
language: uk
name: Smart Water Valve
```

No entities until you pick them in the visual editor.

## Version

**3.4.0**
