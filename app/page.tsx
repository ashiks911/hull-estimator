"use client";

import { useState } from "react";
import { calculateResistance, type ResistanceResults } from "@/lib/resistance";
import { PowerSpeedChart, type ChartPoint } from "@/app/components/PowerSpeedChart";
import { TooltipIcon, type TooltipContent } from "@/app/components/TooltipIcon";

// ─── Types ─────────────────────────────────────────────────────────────────────

type FormState = {
  lwl: string;
  beam: string;
  draft: string;
  displacementVolume: string;
  wettedSurfaceArea: string;
  speed: string;
};

type FieldName = keyof FormState;

// ─── Static tooltip content ────────────────────────────────────────────────────

const TOOLTIPS = {
  R_F: {
    definition: "Drag from water sliding along the hull's wetted surface.",
    formula: "R_F = ½ × ρ × V² × S × C_F",
  },
  R_R: {
    definition: "Drag from wave-making and pressure effects as the hull pushes water aside.",
    formula: "R_R = ½ × ρ × V² × S × C_R",
  },
  R_T: {
    definition: "The combined force resisting forward motion.",
    formula: "R_T = R_F + R_R. This is what the propeller must overcome.",
  },
  P_E: {
    definition: "Power needed to tow the bare hull at this speed, ignoring propeller losses.",
    formula: "P_E = R_T × V",
  },
  P_B: {
    definition:
      "Power the engine must deliver at its output shaft, accounting for propeller and drivetrain losses.",
    formula: "P_B = P_E / 0.65 (assumed propulsive efficiency).",
  },
  C_F: {
    definition: "Frictional resistance coefficient from the ITTC-1957 friction line.",
    formula: "C_F = 0.075 / (log₁₀(Re) − 2)²",
  },
  C_R: {
    definition:
      "Residuary resistance coefficient. This v1 uses a simplified empirical estimate; production tools use methods like Holtrop-Mennen.",
    formula: "C_R = 0.0015 + 0.045 × Fn⁴",
  },
} satisfies Record<string, Omit<TooltipContent, "interpretation">>;

// ─── Constants ─────────────────────────────────────────────────────────────────

const initialForm: FormState = {
  lwl: "",
  beam: "",
  draft: "",
  displacementVolume: "",
  wettedSurfaceArea: "",
  speed: "",
};

type Preset = {
  label: string;
  caption: string;
  values: FormState;
};

const PRESETS: Preset[] = [
  {
    label: "Small sailboat",
    caption: "Small sailboat — light displacement, leisurely pace",
    values: { lwl: "10", beam: "3.2", draft: "1.5", displacementVolume: "18", wettedSurfaceArea: "38", speed: "6" },
  },
  {
    label: "Coastal trawler",
    caption: "Coastal trawler — working hull, steady moderate speed",
    values: { lwl: "22", beam: "6.5", draft: "2.8", displacementVolume: "280", wettedSurfaceArea: "240", speed: "10" },
  },
  {
    label: "Harbor tugboat",
    caption: "Harbor tugboat — full-form hull built for towing power",
    values: { lwl: "28", beam: "9", draft: "3.8", displacementVolume: "560", wettedSurfaceArea: "380", speed: "11" },
  },
  {
    label: "Coastal cargo ship",
    caption: "Coastal cargo ship — full-form hull, economical moderate speed",
    values: { lwl: "100", beam: "16", draft: "6", displacementVolume: "7000", wettedSurfaceArea: "2200", speed: "14" },
  },
  {
    label: "Container ship",
    caption: "Container ship — moderate hull, fast",
    values: { lwl: "200", beam: "30", draft: "11", displacementVolume: "39600", wettedSurfaceArea: "7800", speed: "22" },
  },
  {
    label: "Bulk carrier",
    caption: "Bulk carrier — very full hull, slow and efficient",
    values: { lwl: "230", beam: "32", draft: "13", displacementVolume: "81400", wettedSurfaceArea: "10500", speed: "14" },
  },
];

const initialResults: ResistanceResults = {
  Fn: 0, Re: 0, C_F: 0, C_R: 0,
  R_F: 0, R_R: 0, R_T: 0, P_E: 0, P_B: 0,
};

// ─── Validation ────────────────────────────────────────────────────────────────

function validateForm(form: FormState): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  const positiveFields: FieldName[] = [
    "lwl", "beam", "draft", "displacementVolume", "wettedSurfaceArea",
  ];
  for (const field of positiveFields) {
    if (form[field] === "") errors[field] = "Required";
    else if (isNaN(parseFloat(form[field])) || parseFloat(form[field]) <= 0)
      errors[field] = "Must be greater than 0";
  }
  if (form.speed === "") {
    errors.speed = "Required";
  } else {
    const s = parseFloat(form.speed);
    if (isNaN(s) || s <= 0) errors.speed = "Must be greater than 0";
    else if (s > 50) errors.speed = "Maximum 50 knots";
  }
  return errors;
}

