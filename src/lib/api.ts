const base = () => (import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? '')

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

function parseJsonBody(text: string): unknown {
  const t = text.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    throw new ApiError('服务器返回了非 JSON 内容', 502, { raw: text.slice(0, 500) })
  }
}

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  })
  const text = await res.text()
  const data = parseJsonBody(text)
  if (!res.ok) {
    const msg =
      typeof (data as { message?: string } | null)?.message === 'string'
        ? (data as { message: string }).message
        : res.statusText
    throw new ApiError(msg, res.status, data)
  }
  return data as T
}
