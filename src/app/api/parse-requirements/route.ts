import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured' },
      { status: 500 }
    )
  }

  try {
    const { url } = await req.json()

    if (!url || !url.includes('uwaterloo.ca')) {
      return NextResponse.json({ error: 'Invalid URL. Must be a uwaterloo.ca URL.' }, { status: 400 })
    }

    // Fetch the HTML from the undergraduate calendar
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AcademicGoose/1.0)',
      },
    })

    if (!pageResponse.ok) {
      throw new Error(`Failed to fetch page: ${pageResponse.status}`)
    }

    const html = await pageResponse.text()

    // Truncate HTML to avoid token limits — first 50k chars
    const truncatedHtml = html.slice(0, 50000)

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are parsing a UWaterloo undergraduate calendar page to extract degree requirements.

Here is the HTML content:
<html>
${truncatedHtml}
</html>

Please extract the degree requirements and return them as a JSON array of RequirementGroup objects.
Each RequirementGroup should have:
- id: string (generated, like "req-1")
- name: string (name of the requirement group)
- description: string (optional short description)
- required: number (how many courses are needed)
- courses: string[] (course codes that can satisfy this requirement, e.g. ["CS 135", "CS 136"])
- completed: string[] (always empty array [])

Return ONLY valid JSON array, no explanation. Example format:
[
  {
    "id": "req-1",
    "name": "Core CS",
    "description": "Required computer science courses",
    "required": 8,
    "courses": ["CS 135", "CS 136", "CS 241"],
    "completed": []
  }
]`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Try to parse the JSON response
    let requirements
    try {
      // Extract JSON array from response (in case there's extra text)
      const jsonMatch = content.text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('No JSON array found in response')
      }
      requirements = JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('Failed to parse Claude response as JSON')
    }

    return NextResponse.json({ requirements })
  } catch (error) {
    console.error('Parse requirements error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
