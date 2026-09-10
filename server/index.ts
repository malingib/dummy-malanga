import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { ApiRequest, ApiResponse, withRequestContext, writeResponse } from './http'

type HandlerModule = Record<string, any>
type Route = { pattern: string; load: () => Promise<HandlerModule> }

const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 1024 * 1024)
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30_000)
const HEADER_TIMEOUT_MS = Number(process.env.HEADER_TIMEOUT_MS || 10_000)

const routes: Route[] = [
  ['admin/reconcile', 'server/routes/admin/reconcile/route.ts'],
  ['cases', 'server/routes/cases/route.ts'],
  ['dashboard/stats', 'server/routes/dashboard/stats/route.ts'],
  ['developer/keys', 'server/routes/developer/keys/route.ts'],
  ['developer/webhooks', 'server/routes/developer/webhooks/route.ts'],
  ['developer/webhooks/deliveries', 'server/routes/developer/webhooks/deliveries/route.ts'],
  ['developer/keys/:id', 'server/routes/developer/keys/[id]/route.ts'],
  ['developer/webhooks/:id', 'server/routes/developer/webhooks/[id]/route.ts'],
  ['internal/webhooks/process', 'server/routes/internal/webhooks/process/route.ts'],
  ['members', 'server/routes/members/route.ts'],
  ['members/import', 'server/routes/members/import/route.ts'],
  ['mpesa/activation', 'server/routes/mpesa/activation/route.ts'],
  ['mpesa/admin', 'server/routes/mpesa/admin/route.ts'],
  ['mpesa/c2b/confirmation', 'server/routes/mpesa/c2b/confirmation/route.ts'],
  ['mpesa/c2b/validation', 'server/routes/mpesa/c2b/validation/route.ts'],
  ['mpesa/confirmation', 'server/routes/mpesa/confirmation/route.ts'],
  ['mpesa/connections', 'server/routes/mpesa/connections/route.ts'],
  ['mpesa/health', 'server/routes/mpesa/health/route.ts'],
  ['mpesa/simulate', 'server/routes/mpesa/simulate/route.ts'],
  ['mpesa/stk/callback', 'server/routes/mpesa/stk/callback/route.ts'],
  ['mpesa/token', 'server/routes/mpesa/token/route.ts'],
  ['mpesa/validation', 'server/routes/mpesa/validation/route.ts'],
  ['onboarding', 'server/routes/onboarding/route.ts'],
  ['payments/reconciliation', 'server/routes/payments/reconciliation/route.ts'],
  ['payments/reconciliation/exceptions', 'server/routes/payments/reconciliation/exceptions/route.ts'],
  ['payments/reconciliation/exceptions/:id', 'server/routes/payments/reconciliation/exceptions/[id]/route.ts'],
  ['payments/stk', 'server/routes/payments/stk/route.ts'],
  ['payments/stk/status', 'server/routes/payments/stk/status/route.ts'],
  ['payments/transactions', 'server/routes/payments/transactions/route.ts'],
  ['payments/transactions/:id', 'server/routes/payments/transactions/[id]/route.ts'],
  ['settings', 'server/routes/settings/route.ts'],
  ['sms/delivery', 'server/routes/sms/delivery/route.ts'],
  ['sms/templates', 'server/routes/sms/templates/route.ts'],
  ['transactions', 'server/routes/transactions/route.ts'],
  ['transactions/:id/reconcile', 'server/routes/transactions/[id]/reconcile/route.ts'],
  ['transactions/:id', 'server/routes/transactions/[id]/route.ts'],
  ['v1/payments/stk', 'server/routes/v1/payments/stk/route.ts'],
  ['v1/payments/:id', 'server/routes/v1/payments/[id]/route.ts'],
].map(([pattern, file]) => ({
  pattern: `/${pattern}`,
  load: () => import(pathToFileURL(`${process.cwd()}/${file}`).href),
}))

function match(pattern: string, pathname: string): Record<string, string> | null {
  const expected = pattern.split('/').filter(Boolean)
  const actual = pathname.split('/').filter(Boolean)
  if (expected.length !== actual.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < expected.length; i++) {
    const left = expected[i]
    const right = actual[i]
    if (left.startsWith(':')) params[left.slice(1)] = decodeURIComponent(right)
    else if (left !== right) return null
  }
  return params
}

