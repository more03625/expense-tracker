import type { FinanceData, MonthData, AnnualSummary, MonthlyBreakdown } from '../types/finance'
import { getMonthKeysForFY, getMonthShortLabel, getMonthFullLabel } from './financeYear'

const EMPTY_MONTH: MonthData = { members: [], fixedExpenses: [], dailyExpenses: [] }

export function getMonthData(data: FinanceData, key: string): MonthData {
  return data[key] || EMPTY_MONTH
}

function sumIncome(md: MonthData): number {
  return md.members.reduce((s, m) => s + Number(m.salary), 0)
}

function sumFixed(md: MonthData): number {
  return md.fixedExpenses.reduce((s, e) => s + Number(e.amount), 0)
}

function sumDaily(md: MonthData): number {
  return md.dailyExpenses.reduce((s, e) => s + Number(e.amount), 0)
}

export function aggregateFinancialYear(data: FinanceData, fyStartYear: number): AnnualSummary {
  const monthKeys = getMonthKeysForFY(fyStartYear)
  const monthlyBreakdown: MonthlyBreakdown[] = monthKeys.map(monthKey => {
    const md = getMonthData(data, monthKey)
    const income = sumIncome(md)
    const fixedExpense = sumFixed(md)
    const dailyExpense = sumDaily(md)
    const totalExpense = fixedExpense + dailyExpense
    const savings = income - totalExpense
    const savingsPercent = income > 0 ? (savings / income) * 100 : 0

    return {
      monthKey,
      monthLabel: getMonthFullLabel(monthKey),
      monthShort: getMonthShortLabel(monthKey),
      income,
      fixedExpense,
      dailyExpense,
      totalExpense,
      savings,
      savingsPercent,
    }
  })

  const totalIncome = monthlyBreakdown.reduce((s, m) => s + m.income, 0)
  const totalFixed = monthlyBreakdown.reduce((s, m) => s + m.fixedExpense, 0)
  const totalDaily = monthlyBreakdown.reduce((s, m) => s + m.dailyExpense, 0)
  const totalExpense = totalFixed + totalDaily
  const totalSavings = totalIncome - totalExpense
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0
  const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0

  const categoryMap: Record<string, number> = {}
  let hasCategories = false
  for (const monthKey of monthKeys) {
    for (const exp of getMonthData(data, monthKey).dailyExpenses) {
      if (exp.category) {
        hasCategories = true
        categoryMap[exp.category] = (categoryMap[exp.category] || 0) + Number(exp.amount)
      }
    }
  }
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const monthsWithData = monthlyBreakdown.filter(m => m.income > 0 || m.totalExpense > 0)
  const highestSavingsMonth = monthsWithData.length
    ? monthsWithData.reduce((best, m) => (m.savings > best.savings ? m : best))
    : null
  const lowestSavingsMonth = monthsWithData.length
    ? monthsWithData.reduce((worst, m) => (m.savings < worst.savings ? m : worst))
    : null
  const averageMonthlySavings = monthsWithData.length
    ? monthsWithData.reduce((s, m) => s + m.savings, 0) / monthsWithData.length
    : 0

  return {
    totalIncome,
    totalFixed,
    totalDaily,
    totalExpense,
    totalSavings,
    savingsRate,
    expenseRatio,
    monthlyBreakdown,
    categoryBreakdown,
    hasCategories: hasCategories && categoryBreakdown.length > 0,
    highestSavingsMonth,
    lowestSavingsMonth,
    averageMonthlySavings,
  }
}

export function loadFinanceDataFromStorage(): FinanceData {
  try {
    const raw = localStorage.getItem('financeData')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export interface YoYComparison {
  incomeChange: number
  expenseChange: number
  savingsChange: number
  prevIncome: number
  prevExpense: number
  prevSavings: number
}

export function compareWithPreviousFY(
  data: FinanceData,
  currentFYStart: number,
): YoYComparison | null {
  const current = aggregateFinancialYear(data, currentFYStart)
  const prev = aggregateFinancialYear(data, currentFYStart - 1)
  if (prev.totalIncome === 0 && prev.totalExpense === 0) return null

  return {
    incomeChange: current.totalIncome - prev.totalIncome,
    expenseChange: current.totalExpense - prev.totalExpense,
    savingsChange: current.totalSavings - prev.totalSavings,
    prevIncome: prev.totalIncome,
    prevExpense: prev.totalExpense,
    prevSavings: prev.totalSavings,
  }
}

export function generateInsights(summary: AnnualSummary): string[] {
  const insights: string[] = []
  const { monthlyBreakdown, savingsRate, totalIncome } = summary

  const withIncome = monthlyBreakdown.filter(m => m.income > 0)
  if (withIncome.length > 0) {
    const highest = withIncome.reduce((a, b) => (a.income > b.income ? a : b))
    insights.push(`Highest income was recorded in ${highest.monthLabel.split(' ')[0]}.`)
  }

  const withExpense = monthlyBreakdown.filter(m => m.totalExpense > 0)
  if (withExpense.length > 0) {
    const highest = withExpense.reduce((a, b) => (a.totalExpense > b.totalExpense ? a : b))
    insights.push(`Expenses were highest in ${highest.monthLabel.split(' ')[0]}.`)
  }

  if (summary.highestSavingsMonth) {
    insights.push(`Best savings month was ${summary.highestSavingsMonth.monthLabel.split(' ')[0]} (${fmtShort(summary.highestSavingsMonth.savings)}).`)
  }

  if (summary.lowestSavingsMonth && summary.lowestSavingsMonth.savings < summary.highestSavingsMonth!.savings) {
    insights.push(`Lowest savings month was ${summary.lowestSavingsMonth.monthLabel.split(' ')[0]} (${fmtShort(summary.lowestSavingsMonth.savings)}).`)
  }

  if (totalIncome > 0) {
    insights.push(`Average monthly savings rate is ${savingsRate.toFixed(1)}%.`)
  }

  const fixedShare = summary.totalExpense > 0
    ? ((summary.totalFixed / summary.totalExpense) * 100).toFixed(0)
    : '0'
  insights.push(`Fixed expenses account for ${fixedShare}% of total spending.`)

  const monthsInDeficit = monthlyBreakdown.filter(m => m.savings < 0).length
  if (monthsInDeficit > 0) {
    insights.push(`${monthsInDeficit} month${monthsInDeficit !== 1 ? 's' : ''} ended with expenses exceeding income.`)
  } else if (withExpense.length > 0) {
    insights.push('Every month with recorded expenses stayed within income.')
  }

  return insights.slice(0, 6)
}

function fmtShort(n: number): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN')
}
