"""Water Valve Card — registers Lovelace card automatically (no devices)."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

_LOGGER = logging.getLogger(__name__)

DOMAIN = "smart_water_valve"
CARD_URL = f"/{DOMAIN}/water-valve-card.js"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the card on Home Assistant start / after install."""
    if hass.data.get(DOMAIN, {}).get("frontend_registered"):
        return True

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

    # Load the custom card JS globally (no manual /local resource needed)
    add_extra_js_url(hass, CARD_URL)

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["frontend_registered"] = True
    _LOGGER.info("Water Valve Card registered at %s", CARD_URL)
    return True
