import { NextRequest, NextResponse } from 'next/server'
import { uwflowQuery } from '@/lib/uwflow'

interface SearchCoursesResponse {
  data: {
    search_courses: Array<{
      code: string
      name: string
      liked: number | null
      ratings: number | null
      rating_liked?: number | null
    }>
  }
}

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()

    // UWFlow errors on spaces in course codes (e.g. "cs 341" → error, "cs341" → ok)
    const normalizedQuery = query.replace(/\s+/g, '')

    const data = await uwflowQuery<SearchCoursesResponse>(
      `query SearchCourses($query: String!, $codeOnly: Boolean!) {
        search_courses(args: {query: $query, code_only: $codeOnly}, limit: 20) {
          code
          name
          liked
          ratings
        }
      }`,
      { query: normalizedQuery, codeOnly: false }
    )

    if (data?.data?.search_courses) {
      data.data.search_courses = data.data.search_courses
        .filter((c) => !/xx/i.test(c.code))
        .map((c) => ({ ...c, rating_liked: c.liked ?? null }))
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Search courses error:', error)
    return NextResponse.json({ error: 'Failed to search courses' }, { status: 500 })
  }
}
