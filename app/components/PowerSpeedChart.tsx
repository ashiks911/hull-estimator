"use client";

import { useState, useRef, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { TooltipIcon, type TooltipContent } from "@/app/components/TooltipIcon";

export type ChartPoint = {
  speedKnots: number;
  P_B: number; // kW
  R_T: number; // kN
  Fn: number;
};

// These must stay in sync with the LineChart's margin and YAxis width props below.
const PLOT_LEFT = 10 + 68;        // margin.left + left Y-axis width
const PLOT_RIGHT_OFFSET = 68 + 68; // margin.right + right Y-axis width

// ─── Custom tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload as ChartPoint;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs space-y-0.5">
      <p className="font-semibold text-gray-700 mb-1">{label} kn</p>
      <p className="text-blue-600">P_B: {pt.P_B.toFixed(1)} kW</p>
      <p className="text-emerald-600">R_T: {pt.R_T.toFixed(2)} kN</p>
      <p className="text-gray-500">Fn: {pt.Fn.toFixed(3)}</p>
    </div>
  );
}

// ─── Annotation row ─────────────────────────────────────────────────────────────

function AnnotationRow({
  containerWidth,
  data,
  userSpeedKnots,
  hullSpeedKnots,
  hullSpeedTooltip,
}: {
  containerWidth: number;
  data: ChartPoint[];
  userSpeedKnots: number;
  hullSpeedKnots: number;
  hullSpeedTooltip: TooltipContent;
}) {
  const dataMin = data[0].speedKnots;
  const dataMax = data[data.length - 1].speedKnots;
  const plotWidth = containerWidth - PLOT_LEFT - PLOT_RIGHT_OFFSET;

  function speedToLeft(speed: number): number {
    const range = dataMax - dataMin || 1;
    return PLOT_LEFT + ((speed - dataMin) / range) * plotWidth;
  }

  const selectedLeft = speedToLeft(userSpeedKnots);
  const hullInRange = hullSpeedKnots <= dataMax;
  const hullLeft = hullInRange ? speedToLeft(hullSpeedKnots) : null;

  // Stack vertically if the two labels would overlap (within 80px).
  const wouldCollide = hullLeft !== null && Math.abs(selectedLeft - hullLeft) < 80;

  return (
    <div className="relative mt-2" style={{ height: wouldCollide ? 44 : 24 }}>
      {/* Blue dot — Selected speed */}
      <div
        className="absolute flex items-center gap-1"
        style={{ left: selectedLeft, top: 2, transform: "translateX(-50%)" }}
      >
        <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
        <span className="text-[11px] font-medium text-blue-700 whitespace-nowrap">
          Selected: {userSpeedKnots} kn
        </span>
      </div>

      {/* Orange dot — Hull speed (in range) */}
      {hullLeft !== null && (
        <div
          className="absolute flex items-center gap-1"
          style={{ left: hullLeft, top: wouldCollide ? 24 : 2, transform: "translateX(-50%)" }}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <span className="text-[11px] font-medium text-amber-800 whitespace-nowrap">
            Hull speed: {hullSpeedKnots.toFixed(1)} kn
          </span>
          <TooltipIcon content={hullSpeedTooltip} />
        </div>
      )}

      {/* Hull speed off the right edge — arrow indicator */}
      {hullLeft === null && (
        <div className="absolute flex items-center gap-1" style={{ right: 4, top: 2 }}>
          <span className="text-[11px] text-amber-600 whitespace-nowrap">
            Hull speed: {hullSpeedKnots.toFixed(1)} kn →
          </span>
          <TooltipIcon content={hullSpeedTooltip} />
        </div>
      )}
    </div>
  );
}

// ─── Main chart component ───────────────────────────────────────────────────────

export function PowerSpeedChart({
  data,
  userSpeedKnots,
  hullSpeedKnots,
}: {
  data: ChartPoint[];
  userSpeedKnots: number;
  hullSpeedKnots: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (data.length === 0) return null;

  const maxX = data[data.length - 1].speedKnots;
  const hullInRange = hullSpeedKnots <= maxX;

  const hullSpeedTooltip: TooltipContent = {
    definition: "The natural maximum cruising speed of a displacement hull.",
    formula: "V_hull (knots) ≈ 1.34 × √L (ft), corresponding to Fn ≈ 0.40.",
    interpretation:
      `Below this speed, power demand rises gradually. Approaching and exceeding it, the hull begins to ` +
      `climb its own bow wave and power demand rises steeply — which is why displacement vessels rarely ` +
      `cruise above hull speed. For this hull: V_hull ≈ ${hullSpeedKnots.toFixed(1)} knots.`,
  };

  return (
    <div className="mt-4 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-800">
          Power &amp; Resistance vs Speed
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Brake power (left axis, solid blue) and total resistance (right axis, dashed green) across the operating speed range.
        </p>
      </div>

      {/* Chart — containerRef lets us measure width for the annotation row */}
      <div ref={containerRef}>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={data} margin={{ top: 12, right: 68, left: 10, bottom: 36 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />

            <XAxis
              dataKey="speedKnots"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 11, fill: "#6B7280" }}
              tickCount={10}
              label={{
                value: "Speed (knots)",
                position: "insideBottom",
                offset: -20,
                fontSize: 12,
                fill: "#6B7280",
              }}
            />

            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "#6B7280" }}
              width={68}
              label={{
                value: "Brake Power (kW)",
                angle: -90,
                position: "insideLeft",
                offset: 18,
                fontSize: 11,
                fill: "#3B82F6",
              }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#6B7280" }}
              width={68}
              label={{
                value: "Resistance (kN)",
                angle: 90,
                position: "insideRight",
                offset: 18,
                fontSize: 11,
                fill: "#10B981",
              }}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: 12 }} />

            {hullInRange && (
              <ReferenceArea
                yAxisId="left"
                x1={hullSpeedKnots}
                x2={maxX}
                fill="#FEF3C7"
                fillOpacity={0.7}
              />
            )}

            {/* Hull speed line — no inline label; label is in the annotation row below */}
            <ReferenceLine
              yAxisId="left"
              x={hullSpeedKnots}
              stroke="#F59E0B"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />

            {/* Selected speed line — no inline label */}
            <ReferenceLine
              yAxisId="left"
              x={userSpeedKnots}
              stroke="#3B82F6"
              strokeWidth={1.5}
              strokeDasharray="5 3"
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="P_B"
              name="Brake Power (kW)"
              stroke="#3B82F6"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "#3B82F6" }}
            />

            <Line
              yAxisId="right"
              type="monotone"
              dataKey="R_T"
              name="Total Resistance (kN)"
              stroke="#10B981"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 4, fill: "#10B981" }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Pixel-aligned annotation row — rendered once containerWidth is known */}
        {containerWidth > 0 && (
          <AnnotationRow
            containerWidth={containerWidth}
            data={data}
            userSpeedKnots={userSpeedKnots}
            hullSpeedKnots={hullSpeedKnots}
            hullSpeedTooltip={hullSpeedTooltip}
          />
        )}
      </div>

      {hullInRange && (
        <p className="text-xs text-amber-600 text-center mt-2">
          Model validity decreases above hull speed.
        </p>
      )}
    </div>
  );
}
