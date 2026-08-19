"""Config flow for Smart Water Valve integration."""
import logging
from typing import Any, Dict, Optional

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import selector
from homeassistant.helpers.typing import StateType

from .const import (
    CONF_BATHROOM_LABEL,
    CONF_BATHROOM_LEAK_ENTITY,
    CONF_BTN_CLOSE,
    CONF_BTN_OPEN,
    CONF_KITCHEN_LABEL,
    CONF_KITCHEN_LEAK_ENTITY,
    CONF_KRAN_BATTERY_ENTITY,
    CONF_SWITCH_ENTITY,
    CONF_TEXT_DRY,
    CONF_TEXT_LEAK,
    CONF_VALVE_STATE_ENTITY,
    DOMAIN,
    DEFAULT_NAME,
    DEFAULT_BATHROOM_LABEL,
    DEFAULT_KITCHEN_LABEL,
    DEFAULT_TEXT_DRY,
    DEFAULT_TEXT_LEAK,
    DEFAULT_BTN_CLOSE,
    DEFAULT_BTN_OPEN,
)

LOGGER = logging.getLogger(__name__)


class SmartWaterValveConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Smart Water Valve."""

    VERSION = 1

    async def async_step_user(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Handle the initial step."""
        errors: Dict[str, str] = {}

        if user_input is not None:
            try:
                await self.async_set_unique_id(user_input.get(CONF_NAME, "water_valve"))
                self._abort_if_unique_id_configured()

                return self.async_create_entry(
                    title=user_input.get(CONF_NAME, DEFAULT_NAME),
                    data=user_input,
                )
            except Exception as err:  # pylint: disable=broad-except
                LOGGER.error("Error creating entry: %s", err)
                errors["base"] = "invalid_input"

        data_schema = vol.Schema(
            {
                vol.Required(
                    CONF_NAME, default=DEFAULT_NAME
                ): selector.TextSelector(),
                vol.Required(
                    CONF_SWITCH_ENTITY
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="switch")
                ),
                vol.Optional(
                    CONF_VALVE_STATE_ENTITY
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(
                        domain=["binary_sensor", "sensor"]
                    )
                ),
                vol.Optional(
                    CONF_KRAN_BATTERY_ENTITY, default="sensor.kran_battery"
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="sensor")
                ),
                vol.Optional(
                    CONF_BATHROOM_LEAK_ENTITY,
                    default="binary_sensor.datchik_ppotiechki_vanna_water_leak",
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="binary_sensor")
                ),
                vol.Optional(
                    CONF_KITCHEN_LEAK_ENTITY,
                    default="binary_sensor.datchik_ppotiechki_kukhnia_water_leak",
                ): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="binary_sensor")
                ),
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
        )

    async def async_step_user_labels(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Handle labels and text configuration."""
        errors: Dict[str, str] = {}

        if user_input is not None:
            config = self.hass.data.get(DOMAIN, {}).get("pending_config", {})
            config.update(user_input)

            return self.async_create_entry(
                title=config.get(CONF_NAME, DEFAULT_NAME),
                data=config,
            )

        data_schema = vol.Schema(
            {
                vol.Optional(
                    CONF_BATHROOM_LABEL, default=DEFAULT_BATHROOM_LABEL
                ): selector.TextSelector(),
                vol.Optional(
                    CONF_KITCHEN_LABEL, default=DEFAULT_KITCHEN_LABEL
                ): selector.TextSelector(),
                vol.Optional(
                    CONF_TEXT_DRY, default=DEFAULT_TEXT_DRY
                ): selector.TextSelector(),
                vol.Optional(
                    CONF_TEXT_LEAK, default=DEFAULT_TEXT_LEAK
                ): selector.TextSelector(),
                vol.Optional(
                    CONF_BTN_CLOSE, default=DEFAULT_BTN_CLOSE
                ): selector.TextSelector(),
                vol.Optional(
                    CONF_BTN_OPEN, default=DEFAULT_BTN_OPEN
                ): selector.TextSelector(),
            }
        )

        return self.async_show_form(
            step_id="user_labels",
            data_schema=data_schema,
            errors=errors,
        )
