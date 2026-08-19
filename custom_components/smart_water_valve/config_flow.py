"""Minimal config flow — only enables the card, no entity selection."""
from __future__ import annotations

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from . import DOMAIN


class SmartWaterValveConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Enable Water Valve Card."""

    VERSION = 1

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Single step: confirm installation."""
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")

        if user_input is not None:
            return self.async_create_entry(title="Water Valve Card", data={})

        return self.async_show_form(step_id="user")
