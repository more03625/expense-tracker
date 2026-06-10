import type { MonthlyBreakdown } from '../../types/finance'
import { fmt, fmtPercent } from '../../utils/financeFormat'

interface FinancialBreakdownTableProps {
  monthlyBreakdown: MonthlyBreakdown[]
}

export default function FinancialBreakdownTable({ monthlyBreakdown }: FinancialBreakdownTableProps) {
  const hasData = monthlyBreakdown.some(m => m.income > 0 || m.totalExpense > 0)

  return (
    <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
      <p className="text-sm font-medium text-slate-300 mb-4">Financial Year Breakdown</p>
      {hasData ? (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-navy-700/30">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-navy-900">
              <tr className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3 text-right">Income</th>
                <th className="px-4 py-3 text-right">Fixed Expense</th>
                <th className="px-4 py-3 text-right">Daily Expense</th>
                <th className="px-4 py-3 text-right">Total Expense</th>
                <th className="px-4 py-3 text-right">Savings</th>
                <th className="px-4 py-3 text-right">Savings %</th>
              </tr>
            </thead>
            <tbody>
              {monthlyBreakdown.map(row => (
                <tr
                  key={row.monthKey}
                  className="border-t border-navy-700/20 hover:bg-navy-800/30 transition-colors"
                >
                  <td className="px-4 py-2.5 text-slate-300 font-medium">{row.monthShort}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-400">{fmt(row.income)}</td>
                  <td className="px-4 py-2.5 text-right text-red-400">{fmt(row.fixedExpense)}</td>
                  <td className="px-4 py-2.5 text-right text-blue-400">{fmt(row.dailyExpense)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">{fmt(row.totalExpense)}</td>
                  <td className={`px-4 py-2.5 text-right font-medium ${row.savings >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                    {fmt(row.savings)}
                  </td>
                  <td className={`px-4 py-2.5 text-right ${row.savingsPercent >= 0 ? 'text-gold-400' : 'text-red-400'}`}>
                    {fmtPercent(row.savingsPercent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 text-slate-500 text-sm">No monthly data for this financial year</div>
      )}
    </div>
  )
}
