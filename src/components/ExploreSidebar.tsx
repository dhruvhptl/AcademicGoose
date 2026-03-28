'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import dagre from 'dagre'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MarkerType,
  NodeTypes,
  Handle,
  Position,
  NodeProps,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { Input } from '@/components/ui/input'
import { Search, Loader2, GripVertical, ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { usePlanStore } from '@/store/plan'
import { Course } from '@/types'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { formatCode, normalizeCode } from '@/lib/uwflow'
import type { UWFlowSearchResult, UWCourseResult, UWFlowPrereqCourse } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Returns true when the query looks like a subject browse (≤4 letters, no digits)
function isSubjectQuery(q: string): boolean {
  const trimmed = q.trim().replace(/\s+/g, '')
  return trimmed.length <= 4 && /^[a-zA-Z]+$/.test(trimmed)
}

// ─── Prereq text parsing ─────────────────────────────────────────────────────

/** A parsed prerequisite group from prereqsText */
interface PrereqGroup {
  label: string          // "one of", "two of", "all required", or bare code
  codes: string[]        // normalized course codes in this group
  formattedCodes: string[] // display-formatted codes
}

/**
 * Parse a prereqsText string into structured groups.
 *
 * Handles multiple formats:
 *   "PHYS 112 or PHYS 122; One of PHYS 236, CS 114; Two of PHYS 234, PHYS 242"
 *   "(One of MATH106, MATH114) and MATH245"
 *   "PHYS234 and PHYS242"
 */
function parsePrereqText(text: string | null | undefined): PrereqGroup[] {
  if (!text || !text.trim()) return []

  const groups: PrereqGroup[] = []

  // Helper: extract course codes from a string
  function extractCodes(s: string): { codes: string[]; formatted: string[] } {
    const codes: string[] = []
    const formatted: string[] = []
    const codeRegex = /\b([A-Z]{2,6}\s*\d{3}[A-Z]?)\b/gi
    let m: RegExpExecArray | null
    while ((m = codeRegex.exec(s)) !== null) {
      codes.push(normalizeCode(m[1]))
      formatted.push(formatCode(m[1]))
    }
    return { codes, formatted }
  }

  // Helper: determine group label from text
  function labelFor(s: string): string {
    const countMatch = s.match(/\b(one|two|three|four|five|1|2|3|4|5)\s+of\b/i)
    if (countMatch) return countMatch[0].toLowerCase()
    if (/\bor\b/i.test(s)) return 'one of'
    return 'all required'
  }

  // First, split by semicolons into segments
  const segments = text.split(';').map(s => s.trim()).filter(Boolean)

  for (const segment of segments) {
    // Check for parenthesized sub-groups within this segment
    const parenRegex = /\(([^)]+)\)/g
    const consumed = new Set<number>()
    let pm: RegExpExecArray | null

    while ((pm = parenRegex.exec(segment)) !== null) {
      const inner = pm[1]
      for (let i = pm.index; i < pm.index + pm[0].length; i++) consumed.add(i)

      const { codes, formatted } = extractCodes(inner)
      if (codes.length === 0) continue
      groups.push({ label: labelFor(inner), codes, formattedCodes: formatted })
    }

    // Collect bare codes outside parens in this segment
    const bareParts: string[] = []
    let lastEnd = 0
    const parenRegex2 = /\(([^)]+)\)/g
    let pm2: RegExpExecArray | null
    while ((pm2 = parenRegex2.exec(segment)) !== null) {
      if (pm2.index > lastEnd) bareParts.push(segment.slice(lastEnd, pm2.index))
      lastEnd = pm2.index + pm2[0].length
    }
    if (lastEnd < segment.length) bareParts.push(segment.slice(lastEnd))

    const bareText = bareParts.join(' ')
    const { codes: bareCodes, formatted: bareFormatted } = extractCodes(bareText)

    if (bareCodes.length > 0) {
      // If the whole segment (including bare codes) has "or" or "N of", it's an OR group
      const label = labelFor(segment)
      groups.push({ label, codes: bareCodes, formattedCodes: bareFormatted })
    }
  }

  // If no semicolons were found and no parens, handle "X and Y and Z" as all required
  // or "X or Y" as one of
  if (groups.length === 0) {
    const { codes, formatted } = extractCodes(text)
    if (codes.length > 0) {
      groups.push({ label: labelFor(text), codes, formattedCodes: formatted })
    }
  }

  return groups
}

