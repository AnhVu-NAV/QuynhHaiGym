"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

type RevenuePoint = {
  name: string
  total: number
}

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
})

function formatAxisValue(value: number) {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}tr`
  }

  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`
  }

  return value.toLocaleString("vi-VN")
}

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="h-[280px] w-full sm:h-[330px]">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={{ width: 640, height: 330 }}
      >
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
          <XAxis
            dataKey="name"
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickMargin={12}
          />
          <YAxis
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatAxisValue}
            width={48}
          />
          <Tooltip
            formatter={(value) => [currencyFormatter.format(Number(value || 0)), "Doanh thu"]}
            cursor={{ fill: "rgba(16, 185, 129, 0.06)", radius: 8 }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid #e2e8f0",
              boxShadow: "0 12px 30px -16px rgba(15, 23, 42, 0.45)",
              fontSize: 13,
            }}
            labelStyle={{ color: "#0f172a", fontWeight: 700, marginBottom: 4 }}
            itemStyle={{ color: "#047857", fontWeight: 600 }}
          />
          <Bar dataKey="total" fill="url(#revenueBar)" radius={[8, 8, 3, 3]} maxBarSize={52} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
