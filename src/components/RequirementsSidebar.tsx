'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { usePlanStore } from '@/store/plan'
import { CourseStatus, RequirementGroup } from '@/types'
import { normalizeCode } from '@/lib/uwflow'
import { ChevronDown, ChevronRight, ChevronLeft, Loader2, Plus, ClipboardPaste, X } from 'lucide-react'

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

const STATUS_DOT: Record<CourseStatus, string> = {
  completed:  'bg-green-400',
  inProgress: 'bg-amber-400',
  planned:    'bg-gray-500',
  failed:     'bg-red-500',
}

const STATUS_TEXT: Record<CourseStatus, string> = {
  completed:  'text-green-400',
  inProgress: 'text-amber-400',
  planned:    'text-gray-500',
  failed:     'text-red-400',
}

function RequirementGroupItem({
  group,
  courseStatusMap,
}: {
  group: RequirementGroup
  courseStatusMap: Map<string, CourseStatus>
}) {
  const [expanded, setExpanded] = useState(false)
  // Only completed courses count toward progress
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
            const status = courseStatusMap.get(normalizeCode(code))
            const dotClass = status ? STATUS_DOT[status] : 'bg-gray-700'
            const textClass = status ? STATUS_TEXT[status] : 'text-gray-600'
            return (
              <div
                key={code}
                className={`flex items-center gap-1.5 text-[10px] py-0.5 ${textClass}`}
              >
                <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
                <span className="font-mono">{code}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Paste Modal ──────────────────────────────────────────────────────────────

interface PasteModalProps {
  onClose: () => void
  onSubmit: (text: string) => void
  loading: boolean
  error: string | null
}

function PasteModal({ onClose, onSubmit, loading, error }: PasteModalProps) {
  const [text, setText] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on overlay click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (e.target === overlayRef.current) onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[640px] max-w-[95vw] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <ClipboardPaste className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-gray-100">Import Program Requirements</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-xs text-gray-400">
            Copy the requirements section from the{' '}
            <span className="text-blue-400">UWaterloo Undergraduate Calendar</span>{' '}
            and paste it below. Claude will extract the course requirements automatically.
          </p>
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste your program requirements text here…

Example:
Core Courses (all required):
  PHYS 121 Mechanics
  PHYS 122 Waves, Electricity and Magnetism
  MATH 127 Calculus 1 for the Sciences
  ...

Electives (choose 2 of):
  PHYS 345 Quantum Mechanics 1
  PHYS 363 Statistical Mechanics
  ..."
            className="w-full h-64 bg-gray-800 border border-gray-700 focus:border-blue-500 rounded-lg px-3 py-2.5 text-xs text-gray-200 placeholder:text-gray-600 outline-none resize-none font-mono transition-colors"
          />
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/50 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700">
          <span className="text-[10px] text-gray-600">
            {text.length > 0 ? `${text.length.toLocaleString()} characters` : 'No text pasted yet'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(text)}
              disabled={!text.trim() || loading}
              className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-4 py-1.5 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Parsing…
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3" />
                  Parse Requirements
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export default function RequirementsSidebar() {
  const { plan, updateRequirements } = usePlanStore()
  const [collapsed, setCollapsed] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build normalized code → status map from all study terms
  const courseStatusMap = useMemo(() => {
    const map = new Map<string, CourseStatus>()
    plan.terms.forEach(term => {
      if (term.type === 'study') {
        term.courses.forEach(pc => map.set(normalizeCode(pc.course.code), pc.status))
      }
    })
    return map
  }, [plan.terms])

  const totalRequired = plan.requirementGroups.reduce((sum, g) => sum + g.required, 0)
  // Only completed-status courses count toward overall progress
  const totalCompleted = plan.requirementGroups.reduce(
    (sum, g) => sum + Math.min(g.completed.length, g.required),
    0
  )
  const overallProgress = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0

  const handleSubmit = async (text: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/parse-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to parse requirements')
      }

      updateRequirements(data.requirements)
      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (collapsed) {
    return (
      <aside className="w-10 flex-shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Expand requirements"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-gray-600" style={{ writingMode: 'vertical-rl', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
          Requirements
        </div>
        <div className="mt-auto text-[10px] font-mono text-gray-600">
          {plan.requirementGroups.reduce((s, g) => s + Math.min(g.completed.length, g.required), 0)}/
          {plan.requirementGroups.reduce((s, g) => s + g.required, 0)}
        </div>
      </aside>
    )
  }

  return (
    <>
      {modalOpen && (
        <PasteModal
          onClose={() => { setModalOpen(false); setError(null) }}
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
        />
      )}

      <aside className="w-[280px] flex-shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col h-full">
        <div className="p-3 border-b border-gray-700">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-100">Requirements</h2>
            <button
              onClick={() => setCollapsed(true)}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Overall progress</span>
            <span className="font-mono">{totalCompleted}/{totalRequired}</span>
          </div>
          <ProgressBar value={overallProgress} className="h-2 mt-1.5" />
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {plan.requirementGroups.map(group => (
            <RequirementGroupItem key={group.id} group={group} courseStatusMap={courseStatusMap} />
          ))}
        </div>

        {/* Import button */}
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={() => { setModalOpen(true); setError(null) }}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 rounded-md py-2 transition-colors"
          >
            <ClipboardPaste className="h-3 w-3" />
            Import from Calendar
          </button>
        </div>
      </aside>
    </>
  )
}
