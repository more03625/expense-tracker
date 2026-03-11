const CATEGORY_RULES = [
  {
    category: 'Food',
    keywords: ['dairy', 'hotel', 'restaurant', 'food', 'stall', 'bakery', 'bekary', 'sweet', 'mithai', 'caterer',
      'fnb', 'chai', 'tea', 'coffee', 'juice', 'snack', 'biryani', 'pizza', 'burger', 'kitchen', 'dhaba',
      'canteen', 'mess', 'tiffin', 'nariyal', 'masala', 'genral store', 'general store', 'kirana', 'grocery',
      'narayan dairy', 'instant retail'],
    exact: ['cg fnb mum rcp ldc', 'laxmi narayan dairy', 'ashabai ambadas nagare', 'ambika genral store',
      'instant retail india limited', 'hkgn hotel', 'sidhakala caterers', 'madhuram mithaiwala'],
  },
  {
    category: 'Transport',
    keywords: ['fuel', 'petrol', 'diesel', 'petroleum', 'bp ', 'service station', 'rapido', 'uber', 'ola',
      'auto', 'cab', 'transport', 'premium fuel'],
    exact: ['millennium premium fuel c', 'the bombay transport co op cons society ltd',
      'joaquim petroleums', 'coco bp mahape', 'siddhivinayak fuel center',
      'sanjiv service station', 'joaquim petroleum'],
  },
  {
    category: 'Bills',
    keywords: ['finance', 'insurance', 'emi', 'loan', 'recharge', 'broadband', 'electricity',
      'water', 'gas', 'bill', 'godaddy', 'domain', 'hosting', 'subscription'],
    exact: ['bajaj finance limited', 'axio', 'godaddy', 'billionbrains garage ventures pvt ltd'],
  },
  {
    category: 'Shopping',
    keywords: ['bazaar', 'mart', 'store', 'shop', 'retail', 'amazon', 'flipkart', 'myntra',
      'star bazaar', 'dmart'],
    exact: ['thpl star bazaar sm39'],
  },
  {
    category: 'Health',
    keywords: ['hospital', 'clinic', 'medical', 'pharmacy', 'pharma', 'doctor', 'health',
      'diagnostic', 'lab', 'pathology', 'dental'],
    exact: [],
  },
  {
    category: 'Entertainment',
    keywords: ['movie', 'cinema', 'theatre', 'game', 'play', 'park', 'bookmyshow'],
    exact: [],
  },
]

export function guessCategory(payeeName) {
  const lower = payeeName.toLowerCase().trim()

  for (const rule of CATEGORY_RULES) {
    for (const ex of rule.exact) {
      if (lower === ex) return rule.category
    }
  }

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) return rule.category
    }
  }

  return 'Other'
}

const MONTH_MAP = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  January: '01', February: '02', March: '03', April: '04',
  June: '06', July: '07', August: '08', September: '09',
  October: '10', November: '11', December: '12',
}

const HEADER_PATTERNS = [
  /^Transaction statement$/i,
  /^\d{10},\s*.+@/,
  /^Note:\s*This statement/i,
  /^received\.\s*Any payments/i,
  /^Page\s+\d+\s+of\s+\d+$/i,
  /^Transaction statement period$/i,
  /^\d{1,2}\s+\w+\s+\d{4}\s*-\s*\d{1,2}\s+\w+\s+\d{4}$/,
  /^Sent$/i,
  /^Received$/i,
  /^Date & time\s+Transaction details\s+Amount$/i,
  /^--\s*\d+\s+of\s+\d+\s*--$/,
]

const DATE_RE = /^(\d{1,2})\s+(\w+),\s+(\d{4})$/
const TIME_RE = /^(\d{1,2}):(\d{2})\s+(AM|PM)$/i
const PAID_TO_RE = /^Paid to\s+(.+)$/i
const RECEIVED_FROM_RE = /^Received from\s+(.+)$/i
const SELF_TRANSFER_RE = /^Self transfer to\s+(.+)$/i
const UPI_ID_RE = /^UPI Transaction ID:\s*(\d+)$/i
const BANK_RE = /^Paid (?:by|to)\s+(.+)$/i
const AMOUNT_RE = /^₹([\d,]+\.?\d*)$/

function isHeaderLine(line) {
  return HEADER_PATTERNS.some(re => re.test(line))
}

function isSummaryAmount(line) {
  return AMOUNT_RE.test(line)
}

