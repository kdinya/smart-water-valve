"""Water Valve Card — serves JS and registers Lovelace resource automatically."""
from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import Event, HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import CARD_URL, CARD_URL_PREFIX, DOMAIN, VERSION

_LOGGER = logging.getLogger(__name__)


async def _async_register_static_path(hass: HomeAssistant) -> None:
    """Serve custom_components/.../water-valve-card.js at /smart_water_valve/."""
    hass.data.setdefault(DOMAIN, {})
    if hass.data[DOMAIN].get("static_registered"):
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
    hass.data[DOMAIN]["static_registered"] = True
    _LOGGER.debug("Static path registered for %s", DOMAIN)


def _inject_js(hass: HomeAssistant) -> None:
    """Inject module into frontend (works even without lovelace resource entry)."""
    hass.data.setdefault(DOMAIN, {})
    prev = hass.data[DOMAIN].get("injected_url")
    if prev == CARD_URL:
        return
    add_extra_js_url(hass, CARD_URL)
    hass.data[DOMAIN]["injected_url"] = CARD_URL
    _LOGGER.info("Frontend JS injected: %s", CARD_URL)


async def _async_sync_lovelace_resource(hass: HomeAssistant) -> None:
    """Create/update Lovelace resource to the current versioned URL; remove /local/ conflicts."""
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        _LOGGER.debug("Lovelace not loaded yet")
        return

    resources = lovelace.get("resources")
    if resources is None:
        return

    # YAML mode has no async_create_item
    if not hasattr(resources, "async_items"):
        _LOGGER.debug("Lovelace resources in YAML mode — using add_extra_js_url only")
        return

    try:
        items = list(resources.async_items())
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Cannot list lovelace resources: %s", err)
        return

    to_delete: list[str] = []
    existing_id: str | None = None

    for item in items:
        url = (item.get("url") or "").strip()
        item_id = item.get("id")
        if not item_id:
            continue
        # Remove manual /local copies that shadow the integration card
        if url.startswith("/local/water-valve-card.js"):
            to_delete.append(item_id)
            _LOGGER.info("Removing conflicting resource: %s", url)
            continue
        # Our resource (any old version query string)
        if url.startswith(CARD_URL_PREFIX) or url.startswith(f"/hacsfiles/{DOMAIN}/"):
            existing_id = item_id

    for item_id in to_delete:
        try:
            await resources.async_delete_item(item_id)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Failed to delete resource %s: %s", item_id, err)

    payload = {"res_type": "module", "url": CARD_URL}

    try:
        if existing_id:
            await resources.async_update_item(existing_id, payload)
            _LOGGER.info("Lovelace resource updated to %s", CARD_URL)
        else:
            await resources.async_create_item(payload)
            _LOGGER.info("Lovelace resource created: %s", CARD_URL)
    except Exception as err:  # noqa: BLE001
        # Fallback key name used by some HA versions
        try:
            payload_alt = {"type": "module", "url": CARD_URL}
            if existing_id:
                await resources.async_update_item(existing_id, payload_alt)
            else:
                await resources.async_create_item(payload_alt)
            _LOGGER.info("Lovelace resource registered (alt schema): %s", CARD_URL)
        except Exception as err2:  # noqa: BLE001
            _LOGGER.warning(
                "Could not write lovelace resource (JS still injected via add_extra_js_url): %s / %s",
                err,
                err2,
            )


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Full frontend registration for current VERSION."""
    await _async_register_static_path(hass)
    _inject_js(hass)
    await _async_sync_lovelace_resource(hass)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up from configuration.yaml (optional)."""
    await _async_register_static_path(hass)
    _inject_js(hass)

    async def _started(_: Event) -> None:
        await _async_sync_lovelace_resource(hass)

    if hass.is_running:
        await _async_sync_lovelace_resource(hass)
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Enable card when integration entry is added/reloaded."""
    await _async_register_static_path(hass)
    _inject_js(hass)

    async def _started(_: Event) -> None:
        await _async_sync_lovelace_resource(hass)

    if hass.is_running:
        await _async_sync_lovelace_resource(hass)
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started)

    # Also sync on entry update (version bump after HACS update + reload)
    entry.async_on_unload(entry.add_update_listener(_async_reload_entry))
    return True


async def _async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Re-sync resource URL after integration update."""
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload — leave resource (safe); next setup refreshes version."""
    return True
