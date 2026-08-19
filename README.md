# 🚰 Water Valve Card v1.2.0

Кастомна картка Lovelace для Home Assistant.

**Важливо:** ентіті в картці — це ті, які **ти сам вказуєш** у конфігурації картки (ті самі, що обирав при створенні пристрою / свої реальні ентіті).

## Конфігурація

```yaml
type: custom:water-valve-card
name: Водяний кран
switch_entity: switch.kran
valve_state_entity: sensor.kran_valve_state
kran_battery_entity: sensor.kran_battery
bathroom_leak_entity: binary_sensor.datchik_ppotiechki_vanna_water_leak
kitchen_leak_entity: binary_sensor.datchik_ppotiechki_kukhnia_water_leak
```

| Параметр | Обов’язковий | Опис |
|----------|--------------|------|
| `switch_entity` | так | Керування краном (`switch.kran`) |
| `valve_state_entity` | ні | Стан відкрито/закрито (`sensor.kran_valve_state`) |
| `kran_battery_entity` | ні | Батарея крана |
| `bathroom_leak_entity` | ні | Датчик протічки ванної |
| `kitchen_leak_entity` | ні | Датчик протічки кухні |
| `name` | ні | Назва на картці |

Підтримувані стани «відкрито»: `on`, `open`, `opened`, `відкрито`, `открыто`.

## Встановлення (HACS)

1. HACS → Frontend → ⋮ → Custom repositories  
2. URL: `https://github.com/kdinya/smart-water-valve`  
3. Категорія: **Lovelace**  
4. Download → перезавантаж Frontend (або Ctrl+F5)

## Оновлення з попередніх версій

Після оновлення **відредагуй картку** і вкажи свої ентіті вручну — більше немає підстановки чужих дефолтів.
