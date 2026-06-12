import { useState } from 'react'
import { Plus, Trash2, Edit3, PiggyBank, X } from 'lucide-react'
import type { Investment } from '../types/finance'
import { INVESTMENT_TYPES } from '../utils/financeMetrics'

function fmt(n: number) {
  return '₹' + Number(n || 0).toLocaleString('en-IN')
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

interface InvestmentsSectionProps {
  investments: Investment[]
  onUpdate: (investments: Investment[]) => void
  toast: (message: string, type?: string) => void
}

export default function InvestmentsSection({ investments, onUpdate, toast }: InvestmentsSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    amount: '',
    type: INVESTMENT_TYPES[0],
    platform: '',
    note: '',
  })

  const total = investments.reduce((s, i) => s + Number(i.amount), 0)

  function resetForm() {
    setShowForm(false)
    setEditId(null)
    setForm({ name: '', amount: '', type: INVESTMENT_TYPES[0], platform: '', note: '' })
  }

  function startEdit(item: Investment) {
    setEditId(item.id)
    setForm({
      name: item.name,
      amount: String(item.amount),
      type: item.type,
      platform: item.platform || '',
      note: item.note || '',
    })
    setShowForm(true)
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    if (!form.name.trim() || !form.amount) return toast('Please fill name and amount', 'error')
    const entry: Investment = {
      id: editId || genId(),
      name: form.name.trim(),
      amount: Number(form.amount),
      type: form.type,
      ...(form.platform.trim() ? { platform: form.platform.trim() } : {}),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    }
    if (editId) {
      onUpdate(investments.map(i => (i.id === editId ? entry : i)))
      toast('Investment updated')
    } else {
      onUpdate([...investments, entry])
      toast('Investment added')
    }
    resetForm()
  }

  function handleDelete() {
    if (confirmDelete) {
      onUpdate(investments.filter(i => i.id !== confirmDelete))
      toast('Investment deleted')
      setConfirmDelete(null)
    }
  }

  return (
    <div className="space-y-4">
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-navy-900 border border-navy-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-2">Delete Investment</h3>
            <p className="text-slate-400 mb-6">Are you sure you want to delete this investment entry?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-gold-400" /> Investments
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Total Invested: <span className="text-purple-400 font-semibold">{fmt(total)}</span>
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-400 text-navy-950 rounded-xl font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Investment
        </button>
      </div>

      <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-200/90">
        Log MF SIPs, stock purchases, and other monthly investments here — not under Daily Expenses.
      </div>

      {investments.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-500">
          <PiggyBank className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No investments logged this month. Add your SIPs and allocations.</p>
        </div>
      )}

      <div className="space-y-2">
        {investments.map(item => (
          <div key={item.id} className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-white">{item.name}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-medium">{item.type}</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {[item.platform, item.note].filter(Boolean).join(' · ') || 'Monthly allocation'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-semibold text-purple-400">{fmt(item.amount)}</span>
              <button onClick={() => startEdit(item)} className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setConfirmDelete(item.id)} className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-navy-900 border border-navy-700/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">{editId ? 'Edit Investment' : 'Add Investment'}</h3>
              <button onClick={resetForm} className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Name</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Parag Parikh Flexi Cap SIP" className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50 text-sm" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Amount (₹)</label>
                  <input required type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold-500/50 text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as typeof form.type }))} className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold-500/50 text-sm">
                    {INVESTMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Platform (optional)</label>
                <input value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} placeholder="Groww, Zerodha, HDFC..." className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50 text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Note (optional)</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="SIP, lump sum, etc." className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50 text-sm" />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold">{editId ? 'Update' : 'Add Investment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
