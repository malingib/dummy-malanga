import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../api'
import {
  Alert,
  EmptyState,
  PageHeader,
  Panel,
  SkeletonList,
} from '../../components/primitives'
import { dateTime, exportCsv, relativeTime, titleCase } from '../ui'

export function AdminAuditPage() {
  const audit = useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () => adminApi.audit({ limit: 200 }),
  })

  const rows = audit.data?.data || []

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Audit trail"
        description="Platform administrator actions across merchant workspaces, with targets and metadata captured for review."
        actions={
          <>
            <button
              type="button"
              onClick={() => exportCsv(
                'mobiwave-platform-audit.csv',
                rows as unknown as Array<Record<string, unknown>>,
                [
                  { key: 'created_at', label: 'Time' },
                  { key: 'actor_name', label: 'Actor' },
                  { key: 'action', label: 'Action' },
                  { key: 'business_name', label: 'Merchant' },
                  { key: 'target_type', label: 'Target type' },
                  { key: 'target_id', label: 'Target id' },
                  { key: 'metadata', label: 'Metadata' },
                ],
              )}
              disabled={!rows.length}
            >
              Export CSV
            </button>
            <button type="button" className="primary" onClick={() => audit.refetch()} disabled={audit.isFetching}>
              {audit.isFetching ? 'Refreshing…' : 'Refresh'}
            </button>
          </>
        }
      />

      {audit.error && <Alert text={audit.error instanceof Error ? audit.error.message : 'The audit trail could not be loaded.'} />}
      {audit.data?.warning && <div className="alert warning" role="status">{audit.data.warning}</div>}

      <Panel title="Administrative actions" subtitle="Newest first. The audit trail is append-only; records are never edited from this console.">
        {audit.isPending ? (
          <SkeletonList rows={10} />
        ) : audit.isError ? (
          <EmptyState title="Audit trail unavailable" copy="Fix the platform database connection using the error above, then refresh." />
        ) : rows.length ? (
          <div className="table-wrap">
            <table>
              <caption className="visually-hidden">Platform administrator audit trail</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Merchant</th>
                  <th scope="col">Target</th>
                  <th scope="col">Metadata</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id}>
                    <td>{dateTime(entry.created_at)}<small>{relativeTime(entry.created_at)}</small></td>
                    <td><strong>{entry.actor_name || 'System'}</strong></td>
                    <td><strong>{titleCase(entry.action)}</strong><small>{entry.action}</small></td>
                    <td>{entry.workspace_id ? <Link to={`/admin/merchants/${entry.workspace_id}`} className="row-link">{entry.business_name || 'Unknown merchant'}</Link> : 'Platform'}</td>
                    <td>{entry.target_type || '—'}<small>{entry.target_id ? String(entry.target_id).slice(0, 18) : ''}</small></td>
                    <td><code className="admin-metadata">{entry.metadata && Object.keys(entry.metadata).length ? JSON.stringify(entry.metadata) : '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No audit entries yet" copy={audit.data?.migration_required ? 'Apply migration 018 to enable the platform audit trail.' : 'Administrative decisions and sign-ins will appear here.'} />
        )}
      </Panel>
    </>
  )
}
