import { NextRequest, NextResponse } from 'next/server'
import { uwflowQuery, formatCode } from '@/lib/uwflow'

interface UWFlowCourse {
  code: string
  name: string
  prereqs: string | null
  antireqs: string | null
  description: string | null
  rating: { liked: number | null; filled_count: number } | null
}

interface SubjectCoursesResponse {
  data: { course: UWFlowCourse[] }
}

export async function POST(req: NextRequest) {
  const { subject } = await req.json()
  if (!subject || typeof subject !== 'string') {
    return NextResponse.json({ error: 'subject is required' }, { status: 400 })
  }

  const subjectLower = subject.trim().toLowerCase()

  try {
    const data = await uwflowQuery<SubjectCoursesResponse>(
      `query SubjectCourses($prefix: String!) {
        course(
          where: { code: { _like: $prefix } }
          order_by: { code: asc }
        ) {
          code
          name
          prereqs
          antireqs
          description
          rating {
            liked
            filled_count
          }
        }
      }`,
      { prefix: `${subjectLower}%` }
    )

    const raw = data?.data?.course ?? []
    const courses = raw
      .filter(c => !/xx/i.test(c.code))
      .map(c => ({
        code: formatCode(c.code),
        title: c.name,
        description: c.description,
        prerequisites: c.prereqs,
        antirequisites: c.antireqs,
        rating_liked: c.rating?.liked ?? null,
        rating_count: c.rating?.filled_count ?? null,
      }))

    return NextResponse.json({ courses })
  } catch (error) {
    console.error('Courses error:', error)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 502 })
  }
}
