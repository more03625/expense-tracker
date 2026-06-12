import type { AnnualSummary } from '../../types/finance'
import { fmt, fmtPercent } from '../../utils/financeFormat'

interface SavingsAnalysisProps {
  summary: AnnualSummary
}

function AnalysisCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function SavingsAnalysis({ summary }: SavingsAnalysisProps) {
  const {
    highestSavingsMonth,
    lowestSavingsMonth,
    averageMonthlySavings,
    expenseRatio,
    investmentRate,
    totalInvestments,
  } = summary

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-300">Savings Analysis</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <AnalysisCard
          label="Highest Cash Remaining"
          value={highestSavingsMonth ? fmt(highestSavingsMonth.savings) : '—'}
          sub={highestSavingsMonth?.monthLabel}
        />
        <AnalysisCard
          label="Lowest Cash Remaining"
          value={lowestSavingsMonth ? fmt(lowestSavingsMonth.savings) : '—'}
          sub={lowestSavingsMonth?.monthLabel}
        />
        <AnalysisCard
          label="Avg Monthly Cash Remaining"
          value={fmt(averageMonthlySavings)}
        />
        <AnalysisCard
          label="Total Expense Ratio"
          value={fmtPercent(expenseRatio)}
          sub="(Fixed + Daily) / Income"
        />
        <AnalysisCard
          label="Investment Rate"
          value={fmtPercent(investmentRate)}
          sub={totalInvestments > 0 ? fmt(totalInvestments) + ' invested' : 'No investments logged'}
        />
      </div>
    </div>
  )
}
