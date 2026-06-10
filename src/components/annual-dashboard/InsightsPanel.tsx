import { Lightbulb } from 'lucide-react'

interface InsightsPanelProps {
  insights: string[]
}

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  if (!insights.length) return null

  return (
    <div className="bg-navy-950/50 border border-navy-700/30 rounded-2xl p-5">
      <p className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-gold-400" />
        Insights
      </p>
      <ul className="space-y-2.5">
        {insights.map((insight, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-sm text-slate-300 bg-navy-900/40 rounded-lg px-3 py-2.5"
          >
            <span className="text-gold-400 mt-0.5">•</span>
            {insight}
          </li>
        ))}
      </ul>
    </div>
  )
}
