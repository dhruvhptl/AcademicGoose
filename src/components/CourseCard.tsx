'use client'

import { PlannedCourse } from '@/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AlertTriangle, GripVertical, X } from 'lucide-react'

interface CourseCardProps {
  plannedCourse: PlannedCourse
  onRemove?: () => void
  disabled?: boolean
}

function RatingStars({ rating }: { rating: number }) {
  const filled = Math.round(rating * 5)
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`text-[10px] ${i < filled ? 'text-yellow-400' : 'text-gray-600'}`}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default function CourseCard({ plannedCourse, onRemove, disabled }: CourseCardProps) {
  const { course, satisfied } = plannedCourse

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: plannedCourse.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }


  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-start gap-1 bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm hover:border-gray-500 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs font-semibold text-blue-300">{course.code}</span>
          {!satisfied && (
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="h-3 w-3 text-amber-400 flex-shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px]">
                <p className="text-xs">
                  Missing prereqs:{' '}
                  <span className="font-semibold">{course.prereqs.join(', ')}</span>
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
  )
}
