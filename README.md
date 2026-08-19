# Water Valve Card

Home Assistant Lovelace card. **On install/update the integration registers the correct Lovelace resource automatically** (versioned URL).

## Install

1. **HACS → Integrations** → Custom repositories  
   `https://github.com/kdinya/smart-water-valve` → **Integration**
2. Download **Water Valve Card**
3. **Restart Home Assistant**
4. **Settings → Devices & services → Add integration → Water Valve Card**
5. Hard refresh browser (**Ctrl+F5**)

### What happens automatically

- JS is served from `/smart_water_valve/water-valve-card.js`
- Lovelace resource is created/updated to  
  `/smart_water_valve/water-valve-card.js?v=3.6.0`
- Conflicting `/local/water-valve-card.js` resources are **removed**
- After HACS update + restart, the resource URL version changes so the browser loads the new file

### First time after old manual install

Restart HA once so the integration can delete the old `/local/` resource. Then Ctrl+F5.

## Add card

Dashboard → Add card → **Water Valve Card**

```yaml
type: custom:water-valve-card
language: uk
name: Smart Water Valve
```

Visual editor: language, valve entity, optional leaks + names, animation timing.

## Version

**3.6.0**
