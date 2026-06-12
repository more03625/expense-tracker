import { TrendingUp, CreditCard, ShoppingCart, Wallet, PiggyBank } from 'lucide-react'
import type { AnnualSummary } from '../../types/finance'
import type { YoYComparison } from '../../utils/financeAggregation'
import { fmt } from '../../utils/financeFormat'

interface SummaryCardsProps {
  summary: AnnualSummary
  previousYearComparison: YoYComparison | null
}

type StatColor = 'gold' | 'green' | 'red' | 'blue' | 'purple'

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'gold',
  sub,
  emoji,
}: {
  label: string
  value: string
  icon: typeof TrendingUp
  color?: StatColor
  sub?: string
  emoji?: string
}) {
  const colors: Record<StatColor, string> = {
    gold: 'from-gold-500/20 to-gold-600/5 border-gold-500/20 text-gold-400',
    green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    red: 'from-red-500/20 to-red-600/5 border-red-500/20 text-red-400',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400',
  }

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 animate-slide-up`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
          {emoji && <span className="mr-1">{emoji}</span>}
          {label}
        </span>
        <Icon className="w-5 h-5 opacity-60" />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function ChangeIndicator({ change, label }: { change: number; label: string }) {
  if (change === 0) return <span className="text-slate-500">{label}: No change vs prev FY</span>
  const up = change > 0
  return (
    <span className={up ? 'text-emerald-400' : 'text-red-400'}>
      {label}: {up ? '↑' : '↓'} {fmt(Math.abs(change))} vs prev FY
    </span>
  )
}

export default function SummaryCards({ summary, previousYearComparison }: SummaryCardsProps) {
  const { totalIncome, totalFixed, totalDaily, totalInvestments, totalGrossSavings, totalSavings } = summary
  const cashColor: StatColor = totalSavings >= 0 ? 'gold' : 'red'

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard emoji="💰" label="Total Income" value={fmt(totalIncome)} icon={TrendingUp} color="green" />
        <StatCard emoji="📄" label="Total Fixed Expenses" value={fmt(totalFixed)} icon={CreditCard} color="red" />
        <StatCard emoji="🛒" label="Total Daily Expenses" value={fmt(totalDaily)} icon={ShoppingCart} color="blue" />
        <StatCard emoji="📈" label="Total Investments" value={fmt(totalInvestments)} icon={PiggyBank} color="purple" />
        <StatCard emoji="💵" label="Gross Savings" value={fmt(totalGrossSavings)} icon={Wallet} color="green" sub="Income − Expenses" />
        <StatCard emoji="🏦" label="Cash Remaining" value={fmt(totalSavings)} icon={Wallet} color={cashColor} sub={`Gross ${fmt(totalGrossSavings)} · Invested ${fmt(totalInvestments)}`} />
      </div>

      {previousYearComparison && (
        <div className="bg-navy-950/50 border border-navy-700/30 rounded-xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <ChangeIndicator change={previousYearComparison.incomeChange} label="Income" />
          <ChangeIndicator change={previousYearComparison.expenseChange} label="Expense" />
          <ChangeIndicator change={previousYearComparison.investmentChange} label="Investments" />
          <ChangeIndicator change={previousYearComparison.savingsChange} label="Cash Remaining" />
        </div>
      )}
    </div>
  )
}

export function FinancialHealthSection({ savingsRate, investmentRate }: { savingsRate: number; investmentRate: number }) {
  let status: string
  let statusColor: string
  let barColor: string

  if (savingsRate > 40) {
    status = 'Excellent'
    statusColor = 'text-emerald-400'
    barColor = 'bg-emerald-500'
  } else if (savingsRate >= 20) {
    status = 'Good'
    statusColor = 'text-gold-400'
    barColor = 'bg-gold-500'
  } else {
    status = 'Needs Attention'
    statusColor = 'text-red-400'
    barColor = 'bg-red-500'
  }

  const displayRate = Math.max(0, Math.min(savingsRate, 100))

  return (
    <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5 space-y-4">
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-300">Financial Health — Gross Savings Rate</p>
          <p className={`text-sm font-semibold ${statusColor}`}>
            {status} · {savingsRate.toFixed(1)}%
          </p>
        </div>
        <div className="w-full bg-navy-800 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${displayRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Needs Attention (&lt;20%)</span>
          <span>Good (20–40%)</span>
          <span>Excellent (&gt;40%)</span>
        </div>
      </div>
      <div className="pt-3 border-t border-navy-700/30 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-300">Investment Rate</p>
        <p className="text-sm font-semibold text-purple-400">{investmentRate.toFixed(1)}% of income invested</p>
      </div>
    </div>
  )
}
