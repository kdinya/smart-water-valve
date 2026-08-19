# 🚰 Water Valve Card v3.0.0

**Тільки Lovelace-картка.** Без інтеграції і без створення пристроїв.

## Встановлення

1. HACS → **Frontend**
2. Custom repositories → `https://github.com/kdinya/smart-water-valve` → **Lovelace**
3. Download → перезавантаж Frontend (Ctrl+F5)

## Налаштування

Додай картку → **Water Valve Card** → відкриється форма:

| Поле | Обовʼязкове | Опис |
|------|-------------|------|
| Кран | так | `switch` / `valve` |
| Сенсор стану | ні | наприклад `sensor.kran_valve_state` |
| Датчик протічки 1 | ні | якщо порожньо — не показується |
| Датчик протічки 2 | ні | якщо порожньо — не показується |
| Батарея | ні | якщо порожньо — не показується |

### YAML (якщо вручну)

```yaml
type: custom:water-valve-card
name: Водяний кран
switch_entity: switch.kran
valve_state_entity: sensor.kran_valve_state
bathroom_leak_entity: binary_sensor.xxx
kitchen_leak_entity: binary_sensor.yyy
```

Не вказуй `bathroom_leak_entity` / `kitchen_leak_entity` — блоки протічки на картці зникнуть.