// ─── Page component ────────────────────────────────────────────────────────────

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [touched, setTouched] = useState<Set<FieldName>>(new Set());
  const [results, setResults] = useState<ResistanceResults>(initialResults);
  const [calculated, setCalculated] = useState(false);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [hullSpeedKnots, setHullSpeedKnots] = useState(0);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | null>(null);

  const errors = validateForm(form);
  const isValid = Object.keys(errors).length === 0;

  const L = parseFloat(form.lwl);
  const B = parseFloat(form.beam);
  const T = parseFloat(form.draft);
  const vol = parseFloat(form.displacementVolume);
  const volumeWarning =
    L > 0 && B > 0 && T > 0 && vol > 0 && vol > L * B * T
      ? "⚠ Volume exceeds L×B×T (block coefficient > 1) — check inputs."
      : null;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setTouched((prev) => new Set(prev).add(e.target.name as FieldName));
  }

  function fieldError(name: FieldName): string | undefined {
    return touched.has(name) ? errors[name] : undefined;
  }

  function handlePresetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const idx = e.target.value === "" ? null : parseInt(e.target.value, 10);
    setSelectedPresetIndex(idx);
    if (idx !== null) {
      setForm(PRESETS[idx].values);
      setTouched(new Set());
    }
  }

  function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    const inputL = parseFloat(form.lwl);
    const inputB = parseFloat(form.beam);
    const inputT = parseFloat(form.draft);
    const inputVolume = parseFloat(form.displacementVolume);
    const inputS = parseFloat(form.wettedSurfaceArea);
    const inputSpeed = parseFloat(form.speed);

    setResults(
      calculateResistance({
        L: inputL, B: inputB, T: inputT,
        volume: inputVolume, S: inputS, speedKnots: inputSpeed,
      })
    );

    // Generate sweep data: 1 kn to min(inputSpeed × 1.4, 50) in 0.5-kn steps.
    const maxChartSpeed = Math.min(inputSpeed * 1.4, 50);
    const points: ChartPoint[] = [];
    for (let i = 0; ; i++) {
      const speed = parseFloat((1 + i * 0.5).toFixed(1));
      if (speed > maxChartSpeed + 0.001) break;
      const r = calculateResistance({
        L: inputL, B: inputB, T: inputT,
        volume: inputVolume, S: inputS, speedKnots: speed,
      });
      points.push({ speedKnots: speed, P_B: r.P_B, R_T: r.R_T, Fn: r.Fn });
    }
    setChartData(points);

    // Hull speed (knots): V_hull = 1.34 × √(LWL in feet)
    setHullSpeedKnots(1.34 * Math.sqrt(inputL / 0.3048));

    setCalculated(true);
  }

  // Dynamic tooltip interpretations for Fn and Re (only meaningful after a calculation).
  const fnTooltip: TooltipContent = {
    definition: "Dimensionless speed comparing inertia to gravity. Critical for wave-making.",
    formula: "Fn = V / √(g × L). Hull speed corresponds to Fn ≈ 0.4.",
    interpretation: calculated
      ? fnInterpretation(results.Fn)
      : undefined,
  };

  const reTooltip: TooltipContent = {
    definition:
      "Dimensionless number that describes the flow regime around the hull. Higher means more turbulent flow.",
    formula: "Re = V × L / ν",
    interpretation: calculated
      ? `Your Re = ${toSciNotation(results.Re)} — fully turbulent flow, typical for ships at this scale.`
      : undefined,
  };

  const hullSpeedTooltip: TooltipContent = {
    definition: "The natural maximum cruising speed of a displacement hull.",
    formula: "V_hull (knots) ≈ 1.34 × √L (ft), corresponding to Fn ≈ 0.40.",
    interpretation:
      `Below this speed, power demand rises gradually. Approaching and exceeding it, the hull begins to ` +
      `climb its own bow wave and power demand rises steeply — which is why displacement vessels rarely ` +
      `cruise above hull speed. For this hull: V_hull ≈ ${hullSpeedKnots.toFixed(1)} knots.`,
  };

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Hull Resistance Estimator
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter hull parameters to estimate resistance and power requirements.
          </p>
        </div>

        {/* Input form */}
        <form
          onSubmit={handleCalculate}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="vessel-preset" className="text-sm font-medium text-gray-700">
              Vessel presets
            </label>
            <select
              id="vessel-preset"
              value={selectedPresetIndex ?? ""}
              onChange={handlePresetChange}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select a vessel type…</option>
              {PRESETS.map((preset, i) => (
                <option key={preset.label} value={i}>{preset.label}</option>
              ))}
            </select>
            {selectedPresetIndex !== null && (
              <p className="text-xs text-gray-400">{PRESETS[selectedPresetIndex].caption}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <InputField label="Length on Waterline" unit="m" name="lwl" value={form.lwl} onChange={handleChange} onBlur={handleBlur} error={fieldError("lwl")} />
            <InputField label="Beam" unit="m" name="beam" value={form.beam} onChange={handleChange} onBlur={handleBlur} error={fieldError("beam")} />
            <InputField label="Draft" unit="m" name="draft" value={form.draft} onChange={handleChange} onBlur={handleBlur} error={fieldError("draft")} />
            <InputField label="Displacement Volume" unit="m³" name="displacementVolume" value={form.displacementVolume} onChange={handleChange} onBlur={handleBlur} error={fieldError("displacementVolume")} warning={!errors.displacementVolume ? volumeWarning ?? undefined : undefined} />
            <InputField label="Wetted Surface Area" unit="m²" name="wettedSurfaceArea" value={form.wettedSurfaceArea} onChange={handleChange} onBlur={handleBlur} error={fieldError("wettedSurfaceArea")} />
            <InputField label="Speed" unit="knots" name="speed" value={form.speed} onChange={handleChange} onBlur={handleBlur} error={fieldError("speed")} />
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className={`w-full py-2.5 px-4 text-sm font-medium rounded-lg transition-colors ${
              isValid
                ? "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Calculate
          </button>
        </form>

        {/* Results panel */}
        {calculated && (
          <>
            <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold mb-4">Results</h2>
              <div className="divide-y divide-gray-100">
                <ResultRow label="Frictional Resistance" value={results.R_F} unit="kN" tooltip={TOOLTIPS.R_F} />
                <ResultRow label="Residuary Resistance" value={results.R_R} unit="kN" tooltip={TOOLTIPS.R_R} />
                <ResultRow label="Total Resistance" value={results.R_T} unit="kN" highlight tooltip={TOOLTIPS.R_T} />
                <ResultRow label="Effective Power" value={results.P_E} unit="kW" tooltip={TOOLTIPS.P_E} />
                <ResultRow label="Brake Power" value={results.P_B} unit="kW" highlight tooltip={TOOLTIPS.P_B} />
              </div>
            </div>

            <SummaryCallout
              {...buildSummary(
                results.P_B,
                results.Fn,
                form.speed,
                vol / (L * B * T)
              )}
            />

            <PowerSpeedChart
              data={chartData}
              userSpeedKnots={parseFloat(form.speed)}
              hullSpeedKnots={hullSpeedKnots}
            />

            <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Intermediate Values
              </h3>
              <div className="divide-y divide-gray-200">
                <IntermRow label="Froude Number (Fn)" tooltip={fnTooltip}>
                  <div className="text-right">
                    <span className="text-sm tabular-nums font-mono text-gray-800">
                      {results.Fn.toFixed(3)}
                    </span>
                    {(results.Fn < 0.15 || results.Fn > 0.35) && (
                      <div className="text-xs text-amber-500 mt-0.5">⚠ Outside validity range</div>
                    )}
                  </div>
                </IntermRow>
                <IntermRow label="Reynolds Number (Re)" tooltip={reTooltip}>
                  <span className="text-sm tabular-nums font-mono text-gray-800">
                    {toSciNotation(results.Re)}
                  </span>
                </IntermRow>
                <IntermRow label="C_F (ITTC-1957)" tooltip={TOOLTIPS.C_F}>
                  <span className="text-sm tabular-nums font-mono text-gray-800">
                    {toSciNotation(results.C_F)}
                  </span>
                </IntermRow>
                <IntermRow label="C_R (residuary)" tooltip={TOOLTIPS.C_R}>
                  <span className="text-sm tabular-nums font-mono text-gray-800">
                    {toSciNotation(results.C_R)}
                  </span>
                </IntermRow>
                <IntermRow label="Hull speed" tooltip={hullSpeedTooltip}>
                  <span className="text-sm tabular-nums font-mono text-gray-800">
                    {hullSpeedKnots.toFixed(1)} kn
                  </span>
                </IntermRow>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-400 text-center">
              Simplified empirical model for educational use. Validity range approximately Fn = 0.15–0.35.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const SUPERSCRIPTS: Record<string, string> = {
  "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³",
  "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

function toSciNotation(value: number): string {
  const [mantissa, rawExp] = value.toExponential(2).split("e");
  const expDigits = rawExp.replace("+", "").split("").map((c) => SUPERSCRIPTS[c] ?? c).join("");
  return `${mantissa} × 10${expDigits}`;
}

function fnInterpretation(fn: number): string {
  const label = `Your Fn = ${fn.toFixed(3)}`;
  if (fn < 0.15) return `${label} — below the model's lower validity range.`;
  if (fn <= 0.35) return `${label} — within the validity range, where estimates are most reliable.`;
  if (fn <= 0.4) return `${label} — approaching hull speed; wave resistance is increasing steeply.`;
  return `${label} — above hull speed; wave drag dominates and this simplified model is unreliable.`;
}

function vesselComparison(pb: number): string {
  if (pb < 50) return "small recreational boat such as a day cruiser";
  if (pb < 200) return "mid-size pleasure craft or small fishing boat";
  if (pb < 800) return "large yacht or coastal workboat";
  if (pb < 3000) return "small coastal cargo ship or tugboat";
  if (pb < 10000) return "mid-size cargo ship or ferry";
  return "large container ship or cruise liner";
}

function formatPower(pb: number): string {
  const hp = pb * 1.341;
  if (pb < 1) {
    const watts = Math.round((pb * 1000) / 5) * 5;
    return `less than 1 kW (${watts} W)`;
  }
  if (pb < 10) {
    return `${pb.toFixed(1)} kW (${Math.round(hp)} hp)`;
  }
  if (pb < 100) {
    return `${Math.round(pb)} kW (${Math.round(hp)} hp)`;
  }
  if (pb < 1000) {
    return `${Math.round(pb / 5) * 5} kW (${Math.round(hp / 5) * 5} hp)`;
  }
  return `${Math.round(pb / 10) * 10} kW (${Math.round(hp / 10) * 10} hp)`;
}

function buildSummary(
  pb: number,
  fn: number,
  speedKnots: string,
  blockCoeff: number
): { main: string; note: string | null } {
  const main =
    `This vessel needs roughly ${formatPower(pb)} of engine power to maintain ` +
    `${speedKnots} knots — comparable to a ${vesselComparison(pb)}.`;

  let note: string | null = null;
  if (fn > 0.40) {
    note =
      "Note: at this speed the hull is approaching or exceeding hull speed — actual power demand will be significantly higher than this simplified model predicts.";
  } else if (fn > 0.35) {
    note =
      "Note: Fn > 0.35 — approaching the upper limit of the simplified residuary-resistance model's validity range.";
  } else if (blockCoeff > 0.85) {
    note =
      "Note: this is a very full-form hull (block coefficient > 0.85), typical of bulk carriers or tankers.";
  } else if (blockCoeff < 0.35) {
    note =
      "Note: this is a very fine hull (block coefficient < 0.35), typical of fast ferries or naval vessels.";
  } else if (fn < 0.15) {
    note = "Note: at this low speed, residuary resistance is minimal and friction dominates.";
  }

  return { main, note };
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SummaryCallout({ main, note }: { main: string; note: string | null }) {
  return (
    <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
      <svg
        className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="space-y-1.5">
        <p className="text-base text-gray-800 leading-snug">{main}</p>
        {note && <p className="text-sm text-gray-500 leading-snug">{note}</p>}
      </div>
    </div>
  );
}

function InputField({
  label, unit, name, value, onChange, onBlur, error, warning,
}: {
  label: string;
  unit: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  warning?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm font-medium text-gray-700">
        {label} <span className="font-normal text-gray-400">({unit})</span>
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder="0"
        className={`rounded-lg border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:border-transparent ${
          error
            ? "border-red-400 focus:ring-red-400"
            : "border-gray-300 focus:ring-blue-500"
        }`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {!error && warning && <p className="text-xs text-amber-500">{warning}</p>}
    </div>
  );
}

function IntermRow({
  label, tooltip, children,
}: {
  label: string;
  tooltip: TooltipContent;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-start py-2.5">
      <span className="flex items-center gap-1.5 text-sm text-gray-500">
        {label}
        <TooltipIcon content={tooltip} />
      </span>
      {children}
    </div>
  );
}

function ResultRow({
  label, value, unit, highlight = false, precision = 2, tooltip,
}: {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
  precision?: number;
  tooltip: TooltipContent;
}) {
  return (
    <div
      className={`flex justify-between items-center py-3 ${
        highlight ? "font-semibold" : "text-gray-700"
      }`}
    >
      <span className="flex items-center gap-1.5 text-sm">
        {label}
        <TooltipIcon content={tooltip} />
      </span>
      <span className="text-sm tabular-nums">
        {value.toFixed(precision)}{" "}
        <span className="text-gray-400 font-normal">{unit}</span>
      </span>
    </div>
  );
}
