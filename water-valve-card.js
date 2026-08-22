
/* early registration for card picker — the card renders a safe empty
   state (name + status only) when hass/config/switch_entity aren't set
   yet, so the live preview thumbnail is safe to show. */
window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "water-valve-card")) {
  window.customCards.push({
    type: "water-valve-card",
    name: "Water Valve Card",
    preview: true,
    description: "Smart water valve / Водяний кран",
    documentationURL: "https://github.com/kdinya/smart-water-valve",
  });
}
console.info("%c WATER-VALVE-CARD %c loading 5.0.4 ", "background:#0369a1;color:#fff;font-weight:bold", "background:#0f172a;color:#38bdf8");

// ═══════════════════════════════════════════════════════════════
//  Water Valve Card  v5.0.4 — труба без шва (одна точка розділу по центру
//  canvas замість виміряних країв крана), рівень води синхронізовано з
//  toggle_lock_ms, кран масштабується шириною (без переповнення в шапку),
//  щільніші квадратні датчики протічки, окремий текст кнопки
//  "відкривається/закривається".
// ═══════════════════════════════════════════════════════════════

// Скільки датчиків протічки редактор дозволяє додати. Порядок на картці:
// 1 — ліворуч від кнопки, 2 — праворуч від кнопки, 3 — над датчиком 1,
// 4 — над датчиком 2. Модель даних (config.leak_sensors) сама по собі
// довільної довжини, ліміт лише тут та в шаблоні картки (яка малює
// конкретно MAX_LEAK_SENSORS блоків, id sensor-0..sensor-3).
const MAX_LEAK_SENSORS = 4;

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
    this._io = null;
    this._isIntersecting = true;
    this._visibilityHandler = null;

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

    // Fixed lerp speed replaced by _getWaterLerpFactor() (v5.0.4) — the
    // water-fill/drain animation now derives its speed from toggle_lock_ms
    // (the SAME config value that drives the valve-knob CSS rotation
    // duration), so both finish together instead of drifting apart when
    // someone configures a non-default toggle time.

    // Бульбашки та лінії течії
    this._bubblesLeft = [];
    this._bubblesRight = [];
    this._flowLinesLeft = [];
    this._flowLinesRight = [];

    // Краплі протічки
    this._leakDrops = [];
    this._maxLeakDrops = 6; 
    this._hasLeak = false;
    this._staticLayerCanvas = null;
    this._staticLayerCtx = null;
    this._staticLayerKey = '';
    this._holdFired = false;
    this._closedAt = null;

    this._waterTime = 0;

    // Геометрія труби — динамічно адаптується в кожному кадрі
    this._pipeInner = {
      left: 0,
      right: 400,
      top: 79,
      bottom: 121
    };
    // v5.0.4: труба більше не ділиться по виміряних краях крана
    // (getBoundingClientRect крана в canvas-координатах) — цей підхід
    // ламався щоразу, коли --valve-scale і --pipes-scale різні (типова
    // конфігурація "мобільний/планшет"), лишаючи порожню, незаповнену
    // водою ділянку труби між виміряним краєм і фактичним малюнком.
    // Тепер ліва й права половини завжди сходяться РІВНО по центру
    // canvas (wCard / 2) — див. _pipeSplitX() — тобто це той самий
    // центр, навколо якого canvas і сам кран масштабуються
    // (transform-origin: center), тож шва не видно на жодному масштабі.
  }

  // Єдина точка істини для того, де ліва (вхідна) труба закінчується, а
  // права (вихідна) починається: точно посередині canvas. Використовується
  // і для малювання води, і для бульбашок/течії — тому шов гарантовано не
  // з'являється навіть при різних --valve-scale/--pipes-scale.
  static _pipeSplitX(wCard) {
    return wCard / 2;
  }

  static get _css() {
    return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :host {
      display: block;
      font-family: var(--primary-font-family, 'Roboto', 'Inter', -apple-system, sans-serif);
      /* Breakpoints below react to the CARD's own rendered width via
         @container, NOT the phone/browser viewport via @media. In an HA
         masonry/grid dashboard the viewport can cross 600px on rotation
         even while the card's actual column width barely changes — @media
         was reacting to the wrong box, which is why the valve/pipes could
         jump to "tablet" scale in landscape and not cleanly revert. */
      container-type: inline-size;
      container-name: wvc;
    }

    .card {
      position: relative;
      overflow: hidden;
      border-radius: 28px;
      padding: 16px 20px 14px;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      border: 1px solid rgba(255,255,255,0.05);
      background:
        radial-gradient(ellipse 120% 80% at 50% -10%, rgba(56,189,248,0.05) 0%, transparent 65%),
        linear-gradient(165deg, #11151d 0%, #05070a 100%);
      box-shadow:
        0 30px 70px rgba(0,0,0,0.9),
        inset 0 1px 0 rgba(255,255,255,0.06);
      transition: border-color 0.6s ease, box-shadow 0.6s ease;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      /* card_min_height / card_height (px), set as inline custom props by
         _render(). Phones (viewport < 600px) always use the minimum value;
         tablets/desktops use the fixed "current" value if one is set,
         falling back to the minimum, falling back to auto. */
      min-height: var(--wvc-height-min, auto);
      height: var(--wvc-height-min, auto);
    }
    @container wvc (min-width: 600px) {
      .card {
        height: var(--wvc-height-fixed, var(--wvc-height-min, auto));
      }
    }
    /* Card body itself is no longer a tap target — only .action-btn is. */

    .card.has-leak {
      border-color: rgba(239,68,68,0.5);
      box-shadow: 0 30px 70px rgba(0,0,0,0.9), 0 0 35px rgba(239,68,68,0.2), inset 0 0 25px rgba(239,68,68,0.05);
      animation: card-leak-glow 2s ease-in-out infinite;
    }
    @keyframes card-leak-glow {
      0%, 100% { border-color: rgba(239,68,68,0.4); }
      50%       { border-color: rgba(239,68,68,0.75); }
    }

    /* Fills the card's height so .control-row (the buttons/sensors) can be
       pinned to the bottom edge with margin-top:auto below, instead of
       risking getting clipped by .card's overflow:hidden when a small
       card_min_height/card_height is configured. */
    .content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
      flex-shrink: 0;
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

    .indicators {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .battery-container, .signal-container {
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
    .signal-svg {
      width: 16px;
      height: 12px;
      overflow: visible;
    }
    .battery-text, .signal-text {
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
      flex-shrink: 0;
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
    .closed-at {
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      margin-top: 2px;
      line-height: 1.3;
      flex-shrink: 0;
    }

    .valve-section {
      position: relative;
      width: 100%;
      margin: 2px 0 36px 0;
      pointer-events: none;
      flex: 1 1 auto;
      min-height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      /* Was overflow: hidden, which combined with the transform below to
         force-shrink the valve on short/mobile cards and let the button
         row paint over the (visually larger) valve. Now visible, with an
         explicit z-index above .control-row, so scale/offset are fully
         config-driven instead of fighting the container box, and the
         valve+pipes always render above the buttons, never under them. */
      overflow: visible;
      z-index: 3;
      /* --valve-offset-pct: vertical position of the whole valve+pipes
         assembly, in % of this element's own height, set by the visual
         editor's slider. 0% = centered. Scale now lives on the valve svg
         and water canvas individually — see below — so each can have its
         own mobile/tablet max size instead of one shared multiplier. */
      transform: translateY(var(--valve-offset-pct, 0%));
      /* Mobile (<600px) scale multipliers by default; overridden for
         tablet/desktop below. */
      --valve-scale: var(--valve-scale-mobile, 1.15);
      --pipes-scale: var(--pipes-scale-mobile, 1.15);
    }
    @container wvc (min-width: 600px) {
      .valve-section {
        --valve-scale: var(--valve-scale-tablet, 1.15);
        --pipes-scale: var(--pipes-scale-tablet, 1.15);
      }
    }

    .valve-svg {
      display: block;
      /* v5.0.4: scale used to be a CSS transform, which never affects
         layout size — .valve-section's flex height was reserved for the
         UNSCALED svg, so at scale > 1 the (visually bigger) valve simply
         painted outside its box. With overflow:visible that meant it could
         cover the header text above it, and how much depended on which
         --valve-scale (mobile vs. tablet) the current @container breakpoint
         picked — which is exactly why it looked different after rotating
         the phone (crossing the breakpoint) and why there was a one-frame
         "too big" flash while the container query re-evaluated. Scaling the
         actual WIDTH instead makes the svg's real aspect-ratio-driven
         height grow with it, so flex reserves the correct space up front —
         no overflow, no flash, same result in every orientation. */
      width: calc(min(100%, 400px) * var(--valve-scale, 1.15));
      height: auto;
      margin: 0 auto;
      overflow: visible;
      z-index: 2;
      position: relative;
      pointer-events: auto;
    }

    .valve-knob {
      transform-origin: 200px 100px;
      transition: transform var(--valve-duration, 8s) linear;
      transform: rotate(var(--valve-rotation, 0deg));
    }

    /* Top row for leak sensors 3/4 (positioned above sensors 1/2). Hidden
       entirely (not just empty) when neither is configured, so the
       original 2-sensor layout is pixel-identical to before.
       CSS Grid instead of flex+aspect-ratio: flex-basis:0 + aspect-ratio
       is unreliable in some WebViews (Android system WebView used by the
       HA app in particular) — Grid tracks give the .sensor cells a real,
       stable width to base aspect-ratio:1/1 on, so they render as true
       squares everywhere. */
    .control-row-top, .control-row {
      display: grid;
      grid-template-columns: 1fr 2fr 1fr;
      align-items: end;
      gap: 12px;
      flex-shrink: 0;
    }
    .control-row-top { margin-bottom: 8px; }
    .control-row { margin-top: 10px; position: relative; z-index: 1; }
    .sensor {
      width: 100%; aspect-ratio: 1 / 1; height: auto;
      /* v5.0.4: own container so the icon/name/state below can size
         themselves off the SQUARE's actual rendered size (cqw/cqh) instead
         of fixed px — on a small phone or a tight card_min_height these
         blocks can render well under 60px on a side, and fixed 28px icon +
         9px/14px text simply didn't fit, so the state text or the icon got
         clipped by "overflow: hidden" below. */
      container-type: inline-size;
      display: flex; flex-direction: column;
      align-items: center; justify-content: space-between;
      /* Packed tightly against the top/bottom edge instead of centered as
         one loose group: drop icon right at the top, name in the true
         middle, dry/leak state right at the bottom. */
      padding: 8% 6%;
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
    /* clamp(min, preferred-from-container-width, max): shrinks smoothly
       with the sensor square instead of overflowing it, and never grows
       past the original v5.0.3 sizes on a normal-sized card. */
    .sensor-icon-wrap { width: clamp(14px, 30cqw, 28px); height: clamp(14px, 30cqw, 28px); flex-shrink: 0; }
    .sensor-icon { width: 100%; height: 100%; }
    .sensor-name {
      font-size: clamp(6.5px, 10cqw, 9px); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
      color: rgba(255,255,255,0.3); text-align: center; line-height: 1.2;
      /* Long labels wrap instead of pushing the state text out of the
         square or getting clipped by overflow:hidden on .sensor. */
      overflow-wrap: break-word; max-width: 100%;
    }
    .sensor-state { font-size: clamp(10px, 15cqw, 14px); font-weight: 700; color: #10b981; }
    .sensor.leak .sensor-state { color: #f87171; }

    .action-btn {
      /* Grid column (2fr in .control-row's grid-template-columns) now
         defines its width — no flex-basis needed anymore. */
      width: 100%; height: 50px; border-radius: 14px;
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
      transform: scale(var(--pipes-scale, 1.15));
      transform-origin: center;
    }

    /* Вимикач анімації: гасить усі CSS @keyframes-анімації (пульсацію
       крапки, glow витоку, тряску сенсора, пульс кнопки, ripple тощо).
       Анімація перемикання крану — це CSS transition на .valve-knob, а не
       animation, тому цей блок її свідомо не чіпає. */
    .card.anim-off *, .card.anim-off *::before, .card.anim-off *::after {
      animation: none !important;
    }
    `;
  }


  static get I18N() {
    return {
      uk: {
        open: 'ВІДКРИТО',
        closed: 'ЗАКРИТО',
        unknown: 'НЕВІДОМО',
        unavailable: 'НЕДОСТУПНО',
        leak: 'ПРОТІЧКА!',
        opening: 'ВІДКРИВАЄТЬСЯ',
        closing: 'ЗАКРИВАЄТЬСЯ',
        opening_btn: 'ВІДКРИВАЄТЬСЯ...',
        closing_btn: 'ЗАКРИВАЄТЬСЯ...',
        btn_open: 'ВІДКРИТИ',
        btn_close: 'ПЕРЕКРИТИ',
        text_dry: 'СУХО',
        text_leak: 'ПРОТІЧКА',
        status_open: 'Система активна, тиск стабільний',
        status_closed: 'Подачу води повністю заблоковано приводом',
        status_unknown: 'Стан запірного клапана не визначено',
        status_unavailable: 'Пристрій недоступний — перевірте з\'єднання',
        closed_at_prefix: 'Закрито:',
        status_opening: 'Привід рівномірно повертає затвор магістралі',
        status_closing: 'Електропривід виконує планове відсікання потоку',
        status_leak_many: 'Аварія: витік на кількох датчиках!',
        status_leak_one: 'Протікання на датчику: {name}!',
        status_leak: 'Виявлено протікання!',
        default_name: 'Водяний кран',
      },
      ru: {
        open: 'ОТКРЫТО',
        closed: 'ЗАКРЫТО',
        unknown: 'НЕИЗВЕСТНО',
        unavailable: 'НЕДОСТУПНО',
        leak: 'ПРОТЕЧКА!',
        opening: 'ОТКРЫВАЕТСЯ',
        closing: 'ЗАКРЫВАЕТСЯ',
        opening_btn: 'ОТКРЫВАЕТСЯ...',
        closing_btn: 'ЗАКРЫВАЕТСЯ...',
        btn_open: 'ОТКРЫТЬ',
        btn_close: 'ПЕРЕКРЫТЬ',
        text_dry: 'СУХО',
        text_leak: 'ПРОТЕЧКА',
        status_open: 'Система активна, давление стабильное',
        status_closed: 'Подача воды полностью перекрыта приводом',
        status_unknown: 'Состояние запорного клапана не определено',
        status_unavailable: 'Устройство недоступно — проверьте соединение',
        status_opening: 'Привод равномерно открывает магистраль',
        closed_at_prefix: 'Закрыто:',
        status_closing: 'Электропривод выполняет плановое отсечение потока',
        status_leak_many: 'Авария: утечка на нескольких датчиках!',
        status_leak_one: 'Протечка на датчике: {name}!',
        status_leak: 'Обнаружена протечка!',
        default_name: 'Водяной кран',
      },
      en: {
        open: 'OPEN',
        closed: 'CLOSED',
        unknown: 'UNKNOWN',
        unavailable: 'UNAVAILABLE',
        leak: 'LEAK!',
        opening: 'OPENING',
        closing: 'CLOSING',
        opening_btn: 'OPENING...',
        closing_btn: 'CLOSING...',
        btn_open: 'OPEN',
        btn_close: 'CLOSE',
        text_dry: 'DRY',
        text_leak: 'LEAK',
        status_open: 'System active, pressure stable',
        status_closed: 'Water supply fully shut off by actuator',
        status_unknown: 'Valve position is unknown',
        status_unavailable: 'Device is unavailable — check the connection',
        status_opening: 'Actuator is opening the valve',
        status_closing: 'Actuator is closing the valve',
        closed_at_prefix: 'Closed:',
        status_leak_many: 'Emergency: leak on multiple sensors!',
        status_leak_one: 'Leak detected: {name}!',
        status_leak: 'Leak detected!',
        default_name: 'Water valve',
      },
    };
  }

  _t(key) {
    const lang = (this._config && this._config.language) || 'uk';
    const pack = WaterValveCard.I18N[lang] || WaterValveCard.I18N.uk;
    return pack[key] || WaterValveCard.I18N.en[key] || key;
  }

  _getToggleMs() {
    const cfg = this._config || {};
    const manual = parseInt(cfg.toggle_lock_ms, 10);
    return !isNaN(manual) && manual > 0 ? manual : 8000;
  }

  // v5.0.4: раніше рівень води в трубі рухався до цілі з фіксованою
  // швидкістю (0.018/кадр ≈ ~4с до майже повного рівня), НЕЗАЛЕЖНО від
  // toggle_lock_ms — тобто кран міг ще секунд 10 повільно повертатися
  // (--valve-duration), поки вода вже давно "домалювалась". Тепер обидві
  // анімації (обертання важеля через CSS-transition і рівень води тут)
  // виводяться з ОДНОГО й того самого _getToggleMs(), тож завжди
  // закінчуються разом, скільки б користувач не виставив у налаштуваннях.
  _getWaterLerpFactor() {
    const fps = 60;
    const durationS = Math.max(0.3, this._getToggleMs() / 1000);
    // Розв'язок (1 - a)^(fps*durationS) = 0.01 відносно a: до кінця
    // налаштованого часу рівень води встигає дійти до ~99% цілі.
    return 1 - Math.pow(0.01, 1 / (fps * durationS));
  }


  // Стара конфігурація (bathroom_leak_entity / kitchen_leak_entity тощо)
  // уже стоїть у людей на дашбордах. Якщо новий список leak_sensors
  // порожній чи відсутній, а старі поля заповнені — підхоплюємо їх як
  // перші елементи нового списку, щоб ніхто не втратив налаштування при
  // оновленні картки. Спрацьовує лише один раз: щойно leak_sensors у
  // конфігу є (навіть порожній масив, свідомо збережений редактором),
  // міграція більше не чіпляється.
  static _migrateLeakSensors(config) {
    if (Array.isArray(config.leak_sensors)) return config.leak_sensors;
    const legacy = [
      { label: config.bathroom_label || '', entity: config.bathroom_leak_entity || '' },
      { label: config.kitchen_label || '', entity: config.kitchen_leak_entity || '' },
    ].filter((s) => !!s.entity);
    return legacy;
  }

  // "animations_enabled" (v5.0.0–v5.0.2) had a correct field but a label
  // in the editor that described the OPPOSITE of what the checkbox did,
  // which is exactly backwards and confusing. Renamed to
  // "disable_animations" with inverted, unambiguous semantics: ON = off.
  // If the new field isn't in the saved config yet, derive it from the
  // old one (config.animations_enabled === false → disable_animations:
  // true); if neither is present, animations are enabled by default, i.e.
  // disable_animations: false.
  static _migrateDisableAnimations(config) {
    if (config.disable_animations !== undefined && config.disable_animations !== null) {
      return config.disable_animations === true;
    }
    if (config.animations_enabled !== undefined && config.animations_enabled !== null) {
      return config.animations_enabled === false;
    }
    return false;
  }

  setConfig(config) {
    const lang = config.language || 'uk';
    const pack = WaterValveCard.I18N[lang] || WaterValveCard.I18N.uk;
    const leakSensors = WaterValveCard._migrateLeakSensors(config)
      .slice(0, MAX_LEAK_SENSORS)
      .map((s) => ({ label: (s.label || '').trim(), entity: s.entity || '' }));
    this._config = {
      language: lang,
      switch_entity: config.switch_entity || null,
      valve_state_entity: config.valve_state_entity || null,
      kran_battery_entity: config.kran_battery_entity || null,
      kran_signal_entity: config.kran_signal_entity || null,
      name: config.name || pack.default_name,
      leak_sensors: leakSensors,
      text_dry: config.text_dry || pack.text_dry,
      text_leak: config.text_leak || pack.text_leak,
      btn_close: config.btn_close || pack.btn_close,
      btn_open: config.btn_open || pack.btn_open,
      // Optional override for the button's own label WHILE the toggle is in
      // progress (distinct from btn_open/btn_close, which are the resting
      // "tap to open/close" labels). Falls back to the localized
      // opening_btn/closing_btn strings when not set.
      btn_opening: config.btn_opening || '',
      btn_closing: config.btn_closing || '',
      toggle_lock_ms: config.toggle_lock_ms || 8000,
      // disable_animations: ON (true) = animations OFF. Migrates the old
      // (confusingly-named, inverted-label) animations_enabled field if
      // disable_animations itself isn't present in the saved config yet.
      disable_animations: WaterValveCard._migrateDisableAnimations(config),
      card_height: config.card_height || null,
      card_min_height: config.card_min_height || null,
      // Vertical position of the valve+pipes graphic, in % of its own
      // section height, from the visual editor's slider. Clamped to a
      // sane range so a malformed/hand-edited value can't push it off-card.
      valve_vertical_offset: Math.max(-50, Math.min(50, Number(config.valve_vertical_offset) || 0)),
      // Independent max-size scale for the valve graphic vs. the pipes/water
      // canvas, each split by mobile (<600px viewport) vs tablet/desktop.
      // Decoupled on purpose per user request — keep them equal for a
      // visually coherent valve+pipe junction, or diverge intentionally.
      valve_scale_mobile: WaterValveCard._clampScale(config.valve_scale_mobile),
      valve_scale_tablet: WaterValveCard._clampScale(config.valve_scale_tablet),
      pipes_scale_mobile: WaterValveCard._clampScale(config.pipes_scale_mobile),
      pipes_scale_tablet: WaterValveCard._clampScale(config.pipes_scale_tablet),
    };
  }

  static _clampScale(v) {
    const n = Number(v);
    return Math.max(0.5, Math.min(2.5, isNaN(n) || !n ? 1.15 : n));
  }

  connectedCallback() {
    if (this._initialized) {
      this._attachEvents();
      this._setupVisibilityHandling();
      this._setupResizeHandling();
      this._syncAnimationState();
      // Force a fresh render in case state changed (or a pending toggle
      // was cancelled) while the card was detached from the DOM.
      this._lastKey = '';
      this._render();
    }
  }
  disconnectedCallback() {
    if (this._toggleTimeout) {
      clearTimeout(this._toggleTimeout);
      this._toggleTimeout = null;
    }
    // Don't leave the card permanently stuck showing "opening…/closing…":
    // if it's reattached later, re-render from the real hass state instead.
    this._isToggling = false;
    this._targetState = null;
    this._detachEvents();
    this._teardownVisibilityHandling();
    this._teardownResizeHandling();
    this._stopWaterAnimation();
  }

  /* ── Реагує на будь-яку зміну фактичного розміру картки (поворот
     екрана, зміна кількості колонок masonry-дашборда, зміна card_height
     в редакторі тощо). Раніше при вимкнених анімаціях canvas міг лишитися
     "застряглим" на кадрі, намальованому під старий розмір, бо ніщо не
     форсувало його перемалювати — а сам кран (SVG, чисте CSS) міг на мить
     розійтися з canvas, поки браузер не перерахує layout самостійно. ── */
  _setupResizeHandling() {
    this._teardownResizeHandling();
    if (!('ResizeObserver' in window)) return;
    this._ro = new ResizeObserver(() => {
      // The water animation loop redraws every frame on its own, but with
      // animations disabled nothing else forces a repaint on resize/
      // rotation — do it once here so the pipes don't stay stuck at the
      // previous size.
      if (this._waterAnimationId === null) this._drawStaticWaterFrame();
    });
    this._ro.observe(this);
  }

  _teardownResizeHandling() {
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
  }

  /* ── Пауза анімації, коли вкладка прихована або картка поза екраном:
     без цього canvas-анімація (бульбашки/течія) малює кадри на 60fps
     нескінченно, навіть на панелях, де дашборд ніхто не бачить. ── */
  _setupVisibilityHandling() {
    this._teardownVisibilityHandling();
    this._visibilityHandler = () => this._syncAnimationState();
    document.addEventListener('visibilitychange', this._visibilityHandler);

    if ('IntersectionObserver' in window) {
      // Card must be at least 30% on-screen to count as "visible" — a mostly
      // scrolled-off card no longer keeps the animation running.
      this._io = new IntersectionObserver((entries) => {
        const entry = entries[entries.length - 1];
        this._isIntersecting = !!(entry && entry.intersectionRatio >= 0.3);
        this._syncAnimationState();
      }, { threshold: [0, 0.3, 1] });
      const card = this.shadowRoot?.getElementById('card');
      if (card) this._io.observe(card);
    } else {
      this._isIntersecting = true;
    }
  }

  _teardownVisibilityHandling() {
    if (this._io) {
      this._io.disconnect();
      this._io = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
  }

  _syncAnimationState() {
    // "Вимикач анімації" в конфігу гасить воду/бульбашки/краплі в canvas —
    // єдина анімація, яку він свідомо НЕ чіпає, це перемикання крану
    // (CSS transition на .valve-knob, який керується окремо через
    // --valve-rotation/--valve-duration і не залежить від rAF-циклу нижче).
    const animationsAllowed = this._config?.disable_animations !== true;
    const shouldRun =
      animationsAllowed &&
      this.isConnected &&
      document.visibilityState !== 'hidden' &&
      this._isIntersecting !== false;
    if (shouldRun) {
      this._startWaterAnimation();
    } else {
      this._stopWaterAnimation();
      if (this.isConnected && !animationsAllowed) this._drawStaticWaterFrame();
    }
  }

  // Коли анімація вимкнена конфігом, воду все одно потрібно показувати на
  // правильному рівні (відкрито/закрито) — просто без runAnimationFrame-
  // циклу. Миттєво виставляємо рівень у ціль і малюємо один кадр.
  _drawStaticWaterFrame() {
    this._waterLevelLeft = this._targetWaterLevelLeft;
    this._waterLevelRight = this._targetWaterLevelRight;
    this._drawWaterFrame();
  }
  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _state(id) { return this._hass?.states[id]?.state ?? 'unknown'; }
  _isLeak(entityId) { if (!entityId) return false; return this._state(entityId) === 'on'; }

  // Нормалізує значення довільного "сигнального" сенсора (Wi-Fi RSSI в dBm,
  // Zigbee LQI 0-255, або вже готовий відсоток) у відсоток 0-100 для
  // індикатора рівня сигналу. Невідомий/недоступний стан → null.
  _getSignalQuality(entityId) {
    if (!entityId || !this._hass) return null;
    const st = this._hass.states[entityId];
    if (!st) return null;
    const raw = parseFloat(st.state);
    if (isNaN(raw)) return null;
    const unit = (st.attributes?.unit_of_measurement || '').toLowerCase();
    let percent;
    if (unit === 'dbm') {
      // Типовий Wi-Fi діапазон: -100dBm (немає сигналу) .. -50dBm (відмінно).
      percent = ((raw + 100) / 50) * 100;
    } else if (unit === '%') {
      percent = raw;
    } else if (raw >= 0 && raw <= 255 && !unit) {
      // Схоже на Zigbee LQI (0-255) без явної одиниці виміру.
      percent = (raw / 255) * 100;
    } else {
      percent = raw;
    }
    return Math.max(0, Math.min(100, Math.round(percent)));
  }

  _getValveState() {
    if (!this._hass) return { switchState: 'unknown', valveState: 'unknown', isOpen: false, isUnavailable: false, lastChanged: null };
    const { switch_entity, valve_state_entity } = this._config;
    const sw = this._hass.states[switch_entity];
    const vs = valve_state_entity ? this._hass.states[valve_state_entity] : null;
    const switchState = sw?.state || 'unknown';
    const raw = (vs?.state || switchState || 'unknown').toString().toLowerCase().trim();
    const openStates = new Set(['on', 'open', 'opened', 'відкрито', 'открыто', 'відчинено']);
    const isOpen = openStates.has(raw);
    // A missing entity or a state of "unavailable"/"" must NOT be treated as
    // "closed" — for a water shut-off valve that's actively misleading.
    const isUnavailable = !sw || raw === 'unavailable' || raw === '';
    const valveState = isUnavailable
      ? 'unavailable'
      : (vs?.state || (isOpen ? 'open' : switchState === 'off' ? 'closed' : switchState));
    // Whichever entity is the actual source of truth for the state also
    // knows when that state was last reached — Home Assistant tracks this
    // server-side, so it's free, accurate, and correct even on the very
    // first render (unlike guessing "now").
    const lastChanged = (vs || sw)?.last_changed || null;
    return { switchState, valveState, isOpen, isUnavailable, lastChanged };
  }

  _closedAtKey() {
    const id = this._config?.switch_entity || 'default';
    return `water-valve-card-closed-at:${id}`;
  }

  // Tracks when the valve last became CLOSED, no matter what closed it
  // (this card, another dashboard, an automation, physically). Cleared the
  // moment it's seen open again.
  //
  // v5.0.4 fix: this used to fall back to Date.now() ("just now") whenever
  // there was no localStorage record yet — e.g. the very first time the
  // card renders in a fresh browser, or if the valve was already closed
  // long before this card instance ever existed. That fabricated a
  // misleadingly recent timestamp. Home Assistant already tracks the real
  // answer server-side via the entity's own `last_changed`, so that's now
  // the primary source of truth; localStorage is only used as a same-tab
  // memory aid between HA state updates, never to invent a timestamp.
  _updateClosedTimestamp(isOpen, isUnavailable, lastChanged) {
    if (isUnavailable) return;
    if (isOpen) {
      if (this._closedAt !== null) {
        this._closedAt = null;
        try { localStorage.removeItem(this._closedAtKey()); } catch (e) {}
      }
      return;
    }
    const fromEntity = lastChanged ? new Date(lastChanged).getTime() : NaN;
    if (!isNaN(fromEntity)) {
      if (this._closedAt !== fromEntity) {
        this._closedAt = fromEntity;
        try { localStorage.setItem(this._closedAtKey(), String(fromEntity)); } catch (e) {}
      }
      return;
    }
    // No usable last_changed (shouldn't normally happen) — fall back to
    // whatever we last knew, from this session or a previous one.
    if (this._closedAt === null) {
      let stored = null;
      try { stored = localStorage.getItem(this._closedAtKey()); } catch (e) {}
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (!isNaN(parsed)) this._closedAt = parsed;
    }
  }

  _formatClosedAt() {
    if (!this._closedAt) return '';
    try {
      const lang = (this._config && this._config.language) || 'uk';
      const locale = lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uk-UA';
      return new Date(this._closedAt).toLocaleString(locale, {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return new Date(this._closedAt).toLocaleString();
    }
  }

  _getData() {
    const { valveState, isOpen, isUnavailable, lastChanged } = this._getValveState();
    this._updateClosedTimestamp(isOpen, isUnavailable, lastChanged);
    const cfg = this._config;
    // Visibility of a leak-sensor block depends ONLY on whether an entity is
    // configured. The label is a separate, purely cosmetic concern — if it's
    // empty we just hide the label text and keep showing the block.
    const sensors = (cfg.leak_sensors || []).slice(0, MAX_LEAK_SENSORS);
    const leaks = sensors.map((s) => !!s.entity && this._isLeak(s.entity));
    return { valveState, isUnavailable, leaks, sensors, hasLeak: leaks.some(Boolean) };
  }

  _cancelToggle() {
    if (this._toggleTimeout) {
      clearTimeout(this._toggleTimeout);
      this._toggleTimeout = null;
    }
    this._isToggling = false;
    this._targetState = null;
    this._lastKey = '';
    this._render();
  }

  _toggle() {
    if (this._isToggling) return;
    const { switch_entity } = this._config;
    if (!switch_entity || !this._hass) return;
    const { isOpen, isUnavailable } = this._getValveState();
    // Nothing sensible to do if the actuator isn't there / isn't reporting —
    // calling a service on it would just fail silently.
    if (isUnavailable) return;
    this._isToggling = true;
    this._targetState = isOpen ? 'closed' : 'open';
    const domain = switch_entity.split('.')[0] || 'switch';
    const isValveDomain = domain === 'valve';
    // The `valve` domain uses open_valve/close_valve, not open/close.
    const svc = isValveDomain
      ? (isOpen ? 'close_valve' : 'open_valve')
      : (isOpen ? 'turn_off' : 'turn_on');

    let callResult;
    try {
      callResult = this._hass.callService(isValveDomain ? 'valve' : 'switch', svc, { entity_id: switch_entity });
    } catch (e) {
      console.error('[water-valve-card] callService threw synchronously', e);
      this._cancelToggle();
      return;
    }
    if (callResult && typeof callResult.catch === 'function') {
      callResult.catch((err) => {
        console.error('[water-valve-card] service call failed — resetting toggle state', err);
        this._cancelToggle();
      });
    }

    const lockMs = this._getToggleMs();
    if (this._toggleTimeout) clearTimeout(this._toggleTimeout);
    this._toggleTimeout = setTimeout(() => {
      this._isToggling = false;
      this._targetState = null;
      this._lastKey = '';
      this._render();
    }, lockMs);
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

            <div class="indicators">
              <div class="signal-container" id="signal-container">
                <svg class="signal-svg" id="signal-svg" viewBox="0 0 18 14">
                  <rect id="signal-bar-1" x="0" y="9" width="3" height="5" rx="0.8" fill="rgba(255,255,255,0.2)"/>
                  <rect id="signal-bar-2" x="5" y="6" width="3" height="8" rx="0.8" fill="rgba(255,255,255,0.2)"/>
                  <rect id="signal-bar-3" x="10" y="3" width="3" height="11" rx="0.8" fill="rgba(255,255,255,0.2)"/>
                  <rect id="signal-bar-4" x="15" y="0" width="3" height="14" rx="0.8" fill="rgba(255,255,255,0.2)"/>
                </svg>
                <span class="signal-text" id="signal-text">--%</span>
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
          </div>

          <div class="status-row">
            <div class="dot" id="dot"></div>
            <div class="status-text" id="status-text"></div>
          </div>
          <div class="closed-at" id="closed-at" style="display:none;"></div>

          <div class="valve-section" id="valve-section">
            <canvas id="water-canvas" width="400" height="200"></canvas>
            <svg class="valve-svg" id="valve-graphic" viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg">
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

          <div class="control-row-top" id="control-row-top" style="display:none;">
            <div class="sensor" id="sensor-2">
              <div class="sensor-icon-wrap"><svg class="sensor-icon" id="icon-2" viewBox="0 0 32 32" fill="none"></svg></div>
              <div class="sensor-name" id="label-2"></div>
              <div class="sensor-state" id="state-2"></div>
            </div>
            <div class="control-spacer"></div>
            <div class="sensor" id="sensor-3">
              <div class="sensor-icon-wrap"><svg class="sensor-icon" id="icon-3" viewBox="0 0 32 32" fill="none"></svg></div>
              <div class="sensor-name" id="label-3"></div>
              <div class="sensor-state" id="state-3"></div>
            </div>
          </div>

          <div class="control-row">
            <div class="sensor" id="sensor-0">
              <div class="sensor-icon-wrap"><svg class="sensor-icon" id="icon-0" viewBox="0 0 32 32" fill="none"></svg></div>
              <div class="sensor-name" id="label-0"></div>
              <div class="sensor-state" id="state-0"></div>
            </div>

            <button type="button" class="action-btn" id="action-btn"></button>

            <div class="sensor" id="sensor-1">
              <div class="sensor-icon-wrap"><svg class="sensor-icon" id="icon-1" viewBox="0 0 32 32" fill="none"></svg></div>
              <div class="sensor-name" id="label-1"></div>
              <div class="sensor-state" id="state-1"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._canvas = this.shadowRoot.getElementById('water-canvas');
    this._ctx = this._canvas.getContext('2d');
    this._initWaterEffects();
    this._attachEvents();
    this._setupVisibilityHandling();
    this._setupResizeHandling();
    this._syncAnimationState();
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

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    const event = new Event('hass-more-info', { bubbles: true, composed: true });
    event.detail = { entityId };
    this.dispatchEvent(event);
  }

  // Long-press (hold ~500ms) on a block opens its entity's more-info dialog.
  // A short tap/click is left alone — the button keeps toggling the valve
  // on click as before, it just also supports holding to inspect it.
  _bindHold(el, getEntityId, sig) {
    if (!el) return;
    const HOLD_MS = 500;
    const MOVE_TOLERANCE = 10;
    let timer = null;
    let startX = 0, startY = 0;
    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const start = (ev) => {
      const point = ev.touches ? ev.touches[0] : ev;
      startX = point.clientX; startY = point.clientY;
      this._holdFired = false;
      clear();
      timer = setTimeout(() => {
        this._holdFired = true;
        const entityId = typeof getEntityId === 'function' ? getEntityId() : getEntityId;
        this._fireMoreInfo(entityId);
      }, HOLD_MS);
    };
    const move = (ev) => {
      if (!timer) return;
      const point = ev.touches ? ev.touches[0] : ev;
      if (Math.abs(point.clientX - startX) > MOVE_TOLERANCE || Math.abs(point.clientY - startY) > MOVE_TOLERANCE) clear();
    };
    el.addEventListener('pointerdown', start, { signal: sig });
    el.addEventListener('pointermove', move, { signal: sig });
    el.addEventListener('pointerup', clear, { signal: sig });
    el.addEventListener('pointerleave', clear, { signal: sig });
    el.addEventListener('pointercancel', clear, { signal: sig });
    el.addEventListener('contextmenu', (ev) => { if (this._holdFired) ev.preventDefault(); }, { signal: sig });
  }

  _attachEvents() {
    this._detachEvents();
    this._eventsAC = new AbortController();
    const sig = this._eventsAC.signal;
    const card = this.shadowRoot?.getElementById('card');
    const btn  = this.shadowRoot?.getElementById('action-btn');
    if (!card || !btn) return;

    this._holdFired = false;
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

    // Only the button toggles the valve now — tapping elsewhere on the
    // card body no longer does anything. Holding the valve+pipes graphic
    // (not the button) opens the valve entity's more-info dialog.
    btn.addEventListener('click', onAction, { signal: sig });

    const valveGraphic = this.shadowRoot?.getElementById('valve-graphic');
    this._bindHold(valveGraphic, () => this._config.switch_entity, sig);

    const batteryEl = this.shadowRoot?.getElementById('battery-container');
    this._bindHold(batteryEl, () => this._config.kran_battery_entity, sig);

    const signalEl = this.shadowRoot?.getElementById('signal-container');
    this._bindHold(signalEl, () => this._config.kran_signal_entity, sig);

    for (let i = 0; i < MAX_LEAK_SENSORS; i++) {
      const sensorEl = this.shadowRoot?.getElementById(`sensor-${i}`);
      this._bindHold(sensorEl, () => (this._config.leak_sensors || [])[i]?.entity, sig);
    }
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

    // Seed ranges match the 0..200 / 200..400 split (see _pipeSplitX) in the
    // canvas's nominal 400-wide space; each particle re-wraps into the real,
    // per-frame xStart/xEnd on its next frame anyway (see
    // _drawBubblesAndFlowForRegion), so this only needs to be "inside the
    // correct half", not pixel-exact.
    this._bubblesLeft = Array.from({length: MAX_BUBBLES_PER_SIDE}, () => this._createBubble(true, 0, 200));
    this._flowLinesLeft = Array.from({length: MAX_FLOW_LINES_PER_SIDE}, () => this._createFlowLine(true, 0, 200));

    this._bubblesRight = Array.from({length: MAX_BUBBLES_PER_SIDE}, () => this._createBubble(true, 200, 400));
    this._flowLinesRight = Array.from({length: MAX_FLOW_LINES_PER_SIDE}, () => this._createFlowLine(true, 200, 400));

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

  _ensureStaticPipeLayer(wCard, hCard, centerY, scale) {
    // _drawGlassPipe / _drawGlassReflections don't depend on time (t) at
    // all — they're pixel-identical every frame for a given size. Redrawing
    // their gradients/strokes 60×/sec was pure waste, so cache them on an
    // offscreen canvas and only redraw when the size actually changes.
    const key = `${wCard}x${hCard}`;
    if (this._staticLayerKey === key && this._staticLayerCanvas) return;
    if (!this._staticLayerCanvas) {
      this._staticLayerCanvas = document.createElement('canvas');
      this._staticLayerCtx = this._staticLayerCanvas.getContext('2d');
    }
    this._staticLayerCanvas.width = wCard;
    this._staticLayerCanvas.height = hCard;
    const realCtx = this._ctx;
    this._ctx = this._staticLayerCtx;
    this._staticLayerCtx.clearRect(0, 0, wCard, hCard);
    this._drawGlassPipe(wCard, centerY, scale);
    this._drawGlassReflections(this._waterTime, wCard, centerY, scale);
    this._ctx = realCtx;
    this._staticLayerKey = key;
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

    // Ліва (вхідна, завжди повна) і права (вихідна, залежить від стану
    // крана) половини труби сходяться РІВНО тут — жодного виміряного
    // "краю крана", жодного проміжку. Кран (SVG, z-index вище canvas)
    // просто лежить зверху цього шва.
    const splitX = WaterValveCard._pipeSplitX(wCard);

    // Ліва частина
    this._drawWaterRegion(0, splitX, this._waterLevelLeft, wCard, scale);
    this._drawBubblesAndFlowForRegion(this._bubblesLeft, this._flowLinesLeft, 0, splitX, this._waterLevelLeft, wCard, scale);

    // Права частина
    this._drawWaterRegion(splitX, wCard, this._waterLevelRight, wCard, scale);
    this._drawBubblesAndFlowForRegion(this._bubblesRight, this._flowLinesRight, splitX, wCard, this._waterLevelRight, wCard, scale);

    // Спільні ефекти скляної труби та крапель із прив'язкою до динамічного центру
    this._drawLeakDrops(wCard, centerY, scale);
    this._ensureStaticPipeLayer(wCard, hCard, centerY, scale);
    ctx.drawImage(this._staticLayerCanvas, 0, 0);
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

      // Обчислюємо щокадра (не кешуємо) — редактор може змінити
      // toggle_lock_ms "наживо", і швидкість води має підхопити це без
      // перезапуску анімації.
      const speed = this._getWaterLerpFactor();
      const update = (cur, target) => Math.abs(cur - target) > 0.001 ? cur + (target - cur) * speed : target;
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
    // Safe without entities (card picker / empty stub)
    if (!this._config.switch_entity) {
      this._ensureTemplate();
      const r = this.shadowRoot;
      if (!r) return;
      const nameEl = r.getElementById('name');
      if (nameEl) nameEl.textContent = (this._config.name || 'Smart Water Valve').toUpperCase();
      const status = r.getElementById('status-text');
      if (status) status.textContent = this._t ? this._t('status_unknown') : 'Select valve entity';
      return;
    }
    this._ensureTemplate();

    const cfg = this._config;
    const d = this._getData();
    const batteryState = cfg.kran_battery_entity ? this._state(cfg.kran_battery_entity) : null;
    const signalQuality = cfg.kran_signal_entity ? this._getSignalQuality(cfg.kran_signal_entity) : null;

    const visualState = this._isToggling ? this._targetState : (d.valveState === 'open' ? 'open' : 'closed');
    const isOpen = visualState === 'open';
    this._hasLeak = d.hasLeak;

    this._targetWaterLevelLeft = 0.75;
    this._targetWaterLevelRight = isOpen ? 0.75 : 0;
    // Без rAF-циклу (анімація вимкнена) нікому підхопити нову ціль рівня
    // води — перемальовуємо один кадр одразу, інакше труба "застрягне" на
    // старому рівні до наступної зміни видимості картки.
    if (cfg.disable_animations === true && this._waterAnimationId === null) {
      this._drawStaticWaterFrame();
    }

    const leaksKey = d.leaks.join(',');
    const renderKey = this._isToggling
      ? `toggling-${this._targetState}|${batteryState}|${signalQuality}|${leaksKey}|${cfg.name}|${cfg.disable_animations}|${cfg.card_height}|${cfg.card_min_height}|${cfg.valve_vertical_offset}|${cfg.valve_scale_mobile}|${cfg.valve_scale_tablet}|${cfg.pipes_scale_mobile}|${cfg.pipes_scale_tablet}|${cfg.btn_opening}|${cfg.btn_closing}|${this._closedAt}`
      : `static-${d.valveState}|${batteryState}|${signalQuality}|${leaksKey}|${cfg.name}|${cfg.disable_animations}|${cfg.card_height}|${cfg.card_min_height}|${cfg.valve_vertical_offset}|${cfg.valve_scale_mobile}|${cfg.valve_scale_tablet}|${cfg.pipes_scale_mobile}|${cfg.pipes_scale_tablet}|${cfg.btn_opening}|${cfg.btn_closing}|${this._closedAt}`;

    if (this._lastKey === renderKey) return;
    this._lastKey = renderKey;

    const r = this.shadowRoot;
    const card = r.getElementById('card');

    let stateLabel, statusText, accentColor, accentGlow, dotColor, dotClass, rotation;

    if (d.hasLeak) {
      stateLabel = this._t('leak');
      const sensorsForLabel = cfg.leak_sensors || [];
      const leakingCount = d.leaks.filter(Boolean).length;
      const firstIdx = d.leaks.findIndex(Boolean);
      if (leakingCount > 1) statusText = this._t('status_leak_many');
      else if (leakingCount === 1) statusText = this._t('status_leak_one').replace('{name}', sensorsForLabel[firstIdx]?.label || String(firstIdx + 1));
      else statusText = this._t('status_leak');
      accentColor = '#ef4444'; accentGlow = 'rgba(239,68,68,0.45)'; dotColor = '#ef4444'; dotClass = 'dot blink';
    } else if (this._isToggling) {
      stateLabel = this._targetState === 'open' ? this._t('opening') : this._t('closing');
      statusText = this._targetState === 'open' ? this._t('status_opening') : this._t('status_closing');
      accentColor = '#eab308'; accentGlow = 'rgba(234,179,8,0.35)'; dotColor = '#eab308'; dotClass = 'dot blink';
    } else if (isOpen) {
      stateLabel = this._t('open'); statusText = this._t('status_open');
      accentColor = '#0ea5e9'; accentGlow = 'rgba(14,165,233,0.4)'; dotColor = '#10b981'; dotClass = 'dot pulse';
    } else if (d.isUnavailable) {
      // Distinct from "closed" on purpose: an unavailable actuator is NOT
      // a confirmed-safe state and must not look like one.
      stateLabel = this._t('unavailable'); statusText = this._t('status_unavailable');
      accentColor = '#6b7280'; accentGlow = 'rgba(107,114,128,0.15)'; dotColor = '#6b7280'; dotClass = 'dot blink';
    } else if (d.valveState === 'unknown') {
      stateLabel = this._t('unknown'); statusText = this._t('status_unknown');
      accentColor = '#6b7280'; accentGlow = 'rgba(107,114,128,0.15)'; dotColor = '#6b7280'; dotClass = 'dot';
    } else {
      stateLabel = this._t('closed'); statusText = this._t('status_closed');
      accentColor = '#dc2626'; accentGlow = 'rgba(220,38,38,0.35)'; dotColor = '#dc2626'; dotClass = 'dot';
    }

    const closedAtEl = r.getElementById('closed-at');
    if (closedAtEl) {
      const showClosedAt = !d.hasLeak && !this._isToggling && !isOpen && !d.isUnavailable && d.valveState !== 'unknown' && this._closedAt;
      if (showClosedAt) {
        closedAtEl.textContent = `${this._t('closed_at_prefix')} ${this._formatClosedAt()}`;
        closedAtEl.style.display = '';
      } else {
        closedAtEl.style.display = 'none';
      }
    }

    const isAmbiguous = d.valveState === 'unknown' || d.isUnavailable;
    rotation = isOpen ? '0deg' : ((isAmbiguous && !this._isToggling) ? '45deg' : '90deg');

    card.style.setProperty('--accent-color', accentColor);
    card.style.setProperty('--accent-glow', accentGlow);
    card.style.setProperty('--dot-color', dotColor);
    card.style.setProperty('--valve-rotation', rotation);
    card.style.setProperty('--valve-duration', `${this._getToggleMs() / 1000}s`);

    card.classList.toggle('has-leak', d.hasLeak);
    card.classList.toggle('disabled-card', this._isToggling);
    card.classList.toggle('anim-off', cfg.disable_animations === true);

    card.style.setProperty('--wvc-height-min', cfg.card_min_height ? `${cfg.card_min_height}px` : 'auto');
    card.style.setProperty('--wvc-height-fixed', cfg.card_height ? `${cfg.card_height}px` : 'auto');

    const valveSection = r.getElementById('valve-section');
    if (valveSection) {
      valveSection.style.setProperty('--valve-offset-pct', `${cfg.valve_vertical_offset || 0}%`);
      valveSection.style.setProperty('--valve-scale-mobile', cfg.valve_scale_mobile || 1.15);
      valveSection.style.setProperty('--valve-scale-tablet', cfg.valve_scale_tablet || 1.15);
      valveSection.style.setProperty('--pipes-scale-mobile', cfg.pipes_scale_mobile || 1.15);
      valveSection.style.setProperty('--pipes-scale-tablet', cfg.pipes_scale_tablet || 1.15);
    }

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

    const sigContainer = r.getElementById('signal-container');
    if (sigContainer) {
      if (!cfg.kran_signal_entity) {
        sigContainer.style.display = 'none';
      } else {
        sigContainer.style.display = '';
        r.getElementById('signal-text').textContent = signalQuality === null ? '—%' : `${signalQuality}%`;
        const litColor = signalQuality === null ? 'rgba(255,255,255,0.2)'
          : signalQuality < 25 ? '#ef4444'
          : signalQuality < 55 ? '#eab308'
          : '#10b981';
        const litBars = signalQuality === null ? 0 : Math.ceil(signalQuality / 25);
        for (let i = 1; i <= 4; i++) {
          const bar = r.getElementById(`signal-bar-${i}`);
          if (bar) bar.setAttribute('fill', i <= litBars ? litColor : 'rgba(255,255,255,0.15)');
        }
      }
    }

    const textDry = cfg.text_dry || this._t('text_dry');
    const textLeak = cfg.text_leak || this._t('text_leak');
    // Block visibility is gated by the entity only — label presence just
    // controls whether the name text is shown. Only the first
    // MAX_LEAK_SENSORS entries of leak_sensors are ever shown on the card.
    const sensors = cfg.leak_sensors || [];
    for (let i = 0; i < MAX_LEAK_SENSORS; i++) {
      this._updateSensor(r, i, sensors[i]?.label, !!d.leaks[i], textDry, textLeak, sensors[i]?.entity || null);
    }
    const topRow = r.getElementById('control-row-top');
    if (topRow) {
      topRow.style.display = (sensors[2]?.entity || sensors[3]?.entity) ? 'grid' : 'none';
    }

    const btn = r.getElementById('action-btn');
    btn.classList.toggle('disabled', this._isToggling || d.isUnavailable);
    btn.classList.toggle('closed', !isOpen);
    btn.classList.toggle('leak-shut', d.hasLeak && isOpen);

    if (this._isToggling) {
      btn.textContent = this._targetState === 'open'
        ? (cfg.btn_opening || this._t('opening_btn'))
        : (cfg.btn_closing || this._t('closing_btn'));
    } else if (d.isUnavailable) {
      btn.textContent = this._t('unavailable');
    } else if (isOpen) {
      btn.textContent = cfg.btn_close || this._t('btn_close');
    } else {
      btn.textContent = cfg.btn_open || this._t('btn_open');
    }
  }

  _updateSensor(root, id, label, isLeak, textDry, textLeak, entityId) {
    const el = root.getElementById(`sensor-${id}`);
    if (!el) return;
    // Visibility of the whole block depends only on whether an entity is
    // configured — an empty label no longer hides it.
    if (!entityId) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const icon = root.getElementById(`icon-${id}`);
    el.classList.toggle('leak', isLeak);
    const labelEl = root.getElementById(`label-${id}`);
    if (labelEl) {
      // No label set → just hide the name text, keep the block visible.
      labelEl.style.display = label ? '' : 'none';
      labelEl.textContent = label ? label.toUpperCase() : '';
    }
    root.getElementById(`state-${id}`).textContent = isLeak ? textLeak : textDry;
    const fill = isLeak ? '#ef4444' : '#10b981';
    const stroke = isLeak ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.3)';
    icon.innerHTML = WaterValveCard._dropIcon(id, fill, stroke);
  }


  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return {
      language: "uk",
      name: "Smart Water Valve",
    };
  }

  static getConfigElement() {
    return document.createElement("water-valve-card-editor");
  }
}

/* ═══════════════ Visual editor ═══════════════ */
class WaterValveCardEditor extends HTMLElement {
  static EDITOR_I18N = {
    uk: {
      name: 'Назва картки',
      switch_entity: "Кран / реле (обов'язково)",
      valve_state_entity: 'Сенсор стану крана (необов\u2019язково)',
      kran_battery_entity: 'Сенсор батареї (необов\u2019язково)',
      kran_signal_entity: 'Сенсор рівня сигналу (необов\u2019язково)',
      disable_animations: 'Вимкнути анімації (крім перемикання крану)',
      text_dry: 'Текст "сухо" (перевизначає мову)',
      text_leak: 'Текст "протічка" (перевизначає мову)',
      btn_open: 'Текст кнопки "Відкрити" (перевизначає мову)',
      btn_close: 'Текст кнопки "Закрити" (перевизначає мову)',
      btn_opening: 'Текст кнопки під час відкривання (перевизначає мову)',
      btn_closing: 'Текст кнопки під час закривання (перевизначає мову)',
      toggle_lock_ms: 'Час анімації перемикання (мс)',
      card_min_height: 'Мінімальна висота картки (px, 0 = авто)',
      card_height: 'Фіксована висота картки (px, 0 = авто)',
      leak_sensors_title: 'Датчики протічки',
      add_leak_sensor: '+ Додати датчик протічки',
      remove_leak_sensor: 'Прибрати датчик',
      leak_label_placeholder: 'Назва (необов\u2019язково)',
      leak_entity_label: 'Сенсор протічки (ентіті)',
      leak_entity_placeholder: 'binary_sensor.datchyk_protichky',
      leak_sensors_limit_note: `Максимум ${MAX_LEAK_SENSORS}. Порядок на картці: 1 — ліворуч від кнопки, 2 — праворуч, 3 — над датчиком 1, 4 — над датчиком 2. Видалення датчика зсуває наступні на його місце.`,
      valve_layout_title: 'Розташування та масштаб крана й труб',
      valve_position_title: 'Зсув по вертикалі (0% = центр)',
      valve_scale_mobile_title: 'Масштаб крана — телефон',
      valve_scale_tablet_title: 'Масштаб крана — планшет/ПК',
      pipes_scale_mobile_title: 'Масштаб труб (води) — телефон',
      pipes_scale_tablet_title: 'Масштаб труб (води) — планшет/ПК',
    },
    ru: {
      name: 'Название карточки',
      switch_entity: 'Кран / реле (обязательно)',
      valve_state_entity: 'Сенсор состояния крана (необязательно)',
      kran_battery_entity: 'Сенсор батареи (необязательно)',
      kran_signal_entity: 'Сенсор уровня сигнала (необязательно)',
      disable_animations: 'Отключить анимации (кроме переключения крана)',
      text_dry: 'Текст "сухо" (переопределяет язык)',
      text_leak: 'Текст "протечка" (переопределяет язык)',
      btn_open: 'Текст кнопки "Открыть" (переопределяет язык)',
      btn_close: 'Текст кнопки "Закрыть" (переопределяет язык)',
      btn_opening: 'Текст кнопки во время открытия (переопределяет язык)',
      btn_closing: 'Текст кнопки во время закрытия (переопределяет язык)',
      toggle_lock_ms: 'Время анимации переключения (мс)',
      card_min_height: 'Минимальная высота карточки (px, 0 = авто)',
      card_height: 'Фиксированная высота карточки (px, 0 = авто)',
      leak_sensors_title: 'Датчики протечки',
      add_leak_sensor: '+ Добавить датчик протечки',
      remove_leak_sensor: 'Убрать датчик',
      leak_label_placeholder: 'Название (необязательно)',
      leak_entity_label: 'Сенсор протечки (сущность)',
      leak_entity_placeholder: 'binary_sensor.datchik_protechki',
      leak_sensors_limit_note: `Максимум ${MAX_LEAK_SENSORS}. Порядок на карточке: 1 — слева от кнопки, 2 — справа, 3 — над датчиком 1, 4 — над датчиком 2. Удаление датчика сдвигает следующие на его место.`,
      valve_layout_title: 'Расположение и масштаб крана и труб',
      valve_position_title: 'Смещение по вертикали (0% = центр)',
      valve_scale_mobile_title: 'Масштаб крана — телефон',
      valve_scale_tablet_title: 'Масштаб крана — планшет/ПК',
      pipes_scale_mobile_title: 'Масштаб труб (воды) — телефон',
      pipes_scale_tablet_title: 'Масштаб труб (воды) — планшет/ПК',
    },
    en: {
      name: 'Card name',
      switch_entity: 'Valve / switch (required)',
      valve_state_entity: 'Valve state sensor (optional)',
      kran_battery_entity: 'Battery sensor (optional)',
      kran_signal_entity: 'Signal strength sensor (optional)',
      disable_animations: 'Disable animations (except the valve toggle)',
      text_dry: 'Text when dry (optional, overrides language)',
      text_leak: 'Text when leaking (optional, overrides language)',
      btn_open: 'Open button text (optional, overrides language)',
      btn_close: 'Close button text (optional, overrides language)',
      btn_opening: 'Button text while opening (optional, overrides language)',
      btn_closing: 'Button text while closing (optional, overrides language)',
      toggle_lock_ms: 'Toggle animation time (ms)',
      card_min_height: 'Minimum card height (px, 0 = auto)',
      card_height: 'Fixed card height (px, 0 = auto)',
      leak_sensors_title: 'Leak sensors',
      add_leak_sensor: '+ Add leak sensor',
      remove_leak_sensor: 'Remove sensor',
      leak_label_placeholder: 'Name (optional)',
      leak_entity_label: 'Leak sensor (entity)',
      leak_entity_placeholder: 'binary_sensor.leak_sensor',
      leak_sensors_limit_note: `Maximum ${MAX_LEAK_SENSORS}. Card order: 1 — left of the button, 2 — right of it, 3 — above sensor 1, 4 — above sensor 2. Removing a sensor shifts the rest up into its place.`,
      valve_layout_title: 'Valve + pipes position and scale',
      valve_position_title: 'Vertical offset (0% = center)',
      valve_scale_mobile_title: 'Valve scale — phone',
      valve_scale_tablet_title: 'Valve scale — tablet/desktop',
      pipes_scale_mobile_title: 'Pipes (water) scale — phone',
      pipes_scale_tablet_title: 'Pipes (water) scale — tablet/desktop',
    },
  };

  _editorLabel(key) {
    const lang = (this._config && this._config.language) || 'uk';
    const pack = WaterValveCardEditor.EDITOR_I18N[lang] || WaterValveCardEditor.EDITOR_I18N.uk;
    return pack[key] || WaterValveCardEditor.EDITOR_I18N.en[key] || key;
  }

  setConfig(config) {
    config = config || {};
    // Той самий міграційний шлях, що й у самій картці: якщо leak_sensors ще
    // нема, а старі bathroom_/kitchen_ поля заповнені — підхоплюємо їх, щоб
    // редактор одразу показав існуючі датчики у новому вигляді.
    const leakSensors = WaterValveCard._migrateLeakSensors(config)
      .slice(0, MAX_LEAK_SENSORS)
      .map((s) => ({ label: (s.label || '').trim(), entity: s.entity || '' }));
    // Так само мігруємо старий animations_enabled → новий disable_animations
    // (інвертована, однозначна назва), щоб редактор одразу показував
    // коректний стан чекбоксу для вже збережених конфігів.
    const disableAnimations = WaterValveCard._migrateDisableAnimations(config);
    this._config = { ...config, leak_sensors: leakSensors, disable_animations: disableAnimations };
    this._redraw();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) {
      this._form.hass = hass;
    }
  }

  connectedCallback() {
    this._redraw();
  }

  _schema() {
    const L = (key) => this._editorLabel(key);
    return [
      {
        name: "language",
        label: "Language / Мова / Язык",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "uk", label: "Українська" },
              { value: "ru", label: "Русский" },
              { value: "en", label: "English" },
            ],
          },
        },
      },
      {
        name: "name",
        label: L("name"),
        required: true,
        selector: { text: {} },
      },
      {
        name: "switch_entity",
        label: L("switch_entity"),
        required: true,
        selector: { entity: { domain: ["switch", "valve"] } },
      },
      {
        name: "valve_state_entity",
        label: L("valve_state_entity"),
        selector: { entity: { domain: ["sensor", "binary_sensor"] } },
      },
      {
        name: "kran_battery_entity",
        label: L("kran_battery_entity"),
        selector: { entity: { domain: "sensor" } },
      },
      {
        name: "kran_signal_entity",
        label: L("kran_signal_entity"),
        selector: { entity: { domain: "sensor" } },
      },
      {
        name: "disable_animations",
        label: L("disable_animations"),
        selector: { boolean: {} },
      },
      {
        name: "text_dry",
        label: L("text_dry"),
        selector: { text: {} },
      },
      {
        name: "text_leak",
        label: L("text_leak"),
        selector: { text: {} },
      },
      {
        name: "btn_open",
        label: L("btn_open"),
        selector: { text: {} },
      },
      {
        name: "btn_close",
        label: L("btn_close"),
        selector: { text: {} },
      },
      {
        name: "btn_opening",
        label: L("btn_opening"),
        selector: { text: {} },
      },
      {
        name: "btn_closing",
        label: L("btn_closing"),
        selector: { text: {} },
      },
      {
        name: "toggle_lock_ms",
        label: L("toggle_lock_ms"),
        selector: {
          number: { min: 500, max: 120000, mode: "box", unit_of_measurement: "ms" },
        },
      },
      {
        name: "card_min_height",
        label: L("card_min_height"),
        selector: {
          number: { min: 0, max: 2000, mode: "box", unit_of_measurement: "px" },
        },
      },
      {
        name: "card_height",
        label: L("card_height"),
        selector: {
          number: { min: 0, max: 2000, mode: "box", unit_of_measurement: "px" },
        },
      },
    ];
  }

  _clean(cfg) {
    const out = { ...(cfg || {}) };
    [
      "switch_entity",
      "valve_state_entity",
      "kran_battery_entity",
      "kran_signal_entity",
      "text_dry",
      "text_leak",
      "btn_open",
      "btn_close",
      "btn_opening",
      "btn_closing",
    ].forEach((k) => {
      if (out[k] === "" || out[k] === null || out[k] === undefined) delete out[k];
    });
    if (!out.language) out.language = "uk";
    if (!out.name) out.name = "Smart Water Valve";
    if (out.toggle_lock_ms === undefined || out.toggle_lock_ms === null || out.toggle_lock_ms === "") {
      out.toggle_lock_ms = 8000;
    }
    if (out.disable_animations === undefined || out.disable_animations === null) {
      out.disable_animations = false;
    } else {
      out.disable_animations = out.disable_animations === true;
    }
    // Legacy field from v5.0.0–v5.0.2, fully replaced by disable_animations.
    delete out.animations_enabled;
    // 0 or empty → "auto", no point saving it.
    ["card_height", "card_min_height"].forEach((k) => {
      if (!out[k] || out[k] === "" || Number(out[k]) <= 0) delete out[k];
    });
    // Valve vertical offset: clamp to the slider's range; 0 is the default
    // (centered), no point saving it explicitly.
    if (out.valve_vertical_offset === undefined || out.valve_vertical_offset === null || out.valve_vertical_offset === "") {
      delete out.valve_vertical_offset;
    } else {
      const clamped = Math.max(-50, Math.min(50, Math.round(Number(out.valve_vertical_offset) || 0)));
      if (clamped === 0) delete out.valve_vertical_offset;
      else out.valve_vertical_offset = clamped;
    }
    // Valve/pipes scale multipliers: clamp to slider range, snap to the
    // 0.05 step, drop when equal to the 1.15 default (nothing to save).
    ["valve_scale_mobile", "valve_scale_tablet", "pipes_scale_mobile", "pipes_scale_tablet"].forEach((k) => {
      if (out[k] === undefined || out[k] === null || out[k] === "") {
        delete out[k];
        return;
      }
      let v = Math.max(0.5, Math.min(2.5, Number(out[k]) || 1.15));
      v = Math.round(v / 0.05) * 0.05;
      v = Math.round(v * 100) / 100;
      if (Math.abs(v - 1.15) < 0.001) delete out[k];
      else out[k] = v;
    });
    // Leak sensors: keep at most MAX_LEAK_SENSORS, trim labels. Rows with
    // no entity yet are kept as-is (not stripped) — the card already
    // treats "no entity" as "block hidden", and stripping mid-edit here
    // would make a freshly added row vanish before the user picks one.
    out.leak_sensors = (out.leak_sensors || [])
      .slice(0, MAX_LEAK_SENSORS)
      .map((s) => ({ label: (s && s.label || "").trim(), entity: (s && s.entity) || "" }));
    // Drop leftovers from pre-v5.0.0 configs — the card itself no longer
    // reads these, everything now lives in leak_sensors.
    delete out.bathroom_label;
    delete out.bathroom_leak_entity;
    delete out.kitchen_label;
    delete out.kitchen_leak_entity;
    // Drop any leftover value from configs saved before v4.4.0 removed this feature.
    delete out.auto_toggle_duration;
    return out;
  }

  // Застосовує зміну до this._config через _clean() і шле config-changed,
  // як і value-changed з ha-form — спільний вихід для форми та для
  // динамічного списку датчиків протічки нижче.
  _commitConfig(patch) {
    const prevLang = (this._config && this._config.language) || "uk";
    this._config = this._clean({ ...this._config, ...patch });
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
    // Re-render immediately instead of waiting for HA to round-trip
    // setConfig() back to us — without this, add/remove buttons in the leak
    // sensor list would keep operating on a stale closure over the old array.
    if (this._config.language !== prevLang) {
      this._redraw();
    } else {
      this._redrawLeakSensors();
    }
  }

  // Used exclusively by the position/scale sliders. Unlike _commitConfig,
  // this never rebuilds any DOM — the slider's own 'input' handler already
  // updates its range/value-label directly. Rebuilding the <input type=range>
  // element on every 'input' tick (the old behavior) was what made dragging
  // feel jerky: recreating the node mid-drag drops the browser's pointer
  // capture on it. This keeps the drag gesture on the same live element.
  _commitSliderPatch(patch) {
    this._config = this._clean({ ...this._config, ...patch });
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: this._config },
        bubbles: true,
        composed: true,
      })
    );
  }

  _redraw() {
    if (!this._form) {
      this.innerHTML = "";

      const wrap = document.createElement("div");
      this._wrap = wrap;
      this.appendChild(wrap);

      const form = document.createElement("ha-form");
      form.computeLabel = (schema) => schema.label || schema.name;
      form.addEventListener("value-changed", (ev) => {
        this._commitConfig(ev.detail?.value || {});
      });
      wrap.appendChild(form);
      this._form = form;

      const style = document.createElement("style");
      style.textContent = `
        .wvc-leak-section { margin-top: 16px; padding-top: 4px; }
        .wvc-leak-title, .wvc-valve-title {
          font-size: 14px; font-weight: 500; margin-bottom: 4px;
          color: var(--primary-text-color, #000);
        }
        .wvc-leak-note, .wvc-valve-hint {
          font-size: 12px; opacity: 0.6; margin-bottom: 10px;
          color: var(--primary-text-color, #000);
        }
        /* Each leak sensor is its own block, stacked full-width, instead of
           a cramped single row — the name field and the entity picker each
           get the full available width and left-aligned text/labels. */
        .wvc-leak-block {
          border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
          border-radius: 8px; padding: 10px 12px 12px; margin-bottom: 10px;
        }
        .wvc-leak-block-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 6px;
        }
        .wvc-leak-block-title {
          font-size: 12px; font-weight: 500; opacity: 0.65;
          color: var(--primary-text-color, #000);
        }
        .wvc-leak-field-label {
          display: block; font-size: 11px; opacity: 0.6; margin: 6px 0 2px;
          text-align: left; color: var(--primary-text-color, #000);
        }
        .wvc-leak-row { display: block; margin-bottom: 0; }
        .wvc-leak-row ha-entity-picker { display: block; width: 100%; }
        .wvc-leak-label-input {
          display: block; width: 100%; min-width: 0; box-sizing: border-box;
          padding: 10px 10px; font-size: 14px; font-family: inherit;
          text-align: left;
          border: 1px solid var(--outline-color, rgba(0,0,0,0.25));
          border-radius: 4px; background: transparent;
          color: var(--primary-text-color, #000);
        }
        .wvc-leak-remove-btn {
          flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%;
          border: none; background: transparent; cursor: pointer;
          font-size: 15px; line-height: 1; color: var(--error-color, #db4437);
        }
        .wvc-leak-remove-btn:hover { background: rgba(219,68,55,0.1); }
        .wvc-leak-add-btn {
          margin-top: 2px; padding: 10px 14px; border-radius: 8px;
          border: 1px dashed var(--outline-color, rgba(0,0,0,0.3));
          background: transparent; cursor: pointer; font-size: 14px;
          color: var(--primary-color, #03a9f4); width: 100%;
        }
        .wvc-leak-add-btn:hover { background: rgba(3,169,244,0.06); }
        .wvc-leak-add-btn:disabled {
          opacity: 0.4; cursor: default; background: transparent;
        }
        /* Valve/pipes position + scale sliders */
        .wvc-valve-section { margin-top: 16px; padding-top: 4px; }
        .wvc-slider-block { margin-bottom: 12px; }
        .wvc-valve-slider-row {
          display: flex; align-items: center; gap: 10px;
        }
        .wvc-valve-btn {
          flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%;
          border: 1px solid var(--outline-color, rgba(0,0,0,0.25));
          background: transparent; cursor: pointer; font-size: 16px;
          line-height: 1; color: var(--primary-text-color, #000);
        }
        .wvc-valve-btn:hover { background: rgba(3,169,244,0.08); }
        .wvc-valve-range { flex: 1; min-width: 0; }
        .wvc-valve-value {
          flex: 0 0 auto; min-width: 46px; text-align: right;
          font-size: 13px; font-family: monospace;
          color: var(--primary-text-color, #000);
        }
      `;
      wrap.appendChild(style);

      this._sliderRefs = {};
      this._ensureLayoutSection(wrap);

      const section = document.createElement("div");
      section.className = "wvc-leak-section";
      wrap.appendChild(section);
      this._leakSection = section;
    }

    const c = this._config || {};
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = {
      language: c.language || "uk",
      name: c.name || "Smart Water Valve",
      switch_entity: c.switch_entity || "",
      valve_state_entity: c.valve_state_entity || "",
      kran_battery_entity: c.kran_battery_entity || "",
      kran_signal_entity: c.kran_signal_entity || "",
      disable_animations: c.disable_animations === true,
      text_dry: c.text_dry || "",
      text_leak: c.text_leak || "",
      btn_open: c.btn_open || "",
      btn_close: c.btn_close || "",
      btn_opening: c.btn_opening || "",
      btn_closing: c.btn_closing || "",
      toggle_lock_ms: c.toggle_lock_ms ?? 8000,
      card_min_height: c.card_min_height || 0,
      card_height: c.card_height || 0,
    };

    this._refreshSliderUI();
    this._redrawLeakSensors();
  }

  // Slider definitions shared by _ensureLayoutSection/_refreshSliderUI.
  _sliderDefs() {
    return [
      { key: "valve_vertical_offset", min: -50, max: 50, step: 1, unit: "%", default: 0, titleKey: "valve_position_title" },
      { key: "valve_scale_mobile", min: 0.5, max: 2.5, step: 0.05, unit: "×", default: 1.15, titleKey: "valve_scale_mobile_title" },
      { key: "valve_scale_tablet", min: 0.5, max: 2.5, step: 0.05, unit: "×", default: 1.15, titleKey: "valve_scale_tablet_title" },
      { key: "pipes_scale_mobile", min: 0.5, max: 2.5, step: 0.05, unit: "×", default: 1.15, titleKey: "pipes_scale_mobile_title" },
      { key: "pipes_scale_tablet", min: 0.5, max: 2.5, step: 0.05, unit: "×", default: 1.15, titleKey: "pipes_scale_tablet_title" },
    ];
  }

  _fmtSliderValue(def, v) {
    return def.step >= 1 ? `${Math.round(v)}${def.unit}` : `${v.toFixed(2)}${def.unit}`;
  }

  _sliderCurrent(def) {
    const raw = this._config && this._config[def.key];
    return raw === undefined || raw === null || raw === "" ? def.default : Number(raw);
  }

  // Builds the position/scale slider rows exactly ONCE — every later config
  // change (drag, +/-, language switch) only ever updates these same live
  // elements in place (see _refreshSliderUI), it never recreates them. That
  // is what keeps dragging the <input type=range> smooth instead of jerky.
  _ensureLayoutSection(wrap) {
    if (this._layoutSection) return;
    const section = document.createElement("div");
    section.className = "wvc-valve-section";
    wrap.appendChild(section);
    this._layoutSection = section;

    const title = document.createElement("div");
    title.className = "wvc-valve-title";
    section.appendChild(title);
    this._layoutTitleEl = title;

    this._sliderDefs().forEach((def) => {
      const rowWrap = document.createElement("div");
      rowWrap.className = "wvc-slider-block";

      const label = document.createElement("div");
      label.className = "wvc-valve-hint";
      rowWrap.appendChild(label);

      const row = document.createElement("div");
      row.className = "wvc-valve-slider-row";

      const minusBtn = document.createElement("button");
      minusBtn.type = "button";
      minusBtn.className = "wvc-valve-btn";
      minusBtn.textContent = "\u2212";

      const range = document.createElement("input");
      range.type = "range";
      range.className = "wvc-valve-range";
      range.min = String(def.min);
      range.max = String(def.max);
      range.step = String(def.step);

      const plusBtn = document.createElement("button");
      plusBtn.type = "button";
      plusBtn.className = "wvc-valve-btn";
      plusBtn.textContent = "+";

      const valueLabel = document.createElement("span");
      valueLabel.className = "wvc-valve-value";

      const setValue = (next) => {
        let clamped = Math.max(def.min, Math.min(def.max, next));
        clamped = def.step >= 1 ? Math.round(clamped) : Math.round(clamped / def.step) * def.step;
        range.value = String(clamped);
        valueLabel.textContent = this._fmtSliderValue(def, clamped);
        this._commitSliderPatch({ [def.key]: clamped });
      };

      range.value = String(this._sliderCurrent(def));
      valueLabel.textContent = this._fmtSliderValue(def, this._sliderCurrent(def));
      range.addEventListener("input", () => setValue(Number(range.value)));
      minusBtn.addEventListener("click", () => setValue(this._sliderCurrent(def) - def.step));
      plusBtn.addEventListener("click", () => setValue(this._sliderCurrent(def) + def.step));

      row.appendChild(minusBtn);
      row.appendChild(range);
      row.appendChild(plusBtn);
      row.appendChild(valueLabel);
      rowWrap.appendChild(row);
      section.appendChild(rowWrap);

      this._sliderRefs[def.key] = { label, range, valueLabel, def };
    });
  }

  // Refreshes labels (language switch) and displayed values (e.g. after
  // setConfig() runs again) on the already-built slider rows, without ever
  // touching the DOM nodes the user might be actively dragging.
  _refreshSliderUI() {
    if (!this._layoutTitleEl) return;
    this._layoutTitleEl.textContent = this._editorLabel("valve_layout_title");
    Object.values(this._sliderRefs || {}).forEach(({ label, range, valueLabel, def }) => {
      label.textContent = this._editorLabel(def.titleKey);
      const current = this._sliderCurrent(def);
      range.value = String(current);
      valueLabel.textContent = this._fmtSliderValue(def, current);
    });
  }

  // Динамічний список датчиків протічки: "+ Додати датчик протічки" додає
  // пару полів (назва + ентіті), знизу знову "+". Обмежено MAX_LEAK_SENSORS
  // на рівні UI — сама модель (config.leak_sensors) довільної довжини.
  _redrawLeakSensors() {
    const section = this._leakSection;
    if (!section) return;
    const L = (key) => this._editorLabel(key);
    const sensors = (this._config && this._config.leak_sensors) || [];

    section.innerHTML = "";

    const title = document.createElement("div");
    title.className = "wvc-leak-title";
    title.textContent = L("leak_sensors_title");
    section.appendChild(title);

    const note = document.createElement("div");
    note.className = "wvc-leak-note";
    note.textContent = L("leak_sensors_limit_note");
    section.appendChild(note);

    sensors.forEach((sensor, index) => {
      const block = document.createElement("div");
      block.className = "wvc-leak-block";

      const header = document.createElement("div");
      header.className = "wvc-leak-block-header";
      const blockTitle = document.createElement("span");
      blockTitle.className = "wvc-leak-block-title";
      blockTitle.textContent = `${L("leak_sensors_title")} ${index + 1}`;
      header.appendChild(blockTitle);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "wvc-leak-remove-btn";
      removeBtn.title = L("remove_leak_sensor");
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => {
        const next = sensors.filter((_, i) => i !== index);
        this._commitConfig({ leak_sensors: next });
      });
      header.appendChild(removeBtn);
      block.appendChild(header);

      const row = document.createElement("div");
      row.className = "wvc-leak-row";

      const labelCaption = document.createElement("label");
      labelCaption.className = "wvc-leak-field-label";
      labelCaption.textContent = L("leak_label_placeholder");
      row.appendChild(labelCaption);

      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "wvc-leak-label-input";
      labelInput.placeholder = L("leak_label_placeholder");
      labelInput.value = sensor.label || "";
      labelInput.addEventListener("change", () => {
        const next = sensors.map((s, i) => (i === index ? { ...s, label: labelInput.value } : s));
        this._commitConfig({ leak_sensors: next });
      });
      row.appendChild(labelInput);

      const entityCaption = document.createElement("label");
      entityCaption.className = "wvc-leak-field-label";
      entityCaption.textContent = L("leak_entity_label");
      row.appendChild(entityCaption);

      let entityField;
      if (customElements.get("ha-entity-picker")) {
        entityField = document.createElement("ha-entity-picker");
        entityField.hass = this._hass;
        entityField.value = sensor.entity || "";
        entityField.includeDomains = ["binary_sensor"];
        entityField.label = L("leak_entity_label");
        entityField.addEventListener("value-changed", (ev) => {
          const value = ev.detail?.value || "";
          const next = sensors.map((s, i) => (i === index ? { ...s, entity: value } : s));
          this._commitConfig({ leak_sensors: next });
        });
      } else {
        // Fallback for HA frontends where ha-entity-picker isn't globally
        // registered — a plain text field still lets people type an
        // entity_id by hand.
        entityField = document.createElement("input");
        entityField.type = "text";
        entityField.className = "wvc-leak-label-input";
        entityField.placeholder = L("leak_entity_placeholder");
        entityField.value = sensor.entity || "";
        entityField.addEventListener("change", () => {
          const next = sensors.map((s, i) => (i === index ? { ...s, entity: entityField.value } : s));
          this._commitConfig({ leak_sensors: next });
        });
      }
      row.appendChild(entityField);

      block.appendChild(row);
      section.appendChild(block);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "wvc-leak-add-btn";
    addBtn.textContent = L("add_leak_sensor");
    const atLimit = sensors.length >= MAX_LEAK_SENSORS;
    addBtn.disabled = atLimit;
    addBtn.addEventListener("click", () => {
      if ((this._config.leak_sensors || []).length >= MAX_LEAK_SENSORS) return;
      const next = [...sensors, { label: "", entity: "" }];
      this._commitConfig({ leak_sensors: next });
    });
    section.appendChild(addBtn);
  }
}

if (!customElements.get("water-valve-card-editor")) {
  customElements.define("water-valve-card-editor", WaterValveCardEditor);
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, radii) {
    const r = typeof radii === "number" ? radii : radii || 0;
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

// Define card (or warn if old /local/ version already locked the name)
try {
  customElements.define("water-valve-card", WaterValveCard);
} catch (e) {
  console.error(
    "[water-valve-card] Could not register — another script already defined this element. " +
      "Remove resource /local/water-valve-card.js and restart HA.",
    e
  );
}

window.customCards = window.customCards || [];
window.customCards = window.customCards.filter((c) => c.type !== "water-valve-card");
window.customCards.push({
  type: "water-valve-card",
  name: "Water Valve Card",
  preview: true,
  description: "Smart water valve / Водяний кран — language, leaks, signal, animation toggle.",
  documentationURL: "https://github.com/kdinya/smart-water-valve",
});

console.info(
  "%c WATER-VALVE-CARD %c 5.0.4 ",
  "background:#0369a1;color:#fff;font-weight:bold;padding:2px 6px;",
  "background:#0f172a;color:#38bdf8;font-weight:bold;padding:2px 6px;"
);
