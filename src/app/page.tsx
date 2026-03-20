import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with dnd-kit and zustand localStorage
const PlannerCanvas = dynamic(() => import('@/components/PlannerCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-gray-950">
      <div className="text-center space-y-3">
        <div className="text-4xl">🪿</div>
        <div className="text-lg font-semibold text-gray-200">Academic Goose</div>
        <div className="text-sm text-gray-500">Loading your degree plan...</div>
      </div>
    </div>
  ),
})

export default function Home() {
  return (
    <main className="flex flex-col h-screen bg-gray-950 overflow-hidden">
      {/* Navbar */}
      <header className="flex-shrink-0 h-12 flex items-center justify-between px-4 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center gap-2">
          <span className="text-xl">🪿</span>
          <span className="font-bold text-gray-100">Academic Goose</span>
          <span className="text-xs text-gray-500 ml-1">UWaterloo Degree Planner</span>
        </div>
        <div className="text-xs text-gray-600">
          Drag courses from the sidebar into study terms
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <PlannerCanvas />
      </div>
    </main>
  )
}
