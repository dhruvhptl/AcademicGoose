import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'code is required' }, { status: 400 })
    }

    const response = await fetch('https://uwflow.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query GetCourse($code: String!) {
            course(where: {code: {_eq: $code}}) {
              code
              name
              rating_liked
              prereqs: course_prerequisites {
                prereq_course {
                  code
                  name
                  rating_liked
                  prereqs: course_prerequisites {
                    prereq_course {
                      code
                      name
                      rating_liked
                      prereqs: course_prerequisites {
                        prereq_course {
                          code
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        variables: { code: code.toLowerCase().replace(/\s+/g, '') },
      }),
    })

    if (!response.ok) {
      throw new Error(`UWFlow responded with ${response.status}`)
    }

    const data = await response.json()
    const courses = data?.data?.course ?? []
    if (courses.length === 0) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    return NextResponse.json(courses[0])
  } catch (error) {
    console.error('Course prereqs error:', error)
    return NextResponse.json({ error: 'Failed to fetch course prereqs' }, { status: 500 })
  }
}
