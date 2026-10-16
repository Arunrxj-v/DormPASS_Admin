import { useCallback, useEffect, useState } from 'react';

import { getAuditLogs } from '../api/client';
import type { AuditLogListResponse } from '../api/types';
import { Pagination } from '../components/Pagination';
import { Table, type Column } from '../components/Table';
import type { AuditLogPublic } from '../api/types';

const PAGE_SIZE = 25;

/** Paginated audit log — who did what, when, and with what parameters. */
export function AuditPage() {
  const [data, setData] = useState<AuditLogListResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAuditLogs({ page, page_size: PAGE_SIZE })
      .then(setData)
      .catch((cause: unknown) => setError(cause))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<AuditLogPublic>[] = [
    {
      key: 'created',
      header: 'Time',
      render: (row) => (
        <span className="cell-meta tabular" style={{ whiteSpace: 'nowrap' }}>
          {new Date(row.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (row) => <span className="cell-strong">{row.actor}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <span className="tabular">{row.action}</span>,
    },
    {
      key: 'target',
      header: 'Target',
      render: (row) => (
        <span className="stack cell-meta">
          <span>{row.target_type}</span>
          {row.target_id ? (
            <span className="tabular" title={row.target_id} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {row.target_id}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (row) =>
        row.details && Object.keys(row.details).length > 0 ? (
          <details>
            <summary className="btn-link" style={{ cursor: 'pointer', listStyle: 'none' }}>
              View
            </summary>
            <pre className="code-block" style={{ marginTop: 8 }}>
              {JSON.stringify(row.details, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="muted">—</span>
        ),
    },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-md">Audit log</h1>
          <p className="page-sub">
            Every administrative action, newest first.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </header>

      <Table
        caption="Audit log"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        loading={loading && !data}
        error={error}
        onRetry={load}
        emptyMessage="No audit entries."
      />

      {data ? (
        <Pagination
          page={data.page}
          pageSize={data.page_size}
          totalItems={data.items.length}
          hasNext={data.has_more}
          onPage={setPage}
          busy={loading}
        />
      ) : null}
    </div>
  );
}
