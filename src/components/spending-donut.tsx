"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { naira } from "@/lib/format";

const CATEGORY_LABEL: Record<string, string> = {
  FOOD: "Food",
  DATA_AIRTIME: "Data & Airtime",
  TRANSPORT: "Transport",
  FAMILY: "Family",
  SAVINGS: "Savings",
  UTILITIES: "Utilities",
  SHOPPING: "Shopping",
  TRANSFER: "Transfers",
  OTHER: "Other",
  SALARY: "Salary",
};

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#5eead4",
  "#fca5a5",
  "#c4b5fd",
  "#fcd34d",
];

export function SpendingDonut({
  data,
}: {
  data: { category: string; total: number }[];
}) {
  const total = data.reduce((a, d) => a + d.total, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="total"
              nameKey="category"
              innerRadius={58}
              outerRadius={88}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
              formatter={(v, n) => [
                naira(Number(v)),
                CATEGORY_LABEL[String(n)] ?? String(n),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Total out</span>
          <span className="text-lg font-semibold">{naira(total)}</span>
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        {data.map((d, i) => (
          <li key={d.category} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted-foreground">
              {CATEGORY_LABEL[d.category] ?? d.category}
            </span>
            <span className="ml-auto font-medium">{naira(d.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
