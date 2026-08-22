# Tests

A small, dependency-free unit test suite for the pure-logic parts of `water-valve-card.js` — no test framework, no browser, no network.

## Running

```
npm test
```

(equivalent to `node tests/water-valve-card.test.js`)

## What's covered

- Config migration: legacy `bathroom_leak_entity`/`kitchen_leak_entity` → `leak_sensors[]`, legacy `animations_enabled` → `disable_animations`.
- Valve-state resolution (`_getValveState`): open/closed/unavailable/unknown across `switch` and `valve` domains, with and without a separate `valve_state_entity`.
- Toggle-timing math: `_getToggleMs()` clamping, and the `_getWaterLerpFactor()` exponential decay rate that keeps the water animation's speed in sync with `toggle_lock_ms`.
- The v5.0.4 pipe-split helper (`WaterValveCard._pipeSplitX()`).

## What's NOT covered

Anything that needs real rendering — actual canvas drawing, shadow DOM layout, CSS, or the visual editor's `ha-form`/`ha-entity-picker` interaction. `dom-shim.js` provides just enough of `window`/`document`/`customElements`/`HTMLElement` to load the card's class definitions under plain Node and unit-test their data/logic methods directly (calling `_ensureTemplate()`/`_render()`/`_drawWaterFrame()` is intentionally out of scope). Visual/rendering changes still need manual verification in an actual Home Assistant dashboard — see the main [README → Troubleshooting](../README.md#troubleshooting).

## Files

- `dom-shim.js` — minimal DOM/customElements shim used to `vm`-load the card script under Node.
- `water-valve-card.test.js` — the actual test cases.
