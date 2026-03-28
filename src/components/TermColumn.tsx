'use client'

import { useState, useRef, useEffect } from 'react'
import { Term, TermType, Season } from '@/types'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import CourseCard from './CourseCard'
import { usePlanStore } from '@/store/plan'
import {
  MoreHorizontal, Briefcase, BookOpen, Coffee, GripVertical, X, Check,
} from 'lucide-react'

interface TermColumnProps {
  term: Term
}

const TYPE_CONFIG: Record<TermType, { label: string; color: string; icon: React.ReactNode }> = {
  study: {
    label: 'Study',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: <BookOpen className="h-3 w-3" />,
  },
  coop: {
    label: 'Co-op',
    color: 'bg-green-500/20 text-green-300 border-green-500/30',
    icon: <Briefcase className="h-3 w-3" />,
  },
  off: {
    label: 'Off',
    color: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    icon: <Coffee className="h-3 w-3" />,
  },
}

const BORDER_COLOR: Record<TermType, string> = {
  study: 'border-blue-500/20',
  coop: 'border-green-500/20',
  off: 'border-slate-500/20',
}

const HEADER_BG: Record<TermType, string> = {
  study: 'bg-blue-500/5',
  coop: 'bg-green-500/5',
  off: 'bg-slate-500/5',
}

const SEASONS: Season[] = ['Fall', 'Winter', 'Spring']
const YEARS = Array.from({ length: 15 }, (_, i) => 2020 + i)

// ── Edit popover ──────────────────────────────────────────────────────────────

interface EditPopoverProps {
  term: Term
  onClose: () => void
}

