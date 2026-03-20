'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
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
import { Search, Loader2, GripVertical } from 'lucide-react'
import { usePlanStore } from '@/store/plan'
import { Course } from '@/types'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// ─── Types ───────────────────────────────────────────────────────────────────

interface UWFlowSearchResult {
  code: string
  name: string
  rating_liked: number | null
}

interface UWFlowPrereqCourse {
  code: string
  name: string
  rating_liked?: number | null
  prereqs?: Array<{ prereq_course: UWFlowPrereqCourse }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeCode(code: string): string {
  return code.toLowerCase().replace(/\s+/g, '')
}

function formatCode(raw: string): string {
  const match = raw.match(/^([a-zA-Z]+)(\d.*)$/)
  if (match) return `${match[1].toUpperCase()} ${match[2]}`
  return raw.toUpperCase()
}

// ─── Prereq graph building ────────────────────────────────────────────────────

interface GraphCourse {
  code: string
  name: string
  depth: number // 0 = target, 1 = direct prereq, etc.
}

function buildGraph(
  root: UWFlowPrereqCourse,
  plannedCodes: Set<string>
): { nodes: Node[]; edges: Edge[] } {
  const visited = new Map<string, GraphCourse>() // normCode -> GraphCourse
  const edgeSet: Array<{ from: string; to: string }> = []

  // BFS from root outwards (root is depth 0)
  const queue: Array<{ course: UWFlowPrereqCourse; depth: number }> = [
    { course: root, depth: 0 },
  ]

  while (queue.length > 0) {
    const { course, depth } = queue.shift()!
    const norm = normalizeCode(course.code)

    if (!visited.has(norm)) {
      visited.set(norm, { code: course.code, name: course.name, depth })
    } else {
      // Already visited at a shallower or equal depth — skip re-processing but
      // the edge will still be added below.
    }

    const prereqs = course.prereqs ?? []
    for (const { prereq_course } of prereqs) {
      const prereqNorm = normalizeCode(prereq_course.code)
      edgeSet.push({ from: prereqNorm, to: norm })
      if (!visited.has(prereqNorm)) {
        queue.push({ course: prereq_course, depth: depth + 1 })
      }
    }
  }

  // Assign tiers:
  // planned courses → tier "completed" (top)
  // target (depth 0) → tier "target" (bottom)
  // others sorted by depth descending
  const allCourses = Array.from(visited.values())

  const targetNorm = normalizeCode(root.code)
  const completed = allCourses.filter(
    c => isPlanned(c.code, plannedCodes) && normalizeCode(c.code) !== targetNorm
  )
  const missing = allCourses.filter(
    c => !isPlanned(c.code, plannedCodes) && normalizeCode(c.code) !== targetNorm
  )
  // target variable is used to ensure it exists in allCourses
  allCourses.find(c => normalizeCode(c.code) === targetNorm)

  // Layout constants
  const NODE_W = 150
  const NODE_H = 56
  const H_GAP = 20
  const V_GAP = 40

  function layoutRow(courses: GraphCourse[], y: number): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>()
    const totalWidth = courses.length * NODE_W + (courses.length - 1) * H_GAP
    const startX = -totalWidth / 2
    courses.forEach((c, i) => {
      positions.set(normalizeCode(c.code), {
        x: startX + i * (NODE_W + H_GAP),
        y,
      })
    })
    return positions
  }

  // Group missing courses by depth
  const depthMap = new Map<number, GraphCourse[]>()
  for (const c of missing) {
    const d = c.depth
    if (!depthMap.has(d)) depthMap.set(d, [])
    depthMap.get(d)!.push(c)
  }
  const depths = Array.from(depthMap.keys()).sort((a, b) => b - a) // deeper first (higher on screen)

  const allPositions = new Map<string, { x: number; y: number }>()
  let currentY = 0

  // completed row at top
  if (completed.length > 0) {
    layoutRow(completed, currentY).forEach((v, k) => allPositions.set(k, v))
    currentY += NODE_H + V_GAP
  }

  // missing rows by depth (deepest first)
  for (const depth of depths) {
    const row = depthMap.get(depth)!
    layoutRow(row, currentY).forEach((v, k) => allPositions.set(k, v))
    currentY += NODE_H + V_GAP
  }

  // target at bottom
  allPositions.set(targetNorm, { x: -(NODE_W / 2), y: currentY })

  // Build ReactFlow nodes
  const rfNodes: Node[] = []

  const isTargetPlanned = isPlanned(root.code, plannedCodes)

