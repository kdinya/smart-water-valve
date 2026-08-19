export const configSchema = {
  type: "object",
  properties: {
    valve_entity: {
      type: "string",
      description: "Ентіті крана (switch/valve)"
    },
    leak_sensors: {
      type: "array",
      items: { type: "string" },
      description: "Список ентіті датчиків протєчки (binary_sensor)"
    }
  },
  required: ["valveentity", "leaksensors"]
};