function EditPopover({ term, onClose }: EditPopoverProps) {
  const { renameTerm, changeTermType, updateTerm, removeTerm } = usePlanStore()
  const [label, setLabel] = useState(term.label)
  const [season, setSeason] = useState<Season>(term.season)
  const [year, setYear] = useState(term.year)
  const [type, setType] = useState<TermType>(term.type)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function handleSave() {
    if (label.trim()) renameTerm(term.id, label.trim())
    updateTerm(term.id, { season, year })
    if (type !== term.type) changeTermType(term.id, type)
    onClose()
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-8 z-30 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 w-[210px] space-y-3"
      // Prevent drag-handle mousedown from bleeding through
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-200">Edit term</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Label */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Label</label>
        <input
          autoFocus
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          className="w-full bg-gray-700 text-sm text-gray-100 rounded px-2 py-1 outline-none border border-gray-600 focus:border-blue-500"
        />
      </div>

      {/* Type */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Type</label>
        <div className="flex gap-1">
          {(['study', 'coop', 'off'] as TermType[]).map(t => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-1 rounded text-[10px] font-medium border transition-colors ${
                type === t
                  ? TYPE_CONFIG[t].color
                  : 'border-gray-600 text-gray-500 hover:text-gray-300'
              }`}
            >
              {TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Season */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Season</label>
        <select
          value={season}
          onChange={e => setSeason(e.target.value as Season)}
          className="w-full bg-gray-700 text-sm text-gray-100 rounded px-2 py-1 outline-none border border-gray-600 focus:border-blue-500"
        >
          {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Year */}
      <div>
        <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Year</label>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="w-full bg-gray-700 text-sm text-gray-100 rounded px-2 py-1 outline-none border border-gray-600 focus:border-blue-500"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded py-1.5 transition-colors"
        >
          <Check className="h-3 w-3" /> Save
        </button>
        <button
          onClick={() => { removeTerm(term.id); onClose() }}
          className="px-2 py-1.5 text-xs text-red-400 hover:bg-gray-700 rounded transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ── Main TermColumn ───────────────────────────────────────────────────────────

export default function TermColumn({ term }: TermColumnProps) {
  const { changeTermType, removeCourse, updateTerm, setCurrentTerm } = usePlanStore()
  const [editOpen, setEditOpen] = useState(false)
  const [currentTermOpen, setCurrentTermOpen] = useState(false)
  const currentTermRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!currentTermOpen) return
    function handler(e: MouseEvent) {
      if (currentTermRef.current && !currentTermRef.current.contains(e.target as Node)) {
        setCurrentTermOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [currentTermOpen])

  // Sortable — for dragging the whole column to reorder terms
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sortable-term-${term.id}`, data: { type: 'term-column' } })

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  // Droppable — for courses dropped into this term
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `term-${term.id}`,
    data: { termId: term.id, type: 'term' },
  })

  return (
    <div
      ref={setSortableRef}
      style={sortableStyle}
      className={`flex-shrink-0 w-[200px] flex flex-col rounded-lg border ${BORDER_COLOR[term.type]} bg-gray-900 overflow-visible`}
    >
      {/* Header */}
      <div className={`${HEADER_BG[term.type]} px-2 pt-2 pb-1.5 border-b ${BORDER_COLOR[term.type]} rounded-t-lg`}>
        {/* Top row: drag handle + label + menu */}
        <div className="flex items-center gap-1">
          <button
            {...attributes}
            {...listeners}
            className="text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
            title="Drag to reorder"
            // Stop propagation so the popover's onMouseDown doesn't interfere
            onMouseDown={e => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          <div className="flex-1 min-w-0 relative" ref={currentTermRef}>
            <button
              onClick={() => term.type === 'study' && setCurrentTermOpen(v => !v)}
              className={`text-left w-full ${term.type === 'study' ? 'hover:opacity-80' : ''}`}
              title={term.type === 'study' ? 'Click to set as current term' : undefined}
            >
              <div className="font-semibold text-sm text-gray-100 truncate">{term.label}</div>
              <div className="text-[10px] text-gray-500">{term.season} {term.year}</div>
            </button>
            {currentTermOpen && (
              <div
                className="absolute left-0 top-full mt-1 z-30 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-2 w-[172px]"
                onMouseDown={e => e.stopPropagation()}
              >
                <p className="text-[10px] text-gray-400 mb-2 leading-tight">
                  Mark previous terms as completed, this term as in progress.
                </p>
                <button
                  onClick={() => { setCurrentTerm(term.id); setCurrentTermOpen(false) }}
                  className="w-full text-xs bg-blue-600 hover:bg-blue-500 text-white rounded py-1.5 transition-colors"
                >
                  Set as current term
                </button>
              </div>
            )}
          </div>

          <div className="relative flex-shrink-0">
            <button
              onClick={() => setEditOpen(v => !v)}
              className="text-gray-500 hover:text-gray-300 transition-colors p-0.5 rounded"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {editOpen && <EditPopover term={term} onClose={() => setEditOpen(false)} />}
          </div>
        </div>

        {/* Inline type switcher */}
        <div className="flex gap-1 mt-2">
          {(['study', 'coop', 'off'] as TermType[]).map(t => (
            <button
              key={t}
              onClick={() => changeTermType(term.id, t)}
              className={`flex-1 flex items-center justify-center gap-0.5 py-0.5 rounded text-[9px] font-medium border transition-colors ${
                term.type === t
                  ? TYPE_CONFIG[t].color
                  : 'border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-600'
              }`}
            >
              {TYPE_CONFIG[t].icon}
              {TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-2">
        {term.type === 'study' && (
          <SortableContext
            items={term.courses.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              ref={setDropRef}
              className={`flex-1 min-h-[80px] space-y-1.5 rounded-md transition-colors ${
                isOver ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : ''
              }`}
            >
              {term.courses.map(pc => (
                <CourseCard
                  key={pc.id}
                  plannedCourse={pc}
                  termId={term.id}
                  onRemove={() => removeCourse(term.id, pc.id)}
                />
              ))}
              {term.courses.length === 0 && !isOver && (
                <div className="text-xs text-gray-600 text-center py-4 border border-dashed border-gray-700 rounded-md">
                  Drop courses here
                </div>
              )}
              {isOver && term.courses.length === 0 && (
                <div className="h-12 rounded-md bg-blue-500/20 border border-dashed border-blue-500/50" />
              )}
            </div>
          </SortableContext>
        )}

        {term.type === 'coop' && (
          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Company</label>
              <input
                value={term.coopCompany ?? ''}
                onChange={e => updateTerm(term.id, { coopCompany: e.target.value })}
                placeholder="e.g. Google"
                className="w-full bg-transparent text-sm text-gray-200 placeholder:text-gray-600 outline-none border-b border-gray-700 focus:border-green-500 py-0.5 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase tracking-wider">Role</label>
              <input
                value={term.coopRole ?? ''}
                onChange={e => updateTerm(term.id, { coopRole: e.target.value })}
                placeholder="e.g. Software Engineer"
                className="w-full bg-transparent text-sm text-gray-200 placeholder:text-gray-600 outline-none border-b border-gray-700 focus:border-green-500 py-0.5 transition-colors"
              />
            </div>
          </div>
        )}

        {term.type === 'off' && (
          <div className="text-xs text-gray-600 text-center py-4">Off term — no courses</div>
        )}
      </div>

      {term.type === 'study' && term.courses.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800 text-[10px] text-gray-500 rounded-b-lg">
          {term.courses.length} course{term.courses.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
