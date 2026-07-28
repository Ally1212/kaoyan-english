interface FetchResponse {
  ok: boolean
  headers?: { get: (name: string) => string | null }
  text?: () => Promise<string>
  json?: () => Promise<unknown>
}

export type JsonFetcher = (input: string, init?: RequestInit) => Promise<FetchResponse>

export interface JsonResponse {
  ok: boolean
  payload: unknown
}

export async function fetchJsonWithTimeout(
  fetcher: JsonFetcher,
  input: string,
  init: RequestInit,
  timeoutMs: number,
  maxBytes: number,
): Promise<JsonResponse> {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      controller.abort()
      reject(new Error('Request timed out'))
    }, timeoutMs)
  })

  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(input, { ...init, signal: controller.signal })
        if (!response.ok) return { ok: false, payload: null }

        const declaredLength = Number(response.headers?.get('content-length'))
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
          throw new Error('Response is too large')
        }

        if (response.text) {
          const text = await response.text()
          if (new TextEncoder().encode(text).length > maxBytes) {
            throw new Error('Response is too large')
          }
          return { ok: true, payload: JSON.parse(text) }
        }

        if (!response.json) throw new Error('Response body is unavailable')
        return { ok: true, payload: await response.json() }
      })(),
      timeout,
    ])
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
  }
}
