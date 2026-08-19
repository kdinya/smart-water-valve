"""Water Valve Card — serves JS and registers Lovelace resource on install/update."""
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
    _LOGGER.info(
        "Serving Water Valve Card v%s from %s",
        VERSION,
        root / "water-valve-card.js",
    )


def _inject_js(hass: HomeAssistant) -> None:
    hass.data.setdefault(DOMAIN, {})
    if hass.data[DOMAIN].get("injected_url") == CARD_URL:
        return
    add_extra_js_url(hass, CARD_URL)
    hass.data[DOMAIN]["injected_url"] = CARD_URL
    _LOGGER.info("Injected frontend module: %s", CARD_URL)


async def _async_sync_lovelace_resource(hass: HomeAssistant) -> None:
    """Register/update storage-mode resource; warn clearly in YAML mode."""
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        _LOGGER.debug("Lovelace not ready")
        return

    resources = lovelace.get("resources")
    if resources is None:
        return

    if not hasattr(resources, "async_items"):
        _LOGGER.warning(
            "Lovelace resources are in YAML mode — cannot auto-add/remove resources. "
            "JS is still injected via add_extra_js_url (%s). "
            "If the card is old or has no visual editor, remove any "
            "'/local/water-valve-card.js' lines from your lovelace resources in YAML, "
            "then restart and Ctrl+F5.",
            CARD_URL,
        )
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
        if url.startswith("/local/water-valve-card.js"):
            to_delete.append(item_id)
            continue
        if url.startswith(CARD_URL_PREFIX) or f"/{DOMAIN}/" in url:
            existing_id = item_id

    for item_id in to_delete:
        try:
            await resources.async_delete_item(item_id)
            _LOGGER.info("Removed conflicting /local/water-valve-card.js resource")
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Failed deleting resource %s: %s", item_id, err)

    for payload in (
        {"res_type": "module", "url": CARD_URL},
        {"type": "module", "url": CARD_URL},
    ):
        try:
            if existing_id:
                await resources.async_update_item(existing_id, payload)
                _LOGGER.info("Updated Lovelace resource → %s", CARD_URL)
            else:
                await resources.async_create_item(payload)
                _LOGGER.info("Created Lovelace resource → %s", CARD_URL)
            return
        except Exception:  # noqa: BLE001
            continue

    _LOGGER.warning(
        "Could not write Lovelace resource entry; module still injected as %s",
        CARD_URL,
    )


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
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
    await _async_register_static_path(hass)
    _inject_js(hass)

    async def _started(_: Event) -> None:
        await _async_sync_lovelace_resource(hass)

    if hass.is_running:
        await _async_sync_lovelace_resource(hass)
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _started)

    entry.async_on_unload(entry.add_update_listener(_async_reload_entry))
    return True


async def _async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    return True