function parseDate(dateStr, timeStr) {
  const dm = dateStr.match(DATE_RE)
  if (!dm) return null
  const [, day, monthName, year] = dm
  const month = MONTH_MAP[monthName]
  if (!month) return null

  const isoDate = `${year}-${month}-${day.padStart(2, '0')}`

  let timestamp = new Date(`${isoDate}T00:00:00`).getTime()
  if (timeStr) {
    const tm = timeStr.match(TIME_RE)
    if (tm) {
      let hours = parseInt(tm[1], 10)
      const minutes = parseInt(tm[2], 10)
      const ampm = tm[3].toUpperCase()
      if (ampm === 'PM' && hours !== 12) hours += 12
      if (ampm === 'AM' && hours === 12) hours = 0
      timestamp = new Date(`${isoDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`).getTime()
    }
  }

  return { date: isoDate, createdAt: timestamp }
}

function parseAmount(amountStr) {
  const m = amountStr.match(AMOUNT_RE)
  if (!m) return 0
  return parseFloat(m[1].replace(/,/g, ''))
}

function getTransactionType(line) {
  let m = line.match(PAID_TO_RE)
  if (m) return { type: 'paid', name: m[1].trim() }
  m = line.match(RECEIVED_FROM_RE)
  if (m) return { type: 'received', name: m[1].trim() }
  m = line.match(SELF_TRANSFER_RE)
  if (m) return { type: 'self_transfer', name: m[1].trim() }
  return null
}

export function detectGPay(pages) {
  if (!pages || pages.length === 0) return false
  const firstPage = pages[0].toLowerCase()
  return firstPage.includes('google pay app') ||
    (firstPage.includes('transaction statement') && firstPage.includes('upi transaction id'))
}

export function parseGPay(pages) {
  const allText = pages.join('\n')
  const rawLines = allText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

  const lines = []
  let inHeader = true
  let headerSummaryCount = 0

  for (const line of rawLines) {
    if (isHeaderLine(line)) {
      inHeader = true
      headerSummaryCount = 0
      continue
    }
    if (inHeader && isSummaryAmount(line)) {
      headerSummaryCount++
      if (headerSummaryCount <= 2) continue
    }
    inHeader = false
    lines.push(line)
  }

  const transactions = []
  let i = 0

  while (i < lines.length) {
    const dateMatch = lines[i].match(DATE_RE)
    if (!dateMatch) { i++; continue }

    const dateLine = lines[i]
    i++
    if (i >= lines.length) break

    const timeLine = TIME_RE.test(lines[i]) ? lines[i] : null
    if (timeLine) i++
    if (i >= lines.length) break

    const txnInfo = getTransactionType(lines[i])
    if (!txnInfo) { continue }
    i++

    let upiId = ''
    if (i < lines.length && UPI_ID_RE.test(lines[i])) {
      const m = lines[i].match(UPI_ID_RE)
      upiId = m ? m[1] : ''
      i++
    }

    let bank = ''
    if (i < lines.length && BANK_RE.test(lines[i]) && !DATE_RE.test(lines[i])) {
      const m = lines[i].match(BANK_RE)
      bank = m ? m[1].trim() : ''
      i++
    }

    let amount = 0
    if (i < lines.length && AMOUNT_RE.test(lines[i])) {
      amount = parseAmount(lines[i])
      i++
    }

    const parsed = parseDate(dateLine, timeLine)
    if (!parsed) continue

    const descParts = []
    if (upiId) descParts.push(`UPI Txn: ${upiId}`)
    if (bank) descParts.push(`via ${bank}`)

    transactions.push({
      title: txnInfo.name,
      description: descParts.join(' | '),
      amount,
      date: parsed.date,
      createdAt: parsed.createdAt,
      paymentMethod: 'UPI',
      type: txnInfo.type,
      category: guessCategory(txnInfo.name),
      upiApp: 'Google Pay',
      subItems: [],
    })
  }

  const paid = transactions.filter(t => t.type === 'paid')
  const received = transactions.filter(t => t.type === 'received')
  const selfTransfer = transactions.filter(t => t.type === 'self_transfer')

  const dates = transactions.map(t => t.date).sort()
  const summary = {
    totalTransactions: transactions.length,
    paidCount: paid.length,
    receivedCount: received.length,
    selfTransferCount: selfTransfer.length,
    totalPaid: paid.reduce((s, t) => s + t.amount, 0),
    totalReceived: received.reduce((s, t) => s + t.amount, 0),
    dateRange: dates.length > 0 ? { from: dates[0], to: dates[dates.length - 1] } : null,
  }

  return { transactions, summary }
}