// ─── Prereq graph building ────────────────────────────────────────────────────

const NODE_W = 200
const NODE_H = 70
const GROUP_LABEL_W = 160
const GROUP_LABEL_H = 28

interface PrereqSummary {
  needed: string[]
  have: string[]
}

const COLS_PER_ROW = 3  // max courses per row within a group
const GAP_X = 20        // horizontal gap between course nodes
const GAP_Y = 16        // vertical gap between rows of courses
const GROUP_GAP = 60    // vertical gap between groups
const LABEL_GAP = 10    // gap between group label and its first row

/**
 * Build a prereq graph from prereqsText (source of truth).
 *
 * Manual grid layout: each group gets a label + rows of courses (max COLS_PER_ROW wide).
 * Groups stack vertically. Target node sits at the bottom.
 * Edges: each course → target, group label → courses (dashed).
 */
function buildGraph(
  root: UWFlowPrereqCourse,
  plannedCodes: Set<string>,
  completedCodes: Set<string>
): { nodes: Node[]; edges: Edge[]; summary: PrereqSummary } {
  const rootNorm = normalizeCode(root.code)
  const groups = parsePrereqText(root.prereqsText)

  // Build name lookup from structured prereqs array
  const nameByNorm = new Map<string, string>()
  for (const p of root.prereqs ?? []) {
    nameByNorm.set(normalizeCode(p.prereq_course.code), p.prereq_course.name)
  }

  // Summary
  const needed: string[] = []
  const have: string[] = []

  interface CourseEntry { code: string; name: string; norm: string; groupIdx: number }
  const allCourses: CourseEntry[] = []

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    for (let ci = 0; ci < group.codes.length; ci++) {
      const norm = group.codes[ci]
      const name = nameByNorm.get(norm) ?? group.formattedCodes[ci]
      allCourses.push({ code: group.formattedCodes[ci], name, norm, groupIdx: gi })
      if (completedCodes.has(norm) || plannedCodes.has(norm)) {
        have.push(group.formattedCodes[ci])
      } else {
        needed.push(group.formattedCodes[ci])
      }
    }
  }

  // ── Manual layout ─────────────────────────────────────────────────────────
  const rfNodes: Node[] = []
  const rfEdges: Edge[] = []
  let edgeIdx = 0
  const isTargetPlanned = plannedCodes.has(rootNorm)

  // Track total height as we stack groups top-down
  let cursorY = 0
  const addedNorms = new Set<string>()

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    const members = allCourses.filter(c => c.groupIdx === gi)
    if (members.length === 0) continue

    const cols = Math.min(members.length, COLS_PER_ROW)
    const rowWidth = cols * NODE_W + (cols - 1) * GAP_X

    // Group label — centred above members
    const labelId = `__group__${gi}`
    const labelX = (rowWidth - GROUP_LABEL_W) / 2
    rfNodes.push({
      id: labelId,
      type: 'groupLabelNode' as const,
      position: { x: labelX, y: cursorY },
      data: { label: group.label },
      draggable: false,
    })

    cursorY += GROUP_LABEL_H + LABEL_GAP

    // Lay out member courses in rows of COLS_PER_ROW
    for (let ci = 0; ci < members.length; ci++) {
      const cn = members[ci]
      if (addedNorms.has(cn.norm)) continue
      addedNorms.add(cn.norm)

      const col = ci % COLS_PER_ROW
      const row = Math.floor(ci / COLS_PER_ROW)

      const x = col * (NODE_W + GAP_X)
      const y = cursorY + row * (NODE_H + GAP_Y)

      const completed = completedCodes.has(cn.norm)
      const planned = plannedCodes.has(cn.norm)
      const tier: 'completed' | 'missing' = completed || planned ? 'completed' : 'missing'

      rfNodes.push({
        id: cn.norm,
        type: 'prereqNode' as const,
        position: { x, y },
        data: { code: cn.code, name: cn.name, tier, isTarget: false },
        draggable: false,
      })

      // Dashed edge from group label to course
      rfEdges.push({
        id: `e-${edgeIdx++}`,
        source: labelId,
        target: cn.norm,
        type: 'smoothstep',
        style: { stroke: '#4b5563', strokeWidth: 1, strokeDasharray: '4 3' },
        animated: false,
      })
    }

    const totalRows = Math.ceil(members.length / COLS_PER_ROW)
    cursorY += totalRows * (NODE_H + GAP_Y) - GAP_Y + GROUP_GAP
  }

  // ── Target node at bottom, centred ────────────────────────────────────────
  // Find the max width across all groups to centre the target
  let maxRowWidth = NODE_W
  for (let gi = 0; gi < groups.length; gi++) {
    const count = allCourses.filter(c => c.groupIdx === gi).length
    const cols = Math.min(count, COLS_PER_ROW)
    const w = cols * NODE_W + (cols - 1) * GAP_X
    if (w > maxRowWidth) maxRowWidth = w
  }

  const targetX = (maxRowWidth - NODE_W) / 2
  const targetY = cursorY

  rfNodes.push({
    id: rootNorm,
    type: 'prereqNode' as const,
    position: { x: targetX, y: targetY },
    data: {
      code: root.code,
      name: root.name,
      tier: isTargetPlanned ? 'completed' : 'target',
      isTarget: true,
    },
    draggable: false,
  })

  // ── Course → target edges ─────────────────────────────────────────────────
  const edgedNorms = new Set<string>()
  for (const cn of allCourses) {
    if (edgedNorms.has(cn.norm)) continue
    edgedNorms.add(cn.norm)
    const fromPlanned = plannedCodes.has(cn.norm) || completedCodes.has(cn.norm)
    const color = fromPlanned ? '#22c55e' : '#f59e0b'
    rfEdges.push({
      id: `e-${edgeIdx++}`,
      source: cn.norm,
      target: rootNorm,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 1.5 },
      animated: false,
    })
  }

  return { nodes: rfNodes, edges: rfEdges, summary: { needed, have } }
}

