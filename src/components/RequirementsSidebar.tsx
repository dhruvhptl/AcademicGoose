'use client'

import { useState } from 'react'
import { usePlanStore } from '@/store/plan'
import { RequirementGroup } from '@/types'
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Plus } from 'lucide-react'

// Simple inline progress bar to avoid shadcn version API differences
function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={`w-full bg-gray-700 rounded-full overflow-hidden ${className ?? 'h-1.5'}`}>
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

function RequirementGroupItem({ group }: { group: RequirementGroup }) {
  const [expanded, setExpanded] = useState(false)
  const completedCount = Math.min(group.completed.length, group.required)
  const progress = group.required > 0 ? (completedCount / group.required) * 100 : 0

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-start gap-1.5"
      >
        {expanded
          ? <ChevronDown className="h-3 w-3 text-gray-500 mt-0.5 flex-shrink-0" />
          : <ChevronRight className="h-3 w-3 text-gray-500 mt-0.5 flex-shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-medium text-gray-200 truncate">{group.name}</span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">
              {completedCount}/{group.required}
            </span>
          </div>
          <ProgressBar value={progress} className="h-1.5 mt-1" />
        </div>
      </button>

      {expanded && (
        <div className="ml-4 pl-2 border-l border-gray-700 space-y-0.5">
          {group.description && (
            <p className="text-[10px] text-gray-500 mb-1">{group.description}</p>
          )}
          {group.courses.map(code => {
            const isCompleted = group.completed.includes(code)
            return (
              <div
                key={code}
                className={`flex items-center gap-1.5 text-[10px] py-0.5 ${
                  isCompleted ? 'text-green-400' : 'text-gray-500'
                }`}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    isCompleted ? 'bg-green-400' : 'bg-gray-600'
                  }`}
                />
                <span className="font-mono">{code}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function RequirementsSidebar() {
  const { plan, updateRequirements } = usePlanStore()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalRequired = plan.requirementGroups.reduce((sum, g) => sum + g.required, 0)
  const totalCompleted = plan.requirementGroups.reduce(
    (sum, g) => sum + Math.min(g.completed.length, g.required),
    0
  )
  const overallProgress = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0

  const handleParseRequirements = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/parse-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to parse requirements')
      }

      updateRequirements(data.requirements)
      setUrl('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="w-[280px] flex-shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100 mb-1">Requirements</h2>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Overall progress</span>
          <span className="font-mono">{totalCompleted}/{totalRequired}</span>
        </div>
        <ProgressBar value={overallProgress} className="h-2 mt-1.5" />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {plan.requirementGroups.map(group => (
          <RequirementGroupItem key={group.id} group={group} />
        ))}
      </div>

      {/* Parse Requirements from URL */}
      <div className="p-3 border-t border-gray-700 space-y-2">
        <div className="flex items-center gap-1.5">
          <ExternalLink className="h-3 w-3 text-gray-500" />
          <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
            Import from UW Calendar
          </span>
        </div>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="ugradcalendar.uwaterloo.ca/..."
          className="w-full bg-gray-800 text-xs text-gray-200 placeholder:text-gray-600 outline-none border border-gray-700 focus:border-blue-500 rounded px-2 py-1.5 transition-colors"
        />
        {error && <p className="text-[10px] text-red-400">{error}</p>}
        <button
          onClick={handleParseRequirements}
          disabled={!url.trim() || loading}
          className="w-full flex items-center justify-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded py-1.5 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Parsing...
            </>
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Parse Requirements
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
