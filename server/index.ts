import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { ApiRequest, ApiResponse, withRequestContext, writeResponse } from './http'

type HandlerModule = Record<string, any>
type Route = { pattern: string; load: () => Promise<HandlerModule> }

const routes: Route[] = [
  ['admin/reconcile', 'app/api/admin/reconcile/route.ts'],
  ['cases', 'app/api/cases/route.ts'],
  ['dashboard/stats', 'app/api/dashboard/stats/route.ts'],
  ['developer/keys', 'app/api/developer/keys/route.ts'],
  ['developer/webhooks', 'app/api/developer/webhooks/route.ts'],
  ['developer/webhooks/deliveries', 'app/api/developer/webhooks/deliveries/route.ts'],
  ['developer/keys/:id', 'app/api/developer/keys/[id]/route.ts'],
  ['developer/webhooks/:id', 'app/api/developer/webhooks/[id]/route.ts'],
  ['internal/webhooks/process', 'app/api/internal/webhooks/process/route.ts'],
  ['members', 'app/api/members/route.ts'],
  ['members/import', 'app/api/members/import/route.ts'],
  ['mpesa/activation', 'app/api/mpesa/activation/route.ts'],
  ['mpesa/admin', 'app/api/mpesa/admin/route.ts'],
  ['mpesa/c2b/confirmation', 'app/api/mpesa/c2b/confirmation/route.ts'],
  ['mpesa/c2b/validation', 'app/api/mpesa/c2b/validation/route.ts'],
  ['mpesa/confirmation', 'app/api/mpesa/confirmation/route.ts'],
  ['mpesa/connections', 'app/api/mpesa/connections/route.ts'],
  ['mpesa/health', 'app/api/mpesa/health/route.ts'],
  ['mpesa/simulate', 'app/api/mpesa/simulate/route.ts'],
  ['mpesa/stk/callback', 'app/api/mpesa/stk/callback/route.ts'],
  ['mpesa/token', 'app/api/mpesa/token/route.ts'],
  ['mpesa/validation', 'app/api/mpesa/validation/route.ts'],
  ['onboarding', 'app/api/onboarding/route.ts'],
  ['payments/reconciliation', 'app/api/payments/reconciliation/route.ts'],
  ['payments/reconciliation/exceptions', 'app/api/payments/reconciliation/exceptions/route.ts'],
  ['payments/reconciliation/exceptions/:id', 'app/api/payments/reconciliation/exceptions/[id]/route.ts'],
  ['payments/stk', 'app/api/payments/stk/route.ts'],
  ['payments/stk/status', 'app/api/payments/stk/status/route.ts'],
  ['payments/transactions', 'app/api/payments/transactions/route.ts'],
  ['payments/transactions/:id', 'app/api/payments/transactions/[id]/route.ts'],
  ['settings', 'app/api/settings/route.ts'],
  ['sms/delivery', 'app/api/sms/delivery/route.ts'],
  ['sms/templates', 'app/api/sms/templates/route.ts'],
  ['transactions', 'app/api/transactions/route.ts'],
  ['transactions/:id/reconcile', 'app/api/transactions/[id]/reconcile/route.ts'],
  ['transactions/:id', 'app/api/transactions/[id]/route.ts'],
  ['v1/payments/stk', 'app/api/v1/payments/stk/route.ts'],
  ['v1/payments/:id', 'app/api/v1/payments/[id]/route.ts'],
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

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

function cors(req: http.IncomingMessage, res: http.ServerResponse) {
  const configuredOrigin = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN
  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
  const origin = configuredOrigin || requestOrigin
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
}

const server = http.createServer(async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  if (url.pathname === '/health' || url.pathname === '/api/health') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ status: 'ok', service: 'mobipay-api', framework: 'node-http', timestamp: new Date().toISOString() }))
  }
  if (!url.pathname.startsWith('/api/')) {
    res.statusCode = 404
    return res.end(JSON.stringify({ error: 'Not found' }))
  }

  const pathname = url.pathname.slice('/api'.length).replace(/\/$/, '') || '/'
  const route = routes.find((candidate) => match(candidate.pattern, pathname))
  if (!route) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ error: 'API route not found.' }))
  }

  try {
    const body = await readBody(req)
    const request = new ApiRequest(req, body, process.env.PUBLIC_API_PROTOCOL || 'http')
    const publicOrigin = process.env.PUBLIC_API_ORIGIN
    if (publicOrigin) request.nextUrl.href = `${publicOrigin.replace(/\/$/, '')}${url.pathname}${url.search}`
    const params = match(route.pattern, pathname) || {}
    const module = await route.load()
    const handler = module[req.method || 'GET']
    if (typeof handler !== 'function') {
      res.statusCode = 405
      res.setHeader('Allow', Object.keys(module).filter((key) => ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(key)).join(', '))
      return res.end(JSON.stringify({ error: 'Method not allowed.' }))
    }
    const response = await withRequestContext(request, () => handler(request, { params: Promise.resolve(params) }))
    if (response instanceof ApiResponse) return writeResponse(res, response)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify(response ?? {}))
  } catch (error) {
    console.error('[mobipay-api] request failed', error)
    res.statusCode = 500
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error.' }))
  }
})

const port = Number(process.env.PORT || 4000)
const host = process.env.HOST || '0.0.0.0'
server.listen(port, host, () => console.log(`[mobipay-api] listening on ${host}:${port}`))
