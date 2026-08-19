"""Minimal config flow — enables the card only."""
from __future__ import annotations

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, VERSION


class SmartWaterValveConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Enable Water Valve Card frontend."""

    VERSION = 1

    async def async_step_user(self, user_input=None) -> FlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="already_configured")

        if user_input is not None:
            return self.async_create_entry(
                title=f"Water Valve Card {VERSION}",
                data={"version": VERSION},
            )

        return self.async_show_form(step_id="user")