// ─── Custom ReactFlow node ────────────────────────────────────────────────────

interface PrereqNodeData {
  code: string
  name: string
  tier: 'completed' | 'missing' | 'target'
  isTarget: boolean
  onClickAmber?: (code: string) => void
  onDragCourse?: (course: Course) => void
}

function DraggableTargetHandle({ code, name }: { code: string; name: string }) {
  const course: Course = { code: formatCode(code), name, prereqs: [] }
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `explore-target-${code}`,
    data: { course: { ...course, code: formatCode(code) }, type: 'search-result' },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-[9px] text-blue-300 select-none"
      title="Drag to add to a term"
    >
      <GripVertical className="h-2.5 w-2.5" />
      drag to plan
    </div>
  )
}

function PrereqNodeComponent({ data }: NodeProps<PrereqNodeData>) {
  const { code, name, tier, isTarget, onClickAmber } = data

  const bgColor =
    tier === 'completed'
      ? 'bg-green-900/60 border-green-500/50'
      : tier === 'target'
      ? 'bg-blue-900/60 border-blue-500/50'
      : 'bg-amber-900/60 border-amber-500/50'

  const codeColor =
    tier === 'completed'
      ? 'text-green-300'
      : tier === 'target'
      ? 'text-blue-300'
      : 'text-amber-300'

  const handleClick = () => {
    if (tier === 'missing' && onClickAmber) {
      onClickAmber(code)
    }
  }

  return (
    <div
      className={`rounded-lg border px-3 py-2 text-left ${bgColor} ${
        tier === 'missing' ? 'cursor-pointer hover:brightness-110' : ''
      }`}
      style={{ width: NODE_W, minHeight: NODE_H }}
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#6b7280', width: 6, height: 6 }}
      />
      <div className={`font-mono text-sm font-bold leading-tight ${codeColor}`}>
        {formatCode(code)}
      </div>
      <div className="text-xs text-gray-300 leading-snug mt-1 line-clamp-2">{name}</div>
      {isTarget && tier === 'target' && (
        <DraggableTargetHandle code={code} name={name} />
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#6b7280', width: 6, height: 6 }}
      />
    </div>
  )
}

// ─── Group label node ─────────────────────────────────────────────────────────

interface GroupLabelNodeData {
  label: string
}

function GroupLabelNodeComponent({ data }: NodeProps<GroupLabelNodeData>) {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-dashed border-gray-600 bg-gray-800/50 px-3"
      style={{ width: GROUP_LABEL_W, height: GROUP_LABEL_H }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'transparent', width: 1, height: 1, border: 'none' }}
      />
      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
        {data.label}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: 'transparent', width: 1, height: 1, border: 'none' }}
      />
    </div>
  )
}

