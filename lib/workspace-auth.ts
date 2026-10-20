import { supabase, supabaseAdmin } from './supabase'

export type WorkspaceRequest = {
  headers: {
    get(name: string): string | null
  }
}

export type AuthorizedWorkspace = {
  workspaceId: string
  userId: string
}

/**
 * Resolves the workspace only after validating the caller's Supabase access
 * token and confirming that the authenticated user owns the workspace.
 *
 * The workspace cookie is an untrusted locator, never an authorization grant.
 * This helper intentionally fails closed and currently authorizes workspace
 * owners only; team membership should be added through an explicit membership
 * table and role policy rather than trusting a client-provided workspace ID.
 */
export async function authorizeWorkspace(
  request: WorkspaceRequest,
): Promise<AuthorizedWorkspace | null> {
  const authorization = request.headers.get('authorization') || ''
  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  if (!match?.[1]) return null

  const { data: authData, error: authError } = await supabase.auth.getUser(match[1])
  const user = authData?.user
  if (authError || !user?.id) return null

  const cookieHeader = request.headers.get('cookie') || ''
  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('mobiwave_workspace_id='))
  if (!cookie) return null

  let workspaceId = ''
  try {
    workspaceId = decodeURIComponent(cookie.slice('mobiwave_workspace_id='.length)).trim()
  } catch {
    return null
  }
  if (!workspaceId || workspaceId.length > 128) return null

  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from('payment_workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (workspaceError || !workspace?.id) return null
  return { workspaceId: String(workspace.id), userId: user.id }
}
