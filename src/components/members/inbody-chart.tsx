"use client"

import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { format } from "date-fns"

interface InBodyRecord {
  id: number
  weight: number
  skeletalMuscle: number
  bodyFat: number
  recordDate: Date
}

interface InbodyChartProps {
  data: InBodyRecord[]
}

export function InbodyChart({ data }: InbodyChartProps) {
  // Sort data by date ascending for the chart
  const sortedData = [...data].sort((a, b) => new Date(a.recordDate).getTime() - new Date(b.recordDate).getTime())

  const chartData = sortedData.map(record => ({
    date: format(new Date(record.recordDate), "dd/MM"),
    "Cân nặng (kg)": record.weight,
    "Cơ xương (kg)": record.skeletalMuscle,
    "Tỷ lệ mỡ (%)": record.bodyFat,
  }))

  if (chartData.length === 0) {
    return (
      <div className="w-full h-[300px] flex items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
        <p className="text-slate-500">Chưa có dữ liệu đo InBody.</p>
      </div>
    )
  }

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            dy={10}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 12 }}
            dx={-10}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          <Line 
            type="monotone" 
            dataKey="Cân nặng (kg)" 
            stroke="#0ea5e9" 
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="Cơ xương (kg)" 
            stroke="#10b981" 
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="Tỷ lệ mỡ (%)" 
            stroke="#f43f5e" 
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