function setSecurityHeaders(res: http.ServerResponse) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
}

function cors(req: http.IncomingMessage, res: http.ServerResponse) {
  const configuredOrigins = (process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
  if (requestOrigin && configuredOrigins.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-Callback-Validation-Token, X-Cron-Secret')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Max-Age', '600')
}

function reject(res: http.ServerResponse, status: number, error: string) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.end(JSON.stringify({ error }))
}

function isCallbackRoute(pathname: string) {
  return pathname === '/api/mpesa/confirmation' ||
    pathname === '/api/mpesa/c2b/confirmation' ||
    pathname === '/api/mpesa/c2b/validation' ||
    pathname === '/api/mpesa/stk/callback' ||
    pathname === '/api/mpesa/validation'
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const contentLength = Number(req.headers['content-length'] || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Request body too large.'), { statusCode: 413 })
  }

  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) {
      req.destroy()
      throw Object.assign(new Error('Request body too large.'), { statusCode: 413 })
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res)
  cors(req, res)

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname === '/health' || url.pathname === '/api/health') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ status: 'ok', service: 'mobipay-api', framework: 'node-http', timestamp: new Date().toISOString() }))
  }
  if (url.pathname === '/ready' || url.pathname === '/api/ready') {
    const ready = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
    res.statusCode = ready ? 200 : 503
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ status: ready ? 'ready' : 'not_ready', service: 'mobipay-api' }))
  }
  if (!url.pathname.startsWith('/api/')) return reject(res, 404, 'Not found.')

  const pathname = url.pathname.slice('/api'.length).replace(/\/$/, '') || '/'
  const route = routes.find((candidate) => match(candidate.pattern, pathname))
  if (!route) return reject(res, 404, 'API route not found.')

  try {
    const body = await readBody(req)
    const request = new ApiRequest(req, body, process.env.PUBLIC_API_PROTOCOL || 'http')
    const publicOrigin = process.env.PUBLIC_API_ORIGIN
    if (publicOrigin) request.nextUrl.href = `${publicOrigin.replace(/\/$/, '')}${url.pathname}${url.search}`
    const params = match(route.pattern, pathname) || {}
    const module = await route.load()
    const handler = module[req.method || 'GET']
    if (typeof handler !== 'function') {
      const allowed = Object.keys(module).filter((key) => ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(key))
      if (allowed.length) res.setHeader('Allow', allowed.join(', '))
      return reject(res, 405, 'Method not allowed.')
    }
    const response = await withRequestContext(request, () => handler(request, { params: Promise.resolve(params) }))
    if (response instanceof ApiResponse) return writeResponse(res, response)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify(response ?? {}))
  } catch (error) {
    const statusCode = typeof error === 'object' && error && 'statusCode' in error && typeof error.statusCode === 'number'
      ? error.statusCode
      : 500
    if (statusCode === 413) return reject(res, 413, 'Request body too large.')
    console.error('[mobipay-api] request failed', {
      method: req.method,
      path: req.url,
      callback: isCallbackRoute(url.pathname),
      error: error instanceof Error ? error.message : error,
    })
    return reject(res, 500, 'Internal server error.')
  }
})

server.requestTimeout = REQUEST_TIMEOUT_MS
server.headersTimeout = HEADER_TIMEOUT_MS
server.keepAliveTimeout = 5_000
server.maxRequestsPerSocket = 1_000

const port = Number(process.env.PORT || 4000)
const host = process.env.HOST || '0.0.0.0'
server.listen(port, host, () => console.log(`[mobipay-api] listening on ${host}:${port}`))

function shutdown(signal: string) {
  console.log(`[mobipay-api] received ${signal}; shutting down`)
  server.close((error) => {
    if (error) {
      console.error('[mobipay-api] graceful shutdown failed', error)
      process.exitCode = 1
    }
  })
  setTimeout(() => process.exit(0), 10_000).unref()
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))
