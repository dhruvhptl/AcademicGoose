'use client'

import { useState } from 'react'
import { Term, TermType } from '@/types'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import CourseCard from './CourseCard'
import { usePlanStore } from '@/store/plan'
import { MoreHorizontal, Briefcase, BookOpen, Coffee, Pencil, Check } from 'lucide-react'

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

export default function TermColumn({ term }: TermColumnProps) {
  const { removeTerm, updateTerm, removeCourse, renameTerm, changeTermType } = usePlanStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelValue, setLabelValue] = useState(term.label)

  const { setNodeRef, isOver } = useDroppable({
    id: `term-${term.id}`,
    data: { termId: term.id, type: 'term' },
  })

  const typeConfig = TYPE_CONFIG[term.type]
  const borderColor = BORDER_COLOR[term.type]
  const headerBg = HEADER_BG[term.type]

  const handleLabelSave = () => {
    if (labelValue.trim()) {
      renameTerm(term.id, labelValue.trim())
    } else {
      setLabelValue(term.label)
    }
    setEditingLabel(false)
  }

  return (
    <div
      className={`flex-shrink-0 w-[200px] flex flex-col rounded-lg border ${borderColor} bg-gray-900 overflow-hidden`}
    >
      {/* Header */}
      <div className={`${headerBg} p-3 border-b ${borderColor}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {editingLabel ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={labelValue}
                  onChange={e => setLabelValue(e.target.value)}
                  onBlur={handleLabelSave}
                  onKeyDown={e => { if (e.key === 'Enter') handleLabelSave() }}
                  className="bg-gray-700 text-white text-sm font-semibold rounded px-1 py-0.5 w-full outline-none border border-blue-500"
                />
                <button onClick={handleLabelSave} className="text-green-400">
                  <Check className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingLabel(true)}
                className="group flex items-center gap-1 text-left"
              >
                <span className="font-semibold text-sm text-gray-100">{term.label}</span>
                <Pencil className="h-2.5 w-2.5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <div className="text-xs text-gray-400 mt-0.5">{term.season} {term.year}</div>
          </div>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-gray-500 hover:text-gray-300 transition-colors p-0.5 rounded"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-6 z-20 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 min-w-[140px]">
                  <div className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wider">Change type</div>
                  {(['study', 'coop', 'off'] as TermType[]).map(t => (
                    <button
                      key={t}
                      onClick={() => { changeTermType(term.id, t); setMenuOpen(false) }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-700 transition-colors ${term.type === t ? 'text-blue-400' : 'text-gray-300'}`}
                    >
                      {TYPE_CONFIG[t].label}
                    </button>
                  ))}
                  <div className="border-t border-gray-700 mt-1 pt-1">
                    <button
                      onClick={() => { removeTerm(term.id); setMenuOpen(false) }}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700 transition-colors"
                    >
                      Delete term
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={`inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded text-[10px] border ${typeConfig.color}`}>
          {typeConfig.icon}
          {typeConfig.label}
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
              ref={setNodeRef}
              className={`flex-1 min-h-[80px] space-y-1.5 rounded-md transition-colors ${
                isOver ? 'bg-blue-500/10 ring-1 ring-blue-500/30' : ''
              }`}
            >
              {term.courses.map(pc => (
                <CourseCard
                  key={pc.id}
                  plannedCourse={pc}
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
          <div className="text-xs text-gray-600 text-center py-4">
            Off term — no courses
          </div>
        )}
      </div>

      {/* Course count for study terms */}
      {term.type === 'study' && term.courses.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-800 text-[10px] text-gray-500">
          {term.courses.length} course{term.courses.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
