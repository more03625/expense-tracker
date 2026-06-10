import { useRef } from 'react'
import { BarChart3, Download } from 'lucide-react'
import { useAnnualFinanceData } from '../hooks/useAnnualFinanceData'
import { formatFYLabel } from '../utils/financeYear'
import FinancialYearSelector from '../components/annual-dashboard/FinancialYearSelector'
import SummaryCards, { FinancialHealthSection } from '../components/annual-dashboard/SummaryCards'
import MonthlyOverviewChart from '../components/annual-dashboard/MonthlyOverviewChart'
import IncomeExpenseTrend from '../components/annual-dashboard/IncomeExpenseTrend'
import SavingsAnalysis from '../components/annual-dashboard/SavingsAnalysis'
import CategoryBreakdownChart from '../components/annual-dashboard/CategoryBreakdownChart'
import FinancialBreakdownTable from '../components/annual-dashboard/FinancialBreakdownTable'
import InsightsPanel from '../components/annual-dashboard/InsightsPanel'
import type { CategoryInfo, FinanceData } from '../types/finance'

interface AnnualDashboardProps {
  categories: CategoryInfo[]
  financeData: FinanceData
}

export default function AnnualDashboard({ categories, financeData }: AnnualDashboardProps) {
  const reportRef = useRef<HTMLDivElement>(null)
  const {
    fyStartYear,
    setFyStartYear,
    availableFYs,
    summary,
    previousYearComparison,
    insights,
    goToPreviousFY,
    goToNextFY,
    canGoNext,
    canGoPrevious,
  } = useAnnualFinanceData(financeData)

  function handleExportPDF() {
    window.print()
  }

  return (
    <div className="space-y-6 annual-dashboard-report" ref={reportRef}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-gold-400" />
            Annual Dashboard
          </h2>
          <p className="text-sm text-slate-400">{formatFYLabel(fyStartYear)} Overview</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FinancialYearSelector
            fyStartYear={fyStartYear}
            availableFYs={availableFYs}
            onChange={setFyStartYear}
            onPrevious={goToPreviousFY}
            onNext={goToNextFY}
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
          />
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-gold-500/20 hover:bg-gold-500/30 text-gold-400 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="print:block hidden mb-4">
        <h1 className="text-2xl font-bold text-black">Annual Financial Report — {formatFYLabel(fyStartYear)}</h1>
      </div>

      <SummaryCards summary={summary} previousYearComparison={previousYearComparison} />
      <FinancialHealthSection savingsRate={summary.savingsRate} />

      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlyOverviewChart monthlyBreakdown={summary.monthlyBreakdown} />
        <IncomeExpenseTrend monthlyBreakdown={summary.monthlyBreakdown} />
      </div>

      <SavingsAnalysis summary={summary} />

      {summary.hasCategories && (
        <CategoryBreakdownChart
          categoryBreakdown={summary.categoryBreakdown}
          categories={categories}
        />
      )}

      <FinancialBreakdownTable monthlyBreakdown={summary.monthlyBreakdown} />
      <InsightsPanel insights={insights} />
    </div>
  )
}
