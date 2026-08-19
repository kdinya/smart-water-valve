# 🚰 Water Valve Card

**v2.0.0** — кастомна картка Lovelace для Home Assistant.

## Встановлення через HACS

1. HACS → **Frontend** (не Integrations!)
2. ⋮ → Custom repositories
3. Repository: `https://github.com/kdinya/smart-water-valve`
4. Category: **Lovelace**
5. Download → перезавантаж Frontend (Ctrl+F5)

Якщо оновлення не видно: HACS → ⋮ → **Reload data**, потім онови сторінку.

## Конфігурація картки

```yaml
type: custom:water-valve-card
name: Водяний кран
switch_entity: switch.kran
valve_state_entity: sensor.kran_valve_state
kran_battery_entity: sensor.kran_battery
bathroom_leak_entity: binary_sensor.datchik_ppotiechki_vanna_water_leak
kitchen_leak_entity: binary_sensor.datchik_ppotiechki_kukhnia_water_leak
```

Підстав **свої** entity_id.
