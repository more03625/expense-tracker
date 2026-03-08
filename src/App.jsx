import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Plus, Trash2, Edit3, Check, X, ChevronDown, ChevronRight, Download,
  IndianRupee, Users, Calendar, CreditCard, ShoppingCart, TrendingUp,
  Home, LayoutDashboard, Wallet, Copy, AlertTriangle, ChevronLeft,
  ChevronRight as ChevronRightIcon, Coffee, Car, Heart, Film, Zap,
  MoreHorizontal, Search, Bell, CircleDot, Upload, FileText, FileSpreadsheet
} from 'lucide-react'
import * as XLSX from 'xlsx'

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Health', 'Entertainment', 'Bills', 'Other']
const PAYMENT_METHODS = ['Cash', 'UPI', 'Card']
const CATEGORY_COLORS = {
  Food: '#f59e0b', Transport: '#3b82f6', Shopping: '#ec4899',
  Health: '#10b981', Entertainment: '#8b5cf6', Bills: '#ef4444', Other: '#6b7280'
}
const CATEGORY_ICONS = {
  Food: Coffee, Transport: Car, Shopping: ShoppingCart, Health: Heart,
  Entertainment: Film, Bills: Zap, Other: MoreHorizontal
}
const CHART_COLORS = ['#fbbf24', '#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#ef4444', '#6b7280']

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN') }
function getMonthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function parseMonthKey(k) { const [y, m] = k.split('-'); return new Date(parseInt(y), parseInt(m) - 1) }
function monthLabel(k) { return parseMonthKey(k).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
function dayLabel(d) { return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }



function loadData() {
  try { return JSON.parse(localStorage.getItem('financeData')) || {} } catch { return {} }
}
function saveData(data) { localStorage.setItem('financeData', JSON.stringify(data)) }

function getMonthData(data, key) {
  return data[key] || { members: [], fixedExpenses: [], dailyExpenses: [] }
}

// ── Toast System ──────────────────────────────────────────────────────
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(t => (
        <div key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-sm border animate-toast-in cursor-pointer
            ${t.type === 'success' ? 'bg-emerald-900/80 border-emerald-500/30 text-emerald-100' :
              t.type === 'error' ? 'bg-red-900/80 border-red-500/30 text-red-100' :
              'bg-navy-900/80 border-gold-500/30 text-gold-100'}`}
          onClick={() => removeToast(t.id)}>
          <span className="text-sm font-medium">{t.message}</span>
        </div>
      ))}
    </div>
  )
}

function useToast() {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((message, type = 'success') => {
    const id = genId()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])
  const removeToast = useCallback((id) => setToasts(prev => prev.filter(t => t.id !== id)), [])
  return { toasts, toast, removeToast }
}

// ── Confirm Dialog ────────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-navy-900 border border-navy-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <p className="text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-navy-900 border border-navy-700/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-slide-in max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600 flex items-center justify-center transition-colors"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Input Components ──────────────────────────────────────────────────
function Input({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <input {...props} className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20 transition-all text-sm" />
    </div>
  )
}

function Select({ label, options, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <select {...props} className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20 transition-all text-sm">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color = 'gold', sub }) {
  const colors = {
    gold: 'from-gold-500/20 to-gold-600/5 border-gold-500/20 text-gold-400',
    green: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    red: 'from-red-500/20 to-red-600/5 border-red-500/20 text-red-400',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400',
    purple: 'from-purple-500/20 to-purple-600/5 border-purple-500/20 text-purple-400',
  }
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 animate-slide-up`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-5 h-5 opacity-60" />}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// MEMBERS / INCOME SECTION
// ══════════════════════════════════════════════════════════════════════
function MembersSection({ members, onUpdate, toast }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [name, setName] = useState('')
  const [salary, setSalary] = useState('')

  const totalIncome = members.reduce((s, m) => s + Number(m.salary), 0)

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !salary) return toast('Please fill all fields', 'error')
    if (editId) {
      onUpdate(members.map(m => m.id === editId ? { ...m, name: name.trim(), salary: Number(salary) } : m))
      toast('Member updated')
    } else {
      onUpdate([...members, { id: genId(), name: name.trim(), salary: Number(salary) }])
      toast('Member added')
    }
    resetForm()
  }

  function startEdit(m) { setEditId(m.id); setName(m.name); setSalary(m.salary); setShowForm(true) }
  function resetForm() { setShowForm(false); setEditId(null); setName(''); setSalary('') }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-gold-400" /> Income Members</h2>
          <p className="text-sm text-slate-400 mt-1">Total Household Income: <span className="text-gold-400 font-semibold">{fmt(totalIncome)}</span></p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-400 text-navy-950 rounded-xl font-semibold text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {members.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No income members yet. Add your first member!</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {members.map(m => (
          <div key={m.id} className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4 flex items-center justify-between animate-fade-in group hover:border-gold-500/30 transition-colors">
            <div>
              <p className="font-semibold text-white">{m.name}</p>
              <p className="text-gold-400 font-bold text-lg">{fmt(m.salary)}</p>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(m)} className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600 flex items-center justify-center transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => { onUpdate(members.filter(x => x.id !== m.id)); toast('Member removed') }} className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4 space-y-4 animate-slide-in">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" placeholder="e.g. Rahul" value={name} onChange={e => setName(e.target.value)} />
            <Input label="Monthly Salary (₹)" type="number" placeholder="e.g. 200000" value={salary} onChange={e => setSalary(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold transition-colors">{editId ? 'Update' : 'Add'}</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// FIXED SPENDINGS SECTION
// ══════════════════════════════════════════════════════════════════════
function FixedExpensesSection({ expenses, onUpdate, toast }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [confirmDelete, setConfirmDelete] = useState(null)

  const [form, setForm] = useState({ name: '', amount: '', dueDate: '', description: '', subItems: [] })
  const [subName, setSubName] = useState('')
  const [subAmount, setSubAmount] = useState('')

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const paidTotal = expenses.filter(e => e.paid).reduce((s, e) => s + Number(e.amount), 0)

  function resetForm() {
    setShowForm(false); setEditId(null)
    setForm({ name: '', amount: '', dueDate: '', description: '', subItems: [] })
    setSubName(''); setSubAmount('')
  }

  function startEdit(e) {
    setEditId(e.id)
    setForm({ name: e.name, amount: e.amount, dueDate: e.dueDate, description: e.description || '', subItems: [...(e.subItems || [])] })
    setShowForm(true)
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    if (!form.name.trim() || !form.amount) return toast('Please fill name and amount', 'error')
    const entry = {
      id: editId || genId(),
      name: form.name.trim(),
      amount: Number(form.amount),
      dueDate: Number(form.dueDate) || 1,
      description: form.description.trim(),
      subItems: form.subItems,
      paid: editId ? expenses.find(x => x.id === editId)?.paid || false : false
    }
    if (editId) {
      onUpdate(expenses.map(e => e.id === editId ? entry : e))
      toast('Fixed expense updated')
    } else {
      onUpdate([...expenses, entry])
      toast('Fixed expense added')
    }
    resetForm()
  }

  function addSubItem() {
    if (!subName.trim() || !subAmount) return
    setForm(f => ({ ...f, subItems: [...f.subItems, { id: genId(), name: subName.trim(), amount: Number(subAmount) }] }))
    setSubName(''); setSubAmount('')
  }

  function togglePaid(id) {
    onUpdate(expenses.map(e => e.id === id ? { ...e, paid: !e.paid } : e))
  }

  function handleDelete() {
    if (confirmDelete) {
      onUpdate(expenses.filter(e => e.id !== confirmDelete))
      toast('Fixed expense deleted')
      setConfirmDelete(null)
    }
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Fixed Expense"
        message="Are you sure you want to delete this fixed expense?"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><CreditCard className="w-5 h-5 text-gold-400" /> Fixed Spendings</h2>
          <p className="text-sm text-slate-400 mt-1">
            Total: <span className="text-red-400 font-semibold">{fmt(total)}</span>
            {' · '}Paid: <span className="text-emerald-400 font-semibold">{fmt(paidTotal)}</span>
            {' · '}Pending: <span className="text-gold-400 font-semibold">{fmt(total - paidTotal)}</span>
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-400 text-navy-950 rounded-xl font-semibold text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {expenses.length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-500">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No fixed expenses yet. Add rent, EMIs, bills, etc.</p>
        </div>
      )}

      <div className="space-y-2">
        {expenses.map(e => {
          const isExpanded = expanded[e.id]
          const hasSubItems = e.subItems && e.subItems.length > 0
          return (
            <div key={e.id} className={`border rounded-xl overflow-hidden transition-all animate-fade-in ${e.paid ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-navy-950/50 border-navy-700/30'}`}>
              <div className="flex items-center gap-3 p-4">
                <button onClick={() => togglePaid(e.id)}
                  className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${e.paid ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600 hover:border-gold-500'}`}>
                  {e.paid && <Check className="w-3.5 h-3.5 text-white" />}
                </button>

                {hasSubItems && (
                  <button onClick={() => setExpanded(p => ({ ...p, [e.id]: !p[e.id] }))} className="flex-shrink-0 text-slate-400 hover:text-white transition-colors">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-semibold ${e.paid ? 'line-through text-slate-400' : 'text-white'}`}>{e.name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-navy-800 text-slate-400">Due: {e.dueDate}{e.dueDate === 1 ? 'st' : e.dueDate === 2 ? 'nd' : e.dueDate === 3 ? 'rd' : 'th'}</span>
                  </div>
                  {e.description && <p className="text-xs text-slate-500 mt-0.5">{e.description}</p>}
                </div>

                <span className={`font-bold text-lg flex-shrink-0 ${e.paid ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(e.amount)}</span>

                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => startEdit(e)} className="w-7 h-7 rounded-lg bg-slate-700/50 hover:bg-slate-600 flex items-center justify-center transition-colors"><Edit3 className="w-3 h-3" /></button>
                  <button onClick={() => setConfirmDelete(e.id)} className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>

              {isExpanded && hasSubItems && (
                <div className="border-t border-navy-700/30 px-4 py-3 space-y-1.5 bg-navy-950/30">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Breakdown</p>
                  {e.subItems.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-slate-300">{s.name}</span>
                      <span className="text-slate-400 font-medium">{fmt(s.amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-navy-700/20 font-semibold">
                    <span className="text-slate-300">Sub-total</span>
                    <span className="text-gold-400">{fmt(e.subItems.reduce((s, i) => s + Number(i.amount), 0))}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={showForm} onClose={resetForm} title={editId ? 'Edit Fixed Expense' : 'Add Fixed Expense'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Expense Name" placeholder="e.g. Rent, Car Loan" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Amount (₹)" type="number" placeholder="e.g. 15000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Due Date (Day of Month)" type="number" min="1" max="31" placeholder="e.g. 6" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            <Input label="Description (optional)" placeholder="e.g. Monthly rent" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="border border-navy-700/30 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-slate-300">Sub-items (e.g. Credit Card breakdown)</p>
            {form.subItems.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="text-slate-300 flex-1">{s.name}</span>
                <span className="text-slate-400">{fmt(s.amount)}</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, subItems: f.subItems.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <div className="flex gap-2">
              <input placeholder="Item name" value={subName} onChange={e => setSubName(e.target.value)} className="flex-1 bg-navy-950/50 border border-navy-700/50 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-gold-500/50" />
              <input type="number" placeholder="₹" value={subAmount} onChange={e => setSubAmount(e.target.value)} className="w-24 bg-navy-950/50 border border-navy-700/50 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-gold-500/50" />
              <button type="button" onClick={addSubItem} className="px-3 py-2 bg-gold-500/20 hover:bg-gold-500/30 text-gold-400 rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold transition-colors">{editId ? 'Update' : 'Add Expense'}</button>
          </div>
        </form>
      </Modal>

    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// DAILY / VARIABLE EXPENSES SECTION
// ══════════════════════════════════════════════════════════════════════
function DailyExpensesSection({ expenses, onUpdate, onAddExpenses, toast, monthKey }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ title: '', description: '', amount: '', category: CATEGORIES[0], date: today, paymentMethod: PAYMENT_METHODS[1] })

  function resetForm() {
    setShowForm(false); setEditId(null)
    setForm({ title: '', description: '', amount: '', category: CATEGORIES[0], date: today, paymentMethod: PAYMENT_METHODS[1] })
  }

  function startEdit(e) {
    setEditId(e.id)
    setForm({ title: e.title, description: e.description || '', amount: e.amount, category: e.category, date: e.date, paymentMethod: e.paymentMethod })
    setShowForm(true)
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    if (!form.title.trim() || !form.amount) return toast('Please fill title and amount', 'error')
    const entry = {
      id: editId || genId(),
      title: form.title.trim(),
      description: form.description.trim(),
      amount: Number(form.amount),
      category: form.category,
      date: form.date,
      paymentMethod: form.paymentMethod
    }
    if (editId) {
      const dateMonth = entry.date.slice(0, 7)
      if (dateMonth !== monthKey) {
        onUpdate(expenses.filter(e => e.id !== editId))
        onAddExpenses([entry])
        toast('Expense updated & moved to ' + monthLabel(dateMonth))
      } else {
        onUpdate(expenses.map(e => e.id === editId ? entry : e))
        toast('Expense updated')
      }
    } else {
      onAddExpenses([entry])
      toast('Expense added')
    }
    resetForm()
  }

  function handleDelete() {
    if (confirmDelete) {
      onUpdate(expenses.filter(e => e.id !== confirmDelete))
      toast('Expense deleted')
      setConfirmDelete(null)
    }
  }

  let filtered = [...expenses]
  if (filter === 'today') filtered = filtered.filter(e => e.date === today)
  if (searchTerm) filtered = filtered.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase()))
  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  const grouped = {}
  filtered.forEach(e => { if (!grouped[e.date]) grouped[e.date] = []; grouped[e.date].push(e) })

  const totalFiltered = filtered.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-4">
      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense?"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-gold-400" /> Daily Expenses</h2>
          <p className="text-sm text-slate-400 mt-1">
            {filter === 'today' ? "Today's" : 'Monthly'} total: <span className="text-gold-400 font-semibold">{fmt(totalFiltered)}</span>
            {' · '}{filtered.length} expense{filtered.length !== 1 && 's'}
          </p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 bg-gold-500 hover:bg-gold-400 text-navy-950 rounded-xl font-semibold text-sm transition-colors">
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-navy-950/50 border border-navy-700/30 rounded-xl overflow-hidden">
          {[['all', 'All'], ['today', 'Today']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${filter === v ? 'bg-gold-500 text-navy-950' : 'text-slate-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input placeholder="Search expenses..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-navy-950/50 border border-navy-700/30 rounded-xl pl-10 pr-4 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-gold-500/50" />
        </div>
      </div>

      {Object.keys(grouped).length === 0 && !showForm && (
        <div className="text-center py-12 text-slate-500">
          <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{filter === 'today' ? 'No expenses today.' : 'No daily expenses yet.'}</p>
        </div>
      )}

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date} className="space-y-2 animate-fade-in">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-slate-300">{dayLabel(date)}</p>
            <p className="text-sm font-semibold text-gold-400">{fmt(items.reduce((s, e) => s + Number(e.amount), 0))}</p>
          </div>
          {items.map(e => {
            const CatIcon = CATEGORY_ICONS[e.category] || MoreHorizontal
            return (
              <div key={e.id} className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4 flex items-center gap-3 group hover:border-gold-500/20 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[e.category] + '20' }}>
                  <CatIcon className="w-5 h-5" style={{ color: CATEGORY_COLORS[e.category] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{e.title}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="px-1.5 py-0.5 rounded bg-navy-800 text-slate-400">{e.category}</span>
                    <span>{e.paymentMethod}</span>
                    {e.description && <span>· {e.description}</span>}
                  </div>
                </div>
                <span className="font-bold text-red-400 flex-shrink-0">{fmt(e.amount)}</span>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => startEdit(e)} className="w-7 h-7 rounded-lg bg-slate-700/50 hover:bg-slate-600 flex items-center justify-center transition-colors"><Edit3 className="w-3 h-3" /></button>
                  <button onClick={() => setConfirmDelete(e.id)} className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 flex items-center justify-center transition-colors text-red-400"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <Modal open={showForm} onClose={resetForm} title={editId ? 'Edit Expense' : 'Add Daily Expense'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" placeholder="e.g. Lunch, Petrol" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Input label="Description (optional)" placeholder="e.g. Office lunch with team" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Amount (₹)" type="number" placeholder="e.g. 250" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            <Select label="Category" options={CATEGORIES} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <Select label="Payment Method" options={PAYMENT_METHODS} value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold transition-colors">{editId ? 'Update' : 'Add Expense'}</button>
          </div>
        </form>
      </Modal>

    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD SECTION
// ══════════════════════════════════════════════════════════════════════
function DashboardSection({ monthData, monthKey }) {
  const { members = [], fixedExpenses = [], dailyExpenses = [] } = monthData
  const totalIncome = members.reduce((s, m) => s + Number(m.salary), 0)
  const totalFixed = fixedExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalDaily = dailyExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalExpenses = totalFixed + totalDaily
  const savings = totalIncome - totalExpenses
  const spentPercent = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0

  const categoryData = {}
  dailyExpenses.forEach(e => {
    categoryData[e.category] = (categoryData[e.category] || 0) + Number(e.amount)
  })
  const pieData = Object.entries(categoryData).map(([name, value]) => ({ name, value }))

  const paidFixed = fixedExpenses.filter(e => e.paid).reduce((s, e) => s + Number(e.amount), 0)
  const pendingFixed = totalFixed - paidFixed

  const dailyByDate = {}
  dailyExpenses.forEach(e => {
    const d = new Date(e.date).getDate()
    dailyByDate[d] = (dailyByDate[d] || 0) + Number(e.amount)
  })
  const barData = Object.entries(dailyByDate).map(([day, total]) => ({ day: `${day}`, total })).sort((a, b) => Number(a.day) - Number(b.day))

  const upcomingBills = fixedExpenses
    .filter(e => !e.paid)
    .sort((a, b) => a.dueDate - b.dueDate)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1"><LayoutDashboard className="w-5 h-5 text-gold-400" /> Dashboard</h2>
        <p className="text-sm text-slate-400">{monthLabel(monthKey)} Overview</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Income" value={fmt(totalIncome)} icon={TrendingUp} color="green" sub={`${members.length} member${members.length !== 1 ? 's' : ''}`} />
        <StatCard label="Fixed Expenses" value={fmt(totalFixed)} icon={CreditCard} color="red" sub={`${fixedExpenses.filter(e => e.paid).length}/${fixedExpenses.length} paid`} />
        <StatCard label="Daily Expenses" value={fmt(totalDaily)} icon={ShoppingCart} color="blue" sub={`${dailyExpenses.length} transactions`} />
        <StatCard label="Savings" value={fmt(savings)} icon={Wallet} color={savings >= 0 ? 'gold' : 'red'} sub={savings >= 0 ? 'Looking good!' : 'Over budget!'} />
      </div>

      {/* Spending Progress */}
      <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-300">Budget Usage</p>
          <p className="text-sm font-semibold text-gold-400">{spentPercent.toFixed(1)}%</p>
        </div>
        <div className="w-full bg-navy-800 rounded-full h-3 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${spentPercent > 90 ? 'bg-red-500' : spentPercent > 70 ? 'bg-gold-500' : 'bg-emerald-500'}`}
            style={{ width: `${spentPercent}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-500">
          <span>Spent: {fmt(totalExpenses)}</span>
          <span>Income: {fmt(totalIncome)}</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Category Breakdown */}
        <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-300 mb-4">Daily Expenses by Category</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#e2e8f0' }} />
                <Legend formatter={(v) => <span className="text-slate-300 text-xs">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10 text-slate-500 text-sm">No daily expenses to chart</div>
          )}
        </div>

        {/* Daily Spending Bar */}
        <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
          <p className="text-sm font-medium text-slate-300 mb-4">Daily Spending Trend</p>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} labelFormatter={(l) => `Day ${l}`} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#e2e8f0' }} />
                <Bar dataKey="total" fill="#fbbf24" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-10 text-slate-500 text-sm">No daily expenses to chart</div>
          )}
        </div>
      </div>

      {/* Fixed Expenses Status */}
      <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-slate-300">Fixed Expenses Status</p>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-emerald-400">Paid: {fmt(paidFixed)}</span>
            <span className="text-red-400">Pending: {fmt(pendingFixed)}</span>
          </div>
        </div>
        <div className="w-full bg-navy-800 rounded-full h-2.5 overflow-hidden mb-4">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
            style={{ width: `${totalFixed > 0 ? (paidFixed / totalFixed) * 100 : 0}%` }} />
        </div>

        {upcomingBills.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Upcoming / Unpaid Bills</p>
            <div className="space-y-2">
              {upcomingBills.map(b => (
                <div key={b.id} className="flex items-center justify-between text-sm py-1.5">
                  <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-gold-400" />
                    <span className="text-slate-300">{b.name}</span>
                    <span className="text-xs text-slate-500">Due: {b.dueDate}{b.dueDate === 1 ? 'st' : b.dueDate === 2 ? 'nd' : b.dueDate === 3 ? 'rd' : 'th'}</span>
                  </div>
                  <span className="font-medium text-red-400">{fmt(b.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// EXPORT SECTION
// ══════════════════════════════════════════════════════════════════════
function exportToCSV(monthData, monthKey) {
  const { members = [], fixedExpenses = [], dailyExpenses = [] } = monthData
  const totalIncome = members.reduce((s, m) => s + Number(m.salary), 0)
  const totalFixed = fixedExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalDaily = dailyExpenses.reduce((s, e) => s + Number(e.amount), 0)

  let csv = '=== INCOME MEMBERS ===\nName,Amount\n'
  members.forEach(m => csv += `"${m.name}",${m.salary}\n`)
  csv += `Total Income,${totalIncome}\n\n`

  csv += '=== FIXED SPENDINGS ===\nName,Amount,Due Date,Description,Paid,Sub-items\n'
  fixedExpenses.forEach(e => {
    const subs = (e.subItems || []).map(s => `${s.name}: ₹${s.amount}`).join('; ')
    csv += `"${e.name}",${e.amount},${e.dueDate},"${e.description || ''}",${e.paid ? 'Yes' : 'No'},"${subs}"\n`
  })
  csv += `Total Fixed,,${totalFixed},,\n\n`

  csv += '=== DAILY EXPENSES ===\nDate,Title,Description,Category,Amount,Payment Method\n'
  dailyExpenses.sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
    csv += `${e.date},"${e.title}","${e.description || ''}",${e.category},${e.amount},${e.paymentMethod}\n`
  })
  csv += `Total Daily,,,,${totalDaily},\n\n`

  csv += '=== SUMMARY ===\n'
  csv += `Total Income,${totalIncome}\n`
  csv += `Fixed Expenses,${totalFixed}\n`
  csv += `Daily Expenses,${totalDaily}\n`
  csv += `Savings,${totalIncome - totalFixed - totalDaily}\n`

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-${monthKey}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportToExcel(monthData, monthKey) {
  const { members = [], fixedExpenses = [], dailyExpenses = [] } = monthData
  const wb = XLSX.utils.book_new()

  const sheetData = []
  members.forEach(m => { sheetData.push([m.name, m.salary]) })
  while (sheetData.length < 3) sheetData.push([])

  const sortedDaily = [...dailyExpenses].sort((a, b) => a.date.localeCompare(b.date))
  sortedDaily.forEach(e => { sheetData.push([e.title, e.amount]) })
  while (sheetData.length < 6) sheetData.push([])

  for (let r = 6; r < Math.max(6, 6 + fixedExpenses.length); r++) {
    const fe = fixedExpenses[r - 6]
    const row = sheetData[r] || []
    while (row.length < 7) row.push('')
    if (fe) {
      row[7] = fe.name
      row[8] = fe.amount
      row[9] = fe.dueDate
      row[10] = fe.description || ''
      row[11] = (fe.subItems || []).map(s => `${s.name}: ${s.amount}`).join('; ')
      row[12] = fe.paid ? 'Yes' : 'No'
    }
    sheetData[r] = row
  }

  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  XLSX.utils.book_append_sheet(wb, ws, monthLabel(monthKey))
  XLSX.writeFile(wb, `finance-${monthKey}.xlsx`)
}

function exportToJSON(allData, monthKey) {
  const json = JSON.stringify(allData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `finance-all-${monthKey}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadSampleExcel() {
  const wb = XLSX.utils.book_new()
  const data = []
  data[0] = ['Rahul', 200000, '', '', '', '', '', '', '', '', '', '', '']
  data[1] = ['Yogesh', 25000]
  data[2] = []
  data[3] = ['Colaba Lunch', 1024]
  data[4] = ['Petrol', 300]
  data[5] = ['Eggs', 200]
  data[6] = ['Groceries', 1500, '', '', '', '', '', 'Rent', 23000, 5, '', '', 'Yes']
  data[7] = ['Shobha', 1000, '', '', '', '', '', 'Car Loan', 8213, 9, '', '', 'No']
  data[8] = ['CNG', 540, '', '', '', '', '', 'HDFC Credit Card', 10335, 12, '', 'Amazon: 4163; Speaker: 419', 'No']
  data[9] = ['', '', '', '', '', '', '', 'Insurance', 3869, 4, '', '', 'Yes']
  data[10] = ['', '', '', '', '', '', '', 'Parking', 2200, 1, '', '', 'Yes']

  const ws = XLSX.utils.aoa_to_sheet(data)
  XLSX.utils.book_append_sheet(wb, ws, 'Sample')
  XLSX.writeFile(wb, 'finance-sample-import.xlsx')
}

function downloadSampleJSON() {
  const today = new Date()
  const mk = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const sample = {
    [mk]: {
      members: [
        { name: 'Rahul', salary: 200000 },
        { name: 'Yogesh', salary: 25000 }
      ],
      fixedExpenses: [
        { name: 'Rent', amount: 23000, dueDate: 5, description: '', subItems: [], paid: true },
        { name: 'Car Loan', amount: 8213, dueDate: 9, description: '', subItems: [], paid: false },
        { name: 'HDFC Credit Card', amount: 10335, dueDate: 12, description: '', subItems: [{ name: 'Amazon', amount: 4163 }, { name: 'Speaker', amount: 419 }], paid: false }
      ],
      dailyExpenses: [
        { title: 'Colaba Lunch', description: '', amount: 1024, category: 'Food', date: `${mk}-08`, paymentMethod: 'UPI' },
        { title: 'Petrol', description: '', amount: 300, category: 'Transport', date: `${mk}-08`, paymentMethod: 'UPI' },
        { title: 'Eggs', description: '', amount: 200, category: 'Food', date: `${mk}-08`, paymentMethod: 'Cash' }
      ]
    }
  }
  const json = JSON.stringify(sample, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'finance-sample-import.json'
  a.click()
  URL.revokeObjectURL(url)
}

// ══════════════════════════════════════════════════════════════════════
// EXCEL IMPORT
// ══════════════════════════════════════════════════════════════════════
function cellVal(sheet, col, row) {
  const cell = sheet[`${col}${row}`]
  return cell ? cell.v : null
}

function parseExcelSheet(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        if (!sheet) return reject('No sheet found')

        const members = []
        for (let r = 1; r <= 2; r++) {
          const name = cellVal(sheet, 'A', r)
          const salary = cellVal(sheet, 'B', r)
          if (name && salary && Number(salary) > 0) {
            members.push({ name: String(name).trim(), salary: Number(salary) })
          }
        }

        const dailyExpenses = []
        for (let r = 4; r <= 50; r++) {
          const title = cellVal(sheet, 'A', r)
          const amount = cellVal(sheet, 'B', r)
          if (title && amount && Number(amount) > 0) {
            dailyExpenses.push({ title: String(title).trim(), amount: Number(amount) })
          }
        }

        const fixedExpenses = []
        for (let r = 7; r <= 50; r++) {
          const name = cellVal(sheet, 'H', r)
          const amount = cellVal(sheet, 'I', r)
          if (!name || !amount || Number(amount) <= 0) continue

          let dueDate = 1
          const rawDate = cellVal(sheet, 'J', r)
          if (rawDate instanceof Date && !isNaN(rawDate)) {
            dueDate = rawDate.getDate()
          } else if (rawDate) {
            const str = String(rawDate).trim()
            const parts = str.split('/')
            if (parts.length >= 2) {
              const d = parseInt(parts[1], 10)
              if (d >= 1 && d <= 31) dueDate = d
            } else {
              const num = parseInt(str, 10)
              if (num >= 1 && num <= 31) dueDate = num
            }
          }

          const description = String(cellVal(sheet, 'K', r) || '').trim()
          const subItemsRaw = String(cellVal(sheet, 'L', r) || '').trim()
          const paidRaw = cellVal(sheet, 'M', r)

          const subItems = subItemsRaw ? subItemsRaw.split(/[;,]/).map(s => {
            const match = s.trim().match(/^(.+?)\s*[:\-₹]\s*(\d+)$/)
            if (match) return { id: genId(), name: match[1].trim(), amount: Number(match[2]) }
            return s.trim() ? { id: genId(), name: s.trim(), amount: 0 } : null
          }).filter(Boolean) : []

          const paid = paidRaw && (String(paidRaw).toLowerCase() === 'yes' || String(paidRaw).toLowerCase() === 'true' || paidRaw === true)

          fixedExpenses.push({
            name: String(name).trim(), amount: Number(amount), dueDate,
            description, subItems, paid: !!paid
          })
        }

        resolve({ members, dailyExpenses, fixedExpenses })
      } catch (err) {
        reject('Failed to parse Excel: ' + err.message)
      }
    }
    reader.onerror = () => reject('Failed to read file')
    reader.readAsArrayBuffer(file)
  })
}

function ImportModal({ open, onClose, onImport, onJsonImport, toast, currentMonth }) {
  const [mode, setMode] = useState('excel')
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dailyDate, setDailyDate] = useState('')
  const [dailyCategory, setDailyCategory] = useState('Other')
  const [dailyPayment, setDailyPayment] = useState('UPI')
  const [jsonText, setJsonText] = useState('')
  const [jsonParsed, setJsonParsed] = useState(null)
  const [jsonError, setJsonError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (open) {
      const today = new Date().toISOString().slice(0, 10)
      const defaultDate = today.startsWith(currentMonth) ? today : currentMonth + '-01'
      setDailyDate(defaultDate)
      setDailyCategory('Other')
      setDailyPayment('UPI')
      setFile(null)
      setParsed(null)
      setLoading(false)
      setJsonText('')
      setJsonParsed(null)
      setJsonError('')
    }
  }, [open, currentMonth])

  function reset() { setFile(null); setParsed(null); setLoading(false); setJsonText(''); setJsonParsed(null); setJsonError('') }

  async function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setLoading(true)
    try {
      const result = await parseExcelSheet(f)
      setParsed(result)
    } catch (err) {
      toast(String(err), 'error')
      setParsed(null)
    }
    setLoading(false)
  }

  function handleExcelImport() {
    if (!parsed) return
    const members = parsed.members.map(m => ({ id: genId(), ...m }))
    const fixed = parsed.fixedExpenses.map(e => ({ id: genId(), ...e }))
    const daily = parsed.dailyExpenses.map(e => ({
      id: genId(), title: e.title, description: '', amount: e.amount,
      category: dailyCategory, date: dailyDate, paymentMethod: dailyPayment
    }))
    onImport({ members, fixedExpenses: fixed, dailyExpenses: daily, dailyDate })
    reset()
    onClose()
  }

  function parseJson(text) {
    setJsonText(text)
    setJsonError('')
    setJsonParsed(null)
    if (!text.trim()) return
    try {
      const data = JSON.parse(text)
      if (typeof data !== 'object' || data === null) throw new Error('Must be a JSON object')
      let totalMonths = 0, totalMembers = 0, totalFixed = 0, totalDaily = 0
      for (const [key, val] of Object.entries(data)) {
        if (!/^\d{4}-\d{2}$/.test(key)) throw new Error(`Invalid month key: "${key}". Use YYYY-MM format`)
        totalMonths++
        totalMembers += (val.members || []).length
        totalFixed += (val.fixedExpenses || []).length
        totalDaily += (val.dailyExpenses || []).length
      }
      setJsonParsed({ data, totalMonths, totalMembers, totalFixed, totalDaily })
    } catch (err) {
      setJsonError(err.message)
    }
  }

  function handleJsonImport() {
    if (!jsonParsed) return
    onJsonImport(jsonParsed.data)
    reset()
    onClose()
  }

  if (!open) return null

  const totalDaily = parsed?.dailyExpenses?.reduce((s, e) => s + e.amount, 0) || 0
  const totalFixed = parsed?.fixedExpenses?.reduce((s, e) => s + e.amount, 0) || 0
  const totalIncome = parsed?.members?.reduce((s, m) => s + m.salary, 0) || 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={() => { reset(); onClose() }}>
      <div className="bg-navy-900 border border-navy-700/50 rounded-2xl p-6 max-w-2xl w-full shadow-2xl animate-slide-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2"><Upload className="w-5 h-5 text-emerald-400" /> Import Data</h3>
          <button onClick={() => { reset(); onClose() }} className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600 flex items-center justify-center transition-colors"><X className="w-4 h-4" /></button>
        </div>

        {/* Mode Tabs */}
        <div className="flex bg-navy-950/50 border border-navy-700/30 rounded-xl overflow-hidden mb-5">
          {[['excel', 'Excel File'], ['json', 'JSON Data']].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${mode === id ? 'bg-gold-500 text-navy-950' : 'text-slate-400 hover:text-white'}`}>{label}</button>
          ))}
        </div>

        {/* ── EXCEL MODE ── */}
        {mode === 'excel' && (
          <>
            <div className="mb-5">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors ${file ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-navy-700/50 hover:border-gold-500/40 bg-navy-950/30'}`}>
                {loading ? (
                  <p className="text-slate-400">Parsing...</p>
                ) : file ? (
                  <div>
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    <p className="text-emerald-400 font-medium">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">Click to change file</p>
                  </div>
                ) : (
                  <div>
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                    <p className="text-slate-400 font-medium">Click to upload Excel file</p>
                    <p className="text-xs text-slate-500 mt-1">.xlsx, .xls, or .csv</p>
                  </div>
                )}
              </button>
            </div>

            {!parsed && (
              <div className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4 mb-5">
                <p className="text-sm font-medium text-slate-300 mb-2">Expected Excel Layout</p>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <p><span className="text-gold-400 font-medium">Col A-B, Row 1-2:</span> Income members (Name, Salary)</p>
                  <p><span className="text-gold-400 font-medium">Col A-B, Row 4-50:</span> Daily expenses (Title, Amount)</p>
                  <p><span className="text-gold-400 font-medium">Col H-M, Row 7-50:</span> Fixed expenses (Name, Amount, Due Date, Description, Sub-items, Paid?)</p>
                </div>
                <button onClick={downloadSampleExcel}
                  className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download sample Excel file
                </button>
              </div>
            )}

            {parsed && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Members</p>
                    <p className="text-lg font-bold text-emerald-400">{parsed.members.length}</p>
                    <p className="text-xs text-slate-500">{fmt(totalIncome)}</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Daily</p>
                    <p className="text-lg font-bold text-blue-400">{parsed.dailyExpenses.length}</p>
                    <p className="text-xs text-slate-500">{fmt(totalDaily)}</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Fixed</p>
                    <p className="text-lg font-bold text-red-400">{parsed.fixedExpenses.length}</p>
                    <p className="text-xs text-slate-500">{fmt(totalFixed)}</p>
                  </div>
                </div>

                {parsed.dailyExpenses.length > 0 && (
                  <div className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-300">Daily Expense Defaults</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input label="Date" type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} />
                      <Select label="Category" options={CATEGORIES} value={dailyCategory} onChange={e => setDailyCategory(e.target.value)} />
                      <Select label="Payment" options={PAYMENT_METHODS} value={dailyPayment} onChange={e => setDailyPayment(e.target.value)} />
                    </div>
                  </div>
                )}

                {parsed.members.length > 0 && (
                  <div className="border border-navy-700/30 rounded-xl overflow-hidden">
                    <div className="bg-navy-800/50 px-4 py-2"><p className="text-xs font-medium text-slate-300">Income Members</p></div>
                    <div className="divide-y divide-navy-700/20">
                      {parsed.members.map((m, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-slate-300">{m.name}</span>
                          <span className="text-emerald-400 font-medium">{fmt(m.salary)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsed.dailyExpenses.length > 0 && (
                  <div className="border border-navy-700/30 rounded-xl overflow-hidden">
                    <div className="bg-navy-800/50 px-4 py-2 flex justify-between">
                      <p className="text-xs font-medium text-slate-300">Daily Expenses</p>
                      <p className="text-xs font-semibold text-gold-400">{fmt(totalDaily)}</p>
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-navy-700/20">
                      {parsed.dailyExpenses.map((e, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                          <span className="text-slate-300">{e.title}</span>
                          <span className="text-red-400 font-medium">{fmt(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {parsed.fixedExpenses.length > 0 && (
                  <div className="border border-navy-700/30 rounded-xl overflow-hidden">
                    <div className="bg-navy-800/50 px-4 py-2 flex justify-between">
                      <p className="text-xs font-medium text-slate-300">Fixed Expenses</p>
                      <p className="text-xs font-semibold text-gold-400">{fmt(totalFixed)}</p>
                    </div>
                    <div className="max-h-40 overflow-y-auto divide-y divide-navy-700/20">
                      {parsed.fixedExpenses.map((e, i) => (
                        <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                          <div>
                            <span className="text-slate-300">{e.name}</span>
                            <span className="text-xs text-slate-500 ml-2">Due: {e.dueDate}{e.dueDate === 1 ? 'st' : e.dueDate === 2 ? 'nd' : e.dueDate === 3 ? 'rd' : 'th'}</span>
                            {e.paid && <span className="text-xs text-emerald-400 ml-2">Paid</span>}
                          </div>
                          <span className="text-red-400 font-medium">{fmt(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => { reset(); onClose() }} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors">Cancel</button>
                  <button onClick={handleExcelImport}
                    className="px-5 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold transition-colors">
                    Import All to {monthLabel(currentMonth)}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── JSON MODE ── */}
        {mode === 'json' && (
          <div className="space-y-4">
            <div className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">Paste the full JSON from localStorage — or any JSON with <span className="text-gold-400">{"\"YYYY-MM\": { members, fixedExpenses, dailyExpenses }"}</span> structure.</p>
              <p className="text-xs text-slate-500">This <span className="text-red-400 font-medium">replaces</span> data for each month key found in the JSON. Months not in the JSON are untouched.</p>
              <button onClick={downloadSampleJSON}
                className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                <Download className="w-3.5 h-3.5" /> Download sample JSON file
              </button>
            </div>

            <textarea value={jsonText} onChange={e => parseJson(e.target.value)} rows={12}
              placeholder='{"2026-02": {"members": [...], "fixedExpenses": [...], "dailyExpenses": [...]}}'
              className="w-full bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-3 text-white placeholder-slate-600 text-sm font-mono focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20 resize-none" />

            {jsonError && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            {jsonParsed && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gold-500/10 border border-gold-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Months</p>
                    <p className="text-lg font-bold text-gold-400">{jsonParsed.totalMonths}</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Members</p>
                    <p className="text-lg font-bold text-emerald-400">{jsonParsed.totalMembers}</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Daily</p>
                    <p className="text-lg font-bold text-blue-400">{jsonParsed.totalDaily}</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Fixed</p>
                    <p className="text-lg font-bold text-red-400">{jsonParsed.totalFixed}</p>
                  </div>
                </div>

                <div className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-3">
                  <p className="text-xs font-medium text-slate-300 mb-1.5">Months to import</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(jsonParsed.data).sort().map(mk => (
                      <span key={mk} className="text-xs px-2.5 py-1 rounded-lg bg-navy-800 text-gold-400 font-medium">{monthLabel(mk)}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button onClick={() => { reset(); onClose() }} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors">Cancel</button>
              <button onClick={handleJsonImport} disabled={!jsonParsed}
                className="px-5 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Import {jsonParsed?.totalMonths || 0} Month{jsonParsed?.totalMonths !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'members', label: 'Income', icon: Users },
  { id: 'fixed', label: 'Fixed', icon: CreditCard },
  { id: 'daily', label: 'Daily', icon: ShoppingCart },
]

function migrateExpensesToCorrectMonths(data) {
  const migrated = { ...data }
  let moved = 0
  for (const monthKey of Object.keys(migrated)) {
    const md = migrated[monthKey]
    if (!md?.dailyExpenses?.length) continue
    const keep = []
    const misplaced = []
    for (const exp of md.dailyExpenses) {
      const correctMonth = exp.date?.slice(0, 7)
      if (correctMonth && correctMonth !== monthKey) {
        misplaced.push({ exp, correctMonth })
      } else {
        keep.push(exp)
      }
    }
    if (misplaced.length > 0) {
      migrated[monthKey] = { ...md, dailyExpenses: keep }
      for (const { exp, correctMonth } of misplaced) {
        const target = migrated[correctMonth] || { members: [], fixedExpenses: [], dailyExpenses: [] }
        migrated[correctMonth] = { ...target, dailyExpenses: [...target.dailyExpenses, exp] }
        moved++
      }
    }
  }
  return { data: migrated, moved }
}

export default function App() {
  const [migrationInfo] = useState(() => {
    const raw = loadData()
    const { data: fixed, moved } = migrateExpensesToCorrectMonths(raw)
    if (moved > 0) saveData(fixed)
    return { moved, data: fixed }
  })
  const [data, setData] = useState(migrationInfo.data)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date()))
  const [showImport, setShowImport] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const { toasts, toast, removeToast } = useToast()

  const monthData = getMonthData(data, currentMonth)

  useEffect(() => { saveData(data) }, [data])
  useEffect(() => {
    if (migrationInfo.moved > 0) toast(`Auto-fixed ${migrationInfo.moved} expense(s) moved to correct month`)
  }, [])

  function updateMonth(key, field, value) {
    setData(prev => ({
      ...prev,
      [key]: { ...getMonthData(prev, key), [field]: value }
    }))
  }

  function addDailyExpenses(newExpenses) {
    setData(prev => {
      const updated = { ...prev }
      const byMonth = {}
      for (const exp of newExpenses) {
        const mk = exp.date.slice(0, 7)
        if (!byMonth[mk]) byMonth[mk] = []
        byMonth[mk].push(exp)
      }
      for (const [mk, exps] of Object.entries(byMonth)) {
        const existing = getMonthData(updated, mk)
        updated[mk] = { ...existing, dailyExpenses: [...existing.dailyExpenses, ...exps] }
      }
      return updated
    })
  }

  function handleExcelImport({ members, fixedExpenses, dailyExpenses, dailyDate }) {
    const dailyMonth = dailyDate ? dailyDate.slice(0, 7) : currentMonth

    setData(prev => {
      const updated = {}
      for (const key of Object.keys(prev)) {
        updated[key] = { ...prev[key] }
      }

      function ensureMonth(mk) {
        if (!updated[mk]) updated[mk] = { members: [], fixedExpenses: [], dailyExpenses: [] }
      }

      // Members & fixed go to the currently viewed month
      ensureMonth(currentMonth)
      if (members.length > 0) {
        updated[currentMonth].members = [...updated[currentMonth].members, ...members]
      }
      if (fixedExpenses.length > 0) {
        updated[currentMonth].fixedExpenses = [...updated[currentMonth].fixedExpenses, ...fixedExpenses]
      }

      // Daily expenses go to the month matching their date
      if (dailyExpenses.length > 0) {
        const byMonth = {}
        for (const exp of dailyExpenses) {
          const mk = exp.date.slice(0, 7)
          if (!byMonth[mk]) byMonth[mk] = []
          byMonth[mk].push(exp)
        }
        for (const [mk, exps] of Object.entries(byMonth)) {
          ensureMonth(mk)
          updated[mk].dailyExpenses = [...updated[mk].dailyExpenses, ...exps]
        }
      }

      return updated
    })

    // Auto-navigate to the month where daily expenses were added & switch to Daily tab
    if (dailyExpenses.length > 0) {
      setCurrentMonth(dailyMonth)
      setActiveTab('daily')
    }

    const counts = []
    if (members.length) counts.push(`${members.length} members`)
    if (fixedExpenses.length) counts.push(`${fixedExpenses.length} fixed`)
    if (dailyExpenses.length) counts.push(`${dailyExpenses.length} daily`)
    toast(`Excel imported: ${counts.join(', ')} into ${monthLabel(dailyMonth)}`)
  }

  function handleJsonImport(jsonData) {
    setData(prev => {
      const updated = {}
      for (const key of Object.keys(prev)) {
        updated[key] = { ...prev[key] }
      }
      for (const [mk, monthVal] of Object.entries(jsonData)) {
        updated[mk] = {
          members: (monthVal.members || []).map(m => ({ ...m, id: m.id || genId() })),
          fixedExpenses: (monthVal.fixedExpenses || []).map(e => ({ ...e, id: e.id || genId() })),
          dailyExpenses: (monthVal.dailyExpenses || []).map(e => ({ ...e, id: e.id || genId() }))
        }
      }
      return updated
    })
    const months = Object.keys(jsonData).sort()
    if (months.length > 0) setCurrentMonth(months[0])
    toast(`JSON imported: ${months.length} month(s) — ${months.map(m => monthLabel(m)).join(', ')}`)
  }

  function changeMonth(delta) {
    const d = parseMonthKey(currentMonth)
    d.setMonth(d.getMonth() + delta)
    setCurrentMonth(getMonthKey(d))
  }

  function carryOverFixed() {
    const prevD = parseMonthKey(currentMonth)
    prevD.setMonth(prevD.getMonth() - 1)
    const prevKey = getMonthKey(prevD)
    const prevData = getMonthData(data, prevKey)
    if (prevData.fixedExpenses.length === 0) {
      return toast('No fixed expenses in previous month to carry over', 'error')
    }
    const carried = prevData.fixedExpenses.map(e => ({
      ...e, id: genId(), paid: false
    }))
    updateMonth(currentMonth, 'fixedExpenses', [...monthData.fixedExpenses, ...carried])
    toast(`Carried over ${carried.length} fixed expenses from ${monthLabel(prevKey)}`)
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleExcelImport}
        onJsonImport={handleJsonImport}
        toast={toast}
        currentMonth={currentMonth}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-navy-950/80 backdrop-blur-xl border-b border-navy-700/30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-navy-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Finance Tracker</h1>
              <p className="text-xs text-slate-500 hidden sm:block">Personal money manager</p>
            </div>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-semibold text-white min-w-[140px] text-center">{monthLabel(currentMonth)}</span>
            <button onClick={() => changeMonth(1)} className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition-colors"><ChevronRightIcon className="w-4 h-4" /></button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowImport(true)} title="Import data"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors">
              <Upload className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Import</span>
            </button>
            <button onClick={carryOverFixed} title="Carry over fixed expenses from last month"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-xs font-medium text-slate-300 transition-colors">
              <Copy className="w-3.5 h-3.5" /> Carry Over
            </button>
            <div className="relative">
              <button onClick={() => setShowExportMenu(p => !p)} title="Export data"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500/20 hover:bg-gold-500/30 text-gold-400 text-xs font-medium transition-colors">
                <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span>
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-navy-800 border border-navy-700/50 rounded-xl shadow-2xl py-1.5 min-w-[160px] animate-slide-in">
                    <button onClick={() => { exportToCSV(monthData, currentMonth); toast('CSV exported!'); setShowExportMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-navy-700/50 hover:text-white transition-colors">
                      <FileText className="w-4 h-4 text-gold-400" /> CSV
                    </button>
                    <button onClick={() => { exportToExcel(monthData, currentMonth); toast('Excel exported!'); setShowExportMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-navy-700/50 hover:text-white transition-colors">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel
                    </button>
                    <button onClick={() => { exportToJSON(data, currentMonth); toast('JSON exported!'); setShowExportMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-300 hover:bg-navy-700/50 hover:text-white transition-colors">
                      <span className="w-4 h-4 text-blue-400 font-mono text-[10px] flex items-center justify-center">{ }</span> JSON
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="max-w-5xl mx-auto px-4 hidden md:flex gap-1 -mb-px">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-gold-500 text-gold-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <DashboardSection monthData={monthData} monthKey={currentMonth} />}
        {activeTab === 'members' && <MembersSection members={monthData.members} onUpdate={v => updateMonth(currentMonth, 'members', v)} toast={toast} />}
        {activeTab === 'fixed' && <FixedExpensesSection expenses={monthData.fixedExpenses} onUpdate={v => updateMonth(currentMonth, 'fixedExpenses', v)} toast={toast} />}
        {activeTab === 'daily' && <DailyExpensesSection expenses={monthData.dailyExpenses} onUpdate={v => updateMonth(currentMonth, 'dailyExpenses', v)} onAddExpenses={addDailyExpenses} toast={toast} monthKey={currentMonth} />}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-navy-950/90 backdrop-blur-xl border-t border-navy-700/30 z-30">
        <div className="flex justify-around py-2">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors ${activeTab === tab.id ? 'text-gold-400' : 'text-slate-500'}`}>
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
