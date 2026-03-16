import { useState, useEffect, useCallback, useRef } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Plus, Trash2, Edit3, Check, X, ChevronDown, ChevronRight, Download,
  IndianRupee, Users, Calendar, CreditCard, ShoppingCart, TrendingUp,
  Home, LayoutDashboard, Wallet, Copy, AlertTriangle, ChevronLeft,
  ChevronRight as ChevronRightIcon, Coffee, Car, Heart, Film, Zap,
  MoreHorizontal, Search, Bell, CircleDot, Upload, FileText, FileSpreadsheet,
  Menu, Database, HardDrive, LogIn, LogOut, Cloud, CloudOff, Loader2,
  Shield, Info, ArrowLeftRight, GraduationCap, Shirt, Plane, Gift,
  Wrench, Smartphone, PiggyBank, Utensils, Droplets, Wifi
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { auth, googleProvider, db } from './firebase'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore'
import UPIImportModal from './components/UPIImportModal'
import { parseBankStatement } from './importers/bank/registry'
import { checkDuplicate } from './importers/bank/utils'

const DEFAULT_CATEGORIES = [
  { id: 'food', name: 'Food', color: '#f59e0b', emoji: null, icon: Coffee, builtIn: true },
  { id: 'groceries', name: 'Groceries', color: '#84cc16', emoji: null, icon: Utensils, builtIn: true },
  { id: 'transport', name: 'Transport', color: '#3b82f6', emoji: null, icon: Car, builtIn: true },
  { id: 'shopping', name: 'Shopping', color: '#ec4899', emoji: null, icon: ShoppingCart, builtIn: true },
  { id: 'health', name: 'Health', color: '#10b981', emoji: null, icon: Heart, builtIn: true },
  { id: 'entertainment', name: 'Entertainment', color: '#8b5cf6', emoji: null, icon: Film, builtIn: true },
  { id: 'bills', name: 'Bills', color: '#ef4444', emoji: null, icon: Zap, builtIn: true },
  { id: 'rent', name: 'Rent', color: '#f97316', emoji: null, icon: Home, builtIn: true },
  { id: 'utilities', name: 'Utilities', color: '#06b6d4', emoji: null, icon: Droplets, builtIn: true },
  { id: 'subscriptions', name: 'Subscriptions', color: '#a855f7', emoji: null, icon: Wifi, builtIn: true },
  { id: 'education', name: 'Education', color: '#0ea5e9', emoji: null, icon: GraduationCap, builtIn: true },
  { id: 'clothing', name: 'Clothing', color: '#d946ef', emoji: null, icon: Shirt, builtIn: true },
  { id: 'travel', name: 'Travel', color: '#14b8a6', emoji: null, icon: Plane, builtIn: true },
  { id: 'gifts', name: 'Gifts', color: '#f43f5e', emoji: null, icon: Gift, builtIn: true },
  { id: 'maintenance', name: 'Maintenance', color: '#78716c', emoji: null, icon: Wrench, builtIn: true },
  { id: 'mobile', name: 'Mobile & Internet', color: '#6366f1', emoji: null, icon: Smartphone, builtIn: true },
  { id: 'savings', name: 'Savings & Investment', color: '#22c55e', emoji: null, icon: PiggyBank, builtIn: true },
  { id: 'other', name: 'Other', color: '#6b7280', emoji: null, icon: MoreHorizontal, builtIn: true },
]
const PAYMENT_METHODS = ['Cash', 'UPI', 'Card']

function findCategory(categories, nameOrId) {
  if (!nameOrId) return null
  const lower = nameOrId.toLowerCase()
  return categories.find(c => c.id === lower || c.name.toLowerCase() === lower) || null
}

function getCatColor(categories, nameOrId) {
  return findCategory(categories, nameOrId)?.color || '#6b7280'
}

