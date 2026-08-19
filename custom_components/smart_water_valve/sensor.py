"""Sensor platform for Smart Water Valve."""
import logging
from typing import Optional

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_NAME, PERCENTAGE
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_KRAN_BATTERY_ENTITY, DOMAIN

LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up sensor platform."""
    battery_entity = config_entry.data.get(CONF_KRAN_BATTERY_ENTITY)
    name = config_entry.data.get(CONF_NAME, "Water Valve")

    entities = []

    if battery_entity:
        entities.append(
            SmartWaterValveBatterySensor(
                hass, config_entry, battery_entity, name
            )
        )

    if entities:
        async_add_entities(entities)


class SmartWaterValveBatterySensor(SensorEntity):
    """Representation of a Smart Water Valve battery sensor."""

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: ConfigEntry,
        battery_entity: str,
        name: str,
    ) -> None:
        """Initialize the sensor."""
        self.hass = hass
        self._config_entry = config_entry
        self._battery_entity = battery_entity
        self._name = f"{name} Battery"
        self._attr_unique_id = f"{DOMAIN}_{config_entry.entry_id}_battery"
        self._attr_native_unit_of_measurement = PERCENTAGE

    @property
    def name(self) -> str:
        """Return the name of the sensor."""
        return self._name

    @property
    def native_value(self) -> Optional[str]:
        """Return the state of the sensor."""
        state = self.hass.states.get(self._battery_entity)
        return state.state if state else None

    @property
    def state_class(self):
        """Return the state class."""
        return "measurement"
