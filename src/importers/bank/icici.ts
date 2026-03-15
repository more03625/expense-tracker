import type { BankParser, BankTransaction } from './types'
import {
  str, parseAmount, parseDateDDMMYYYY, detectPaymentMethod,
  extractICICIPayeeInfo, categorizeTransaction, buildImportRef,
} from './utils'

const SERIAL_PATTERN = /^\d+$/
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/

/**
 * ICICI columns are shifted by 1 (column 0 is empty).
 * Actual columns (1-indexed):
 *   1: S No.
 *   2: Value Date
 *   3: Transaction Date
 *   4: Cheque Number
 *   5: Transaction Remarks
 *   6: Withdrawal Amount (INR)
 *   7: Deposit Amount (INR)
 *   8: Balance (INR)
 */

function isValidRow(row: unknown[]): boolean {
  const serial = str(row[1])
  if (!SERIAL_PATTERN.test(serial)) return false
  const dateCell = str(row[2])
  if (!DATE_PATTERN.test(dateCell)) return false
  return true
}

function isContinuationRow(row: unknown[]): boolean {
  // Continuation rows have no valid serial number but may have text in the remarks column
  const serial = str(row[1])
  if (SERIAL_PATTERN.test(serial)) return false
  const remarks = str(row[5])
  // If column 5 has text and no other columns have data, it's likely a spill-over
  return remarks.length > 0 && !str(row[2]) && !str(row[6]) && !str(row[7])
}

function findDataStartRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cell = str(rows[i][1]).trim()
    if (cell === 'S No.' || cell === 'S No' || cell === 'Sr No.' || cell === 'Sr.No.') {
      return i + 1
    }
  }
  return -1
}

export const iciciParser: BankParser = {
  bankName: 'ICICI',

  detect(rows: unknown[][]): boolean {
    if (!rows || rows.length < 10) return false
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const rowText = rows[i].map(c => str(c)).join(' ').toUpperCase()
      if (rowText.includes('DETAILED STATEMENT')) return true
    }
    // Also check for ICICI-specific header columns
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const rowText = rows[i].map(c => str(c)).join(' ').toUpperCase()
      if (rowText.includes('TRANSACTION REMARKS') && rowText.includes('WITHDRAWAL AMOUNT')) return true
    }
    return false
  },

  parse(rows: unknown[][]): BankTransaction[] {
    const startRow = findDataStartRow(rows)
    if (startRow < 0) return []

    const transactions: BankTransaction[] = []

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue

      // Handle continuation rows (long remarks that spill over)
      if (isContinuationRow(row) && transactions.length > 0) {
        const lastTxn = transactions[transactions.length - 1]
        lastTxn.description += str(row[5])
        continue
      }

      if (!isValidRow(row)) continue

      const dateStr = parseDateDDMMYYYY(str(row[3])) || parseDateDDMMYYYY(str(row[2]))
      if (!dateStr) continue

      const remarks = str(row[5])
      const withdrawal = parseAmount(row[6])
      const deposit = parseAmount(row[7])

      if (withdrawal <= 0 && deposit <= 0) continue

      const isPaid = withdrawal > 0
      const amount = isPaid ? withdrawal : deposit
      const { payee, vpa } = extractICICIPayeeInfo(remarks)

      transactions.push({
        date: dateStr,
        title: payee,
        description: remarks,
        amount,
        type: isPaid ? 'paid' : 'received',
        paymentMethod: detectPaymentMethod(remarks),
        category: categorizeTransaction(payee, remarks, vpa),
        refNumber: str(row[4]),
        bank: 'ICICI',
        importRef: buildImportRef('ICICI', dateStr, amount, remarks),
      })
    }

    return transactions
  },
}
