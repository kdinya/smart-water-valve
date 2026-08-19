import { configSchema } from "./config.js";
import "./styles.css";

class WaterValveCard extends HTMLElement {
  setConfig(config) {
    if (!configSchema.properties.valveentity || !configSchema.properties.leaksensors) {
      throw new Error("Неправильна конфігурація");
    }
    this.config = config;
  }

  set hass(hass) {
    const valve = hass.states[this.config.valve_entity];
    const leaks = this.config.leak_sensors.map(id => hass.states[id]);

    this.innerHTML = `
      <div class="card">
        <h2>Smart Water Valve</h2>
        <p>Кран: ${valve ? valve.state : "недоступний"}</p>
        <p>Протєчки: ${leaks.map(l => l ? l.state : "недоступний").join(", ")}</p>
        <div class="button" onclick="this.toggleValve()">Перемкнути кран</div>
      </div>
    `;
  }

  toggleValve() {
    const event = new CustomEvent("call-service", {
      detail: {
        domain: "switch",
        service: "toggle",
        servicedata: { entityid: this.config.valve_entity }
      },
      bubbles: true,
      composed: true
    });
    this.dispatchEvent(event);
  }
}

customElements.define("water-valve-card", WaterValveCard);
