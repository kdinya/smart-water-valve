"""Constants for Smart Water Valve integration."""
from typing import Final

DOMAIN: Final = "smart_water_valve"

# Config keys
CONF_SWITCH_ENTITY: Final = "switch_entity"
CONF_VALVE_STATE_ENTITY: Final = "valve_state_entity"
CONF_KRAN_BATTERY_ENTITY: Final = "kran_battery_entity"
CONF_BATHROOM_LEAK_ENTITY: Final = "bathroom_leak_entity"
CONF_KITCHEN_LEAK_ENTITY: Final = "kitchen_leak_entity"
CONF_BATHROOM_LABEL: Final = "bathroom_label"
CONF_KITCHEN_LABEL: Final = "kitchen_label"
CONF_TEXT_DRY: Final = "text_dry"
CONF_TEXT_LEAK: Final = "text_leak"
CONF_BTN_CLOSE: Final = "btn_close"
CONF_BTN_OPEN: Final = "btn_open"

# Default values
DEFAULT_NAME: Final = "Водяний кран"
DEFAULT_BATHROOM_LABEL: Final = "Ванна"
DEFAULT_KITCHEN_LABEL: Final = "Кухня"
DEFAULT_TEXT_DRY: Final = "СУХО"
DEFAULT_TEXT_LEAK: Final = "ПРОТІЧКА"
DEFAULT_BTN_CLOSE: Final = "ПЕРЕКРИТИ"
DEFAULT_BTN_OPEN: Final = "ВІДКРИТИ"
