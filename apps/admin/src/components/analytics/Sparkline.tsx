"use client";

import { AreaChart, Area, ResponsiveContainer, Tooltip, type TooltipProps } from "recharts";

type Point = { v: number };

function SparkTooltip({ active, payload }: TooltipProps<number, string> & { label?: string; formatter?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return null; // tooltips hidden on sparklines by default
}

export function Sparkline({
  values,
  color = "#6366f1",
  height = 40,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const data: Point[] = values.map((v) => ({ v }));
  const gradId = `sg-${color.replace("#", "")}`;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip content={<SparkTooltip />} />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
