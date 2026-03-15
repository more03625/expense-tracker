import * as XLSX from 'xlsx'
import type { BankParser, ParsedBankStatement } from './types'
import { buildSummary } from './utils'
import { hdfcParser } from './hdfc'
import { kotakParser } from './kotak'
import { iciciParser } from './icici'

const PARSERS: BankParser[] = [
  hdfcParser,
  kotakParser,
  iciciParser,
]

export function getSupportedBanks(): string[] {
  return PARSERS.map(p => p.bankName)
}

function fileToRows(file: File): Promise<unknown[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        })
        resolve(rows)
      } catch (err) {
        reject(new Error(`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

function detectParser(rows: unknown[][]): BankParser | null {
  for (const parser of PARSERS) {
    if (parser.detect(rows)) return parser
  }
  return null
}

export async function parseBankStatement(file: File): Promise<ParsedBankStatement> {
  const rows = await fileToRows(file)
  if (!rows || rows.length === 0) {
    throw new Error('The uploaded file appears to be empty.')
  }

  const parser = detectParser(rows)
  if (!parser) {
    throw new Error(
      'Could not detect the bank from this file. Currently supported banks: ' +
      getSupportedBanks().join(', ') + '.'
    )
  }

  const transactions = parser.parse(rows)
  if (transactions.length === 0) {
    throw new Error(
      `Detected ${parser.bankName} bank statement, but no valid transactions were found. ` +
      'Please check if the file format matches the expected statement layout.'
    )
  }

  return buildSummary(parser.bankName, transactions)
}
