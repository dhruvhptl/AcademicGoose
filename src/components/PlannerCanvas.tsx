'use client'

import { useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import { usePlanStore } from '@/store/plan'
import { Course } from '@/types'
import { COURSE_PREREQS } from '@/store/plan'
import CourseSearchSidebar from './CourseSearchSidebar'
import TermCanvas from './TermCanvas'
import RequirementsSidebar from './RequirementsSidebar'

// Overlay card for dragging
function DragOverlayCard({ course }: { course: Course }) {
  return (
    <div className="bg-gray-800 border border-blue-500 rounded-md px-2 py-1.5 text-sm shadow-xl cursor-grabbing">
      <div className="font-mono text-xs font-semibold text-blue-300">{course.code}</div>
      <div className="text-gray-400 text-[11px]">{course.name}</div>
    </div>
  )
}

export default function PlannerCanvas() {
  const { plan, addCourse, moveCourse } = usePlanStore()
  const [activeCourse, setActiveCourse] = useState<Course | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  )

  const findTermByPlannedCourseId = (courseId: string) => {
    return plan.terms.find(t => t.courses.some(c => c.id === courseId))
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event

    // Check if it's a search result
    if (active.data.current?.type === 'search-result') {
      setActiveCourse(active.data.current.course)
      return
    }

    // It's a planned course being moved
    const term = findTermByPlannedCourseId(active.id as string)
    if (term) {
      const pc = term.courses.find(c => c.id === active.id)
      if (pc) setActiveCourse(pc.course)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCourse(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Determine target term
    let targetTermId: string | null = null
    let targetIndex: number | undefined

    // over is a term drop zone
    if (overId.startsWith('term-')) {
      targetTermId = overId.replace('term-', '')
    } else {
      // over is a planned course — find its term
      const overTerm = findTermByPlannedCourseId(overId)
      if (overTerm) {
        targetTermId = overTerm.id
        targetIndex = overTerm.courses.findIndex(c => c.id === overId)
      }
    }

    if (!targetTermId) return

    const targetTerm = plan.terms.find(t => t.id === targetTermId)
    if (!targetTerm || targetTerm.type !== 'study') return

    // Source is search result
    if (active.data.current?.type === 'search-result') {
      const course: Course = active.data.current.course
      // Enrich with known prereqs
      const enriched: Course = {
        ...course,
        prereqs: COURSE_PREREQS[course.code] ?? course.prereqs ?? [],
      }
      addCourse(targetTermId, enriched)
      return
    }

    // Source is an existing planned course
    const sourceTerm = findTermByPlannedCourseId(activeId)
    if (!sourceTerm) return

    if (sourceTerm.id === targetTermId) {
      // Reordering within same term
      const oldIndex = sourceTerm.courses.findIndex(c => c.id === activeId)
      if (oldIndex !== -1 && targetIndex !== undefined && oldIndex !== targetIndex) {
        moveCourse(sourceTerm.id, targetTermId, activeId, targetIndex)
      }
    } else {
      // Moving between terms
      moveCourse(sourceTerm.id, targetTermId, activeId, targetIndex)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full overflow-hidden">
        <CourseSearchSidebar />
        <TermCanvas />
        <RequirementsSidebar />
      </div>

      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.4' } },
          }),
        }}
      >
        {activeCourse && <DragOverlayCard course={activeCourse} />}
      </DragOverlay>
    </DndContext>
  )
}
