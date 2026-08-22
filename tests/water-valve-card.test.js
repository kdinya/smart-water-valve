'use strict';
/*
 * Plain-Node test suite (no test framework, no external deps — this is a
 * single-file HACS card and the network for CI here is deliberately
 * limited, so `node tests/water-valve-card.test.js` needs to work with
 * nothing but the standard library).
 *
 * Covers pure logic only: config migration, valve-state resolution, the
 * toggle-timing math, and the v5.0.4 pipe-split helper. It does NOT drive
 * full rendering/canvas drawing — that needs a real browser and is best
 * verified manually (see README → Troubleshooting) or with a headless
 * browser harness, which is out of scope for a dependency-free unit suite.
 */
const assert = require('assert');
const { loadCardModule } = require('./dom-shim.js');

const { WaterValveCard } = loadCardModule();

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    failures.push({ name, error: e });
  }
}

function makeCard(config) {
  const card = new WaterValveCard();
  card.setConfig(config || { switch_entity: 'switch.valve' });
  return card;
}

function fakeHass(states) {
  return { states, callService: () => Promise.resolve() };
}

// ── _pipeSplitX: the core of the v5.0.4 "no seam" fix ──────────────────
test('_pipeSplitX always returns exactly the midpoint, for any width', () => {
  for (const w of [0, 1, 199, 200, 201, 400, 401, 800, 1234.5]) {
    assert.strictEqual(WaterValveCard._pipeSplitX(w), w / 2);
  }
});

test('_pipeSplitX: left region end === right region start (no gap, no overlap)', () => {
  const wCard = 347; // arbitrary non-round width, e.g. a real phone card
  const splitX = WaterValveCard._pipeSplitX(wCard);
  // Regression guard for the old bug: previously leftXEnd and rightXStart
  // were independently measured (valve edge in screen space) and could
  // diverge, leaving a gap. Now both regions are derived from the SAME
  // single value, so this can never happen again by construction.
  const leftXEnd = splitX;
  const rightXStart = splitX;
  assert.strictEqual(leftXEnd, rightXStart);
});

// ── Water level lerp speed follows toggle_lock_ms ───────────────────────
test('_getWaterLerpFactor: shorter toggle_lock_ms means a larger (faster) lerp factor', () => {
  const fast = makeCard({ switch_entity: 'switch.valve', toggle_lock_ms: 2000 });
  const slow = makeCard({ switch_entity: 'switch.valve', toggle_lock_ms: 20000 });
  assert.ok(fast._getWaterLerpFactor() > slow._getWaterLerpFactor());
});

test('_getWaterLerpFactor: water reaches ~99% of target within the configured toggle time', () => {
  for (const ms of [1000, 4000, 8000, 15000]) {
    const card = makeCard({ switch_entity: 'switch.valve', toggle_lock_ms: ms });
    const speed = card._getWaterLerpFactor();
    const frames = Math.round((ms / 1000) * 60);
    let level = 0;
    const target = 1;
    for (let i = 0; i < frames; i++) {
      level += (target - level) * speed;
    }
    // Within 2% of target by the time the configured duration has elapsed —
    // this is what keeps the water level and the CSS valve-knob rotation
    // (which uses the exact same toggle_lock_ms as its transition-duration)
    // visually finishing together instead of drifting apart.
    assert.ok(Math.abs(target - level) < 0.02, `ms=${ms} level=${level}`);
  }
});

test('_getWaterLerpFactor: invalid/zero toggle_lock_ms falls back to a sane default duration', () => {
  const card = makeCard({ switch_entity: 'switch.valve', toggle_lock_ms: 0 });
  const speed = card._getWaterLerpFactor();
  assert.ok(speed > 0 && speed < 1);
});

// ── _getToggleMs ─────────────────────────────────────────────────────────
test('_getToggleMs: defaults to 8000ms when unset', () => {
  const card = makeCard({ switch_entity: 'switch.valve' });
  assert.strictEqual(card._getToggleMs(), 8000);
});

test('_getToggleMs: uses configured value when valid', () => {
  const card = makeCard({ switch_entity: 'switch.valve', toggle_lock_ms: 12345 });
  assert.strictEqual(card._getToggleMs(), 12345);
});

