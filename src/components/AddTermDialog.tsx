'use client'

import { useState } from 'react'
import { Season, TermType } from '@/types'
import { usePlanStore } from '@/store/plan'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const SEASONS: Season[] = ['Fall', 'Winter', 'Spring']
const TYPES: { value: TermType; label: string }[] = [
  { value: 'study', label: 'Study' },
  { value: 'coop', label: 'Co-op' },
  { value: 'off', label: 'Off' },
]

export default function AddTermDialog() {
  const { addTerm, plan } = usePlanStore()
  const [open, setOpen] = useState(false)

  // Derive sensible defaults from last term
  const lastTerm = plan.terms[plan.terms.length - 1]
  const getNextDefaults = () => {
    if (!lastTerm) return { season: 'Fall' as Season, year: 2024, type: 'study' as TermType }
    const seasons: Season[] = ['Fall', 'Winter', 'Spring']
    const idx = seasons.indexOf(lastTerm.season)
    const nextSeasonIdx = (idx + 1) % 3
    const nextYear = nextSeasonIdx < idx ? lastTerm.year + 1 : lastTerm.year
    return {
      season: seasons[nextSeasonIdx],
      year: nextYear,
      type: lastTerm.type,
    }
  }

  const defaults = getNextDefaults()
  const [season, setSeason] = useState<Season>(defaults.season)
  const [year, setYear] = useState(defaults.year)
  const [type, setType] = useState<TermType>(defaults.type)
  const [label, setLabel] = useState('')

  const handleAdd = () => {
    const id = `term-${Date.now()}`
    const defaultLabel = type === 'coop' ? 'Co-op' : type === 'off' ? 'Off' : `Term`
    addTerm({
      id,
      label: label.trim() || defaultLabel,
      season,
      year,
      type,
    })
    setOpen(false)
    setLabel('')
  }

  return (
    <div className="flex-shrink-0 flex items-start pt-2">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-300 border border-dashed border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Term
        </button>
      ) : (
        <div className="w-[200px] bg-gray-900 border border-gray-600 rounded-lg p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-300">New Term</span>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-300">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Label</label>
            <input
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. 3A, Co-op 3"
              className="w-full bg-gray-800 text-sm text-gray-200 placeholder:text-gray-600 outline-none border border-gray-700 focus:border-blue-500 rounded px-2 py-1 mt-0.5 transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Season</label>
            <div className="flex gap-1 mt-0.5">
              {SEASONS.map(s => (
                <button
                  key={s}
                  onClick={() => setSeason(s)}
                  className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                    season === s
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {s.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Year</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-full bg-gray-800 text-sm text-gray-200 outline-none border border-gray-700 focus:border-blue-500 rounded px-2 py-1 mt-0.5 transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Type</label>
            <div className="flex gap-1 mt-0.5">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                    type === t.value
                      ? t.value === 'study'
                        ? 'bg-blue-600 text-white'
                        : t.value === 'coop'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleAdd} size="sm" className="w-full h-7 text-xs">
            Add Term
          </Button>
        </div>
      )}
    </div>
  )
}
