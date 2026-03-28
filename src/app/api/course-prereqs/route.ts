import { NextRequest, NextResponse } from 'next/server'
import { uwflowQuery } from '@/lib/uwflow'

interface RawCourse {
  code: string
  name: string
  prereqs?: string | null
  prerequisites?: Array<{ prerequisite: RawCourse }>
}

interface CourseQueryResponse {
  data: { course: RawCourse[] }
}

// Remap UWFlow's schema to the shape ExploreSidebar expects:
// prerequisites[].prerequisite → prereqs[].prereq_course
function remapCourse(c: RawCourse): object {
  return {
    code: c.code,
    name: c.name,
    prereqsText: c.prereqs ?? null,
    prereqs: (c.prerequisites ?? []).map(p => ({
      prereq_course: remapCourse(p.prerequisite),
    })),
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const data = await uwflowQuery<CourseQueryResponse>(
      `query GetCourse($code: String!) {
        course(where: {code: {_eq: $code}}) {
          code
          name
          prereqs
          prerequisites {
            prerequisite {
              code
              name
              prereqs
              prerequisites {
                prerequisite {
                  code
                  name
                  prereqs
                  prerequisites {
                    prerequisite {
                      code
                      name
                      prereqs
                    }
                  }
                }
              }
            }
          }
        }
      }`,
      { code: code.toLowerCase().replace(/\s+/g, '') }
    )

    const courses = data?.data?.course ?? []
    if (courses.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    return NextResponse.json(remapCourse(courses[0]))
  } catch (error) {
    console.error('Course prereqs error:', error)
    return NextResponse.json({ error: 'Failed to fetch course prereqs' }, { status: 500 })
  }
}
