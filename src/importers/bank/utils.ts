import { guessCategory } from '../gpay'
import type { BankTransaction, ParsedBankStatement, DuplicateStatus } from './types'

export { guessCategory }

/**
 * Multi-pass categorization: tries the payee name first, then the VPA/id,
 * then the full description. Returns the first non-"Other" match.
 */
export function categorizeTransaction(payee: string, description: string, vpa?: string): string {
  const fromPayee = guessCategory(payee)
  if (fromPayee !== 'Other') return fromPayee

  if (vpa) {
    const fromVpa = guessCategory(vpa)
    if (fromVpa !== 'Other') return fromVpa
  }

  const fromDesc = guessCategory(description)
  if (fromDesc !== 'Other') return fromDesc

  return 'Other'
}

/**
 * Build a unique fingerprint for a bank transaction.
 * Format: "{bank}|{date}|{amount}|{description}"
 * This is stored on imported expenses so re-imports can be detected.
 */
export function buildImportRef(bank: string, date: string, amount: number, description: string): string {
  return `${bank}|${date}|${amount.toFixed(2)}|${description.trim()}`
}

export interface DuplicateCheckResult {
  status: DuplicateStatus
  matchedId?: string
}

/**
 * Check a bank transaction against existing expenses for duplicates.
 *
 * Returns:
 *   'exact'  — importRef fingerprint match (same bank statement row)
 *   'likely' — date + amount + normalized title match (cross-source)
 *   null     — no match
 */
export function checkDuplicate(
  txn: BankTransaction,
  existingExpenses: { id: string; date: string; amount: number; title: string; importRef?: string }[],
): DuplicateCheckResult {
  // Pass 1: Exact importRef match
  for (const exp of existingExpenses) {
    if (exp.importRef && exp.importRef === txn.importRef) {
      return { status: 'exact', matchedId: exp.id }
    }
  }

  // Pass 2: Fuzzy match on date + amount + normalized title
  const txnTitle = txn.title.toLowerCase().trim()
  for (const exp of existingExpenses) {
    if (
      exp.date === txn.date &&
      Math.abs(exp.amount - txn.amount) < 0.01 &&
      exp.title.toLowerCase().trim() === txnTitle
    ) {
      return { status: 'likely', matchedId: exp.id }
    }
  }

  return { status: null }
}

/**
 * Parse DD/MM/YY -> YYYY-MM-DD
 * Assumes 2000s for 2-digit years (e.g. 24 -> 2024)
 */
export function parseDateDDMMYY(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (!m) return null
  const day = m[1]
  const month = m[2]
  const year = `20${m[3]}`
  if (!isValidDate(year, month, day)) return null
  return `${year}-${month}-${day}`
}

/**
 * Parse DD/MM/YYYY -> YYYY-MM-DD
 */
export function parseDateDDMMYYYY(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const day = m[1]
  const month = m[2]
  const year = m[3]
  if (!isValidDate(year, month, day)) return null
  return `${year}-${month}-${day}`
}

/**
 * Parse DD-MM-YYYY or DD-MM-YYYY HH:MM:SS -> YYYY-MM-DD
 */
export function parseDateDDdashMMdashYYYY(raw: string): string | null {
  const m = raw.trim().match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (!m) return null
  const day = m[1]
  const month = m[2]
  const year = m[3]
  if (!isValidDate(year, month, day)) return null
  return `${year}-${month}-${day}`
}

function isValidDate(year: string, month: string, day: string): boolean {
  const y = parseInt(year, 10)
  const mo = parseInt(month, 10)
  const d = parseInt(day, 10)
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return false
  return true
}

/**
 * Parse a numeric string that may contain commas and quotes.
 * e.g. "1,000.00" -> 1000, "95,000.00" -> 95000, "120.00" -> 120
 */
