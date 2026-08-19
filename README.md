# 🚰 Water Valve Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/kdinya/smart-water-valve.svg?style=for-the-badge)](https://github.com/kdinya/smart-water-valve/releases)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

**Красива картка водяного крана для Home Assistant Lovelace** з реалістичною анімацією води, індикацією протічок та батареї.

> ⚠️ **Beta (v0.0.1)** — перший публічний реліз. Функціонал стабільний, але можливі дрібні покращення в наступних версіях.

## ✨ Можливості

- 🎨 **Реалістична анімація води** — труби на всю ширину картки, бульбашки, течія, відблиски скла
- 🔄 **Плавне відкриття/закриття** крана з анімацією важеля
- 💧 **Датчики протічки** — ванна + кухня з візуальними попередженнями
- 🔋 **Індикатор батареї** крана
- 🚨 **Аварійний режим** при протічці (червоне підсвічування, краплі)
- 🇺🇦 **Повністю українською** (можна налаштувати тексти)

## 📦 Встановлення через HACS

1. Відкрийте **HACS** → **Frontend**
2. Натисніть **⋮** → **Custom repositories**
3. Додайте репозиторій:
   ```
   https://github.com/kdinya/smart-water-valve
   ```
   Категорія: **Lovelace**
4. Знайдіть **Water Valve Card** і натисніть **Download**
5. Перезавантажте Home Assistant (або Frontend resources)

## ⚙️ Конфігурація

```yaml
type: custom:water-valve-card
switch_entity: switch.water_valve          # обов'язково
name: Водяний кран                         # назва
kran_battery_entity: sensor.kran_battery  # батарея
valve_state_entity: sensor.valve_state     # опціонально (open/closed)
bathroom_leak_entity: binary_sensor.datchik_ppotiechki_vanna_water_leak
kitchen_leak_entity: binary_sensor.datchik_ppotiechki_kukhnia_water_leak
bathroom_label: Ванна
kitchen_label: Кухня
text_dry: СУХО
text_leak: ПРОТІЧКА
btn_close: ПЕРЕКРИТИ
btn_open: ВІДКРИТИ
```

### Параметри

| Параметр | Обов'язковий | Опис | За замовчуванням |
|----------|--------------|------|------------------|
| `switch_entity` | ✅ | Switch, який керує краном | — |
| `name` | ❌ | Назва картки | `Водяний кран` |
| `kran_battery_entity` | ❌ | Sensor батареї | `sensor.kran_battery` |
| `valve_state_entity` | ❌ | Sensor стану (open/closed) | береться з switch |
| `bathroom_leak_entity` | ❌ | Binary sensor протічки ванної | `binary_sensor.datchik_ppotiechki_vanna_water_leak` |
| `kitchen_leak_entity` | ❌ | Binary sensor протічки кухні | `binary_sensor.datchik_ppotiechki_kukhnia_water_leak` |
| `bathroom_label` | ❌ | Підпис ванної | `Ванна` |
| `kitchen_label` | ❌ | Підпис кухні | `Кухня` |
| `text_dry` | ❌ | Текст "сухо" | `СУХО` |
| `text_leak` | ❌ | Текст "протічка" | `ПРОТІЧКА` |
| `btn_close` | ❌ | Текст кнопки закриття | `ПЕРЕКРИТИ` |
| `btn_open` | ❌ | Текст кнопки відкриття | `ВІДКРИТИ` |

## 🖼️ Як виглядає

Картка показує:
- Стан крана (ВІДКРИТО / ЗАКРИТО / ПРОТІЧКА!)
- Анімовану воду в трубах (ліва завжди заповнена, права — залежно від стану)
- Рівень батареї
- Статус датчиків ванної та кухні
- Кнопку відкрити/перекрити

## 📝 Версіонування

Версії у форматі `0.0.x` (beta). При оновленні змінюється лише остання цифра.

## 📄 Ліцензія

MIT

---

Зроблено з ❤️ для Home Assistant спільноти
