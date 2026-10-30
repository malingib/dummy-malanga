import { Pool, type QueryResultRow } from 'pg'

/**
 * MobiPay's database layer.
 *
 * The API is server-rendered/standalone and previously spoke to Supabase's
 * PostgREST API. It now talks directly to the Neon PostgreSQL database over
 * the standard PostgreSQL protocol. The small query builder below preserves
 * the shape the existing route handlers already use:
 *
 *   const { data, error, count } = await db.from('table').select(...)
 *
 * All identifiers are quoted and all values are parameterised. Embedded
 * PostgREST selects are intentionally not supported; handlers that need a
 * join use an explicit second query instead.
 */

const configuredTimeout = Number(process.env.DATABASE_REQUEST_TIMEOUT_MS || 8_000)
export const DATABASE_REQUEST_TIMEOUT_MS =
  Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 8_000

const connectionString = process.env.DATABASE_URL?.trim()
export const hasDatabaseEnv = Boolean(connectionString)

export type DbError = {
  message: string
  code?: string
  details?: string
  hint?: string
}

export type DbResult<T = any> = {
  data: T | null
  error: DbError | null
  count?: number | null
}

type Order = { column: string; ascending: boolean; nullsFirst?: boolean }
type SingleMode = 'single' | 'maybeSingle' | null
type Operation = 'select' | 'insert' | 'update' | 'upsert' | 'delete'

let pool: Pool | null = null

function getPool(): Pool {
  if (!connectionString) {
    throw Object.assign(new Error('DATABASE_URL is not configured on the API server.'), {
      code: 'DATABASE_NOT_CONFIGURED',
    })
  }
  if (!pool) {
    const local = /(?:^|[/@])(?:localhost|127\.0\.0\.1|::1)(?:[:/]|$)|(?:[?&]host=(?:\/|%2F))/i.test(connectionString)
    const sslDisabled = process.env.DATABASE_SSL === 'disable'
    const configuredMax = Number(process.env.DATABASE_POOL_MAX || 10)
    pool = new Pool({
      connectionString,
      max: Number.isFinite(configuredMax) && configuredMax > 0 ? Math.trunc(configuredMax) : 10,
      connectionTimeoutMillis: DATABASE_REQUEST_TIMEOUT_MS,
      idleTimeoutMillis: 30_000,
      query_timeout: DATABASE_REQUEST_TIMEOUT_MS,
      application_name: 'mobipay-api',
      // Neon requires TLS. Local validation databases usually do not.
      ...(local || sslDisabled ? {} : { ssl: { rejectUnauthorized: false } }),
    })
    pool.on('error', (error) => {
      console.error('[database] idle client error:', error.message)
    })
  }
  return pool
}

export async function query<T extends QueryResultRow = any>(text: string, values: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, values)
  return result.rows
}

export async function closeDatabase() {
  if (!pool) return
  const current = pool
  pool = null
  await current.end()
}

function toDbError(error: unknown): DbError {
  if (error instanceof Error) {
    const pgError = error as Error & { code?: string; details?: string; hint?: string }
    return {
      message: pgError.message,
      ...(pgError.code ? { code: pgError.code } : {}),
      ...(pgError.details ? { details: pgError.details } : {}),
      ...(pgError.hint ? { hint: pgError.hint } : {}),
    }
  }
  return { message: String(error ?? 'Unknown database error.') }
}

