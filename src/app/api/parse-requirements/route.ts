import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENROUTER_API_KEY is not configured' },
      { status: 500 }
    )
  }

  try {
    const { text } = await req.json()

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://academicgoose.app',
        'X-Title': 'Academic Goose',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `You are parsing UWaterloo undergraduate program requirements text to extract structured degree requirements.

Here is the requirements text:
<requirements>
${text.slice(0, 60000)}
</requirements>

Extract all degree requirement groups and return them as a JSON array of RequirementGroup objects.

Each RequirementGroup must have:
- id: string (generated sequentially, like "req-1", "req-2")
- name: string (short descriptive name for this requirement group)
- description: string (optional brief description, or empty string)
- required: number (how many courses from the list are needed to satisfy this requirement)
- courses: string[] (UWaterloo course codes that satisfy this requirement, e.g. ["PHYS 121", "PHYS 122"] — uppercase with space between subject and number)
- completed: [] (always empty)

Guidelines:
- Group related requirements logically (e.g. "Core Physics", "Math Requirements", "Electives")
- If a requirement says "choose N of the following", set required=N and list all the options in courses
- If a requirement says "must take all of", set required equal to courses.length
- Normalize course codes to uppercase with space: "phys121" → "PHYS 121"
- Skip non-course requirements (GPA minimums, residency rules, etc.)
- If the text mentions a specific number of units/courses, use that for required

Return ONLY a valid JSON array, no explanation, no markdown fences.`,
          },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter responded with ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from model')
    }

    let requirements
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found in response')
      requirements = JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('Failed to parse model response as JSON')
    }

    return NextResponse.json({ requirements })
  } catch (error) {
    console.error('Parse requirements error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
