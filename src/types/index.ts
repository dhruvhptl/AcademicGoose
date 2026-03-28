export type TermType = 'study' | 'coop' | 'off'
export type Season = 'Fall' | 'Winter' | 'Spring'
export type CourseStatus = 'planned' | 'completed' | 'inProgress' | 'failed'

export interface Course {
  code: string        // e.g. "CS 241"
  name: string
  rating?: number     // 0-1 from UWFlow
  prereqs: string[]   // course codes
}

export interface PlannedCourse {
  id: string          // unique id for dnd
  course: Course
  satisfied: boolean  // prereqs satisfied
  status: CourseStatus
}

export interface Term {
  id: string
  label: string       // e.g. "1A", "2B", custom
  season: Season
  year: number
  type: TermType
  courses: PlannedCourse[]  // only for study terms
  coopCompany?: string
  coopRole?: string
}

export interface RequirementGroup {
  id: string
  name: string
  description?: string
  required: number    // number of courses required
  courses: string[]   // course codes that satisfy
  completed: string[] // planned course codes that satisfy
}

export interface Plan {
  id: string
  name: string
  terms: Term[]
  requirementGroups: RequirementGroup[]
}

// ─── UWFlow API types ─────────────────────────────────────────────────────────

/** Raw course shape returned by UWFlow search_courses */
export interface UWFlowSearchResult {
  code: string
  name: string
  rating_liked: number | null
}

/** Course shape returned by /api/courses (subject browse) */
export interface UWCourseResult {
  code: string
  title: string
  description: string | null
  units: number | null
  prerequisites: string | null
  antirequisites: string | null
  rating_liked: number | null
  rating_count: number | null
}

/** Recursive prereq course shape returned by /api/course-prereqs */
export interface UWFlowPrereqCourse {
  code: string
  name: string
  rating_liked?: number | null
  prereqsText?: string | null  // human-readable prereq string, e.g. "AMATH231 and (AMATH271 or PHYS263)"
  prereqs?: Array<{ prereq_course: UWFlowPrereqCourse }>
}
