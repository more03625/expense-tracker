import { useState, useRef, useEffect } from 'react'
import { FileText, AlertTriangle, Check, X, ChevronDown, Smartphone, Loader2 } from 'lucide-react'
import { extractTextFromPDF } from '../importers/pdfUtils'
import { detectUPIApp, getRegisteredApps, getAppById } from '../importers/registry'

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN') }
function dayLabel(d) { return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }

export default function UPIImportModal({ onImport, toast, categories, onAddCategory, CategorySelect, AddCategoryModal }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [detectedApp, setDetectedApp] = useState(null)
  const [manualAppId, setManualAppId] = useState('')
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState(null)
  const [selected, setSelected] = useState({})
  const [defaultCategory, setDefaultCategory] = useState('Other')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const fileInputRef = useRef(null)

  const registeredApps = getRegisteredApps()
  const activeApp = detectedApp || (manualAppId ? getAppById(manualAppId) : null)

  function reset() {
    setFile(null)
    setLoading(false)
    setError('')
    setDetectedApp(null)
    setManualAppId('')
    setTransactions([])
    setSummary(null)
    setSelected({})
    setDefaultCategory('Other')
  }

  useEffect(() => { reset() }, [])

  async function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file')
      return
    }

    setFile(f)
    setLoading(true)
    setError('')
    setDetectedApp(null)
    setTransactions([])
    setSummary(null)
    setSelected({})

    try {
      const pages = await extractTextFromPDF(f)
      if (!pages || pages.length === 0) throw new Error('Could not extract text from PDF')

      const app = detectUPIApp(pages)
      if (app) {
        setDetectedApp(app)
        const result = app.parse(pages)
        applyParseResult(result)
      } else {
        setError('Could not auto-detect UPI app. Please select manually.')
      }
    } catch (err) {
      setError('Failed to parse PDF: ' + (err.message || String(err)))
    }
    setLoading(false)
  }

  async function handleManualSelect(appId) {
    setManualAppId(appId)
    if (!file || !appId) return

    setLoading(true)
    setError('')
    try {
      const pages = await extractTextFromPDF(file)
      const app = getAppById(appId)
      if (!app) throw new Error('Unknown app')
      const result = app.parse(pages)
      applyParseResult(result)
    } catch (err) {
      setError('Failed to parse: ' + (err.message || String(err)))
    }
    setLoading(false)
  }

  function applyParseResult(result) {
    setTransactions(result.transactions)
    setSummary(result.summary)
    const sel = {}
    result.transactions.forEach((t, i) => {
      sel[i] = t.type === 'paid'
    })
    setSelected(sel)
  }

  const paidTxns = transactions.filter(t => t.type === 'paid')
  const selectedCount = Object.values(selected).filter(Boolean).length
  const selectedTotal = transactions.reduce((s, t, i) => selected[i] ? s + t.amount : s, 0)

  function toggleAll(checked) {
    const sel = {}
    transactions.forEach((t, i) => { sel[i] = checked && t.type === 'paid' })
    setSelected(sel)
  }

  function handleImport() {
    const toImport = transactions
      .filter((_, i) => selected[i])
      .map(t => ({
        id: genId(),
        title: t.title,
        description: t.description,
        amount: t.amount,
        category: t.category || defaultCategory,
        date: t.date,
        createdAt: t.createdAt,
        paymentMethod: 'UPI',
        subItems: [],
      }))

    if (toImport.length === 0) {
      toast('No transactions selected', 'error')
      return
    }

    const byMonth = {}
    for (const exp of toImport) {
      const mk = exp.date.slice(0, 7)
      if (!byMonth[mk]) byMonth[mk] = []
      byMonth[mk].push(exp)
    }

    onImport(toImport)
    toast(`Imported ${toImport.length} transactions from ${activeApp?.name || 'UPI'}`)
    reset()
  }

  const grouped = {}
  transactions.forEach((t, i) => {
    if (!grouped[t.date]) grouped[t.date] = []
    grouped[t.date].push({ ...t, _idx: i })
  })
  const sortedDates = Object.keys(grouped).sort()

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div>
        <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFile} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()}
          className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-navy-700/50 hover:border-gold-500/40 bg-navy-950/30'}`}>
          {loading ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 text-gold-400 animate-spin" />
              <p className="text-slate-400">Parsing PDF...</p>
            </div>
          ) : file ? (
            <div>
              <FileText className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
              <p className="text-emerald-400 font-medium">{file.name}</p>
              <p className="text-xs text-slate-500 mt-1">Click to change file</p>
            </div>
          ) : (
            <div>
              <Smartphone className="w-8 h-8 mx-auto mb-2 text-slate-500" />
              <p className="text-slate-400 font-medium">Click to upload UPI statement PDF</p>
              <p className="text-xs text-slate-500 mt-1">Supports: Google Pay</p>
            </div>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span>{error}</span>
            {!detectedApp && file && !loading && (
              <div className="mt-2">
                <label className="text-xs text-slate-400 block mb-1">Select UPI app manually:</label>
                <select value={manualAppId} onChange={e => handleManualSelect(e.target.value)}
                  className="bg-navy-950/50 border border-navy-700/50 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-gold-500/50">
                  <option value="">-- Select --</option>
                  {registeredApps.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detection badge */}
      {activeApp && transactions.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>Detected: <strong>{activeApp.name}</strong></span>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400">Expenses</p>
            <p className="text-lg font-bold text-blue-400">{summary.paidCount}</p>
            <p className="text-xs text-slate-500">{fmt(summary.totalPaid)}</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400">Received</p>
            <p className="text-lg font-bold text-emerald-400">{summary.receivedCount}</p>
            <p className="text-xs text-slate-500">{fmt(summary.totalReceived)}</p>
          </div>
          <div className="bg-slate-500/10 border border-slate-500/20 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-400">Self Transfer</p>
            <p className="text-lg font-bold text-slate-400">{summary.selfTransferCount}</p>
          </div>
        </div>
      )}

      {/* Category + controls */}
      {transactions.length > 0 && (
        <div className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-slate-300">Import Settings</p>
          <p className="text-xs text-slate-500">Categories are auto-detected from payee names. The fallback below applies to unrecognized payees.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <CategorySelect label="Fallback Category" categories={categories} value={defaultCategory}
              onChange={val => setDefaultCategory(val)} onAddNew={() => setShowAddCategory(true)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Payment Method</label>
              <div className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-slate-400 text-sm cursor-not-allowed">
                UPI ({activeApp?.name || 'Auto'})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction list */}
      {transactions.length > 0 && (
        <div className="border border-navy-700/30 rounded-xl overflow-hidden">
          <div className="bg-navy-800/50 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs font-medium text-slate-300">Transactions</p>
              <span className="text-xs text-gold-400 font-semibold">{selectedCount} selected &middot; {fmt(selectedTotal)}</span>
            </div>
            <button onClick={() => toggleAll(selectedCount < paidTxns.length)}
              className="text-xs text-gold-400 hover:text-gold-300 font-medium transition-colors">
              {selectedCount >= paidTxns.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-navy-700/20">
            {sortedDates.map(date => (
              <div key={date}>
                <div className="bg-navy-950/40 px-4 py-1.5 sticky top-0">
                  <p className="text-xs font-medium text-slate-500">{dayLabel(date)}</p>
                </div>
                {grouped[date].map(t => {
                  const isSkipped = t.type !== 'paid'
                  const idx = t._idx
                  return (
                    <label key={idx}
                      className={`flex items-center gap-3 px-4 py-2 text-sm transition-colors ${isSkipped ? 'opacity-40 cursor-not-allowed' : 'hover:bg-navy-800/30 cursor-pointer'}`}>
                      <input type="checkbox" checked={!!selected[idx]} disabled={isSkipped}
                        onChange={e => setSelected(s => ({ ...s, [idx]: e.target.checked }))}
                        className="rounded border-navy-600 bg-navy-950/50 text-gold-500 focus:ring-gold-500/30 w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`truncate ${isSkipped ? 'text-slate-500' : 'text-slate-300'}`}>{t.title}</span>
                          {t.type === 'paid' && t.category && t.category !== 'Other' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-500/15 text-gold-400 flex-shrink-0">{t.category}</span>
                          )}
                          {t.type === 'received' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 flex-shrink-0">Received</span>}
                          {t.type === 'self_transfer' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/15 text-slate-400 flex-shrink-0">Self Transfer</span>}
                        </div>
                      </div>
                      <span className={`font-medium flex-shrink-0 ${t.type === 'received' ? 'text-emerald-400' : t.type === 'self_transfer' ? 'text-slate-400' : 'text-red-400'}`}>
                        {t.type === 'received' ? '+' : ''}{fmt(t.amount)}
                      </span>
                    </label>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import button */}
      {transactions.length > 0 && (
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={reset} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors">Clear</button>
          <button onClick={handleImport} disabled={selectedCount === 0}
            className="px-5 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Import {selectedCount} Transaction{selectedCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* No transactions but info */}
      {!file && !loading && (
        <div className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-300 mb-2">How to get your UPI statement</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            <p><span className="text-gold-400 font-medium">Google Pay:</span> Open Google Pay &rarr; Profile &rarr; Download statement &rarr; Select period &rarr; Download PDF</p>
            <p className="text-slate-500 mt-2">More UPI apps coming soon (PhonePe, Paytm, etc.)</p>
          </div>
        </div>
      )}

      <AddCategoryModal open={showAddCategory} onClose={() => setShowAddCategory(false)} onSave={cat => { onAddCategory(cat); setDefaultCategory(cat.name) }} />
    </div>
  )
}
