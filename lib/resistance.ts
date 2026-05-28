// Physical constants (SI units)
const RHO = 1025;       // kg/m³  — seawater density at 15 °C
const NU = 1.1883e-6;   // m²/s   — kinematic viscosity of seawater at 15 °C
const G = 9.81;         // m/s²   — gravitational acceleration
const ETA_D = 0.65;     // —      — quasi-propulsive efficiency (propeller + shaft losses)

export interface ResistanceInputs {
  L: number;          // Length on waterline (m)
  B: number;          // Beam (m)
  T: number;          // Draft (m)
  volume: number;     // Displacement volume (m³)
  S: number;          // Wetted surface area (m²)
  speedKnots: number; // Ship speed (knots)
}

export interface ResistanceResults {
  Fn: number;  // Froude number (dimensionless)
  Re: number;  // Reynolds number (dimensionless)
  C_F: number; // ITTC-1957 frictional resistance coefficient (dimensionless)
  C_R: number; // Residuary resistance coefficient (dimensionless)
  R_F: number; // Frictional resistance (kN)
  R_R: number; // Residuary resistance (kN)
  R_T: number; // Total resistance (kN)
  P_E: number; // Effective (tow-rope) power (kW)
  P_B: number; // Brake power (kW)
}

/**
 * Estimates hull resistance and propulsion power using the ITTC-1957 friction
 * line and a simplified empirical residuary resistance model.
 *
 * Step 1 — Speed conversion
 *   Ships are specified in knots; physics needs m/s.
 *   V = speedKnots × 0.5144
 *
 * Step 2 — Reynolds number (Re)
 *   Re = V × L / ν
 *   Re is the ratio of inertial to viscous forces. For ships it is typically
 *   10⁸–10⁹, firmly in the turbulent regime.
 *
 * Step 3 — Frictional resistance coefficient (C_F, ITTC-1957)
 *   C_F = 0.075 / (log₁₀(Re) − 2)²
 *   This is the industry-standard line agreed at the 1957 ITTC conference.
 *   It relates the skin-friction drag to the dynamic pressure and wetted area.
 *
 * Step 4 — Froude number (Fn)
 *   Fn = V / √(g × L)
 *   Fn is the ratio of ship speed to the speed of gravity waves of length L.
 *   It controls wave-making resistance; above Fn ≈ 0.4 wave drag grows steeply.
 *
 * Step 5 — Residuary resistance coefficient (C_R)
 *   C_R = 0.0015 + 0.045 × Fn⁴
 *   C_R bundles wave-making, form drag, and other non-viscous components into
 *   a single empirical curve that rises sharply with speed.
 *
 * Step 6 — Dimensional resistances
 *   The standard formula is: R = ½ × ρ × V² × S × C  [Newtons]
 *   Dividing by 1000 converts to kN.
 *
 * Step 7 — Total resistance
 *   R_T = R_F + R_R  [kN]
 *
 * Step 8 — Power
 *   P_E [kW] = R_T [kN] × V [m/s]   (units work out because kN × m/s = kW)
 *   P_B [kW] = P_E / η_D             (back-out engine power from propulsive losses)
 */
export function calculateResistance(inputs: ResistanceInputs): ResistanceResults {
  const { L, S, speedKnots } = inputs;

  // Step 1: knots → m/s
  const V = speedKnots * 0.5144;

  // Step 2: Reynolds number
  const Re = (V * L) / NU;

  // Step 3: ITTC-1957 frictional coefficient
  const C_F = 0.075 / Math.pow(Math.log10(Re) - 2, 2);

  // Step 4: Froude number
  const Fn = V / Math.sqrt(G * L);

  // Step 5: Residuary coefficient (empirical Fn curve)
  const C_R = 0.0015 + 0.045 * Math.pow(Fn, 4);

  // Step 6: Dynamic pressure × wetted area (shared factor for both resistances)
  const q = 0.5 * RHO * V * V * S; // Newtons
  const R_F = (q * C_F) / 1000;    // kN
  const R_R = (q * C_R) / 1000;    // kN

  // Step 7: Total resistance
  const R_T = R_F + R_R;

  // Step 8: Power
  const P_E = R_T * V;    // kW
  const P_B = P_E / ETA_D; // kW

  return { Fn, Re, C_F, C_R, R_F, R_R, R_T, P_E, P_B };
}
