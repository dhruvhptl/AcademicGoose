import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Plan, Term, PlannedCourse, Course, RequirementGroup, TermType, CourseStatus } from '@/types'
import { normalizeCode } from '@/lib/uwflow'

// Hardcoded prereqs
export const COURSE_PREREQS: Record<string, string[]> = {
  'CS 136': ['CS 135'],
  'CS 241': ['CS 136'],
  'CS 246': ['CS 136'],
  'CS 245': ['CS 135', 'MATH 135'],
  'CS 251': ['CS 241'],
  'CS 341': ['CS 240', 'MATH 239'],
  'CS 350': ['CS 251', 'CS 241'],
  'MATH 136': ['MATH 135'],
  'MATH 138': ['MATH 137'],
  'MATH 239': ['MATH 138', 'MATH 136'],
}

function getPrereqs(code: string): string[] {
  return COURSE_PREREQS[code] ?? []
}

function checkPrereqsSatisfied(
  courseCode: string,
  termIndex: number,
  terms: Term[]
): boolean {
  const prereqs = getPrereqs(courseCode)
  if (prereqs.length === 0) return true

  const priorCourseCodes = new Set<string>()
  for (let i = 0; i < termIndex; i++) {
    const term = terms[i]
    if (term.type === 'study') {
      // failed courses don't count as completed prerequisites
      term.courses
        .filter(pc => pc.status !== 'failed')
        .forEach(pc => priorCourseCodes.add(normalizeCode(pc.course.code)))
    }
  }

  return prereqs.every(prereq => priorCourseCodes.has(normalizeCode(prereq)))
}

function recomputeAllPrereqs(terms: Term[]): Term[] {
  return terms.map((term, termIndex) => {
    if (term.type !== 'study') return term
    return {
      ...term,
      courses: term.courses.map(pc => ({
        ...pc,
        satisfied: checkPrereqsSatisfied(pc.course.code, termIndex, terms),
      })),
    }
  })
}

function computeRequirements(
  groups: RequirementGroup[],
  terms: Term[]
): RequirementGroup[] {
  // Only completed-status courses count toward satisfying requirements
  const completedCodes = new Set<string>()
  terms.forEach(term => {
    if (term.type === 'study') {
      term.courses
        .filter(pc => pc.status === 'completed')
        .forEach(pc => completedCodes.add(normalizeCode(pc.course.code)))
    }
  })

  return groups.map(group => ({
    ...group,
    completed: group.courses.filter(code => completedCodes.has(normalizeCode(code))),
  }))
}

// Seed data
const SEED_PLAN: Plan = {
  id: 'default',
  name: 'My Degree Plan',
  terms: [
    {
      id: 'term-1',
      label: '1A',
      season: 'Fall',
      year: 2024,
      type: 'study',
      courses: [
        { id: 'pc-cs135', course: { code: 'CS 135', name: 'Designing Functional Programs', prereqs: [] }, satisfied: true, status: 'planned' as const },
        { id: 'pc-math135', course: { code: 'MATH 135', name: 'Algebra for Honours Mathematics', prereqs: [] }, satisfied: true, status: 'planned' as const },
        { id: 'pc-math137', course: { code: 'MATH 137', name: 'Calculus 1 for Honours Mathematics', prereqs: [] }, satisfied: true, status: 'planned' as const },
        { id: 'pc-engl109', course: { code: 'ENGL 109', name: 'Introduction to Academic Writing', prereqs: [] }, satisfied: true, status: 'planned' as const },
      ],
    },
    {
      id: 'term-2',
      label: '1B',
      season: 'Winter',
      year: 2025,
      type: 'study',
      courses: [
        { id: 'pc-cs136', course: { code: 'CS 136', name: 'Algorithm Design and Data Abstraction', prereqs: ['CS 135'] }, satisfied: true, status: 'planned' as const },
        { id: 'pc-math136', course: { code: 'MATH 136', name: 'Linear Algebra 1 for Honours Mathematics', prereqs: ['MATH 135'] }, satisfied: true, status: 'planned' as const },
        { id: 'pc-math138', course: { code: 'MATH 138', name: 'Calculus 2 for Honours Mathematics', prereqs: ['MATH 137'] }, satisfied: true, status: 'planned' as const },
        { id: 'pc-stat230', course: { code: 'STAT 230', name: 'Probability', prereqs: [] }, satisfied: true, status: 'planned' as const },
      ],
    },
    {
      id: 'term-3',
      label: 'Co-op 1',
      season: 'Spring',
      year: 2025,
      type: 'coop',
      courses: [],
      coopCompany: 'Shopify',
      coopRole: 'Software Developer',
    },
    {
      id: 'term-4',
      label: '2A',
      season: 'Fall',
      year: 2025,
      type: 'study',
      courses: [
        { id: 'pc-cs241', course: { code: 'CS 241', name: 'Foundations of Sequential Programs', prereqs: ['CS 136'] }, satisfied: true, status: 'planned' as const },
        { id: 'pc-cs245', course: { code: 'CS 245', name: 'Logic and Computation', prereqs: ['CS 135', 'MATH 135'] }, satisfied: true, status: 'planned' as const },
        { id: 'pc-math239', course: { code: 'MATH 239', name: 'Introduction to Combinatorics', prereqs: ['MATH 138', 'MATH 136'] }, satisfied: true, status: 'planned' as const },
      ],
    },
    {
      id: 'term-5',
      label: 'Co-op 2',
      season: 'Winter',
      year: 2026,
      type: 'coop',
      courses: [],
      coopCompany: '',
      coopRole: '',
    },
    {
      id: 'term-6',
      label: '2B',
      season: 'Spring',
      year: 2026,
      type: 'study',
      courses: [],
    },
  ],
  requirementGroups: [
    {
      id: 'req-core-cs',
      name: 'Core CS',
      required: 8,
      courses: ['CS 135', 'CS 136', 'CS 241', 'CS 246', 'CS 245', 'CS 251', 'CS 341', 'CS 350'],
      completed: [],
    },
    {
      id: 'req-math',
      name: 'Mathematics',
      required: 5,
      courses: ['MATH 135', 'MATH 136', 'MATH 137', 'MATH 138', 'MATH 239', 'STAT 230'],
      completed: [],
    },
    {
      id: 'req-comm',
      name: 'Communication',
      required: 2,
      courses: ['ENGL 109', 'ENGL 119', 'SPCOM 100'],
      completed: [],
    },
  ],
}

