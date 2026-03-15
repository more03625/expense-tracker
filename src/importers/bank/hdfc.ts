import type { BankParser, BankTransaction } from './types'
import {
  str, parseAmount, parseDateDDMMYY, detectPaymentMethod,
  extractPayeeFromHDFC, categorizeTransaction, buildImportRef,
} from './utils'

const HEADER_ROW_MARKER = 'Date'
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{2}$/

function isValidRow(row: unknown[]): boolean {
  const dateCell = str(row[0])
  if (!DATE_PATTERN.test(dateCell)) return false
  const withdrawal = parseAmount(row[4])
  const deposit = parseAmount(row[5])
  return withdrawal > 0 || deposit > 0
}

function findDataStartRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const firstCell = str(rows[i][0]).trim()
    if (firstCell === HEADER_ROW_MARKER) {
      // Data starts 2 rows after the header (skip separator row of asterisks)
      return i + 2
    }
  }
  return -1
}

export const hdfcParser: BankParser = {
  bankName: 'HDFC',

  detect(rows: unknown[][]): boolean {
    if (!rows || rows.length < 5) return false
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const cell = str(rows[i][0]).toUpperCase()
      if (cell.includes('HDFC BANK')) return true
    }
    return false
  },

  parse(rows: unknown[][]): BankTransaction[] {
    const startRow = findDataStartRow(rows)
    if (startRow < 0) return []

    const transactions: BankTransaction[] = []

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !isValidRow(row)) continue

      const dateStr = parseDateDDMMYY(str(row[0]))
      if (!dateStr) continue

      const narration = str(row[1])
      const withdrawal = parseAmount(row[4])
      const deposit = parseAmount(row[5])

      const isPaid = withdrawal > 0
      const amount = isPaid ? withdrawal : deposit
      const payee = extractPayeeFromHDFC(narration)

      transactions.push({
        date: dateStr,
        title: payee,
        description: narration,
        amount,
        type: isPaid ? 'paid' : 'received',
        paymentMethod: detectPaymentMethod(narration),
        category: categorizeTransaction(payee, narration),
        refNumber: str(row[2]),
        bank: 'HDFC',
        importRef: buildImportRef('HDFC', dateStr, amount, narration),
      })
    }

    return transactions
  },
}
