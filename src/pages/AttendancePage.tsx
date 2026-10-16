import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  approveAttendance,
  correctAttendance,
  getAttendance,
  rejectAttendance,
} from '../api/client';
import type { AdminAttendanceItem, AttendanceListResponse } from '../api/types';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { SelectField, TextField } from '../components/Field';
import { StatusBadge, attendanceBadge } from '../components/StatusBadge';
import { Table, type Column } from '../components/Table';
import { errorMessage } from '../components/states';

const PAGE_SIZE = 25;

/**
 * Attendance review: filter by student / date / month / status, then approve
 * or reject a pending claim, or apply an audited status correction.
 *
 * Rows synthesized by the server (a day that auto-became `absent` because the
 * curfew window was missed) have no record id and are shown honestly as
 * non-actionable.
 */
export function AttendancePage() {
  const [data, setData] = useState<AttendanceListResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [studentInput, setStudentInput] = useState('');
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('');

  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<AdminAttendanceItem | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getAttendance({
      student_id: studentId,
      date: date || undefined,
      month: date ? undefined : month || undefined,
      status,
      page,
      page_size: PAGE_SIZE,
    })
      .then(setData)
      .catch((cause: unknown) => setError(cause))
      .finally(() => setLoading(false));
  }, [studentId, date, month, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (recordId: string, action: () => Promise<unknown>) => {
    setBusyRow(recordId);
    setActionError(null);
    try {
      await action();
      load();
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setBusyRow(null);
    }
  };

  const columns: Column<AdminAttendanceItem>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => <span className="tabular">{row.date}</span>,
    },
    {
      key: 'student',
      header: 'Student',
      render: (row) => (
        <span className="stack">
          <span className="cell-strong">{row.student.name}</span>
          <span className="cell-meta tabular">{row.student.student_id}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge {...attendanceBadge(row.status)} />,
    },
    {
      key: 'record',
      header: 'Record',
      render: (row) => (
        <span className="stack cell-meta">
          <span>
            {row.outcome ? `Outcome: ${row.outcome}` : 'No stored record'}
          </span>
          {row.reason ? <span>Reason: {row.reason}</span> : null}
          {row.recorded_at_local || row.recorded_at ? (
            <span className="tabular">
              Recorded {row.recorded_at_local ?? row.recorded_at}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'verify',
      header: 'Location check',
      render: (row) => (
        <span className="stack cell-meta tabular">
          <span>{row.distance_m === null ? 'Distance —' : `Distance ${Math.round(row.distance_m)} m`}</span>
          <span>{row.accuracy_m === null ? 'Accuracy —' : `Accuracy ±${Math.round(row.accuracy_m)} m`}</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => {
        if (!row.id) {
          return <span className="cell-meta muted">Synthesized</span>;
        }
        const busy = busyRow === row.id;
        return (
          <span className="row gap-md" style={{ justifyContent: 'flex-end' }}>
            {row.status === 'pending' ? (
              <>
                <button
                  type="button"
                  className="btn-link"
                  disabled={busy}
                  onClick={() => void runAction(row.id as string, () => approveAttendance(row.id as string))}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-link"
                  style={{ color: 'var(--danger-text)' }}
                  disabled={busy}
                  onClick={() => void runAction(row.id as string, () => rejectAttendance(row.id as string))}
                >
                  Reject
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="btn-link"
              disabled={busy}
              onClick={() => setCorrecting(row)}
            >
              Correct
            </button>
          </span>
        );
      },
    },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-md">Attendance</h1>
          <p className="page-sub">
            Daily records across all students, including synthesized absences.
          </p>
        </div>
      </header>

      <form
        className="toolbar"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setPage(1);
          setStudentId(studentInput.trim());
        }}
      >
        <div className="field" style={{ minWidth: 200 }}>
          <label htmlFor="att-student">Student</label>
          <input
            id="att-student"
            className="input"
            placeholder="Roll number"
            value={studentInput}
            onChange={(event) => setStudentInput(event.target.value)}
          />
        </div>
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setPage(1);
          }}
        />
        <TextField
          label="Month"
          type="month"
          value={month}
          onChange={(event) => {
            setMonth(event.target.value);
            setPage(1);
          }}
          disabled={Boolean(date)}
          hint={date ? 'Cleared by choosing a date above.' : 'Defaults to the current month.'}
        />
        <SelectField
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any</option>
          <option value="present">Present</option>
          <option value="pending">Pending</option>
          <option value="absent">Absent</option>
        </SelectField>
        <button type="submit" className="btn btn-secondary">
          Apply
        </button>
      </form>

      {actionError ? (
        <div className="error-state" role="alert">
          <span className="error-title">Action failed</span>
          <span className="error-message">{actionError}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <Table
        caption="Attendance records"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => `${row.date}-${row.student.id}-${row.id ?? 'synthesized'}`}
        loading={loading && !data}
        error={error}
        onRetry={load}
        emptyMessage="No attendance records for this selection."
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

      {correcting ? (
        <CorrectionModal
          record={correcting}
          onClose={() => setCorrecting(null)}
          onSubmit={async (newStatus, reason) => {
            await runAction(correcting.id as string, () =>
              correctAttendance(correcting.id as string, { new_status: newStatus, reason }),
            );
            setCorrecting(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CorrectionModal({
  record,
  onSubmit,
  onClose,
}: {
  record: AdminAttendanceItem;
  onSubmit: (newStatus: 'present' | 'pending' | 'absent', reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [newStatus, setNewStatus] = useState<'present' | 'pending' | 'absent'>(record.status);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ reason?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (reason.trim().length < 3) {
      setErrors({ reason: 'A reason of at least 3 characters is required (it is audit-logged).' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(newStatus, reason.trim());
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Attendance correction" onClose={onClose}>
      <form className="stack gap-lg" onSubmit={(event) => void submit(event)} noValidate>
        <p className="muted" style={{ margin: 0 }}>
          {record.student.name} · <span className="tabular">{record.date}</span>. The
          change and your reason are written to the audit log.
        </p>
        {formError ? (
          <div className="error-state" role="alert">
            <span className="error-title">Couldn't apply correction</span>
            <span className="error-message">{formError}</span>
          </div>
        ) : null}
        <SelectField
          label="New status"
          value={newStatus}
          onChange={(event) => setNewStatus(event.target.value as 'present' | 'pending' | 'absent')}
          disabled={submitting}
          hint="Setting ‘absent’ removes the stored record for that day."
        >
          <option value="present">Present</option>
          <option value="pending">Pending</option>
          <option value="absent">Absent</option>
        </SelectField>
        <div className="field">
          <label htmlFor="correction-reason">
            Reason<span className="field-required"> *</span>
          </label>
          <textarea
            id="correction-reason"
            className="input"
            style={{ height: 80, padding: '10px 12px', resize: 'vertical' }}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={submitting}
            aria-invalid={errors['reason'] ? true : undefined}
          />
          {errors['reason'] ? (
            <span className="field-error" role="alert">
              {errors['reason']}
            </span>
          ) : null}
        </div>
        <div className="row gap-md" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Applying…' : 'Apply correction'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
