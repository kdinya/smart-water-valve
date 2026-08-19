# 🚰 Smart Water Valve v1.0.0

## 🎉 Новий реліз з повною інтеграцією Home Assistant!

### ✨ Нові можливості:

#### 🔧 **Home Assistant Integration**
- ✅ Повна підтримка Home Assistant 2024.1.0+
- ✅ Конфіг-флоу з красивим UI
- ✅ Автоматичне створення пристроїв
- ✅ Підтримка YAML конфігурації

#### 📱 **Платформи**
- ✅ **Switch** — управління краном
- ✅ **Sensor** — батарея крана
- ✅ **Binary Sensor** — датчики протічок (ванна, кухня)

#### 🛠️ **Сервіси**
- ✅ `toggle_valve` — перемикання стану крана
- ✅ `emergency_shut` — аварійне закриття крана

#### 🎨 **Картка Lovelace**
- ✅ Реалістична анімація води на всю ширину
- ✅ Плавне відкриття/закриття з анімацією важеля
- ✅ Датчики протічки з червоними попередженнями
- ✅ Індикатор батареї крана
- ✅ Аварійний режим при протічці

#### 🌍 **Мультимовність**
- ✅ Українська локалізація
- ✅ Налаштування текстів через конфіг

### 📦 Встановлення через HACS

1. Відкрийте **HACS** → **Integrations**
2. Натисніть **⋮** → **Custom repositories**
3. Додайте репозиторій:
   ```
   https://github.com/kdinya/smart-water-valve
   ```
   Категорія: **Integration**
4. Знайдіть **Smart Water Valve** і натисніть **Download**
5. Перезавантажте Home Assistant

### ⚙️ Налаштування

#### Через UI (Рекомендується):
1. Settings → Devices & Services
2. Create Integration → Smart Water Valve
3. Заповніть:
   - Device Name (Ім'я пристрою)
   - Water Valve Switch (Switch сутності)
   - Battery Sensor (Датчик батареї)
   - Leak Sensors (Датчики протічок)

#### Через YAML:
```yaml
smart_water_valve:
  - platform: smart_water_valve
    name: Водяний кран
    switch_entity: switch.water_valve
    kran_battery_entity: sensor.kran_battery
    bathroom_leak_entity: binary_sensor.datchik_ppotiechki_vanna_water_leak
    kitchen_leak_entity: binary_sensor.datchik_ppotiechki_kukhnia_water_leak
```

### 🎨 Картка Lovelace

У конфігурацію лаунчера додайте:
```yaml
type: custom:water-valve-card
switch_entity: switch.water_valve
name: Водяний кран
kran_battery_entity: sensor.kran_battery
bathroom_leak_entity: binary_sensor.datchik_ppotiechki_vanna_water_leak
kitchen_leak_entity: binary_sensor.datchik_ppotiechki_kukhnia_water_leak
```

### 🔗 Автоматизація

Тепер можна створювати автоматизації через Home Assistant:

```yaml
automation:
  - alias: Закрити кран при витіку
    trigger:
      platform: state
      entity_id: binary_sensor.water_valve_bathroom_leak
      to: "on"
    action:
      service: switch.turn_off
      target:
        entity_id: switch.water_valve
```

### 📝 Версіонування

Версії у форматі `MAJOR.MINOR.PATCH`:
- `1.0.0` — перший стабільний реліз з інтеграцією
- Майбутні оновлення: 1.1.0, 1.2.0, 2.0.0 тощо

### 📄 Ліцензія

MIT

---

**Спасибі за використання! 💜 Створено з ❤️ для Home Assistant спільноти**
