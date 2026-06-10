import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { CategoryInfo } from '../../types/finance'
import { fmt, getCatColor } from '../../utils/financeFormat'

const TOOLTIP_STYLE = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '12px',
  color: '#e2e8f0',
}

interface CategoryBreakdownChartProps {
  categoryBreakdown: { name: string; value: number }[]
  categories: CategoryInfo[]
}

export default function CategoryBreakdownChart({
  categoryBreakdown,
  categories,
}: CategoryBreakdownChartProps) {
  if (!categoryBreakdown.length) return null

  return (
    <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
      <p className="text-sm font-medium text-slate-300 mb-4">Expense By Category</p>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={categoryBreakdown}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={3}
            strokeWidth={0}
          >
            {categoryBreakdown.map((entry, i) => (
              <Cell key={i} fill={getCatColor(categories, entry.name)} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
          <Legend formatter={v => <span className="text-slate-300 text-xs">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
