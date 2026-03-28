'use client'

import { useEffect, useRef, useState } from 'react'
import { PlannedCourse, CourseStatus } from '@/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, GripVertical, X, Check, Clock, Ban, Minus } from 'lucide-react'
import { usePlanStore } from '@/store/plan'

interface CourseCardProps {
  plannedCourse: PlannedCourse
  termId: string
  onRemove?: () => void
  disabled?: boolean
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CourseStatus, {
  dot: string
  border: string
  bg: string
  icon: React.ReactNode
  label: string
}> = {
  planned: {
    dot: 'bg-gray-500',
    border: 'border-gray-700',
    bg: '',
    icon: <Minus className="h-3 w-3" />,
    label: 'Not Taken',
  },
  completed: {
    dot: 'bg-green-400',
    border: 'border-green-700/50',
    bg: 'bg-green-950/40',
    icon: <Check className="h-3 w-3" />,
    label: 'Completed',
  },
  inProgress: {
    dot: 'bg-amber-400',
    border: 'border-amber-700/50',
    bg: 'bg-amber-950/40',
    icon: <Clock className="h-3 w-3" />,
    label: 'In Progress',
  },
  failed: {
    dot: 'bg-red-500',
    border: 'border-red-700/50',
    bg: 'bg-red-950/40',
    icon: <Ban className="h-3 w-3" />,
    label: 'Failed',
  },
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number
  y: number
  current: CourseStatus
  onSelect: (s: CourseStatus) => void
  onClose: () => void
}

function ContextMenu({ x, y, current, onSelect, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    // Use mousedown so it fires before the next click
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Clamp to viewport
  const menuW = 152
  const menuH = 140
  const left = Math.min(x, window.innerWidth - menuW - 8)
  const top = Math.min(y, window.innerHeight - menuH - 8)

  const statuses: CourseStatus[] = ['completed', 'inProgress', 'planned', 'failed']

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 w-[152px]"
      onContextMenu={e => e.preventDefault()}
    >
      <div className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wider">Status</div>
      {statuses.map(s => {
        const cfg = STATUS_CONFIG[s]
        return (
          <button
            key={s}
            onClick={() => { onSelect(s); onClose() }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-gray-700 ${
              current === s ? 'text-white font-medium' : 'text-gray-300'
            }`}
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
            {cfg.label}
            {current === s && <Check className="h-3 w-3 ml-auto text-gray-400" />}
          </button>
        )
      })}
    </div>
  )
}

// ── CourseCard ────────────────────────────────────────────────────────────────

function RatingStars({ rating }: { rating: number }) {
  const filled = Math.round(rating * 5)
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`text-[10px] ${i < filled ? 'text-yellow-400' : 'text-gray-600'}`}>★</span>
      ))}
    </div>
  )
}

export default function CourseCard({ plannedCourse, termId, onRemove, disabled }: CourseCardProps) {
  const { course, satisfied, status } = plannedCourse
  const { setCourseStatus } = usePlanStore()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plannedCourse.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG['planned']

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        onContextMenu={handleContextMenu}
        className={`group flex items-start gap-1 border rounded-md px-2 py-1.5 text-sm hover:border-gray-500 transition-colors ${cfg.bg} ${cfg.border} bg-gray-800`}
      >
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {/* Status dot */}
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <span className="font-mono text-xs font-semibold text-blue-300">{course.code}</span>
            {!satisfied && status !== 'failed' && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <p className="text-xs">
                    Missing prereqs: <span className="font-semibold">{course.prereqs.join(', ')}</span>
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="text-gray-400 text-[11px] leading-tight truncate">{course.name}</p>
          {course.rating !== undefined && (
            <div className="mt-0.5">
              <RatingStars rating={course.rating} />
            </div>
          )}
        </div>

        {onRemove && (
          <button
            onClick={onRemove}
            className="mt-0.5 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          current={status}
          onSelect={s => setCourseStatus(termId, plannedCourse.id, s)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
