import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatFYLabel } from '../../utils/financeYear'

interface FinancialYearSelectorProps {
  fyStartYear: number
  availableFYs: { startYear: number; label: string }[]
  onChange: (startYear: number) => void
  onPrevious: () => void
  onNext: () => void
  canGoPrevious: boolean
  canGoNext: boolean
}

export default function FinancialYearSelector({
  fyStartYear,
  availableFYs,
  onChange,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: FinancialYearSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="w-9 h-9 rounded-lg bg-navy-800 hover:bg-navy-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        title="Previous financial year"
      >
        <ChevronLeft className="w-4 h-4 text-slate-300" />
      </button>

      <div className="flex flex-col gap-1.5 min-w-[180px]">
        <select
          value={fyStartYear}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          className="bg-navy-950/50 border border-navy-700/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-gold-500/50 focus:ring-1 focus:ring-gold-500/20 transition-all text-sm"
        >
          {availableFYs.map(fy => (
            <option key={fy.startYear} value={fy.startYear}>
              {fy.label}
            </option>
          ))}
          {!availableFYs.some(f => f.startYear === fyStartYear) && (
            <option value={fyStartYear}>{formatFYLabel(fyStartYear)}</option>
          )}
        </select>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className="w-9 h-9 rounded-lg bg-navy-800 hover:bg-navy-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        title="Next financial year"
      >
        <ChevronRight className="w-4 h-4 text-slate-300" />
      </button>
    </div>
  )
}