// Compute initial prereqs and requirements
const initialTerms = recomputeAllPrereqs(SEED_PLAN.terms)
const initialRequirements = computeRequirements(SEED_PLAN.requirementGroups, initialTerms)
const INITIAL_PLAN: Plan = {
  ...SEED_PLAN,
  terms: initialTerms,
  requirementGroups: initialRequirements,
}

interface PlanStore {
  plan: Plan
  addTerm: (term: Omit<Term, 'courses'>) => void
  removeTerm: (termId: string) => void
  updateTerm: (termId: string, updates: Partial<Term>) => void
  addCourse: (termId: string, course: Course) => void
  removeCourse: (termId: string, courseId: string) => void
  moveCourse: (fromTermId: string, toTermId: string, courseId: string, targetIndex?: number) => void
  reorderTerms: (fromIndex: number, toIndex: number) => void
  updateRequirements: (groups: RequirementGroup[]) => void
  renameTerm: (termId: string, label: string) => void
  changeTermType: (termId: string, type: TermType) => void
  setCourseStatus: (termId: string, courseId: string, status: CourseStatus) => void
  setCurrentTerm: (termId: string) => void
}

export const usePlanStore = create<PlanStore>()(
  persist(
    (set) => ({
      plan: INITIAL_PLAN,

      addTerm: (term) =>
        set(state => {
          const newTerm: Term = { ...term, courses: [] }
          const newTerms = recomputeAllPrereqs([...state.plan.terms, newTerm])
          const newReqs = computeRequirements(state.plan.requirementGroups, newTerms)
          return { plan: { ...state.plan, terms: newTerms, requirementGroups: newReqs } }
        }),

      removeTerm: (termId) =>
        set(state => {
          const newTerms = recomputeAllPrereqs(state.plan.terms.filter(t => t.id !== termId))
          const newReqs = computeRequirements(state.plan.requirementGroups, newTerms)
          return { plan: { ...state.plan, terms: newTerms, requirementGroups: newReqs } }
        }),

      updateTerm: (termId, updates) =>
        set(state => {
          const newTerms = recomputeAllPrereqs(
            state.plan.terms.map(t => t.id === termId ? { ...t, ...updates } : t)
          )
          const newReqs = computeRequirements(state.plan.requirementGroups, newTerms)
          return { plan: { ...state.plan, terms: newTerms, requirementGroups: newReqs } }
        }),

      addCourse: (termId, course) =>
        set(state => {
          const prereqs = getPrereqs(course.code)
          const courseWithPrereqs: Course = { ...course, prereqs }
          const newCourse: PlannedCourse = {
            id: `pc-${course.code.replace(' ', '-').toLowerCase()}-${Date.now()}`,
            course: courseWithPrereqs,
            satisfied: false,
            status: 'planned',
          }
          const newTerms = recomputeAllPrereqs(
            state.plan.terms.map(t =>
              t.id === termId && t.type === 'study'
                ? { ...t, courses: [...t.courses, newCourse] }
                : t
            )
          )
          const newReqs = computeRequirements(state.plan.requirementGroups, newTerms)
          return { plan: { ...state.plan, terms: newTerms, requirementGroups: newReqs } }
        }),

      removeCourse: (termId, courseId) =>
        set(state => {
          const newTerms = recomputeAllPrereqs(
            state.plan.terms.map(t =>
              t.id === termId
                ? { ...t, courses: t.courses.filter(c => c.id !== courseId) }
                : t
            )
          )
          const newReqs = computeRequirements(state.plan.requirementGroups, newTerms)
          return { plan: { ...state.plan, terms: newTerms, requirementGroups: newReqs } }
        }),

      moveCourse: (fromTermId, toTermId, courseId, targetIndex) =>
        set(state => {
          let movedCourse: PlannedCourse | undefined

          const termsWithRemoved = state.plan.terms.map(t => {
            if (t.id === fromTermId) {
              const course = t.courses.find(c => c.id === courseId)
              if (course) movedCourse = course
              return { ...t, courses: t.courses.filter(c => c.id !== courseId) }
            }
            return t
          })

          if (!movedCourse) return state

          const termsWithAdded = termsWithRemoved.map(t => {
            if (t.id === toTermId && t.type === 'study') {
              const newCourses = [...t.courses]
              if (targetIndex !== undefined) {
                newCourses.splice(targetIndex, 0, movedCourse!)
              } else {
                newCourses.push(movedCourse!)
              }
              return { ...t, courses: newCourses }
            }
            return t
          })

          const newTerms = recomputeAllPrereqs(termsWithAdded)
          const newReqs = computeRequirements(state.plan.requirementGroups, newTerms)
          return { plan: { ...state.plan, terms: newTerms, requirementGroups: newReqs } }
        }),

      reorderTerms: (fromIndex, toIndex) =>
        set(state => {
          const terms = [...state.plan.terms]
          const [moved] = terms.splice(fromIndex, 1)
          terms.splice(toIndex, 0, moved)
          const newTerms = recomputeAllPrereqs(terms)
          const newReqs = computeRequirements(state.plan.requirementGroups, newTerms)
          return { plan: { ...state.plan, terms: newTerms, requirementGroups: newReqs } }
        }),

      updateRequirements: (groups) =>
        set(state => {
          const newReqs = computeRequirements(groups, state.plan.terms)
          return { plan: { ...state.plan, requirementGroups: newReqs } }
        }),

      renameTerm: (termId, label) =>
        set(state => ({
          plan: {
            ...state.plan,
            terms: state.plan.terms.map(t => t.id === termId ? { ...t, label } : t),
          },
        })),

      changeTermType: (termId, type) =>
        set(state => {
          const newTerms = recomputeAllPrereqs(
            state.plan.terms.map(t =>
              t.id === termId ? { ...t, type, courses: type === 'study' ? t.courses : [] } : t
            )
          )
          const newReqs = computeRequirements(state.plan.requirementGroups, newTerms)
          return { plan: { ...state.plan, terms: newTerms, requirementGroups: newReqs } }
        }),

      setCourseStatus: (termId, courseId, status) =>
        set(state => {
          const newTerms = recomputeAllPrereqs(
            state.plan.terms.map(t =>
              t.id === termId
                ? { ...t, courses: t.courses.map(pc => pc.id === courseId ? { ...pc, status } : pc) }
                : t
            )
          )
          const newReqs = computeRequirements(state.plan.requirementGroups, newTerms)
          return { plan: { ...state.plan, terms: newTerms, requirementGroups: newReqs } }
        }),

      setCurrentTerm: (termId) =>
        set(state => {
          const termIndex = state.plan.terms.findIndex(t => t.id === termId)
          if (termIndex === -1) return state
          const newTerms = state.plan.terms.map((t, i) => {
            if (t.type !== 'study') return t
            if (i < termIndex) {
              // previous terms: mark all planned/inProgress as completed, leave failed alone
              return {
                ...t,
                courses: t.courses.map(pc =>
                  pc.status === 'failed' ? pc : { ...pc, status: 'completed' as CourseStatus }
                ),
              }
            }
            if (i === termIndex) {
              // current term: mark all non-failed as inProgress
              return {
                ...t,
                courses: t.courses.map(pc =>
                  pc.status === 'failed' ? pc : { ...pc, status: 'inProgress' as CourseStatus }
                ),
              }
            }
            // future terms: reset to planned
            return {
              ...t,
              courses: t.courses.map(pc =>
                pc.status === 'failed' ? pc : { ...pc, status: 'planned' as CourseStatus }
              ),
            }
          })
          const recomputed = recomputeAllPrereqs(newTerms)
          const newReqs = computeRequirements(state.plan.requirementGroups, recomputed)
          return { plan: { ...state.plan, terms: recomputed, requirementGroups: newReqs } }
        }),
    }),
    {
      name: 'academic-goose-plan',
    }
  )
)
