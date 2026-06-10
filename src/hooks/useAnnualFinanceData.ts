import { useMemo, useState } from 'react'
import type { FinanceData, AnnualSummary } from '../types/finance'
import type { YoYComparison } from '../utils/financeAggregation'
import {
  aggregateFinancialYear,
  compareWithPreviousFY,
  generateInsights,
} from '../utils/financeAggregation'
import { getAvailableFYStartYears, getFYStartYear, formatFYLabel } from '../utils/financeYear'

export interface UseAnnualFinanceDataResult {
  fyStartYear: number
  setFyStartYear: (year: number) => void
  availableFYs: { startYear: number; label: string }[]
  summary: AnnualSummary
  previousYearComparison: YoYComparison | null
  insights: string[]
  goToPreviousFY: () => void
  goToNextFY: () => void
  canGoNext: boolean
  canGoPrevious: boolean
}

export function useAnnualFinanceData(financeData: FinanceData): UseAnnualFinanceDataResult {
  const availableFYs = useMemo(() => {
    const years = getAvailableFYStartYears(Object.keys(financeData))
    return years.map(startYear => ({ startYear, label: formatFYLabel(startYear) }))
  }, [financeData])

  const [fyStartYear, setFyStartYear] = useState(() => getFYStartYear())

  const summary = useMemo(
    () => aggregateFinancialYear(financeData, fyStartYear),
    [financeData, fyStartYear],
  )

  const previousYearComparison = useMemo(
    () => compareWithPreviousFY(financeData, fyStartYear),
    [financeData, fyStartYear],
  )

  const insights = useMemo(() => generateInsights(summary), [summary])

  const availableStartYears = useMemo(() => availableFYs.map(f => f.startYear), [availableFYs])
  const minYear = availableStartYears.length ? Math.min(...availableStartYears) : fyStartYear
  const maxYear = getFYStartYear()

  const goToPreviousFY = () => setFyStartYear(y => y - 1)
  const goToNextFY = () => setFyStartYear(y => y + 1)

  return {
    fyStartYear,
    setFyStartYear,
    availableFYs,
    summary,
    previousYearComparison,
    insights,
    goToPreviousFY,
    goToNextFY,
    canGoNext: fyStartYear < maxYear,
    canGoPrevious: fyStartYear > minYear,
  }
}
