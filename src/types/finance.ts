export type MonthKey = string

export interface Member {
  id: string
  name: string
  salary: number
}

export interface FixedExpense {
  id: string
  name: string
  amount: number
  dueDate: number
  description: string
  subItems: { id: string; name: string; amount: number }[]
  paid: boolean
}

export interface DailyExpense {
  id: string
  title: string
  description: string
  amount: number
  category: string
  date: string
  paymentMethod: string
  bank?: string
  subItems: { id: string; name: string; amount: number }[]
  importRef?: string
}

export type InvestmentType =
  | 'Mutual Fund'
  | 'Stocks'
  | 'FD'
  | 'PPF'
  | 'NPS'
  | 'Gold'
  | 'Crypto'
  | 'Other'

export interface Investment {
  id: string
  name: string
  amount: number
  type: InvestmentType
  platform?: string
  note?: string
}

export interface MonthData {
  members: Member[]
  fixedExpenses: FixedExpense[]
  dailyExpenses: DailyExpense[]
  investments: Investment[]
}

export type FinanceData = Record<MonthKey, MonthData>

export interface MonthlyBreakdown {
  monthKey: MonthKey
  monthLabel: string
  monthShort: string
  income: number
  fixedExpense: number
  fixedExpensePercent: number
  dailyExpense: number
  dailyExpensePercent: number
  totalExpense: number
  totalExpensePercent: number
  investment: number
  grossSavings: number
  grossSavingsPercent: number
  savings: number
  savingsPercent: number
  investmentPercent: number
}

export interface AnnualSummary {
  totalIncome: number
  totalFixed: number
  totalDaily: number
  totalExpense: number
  totalInvestments: number
  totalGrossSavings: number
  totalSavings: number
  savingsRate: number
  investmentRate: number
  expenseRatio: number
  monthlyBreakdown: MonthlyBreakdown[]
  categoryBreakdown: { name: string; value: number }[]
  hasCategories: boolean
  highestSavingsMonth: MonthlyBreakdown | null
  lowestSavingsMonth: MonthlyBreakdown | null
  averageMonthlySavings: number
}

export interface CategoryInfo {
  id: string
  name: string
  color: string
}
