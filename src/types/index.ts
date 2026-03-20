export type TermType = 'study' | 'coop' | 'off'
export type Season = 'Fall' | 'Winter' | 'Spring'

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
