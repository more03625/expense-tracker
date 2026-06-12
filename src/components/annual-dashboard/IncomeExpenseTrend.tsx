import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { MonthlyBreakdown } from '../../types/finance'
import { fmt } from '../../utils/financeFormat'

const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '12px',
  color: '#e2e8f0',
}

interface IncomeExpenseTrendProps {
  monthlyBreakdown: MonthlyBreakdown[]
}

export default function IncomeExpenseTrend({ monthlyBreakdown }: IncomeExpenseTrendProps) {
  const chartData = monthlyBreakdown.map(m => ({
    month: m.monthShort,
    Income: m.income,
    'Total Expense': m.totalExpense,
    Investments: m.investment,
    'Cash Remaining': m.savings,
  }))

  const hasData = chartData.some(d =>
    d.Income > 0 || d['Total Expense'] > 0 || d.Investments > 0,
  )

  return (
    <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
      <p className="text-sm font-medium text-slate-300 mb-4">Income vs Expenses Trend</p>
      {hasData ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
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
            <Line type="monotone" dataKey="Income" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Total Expense" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Investments" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Cash Remaining" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center py-10 text-slate-500 text-sm">No trend data for this financial year</div>
      )}
    </div>
  )
}
