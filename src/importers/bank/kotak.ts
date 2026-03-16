import type { BankParser, BankTransaction } from './types'
import {
  str, parseAmount, parseDateDDdashMMdashYYYY, detectPaymentMethod,
  extractPayeeFromKotak, categorizeTransaction, buildImportRef,
} from './utils'

const SERIAL_PATTERN = /^\d+$/
const DATE_PATTERN = /^\d{2}-\d{2}-\d{4}/

function isValidRow(row: unknown[]): boolean {
  const serial = str(row[0])
  if (!SERIAL_PATTERN.test(serial)) return false
  const dateCell = str(row[1])
  if (!DATE_PATTERN.test(dateCell)) return false
  return true
}

function findDataStartRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cell = str(rows[i][0]).trim()
    if (cell === 'Sl. No.' || cell === 'Sl No' || cell === 'Sl. No') {
      return i + 1
    }
  }
  return -1
}

export const kotakParser: BankParser = {
  bankName: 'Kotak',

  detect(rows: unknown[][]): boolean {
    if (!rows || rows.length < 15) return false
    let hasAccountStatement = false
    let hasSlNo = false
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const rowText = rows[i].map(c => str(c)).join(' ').toUpperCase()
      if (rowText.includes('ACCOUNT STATEMENT')) hasAccountStatement = true
      if (rowText.includes('SL. NO') || rowText.includes('SL NO')) hasSlNo = true
    }
    return hasAccountStatement && hasSlNo
  },

  extractAccountHolder(rows: unknown[][]): string {
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const rowText = rows[i].map(c => str(c)).join(' ').toUpperCase()
      if (rowText.includes('ACCOUNT STATEMENT')) {
        const nameCell = str(rows[i + 1]?.[0]).trim()
        if (nameCell && /^[A-Za-z\s]+$/.test(nameCell) && nameCell.length > 3) {
          return nameCell
        }
      }
    }
    return ''
  },

  parse(rows: unknown[][]): BankTransaction[] {
    const startRow = findDataStartRow(rows)
    if (startRow < 0) return []

    const transactions: BankTransaction[] = []

    for (let i = startRow; i < rows.length; i++) {
      const row = rows[i]
      if (!row || !isValidRow(row)) continue

      const dateStr = parseDateDDdashMMdashYYYY(str(row[1]))
      if (!dateStr) continue

      const description = str(row[3])
      const amount = parseAmount(row[5])
      if (amount <= 0) continue

      const drCr = str(row[6]).toUpperCase().trim()
      const isPaid = drCr === 'DR'
      const payee = extractPayeeFromKotak(description)

      transactions.push({
        date: dateStr,
        title: payee,
        description,
        amount,
        type: isPaid ? 'paid' : 'received',
        paymentMethod: detectPaymentMethod(description),
        category: categorizeTransaction(payee, description),
        refNumber: str(row[4]),
        bank: 'Kotak',
        importRef: buildImportRef('Kotak', dateStr, amount, description),
        isSelfTransfer: false,
      })
    }

    return transactions
  },
}
