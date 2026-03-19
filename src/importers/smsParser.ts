import { guessCategory } from './gpay'

export interface ParsedSMS {
  amount: number
  payee: string
  date: string
  bank: string
  refNumber: string
  paymentMethod: string
  category: string
}

interface SMSPattern {
  bank: string
  test: (sms: string) => boolean
  parse: (sms: string) => ParsedSMS | null
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function parseDate2Digit(dd: string, mm: string, yy: string): string {
  const year = yy.length === 2 ? `20${yy}` : yy
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function parseDateMonth3(dd: string, mon: string, yy: string): string {
  const mm = MONTH_MAP[mon.toLowerCase().slice(0, 3)] || '01'
  const year = yy.length === 2 ? `20${yy}` : yy
  return `${year}-${mm}-${dd.padStart(2, '0')}`
}

function cleanPayee(raw: string): string {
  return raw
    .replace(/@\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Unknown'
}

const patterns: SMSPattern[] = [
  {
    // Kotak: Sent Rs.700.00 from Kotak Bank AC X7781 to shobhakokane03484@oksbi on 18-03-26.UPI Ref 644351511126.
    bank: 'Kotak',
    test: (sms) => /kotak bank/i.test(sms) && /sent rs/i.test(sms),
    parse: (sms) => {
      const amtMatch = sms.match(/Sent Rs\.?([\d,]+\.?\d*)/i)
      const payeeMatch = sms.match(/to\s+(\S+)\s+on/i)
      const dateMatch = sms.match(/on\s+(\d{2})-(\d{2})-(\d{2,4})/i)
      const refMatch = sms.match(/UPI Ref\s+(\d+)/i)

      if (!amtMatch || !dateMatch) return null

      const payeeRaw = payeeMatch?.[1] || 'Unknown'
      const payee = cleanPayee(payeeRaw)

      return {
        amount: parseFloat(amtMatch[1].replace(/,/g, '')),
        payee,
        date: parseDate2Digit(dateMatch[1], dateMatch[2], dateMatch[3]),
        bank: 'Kotak',
        refNumber: refMatch?.[1] || '',
        paymentMethod: 'UPI',
        category: guessCategory(payee),
      }
    },
  },
  {
    // ICICI: ICICI Bank Acct XX209 debited for Rs 1000.00 on 17-Mar-26; SUNNY AUTO CENT credited.
    bank: 'ICICI',
    test: (sms) => /icici bank/i.test(sms) && /debited for rs/i.test(sms),
    parse: (sms) => {
      const amtMatch = sms.match(/debited for Rs\.?\s*([\d,]+\.?\d*)/i)
      const dateMatch = sms.match(/on\s+(\d{1,2})-(\w{3})-(\d{2,4})/i)
      const payeeMatch = sms.match(/;\s*(.+?)\s+credited/i)
      const refMatch = sms.match(/UPI[:\s]*(\d+)/i)

      if (!amtMatch || !dateMatch) return null

      const payee = payeeMatch?.[1]?.trim() || 'Unknown'

      return {
        amount: parseFloat(amtMatch[1].replace(/,/g, '')),
        payee,
        date: parseDateMonth3(dateMatch[1], dateMatch[2], dateMatch[3]),
        bank: 'ICICI',
        refNumber: refMatch?.[1] || '',
        paymentMethod: 'UPI',
        category: guessCategory(payee),
      }
    },
  },
  {
    // SBI: Dear UPI user A/C X7668 debited by 63.00 on date 19Mar26 trf to SHIVVISHAL CHEDI Refno 607878787103
    bank: 'SBI',
    test: (sms) => /SBI/i.test(sms) && /debited by/i.test(sms),
    parse: (sms) => {
      const amtMatch = sms.match(/debited by\s*([\d,]+\.?\d*)/i)
      const dateMatch = sms.match(/on date\s+(\d{1,2})(\w{3})(\d{2,4})/i)
      const payeeMatch = sms.match(/trf to\s+(.+?)\s+Refno/i)
      const refMatch = sms.match(/Refno\s+(\d+)/i)

      if (!amtMatch || !dateMatch) return null

      const payee = payeeMatch?.[1]?.trim() || 'Unknown'

      return {
        amount: parseFloat(amtMatch[1].replace(/,/g, '')),
        payee,
        date: parseDateMonth3(dateMatch[1], dateMatch[2], dateMatch[3]),
        bank: 'SBI',
        refNumber: refMatch?.[1] || '',
        paymentMethod: 'UPI',
        category: guessCategory(payee),
      }
    },
  },
  {
    // HDFC: generic pattern — Rs.XXX debited from HDFC Bank A/c ...
    bank: 'HDFC',
    test: (sms) => /hdfc bank/i.test(sms) && /debited/i.test(sms),
    parse: (sms) => {
      const amtMatch = sms.match(/Rs\.?\s*([\d,]+\.?\d*)\s*debited/i)
        || sms.match(/debited.*?Rs\.?\s*([\d,]+\.?\d*)/i)
      const dateMatch = sms.match(/on\s+(\d{1,2})-(\d{2})-(\d{2,4})/i)
        || sms.match(/on\s+(\d{1,2})(\w{3})(\d{2,4})/i)
      const payeeMatch = sms.match(/(?:to|for)\s+(.+?)(?:\s+on|\s+Ref|\.|$)/i)

      if (!amtMatch) return null

      const payee = payeeMatch?.[1]?.trim() || 'Unknown'
      let date = new Date().toISOString().slice(0, 10)
      if (dateMatch) {
        date = /[a-z]/i.test(dateMatch[2])
          ? parseDateMonth3(dateMatch[1], dateMatch[2], dateMatch[3])
          : parseDate2Digit(dateMatch[1], dateMatch[2], dateMatch[3])
      }

      return {
        amount: parseFloat(amtMatch[1].replace(/,/g, '')),
        payee,
        date,
        bank: 'HDFC',
        refNumber: '',
        paymentMethod: 'UPI',
        category: guessCategory(payee),
      }
    },
  },
]

export function parseSMS(sms: string): ParsedSMS | null {
  const trimmed = sms.trim()
  if (!trimmed) return null

  for (const pattern of patterns) {
    if (pattern.test(trimmed)) {
      return pattern.parse(trimmed)
    }
  }

  // Generic fallback: try to extract amount and payee from any debit SMS
  const amtMatch = trimmed.match(/Rs\.?\s*([\d,]+\.?\d*)/i)
    || trimmed.match(/debited.*?([\d,]+\.?\d{2})/i)
  if (amtMatch) {
    const amount = parseFloat(amtMatch[1].replace(/,/g, ''))
    if (amount > 0) {
      return {
        amount,
        payee: 'Unknown',
        date: new Date().toISOString().slice(0, 10),
        bank: 'Unknown',
        refNumber: '',
        paymentMethod: 'UPI',
        category: 'Other',
      }
    }
  }

  return null
}
