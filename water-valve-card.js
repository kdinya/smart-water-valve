// ═══════════════════════════════════════════════════════════════
//  Water Valve Card  v3.0.0 — труби з водою на всю ширину,
//  центральний корпус фіксований (max-width:400px, центрований).
// ═══════════════════════════════════════════════════════════════

class WaterValveCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = null;
    this._isToggling = false;
    this._targetState = null;
    this._toggleTimeout = null;
    this._initialized = false;
    this._eventsAC = null;
    this._lastKey = '';

    // ── Анімація води ──
    this._waterAnimationId = null;
    this._canvas = null;
    this._ctx = null;

    // Ліва труба (підвідна) – завжди заповнена
    this._waterLevelLeft = 0.75;
    this._targetWaterLevelLeft = 0.75;

    // Права труба – залежить ТІЛЬКИ від стану крана (відкрито/закрито)
    this._waterLevelRight = 0;
    this._targetWaterLevelRight = 0;

    this._waterTransitionSpeed = 0.018;

    // Бульбашки та лінії течії
    this._bubblesLeft = [];
    this._bubblesRight = [];
    this._flowLinesLeft = [];
    this._flowLinesRight = [];

    // Краплі протічки
    this._leakDrops = [];
    this._maxLeakDrops = 6; 
    this._hasLeak = false;

    this._waterTime = 0;

    // Геометрія труби — динамічно адаптується в кожному кадрі
    this._pipeInner = {
      left: 0,
      right: 400,
      top: 79,
      bottom: 121
    };
    // Межі фланців
    this._flangeLeft  = { x: 82, width: 26, centerX: 95,  centerY: 100, radius: 10 };
    this._flangeRight = { x: 292, width: 26, centerX: 305, centerY: 100, radius: 10 };
  }

  static get _css() {
    return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :host {
      display: block;
      font-family: var(--primary-font-family, 'Roboto', 'Inter', -apple-system, sans-serif);
    }

    .card {
      position: relative;
      overflow: hidden;
      border-radius: 28px;
      padding: 16px 20px 14px;
      cursor: pointer;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      border: 1px solid rgba(255,255,255,0.05);
      background:
        radial-gradient(ellipse 120% 80% at 50% -10%, rgba(56,189,248,0.05) 0%, transparent 65%),
        linear-gradient(165deg, #11151d 0%, #05070a 100%);
      box-shadow:
        0 30px 70px rgba(0,0,0,0.9),
        inset 0 1px 0 rgba(255,255,255,0.06);
      transition: border-color 0.6s ease, box-shadow 0.6s ease, transform 0.15s ease;
    }
    .card:active:not(.disabled-card) { transform: scale(0.985); }
    .card.disabled-card { cursor: not-allowed; }

    .card.has-leak {
      border-color: rgba(239,68,68,0.5);
      box-shadow: 0 30px 70px rgba(0,0,0,0.9), 0 0 35px rgba(239,68,68,0.2), inset 0 0 25px rgba(239,68,68,0.05);
      animation: card-leak-glow 2s ease-in-out infinite;
    }
    @keyframes card-leak-glow {
      0%, 100% { border-color: rgba(239,68,68,0.4); }
      50%       { border-color: rgba(239,68,68,0.75); }
    }

    .content { position: relative; z-index: 1; }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }
    .header-main { display: flex; flex-direction: column; }

    .name {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.25);
      margin-bottom: 4px;
    }
    .state-label {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.01em;
      color: var(--accent-color);
      text-shadow: 0 0 30px var(--accent-glow);
      transition: color 0.4s ease, text-shadow 0.4s ease;
      line-height: 1.15;
    }

    .battery-container {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 12px;
      background: rgba(22, 28, 38, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.04);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.02);
    }
    .battery-svg {
      width: 22px;
      height: 11px;
      overflow: visible;
    }
    .battery-text {
      font-size: 11.5px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.65);
      font-family: monospace;
    }

    .status-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--dot-color);
      box-shadow: 0 0 10px var(--dot-color);
      transition: background 0.4s ease, box-shadow 0.4s ease;
    }
    .dot.pulse { animation: pulse-dot 2s ease-in-out infinite; }
    .dot.blink { animation: blink 0.6s ease infinite; }
    .dot.leak  { animation: leak-dot 0.8s ease-in-out infinite; background: #ef4444; box-shadow: 0 0 12px #ef4444; }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.4; transform: scale(1.2); }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.25; }
    }
    @keyframes leak-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.4; transform: scale(1.3); }
    }
    .status-text {
      font-size: 12.5px;
      color: rgba(255,255,255,0.45);
      line-height: 1.3;
    }
    .card.has-leak .status-text { color: #f87171; font-weight: 500; }

    .valve-section {
      position: relative;
      width: 100%;
      margin: 2px 0 36px 0; 
      transform: scale(1.15); 
      pointer-events: none;
    }

    .valve-svg {
      display: block;
      width: 100%;
      max-width: 400px;
      height: auto;
      margin: 0 auto;
      overflow: visible;
      z-index: 2;
      position: relative;
    }

    .valve-knob {
      transform-origin: 200px 100px;
      transition: transform var(--valve-duration, 8s) linear;
      transform: rotate(var(--valve-rotation, 0deg));
    }

    .control-row { display: flex; align-items: flex-end; gap: 12px; margin-top: 10px; }
    .sensor {
      flex: 1; height: 105px; 
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 4px;
      border-radius: 16px; background: rgba(22,28,38,0.4);
      border: 1px solid rgba(255,255,255,0.04);
      box-shadow: 0 4px 14px rgba(0,0,0,0.2);
      transition: background 0.4s, border-color 0.4s; position: relative; overflow: hidden;
    }
    .sensor.leak {
      background: rgba(45,20,20,0.45); border-color: rgba(239,68,68,0.25);
      box-shadow: 0 4px 16px rgba(239,68,68,0.1); animation: sensor-shake 0.5s ease-in-out infinite;
    }
    @keyframes sensor-shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
      20%, 40%, 60%, 80% { transform: translateX(2px); }
    }
    .sensor-icon-wrap { width: 28px; height: 28px; flex-shrink: 0; }
    .sensor-icon { width: 28px; height: 28px; }
    .sensor-name { font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.3); }
    .sensor-state { font-size: 14px; font-weight: 700; color: #10b981; }
    .sensor.leak .sensor-state { color: #f87171; }

    .action-btn {
      flex: 2; height: 50px; border-radius: 14px;
      border: 1.5px solid rgba(56,189,248,0.3);
      background: rgba(56,189,248,0.02); color: #38bdf8;
      font-size: 13.5px; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase;
      cursor: pointer; transition: all 0.3s ease;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    }
    .action-btn:hover { background: rgba(56,189,248,0.07); border-color: rgba(56,189,248,0.5); }
    .action-btn:active:not(.disabled) { transform: scale(0.975); }
    .action-btn.closed { border-color: rgba(239,68,68,0.3); color: #f87171; background: rgba(239,68,68,0.02); }
    .action-btn.closed:hover { background: rgba(239,68,68,0.07); border-color: rgba(239,68,68,0.5); }
    .action-btn.disabled { opacity: 0.4; pointer-events: none; }
    .action-btn.leak-shut {
      border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,0.1);
      animation: btn-leak-pulse 1.5s infinite;
    }
    @keyframes btn-leak-pulse {
      0%, 100% { box-shadow: 0 0 12px rgba(239,68,68,0.15); }
      50%      { box-shadow: 0 0 24px rgba(239,68,68,0.35); }
    }

    .ripple {
      position: absolute; border-radius: 50%; background: rgba(255,255,255,0.04);
      transform: scale(0); animation: ripple-anim 0.5s cubic-bezier(0.1, 0.8, 0.3, 1); pointer-events: none;
    }
    @keyframes ripple-anim { to { transform: scale(3.5); opacity: 0; } }

    #water-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }
    `;
  }

  setConfig(config) {
    if (!config.switch_entity) throw new Error('Потрібно вказати switch_entity — ентіті керування краном');
    this._config = {
      switch_entity: config.switch_entity,
      valve_state_entity: config.valve_state_entity || null,
      kran_battery_entity: config.kran_battery_entity || null,
      name: config.name || 'Водяний кран',
      bathroom_leak_entity: config.bathroom_leak_entity || null,
      kitchen_leak_entity: config.kitchen_leak_entity || null,
      bathroom_label: config.bathroom_label || 'Ванна',
      kitchen_label: config.kitchen_label || 'Кухня',
      text_dry: config.text_dry || 'СУХО',
      text_leak: config.text_leak || 'ПРОТІЧКА',
      btn_close: config.btn_close || 'ПЕРЕКРИТИ',
      btn_open: config.btn_open || 'ВІДКРИТИ',
      toggle_lock_ms: config.toggle_lock_ms || 8000,
    };
  }

  connectedCallback() {
    if (this._initialized) {
      this._attachEvents();
      this._startWaterAnimation();
    }
  }
  disconnectedCallback() {
    if (this._toggleTimeout) clearTimeout(this._toggleTimeout);
    this._detachEvents();
    this._stopWaterAnimation();
  }
  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _state(id) { return this._hass?.states[id]?.state ?? 'unknown'; }
  _isLeak(entityId) { if (!entityId) return false; return this._state(entityId) === 'on'; }

  _getValveState() {
    if (!this._hass) return { switchState: 'unknown', valveState: 'unknown', isOpen: false };
    const { switch_entity, valve_state_entity } = this._config;
    const sw = this._hass.states[switch_entity];
    const vs = valve_state_entity ? this._hass.states[valve_state_entity] : null;
    const switchState = sw?.state || 'unknown';
    const raw = (vs?.state || switchState || 'unknown').toString().toLowerCase().trim();
    const openStates = new Set(['on', 'open', 'opened', 'відкрито', 'открыто', 'відчинено']);
    const isOpen = openStates.has(raw);
    const valveState = vs?.state || (isOpen ? 'open' : switchState === 'off' ? 'closed' : switchState);
    return { switchState, valveState, isOpen };
  }

  _getData() {
    const { valveState } = this._getValveState();
    const cfg = this._config;
    const bathLeak = this._isLeak(cfg.bathroom_leak_entity);
    const kitLeak  = this._isLeak(cfg.kitchen_leak_entity);
    return { valveState, bathLeak, kitLeak, hasLeak: bathLeak || kitLeak };
  }

  _toggle() {
    if (this._isToggling) return;
    const { switch_entity } = this._config;
    const { isOpen } = this._getValveState();
    this._isToggling = true;
    this._targetState = isOpen ? 'closed' : 'open';
    const service = isOpen ? 'turn_off' : 'turn_on';
    this._hass.callService('switch', service, { entity_id: switch_entity });

    if (this._toggleTimeout) clearTimeout(this._toggleTimeout);
    this._toggleTimeout = setTimeout(() => {
      this._isToggling = false;
      this._targetState = null;
      this._lastKey = '';
      this._render();
    }, this._config.toggle_lock_ms);
    this._lastKey = '';
    this._render();
  }

  _ensureTemplate() {
    if (this._initialized) return;
    this._initialized = true;
    this.shadowRoot.innerHTML = `
      <style>${WaterValveCard._css}</style>
      <div class="card" id="card">
        <div class="content">
          <div class="header">
            <div class="header-main">
              <div class="name" id="name"></div>
              <div class="state-label" id="state-label"></div>
            </div>

            <div class="battery-container" id="battery-container">
              <svg class="battery-svg" viewBox="0 0 24 12">
                <rect x="1" y="1" width="18" height="10" rx="2.5" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
                <rect x="20" y="4.5" width="2" height="3" rx="1" fill="rgba(255,255,255,0.4)"/>
                <rect id="battery-level-bar" x="3" y="3" width="14" height="6" rx="0.7" fill="#10b981"/>
              </svg>
              <span class="battery-text" id="battery-text">--%</span>
            </div>
          </div>

          <div class="status-row">
            <div class="dot" id="dot"></div>
            <div class="status-text" id="status-text"></div>
          </div>

          <div class="valve-section" id="valve-section">
            <canvas id="water-canvas" width="400" height="200"></canvas>
            <svg class="valve-svg" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="shadow-valve" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000" flood-opacity="0.95"/>
                </filter>
                <filter id="shadow-lever" x="-25%" y="-25%" width="150%" height="150%">
                  <feDropShadow dx="3" dy="7" stdDeviation="5" flood-color="#000" flood-opacity="0.75"/>
                </filter>
                <filter id="bolt-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="1.5" stdDeviation="1" flood-color="#000" flood-opacity="0.8"/>
                </filter>

                <radialGradient id="bodyOuter" cx="28%" cy="28%" r="72%">
                  <stop offset="0%" stop-color="#ffffff"/>
                  <stop offset="12%" stop-color="#e2e8f0"/>
                  <stop offset="35%" stop-color="#94a3b8"/>
                  <stop offset="65%" stop-color="#475569"/>
                  <stop offset="85%" stop-color="#1e293b"/>
                  <stop offset="100%" stop-color="#090d16"/>
                </radialGradient>
                <linearGradient id="bodyInnerRing" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#0f172a"/>
                  <stop offset="30%" stop-color="#475569"/>
                  <stop offset="50%" stop-color="#f1f5f9"/>
                  <stop offset="70%" stop-color="#334155"/>
                  <stop offset="100%" stop-color="#020617"/>
                </linearGradient>
                <radialGradient id="bodyCenter" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stop-color="#64748b"/>
                  <stop offset="40%" stop-color="#1e293b"/>
                  <stop offset="85%" stop-color="#0f172a"/>
                  <stop offset="100%" stop-color="#020617"/>
                </radialGradient>

                <linearGradient id="polishedSteel" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stop-color="#707a8a"/>
                  <stop offset="25%" stop-color="#cbd5e1"/>
                  <stop offset="50%" stop-color="#475569"/>
                  <stop offset="80%" stop-color="#1e293b"/>
                  <stop offset="100%" stop-color="#0f172a"/>
                </linearGradient>
                <linearGradient id="boltMetal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#e2e8f0"/>
                  <stop offset="50%" stop-color="#64748b"/>
                  <stop offset="100%" stop-color="#334155"/>
                </linearGradient>
                <radialGradient id="ball3D" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stop-color="#94a3b8"/>
                  <stop offset="40%" stop-color="#475569"/>
                  <stop offset="75%" stop-color="#1e293b"/>
                  <stop offset="100%" stop-color="#090d16"/>
                </radialGradient>
                <linearGradient id="machinedLever" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#334155"/>
                  <stop offset="25%" stop-color="#cbd5e1"/>
                  <stop offset="50%" stop-color="#64748b"/>
                  <stop offset="85%" stop-color="#1e293b"/>
                  <stop offset="100%" stop-color="#090d16"/>
                </linearGradient>
                <linearGradient id="premiumBlue" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#025a9c"/>
                  <stop offset="30%" stop-color="#0ea5e9"/>
                  <stop offset="70%" stop-color="#1d4ed8"/>
                  <stop offset="100%" stop-color="#1e3a8a"/>
                </linearGradient>
                <linearGradient id="bodyGroove" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#111827"/>
                  <stop offset="100%" stop-color="#1e293b"/>
                </linearGradient>
              </defs>

              <g filter="url(#shadow-valve)">
                <circle cx="200" cy="100" r="92" fill="url(#bodyOuter)" stroke="#090d16" stroke-width="2.5"/>
                <circle cx="200" cy="100" r="92" fill="none" stroke="var(--accent-color)" stroke-width="2.5" opacity="0.6"/>
                <circle cx="200" cy="100" r="89" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
                
                <circle cx="200" cy="100" r="82" fill="url(#bodyInnerRing)" stroke="#020617" stroke-width="1.5"/>
                <circle cx="200" cy="100" r="74" fill="none" stroke="rgba(0,0,0,0.6)" stroke-width="2"/>

                <circle cx="200" cy="100" r="69" fill="url(#bodyCenter)" stroke="#090d16" stroke-width="2"/>
                <circle cx="200" cy="100" r="67" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>

                <g transform="translate(280, 100)" filter="url(#bolt-shadow)"><polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="url(#boltMetal)" stroke="#1e293b" stroke-width="0.6"/><circle cx="-1.5" cy="-1.5" r="0.8" fill="#fff" opacity="0.6"/></g>
                <g transform="translate(256.5, 156.5)" filter="url(#bolt-shadow)"><polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="url(#boltMetal)" stroke="#1e293b" stroke-width="0.6"/><circle cx="-1.5" cy="-1.5" r="0.8" fill="#fff" opacity="0.6"/></g>
                <g transform="translate(200, 180)" filter="url(#bolt-shadow)"><polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="url(#boltMetal)" stroke="#1e293b" stroke-width="0.6"/><circle cx="-1.5" cy="-1.5" r="0.8" fill="#fff" opacity="0.6"/></g>
                <g transform="translate(143.5, 156.5)" filter="url(#bolt-shadow)"><polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="url(#boltMetal)" stroke="#1e293b" stroke-width="0.6"/><circle cx="-1.5" cy="-1.5" r="0.8" fill="#fff" opacity="0.6"/></g>
                <g transform="translate(120, 100)" filter="url(#bolt-shadow)"><polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="url(#boltMetal)" stroke="#1e293b" stroke-width="0.6"/><circle cx="-1.5" cy="-1.5" r="0.8" fill="#fff" opacity="0.6"/></g>
                <g transform="translate(143.5, 43.5)" filter="url(#bolt-shadow)"><polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="url(#boltMetal)" stroke="#1e293b" stroke-width="0.6"/><circle cx="-1.5" cy="-1.5" r="0.8" fill="#fff" opacity="0.6"/></g>
                <g transform="translate(200, 20)" filter="url(#bolt-shadow)"><polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="url(#boltMetal)" stroke="#1e293b" stroke-width="0.6"/><circle cx="-1.5" cy="-1.5" r="0.8" fill="#fff" opacity="0.6"/></g>
                <g transform="translate(256.5, 43.5)" filter="url(#bolt-shadow)"><polygon points="0,-6 5.2,-3 5.2,3 0,6 -5.2,3 -5.2,-3" fill="url(#boltMetal)" stroke="#1e293b" stroke-width="0.6"/><circle cx="-1.5" cy="-1.5" r="0.8" fill="#fff" opacity="0.6"/></g>

                <circle cx="200" cy="100" r="56" fill="url(#bodyCenter)" stroke="#0a0f14" stroke-width="2"/>
                <circle cx="200" cy="100" r="54" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/>
                <circle cx="200" cy="100" r="44" fill="none" stroke="url(#bodyGroove)" stroke-width="4"/>
                <circle cx="200" cy="100" r="42" fill="none" stroke="rgba(0,0,0,0.8)" stroke-width="1"/>
                <circle cx="200" cy="100" r="32" fill="#07090d" stroke="#161f2b" stroke-width="1.5"/>
                <circle cx="200" cy="100" r="30" fill="none" stroke="#000000" stroke-width="3" opacity="0.9"/>
                <circle cx="200" cy="100" r="32" fill="none" stroke="var(--accent-color)" stroke-width="1.5" opacity="0.4"/>
                <circle cx="200" cy="100" r="29" fill="none" stroke="var(--accent-color)" stroke-width="2" opacity="0.2"/>
              </g>

              <g class="valve-knob" id="valve-knob">
                <circle cx="200" cy="100" r="50" fill="url(#ball3D)"/>
                <circle cx="200" cy="100" r="34" fill="url(#polishedSteel)" stroke="#05070a" stroke-width="1"/>
                <g filter="url(#shadow-lever)">
                  <path d="M 182 93 L 324 82 C 333 82 337 91 337 100 C 337 109 333 118 324 118 L 182 107 Z" fill="url(#machinedLever)" stroke="#05080f" stroke-width="1"/>
                  <path d="M 220 90 L 318 89 C 323 89 326 93 326 100 C 326 107 323 111 318 111 L 220 110 Z" fill="url(#premiumBlue)"/>
                  <path d="M 220 91 L 318 90" stroke="#ffffff" stroke-width="1.2" stroke-opacity="0.35"/>
                  <line x1="290" y1="93" x2="290" y2="107" stroke="#05080f" stroke-width="1.5"/>
                  <line x1="297" y1="93" x2="297" y2="107" stroke="#05080f" stroke-width="1.5"/>
                  <line x1="304" y1="93" x2="304" y2="107" stroke="#05080f" stroke-width="1.5"/>
                  <line x1="311" y1="93" x2="311" y2="107" stroke="#05080f" stroke-width="1.5"/>
                </g>
                <circle cx="200" cy="100" r="10" fill="url(#boltMetal)" stroke="#1e293b" stroke-width="1"/>
                <polygon points="200,94 205.2,97 205.2,103 200,106 194.8,103 194.8,97" fill="url(#polishedSteel)" stroke="#090d14" stroke-width="0.8"/>
                <circle cx="200" cy="100" r="4" fill="url(#boltMetal)"/>
              </g>
            </svg>
          </div>

          <div class="control-row">
            <div class="sensor" id="sensor-bath">
              <div class="sensor-icon-wrap"><svg class="sensor-icon" id="icon-bath" viewBox="0 0 32 32" fill="none"></svg></div>
              <div class="sensor-name" id="label-bath"></div>
              <div class="sensor-state" id="state-bath"></div>
            </div>

            <button type="button" class="action-btn" id="action-btn"></button>

            <div class="sensor" id="sensor-kitchen">
              <div class="sensor-icon-wrap"><svg class="sensor-icon" id="icon-kitchen" viewBox="0 0 32 32" fill="none"></svg></div>
              <div class="sensor-name" id="label-kitchen"></div>
              <div class="sensor-state" id="state-kitchen"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._canvas = this.shadowRoot.getElementById('water-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._initWaterEffects();
    this._attachEvents();
    this._startWaterAnimation();
  }

  static _dropIcon(uid, fillColor, strokeColor) {
    const gid = `dropFill-${uid}`;
    return `
      <defs>
        <linearGradient id="${gid}" x1="16" y1="5" x2="16" y2="27" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${fillColor}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${fillColor}" stop-opacity="0.95"/>
        </linearGradient>
      </defs>
      <path d="M16 5C16 5 9 14.5 9 20C9 23.87 12.13 27 16 27C19.87 27 23 23.87 23 20C23 14.5 16 5 16 5Z" fill="url(#${gid})" stroke="${strokeColor}" stroke-width="1.2"/>`;
  }

  _attachEvents() {
    this._detachEvents();
    this._eventsAC = new AbortController();
    const sig = this._eventsAC.signal;
    const card = this.shadowRoot?.getElementById('card');
    const btn  = this.shadowRoot?.getElementById('action-btn');
    if (!card || !btn) return;

    const onAction = (e) => {
      if (this._isToggling) return;
      e.stopPropagation();
      const ripple = document.createElement('div');
      ripple.className = 'ripple';
      const rect = card.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const cx = (e.clientX ?? rect.left + rect.width / 2) - rect.left;
      const cy = (e.clientY ?? rect.top + rect.height / 2) - rect.top;
      ripple.style.cssText = `width:${size}px;height:${size}px;top:${cy - size / 2}px;left:${cx - size / 2}px;`;
      card.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
      this._toggle();
    };

    card.addEventListener('click', onAction, { signal: sig });
    btn.addEventListener('click', onAction, { signal: sig });
  }

  _detachEvents() {
    if (this._eventsAC) {
      this._eventsAC.abort();
      this._eventsAC = null;
    }
  }

  _initWaterEffects() {
    const MAX_BUBBLES_PER_SIDE = 20;
    const MAX_FLOW_LINES_PER_SIDE = 15;

    this._bubblesLeft = Array.from({length: MAX_BUBBLES_PER_SIDE}, () => this._createBubble(true, 0, 108));
    this._flowLinesLeft = Array.from({length: MAX_FLOW_LINES_PER_SIDE}, () => this._createFlowLine(true, 0, 108));

    this._bubblesRight = Array.from({length: MAX_BUBBLES_PER_SIDE}, () => this._createBubble(true, 292, 400));
    this._flowLinesRight = Array.from({length: MAX_FLOW_LINES_PER_SIDE}, () => this._createFlowLine(true, 292, 400));

    this._leakDrops = [];
  }

  _createBubble(randomY, xMin, xMax) {
    const pipeH = this._pipeInner.bottom - this._pipeInner.top;
    const halfH = pipeH / 2 * 0.75;
    const yMin = this._pipeInner.top + pipeH/2 - halfH + 4;
    const yMax = this._pipeInner.top + pipeH/2 + halfH - 4;
    return {
      x: xMin + Math.random() * (xMax - xMin),
      y: randomY ? yMin + Math.random() * (yMax - yMin) : yMin + Math.random() * (yMax - yMin),
      radius: 1.5 + Math.random() * 3.5,
      speedX: 0.2 + Math.random() * 0.6,
      speedY: (Math.random() - 0.5) * 0.08,
      wobble: Math.random() * 100,
      wobbleSpeed: 0.02 + Math.random() * 0.03,
      wobbleAmp: 0.2 + Math.random() * 0.5,
      opacity: 0.2 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      xMin, xMax
    };
  }

  _createFlowLine(randomY, xMin, xMax) {
    const pipeH = this._pipeInner.bottom - this._pipeInner.top;
    const halfH = pipeH / 2 * 0.75;
    const yMin = this._pipeInner.top + pipeH/2 - halfH + 4;
    const yMax = this._pipeInner.top + pipeH/2 + halfH - 4;
    return {
      x: xMin + Math.random() * (xMax - xMin),
      y: randomY ? yMin + Math.random() * (yMax - yMin) : yMin + Math.random() * (yMax - yMin),
      length: 20 + Math.random() * 60,
      speed: 0.4 + Math.random() * 1.0,
      opacity: 0.04 + Math.random() * 0.1,
      width: 0.4 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      xMin, xMax
    };
  }

  _getWaterSurfaceY(x, waterTopY, t, scale = 1) {
    const w1 = Math.sin(x * 0.012 + t * 0.9) * 5 * scale;
    const w2 = Math.sin(x * 0.025 + t * 1.3 + 1.7) * 3 * scale;
    const w3 = Math.sin(x * 0.005 + t * 0.5 + 3.2) * 6 * scale;
    const w4 = Math.cos(x * 0.018 + t * 0.7 + 0.8) * 2.5 * scale;
    return waterTopY + w1 + w2 + w3 + w4;
  }

  _drawWaterRegion(xStart, xEnd, waterLevel, wCard, scale) {
    if (waterLevel <= 0) return;
    const ctx = this._ctx;
    const t = this._waterTime;
    const pY = this._pipeInner.top, pH = this._pipeInner.bottom - pY;
    const waterBottomY = this._pipeInner.bottom;
    const waterH = pH * waterLevel;
    const waterTopY = pY + pH - waterH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, pY, wCard, pH);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(xStart, pY, xEnd - xStart, pH);
    ctx.clip();

    const grad1 = ctx.createLinearGradient(0, waterTopY, 0, waterBottomY);
    grad1.addColorStop(0, 'rgba(10, 80, 140, 0.25)');
    grad1.addColorStop(0.4, 'rgba(8, 60, 120, 0.40)');
    grad1.addColorStop(0.7, 'rgba(6, 45, 95, 0.55)');
    grad1.addColorStop(1, 'rgba(4, 30, 70, 0.70)');
    ctx.fillStyle = grad1;
    ctx.fillRect(xStart, waterTopY, xEnd - xStart, waterH);

    ctx.beginPath();
    ctx.moveTo(xStart, waterTopY);
    const step = 3;
    for (let x = xStart; x <= xEnd; x += step) {
      const y = Math.max(pY + 4 * scale, Math.min(waterBottomY - 4 * scale, this._getWaterSurfaceY(x, waterTopY, t, scale)));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(xEnd, waterBottomY);
    ctx.lineTo(xStart, waterBottomY);
    ctx.closePath();

    const surfGrad = ctx.createLinearGradient(0, waterTopY - 10 * scale, 0, waterTopY + 30 * scale);
    surfGrad.addColorStop(0, 'rgba(60, 200, 255, 0.35)');
    surfGrad.addColorStop(0.3, 'rgba(30, 160, 230, 0.45)');
    surfGrad.addColorStop(0.7, 'rgba(15, 110, 190, 0.55)');
    surfGrad.addColorStop(1, 'rgba(8, 70, 140, 0.50)');
    ctx.fillStyle = surfGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xStart, waterTopY);
    for (let x = xStart; x <= xEnd; x += step) {
      const y = Math.max(pY + 2 * scale, Math.min(waterBottomY - 2 * scale, this._getWaterSurfaceY(x, waterTopY, t, scale)));
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(180, 240, 255, 0.25)';
    ctx.lineWidth = 1.8 * scale;
    ctx.stroke();

    ctx.restore();
  }

  _drawBubblesAndFlowForRegion(bubbles, flowLines, xStart, xEnd, waterLevel, wCard, scale) {
    if (waterLevel <= 0) return;
    const ctx = this._ctx;
    const t = this._waterTime;
    const pY = this._pipeInner.top, pH = this._pipeInner.bottom - pY;
    const waterBottomY = this._pipeInner.bottom;
    const waterH = pH * waterLevel;
    const waterTopY = pY + pH - waterH;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, pY, wCard, pH);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(xStart, pY, xEnd - xStart, pH);
    ctx.clip();

    for (const b of bubbles) {
      b.x += b.speedX + Math.sin(b.wobble + t * b.wobbleSpeed) * 0.1;
      b.y += b.speedY + Math.sin(b.wobble + t * b.wobbleSpeed * 0.7) * b.wobbleAmp * 0.03;
      const surfaceY = this._getWaterSurfaceY(b.x, waterTopY, t, scale);
      b.y = Math.max(surfaceY + 4 * scale, Math.min(waterBottomY - 4 * scale, b.y));
      if (b.x > xEnd + 10) b.x = xStart - 10 + Math.random() * (xEnd - xStart);
      if (b.x < xStart - 10) b.x = xEnd + 10 - Math.random() * (xEnd - xStart);

      const alpha = b.opacity * (0.7 + 0.3 * Math.sin(t * 0.5 + b.phase));
      const r = b.radius * scale;
      ctx.beginPath();
      ctx.ellipse(b.x + 1, b.y + 1, r * 0.8, r * 0.6, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha * 0.15})`;
      ctx.fill();

      const grad = ctx.createRadialGradient(b.x - r * 0.3, b.y - r * 0.3, r * 0.1, b.x, b.y, r);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.85})`);
      grad.addColorStop(0.3, `rgba(200, 240, 255, ${alpha * 0.5})`);
      grad.addColorStop(0.7, `rgba(120, 200, 240, ${alpha * 0.25})`);
      grad.addColorStop(1, `rgba(80, 160, 210, ${alpha * 0.05})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();

      if (r > 2 * scale) {
        ctx.beginPath();
        ctx.ellipse(b.x - r * 0.3, b.y - r * 0.3, r * 0.3, r * 0.2, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.5})`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(200, 240, 255, ${alpha * 0.12})`;
      ctx.lineWidth = 0.5 * scale;
      ctx.stroke();
    }

    for (const fl of flowLines) {
      fl.x += fl.speed;
      fl.y += Math.sin(fl.phase + t * 0.3 + fl.x * 0.005) * 0.05;
      const surfaceY = this._getWaterSurfaceY(fl.x, waterTopY, t, scale);
      fl.y = Math.max(surfaceY + 6 * scale, Math.min(waterBottomY - 6 * scale, fl.y));
      if (fl.x > xEnd + 20) fl.x = xStart - 20 + Math.random() * (xEnd - xStart);
      const alpha = fl.opacity * (0.7 + 0.3 * Math.sin(t * 0.2 + fl.phase));
      const grad = ctx.createLinearGradient(fl.x, fl.y, fl.x + fl.length, fl.y);
      grad.addColorStop(0, 'rgba(180, 230, 255, 0)');
      grad.addColorStop(0.3, `rgba(180, 230, 255, ${alpha * 0.8})`);
      grad.addColorStop(0.7, `rgba(180, 230, 255, ${alpha * 0.8})`);
      grad.addColorStop(1, 'rgba(180, 230, 255, 0)');
      ctx.beginPath();
      ctx.moveTo(fl.x, fl.y);
      ctx.lineTo(fl.x + fl.length, fl.y + Math.sin(fl.phase + t * 0.2 + fl.x * 0.01) * 1);
      ctx.strokeStyle = grad;
      ctx.lineWidth = fl.width * scale;
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawGlassPipe(wCard, centerY, scale) {
    const ctx = this._ctx;
    const pipeX = 0, pipeW = wCard;
    const pipeY = centerY - 24 * scale;
    const pipeH = 48 * scale;
    const radius = 8 * scale;
    ctx.beginPath();
    ctx.moveTo(pipeX + radius, pipeY);
    ctx.lineTo(pipeX + pipeW - radius, pipeY);
    ctx.quadraticCurveTo(pipeX + pipeW, pipeY, pipeX + pipeW, pipeY + radius);
    ctx.lineTo(pipeX + pipeW, pipeY + pipeH - radius);
    ctx.quadraticCurveTo(pipeX + pipeW, pipeY + pipeH, pipeX + pipeW - radius, pipeY + pipeH);
    ctx.lineTo(pipeX + radius, pipeY + pipeH);
    ctx.quadraticCurveTo(pipeX, pipeY + pipeH, pipeX, pipeY + pipeH - radius);
    ctx.lineTo(pipeX, pipeY + radius);
    ctx.quadraticCurveTo(pipeX, pipeY, pipeX + radius, pipeY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(180, 220, 255, 0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.20)';
    ctx.lineWidth = 1.8 * scale;
    ctx.stroke();

    const inset = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(pipeX + radius + inset, pipeY + inset);
    ctx.lineTo(pipeX + pipeW - radius - inset, pipeY + inset);
    ctx.quadraticCurveTo(pipeX + pipeW - inset, pipeY + inset, pipeX + pipeW - inset, pipeY + radius + inset);
    ctx.lineTo(pipeX + pipeW - inset, pipeY + pipeH - radius - inset);
    ctx.quadraticCurveTo(pipeX + pipeW - inset, pipeY + pipeH - inset, pipeX + pipeW - radius - inset, pipeY + pipeH - inset);
    ctx.lineTo(pipeX + radius + inset, pipeY + pipeH - inset);
    ctx.quadraticCurveTo(pipeX + inset, pipeY + pipeH - inset, pipeX + inset, pipeY + pipeH - radius - inset);
    ctx.lineTo(pipeX + inset, pipeY + radius + inset);
    ctx.quadraticCurveTo(pipeX + inset, pipeY + inset, pipeX + radius + inset, pipeY + inset);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(200, 235, 255, 0.08)';
    ctx.lineWidth = 0.8 * scale;
    ctx.stroke();
  }

  _drawGlassReflections(t, wCard, centerY, scale) {
    const ctx = this._ctx;
    const pipeX = 0, pipeW = wCard;
    const pipeY = centerY - 24 * scale;
    const pipeH = 48 * scale;
    
    const grad1 = ctx.createLinearGradient(0, pipeY, 0, pipeY + 20 * scale);
    grad1.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    grad1.addColorStop(0.5, 'rgba(200, 230, 255, 0.03)');
    grad1.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad1;
    ctx.beginPath();
    ctx.roundRect(pipeX + 10 * scale, pipeY + 2 * scale, pipeW - 20 * scale, 18 * scale, 3 * scale);
    ctx.fill();

    const grad2 = ctx.createLinearGradient(0, pipeY + pipeH - 16 * scale, 0, pipeY + pipeH);
    grad2.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad2.addColorStop(0.5, 'rgba(180, 210, 240, 0.02)');
    grad2.addColorStop(1, 'rgba(255, 255, 255, 0.04)');
    ctx.fillStyle = grad2;
    ctx.beginPath();
    ctx.roundRect(pipeX + 10 * scale, pipeY + pipeH - 18 * scale, pipeW - 20 * scale, 16 * scale, 3 * scale);
    ctx.fill();

    const gradL = ctx.createLinearGradient(pipeX, pipeY, pipeX + 16 * scale, pipeY);
    gradL.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
    gradL.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradL;
    ctx.fillRect(pipeX + 2 * scale, pipeY + 8 * scale, 14 * scale, pipeH - 16 * scale);

    const gradR = ctx.createLinearGradient(pipeX + pipeW, pipeY, pipeX + pipeW - 16 * scale, pipeY);
    gradR.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
    gradR.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradR;
    ctx.fillRect(pipeX + pipeW - 16 * scale, pipeY + 8 * scale, 14 * scale, pipeH - 16 * scale);

    const staticGlints = [0.15, 0.35, 0.65, 0.85];
    for (const ratio of staticGlints) {
      const x = pipeX + pipeW * ratio;
      const grad = ctx.createRadialGradient(x, pipeY + 5 * scale, 1, x, pipeY + 5 * scale, 25 * scale);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, pipeY + 5 * scale, 30 * scale, 5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawCondensation(t, wCard, centerY, scale) {
    const ctx = this._ctx;
    const pipeX = 0, pipeW = wCard;
    const pipeY = this._pipeInner.top, pipeH = this._pipeInner.bottom - pipeY;
    const count = 15;
    for (let i = 0; i < count; i++) {
      const seed = i * 1.7 + 0.3;
      const x = pipeX + 10 * scale + (pipeW - 20 * scale) * (0.5 + 0.5 * Math.sin(seed + t * 0.01));
      const y = pipeY + 6 * scale + (pipeH - 12 * scale) * (0.5 + 0.5 * Math.cos(seed * 0.7 + t * 0.015 + 1.2));
      const r = (0.4 + 1.2 * (0.5 + 0.5 * Math.sin(seed * 1.3 + t * 0.005))) * scale;
      const surfaceY = this._getWaterSurfaceY(x, pipeY + pipeH - pipeH * this._waterLevelLeft, t, scale);
      if (y < surfaceY - 3 * scale) {
        const alpha = 0.06 + 0.1 * (0.5 + 0.5 * Math.sin(seed * 0.9 + t * 0.02));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 235, 255, ${alpha * 0.4})`;
        ctx.fill();
        if (r > 1 * scale) {
          ctx.beginPath();
          ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
          ctx.fill();
        }
      }
    }
  }

  _drawLeakDrops(wCard, centerY, scale) {
    if (!this._hasLeak) return;
    const ctx = this._ctx;
    const t = this._waterTime;
    const pipeBottom = this._pipeInner.bottom;

    if (this._leakDrops.length < this._maxLeakDrops && Math.random() < 0.07) {
      this._leakDrops.push({
        x: 15 * scale + Math.random() * (wCard - 30 * scale),
        y: pipeBottom + 2 * scale,
        radius: 3.5 + Math.random() * 2.5, 
        speedY: 0.2,                      
        gravity: (0.14 + Math.random() * 0.06) * scale, 
        opacity: 0.7 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
        wobble: Math.random() * 100,
        wobbleSpeed: 0.02 + Math.random() * 0.03
      });
    }

    for (let i = this._leakDrops.length - 1; i >= 0; i--) {
      const d = this._leakDrops[i];
      d.speedY += d.gravity;
      d.y += d.speedY;
      d.x += Math.sin(d.wobble + t * d.wobbleSpeed) * 0.15 * scale; 
      const alpha = d.opacity * (0.8 + 0.2 * Math.sin(t * 0.4 + d.phase));

      if (d.y > 200) {
        this._leakDrops.splice(i, 1);
        continue;
      }

      const rScaled = d.radius * scale;
      const grad = ctx.createRadialGradient(d.x - rScaled * 0.2, d.y - rScaled * 0.2, rScaled * 0.1, d.x, d.y + rScaled * 0.5, rScaled * 1.2);
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
      grad.addColorStop(0.4, `rgba(130, 210, 255, ${alpha * 0.9})`);
      grad.addColorStop(0.8, `rgba(40, 140, 230, ${alpha * 0.85})`);
      grad.addColorStop(1, `rgba(20, 90, 200, ${alpha * 0.7})`);

      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.beginPath();
      ctx.moveTo(0, -rScaled * 1.2);
      ctx.bezierCurveTo(rScaled * 0.7, -rScaled * 0.8, rScaled * 1.0, rScaled * 0.4, 0, rScaled);
      ctx.bezierCurveTo(-rScaled * 1.0, rScaled * 0.4, -rScaled * 0.7, -rScaled * 0.8, 0, -rScaled * 1.2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(-rScaled * 0.25, -rScaled * 0.35, rScaled * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
      ctx.fill();
      ctx.restore();
    }
  }

  _drawWaterFrame() {
    if (!this._ctx || !this._canvas) return;
    const ctx = this._ctx;

    const wCard = this._canvas.clientWidth || 400;
    const hCard = this._canvas.clientHeight || 200;

    if (this._canvas.width !== wCard || this._canvas.height !== hCard) {
      this._canvas.width = wCard;
      this._canvas.height = hCard;
    }

    ctx.clearRect(0, 0, wCard, hCard);

    const wPhysical = Math.min(400, wCard);
    const scale = wPhysical / 400;
    const centerY = hCard / 2; // Динамічно визначаємо центр поточної висоти блоку

    // Динамічно адаптуємо верхню і нижню межі рідини під новий центр і масштаб
    this._pipeInner.top = centerY - 21 * scale;
    this._pipeInner.bottom = centerY + 21 * scale;

    const centerX = wCard / 2;
    const leftXEnd = centerX - 92 * scale;  
    const rightXStart = centerX + 92 * scale;

    // Ліва частина
    this._drawWaterRegion(0, leftXEnd, this._waterLevelLeft, wCard, scale);
    this._drawBubblesAndFlowForRegion(this._bubblesLeft, this._flowLinesLeft, 0, leftXEnd, this._waterLevelLeft, wCard, scale);

    // Права частина
    this._drawWaterRegion(rightXStart, wCard, this._waterLevelRight, wCard, scale);
    this._drawBubblesAndFlowForRegion(this._bubblesRight, this._flowLinesRight, rightXStart, wCard, this._waterLevelRight, wCard, scale);

    // Спільні ефекти скляної труби та крапель із прив'язкою до динамічного центру
    this._drawLeakDrops(wCard, centerY, scale);
    this._drawGlassPipe(wCard, centerY, scale);
    this._drawGlassReflections(this._waterTime, wCard, centerY, scale);
    this._drawCondensation(this._waterTime, wCard, centerY, scale);
  }

  _startWaterAnimation() {
    if (this._waterAnimationId !== null) return;
    const loop = () => {
      if (!this.isConnected) {
        this._stopWaterAnimation();
        return;
      }
      this._waterTime += 0.025;

      const update = (cur, target) => Math.abs(cur - target) > 0.001 ? cur + (target - cur) * this._waterTransitionSpeed : target;
      this._waterLevelLeft = update(this._waterLevelLeft, this._targetWaterLevelLeft);
      this._waterLevelRight = update(this._waterLevelRight, this._targetWaterLevelRight);

      this._drawWaterFrame();
      this._waterAnimationId = requestAnimationFrame(loop);
    };
    this._waterAnimationId = requestAnimationFrame(loop);
  }

  _stopWaterAnimation() {
    if (this._waterAnimationId !== null) {
      cancelAnimationFrame(this._waterAnimationId);
      this._waterAnimationId = null;
    }
  }

  _render() {
    if (!this._hass || !this._config) return;
    this._ensureTemplate();

    const cfg = this._config;
    const d = this._getData();
    const batteryState = cfg.kran_battery_entity ? this._state(cfg.kran_battery_entity) : null;

    const visualState = this._isToggling ? this._targetState : (d.valveState === 'open' ? 'open' : 'closed');
    const isOpen = visualState === 'open';
    this._hasLeak = d.hasLeak;

    this._targetWaterLevelLeft = 0.75;
    this._targetWaterLevelRight = isOpen ? 0.75 : 0;

    const renderKey = this._isToggling
      ? `toggling-${this._targetState}|${batteryState}|${d.bathLeak}|${d.kitLeak}|${cfg.name}`
      : `static-${d.valveState}|${batteryState}|${d.bathLeak}|${d.kitLeak}|${cfg.name}`;

    if (this._lastKey === renderKey) return;
    this._lastKey = renderKey;

    const r = this.shadowRoot;
    const card = r.getElementById('card');

    let stateLabel, statusText, accentColor, accentGlow, dotColor, dotClass, rotation;

    if (d.hasLeak) {
      stateLabel = 'ПРОТІЧКА!';
      statusText = d.bathLeak && d.kitLeak ? 'Аварія: витік у ванній та на кухні!' : d.bathLeak ? 'Протікання у ванній кімнаті!' : 'Протікання на кухні!';
      accentColor = '#ef4444'; accentGlow = 'rgba(239,68,68,0.5)'; dotColor = '#ef4444'; dotClass = 'dot leak';
    } else if (this._isToggling) {
      stateLabel = this._targetState === 'open' ? 'ВІДКРИВАЄТЬСЯ' : 'ЗАКРИВАЄТЬСЯ';
      statusText = this._targetState === 'open' ? 'Привід рівномірно повертає затвор магістралі' : 'Електропривід виконує планове відсікання потоку';
      accentColor = '#eab308'; accentGlow = 'rgba(234,179,8,0.35)'; dotColor = '#eab308'; dotClass = 'dot blink';
    } else if (isOpen) {
      stateLabel = 'ВІДКРИТО'; statusText = 'Система активна, тиск стабільний';
      accentColor = '#0ea5e9'; accentGlow = 'rgba(14,165,233,0.4)'; dotColor = '#10b981'; dotClass = 'dot pulse';
    } else if (d.valveState === 'unknown') {
      stateLabel = 'НЕВІДОМО'; statusText = 'Стан запірного клапана не визначено';
      accentColor = '#6b7280'; accentGlow = 'rgba(107,114,128,0.15)'; dotColor = '#6b7280'; dotClass = 'dot';
    } else {
      stateLabel = 'ЗАКРИТО'; statusText = 'Подачу води повністю заблоковано приводом';
      accentColor = '#dc2626'; accentGlow = 'rgba(220,38,38,0.35)'; dotColor = '#dc2626'; dotClass = 'dot';
    }

    rotation = isOpen ? '0deg' : ((d.valveState === 'unknown' && !this._isToggling) ? '45deg' : '90deg');

    card.style.setProperty('--accent-color', accentColor);
    card.style.setProperty('--accent-glow', accentGlow);
    card.style.setProperty('--dot-color', dotColor);
    card.style.setProperty('--valve-rotation', rotation);
    card.style.setProperty('--valve-duration', `${cfg.toggle_lock_ms / 1000}s`);

    card.classList.toggle('has-leak', d.hasLeak);
    card.classList.toggle('disabled-card', this._isToggling);

    r.getElementById('name').textContent = cfg.name.toUpperCase();
    r.getElementById('state-label').textContent = stateLabel;
    r.getElementById('status-text').textContent = statusText;
    r.getElementById('dot').className = dotClass;

    const batContainer = r.getElementById('battery-container');
    if (batContainer) {
      if (!cfg.kran_battery_entity) {
        batContainer.style.display = 'none';
      } else {
        batContainer.style.display = '';
        const batVal = parseFloat(batteryState);
        r.getElementById('battery-text').textContent = isNaN(batVal) ? '—%' : `${batVal}%`;
        const batBar = r.getElementById('battery-level-bar');
        if (batBar) {
          if (!isNaN(batVal)) {
            const width = Math.max(0, Math.min(14, (batVal / 100) * 14));
            batBar.setAttribute('width', width.toString());
            batBar.setAttribute('fill', batVal < 20 ? '#ef4444' : batVal < 45 ? '#eab308' : '#10b981');
          } else {
            batBar.setAttribute('width', '0');
            batBar.setAttribute('fill', '#10b981');
          }
        }
      }
    }

    this._updateSensor(r, 'bath', cfg.bathroom_label, d.bathLeak, cfg.text_dry, cfg.text_leak, cfg.bathroom_leak_entity);
    this._updateSensor(r, 'kitchen', cfg.kitchen_label, d.kitLeak, cfg.text_dry, cfg.text_leak, cfg.kitchen_leak_entity);

    const btn = r.getElementById('action-btn');
    btn.classList.toggle('disabled', this._isToggling);
    btn.classList.toggle('closed', !isOpen);
    btn.classList.toggle('leak-shut', d.hasLeak && isOpen);

    if (this._isToggling) {
      btn.textContent = this._targetState === 'open' ? 'ВІДКРИВАЄТЬСЯ...' : 'ЗАКРИВАЄТЬСЯ...';
    } else if (d.hasLeak && isOpen) {
      btn.textContent = cfg.btn_close;
    } else if (isOpen) {
      btn.textContent = cfg.btn_close;
    } else {
      btn.textContent = cfg.btn_open;
    }
  }

  _updateSensor(root, id, label, isLeak, textDry, textLeak, entityId) {
    const el = root.getElementById(`sensor-${id}`);
    if (!el) return;
    if (!entityId) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const icon = root.getElementById(`icon-${id}`);
    el.classList.toggle('leak', isLeak);
    root.getElementById(`label-${id}`).textContent = (label || id).toUpperCase();
    root.getElementById(`state-${id}`).textContent = isLeak ? textLeak : textDry;
    const fill = isLeak ? '#ef4444' : '#10b981';
    const stroke = isLeak ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.3)';
    icon.innerHTML = WaterValveCard._dropIcon(id, fill, stroke);
  }

  getCardSize() { return 6; }

  static getStubConfig() {
    return {
      name: 'Водяний кран',
      switch_entity: '',
    };
  }

  static getConfigElement() {
    return document.createElement('water-valve-card-editor');
  }
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    const r = typeof radii === 'number' ? radii : (radii || 0);
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r);
    this.quadraticCurveTo(x, y, x + r, y);
    return this;
  };
}

