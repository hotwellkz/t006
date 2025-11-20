class ApiError extends Error {
  status?: number
  body?: unknown
  isNetworkError: boolean

  constructor(message: string, status?: number, body?: unknown, isNetworkError = false, cause?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.isNetworkError = isNetworkError
    if (cause) {
      // @ts-expect-error cause доступен в новых версиях Node/TS, но для обратной совместимости присваиваем вручную
      this.cause = cause
    }
  }
}

const rawBaseUrl = import.meta.env.VITE_API_URL?.trim()
const API_BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : ''

if (import.meta.env.PROD && !API_BASE_URL) {
  console.warn(
    '[apiClient] VITE_API_URL не задан. Запросы будут отправляться относительно домена фронтенда. Для production необходимо указать публичный backend URL.'
  )
}

const isAbsoluteUrl = (url: string) => /^https?:\/\//i.test(url)

export function resolveApiUrl(path: string): string {
  if (!path) return ''
  if (isAbsoluteUrl(path)) return path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const targetUrl = resolveApiUrl(path)

  let response: Response
  try {
    response = await fetch(targetUrl, options)
  } catch (error) {
    throw new ApiError('NETWORK_ERROR', undefined, undefined, true, error)
  }

  if (!response.ok) {
    let body: unknown = null
    try {
      const clone = response.clone()
      const contentType = clone.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        body = await clone.json()
      } else {
        body = await clone.text()
      }
    } catch {
      // игнорируем ошибки парсинга тела
    }

    const message =
      (typeof body === 'object' && body !== null && 'error' in body && String((body as Record<string, unknown>).error)) ||
      (typeof body === 'object' && body !== null && 'message' in body && String((body as Record<string, unknown>).message)) ||
      `Request failed with status ${response.status}`

    throw new ApiError(message, response.status, body)
  }

  return response
}

export async function apiFetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(path, options)
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json() as Promise<T>
  }

  const text = await response.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError('Unexpected response format', response.status, text)
  }
}

export { ApiError, API_BASE_URL }


