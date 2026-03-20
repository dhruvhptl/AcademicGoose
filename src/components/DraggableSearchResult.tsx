'use client'

import { Course } from '@/types'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

interface DraggableSearchResultProps {
  course: Course
}

function RatingBar({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full"
          style={{ width: `${rating * 100}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-400">{Math.round(rating * 100)}%</span>
    </div>
  )
}

export default function DraggableSearchResult({ course }: DraggableSearchResultProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `search-${course.code}`,
    data: { course, type: 'search-result' },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-1.5 bg-gray-800 border border-gray-700 rounded-md px-2 py-2 hover:border-gray-500 transition-colors cursor-grab active:cursor-grabbing"
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-0.5 text-gray-600 hover:text-gray-400 flex-shrink-0"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-xs font-semibold text-blue-300">{course.code}</div>
        <div className="text-gray-300 text-[11px] leading-tight mt-0.5 line-clamp-2">{course.name}</div>
        {course.rating !== undefined && (
          <div className="mt-1">
            <RatingBar rating={course.rating} />
          </div>
        )}
      </div>
    </div>
  )
}