customElements.define('water-valve-card', WaterValveCard);



/* ── Visual editor (форма вводу в UI) ── */
class WaterValveCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _valueChanged(ev) {
    if (!this._config || !ev.detail) return;
    this._config = { ...this._config, ...ev.detail.value };
    // remove empty optional keys
    for (const k of ['valve_state_entity', 'kran_battery_entity', 'bathroom_leak_entity', 'kitchen_leak_entity']) {
      if (!this._config[k]) delete this._config[k];
    }
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
  }

  _render() {
    if (!this._config) return;
    if (!this._form) {
      this.innerHTML = '';
      this._form = document.createElement('ha-form');
      this._form.addEventListener('value-changed', (ev) => this._valueChanged(ev));
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = this._config;
    this._form.schema = [
      {
        name: 'name',
        label: 'Назва',
        selector: { text: {} },
      },
      {
        name: 'switch_entity',
        label: 'Кран (обовʼязково)',
        required: true,
        selector: { entity: { domain: ['switch', 'valve'] } },
      },
      {
        name: 'valve_state_entity',
        label: 'Сенсор стану крана (опційно)',
        selector: { entity: { domain: ['sensor', 'binary_sensor'] } },
      },
      {
        name: 'bathroom_leak_entity',
        label: 'Датчик протічки 1 (опційно)',
        selector: { entity: { domain: 'binary_sensor' } },
      },
      {
        name: 'kitchen_leak_entity',
        label: 'Датчик протічки 2 (опційно)',
        selector: { entity: { domain: 'binary_sensor' } },
      },
      {
        name: 'kran_battery_entity',
        label: 'Батарея крана (опційно)',
        selector: { entity: { domain: 'sensor' } },
      },
    ];
    this._form.computeLabel = (schema) => schema.label || schema.name;
  }
}

customElements.define('water-valve-card-editor', WaterValveCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'water-valve-card',
  name: 'Water Valve Card',
  description: 'Кран + опційні датчики протічки. Без інтеграції — лише картка.',
  preview: true,
});