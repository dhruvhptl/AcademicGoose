import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()

    const response = await fetch('https://uwflow.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query SearchCourses($query: String!) {
            search_courses(args: {query: $query}, limit: 20) {
              code
              name
              rating_liked
            }
          }
        `,
        variables: { query },
      }),
    })

    if (!response.ok) {
      throw new Error(`UWFlow responded with ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Search courses error:', error)
    return NextResponse.json({ error: 'Failed to search courses' }, { status: 500 })
  }
}
