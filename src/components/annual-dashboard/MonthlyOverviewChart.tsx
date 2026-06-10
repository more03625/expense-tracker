import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { MonthlyBreakdown } from '../../types/finance'
import { fmt } from '../../utils/financeFormat'

const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '12px',
  color: '#e2e8f0',
}

interface MonthlyOverviewChartProps {
  monthlyBreakdown: MonthlyBreakdown[]
}

export default function MonthlyOverviewChart({ monthlyBreakdown }: MonthlyOverviewChartProps) {
  const chartData = monthlyBreakdown.map(m => ({
    month: m.monthShort,
    Income: m.income,
    'Fixed Expense': m.fixedExpense,
    'Daily Expense': m.dailyExpense,
    Savings: m.savings,
  }))

  const hasData = chartData.some(d => d.Income > 0 || d['Fixed Expense'] > 0 || d['Daily Expense'] > 0)

  return (
    <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
      <p className="text-sm font-medium text-slate-300 mb-4">Monthly Financial Overview</p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={60}
              tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
            <Legend formatter={v => <span className="text-slate-300 text-xs">{v}</span>} />
            <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Fixed Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Daily Expense" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Savings" fill="#fbbf24" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center py-10 text-slate-500 text-sm">No data for this financial year</div>
      )}
    </div>
  )
}
