"""Binary sensor platform for Smart Water Valve."""
import logging

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    CONF_BATHROOM_LABEL,
    CONF_BATHROOM_LEAK_ENTITY,
    CONF_KITCHEN_LABEL,
    CONF_KITCHEN_LEAK_ENTITY,
    DOMAIN,
)

LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up binary sensor platform."""
    bathroom_leak = config_entry.data.get(CONF_BATHROOM_LEAK_ENTITY)
    kitchen_leak = config_entry.data.get(CONF_KITCHEN_LEAK_ENTITY)
    bathroom_label = config_entry.data.get(CONF_BATHROOM_LABEL, "Bathroom")
    kitchen_label = config_entry.data.get(CONF_KITCHEN_LABEL, "Kitchen")
    name = config_entry.data.get(CONF_NAME, "Water Valve")

    entities = []

    if bathroom_leak:
        entities.append(
            SmartWaterValveLeakSensor(
                hass, config_entry, bathroom_leak, f"{name} {bathroom_label} Leak"
            )
        )

    if kitchen_leak:
        entities.append(
            SmartWaterValveLeakSensor(
                hass, config_entry, kitchen_leak, f"{name} {kitchen_label} Leak"
            )
        )

    if entities:
        async_add_entities(entities)


class SmartWaterValveLeakSensor(BinarySensorEntity):
    """Representation of a Smart Water Valve leak sensor."""

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: ConfigEntry,
        leak_entity: str,
        name: str,
    ) -> None:
        """Initialize the sensor."""
        self.hass = hass
        self._config_entry = config_entry
        self._leak_entity = leak_entity
        self._name = name
        self._attr_unique_id = f"{DOMAIN}_{config_entry.entry_id}_{leak_entity}"
        self._attr_device_class = "moisture"

    @property
    def name(self) -> str:
        """Return the name of the sensor."""
        return self._name

    @property
    def is_on(self) -> bool:
        """Return true if leak is detected."""
        state = self.hass.states.get(self._leak_entity)
        return state is not None and state.state == "on"
