import { AsyncLocalStorage } from 'node:async_hooks'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'

export type CookieOptions = {
  httpOnly?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  secure?: boolean
  path?: string
  maxAge?: number
  expires?: Date
}

export type CookieStore = {
  get(name: string): { name: string; value: string } | undefined
}

type RequestContext = { request: ApiRequest }
const requestStorage = new AsyncLocalStorage<RequestContext>()

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>()
  for (const part of (header || '').split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const name = part.slice(0, index).trim()
    const rawValue = part.slice(index + 1).trim()
    if (!name) continue
    try {
      cookies.set(name, decodeURIComponent(rawValue))
    } catch {
      cookies.set(name, rawValue)
    }
  }
  return cookies
}

export class ApiRequest {
  readonly method: string
  readonly url: string
  readonly headers: Headers
  readonly nextUrl: URL
  private readonly raw: IncomingMessage
  private readonly bodyPromise: Promise<unknown>

  constructor(raw: IncomingMessage, body: string, protocol = process.env.PUBLIC_API_PROTOCOL || 'http') {
    this.raw = raw
    this.method = raw.method || 'GET'
    this.url = `${protocol}://${raw.headers.host || 'localhost'}${raw.url || '/'}`
    this.headers = new Headers()
    for (const [key, value] of Object.entries(raw.headers as IncomingHttpHeaders)) {
      if (Array.isArray(value)) this.headers.set(key, value.join(', '))
      else if (value !== undefined) this.headers.set(key, value)
    }
    this.nextUrl = new URL(this.url)
    this.bodyPromise = Promise.resolve(body ? JSON.parse(body) : {})
  }

  async json<T = any>(): Promise<T> {
    return (await this.bodyPromise) as T
  }

  get socket() {
    return this.raw.socket
  }
}

export class ApiResponse {
  status = 200
  body: unknown = null
  headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' })
  private setCookies: string[] = []

  constructor(body: unknown, status = 200, headers?: HeadersInit) {
    this.body = body
    this.status = status
    if (headers) {
      for (const [key, value] of new Headers(headers).entries()) this.headers.set(key, value)
    }
  }

  get ok() {
    return this.status >= 200 && this.status < 300
  }

  async json<T = any>(): Promise<T> {
    return this.body as T
  }

  clone() {
    const copy = new ApiResponse(this.body, this.status, this.headers)
    copy.setCookies = [...this.setCookies]
    return copy
  }

  get cookies() {
    const response = this
    return {
      set(name: string, value: string, options: CookieOptions = {}) {
        const parts = [`${name}=${encodeURIComponent(value)}`]
        if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`)
        if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)
        if (options.httpOnly) parts.push('HttpOnly')
        if (options.secure) parts.push('Secure')
        if (options.path) parts.push(`Path=${options.path}`)
        if (options.sameSite) parts.push(`SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`)
        response.setCookies.push(parts.join('; '))
      },
      headers: response.setCookies,
    }
  }

  getSetCookieHeaders() {
    return this.setCookies
  }
}

export class NextRequest extends ApiRequest {}

export class NextResponse extends ApiResponse {
  static json(body: unknown, init: ResponseInit = {}) {
    return new NextResponse(body, init.status || 200, init.headers)
  }
}

export async function cookies(): Promise<CookieStore> {
  const request = requestStorage.getStore()?.request
  const values = parseCookies(request?.headers.get('cookie') || '')
  return { get: (name: string) => values.has(name) ? { name, value: values.get(name)! } : undefined }
}

export async function withRequestContext<T>(request: ApiRequest, fn: () => Promise<T>): Promise<T> {
  return requestStorage.run({ request }, fn)
}

export function writeResponse(res: ServerResponse, response: ApiResponse): void {
  res.statusCode = response.status
  for (const [key, value] of response.headers.entries()) res.setHeader(key, value)
  const cookies = response.getSetCookieHeaders()
  if (cookies.length) res.setHeader('Set-Cookie', cookies)
  const payload = JSON.stringify(response.body ?? {})
  res.end(payload)
}
