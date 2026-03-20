'use client'

import { usePlanStore } from '@/store/plan'
import TermColumn from './TermColumn'
import AddTermDialog from './AddTermDialog'

export default function TermCanvas() {
  const { plan } = usePlanStore()

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden min-w-0">
      <div className="flex gap-3 p-4 h-full items-start min-w-max">
        {plan.terms.map(term => (
          <TermColumn key={term.id} term={term} />
        ))}
        <AddTermDialog />
      </div>
    </div>
  )
}