  visited.forEach((course, norm) => {
    const pos = allPositions.get(norm) ?? { x: 0, y: 0 }
    const isTarget = norm === targetNorm
    const planned = isPlanned(course.code, plannedCodes)

    const nodeType = 'prereqNode' as const
    let tier: 'completed' | 'missing' | 'target'
    if (isTarget) {
      tier = isTargetPlanned ? 'completed' : 'target'
    } else if (planned) {
      tier = 'completed'
    } else {
      tier = 'missing'
    }

    rfNodes.push({
      id: norm,
      type: nodeType,
      position: pos,
      data: {
        code: course.code,
        name: course.name,
        tier,
        isTarget,
      },
      draggable: false, // we handle DnD ourselves
    })
  })

  // Build edges
  const rfEdges: Edge[] = edgeSet.map(({ from, to }, i) => {
    const toNode = visited.get(to)
    const fromNode = visited.get(from)
    const toPlanned = toNode ? isPlanned(toNode.code, plannedCodes) : false
    const fromPlanned = fromNode ? isPlanned(fromNode.code, plannedCodes) : false

    const color = toPlanned && fromPlanned ? '#22c55e' : toPlanned ? '#f59e0b' : '#6b7280'

    return {
      id: `edge-${i}-${from}-${to}`,
      source: from,
      target: to,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 1.5 },
      animated: false,
    }
  })

  return { nodes: rfNodes, edges: rfEdges }
}

function isPlanned(code: string, plannedCodes: Set<string>): boolean {
  return plannedCodes.has(normalizeCode(code))
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
      className={`rounded-md border px-2 py-1.5 w-[150px] text-left ${bgColor} ${
        tier === 'missing' ? 'cursor-pointer hover:brightness-110' : ''
      }`}
      onClick={handleClick}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#6b7280', width: 6, height: 6 }}
      />
      <div className={`font-mono text-xs font-bold leading-tight ${codeColor}`}>
        {formatCode(code)}
      </div>
      <div className="text-[10px] text-gray-300 leading-tight mt-0.5 line-clamp-2">{name}</div>
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

// ─── Main ExploreSidebar ──────────────────────────────────────────────────────

export default function ExploreSidebar() {
  const { plan } = usePlanStore()
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UWFlowSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const [targetCode, setTargetCode] = useState<string | null>(null) // raw uwflow code e.g. "cs241"
  const [targetCourse, setTargetCourse] = useState<UWFlowPrereqCourse | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphError, setGraphError] = useState<string | null>(null)

  // Gather all planned course codes (normalized)
  const plannedCodes = useMemo(() => {
    const s = new Set<string>()
    plan.terms.forEach(term => {
      if (term.type === 'study') {
        term.courses.forEach(pc => s.add(normalizeCode(pc.course.code)))
      }
    })
    return s
  }, [plan])

  // Search courses
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([])
      setSearched(false)
      return
    }
    setSearchLoading(true)
    setSearchError(null)
    try {
      const res = await fetch('/api/search-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      if (!res.ok) throw new Error('Search failed')
      const data = await res.json()
      setSearchResults(data.data?.search_courses ?? [])
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
  const { nodes: rfNodes, edges: rfEdges } = useMemo(() => {
    if (!targetCourse) return { nodes: [], edges: [] }
    return buildGraph(targetCourse, plannedCodes)
  }, [targetCourse, plannedCodes])

  // Inject callback into node data
  const handleAmberClick = useCallback((code: string) => {
    setTargetCode(normalizeCode(code))
    // Clear search results to focus on the graph
    setSearched(false)
    setSearchResults([])
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
    () => ({ prereqNode: PrereqNodeComponent }),
    []
  )

  return (
    <aside className="w-[380px] flex-shrink-0 bg-gray-900 border-r border-gray-700 flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-100 mb-2">Explore Courses</h2>
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

      {/* Search results */}
      {searched && searchResults.length > 0 && (
        <div className="border-b border-gray-700 max-h-[200px] overflow-y-auto">
          {searchLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 text-gray-500 animate-spin" />
            </div>
          )}
          {!searchLoading && searchResults.map(c => (
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
              <div className="font-mono text-xs font-semibold text-blue-300">{formatCode(c.code)}</div>
              <div className="text-[11px] text-gray-400 leading-tight">{c.name}</div>
            </button>
          ))}
          {searchError && (
            <div className="text-xs text-red-400 text-center py-3 px-2">{searchError}</div>
          )}
          {searched && searchResults.length === 0 && !searchLoading && !searchError && (
            <div className="text-xs text-gray-500 text-center py-3">No courses found</div>
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