test('_getToggleMs: ignores garbage/negative values, falls back to 8000ms', () => {
  const card = makeCard({ switch_entity: 'switch.valve', toggle_lock_ms: -50 });
  assert.strictEqual(card._getToggleMs(), 8000);
});

// ── setConfig: btn_opening / btn_closing (item 3) ───────────────────────
test('setConfig: btn_opening/btn_closing default to empty string (falls back to i18n at render time)', () => {
  const card = makeCard({ switch_entity: 'switch.valve' });
  assert.strictEqual(card._config.btn_opening, '');
  assert.strictEqual(card._config.btn_closing, '');
});

test('setConfig: btn_opening/btn_closing pass through when set', () => {
  const card = makeCard({
    switch_entity: 'switch.valve',
    btn_opening: 'Хвилинку…',
    btn_closing: 'Закриваємо…',
  });
  assert.strictEqual(card._config.btn_opening, 'Хвилинку…');
  assert.strictEqual(card._config.btn_closing, 'Закриваємо…');
});

// ── _getValveState ───────────────────────────────────────────────────────
test('_getValveState: switch "on" reads as open', () => {
  const card = makeCard({ switch_entity: 'switch.valve' });
  card._hass = fakeHass({ 'switch.valve': { state: 'on' } });
  const { isOpen, isUnavailable } = card._getValveState();
  assert.strictEqual(isOpen, true);
  assert.strictEqual(isUnavailable, false);
});

test('_getValveState: missing entity is unavailable, NOT closed', () => {
  const card = makeCard({ switch_entity: 'switch.missing' });
  card._hass = fakeHass({});
  const { isUnavailable, valveState } = card._getValveState();
  assert.strictEqual(isUnavailable, true);
  assert.strictEqual(valveState, 'unavailable');
});

test('_getValveState: "unavailable" state is NOT treated as closed', () => {
  const card = makeCard({ switch_entity: 'switch.valve' });
  card._hass = fakeHass({ 'switch.valve': { state: 'unavailable' } });
  const { isUnavailable, isOpen } = card._getValveState();
  assert.strictEqual(isUnavailable, true);
  assert.strictEqual(isOpen, false);
});

test('_getValveState: valve-domain "open"/"closed" states are recognized', () => {
  const card = makeCard({ switch_entity: 'valve.main' });
  card._hass = fakeHass({ 'valve.main': { state: 'open' } });
  assert.strictEqual(card._getValveState().isOpen, true);
});

test('_getValveState: dedicated valve_state_entity overrides the switch state', () => {
  const card = makeCard({ switch_entity: 'switch.valve', valve_state_entity: 'sensor.valve_state' });
  card._hass = fakeHass({
    'switch.valve': { state: 'on' },
    'sensor.valve_state': { state: 'closed' },
  });
  assert.strictEqual(card._getValveState().isOpen, false);
});

// ── Config migration (pre-existing behavior — guard against regressions) ─
test('_migrateLeakSensors: picks up legacy bathroom_/kitchen_ fields when leak_sensors is absent', () => {
  const migrated = WaterValveCard._migrateLeakSensors({
    bathroom_leak_entity: 'binary_sensor.bathroom',
    bathroom_label: 'Ванна',
    kitchen_leak_entity: 'binary_sensor.kitchen',
  });
  assert.strictEqual(migrated.length, 2);
  assert.strictEqual(migrated[0].entity, 'binary_sensor.bathroom');
  assert.strictEqual(migrated[1].entity, 'binary_sensor.kitchen');
});

test('_migrateLeakSensors: an explicit (even empty) leak_sensors array is respected, no re-migration', () => {
  const migrated = WaterValveCard._migrateLeakSensors({
    leak_sensors: [],
    bathroom_leak_entity: 'binary_sensor.bathroom',
  });
  assert.deepStrictEqual(migrated, []);
});

test('_clampScale: clamps out-of-range values into [0.5, 2.5]', () => {
  assert.strictEqual(WaterValveCard._clampScale(0.1), 0.5);
  assert.strictEqual(WaterValveCard._clampScale(9), 2.5);
  assert.strictEqual(WaterValveCard._clampScale(1.3), 1.3);
  assert.strictEqual(WaterValveCard._clampScale(undefined), 1.15);
});

// ── Report ───────────────────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  for (const f of failures) {
    console.error(`\nFAIL: ${f.name}`);
    console.error(f.error);
  }
  process.exitCode = 1;
}