function loadCustomCategories() {
  try {
    const raw = localStorage.getItem('customCategories')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveCustomCategories(cats) {
  localStorage.setItem('customCategories', JSON.stringify(cats))
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function fmt(n) { return '₹' + Number(n || 0).toLocaleString('en-IN') }
function getMonthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
function parseMonthKey(k) { const [y, m] = k.split('-'); return new Date(parseInt(y), parseInt(m) - 1) }
function monthLabel(k) { return parseMonthKey(k).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
function dayLabel(d) { return new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) }
function isOverdue(dueDate, monthKey) {
  const today = new Date()
  const [y, m] = monthKey.split('-').map(Number)
  const viewingYear = y, viewingMonth = m - 1
  const currentYear = today.getFullYear(), currentMonth = today.getMonth()
  if (viewingYear < currentYear || (viewingYear === currentYear && viewingMonth < currentMonth)) return true
  if (viewingYear === currentYear && viewingMonth === currentMonth) return today.getDate() > dueDate
  return false
}
function dueSuffix(d) { return d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th' }



function getStorageUsage() {
  let used = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      used += (key.length + localStorage.getItem(key).length) * 2
    }
  } catch { /* ignore */ }
  const limitBytes = 5 * 1024 * 1024
  return { usedBytes: used, limitBytes, usedMB: (used / (1024 * 1024)).toFixed(2), limitMB: 5, percent: Math.min(100, (used / limitBytes) * 100) }
}

function loadData() {
  try { return JSON.parse(localStorage.getItem('financeData')) || {} } catch { return {} }
}
function saveData(data) { localStorage.setItem('financeData', JSON.stringify(data)) }
function loadTimestamp() {
  try { return parseInt(localStorage.getItem('financeDataTimestamp')) || 0 } catch { return 0 }
}
function saveTimestamp(ts) { localStorage.setItem('financeDataTimestamp', String(ts)) }

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
function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'Delete', variant = 'danger' }) {
  if (!open) return null
  const styles = {
    danger: { iconBg: 'bg-red-500/20', iconColor: 'text-red-400', btnBg: 'bg-red-600 hover:bg-red-500' },
    warning: { iconBg: 'bg-gold-500/20', iconColor: 'text-gold-400', btnBg: 'bg-gold-500 hover:bg-gold-400 !text-navy-950' },
  }
  const s = styles[variant] || styles.danger
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-navy-900 border border-navy-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full ${s.iconBg} flex items-center justify-center`}>
            <AlertTriangle className={`w-5 h-5 ${s.iconColor}`} />
          </div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
        <p className="text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`px-4 py-2 rounded-lg ${s.btnBg} text-white text-sm font-medium transition-colors`}>{confirmLabel}</button>
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

function CategoryIcon({ category, categories, size = 'w-5 h-5' }) {
  const cat = findCategory(categories, category)
  if (!cat) return <MoreHorizontal className={size} style={{ color: '#6b7280' }} />
  if (cat.emoji) return <span className="text-base leading-none">{cat.emoji}</span>
  if (cat.icon) { const Icon = cat.icon; return <Icon className={size} style={{ color: cat.color }} /> }
  return <CircleDot className={size} style={{ color: cat.color }} />
}

function CategorySelect({ label, categories, value, onChange, onAddNew }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus() }, [open])

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
  const selected = findCategory(categories, value)

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      {label && <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>}
      <button type="button" onClick={() => { setOpen(!open); setSearch('') }}
        className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white text-sm text-left flex items-center gap-2 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20 transition-all">
        {selected && (
          <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">
            <CategoryIcon category={value} categories={categories} size="w-4 h-4" />
          </span>
        )}
        <span className="flex-1 truncate">{selected?.name || value || 'Select'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="relative z-50">
          <div className="absolute top-0 left-0 right-0 bg-navy-900 border border-navy-700/50 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-2">
              <input ref={inputRef} type="text" placeholder="Search categories..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-navy-950/50 border border-navy-700/30 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50" />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.map(c => (
                <button key={c.id} type="button"
                  onClick={() => { onChange(c.name); setOpen(false); setSearch('') }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-navy-800 transition-colors ${(selected?.id === c.id) ? 'bg-navy-800 text-gold-400' : 'text-slate-300'}`}>
                  <span className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                    <CategoryIcon category={c.name} categories={categories} size="w-4 h-4" />
                  </span>
                  <span>{c.name}</span>
                </button>
              ))}
              {search && filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-slate-500">No matching categories</p>
              )}
            </div>
            <div className="border-t border-navy-700/30">
              <button type="button" onClick={() => { setOpen(false); onAddNew() }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gold-400 hover:bg-navy-800 transition-colors font-medium">
                <Plus className="w-4 h-4" /> New Category
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const COLOR_SWATCHES = [
  '#f59e0b', '#3b82f6', '#ec4899', '#10b981', '#8b5cf6', '#ef4444',
  '#6b7280', '#f97316', '#14b8a6', '#a855f7', '#e11d48', '#22c55e',
]

const EMOJI_OPTIONS = [
  '🛒', '🏠', '💊', '🎓', '🐕', '🎁', '✈️', '💼', '📱', '🍕',
  '☕', '🏋️', '🎮', '🎵', '📚', '👕', '💇', '🧹', '🚕', '⛽',
]

function AddCategoryModal({ open, onClose, onSave }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLOR_SWATCHES[0])
  const [emoji, setEmoji] = useState('')
  const [emojiInput, setEmojiInput] = useState('')

  function reset() { setName(''); setColor(COLOR_SWATCHES[0]); setEmoji(''); setEmojiInput('') }

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave({
      id: trimmed.toLowerCase().replace(/\s+/g, '-'),
      name: trimmed,
      color,
      emoji: emoji || null,
      icon: null,
      builtIn: false,
    })
    reset()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { reset(); onClose() }}>
      <div className="bg-navy-900 border border-navy-700/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-slide-in" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-4">New Category</h3>

        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Name</label>
            <input type="text" placeholder="e.g. Groceries" value={name} onChange={e => setName(e.target.value)}
              className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20 transition-all text-sm"
              autoFocus onKeyDown={e => { if (e.key === 'Enter') handleSave() }} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-lg transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-navy-900 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Emoji Icon</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} type="button" onClick={() => { setEmoji(e); setEmojiInput('') }}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${emoji === e ? 'bg-navy-700 ring-1 ring-gold-500 scale-110' : 'hover:bg-navy-800'}`}>
                  {e}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="text" placeholder="Or type any emoji" value={emojiInput} maxLength={2}
                onChange={e => { setEmojiInput(e.target.value); if (e.target.value) setEmoji(e.target.value) }}
                className="flex-1 bg-navy-950/50 border border-navy-700/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50" />
              {emoji && (
                <button type="button" onClick={() => { setEmoji(''); setEmojiInput('') }} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-navy-950/30 rounded-xl">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20' }}>
              {emoji ? <span className="text-lg">{emoji}</span> : <CircleDot className="w-5 h-5" style={{ color }} />}
            </div>
            <span className="text-sm font-medium text-white">{name || 'Preview'}</span>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-5">
          <button onClick={() => { reset(); onClose() }} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim()}
            className="px-5 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Add Category
          </button>
        </div>
      </div>
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
function FixedExpensesSection({ expenses, onUpdate, toast, monthKey }) {
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
          {(() => {
            const overdueCount = expenses.filter(e => !e.paid && isOverdue(e.dueDate, monthKey)).length
            return (
              <p className="text-sm text-slate-400 mt-1">
                Total: <span className="text-red-400 font-semibold">{fmt(total)}</span>
                {' · '}Paid: <span className="text-emerald-400 font-semibold">{fmt(paidTotal)}</span>
                {' · '}Pending: <span className="text-gold-400 font-semibold">{fmt(total - paidTotal)}</span>
                {overdueCount > 0 && <>{' · '}<span className="text-red-400 font-semibold">{overdueCount} Overdue</span></>}
              </p>
            )
          })()}
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
        {[...expenses].sort((a, b) => {
          if (a.paid !== b.paid) return a.paid ? 1 : -1
          const aOverdue = !a.paid && isOverdue(a.dueDate, monthKey)
          const bOverdue = !b.paid && isOverdue(b.dueDate, monthKey)
          if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
          return a.dueDate - b.dueDate
        }).map(e => {
          const isExpanded = expanded[e.id]
          const hasSubItems = e.subItems && e.subItems.length > 0
          const overdue = !e.paid && isOverdue(e.dueDate, monthKey)
          return (
            <div key={e.id} className={`border rounded-xl overflow-hidden transition-all animate-fade-in ${e.paid ? 'bg-emerald-950/20 border-emerald-500/20' : overdue ? 'bg-red-950/20 border-red-500/30' : 'bg-navy-950/50 border-navy-700/30'}`}>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full ${overdue ? 'bg-red-500/20 text-red-400' : 'bg-navy-800 text-slate-400'}`}>Due: {e.dueDate}{dueSuffix(e.dueDate)}</span>
                    {overdue && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Overdue</span>}
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
function DailyExpensesSection({ expenses, onUpdate, onAddExpenses, toast, monthKey, categories, onAddCategory }) {
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [filter, setFilter] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expanded, setExpanded] = useState({})
  const [showAddCategory, setShowAddCategory] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const defaultCatName = categories[0]?.name || 'Food'
  const [form, setForm] = useState({ title: '', description: '', amount: '', category: defaultCatName, date: today, paymentMethod: PAYMENT_METHODS[1], subItems: [] })
  const [subName, setSubName] = useState('')
  const [subAmount, setSubAmount] = useState('')

  function resetForm() {
    setShowForm(false); setEditId(null)
    setForm({ title: '', description: '', amount: '', category: defaultCatName, date: today, paymentMethod: PAYMENT_METHODS[1], subItems: [] })
    setSubName(''); setSubAmount('')
  }

  function startEdit(e) {
    setEditId(e.id)
    setForm({ title: e.title, description: e.description || '', amount: e.amount, category: e.category, date: e.date, paymentMethod: e.paymentMethod, subItems: [...(e.subItems || [])] })
    setShowForm(true)
  }

  function addSubItem() {
    if (!subName.trim() || !subAmount) return
    setForm(f => ({ ...f, subItems: [...f.subItems, { id: genId(), name: subName.trim(), amount: Number(subAmount) }] }))
    setSubName(''); setSubAmount('')
  }

  const hasSubItems = form.subItems.length > 0
  const subTotal = form.subItems.reduce((s, i) => s + Number(i.amount), 0)
  const effectiveAmount = hasSubItems ? subTotal : Number(form.amount)

  function handleSubmit(ev) {
    ev.preventDefault()
    if (!form.title.trim()) return toast('Please fill the title', 'error')
    if (!hasSubItems && !form.amount) return toast('Please fill the amount or add sub-items', 'error')
    if (hasSubItems && subTotal <= 0) return toast('Sub-items total must be greater than zero', 'error')
    const entry = {
      id: editId || genId(),
      title: form.title.trim(),
      description: form.description.trim(),
      amount: effectiveAmount,
      category: form.category,
      date: form.date,
      paymentMethod: form.paymentMethod,
      subItems: form.subItems
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
  if (filterCategory !== 'all') filtered = filtered.filter(e => e.category === filterCategory)
  if (searchTerm) filtered = filtered.filter(e => e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase()))
  filtered.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))

  const usedCategoryNames = new Set(expenses.map(e => e.category))
  const allCategoryNames = categories.map(c => c.name)
  const filterCategories = [...new Set([...allCategoryNames, ...usedCategoryNames])].sort()

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
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="bg-navy-950/50 border border-navy-700/30 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500/50 min-w-[130px]">
          <option value="all">All Categories</option>
          {filterCategories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
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
            const catColor = getCatColor(categories, e.category)
            const hasSubItems = e.subItems && e.subItems.length > 0
            const isExpanded = expanded[e.id]
            return (
              <div key={e.id} className="bg-navy-950/50 border border-navy-700/30 rounded-xl overflow-hidden group hover:border-gold-500/20 transition-colors">
                <div className="p-4 flex items-center gap-3">
                  {hasSubItems && (
                    <button onClick={() => setExpanded(p => ({ ...p, [e.id]: !p[e.id] }))} className="flex-shrink-0 text-slate-400 hover:text-white transition-colors">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  )}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: catColor + '20' }}>
                    <CategoryIcon category={e.category} categories={categories} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">{e.title}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-navy-800 text-slate-400">{e.category}</span>
                      <span>{e.paymentMethod}</span>
                      {hasSubItems && <span className="text-gold-400">{e.subItems.length} items</span>}
                      {e.description && <span>· {e.description}</span>}
                    </div>
                  </div>
                  <span className="font-bold text-red-400 flex-shrink-0">{fmt(e.amount)}</span>
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
      ))}

      <Modal open={showForm} onClose={resetForm} title={editId ? 'Edit Expense' : 'Add Daily Expense'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Title" placeholder="e.g. Lunch, ICICI Credit Card" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Input label="Description (optional)" placeholder="e.g. Office lunch with team" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Amount (₹) {hasSubItems && <span className="text-gold-400 normal-case">— auto-calculated from sub-items</span>}
              </label>
              <input
                type="number"
                placeholder="e.g. 250"
                value={hasSubItems ? subTotal : form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                disabled={hasSubItems}
                className={`bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20 transition-all text-sm ${hasSubItems ? 'opacity-60 cursor-not-allowed !text-gold-400 font-semibold' : ''}`}
              />
            </div>
            <CategorySelect label="Category" categories={categories} value={form.category}
              onChange={val => setForm(f => ({ ...f, category: val }))} onAddNew={() => setShowAddCategory(true)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <Select label="Payment Method" options={PAYMENT_METHODS} value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))} />
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
            {hasSubItems && (
              <div className="flex items-center justify-between text-sm pt-2 border-t border-navy-700/20">
                <span className="text-slate-400">Total Amount</span>
                <span className="text-gold-400 font-semibold">{fmt(subTotal)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold transition-colors">{editId ? 'Update' : 'Add Expense'}</button>
          </div>
        </form>
      </Modal>

      <AddCategoryModal open={showAddCategory} onClose={() => setShowAddCategory(false)} onSave={cat => { onAddCategory(cat); setForm(f => ({ ...f, category: cat.name })) }} />

    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD SECTION
// ══════════════════════════════════════════════════════════════════════
function DashboardSection({ monthData, monthKey, categories }) {
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
                  {pieData.map((entry, i) => <Cell key={i} fill={getCatColor(categories, entry.name)} />)}
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
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <span className="text-emerald-400">Paid: {fmt(paidFixed)}</span>
            <span className="text-red-400">Pending: {fmt(pendingFixed)}</span>
            {fixedExpenses.filter(e => !e.paid && isOverdue(e.dueDate, monthKey)).length > 0 &&
              <span className="text-red-400 font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{fixedExpenses.filter(e => !e.paid && isOverdue(e.dueDate, monthKey)).length} Overdue</span>}
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
              {upcomingBills.map(b => {
                const overdue = isOverdue(b.dueDate, monthKey)
                return (
                  <div key={b.id} className={`flex items-center justify-between text-sm py-1.5 px-2 rounded-lg ${overdue ? 'bg-red-500/10' : ''}`}>
                    <div className="flex items-center gap-2">
                      {overdue ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" /> : <Bell className="w-3.5 h-3.5 text-gold-400" />}
                      <span className="text-slate-300">{b.name}</span>
                      <span className={`text-xs ${overdue ? 'text-red-400 font-semibold' : 'text-slate-500'}`}>
                        {overdue ? 'Overdue' : `Due: ${b.dueDate}${dueSuffix(b.dueDate)}`}
                      </span>
                    </div>
                    <span className="font-medium text-red-400">{fmt(b.amount)}</span>
                  </div>
                )
              })}
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

  csv += '=== DAILY EXPENSES ===\nDate,Title,Description,Category,Amount,Payment Method,Sub-items\n'
  dailyExpenses.sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
    const subs = (e.subItems || []).map(s => `${s.name}: ₹${s.amount}`).join('; ')
    csv += `${e.date},"${e.title}","${e.description || ''}",${e.category},${e.amount},${e.paymentMethod},"${subs}"\n`
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
  sortedDaily.forEach(e => {
    const subs = (e.subItems || []).map(s => `${s.name}: ${s.amount}`).join('; ')
    sheetData.push([e.title, e.amount, subs, e.description || ''])
  })
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
  data[3] = ['Colaba Lunch', 1024, '', 'Team outing at Colaba']
  data[4] = ['Petrol', 300, '', '']
  data[5] = ['Eggs', 200, '', 'Weekly groceries']
  data[6] = ['ICICI Credit Card', 11482, 'Amazon: 4163; Speaker: 419; PUC: 125; Recharge: 889', 'Monthly CC bill', '', '', '', 'Rent', 23000, 5, '', '', 'Yes']
  data[7] = ['Shobha', 1000, '', 'Birthday gift', '', '', '', 'Car Loan', 8213, 9, '', '', 'No']
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
        { title: 'Colaba Lunch', description: 'Team outing at Colaba', amount: 1024, category: 'Food', date: `${mk}-08`, paymentMethod: 'UPI', subItems: [] },
        { title: 'Petrol', description: '', amount: 300, category: 'Transport', date: `${mk}-08`, paymentMethod: 'UPI', subItems: [] },
        { title: 'ICICI Credit Card', description: 'Monthly CC bill', amount: 11482, category: 'Bills', date: `${mk}-01`, paymentMethod: 'Card', subItems: [{ name: 'Amazon', amount: 4163 }, { name: 'Speaker', amount: 419 }, { name: 'PUC', amount: 125 }, { name: 'Recharge', amount: 889 }] },
        { title: 'Eggs', description: 'Weekly groceries', amount: 200, category: 'Food', date: `${mk}-08`, paymentMethod: 'Cash', subItems: [] }
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
            const subItemsRaw = String(cellVal(sheet, 'C', r) || '').trim()
            const subItems = subItemsRaw ? subItemsRaw.split(/[;,]/).map(s => {
              const match = s.trim().match(/^(.+?)\s*[:\-₹]\s*(\d+)$/)
              if (match) return { id: genId(), name: match[1].trim(), amount: Number(match[2]) }
              return s.trim() ? { id: genId(), name: s.trim(), amount: 0 } : null
            }).filter(Boolean) : []
            const description = String(cellVal(sheet, 'D', r) || '').trim()
            dailyExpenses.push({ title: String(title).trim(), amount: Number(amount), subItems, description })
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

function ImportModal({ open, onClose, onImport, onJsonImport, onUPIImport, onBankImport, toast, currentMonth, categories, onAddCategory, appData }) {
  const [mode, setMode] = useState('upi')
  const [file, setFile] = useState(null)
  const [parsed, setParsed] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dailyDate, setDailyDate] = useState('')
  const [dailyCategory, setDailyCategory] = useState('Other')
  const [dailyPayment, setDailyPayment] = useState('UPI')
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [jsonParsed, setJsonParsed] = useState(null)
  const [jsonError, setJsonError] = useState('')
  const fileInputRef = useRef(null)

  // Bank statement state
  const [bankFile, setBankFile] = useState(null)
  const [bankParsed, setBankParsed] = useState(null)
  const [bankLoading, setBankLoading] = useState(false)
  const [bankError, setBankError] = useState('')
  const [bankSelected, setBankSelected] = useState({})
  const [bankFilter, setBankFilter] = useState('paid')
  const [bankDuplicates, setBankDuplicates] = useState({})
  const [bankExcludeSelf, setBankExcludeSelf] = useState(true)
  const bankFileRef = useRef(null)

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
      setBankFile(null)
      setBankParsed(null)
      setBankLoading(false)
      setBankError('')
      setBankSelected({})
      setBankFilter('paid')
      setBankDuplicates({})
      setBankExcludeSelf(true)
    }
  }, [open, currentMonth])

  function reset() { setFile(null); setParsed(null); setLoading(false); setJsonText(''); setJsonParsed(null); setJsonError(''); setBankFile(null); setBankParsed(null); setBankLoading(false); setBankError(''); setBankSelected({}); setBankFilter('paid'); setBankDuplicates({}); setBankExcludeSelf(true) }

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
      id: genId(), title: e.title, description: e.description || '', amount: e.amount,
      category: dailyCategory, date: dailyDate, paymentMethod: dailyPayment,
      subItems: e.subItems || []
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

  async function handleBankFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setBankFile(f)
    setBankLoading(true)
    setBankError('')
    setBankParsed(null)
    setBankSelected({})
    setBankDuplicates({})
    try {
      const result = await parseBankStatement(f)
      setBankParsed(result)

      // Gather all existing daily expenses for duplicate checking
      const allExisting = []
      if (appData && typeof appData === 'object') {
        for (const monthData of Object.values(appData)) {
          if (monthData?.dailyExpenses) {
            for (const exp of monthData.dailyExpenses) {
              allExisting.push(exp)
            }
          }
        }
      }

      const dupes = {}
      const sel = {}
      result.transactions.forEach((t, i) => {
        const dupResult = checkDuplicate(t, allExisting)
        if (dupResult.status) {
          dupes[i] = dupResult.status
        } else if (t.type === 'paid' && !t.isSelfTransfer) {
          sel[i] = true
        }
      })
      setBankDuplicates(dupes)
      setBankSelected(sel)
    } catch (err) {
      setBankError(err.message || 'Failed to parse bank statement')
    }
    setBankLoading(false)
  }

  function toggleBankTxn(idx) {
    setBankSelected(prev => {
      const next = { ...prev }
      if (next[idx]) delete next[idx]
      else next[idx] = true
      return next
    })
  }

  function toggleAllFiltered() {
    if (!bankParsed) return
    const filtered = bankParsed.transactions
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => bankFilter === 'all' || t.type === bankFilter)
      .filter(({ t }) => !bankExcludeSelf || !t.isSelfTransfer)
    const allSelected = filtered.every(({ i }) => bankSelected[i])
    setBankSelected(prev => {
      const next = { ...prev }
      filtered.forEach(({ i }) => { allSelected ? delete next[i] : next[i] = true })
      return next
    })
  }

  function handleBankImport() {
    if (!bankParsed) return
    const selected = bankParsed.transactions.filter((_, i) => bankSelected[i])
    if (selected.length === 0) { toast('No transactions selected', 'error'); return }
    const expenses = selected.map(t => ({
      id: genId(),
      title: t.title,
      description: t.description,
      amount: t.amount,
      category: t.category,
      date: t.date,
      paymentMethod: t.paymentMethod,
      importRef: t.importRef,
      subItems: [],
    }))
    onBankImport(expenses)
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
          {[['upi', 'UPI Statement'], ['bank', 'Bank Statement'], ['excel', 'Excel File'], ['json', 'JSON Data']].map(([id, label]) => (
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
                  <p><span className="text-gold-400 font-medium">Col A-D, Row 4-50:</span> Daily expenses (Title, Amount, Sub-items, Description)</p>
                  <p><span className="text-gold-400 font-medium">Col H-M, Row 7-50:</span> Fixed expenses (Name, Amount, Due Date, Description, Sub-items, Paid?)</p>
                  <p className="text-slate-500 mt-1">Sub-items format: <span className="text-slate-400">Amazon: 4163; Speaker: 419</span> (semicolon-separated)</p>
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
                      <CategorySelect label="Category" categories={categories} value={dailyCategory}
                        onChange={val => setDailyCategory(val)} onAddNew={() => setShowAddCategory(true)} />
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
                    <div className="max-h-48 overflow-y-auto divide-y divide-navy-700/20">
                      {parsed.dailyExpenses.map((e, i) => (
                        <div key={i} className="px-4 py-2 text-sm">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-300">{e.title}</span>
                              {e.subItems?.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gold-500/15 text-gold-400">{e.subItems.length} items</span>}
                            </div>
                            <span className="text-red-400 font-medium">{fmt(e.amount)}</span>
                          </div>
                          {e.subItems?.length > 0 && (
                            <div className="mt-1 pl-3 border-l-2 border-navy-700/30 space-y-0.5">
                              {e.subItems.map((s, j) => (
                                <div key={j} className="flex items-center justify-between text-xs text-slate-500">
                                  <span>{s.name}</span>
                                  <span>{fmt(s.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
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
                            <span className="text-xs text-slate-500 ml-2">Due: {e.dueDate}{dueSuffix(e.dueDate)}</span>
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

        {/* ── BANK STATEMENT MODE ── */}
        {mode === 'bank' && (
          <div className="space-y-4">
            <div className="mb-1">
              <input ref={bankFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleBankFile} className="hidden" />
              <button onClick={() => bankFileRef.current?.click()}
                className={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors ${bankFile ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-navy-700/50 hover:border-gold-500/40 bg-navy-950/30'}`}>
                {bankLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-gold-400" />
                    <p className="text-slate-400">Parsing bank statement...</p>
                  </div>
                ) : bankFile ? (
                  <div>
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                    <p className="text-emerald-400 font-medium">{bankFile.name}</p>
                    {bankParsed && <p className="text-xs text-gold-400 mt-1">{bankParsed.bankName} Bank detected</p>}
                    <p className="text-xs text-slate-500 mt-1">Click to change file</p>
                  </div>
                ) : (
                  <div>
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                    <p className="text-slate-400 font-medium">Click to upload bank statement</p>
                    <p className="text-xs text-slate-500 mt-1">.xlsx, .xls, or .csv — HDFC, ICICI, Kotak</p>
                  </div>
                )}
              </button>
            </div>

            {bankError && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{bankError}</span>
              </div>
            )}

            {bankParsed && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-gold-500/10 border border-gold-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Bank</p>
                    <p className="text-sm font-bold text-gold-400">{bankParsed.bankName}</p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Transactions</p>
                    <p className="text-lg font-bold text-blue-400">{bankParsed.summary.totalTransactions}</p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Debits</p>
                    <p className="text-sm font-bold text-red-400">{fmt(bankParsed.summary.totalPaid)}</p>
                    <p className="text-[10px] text-slate-500">{bankParsed.summary.paidCount} txns</p>
                  </div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                    <p className="text-xs text-slate-400">Credits</p>
                    <p className="text-sm font-bold text-emerald-400">{fmt(bankParsed.summary.totalReceived)}</p>
                    <p className="text-[10px] text-slate-500">{bankParsed.summary.receivedCount} txns</p>
                  </div>
                </div>

                {bankParsed.summary.dateRange && (
                  <p className="text-xs text-slate-500 text-center">
                    {dayLabel(bankParsed.summary.dateRange.from)} — {dayLabel(bankParsed.summary.dateRange.to)}
                  </p>
                )}

                {bankParsed.summary.selfTransferCount > 0 && (
                  <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      <p className="text-xs text-purple-300">
                        <span className="font-semibold">{bankParsed.summary.selfTransferCount}</span> self-transfer{bankParsed.summary.selfTransferCount > 1 ? 's' : ''} detected
                      </p>
                    </div>
                    <div className="flex bg-navy-950/60 border border-navy-700/30 rounded-lg overflow-hidden flex-shrink-0">
                      <button onClick={() => {
                        setBankExcludeSelf(true)
                        setBankSelected(prev => {
                          const next = { ...prev }
                          bankParsed.transactions.forEach((t, i) => { if (t.isSelfTransfer) delete next[i] })
                          return next
                        })
                      }}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${bankExcludeSelf ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                        Exclude
                      </button>
                      <button onClick={() => {
                        setBankExcludeSelf(false)
                        setBankSelected(prev => {
                          const next = { ...prev }
                          bankParsed.transactions.forEach((t, i) => {
                            if (t.isSelfTransfer && !bankDuplicates[i] && t.type === 'paid') next[i] = true
                          })
                          return next
                        })
                      }}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${!bankExcludeSelf ? 'bg-purple-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                        Include
                      </button>
                    </div>
                  </div>
                )}

                {/* Filter + Select All */}
                <div className="flex items-center justify-between">
                  <div className="flex bg-navy-950/50 border border-navy-700/30 rounded-lg overflow-hidden">
                    {[['paid', 'Debits'], ['received', 'Credits'], ['all', 'All']].map(([id, label]) => (
                      <button key={id} onClick={() => setBankFilter(id)}
                        className={`px-3 py-1.5 text-xs font-medium transition-colors ${bankFilter === id ? 'bg-gold-500 text-navy-950' : 'text-slate-400 hover:text-white'}`}>{label}</button>
                    ))}
                  </div>
                  <button onClick={toggleAllFiltered} className="text-xs text-gold-400 hover:text-gold-300 font-medium transition-colors">
                    Toggle All
                  </button>
                </div>

                {/* Duplicate notice */}
                {Object.keys(bankDuplicates).length > 0 && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      {Object.values(bankDuplicates).filter(s => s === 'exact').length > 0 &&
                        `${Object.values(bankDuplicates).filter(s => s === 'exact').length} already imported`}
                      {Object.values(bankDuplicates).filter(s => s === 'exact').length > 0 &&
                        Object.values(bankDuplicates).filter(s => s === 'likely').length > 0 && ', '}
                      {Object.values(bankDuplicates).filter(s => s === 'likely').length > 0 &&
                        `${Object.values(bankDuplicates).filter(s => s === 'likely').length} likely duplicate${Object.values(bankDuplicates).filter(s => s === 'likely').length !== 1 ? 's' : ''}`}
                      {' '}— auto-deselected. You can still select them manually.
                    </span>
                  </div>
                )}

                {/* Transaction list */}
                <div className="border border-navy-700/30 rounded-xl overflow-hidden">
                  <div className="bg-navy-800/50 px-4 py-2 flex justify-between items-center">
                    <p className="text-xs font-medium text-slate-300">
                      {Object.keys(bankSelected).length} of {bankParsed.transactions.length} selected
                    </p>
                    <p className="text-xs font-semibold text-gold-400">
                      {fmt(bankParsed.transactions.filter((_, i) => bankSelected[i]).reduce((s, t) => s + t.amount, 0))}
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-navy-700/20">
                    {bankParsed.transactions
                      .map((t, i) => ({ t, i }))
                      .filter(({ t }) => bankFilter === 'all' || t.type === bankFilter)
                      .filter(({ t }) => !bankExcludeSelf || !t.isSelfTransfer)
                      .map(({ t, i }) => {
                        const dupStatus = bankDuplicates[i]
                        return (
                        <label key={i} className={`flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors ${dupStatus ? 'opacity-50' : ''} ${bankSelected[i] ? 'bg-navy-800/30' : 'hover:bg-navy-800/20'}`}>
                          <input type="checkbox" checked={!!bankSelected[i]} onChange={() => toggleBankTxn(i)}
                            className="w-4 h-4 rounded border-slate-600 text-gold-500 focus:ring-gold-500/30 bg-navy-950" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-slate-300 truncate">{t.title}</span>
                                {dupStatus === 'exact' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 flex-shrink-0">Duplicate</span>}
                                {dupStatus === 'likely' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 flex-shrink-0">Likely duplicate</span>}
                                {t.isSelfTransfer && !bankExcludeSelf && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 flex-shrink-0">Self Transfer</span>}
                              </div>
                              <span className={`font-medium flex-shrink-0 ${t.type === 'paid' ? 'text-red-400' : 'text-emerald-400'}`}>
                                {t.type === 'paid' ? '-' : '+'}{fmt(t.amount)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-slate-500">{dayLabel(t.date)}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-800 text-slate-400">{t.paymentMethod}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-800 text-gold-400/70">{t.category}</span>
                            </div>
                          </div>
                        </label>
                        )
                      })}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button onClick={() => { reset(); onClose() }} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors">Cancel</button>
                  <button onClick={handleBankImport} disabled={Object.keys(bankSelected).length === 0}
                    className="px-5 py-2 rounded-lg bg-gold-500 hover:bg-gold-400 text-navy-950 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    Import {Object.keys(bankSelected).length} Transaction{Object.keys(bankSelected).length !== 1 ? 's' : ''}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── UPI STATEMENT MODE ── */}
        {mode === 'upi' && (
          <UPIImportModal
            onImport={(expenses) => { onUPIImport(expenses); reset(); onClose() }}
            toast={toast}
            categories={categories}
            onAddCategory={onAddCategory}
            CategorySelect={CategorySelect}
            AddCategoryModal={AddCategoryModal}
          />
        )}
      </div>
      <AddCategoryModal open={showAddCategory} onClose={() => setShowAddCategory(false)} onSave={cat => { onAddCategory(cat); setDailyCategory(cat.name) }} />
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// PRIVACY POLICY PAGE
// ══════════════════════════════════════════════════════════════════════
function PrivacyPolicyPage() {
  const sections = [
    {
      title: 'Information We Collect',
      items: [
        'When you sign in with Google, we receive your name, email address, and profile picture from Google. This is used solely to identify your account.',
        'Your financial data (income members, fixed expenses, daily expenses) is entered by you and stored to provide the app\'s core functionality.',
      ]
    },
    {
      title: 'How Your Data is Stored',
      items: [
        'Signed in: Your data is stored in Google Cloud Firestore, tied to your Google account. It syncs in real-time across all your devices.',
        'Not signed in: Your data is stored only in your browser\'s localStorage. It never leaves your device.',
        'We do not store your data on any other servers or share it with any third parties.',
      ]
    },
    {
      title: 'Third-Party Services',
      items: [
        'Firebase Authentication (Google) — for sign-in only.',
        'Cloud Firestore — for cloud data storage when signed in.',
        'We do not use any analytics, advertising, or tracking services.',
      ]
    },
    {
      title: 'Data Deletion',
      items: [
        'Sign out to disconnect from cloud storage. Your local data remains on the device.',
        'To delete cloud data, you can clear your data from the app before signing out, or contact us to request account deletion.',
        'To delete local data, clear your browser\'s site data for this app.',
      ]
    },
    {
      title: 'Data Security',
      items: [
        'All data transmitted to and from Firestore is encrypted in transit using HTTPS/TLS.',
        'Firestore access is restricted by Firebase Security Rules — only you can read and write your own data.',
        'We do not have access to your financial data.',
      ]
    },
    {
      title: 'Changes to This Policy',
      items: [
        'We may update this privacy policy from time to time. Any changes will be reflected on this page.',
      ]
    },
  ]

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1"><Shield className="w-5 h-5 text-gold-400" /> Privacy Policy</h2>
        <p className="text-sm text-slate-400">Last updated: March 2026</p>
      </div>

      <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
        <p className="text-sm text-slate-300 leading-relaxed">
          Finance Tracker is a personal budgeting tool that respects your privacy. We collect only what is necessary to provide the app's functionality and give you full control over your data.
        </p>
      </div>

      {sections.map((section, i) => (
        <div key={i} className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">{section.title}</h3>
          <ul className="space-y-2">
            {section.items.map((item, j) => (
              <li key={j} className="flex gap-2.5 text-sm text-slate-400 leading-relaxed">
                <span className="text-gold-500 mt-1.5 flex-shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white mb-2">Contact</h3>
        <p className="text-sm text-slate-400">If you have any questions about this privacy policy or your data, please reach out to us.</p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// ABOUT PAGE
// ══════════════════════════════════════════════════════════════════════
function AboutPage() {
  const features = [
    { icon: Users, label: 'Income Members', desc: 'Track household earning members and monthly salaries' },
    { icon: CreditCard, label: 'Fixed Expenses', desc: 'Manage recurring bills like rent, EMIs, and insurance with sub-item breakdowns' },
    { icon: ShoppingCart, label: 'Daily Expenses', desc: 'Log day-to-day spending by category with sub-item support' },
    { icon: LayoutDashboard, label: 'Dashboard', desc: 'Visual overview with charts, budget progress, and savings tracking' },
    { icon: Upload, label: 'Import', desc: 'Bulk import from Excel files or JSON data' },
    { icon: Download, label: 'Export', desc: 'Download your data as CSV, Excel, or JSON' },
    { icon: Cloud, label: 'Cloud Sync', desc: 'Sign in with Google to sync across all your devices in real-time' },
    { icon: Calendar, label: 'Monthly Organization', desc: 'Each month has independent data with easy navigation and carry-over' },
  ]

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1"><Info className="w-5 h-5 text-gold-400" /> About</h2>
        <p className="text-sm text-slate-400">Finance Tracker v1.0.0</p>
      </div>

      <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl flex items-center justify-center">
            <Wallet className="w-6 h-6 text-navy-950" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Finance Tracker</h3>
            <p className="text-xs text-slate-400">Personal money manager for Indian households</p>
          </div>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          A comprehensive personal finance tracker built for managing household income, fixed monthly bills, and day-to-day expenses. Organize your finances month by month, visualize spending patterns, and keep your budget on track — all from your browser.
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-3 px-1">Features</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((f, i) => (
            <div key={i} className="bg-navy-950/50 border border-navy-700/30 rounded-xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-gold-500/10 flex items-center justify-center flex-shrink-0">
                <f.icon className="w-4.5 h-4.5 text-gold-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{f.label}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5 text-center">
        <p className="text-sm text-slate-400">Built with care for personal finance management.</p>
        <p className="text-xs text-slate-500 mt-1">Made in India</p>
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

const HAPTIC_SELECTORS = 'button, [role="button"], input[type="checkbox"], input[type="radio"], a, label'
function haptic(ms = 8) {
  try { navigator?.vibrate?.(ms) } catch {}
}

export default function App() {
  useEffect(() => {
    function onTap(e) {
      if (e.target.closest(HAPTIC_SELECTORS)) haptic()
    }
    document.addEventListener('pointerdown', onTap, { passive: true })
    return () => document.removeEventListener('pointerdown', onTap)
  }, [])

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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCarryOverConfirm, setShowCarryOverConfirm] = useState(false)
  const { toasts, toast, removeToast } = useToast()
  const [storageInfo, setStorageInfo] = useState(() => getStorageUsage())

  const [categories, setCategories] = useState(() => {
    const custom = loadCustomCategories()
    return [...DEFAULT_CATEGORIES, ...custom]
  })
  const skipNextCategoryUpdate = useRef(false)

  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState('offline')
  const skipNextFirestoreUpdate = useRef(false)
  const firestoreUnsub = useRef(null)
  const initialCloudLoadDone = useRef(false)
  const localTimestampRef = useRef(loadTimestamp())
  const isApplyingCloudData = useRef(false)
  const prevDataRef = useRef(data)

  const monthData = getMonthData(data, currentMonth)

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setAuthLoading(false)
    })
    return unsub
  }, [])

  // Reset cloud-load gate when app resumes from background so we
  // always pull the latest snapshot before allowing any local pushes.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && user) {
        initialCloudLoadDone.current = false
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user])

  // Firestore real-time listener — attach when signed in
  useEffect(() => {
    if (firestoreUnsub.current) { firestoreUnsub.current(); firestoreUnsub.current = null }
    if (!user) { setSyncStatus('offline'); initialCloudLoadDone.current = false; return }

    setSyncStatus('synced')
    const docRef = doc(db, 'users', user.uid)
    firestoreUnsub.current = onSnapshot(docRef, (snap) => {
      if (skipNextFirestoreUpdate.current) { skipNextFirestoreUpdate.current = false; initialCloudLoadDone.current = true; return }
      if (snap.exists()) {
        const snapData = snap.data()
        const cloudTs = snapData?.lastModified || 0
        const localTs = localTimestampRef.current
        const cloudData = snapData?.financeData
        if (cloudData && typeof cloudData === 'object' && cloudTs >= localTs) {
          const { data: migrated } = migrateExpensesToCorrectMonths(cloudData)
          isApplyingCloudData.current = true
          setData(migrated)
          saveData(migrated)
          localTimestampRef.current = cloudTs
          saveTimestamp(cloudTs)
          setSyncStatus('synced')
        }
        if (snapData?.categories && !skipNextCategoryUpdate.current) {
          const cloudCustom = snapData.categories.filter(c => !c.builtIn)
          saveCustomCategories(cloudCustom)
          setCategories([...DEFAULT_CATEGORIES, ...cloudCustom])
        }
        skipNextCategoryUpdate.current = false
      }
      initialCloudLoadDone.current = true
    }, () => { setSyncStatus('error'); initialCloudLoadDone.current = true })

    return () => { if (firestoreUnsub.current) { firestoreUnsub.current(); firestoreUnsub.current = null } }
  }, [user])

  // Save to localStorage + Firestore on data change
  useEffect(() => {
    const dataChanged = prevDataRef.current !== data
    prevDataRef.current = data

    if (!dataChanged) return

    saveData(data)
    setStorageInfo(getStorageUsage())

    if (isApplyingCloudData.current) {
      isApplyingCloudData.current = false
      return
    }

    const now = Date.now()
    localTimestampRef.current = now
    saveTimestamp(now)

    if (user && initialCloudLoadDone.current) {
      skipNextFirestoreUpdate.current = true
      setSyncing(true)
      const docRef = doc(db, 'users', user.uid)
      setDoc(docRef, { financeData: data, lastModified: now }, { merge: true })
        .then(() => { setSyncStatus('synced'); setSyncing(false) })
        .catch(() => { setSyncStatus('error'); setSyncing(false) })
    }
  }, [data, user])

  function addCategory(newCat) {
    if (findCategory(categories, newCat.id) || findCategory(categories, newCat.name)) return
    const updated = [...categories, newCat]
    setCategories(updated)
    const custom = updated.filter(c => !c.builtIn)
    saveCustomCategories(custom)
    if (user) {
      skipNextCategoryUpdate.current = true
      const docRef = doc(db, 'users', user.uid)
      const serializable = updated.map(({ icon, ...rest }) => rest)
      setDoc(docRef, { categories: serializable }, { merge: true }).catch(() => {})
    }
  }

  useEffect(() => {
    if (migrationInfo.moved > 0) toast(`Auto-fixed ${migrationInfo.moved} expense(s) moved to correct month`)
  }, [])

  async function handleSignIn() {
    try {
      setSyncing(true)
      skipNextFirestoreUpdate.current = true
      const result = await signInWithPopup(auth, googleProvider)
      const docRef = doc(db, 'users', result.user.uid)

      const cloudSnap = await getDoc(docRef)
      const cloudPayload = cloudSnap.exists() ? cloudSnap.data() : null
      const cloudTs = cloudPayload?.lastModified || 0
      const localTs = localTimestampRef.current

      const localData = loadData()
      const hasLocalData = Object.keys(localData).some(k => {
        const md = localData[k]
        return md.members?.length > 0 || md.fixedExpenses?.length > 0 || md.dailyExpenses?.length > 0
      })
      const localCustomCats = loadCustomCategories()

      if (cloudTs > localTs && cloudPayload?.financeData) {
        const { data: migrated } = migrateExpensesToCorrectMonths(cloudPayload.financeData)
        isApplyingCloudData.current = true
        setData(migrated)
        saveData(migrated)
        localTimestampRef.current = cloudTs
        saveTimestamp(cloudTs)
        if (cloudPayload?.categories) {
          const cloudCustom = cloudPayload.categories.filter(c => !c.builtIn)
          saveCustomCategories(cloudCustom)
          setCategories([...DEFAULT_CATEGORIES, ...cloudCustom])
        }
        toast(`Signed in as ${result.user.displayName} — cloud data loaded`)
      } else if (hasLocalData || localCustomCats.length > 0) {
        const now = Date.now()
        localTimestampRef.current = now
        saveTimestamp(now)
        const payload = { financeData: localData, lastModified: now }
        if (localCustomCats.length > 0) {
          payload.categories = [...DEFAULT_CATEGORIES, ...localCustomCats].map(({ icon, ...rest }) => rest)
        }
        await setDoc(docRef, payload, { merge: true })
        toast(`Signed in as ${result.user.displayName} — local data synced to cloud`)
      } else {
        toast(`Signed in as ${result.user.displayName}`)
      }
      setSyncing(false)
    } catch (err) {
      skipNextFirestoreUpdate.current = false
      if (err.code !== 'auth/popup-closed-by-user') toast('Sign-in failed: ' + err.message, 'error')
      setSyncing(false)
    }
  }

  async function handleSignOut() {
    try {
      await signOut(auth)
      setUser(null)
      setSyncStatus('offline')
      toast('Signed out — using local storage only')
    } catch (err) {
      toast('Sign-out failed: ' + err.message, 'error')
    }
  }

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

  function handleUPIImport(expenses) {
    if (!expenses || expenses.length === 0) return
    addDailyExpenses(expenses)
    const firstMonth = expenses[0].date.slice(0, 7)
    setCurrentMonth(firstMonth)
    setActiveTab('daily')
  }

  function handleBankStatementImport(expenses) {
    if (!expenses || expenses.length === 0) return
    addDailyExpenses(expenses)
    const firstMonth = expenses[0].date.slice(0, 7)
    setCurrentMonth(firstMonth)
    setActiveTab('daily')
    const months = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort()
    toast(`Bank statement imported: ${expenses.length} transaction${expenses.length !== 1 ? 's' : ''} across ${months.length} month${months.length !== 1 ? 's' : ''}`)
  }

  function changeMonth(delta) {
    const d = parseMonthKey(currentMonth)
    d.setMonth(d.getMonth() + delta)
    setCurrentMonth(getMonthKey(d))
  }

  function requestCarryOver() {
    const prevD = parseMonthKey(currentMonth)
    prevD.setMonth(prevD.getMonth() - 1)
    const prevKey = getMonthKey(prevD)
    const prevData = getMonthData(data, prevKey)
    if (prevData.fixedExpenses.length === 0) {
      return toast('No fixed expenses in previous month to carry over', 'error')
    }
    setShowCarryOverConfirm(true)
  }

  function confirmCarryOver() {
    const prevD = parseMonthKey(currentMonth)
    prevD.setMonth(prevD.getMonth() - 1)
    const prevKey = getMonthKey(prevD)
    const prevData = getMonthData(data, prevKey)
    const carried = prevData.fixedExpenses.map(e => ({
      ...e, id: genId(), paid: false
    }))
    updateMonth(currentMonth, 'fixedExpenses', [...monthData.fixedExpenses, ...carried])
    toast(`Carried over ${carried.length} fixed expenses from ${monthLabel(prevKey)}`)
    setShowCarryOverConfirm(false)
  }

  return (
    <div className="min-h-screen pb-24 md:pb-8">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <ConfirmDialog
        open={showCarryOverConfirm}
        title="Carry Over Fixed Expenses"
        message={`Are you sure you want to carry forward ${monthLabel(getMonthKey((() => { const d = parseMonthKey(currentMonth); d.setMonth(d.getMonth() - 1); return d })()))} fixed expenses to ${monthLabel(currentMonth)}? Paid status will be reset.`}
        confirmLabel="Yes, Carry Over"
        variant="warning"
        onConfirm={confirmCarryOver}
        onCancel={() => setShowCarryOverConfirm(false)}
      />
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={handleExcelImport}
        onJsonImport={handleJsonImport}
        onUPIImport={handleUPIImport}
        onBankImport={handleBankStatementImport}
        toast={toast}
        currentMonth={currentMonth}
        categories={categories}
        onAddCategory={addCategory}
        appData={data}
      />

      {/* Sidebar */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
        <aside className={`absolute top-0 left-0 h-full w-72 bg-navy-900 border-r border-navy-700/40 shadow-2xl flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Sidebar Header */}
          <div className="p-5 border-b border-navy-700/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-gold-400 to-gold-600 rounded-xl flex items-center justify-center">
                <Wallet className="w-5 h-5 text-navy-950" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">Finance Tracker</h2>
                <p className="text-[10px] text-slate-500">Personal money manager</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 rounded-lg bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-3 px-3">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Navigation</p>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSidebarOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-0.5 ${activeTab === tab.id ? 'bg-gold-500/15 text-gold-400' : 'text-slate-400 hover:bg-navy-800 hover:text-white'}`}>
                <tab.icon className="w-4.5 h-4.5" /> {tab.label}
              </button>
            ))}

            <div className="my-3 border-t border-navy-700/30" />
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Actions</p>

            <button onClick={() => { setShowImport(true); setSidebarOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors mb-0.5">
              <Upload className="w-4.5 h-4.5" /> Import Data
            </button>
            <button onClick={() => { exportToCSV(monthData, currentMonth); toast('CSV exported!'); setSidebarOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-navy-800 hover:text-white transition-colors mb-0.5">
              <FileText className="w-4.5 h-4.5 text-gold-400" /> Export CSV
            </button>
            <button onClick={() => { exportToExcel(monthData, currentMonth); toast('Excel exported!'); setSidebarOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-navy-800 hover:text-white transition-colors mb-0.5">
              <FileSpreadsheet className="w-4.5 h-4.5 text-emerald-400" /> Export Excel
            </button>
            <button onClick={() => { exportToJSON(data, currentMonth); toast('JSON exported!'); setSidebarOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-navy-800 hover:text-white transition-colors mb-0.5">
              <Database className="w-4.5 h-4.5 text-blue-400" /> Export JSON
            </button>
            <button onClick={() => { requestCarryOver(); setSidebarOpen(false) }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-navy-800 hover:text-white transition-colors mb-0.5">
              <Copy className="w-4.5 h-4.5" /> Carry Over Fixed
            </button>
          </nav>

          {/* Info section */}
          <nav className="px-3 pb-2">
            <p className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 border-t border-navy-700/30">Info</p>
            <button onClick={() => { setActiveTab('privacy'); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-0.5 ${activeTab === 'privacy' ? 'bg-gold-500/10 text-gold-400' : 'text-slate-400 hover:bg-navy-800 hover:text-white'}`}>
              <Shield className="w-4.5 h-4.5" /> Privacy Policy
            </button>
            <button onClick={() => { setActiveTab('about'); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors mb-0.5 ${activeTab === 'about' ? 'bg-gold-500/10 text-gold-400' : 'text-slate-400 hover:bg-navy-800 hover:text-white'}`}>
              <Info className="w-4.5 h-4.5" /> About
            </button>
          </nav>

          {/* Account & Sync */}
          <div className="p-4 border-t border-navy-700/30 bg-navy-950/30">
            {authLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
            ) : user ? (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gold-500/20 flex items-center justify-center text-gold-400 text-xs font-bold">{user.displayName?.[0] || '?'}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.displayName}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {syncing ? (
                      <><Loader2 className="w-3 h-3 text-gold-400 animate-spin" /><span className="text-[10px] text-gold-400">Syncing...</span></>
                    ) : syncStatus === 'synced' ? (
                      <><Cloud className="w-3 h-3 text-emerald-400" /><span className="text-[10px] text-emerald-400">Synced</span></>
                    ) : (
                      <><CloudOff className="w-3 h-3 text-red-400" /><span className="text-[10px] text-red-400">Sync error</span></>
                    )}
                  </div>
                  <button onClick={handleSignOut} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors">
                    <LogOut className="w-3 h-3" /> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={handleSignIn}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors border border-white/10">
                <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Sign in with Google
              </button>
            )}
          </div>

          {/* Storage Usage - only shown when not signed in (cloud storage handles persistence) */}
          {!user && (
            <div className="p-4 border-t border-navy-700/30 bg-navy-950/50">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-400">Local Storage</span>
              </div>
              <div className="h-2 bg-navy-800 rounded-full overflow-hidden mb-1.5">
                <div className={`h-full rounded-full transition-all duration-500 ${storageInfo.percent > 90 ? 'bg-red-500' : storageInfo.percent > 70 ? 'bg-gold-500' : 'bg-emerald-500'}`}
                  style={{ width: `${storageInfo.percent}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{storageInfo.usedMB} MB used</span>
                <span className="text-[10px] text-slate-500">{(storageInfo.limitMB - parseFloat(storageInfo.usedMB)).toFixed(2)} MB free</span>
              </div>
              <p className="text-[10px] text-slate-600 mt-0.5">{storageInfo.percent.toFixed(1)}% of {storageInfo.limitMB} MB</p>
            </div>
          )}
        </aside>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-navy-950/80 backdrop-blur-xl border-b border-navy-700/30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="w-9 h-9 rounded-xl bg-navy-800 hover:bg-navy-700 flex items-center justify-center transition-colors" title="Open menu">
              <Menu className="w-5 h-5 text-slate-300" />
            </button>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white leading-tight">Finance Tracker</h1>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-slate-500">Personal money manager</p>
                {user && (
                  syncing
                    ? <Loader2 className="w-3 h-3 text-gold-400 animate-spin" />
                    : syncStatus === 'synced'
                      ? <Cloud className="w-3 h-3 text-emerald-500" />
                      : <CloudOff className="w-3 h-3 text-red-400" />
                )}
              </div>
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
                      <Database className="w-4 h-4 text-blue-400" /> JSON
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
        {activeTab === 'dashboard' && <DashboardSection monthData={monthData} monthKey={currentMonth} categories={categories} />}
        {activeTab === 'members' && <MembersSection members={monthData.members} onUpdate={v => updateMonth(currentMonth, 'members', v)} toast={toast} />}
        {activeTab === 'fixed' && <FixedExpensesSection expenses={monthData.fixedExpenses} onUpdate={v => updateMonth(currentMonth, 'fixedExpenses', v)} toast={toast} monthKey={currentMonth} />}
        {activeTab === 'daily' && <DailyExpensesSection expenses={monthData.dailyExpenses} onUpdate={v => updateMonth(currentMonth, 'dailyExpenses', v)} onAddExpenses={addDailyExpenses} toast={toast} monthKey={currentMonth} categories={categories} onAddCategory={addCategory} />}
        {activeTab === 'privacy' && <PrivacyPolicyPage />}
        {activeTab === 'about' && <AboutPage />}
      </main>

      {/* Mobile Bottom Nav cmt */}
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
