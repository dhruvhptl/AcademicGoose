'use client'

import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { usePlanStore } from '@/store/plan'
import TermColumn from './TermColumn'
import AddTermDialog from './AddTermDialog'

export default function TermCanvas() {
  const { plan } = usePlanStore()
  // Must match the id passed to useSortable inside TermColumn
  const sortableIds = plan.terms.map(t => `sortable-term-${t.id}`)

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0">
      <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
        <div className="flex gap-3 p-4 h-full items-start min-w-max">
          {plan.terms.map(term => (
            <TermColumn key={term.id} term={term} />
          ))}
          <AddTermDialog />
        </div>
      </SortableContext>
    </div>
  )
}
