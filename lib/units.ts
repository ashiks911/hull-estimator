export type UnitSystem = "metric" | "imperial";

export type Quantity = "length" | "volume" | "area" | "speed" | "resistance" | "power";

const FACTORS: Record<Quantity, number> = {
  length:     3.28084,
  volume:     35.3147,
  area:       10.7639,
  speed:      1,
  resistance: 224.809,
  power:      1.34102,
};

const LABELS: Record<Quantity, { metric: string; imperial: string }> = {
  length:     { metric: "m",     imperial: "ft"    },
  volume:     { metric: "m³",    imperial: "ft³"   },
  area:       { metric: "m²",    imperial: "ft²"   },
  speed:      { metric: "knots", imperial: "knots" },
  resistance: { metric: "kN",    imperial: "lbf"   },
  power:      { metric: "kW",    imperial: "hp"    },
};

/** Convert a value from SI to the chosen display unit. */
export function toDisplay(siValue: number, quantity: Quantity, units: UnitSystem): number {
  return units === "imperial" ? siValue * FACTORS[quantity] : siValue;
}

/** Convert a typed display-unit value back to SI for storage. */
export function fromInput(displayValue: number, quantity: Quantity, units: UnitSystem): number {
  return units === "imperial" ? displayValue / FACTORS[quantity] : displayValue;
}

/** Return the label string (e.g. "ft", "hp") for a quantity in the chosen system. */
export function unitLabel(quantity: Quantity, units: UnitSystem): string {
  return LABELS[quantity][units];
}
