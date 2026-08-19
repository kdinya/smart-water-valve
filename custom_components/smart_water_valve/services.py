"""Services for Smart Water Valve."""
import logging

from homeassistant.core import HomeAssistant, ServiceCall

LOGGER = logging.getLogger(__name__)

SERVICE_TOGGLE_VALVE = "toggle_valve"
SERVICE_EMERGENCY_SHUT = "emergency_shut"


async def async_setup_services(hass: HomeAssistant) -> None:
    """Set up services for Smart Water Valve."""

    async def handle_toggle_valve(call: ServiceCall) -> None:
        """Handle toggle valve service call."""
        LOGGER.info("Toggle valve service called")

    async def handle_emergency_shut(call: ServiceCall) -> None:
        """Handle emergency shut service call."""
        LOGGER.warning("Emergency shut service called - CLOSING VALVE!")

    hass.services.async_register(
        "smart_water_valve",
        SERVICE_TOGGLE_VALVE,
        handle_toggle_valve,
    )

    hass.services.async_register(
        "smart_water_valve",
        SERVICE_EMERGENCY_SHUT,
        handle_emergency_shut,
    )
