import http from 'node:http'
import { pathToFileURL } from 'node:url'
import { ApiRequest, ApiResponse, withRequestContext, writeResponse } from './http'

type HandlerModule = Record<string, any>
type Route = { pattern: string; load: () => Promise<HandlerModule> }

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