// ─── Main ExploreSidebar ──────────────────────────────────────────────────────

export default function ExploreSidebar() {
  const { plan } = usePlanStore()
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UWFlowSearchResult[]>([])
  const [subjectResults, setSubjectResults] = useState<UWCourseResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const [targetCode, setTargetCode] = useState<string | null>(null) // raw uwflow code e.g. "cs241"
  const [targetCourse, setTargetCourse] = useState<UWFlowPrereqCourse | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState<string | null>(null)

  // plannedCodes = all courses in the plan (any status) — used for node coloring
  // completedCodes = only status==='completed' — used for pruning the prereq tree
  const { plannedCodes, completedCodes } = useMemo(() => {
    const planned = new Set<string>()
    const completed = new Set<string>()
    plan.terms.forEach(term => {
      if (term.type === 'study') {
        term.courses.forEach(pc => {
          const norm = normalizeCode(pc.course.code)
          planned.add(norm)
          if (pc.status === 'completed') completed.add(norm)
        })
      }
    })
    return { plannedCodes: planned, completedCodes: completed }
  }, [plan])

  // Search courses — routes to UW Open Data for subject queries, UWFlow otherwise
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([])
      setSubjectResults([])
      setSearched(false)
      return
    }
    setSearchLoading(true)
    setSearchError(null)
    setSearchResults([])
    setSubjectResults([])

    const isSubject = isSubjectQuery(q)

    try {
      if (isSubject) {
        const res = await fetch('/api/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: q.trim() }),
        })
        if (!res.ok) throw new Error('Subject fetch failed')
        const data = await res.json()
        setSubjectResults(data.courses ?? [])
      } else {
        const res = await fetch('/api/search-courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        })
        if (!res.ok) throw new Error('Search failed')
        const data = await res.json()
        setSearchResults(data.data?.search_courses ?? [])
      }
      setSearched(true)
    } catch {
      setSearchError('Search failed. Check your connection.')
      setSearched(true)
    } finally {
      setSearchLoading(false)
    }
  }, [])

  // Fetch prereqs for target course
  const fetchPrereqs = useCallback(async (code: string) => {
    setGraphLoading(true)
    setGraphError(null)
    setTargetCourse(null)
    try {
      const res = await fetch('/api/course-prereqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.status === 404) {
        setGraphError('Course not found')
        return
      }
      if (!res.ok) throw new Error('Failed to fetch prereqs')
      const data = await res.json()
      setTargetCourse(data)
    } catch {
      setGraphError('Failed to load prereq graph.')
    } finally {
      setGraphLoading(false)
    }
  }, [])

  useEffect(() => {
    if (targetCode) {
      fetchPrereqs(targetCode)
    }
  }, [targetCode, fetchPrereqs])

  // Build graph data
  const { nodes: rfNodes, edges: rfEdges, summary } = useMemo(() => {
    if (!targetCourse) return { nodes: [], edges: [], summary: { needed: [], have: [] } }
    return buildGraph(targetCourse, plannedCodes, completedCodes)
  }, [targetCourse, plannedCodes, completedCodes])

  // Inject callback into node data
  const handleAmberClick = useCallback((code: string) => {
    setTargetCode(normalizeCode(code))
    setSearched(false)
    setSearchResults([])
    setSubjectResults([])
    setQuery('')
  }, [])

  const nodesWithCallbacks = useMemo(
    () =>
      rfNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          onClickAmber: handleAmberClick,
        },
      })),
    [rfNodes, handleAmberClick]
  )

  const nodeTypes: NodeTypes = useMemo(
    () => ({ prereqNode: PrereqNodeComponent, groupLabelNode: GroupLabelNodeComponent }),
    []
  )

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Close fullscreen on Escape
  const escRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  useEffect(() => {
    escRef.current = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    document.addEventListener('keydown', escRef.current)
    return () => {
      if (escRef.current) document.removeEventListener('keydown', escRef.current)
    }
  }, [])

  if (collapsed) {
    return (
      <aside className="w-10 flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setCollapsed(false)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Expand explore panel"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="text-gray-600" style={{ writingMode: 'vertical-rl', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', transform: 'rotate(180deg)' }}>
          Explore
        </div>
      </aside>
    )
  }

  return (
    <aside className="w-[380px] flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-100">Explore Courses</h2>
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
            placeholder="Search a course to explore prereqs..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(query) }}
            className="pl-7 h-8 text-sm bg-gray-800 border-gray-600 text-gray-100 placeholder:text-gray-500"
          />
        </div>
        <p className="text-[10px] text-gray-500 mt-1">Press Enter to search · Click a result to view prereq graph</p>
      </div>

      {/* Loading state */}
      {searchLoading && (
        <div className="flex items-center justify-center py-4 border-b border-gray-700">
          <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
        </div>
      )}

      {/* Error state */}
      {searchError && !searchLoading && (
        <div className="text-xs text-red-400 text-center py-3 px-3 border-b border-gray-700">{searchError}</div>
      )}

      {/* UWFlow course search results */}
      {!searchLoading && searched && searchResults.length > 0 && (
        <div className="border-b border-gray-700 max-h-[220px] overflow-y-auto">
          {searchResults.map(c => (
            <button
              key={c.code}
              onClick={() => {
                setTargetCode(normalizeCode(c.code))
                setSearched(false)
                setSearchResults([])
                setQuery('')
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-800 border-b border-gray-800 last:border-b-0 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-xs font-semibold text-blue-300">{formatCode(c.code)}</div>
                {c.rating_liked != null && (
                  <div className="text-[10px] text-gray-500 flex-shrink-0">
                    {Math.round(c.rating_liked * 100)}% liked
                  </div>
                )}
              </div>
              <div className="text-[11px] text-gray-400 leading-tight">{c.name}</div>
            </button>
          ))}
        </div>
      )}

      {/* UW Open Data subject browse results */}
      {!searchLoading && searched && subjectResults.length > 0 && (
        <div className="border-b border-gray-700 flex-shrink-0 overflow-y-auto" style={{ maxHeight: '45%' }}>
          <div className="px-3 py-1.5 text-[10px] text-gray-500 font-medium uppercase tracking-wider border-b border-gray-800">
            {subjectResults.length} courses · click to explore prereqs
          </div>
          {subjectResults.map(c => (
            <button
              key={c.code}
              onClick={() => {
                setTargetCode(normalizeCode(c.code))
                setSearched(false)
                setSubjectResults([])
                setQuery('')
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-800 border-b border-gray-800 last:border-b-0 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-xs font-semibold text-blue-300">{c.code}</div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {c.units != null && (
                    <span className="text-[10px] text-gray-600">{c.units}u</span>
                  )}
                  {c.rating_liked != null && (
                    <span className="text-[10px] text-gray-500">{Math.round(c.rating_liked * 100)}% liked</span>
                  )}
                </div>
              </div>
              <div className="text-[11px] text-gray-400 leading-tight">{c.title}</div>
              {c.prerequisites && (
                <div className="text-[10px] text-gray-600 leading-tight mt-0.5 line-clamp-1">
                  Prereq: {c.prerequisites}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!searchLoading && searched && searchResults.length === 0 && subjectResults.length === 0 && !searchError && (
        <div className="text-xs text-gray-500 text-center py-4 border-b border-gray-700">No courses found</div>
      )}

      {/* What you need summary */}
      {!graphLoading && !graphError && targetCourse && (summary.needed.length > 0 || summary.have.length > 0) && (
        <div className="px-3 py-2.5 border-b border-gray-700 flex gap-4">
          {summary.needed.length > 0 && (
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-amber-400 font-medium uppercase tracking-wider mb-1">Still needed</div>
              <div className="flex flex-wrap gap-1">
                {summary.needed.map(code => (
                  <span key={code} className="text-[10px] font-mono text-amber-300 bg-amber-900/40 border border-amber-700/40 rounded px-1.5 py-0.5">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
          {summary.have.length > 0 && (
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-green-400 font-medium uppercase tracking-wider mb-1">Already have</div>
              <div className="flex flex-wrap gap-1">
                {summary.have.map(code => (
                  <span key={code} className="text-[10px] font-mono text-green-300 bg-green-900/40 border border-green-700/40 rounded px-1.5 py-0.5">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Graph area */}
      <div className="flex-1 relative overflow-hidden">
        {!targetCode && !graphLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-center px-6">
            <div className="space-y-2">
              <div className="text-2xl">🔍</div>
              <div className="text-sm text-gray-400 font-medium">Search for a course</div>
              <div className="text-xs text-gray-600">Click a search result to visualize its prerequisite chain</div>
            </div>
          </div>
        )}

        {graphLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
              <span className="text-xs text-gray-500">Loading prereq graph...</span>
            </div>
          </div>
        )}

        {graphError && !graphLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-red-400 text-center px-4">{graphError}</div>
          </div>
        )}

        {!graphLoading && !graphError && targetCourse && (
          <>
            {/* Legend */}
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 bg-gray-900/80 backdrop-blur-sm rounded-md p-2 text-[10px]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-green-900 border border-green-500/50" />
                <span className="text-gray-400">Planned</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-amber-900 border border-amber-500/50" />
                <span className="text-gray-400">Missing prereq</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-blue-900 border border-blue-500/50" />
                <span className="text-gray-400">Target course</span>
              </div>
            </div>

            {/* Fullscreen button */}
            <button
              onClick={() => setIsFullscreen(true)}
              className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-gray-900/80 backdrop-blur-sm text-gray-400 hover:text-gray-200 transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>

            <ReactFlow
              nodes={nodesWithCallbacks}
              edges={rfEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnScroll
              zoomOnScroll={false}
              style={{ background: 'transparent' }}
            >
              <Background color="#374151" gap={16} size={1} />
              <Controls
                showInteractive={false}
                style={{ bottom: 8, right: 8, top: 'auto', left: 'auto' }}
              />
            </ReactFlow>

            {/* Fullscreen modal */}
            {isFullscreen && (
              <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col">
                {/* Modal toolbar */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 flex-shrink-0">
                  <div className="flex items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-green-900 border border-green-500/50" />
                      <span className="text-gray-400">Planned</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-amber-900 border border-amber-500/50" />
                      <span className="text-gray-400">Missing prereq</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm bg-blue-900 border border-blue-500/50" />
                      <span className="text-gray-400">Target course</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsFullscreen(false)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
                    title="Close fullscreen (Esc)"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Full-viewport graph */}
                <div className="flex-1 relative">
                  <ReactFlow
                    nodes={nodesWithCallbacks}
                    edges={rfEdges}
                    nodeTypes={nodeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.15 }}
                    proOptions={{ hideAttribution: true }}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={false}
                    panOnScroll
                    zoomOnScroll={false}
                    style={{ background: 'transparent' }}
                  >
                    <Background color="#374151" gap={16} size={1} />
                    <Controls
                      showInteractive={false}
                      style={{ bottom: 16, right: 16, top: 'auto', left: 'auto' }}
                    />
                  </ReactFlow>
                </div>
              </div>
            )}
          </>
        )}

        {!graphLoading && !graphError && targetCourse && rfNodes.length === 1 && (
          <div className="absolute bottom-12 left-0 right-0 flex justify-center pointer-events-none">
            <div className="text-[10px] text-gray-500 bg-gray-900/80 rounded px-2 py-1">
              No prerequisites found for this course
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