export function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (!raw || typeof raw !== 'string') return 0
  const cleaned = raw.replace(/[",\s]/g, '').trim()
  if (!cleaned) return 0
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Detect payment method from a narration/description string.
 */
export function detectPaymentMethod(narration: string): string {
  const upper = narration.toUpperCase().trim()
  if (upper.startsWith('UPI') || upper.startsWith('UPI/') || upper.startsWith('UPI-')) return 'UPI'
  if (upper.startsWith('IMPS') || upper.startsWith('IMPS-') || upper.startsWith('IMPS/')) return 'IMPS'
  if (upper.startsWith('NEFT') || upper.startsWith('NEFT-') || upper.startsWith('NEFT/')) return 'NEFT'
  if (upper.startsWith('RTGS') || upper.startsWith('RTGS-')) return 'RTGS'
  if (upper.startsWith('ATD-') || upper.includes('ATM')) return 'ATM'
  if (upper.startsWith('CMS/')) return 'Bank Transfer'
  return 'Bank Transfer'
}

/**
 * Extract a human-readable payee name from HDFC narration.
 * Formats:
 *   UPI-PAYEENAME-VPA-BANK-REF-UPI
 *   IMPS-REF-NAME-BANK-ACCTMASK-PURPOSE
 *   NEFT-REF-NAME-BANK-ACCT-PURPOSE
 *   BAJAJFINOTP_... / other formats -> use full narration
 */
export function extractPayeeFromHDFC(narration: string): string {
  const trimmed = narration.trim()

  if (trimmed.toUpperCase().startsWith('UPI-')) {
    const parts = trimmed.split('-')
    if (parts.length >= 3) return cleanPayeeName(parts[1])
  }

  if (trimmed.toUpperCase().startsWith('IMPS-')) {
    const parts = trimmed.split('-')
    if (parts.length >= 4) return cleanPayeeName(parts[2])
  }

  if (trimmed.toUpperCase().startsWith('NEFT-')) {
    const parts = trimmed.split('-')
    if (parts.length >= 4) return cleanPayeeName(parts[2])
  }

  // For other narrations (BAJAJFINOTP_, etc.), return a cleaned version
  return cleanPayeeName(trimmed.split('/')[0].split('_')[0])
}

/**
 * Extract a human-readable payee name from Kotak description.
 * Formats:
 *   UPI/PAYEENAME/REF/PURPOSE  -> take PAYEENAME
 *   Int.Pd:...                  -> Interest Paid
 *   Chrg - ...                  -> Bank Charge
 *   CHRG:SMS ALERT FEE...      -> SMS Alert Fee
 */
export function extractPayeeFromKotak(description: string): string {
  const trimmed = description.trim()

  if (trimmed.toUpperCase().startsWith('UPI/')) {
    const parts = trimmed.split('/')
    if (parts.length >= 2) return cleanPayeeName(parts[1])
  }

  if (trimmed.toLowerCase().startsWith('int.pd')) return 'Interest Paid'
  if (trimmed.toLowerCase().startsWith('chrg')) return 'Bank Charge'

  return cleanPayeeName(trimmed)
}

/**
 * Extract payee info from ICICI transaction remarks.
 * Returns { payee, vpa } so categorization can try both.
 *
 * ICICI UPI format: UPI/VPA/PURPOSE_OR_NAME/BANK/REF/HASH
 *   - parts[1] = VPA (e.g. "q156977574@ybl", "bajajfinanceiep", "paytmqr28100505")
 *   - parts[2] = Purpose or payee name (often just "UPI" which is useless)
 *   - parts[3] = Bank name (e.g. "YES BANK LIMITE", "ICICI Bank LTD")
 */
export function extractPayeeFromICICI(remarks: string): string {
  const { payee } = extractICICIPayeeInfo(remarks)
  return payee
}

export function extractICICIPayeeInfo(remarks: string): { payee: string; vpa: string } {
  const trimmed = remarks.trim()

  if (trimmed.toUpperCase().startsWith('UPI/')) {
    const parts = trimmed.split('/')
    if (parts.length >= 3) {
      const rawVpa = parts[1]
      const purpose = parts[2]

      // Clean the VPA for display: strip @bank suffix
      const atIdx = rawVpa.indexOf('@')
      const vpaName = atIdx > 0 ? rawVpa.substring(0, atIdx) : rawVpa

      // If purpose is meaningful (not "UPI", not a bank code pattern), use it
      if (purpose && purpose.toLowerCase() !== 'upi' && !purpose.match(/^[A-Z]{4}\d/)) {
        return { payee: cleanPayeeName(purpose), vpa: vpaName }
      }

      // Otherwise use the VPA as payee
      return { payee: cleanVPA(rawVpa), vpa: vpaName }
    }
  }

  if (trimmed.toUpperCase().startsWith('CMS/')) {
    const parts = trimmed.split('/')
    if (parts.length >= 3) return { payee: cleanPayeeName(parts[2]), vpa: '' }
    return { payee: 'CMS Payment', vpa: '' }
  }

  if (trimmed.toUpperCase().startsWith('NEFT-')) {
    const parts = trimmed.split('-')
    if (parts.length >= 4) return { payee: cleanPayeeName(parts[2]), vpa: '' }
  }

  if (trimmed.toUpperCase().startsWith('ATD-')) return { payee: 'ATM Withdrawal', vpa: '' }

  return { payee: cleanPayeeName(trimmed.split('/')[0]), vpa: '' }
}

/**
 * Try to extract a readable name from a UPI VPA like "payeename@bank"
 */
function cleanVPA(vpa: string): string {
  const atIdx = vpa.indexOf('@')
  const name = atIdx > 0 ? vpa.substring(0, atIdx) : vpa
  // Remove common prefixes like paytmqr, numbers
  if (name.match(/^paytmqr/i)) return 'Paytm Merchant'
  if (name.match(/^\d{10}$/)) return `Phone: ${name}`
  return cleanPayeeName(name)
}

function cleanPayeeName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/^(Mr|Mrs|Ms|Master|MR|MRS|MS)\s+/i, '')
    .trim() || 'Unknown'
}

export function str(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export function buildSummary(bankName: string, transactions: BankTransaction[]): ParsedBankStatement {
  const paid = transactions.filter(t => t.type === 'paid')
  const received = transactions.filter(t => t.type === 'received')
  const dates = transactions.map(t => t.date).sort()

  return {
    bankName,
    transactions,
    summary: {
      totalTransactions: transactions.length,
      paidCount: paid.length,
      receivedCount: received.length,
      totalPaid: paid.reduce((s, t) => s + t.amount, 0),
      totalReceived: received.reduce((s, t) => s + t.amount, 0),
      dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
    },
  }
}
