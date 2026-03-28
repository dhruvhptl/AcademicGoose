const UWFLOW_URL = 'https://uwflow.com/graphql'

const UWFLOW_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Origin': 'https://uwflow.com',
  'Referer': 'https://uwflow.com/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
}

export async function uwflowQuery<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const res = await fetch(UWFLOW_URL, {
    method: 'POST',
    headers: UWFLOW_HEADERS,
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    throw new Error(`UWFlow responded with ${res.status}`)
  }

  const data = await res.json()

  if (data.errors) {
    throw new Error(`UWFlow GraphQL error: ${JSON.stringify(data.errors)}`)
  }

  return data
}

/**
 * Normalize any course code variant to a canonical key for comparisons.
 * Strips spaces, uppercases everything: "phys 360a" / "PHYS360A" → "PHYS360A"
 */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase()
}

/**
 * Format a raw course code for display: "phys360a" / "PHYS360A" → "PHYS 360A"
 * Handles optional trailing letter suffix on the number part.
 */
export function formatCode(raw: string): string {
  const match = raw.replace(/\s+/g, '').match(/^([a-zA-Z]+)(\d+[a-zA-Z]?)$/)
  if (match) return `${match[1].toUpperCase()} ${match[2].toUpperCase()}`
  return raw.toUpperCase()
}
