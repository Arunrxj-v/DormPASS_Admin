import { useCallback, useEffect, useState } from 'react';

import { getStats } from '../api/client';
import type { AdminStats, EnrollmentStatus } from '../api/types';
import { StatTile } from '../components/StatTile';
import { ErrorState, LoadingState } from '../components/states';
import { enrollmentLabel } from '../components/StatusBadge';

const LIFECYCLE: EnrollmentStatus[] = [
  'created',
  'details_verified',
  'face_enrolled',
  'account_provisioned',
  'active',
];

/** Dashboard — every number comes straight from GET /admin/stats. */
export function DashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getStats()
      .then((data) => setStats(data))
      .catch((cause: unknown) => setError(cause))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-md">Dashboard</h1>
          <p className="page-sub">Institution-wide counters, live from the admin API.</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </header>

      {loading && !stats ? <LoadingState label="Loading counters…" /> : null}
      {error ? <ErrorState error={error} onRetry={load} title="Couldn't load dashboard stats" /> : null}

      {stats ? (
        <>
          <section className="stack gap-md">
            <span className="micro-label">Institution</span>
            <div className="stat-grid">
              <StatTile label="Hostels" value={stats.hostels} />
              <StatTile label="Rooms" value={stats.rooms} />
              <StatTile
                label="Wardens (active / total)"
                value={`${stats.wardens.active} / ${stats.wardens.total}`}
                title={`${stats.wardens.inactive} inactive`}
              />
              <StatTile label="Students" value={stats.students.total} />
            </div>
          </section>

          <section className="stack gap-md">
            <span className="micro-label">Student accounts</span>
            <div className="stat-grid">
              <StatTile label="Active" value={stats.students.active} />
              <StatTile label="Pending enrollment" value={stats.students.pending_enrollment} />
              <StatTile label="Suspended" value={stats.students.suspended} />
            </div>
          </section>

          <section className="stack gap-md">
            <span className="micro-label">Enrollment pipeline</span>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Stage</th>
                    <th scope="col" style={{ textAlign: 'right' }}>
                      Students
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {LIFECYCLE.map((stage) => (
                    <tr key={stage}>
                      <td>{enrollmentLabel(stage)}</td>
                      <td className="tabular" style={{ textAlign: 'right' }}>
                        {stats.students.by_status[stage] ?? 0}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>Suspended</td>
                    <td className="tabular" style={{ textAlign: 'right' }}>
                      {stats.students.suspended}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
