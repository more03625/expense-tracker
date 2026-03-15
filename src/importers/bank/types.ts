export interface BankTransaction {
  date: string
  title: string
  description: string
  amount: number
  type: 'paid' | 'received'
  paymentMethod: string
  category: string
  refNumber: string
  bank: string
  importRef: string
}

export type DuplicateStatus = 'exact' | 'likely' | null

export interface ParsedBankStatement {
  bankName: string
  transactions: BankTransaction[]
  summary: {
    totalTransactions: number
    paidCount: number
    receivedCount: number
    totalPaid: number
    totalReceived: number
    dateRange: { from: string; to: string } | null
  }
}

export interface BankParser {
  bankName: string
  detect(rows: unknown[][]): boolean
  parse(rows: unknown[][]): BankTransaction[]
}
