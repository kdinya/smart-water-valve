"""Switch platform for Smart Water Valve."""
import logging
from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import CONF_SWITCH_ENTITY, DOMAIN

LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up switch platform."""
    switch_entity = config_entry.data.get(CONF_SWITCH_ENTITY)
    name = config_entry.data.get(CONF_NAME, "Water Valve")

    if switch_entity:
        async_add_entities(
            [
                SmartWaterValveSwitch(
                    hass, config_entry, switch_entity, name
                )
            ]
        )


class SmartWaterValveSwitch(SwitchEntity):
    """Representation of a Smart Water Valve switch."""

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: ConfigEntry,
        switch_entity: str,
        name: str,
    ) -> None:
        """Initialize the switch."""
        self.hass = hass
        self._config_entry = config_entry
        self._switch_entity = switch_entity
        self._name = name
        self._attr_unique_id = f"{DOMAIN}_{config_entry.entry_id}_switch"

    @property
    def name(self) -> str:
        """Return the name of the switch."""
        return self._name

    @property
    def is_on(self) -> bool:
        """Return true if switch is on."""
        state = self.hass.states.get(self._switch_entity)
        return state is not None and state.state == "on"

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn on the switch."""
        await self.hass.services.async_call(
            "switch", "turn_on", {"entity_id": self._switch_entity}
        )
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn off the switch."""
        await self.hass.services.async_call(
            "switch", "turn_off", {"entity_id": self._switch_entity}
        )
        self.async_write_ha_state()
