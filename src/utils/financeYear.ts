import type { MonthKey } from '../types/finance'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Indian FY start year for a given date (April–March). */
export function getFYStartYear(date: Date = new Date()): number {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

export function formatFYLabel(startYear: number): string {
  const endYear = (startYear + 1) % 100
  return `FY ${startYear}-${String(endYear).padStart(2, '0')}`
}

export function parseFYStartYear(fyLabel: string): number {
  const match = fyLabel.match(/(\d{4})/)
  return match ? parseInt(match[1], 10) : getFYStartYear()
}

/** Month keys Apr→Mar for the given FY start year. */
export function getMonthKeysForFY(startYear: number): MonthKey[] {
  const keys: MonthKey[] = []
  for (let i = 0; i < 12; i++) {
    const monthIndex = (3 + i) % 12
    const year = i < 9 ? startYear : startYear + 1
    keys.push(`${year}-${String(monthIndex + 1).padStart(2, '0')}`)
  }
  return keys
}

export function getMonthShortLabel(monthKey: MonthKey): string {
  const [, m] = monthKey.split('-').map(Number)
  return MONTH_SHORT[m - 1]
}

export function getMonthFullLabel(monthKey: MonthKey): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** All FY start years present in data, plus current FY. */
export function getAvailableFYStartYears(dataMonthKeys: string[]): number[] {
  const years = new Set<number>()
  for (const key of dataMonthKeys) {
    const [y, m] = key.split('-').map(Number)
    years.add(m >= 4 ? y : y - 1)
  }
  years.add(getFYStartYear())
  return [...years].sort((a, b) => b - a)
}

export function getPreviousFYStartYear(startYear: number): number {
  return startYear - 1
}

export function getNextFYStartYear(startYear: number): number {
  return startYear + 1
}
