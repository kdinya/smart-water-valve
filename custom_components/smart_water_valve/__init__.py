"""Water Valve Card — auto-registers Lovelace card (no devices/entities)."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

_LOGGER = logging.getLogger(__name__)

DOMAIN = "smart_water_valve"
CARD_URL = f"/{DOMAIN}/water-valve-card.js"


async def _register_frontend(hass: HomeAssistant) -> None:
    """Serve JS and inject into Lovelace."""
    hass.data.setdefault(DOMAIN, {})
    if hass.data[DOMAIN].get("frontend_registered"):
        return

    root = Path(__file__).parent
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                url_path=f"/{DOMAIN}",
                path=str(root),
                cache_headers=False,
            )
        ]
    )
    add_extra_js_url(hass, CARD_URL)
    hass.data[DOMAIN]["frontend_registered"] = True
    _LOGGER.info("Water Valve Card ready: %s", CARD_URL)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up from YAML (optional)."""
    await _register_frontend(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up from UI config entry — registers the card."""
    await _register_frontend(hass)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload entry (card JS stays until restart — HA limitation)."""
    return True
