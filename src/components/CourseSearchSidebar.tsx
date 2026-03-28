'use client'

import { useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Course } from '@/types'
import { COURSE_PREREQS } from '@/store/plan'
import DraggableSearchResult from './DraggableSearchResult'
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCode } from '@/lib/uwflow'
import type { UWFlowSearchResult } from '@/types'

export default function CourseSearchSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/search-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })

      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      const courses: Course[] = (data.data?.search_courses ?? []).map((c: UWFlowSearchResult) => {
        const code = formatCode(c.code)
        return {
          code,
          name: c.name,
          rating: c.rating_liked ?? undefined,
          prereqs: COURSE_PREREQS[code] ?? [],
        }
      })
      setResults(courses)
      setSearched(true)
    } catch {
      setError('Failed to search. Check your connection.')
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      search(query)
    }
  }

  if (collapsed) {
    return (
      <aside className="w-10 flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Expand course search"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="text-gray-600" style={{ writingMode: 'vertical-rl', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', transform: 'rotate(180deg)' }}>
          Courses
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-[250px] flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-100">Course Search</h2>
          <button
            onClick={() => setCollapsed(true)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
          <Input
            placeholder="CS 241, Calculus..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-7 h-8 text-sm bg-gray-800 border-gray-600 text-gray-100 placeholder:text-gray-500"
          />
        </div>
        <p className="text-[10px] text-gray-500 mt-1">Press Enter to search</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="text-xs text-red-400 text-center py-4 px-2">{error}</div>
        )}

        {!loading && searched && results.length === 0 && !error && (
          <div className="text-xs text-gray-500 text-center py-4">No courses found</div>
        )}

        {!loading && !searched && !error && (
          <div className="text-xs text-gray-600 text-center py-4 px-2">
            Search for courses from the UWaterloo catalog
          </div>
        )}

        {!loading && results.map(course => (
          <DraggableSearchResult key={course.code} course={course} />
        ))}
      </div>
    </aside>
  )
}