function quoteIdent(identifier: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`)
  }
  return `"${identifier}"`
}

function splitTopLevel(input: string, delimiter = ','): string[] {
  const parts: string[] = []
  let current = ''
  let depth = 0
  for (const character of input) {
    if (character === '(') depth += 1
    if (character === ')') depth = Math.max(0, depth - 1)
    if (character === delimiter && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += character
    }
  }
  parts.push(current)
  return parts
}

function selectList(columns: string): string {
  const trimmed = (columns || '*').trim()
  if (!trimmed || trimmed === '*') return '*'
  return splitTopLevel(trimmed)
    .map((part) => {
      const value = part.trim()
      if (!value) return ''
      if (value === '*') return '*'
      if (value.includes('(')) {
        throw new Error('Embedded PostgREST selects are not supported. Use a separate query for related rows.')
      }
      const alias = value.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/i)
      if (alias) return `${quoteIdent(alias[1])} AS ${quoteIdent(alias[2])}`
      return quoteIdent(value)
    })
    .filter(Boolean)
    .join(', ')
}

class Params {
  values: unknown[] = []
  add(value: unknown) {
    this.values.push(value)
    return `$${this.values.length}`
  }
}

function parseList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return splitTopLevel(trimmed.slice(1, -1)).map((item) => item.trim())
    }
    return [trimmed]
  }
  return [value]
}

const comparisonOperators: Record<string, string> = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'LIKE',
  ilike: 'ILIKE',
}

function conditionFragment(column: string, operator: string, value: unknown, params: Params): string {
  const columnSql = quoteIdent(column)
  if (operator === 'is') {
    if (value === null) return `${columnSql} IS NULL`
    if (value === true) return `${columnSql} IS TRUE`
    if (value === false) return `${columnSql} IS FALSE`
    return `${columnSql} IS NOT DISTINCT FROM ${params.add(value)}`
  }
  if (operator === 'in') {
    const values = parseList(value)
    if (!values.length) return 'FALSE'
    return `${columnSql} IN (${values.map((item) => params.add(item)).join(', ')})`
  }
  const sqlOperator = comparisonOperators[operator]
  if (!sqlOperator) throw new Error(`Unsupported filter operator: ${operator}`)
  return `${columnSql} ${sqlOperator} ${params.add(value)}`
}

function parseOrCondition(condition: string, params: Params): string {
  const firstDot = condition.indexOf('.')
  const secondDot = firstDot < 0 ? -1 : condition.indexOf('.', firstDot + 1)
  if (firstDot <= 0 || secondDot <= firstDot + 1) {
    throw new Error(`Unsupported OR filter: ${condition}`)
  }
  const column = condition.slice(0, firstDot).trim()
  const operator = condition.slice(firstDot + 1, secondDot).trim()
  const value = condition.slice(secondDot + 1)
  return conditionFragment(column, operator, value, params)
}

class QueryBuilder<T = any> implements PromiseLike<DbResult<T>> {
  private operation: Operation = 'select'
  private selectColumns = '*'
  private countMode: 'exact' | null = null
  private head = false
  private filters: Array<{ kind: 'raw'; sql: (params: Params) => string }> = []
  private orders: Order[] = []
  private limitValue: number | null = null
  private offsetValue = 0
  private singleMode: SingleMode = null
  private payload: unknown = null
  private onConflict: string[] = []
  private ignoreDuplicates = false

  constructor(private readonly table: string) {}

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.selectColumns = columns || '*'
    this.countMode = options?.count === 'exact' ? 'exact' : null
    this.head = Boolean(options?.head)
    return this
  }

  insert(values: unknown) {
    this.operation = 'insert'
    this.payload = values
    return this
  }

  update(values: Record<string, unknown>) {
    this.operation = 'update'
    this.payload = values
    return this
  }

  upsert(values: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.operation = 'upsert'
    this.payload = values
    this.onConflict = (options?.onConflict || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    this.ignoreDuplicates = Boolean(options?.ignoreDuplicates)
    return this
  }

  delete() {
    this.operation = 'delete'
    return this
  }

  eq(column: string, value: unknown) {
    return this.addFilter(column, 'eq', value)
  }

  neq(column: string, value: unknown) {
    return this.addFilter(column, 'neq', value)
  }

  gt(column: string, value: unknown) {
    return this.addFilter(column, 'gt', value)
  }

  gte(column: string, value: unknown) {
    return this.addFilter(column, 'gte', value)
  }

  lt(column: string, value: unknown) {
    return this.addFilter(column, 'lt', value)
  }

  lte(column: string, value: unknown) {
    return this.addFilter(column, 'lte', value)
  }

  like(column: string, value: unknown) {
    return this.addFilter(column, 'like', value)
  }

  ilike(column: string, value: unknown) {
    return this.addFilter(column, 'ilike', value)
  }

  is(column: string, value: unknown) {
    return this.addFilter(column, 'is', value)
  }

  in(column: string, values: unknown[]) {
    return this.addFilter(column, 'in', values)
  }

  filter(column: string, operator: string, value: unknown) {
    return this.addFilter(column, operator, value)
  }

  not(column: string, operator: string, value: unknown) {
    const columnSql = quoteIdent(column)
    this.filters.push({
      kind: 'raw',
      sql: (params) => {
        if (operator === 'in') {
          const values = parseList(value)
          if (!values.length) return 'TRUE'
          return `${columnSql} NOT IN (${values.map((item) => params.add(item)).join(', ')})`
        }
        if (operator === 'is') {
          if (value === null) return `${columnSql} IS NOT NULL`
          if (value === true) return `${columnSql} IS NOT TRUE`
          if (value === false) return `${columnSql} IS NOT FALSE`
        }
        const sqlOperator = comparisonOperators[operator]
        if (!sqlOperator) throw new Error(`Unsupported NOT filter operator: ${operator}`)
        return `NOT (${columnSql} ${sqlOperator} ${params.add(value)})`
      },
    })
    return this
  }

  or(expression: string) {
    const conditions = splitTopLevel(expression).map((condition) => condition.trim()).filter(Boolean)
    this.filters.push({
      kind: 'raw',
      sql: (params) => `(${conditions.map((condition) => parseOrCondition(condition, params)).join(' OR ')})`,
    })
    return this
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    if (!column || column === '*') return this
    this.orders.push({
      column,
      ascending: options?.ascending !== false,
      ...(typeof options?.nullsFirst === 'boolean' ? { nullsFirst: options.nullsFirst } : {}),
    })
    return this
  }

  limit(value: number) {
    const parsed = Math.trunc(value)
    this.limitValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
    return this
  }

  range(from: number, to: number) {
    const start = Math.max(0, Math.trunc(from))
    const end = Math.trunc(to)
    this.offsetValue = start
    this.limitValue = Number.isFinite(end) && end >= start ? end - start + 1 : 0
    return this
  }

  single() {
    this.singleMode = 'single'
    return this
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle'
    return this
  }

  private addFilter(column: string, operator: string, value: unknown) {
    this.filters.push({ kind: 'raw', sql: (params) => conditionFragment(column, operator, value, params) })
    return this
  }

  private whereSql(params: Params) {
    if (!this.filters.length) return ''
    return ` WHERE ${this.filters.map((filter) => filter.sql(params)).join(' AND ')}`
  }

  private returningSql() {
    return selectList(this.selectColumns)
  }

  private applySingle(data: any[]): { data: any; error: DbError | null } {
    if (!this.singleMode) return { data, error: null }
    if (data.length === 1) return { data: data[0], error: null }
    if (data.length === 0 && this.singleMode === 'maybeSingle') return { data: null, error: null }
    return {
      data: null,
      error: {
        code: 'PGRST116',
        message:
          data.length === 0
            ? 'JSON object requested, but no rows were returned.'
            : 'JSON object requested, but multiple rows were returned.',
      },
    }
  }

  private orderSql() {
    if (!this.orders.length) return ''
    return ` ORDER BY ${this.orders
      .map((order) => {
        const direction = order.ascending ? 'ASC' : 'DESC'
        const nulls = order.nullsFirst === undefined ? '' : order.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST'
        return `${quoteIdent(order.column)} ${direction}${nulls}`
      })
      .join(', ')}`
  }

  private pagingSql() {
    if (this.limitValue === null) return ''
    return ` LIMIT ${this.limitValue} OFFSET ${this.offsetValue}`
  }

  private async executeSelect(): Promise<DbResult<T>> {
    const tableSql = quoteIdent(this.table)
    const params = new Params()
    const where = this.whereSql(params)
    const returning = this.returningSql()

    if (this.head) {
      const rows = await query<{ count: string }>(`SELECT count(*)::bigint AS count FROM ${tableSql}${where}`, params.values)
      return { data: null, error: null, count: Number(rows[0]?.count || 0) }
    }

    const countPromise = this.countMode === 'exact'
      ? query<{ count: string }>(`SELECT count(*)::bigint AS count FROM ${tableSql}${where}`, params.values)
      : null
    const rowsPromise = query(`SELECT ${returning} FROM ${tableSql}${where}${this.orderSql()}${this.pagingSql()}`, params.values)
    const [rows, countRows] = await Promise.all([rowsPromise, countPromise])
    const single = this.applySingle(rows as any[])
    return {
      ...single,
      count: countRows ? Number(countRows[0]?.count || 0) : null,
    } as DbResult<T>
  }

  private insertSql(operation: 'insert' | 'upsert') {
    const rawRows = Array.isArray(this.payload) ? this.payload : [this.payload]
    const rows = rawRows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
    if (!rows.length) return null

    const columns = Array.from(
      new Set(rows.flatMap((row) => Object.keys(row).filter((key) => row[key] !== undefined))),
    )
    if (!columns.length) {
      return `INSERT INTO ${quoteIdent(this.table)} DEFAULT VALUES RETURNING ${this.returningSql()}`
    }

    const params = new Params()
    const values = rows.map((row) => {
      const placeholders = columns.map((column) => (row[column] === undefined ? 'DEFAULT' : params.add(row[column])))
      return `(${placeholders.join(', ')})`
    })
    let sql = `INSERT INTO ${quoteIdent(this.table)} (${columns.map(quoteIdent).join(', ')}) VALUES ${values.join(', ')}`
    if (operation === 'upsert' && this.onConflict.length) {
      sql += ` ON CONFLICT (${this.onConflict.map(quoteIdent).join(', ')})`
      if (this.ignoreDuplicates) {
        sql += ' DO NOTHING'
      } else {
        const updates = columns.filter((column) => !this.onConflict.includes(column))
        sql += updates.length
          ? ` DO UPDATE SET ${updates.map((column) => `${quoteIdent(column)} = EXCLUDED.${quoteIdent(column)}`).join(', ')}`
          : ' DO NOTHING'
      }
    }
    sql += ` RETURNING ${this.returningSql()}`
    return { sql, params }
  }

  private async executeWrite(): Promise<DbResult<T>> {
    if (this.operation === 'insert' || this.operation === 'upsert') {
      const statement = this.insertSql(this.operation)
      if (!statement) return { data: [] as any, error: null, count: null }
      if (typeof statement === 'string') {
        const rows = await query(statement)
        return { ...this.applySingle(rows as any[]), count: null } as DbResult<T>
      }
      const rows = await query(statement.sql, statement.params.values)
      return { ...this.applySingle(rows as any[]), count: null } as DbResult<T>
    }

    const params = new Params()
    const returning = this.returningSql()

    if (this.operation === 'delete') {
      const where = this.whereSql(params)
      const rows = await query(`DELETE FROM ${quoteIdent(this.table)}${where} RETURNING ${returning}`, params.values)
      return { ...this.applySingle(rows as any[]), count: null } as DbResult<T>
    }

    const updates = Object.entries(this.payload as Record<string, unknown> || {})
      .filter(([, value]) => value !== undefined)
    if (!updates.length) return { data: [] as any, error: null, count: null }
    const setSql = updates.map(([column, value]) => `${quoteIdent(column)} = ${params.add(value)}`).join(', ')
    const where = this.whereSql(params)

    const rows = await query(
      `UPDATE ${quoteIdent(this.table)} SET ${setSql}${where} RETURNING ${returning}`,
      params.values,
    )
    return { ...this.applySingle(rows as any[]), count: null } as DbResult<T>
  }

  async execute(): Promise<DbResult<T>> {
    try {
      if (this.operation === 'select') return await this.executeSelect()
      return await this.executeWrite()
    } catch (error) {
      return { data: null, error: toDbError(error), count: null }
    }
  }

  then<TResult1 = DbResult<T>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }
}

class DatabaseClient {
  from<T = any>(table: string) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(table)) throw new Error(`Unsafe SQL table name: ${table}`)
    return new QueryBuilder<T>(table)
  }

  async rpc(name: string, params: Record<string, unknown> = {}): Promise<DbResult> {
    try {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Unsafe SQL function name: ${name}`)
      const keys = Object.keys(params)
      const values = keys.map((key) => params[key])
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
      const rows = await query<QueryResultRow>(
        `SELECT * FROM ${quoteIdent('public')}.${quoteIdent(name)}(${placeholders})`,
        values,
      )
      if (!rows.length) return { data: null, error: null }
      if (rows.length === 1 && Object.keys(rows[0]).length === 1) {
        const only = Object.values(rows[0])[0]
        return { data: only, error: null }
      }
      if (rows.length === 1) return { data: rows[0], error: null }
      return { data: rows, error: null }
    } catch (error) {
      return { data: null, error: toDbError(error) }
    }
  }

  async query<T extends QueryResultRow = any>(text: string, values: unknown[] = []) {
    return query<T>(text, values)
  }
}

export const db = new DatabaseClient()
