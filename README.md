# Water Valve Card

Home Assistant custom **integration** that registers a Lovelace card automatically.

## HACS install (important)

| Field | Value |
|--------|--------|
| Repository | `https://github.com/kdinya/smart-water-valve` |
| **Category** | **Integration** (not Frontend / Plugin) |

If HACS says `Repository structure is not compliant` you selected **Plugin**. Use **Integration**.

### Steps

1. HACS → Integrations → ⋮ → Custom repositories → URL above → **Integration**
2. Download **Water Valve Card**
3. **Restart Home Assistant**
4. Settings → Devices & services → Add integration → **Water Valve Card**
5. Browser **Ctrl+F5**
6. Console must show: `WATER-VALVE-CARD 3.6.1`

### Resource

After restart the card is loaded from:

`/smart_water_valve/water-valve-card.js?v=3.6.1`

If you use **YAML** lovelace resources, remove any line with `/local/water-valve-card.js` manually (storage mode removes it automatically).

## Card

```yaml
type: custom:water-valve-card
language: uk
name: Smart Water Valve
```

Visual editor: language, valve, optional leak sensors + names, animation timing.

## Version

**3.6.1**
