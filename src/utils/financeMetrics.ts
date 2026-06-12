import type { MonthData } from '../types/finance'

export const INVESTMENT_TYPES = [
  'Mutual Fund',
  'Stocks',
  'FD',
  'PPF',
  'NPS',
  'Gold',
  'Crypto',
  'Other',
] as const

export type InvestmentType = (typeof INVESTMENT_TYPES)[number]

export interface MonthMetrics {
  income: number
  fixed: number
  daily: number
  totalExpense: number
  grossSavings: number
  totalInvestments: number
  cashRemaining: number
  expenseRatio: number
  investmentRatio: number
  grossSavingsRate: number
}

export function computeMonthMetrics(md: MonthData): MonthMetrics {
  const income = md.members.reduce((s, m) => s + Number(m.salary), 0)
  const fixed = md.fixedExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const daily = md.dailyExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalExpense = fixed + daily
  const grossSavings = income - totalExpense
  const totalInvestments = (md.investments || []).reduce((s, i) => s + Number(i.amount), 0)
  const cashRemaining = grossSavings - totalInvestments

  return {
    income,
    fixed,
    daily,
    totalExpense,
    grossSavings,
    totalInvestments,
    cashRemaining,
    expenseRatio: income > 0 ? (totalExpense / income) * 100 : 0,
    investmentRatio: income > 0 ? (totalInvestments / income) * 100 : 0,
    grossSavingsRate: income > 0 ? (grossSavings / income) * 100 : 0,
  }
}
