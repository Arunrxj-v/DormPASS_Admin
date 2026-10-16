import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { getHostels, getStudents } from '../api/client';
import type {
  EnrollmentStatus,
  GeofencePublic,
  StudentListResponse,
  StudentPublic,
} from '../api/types';
import { Drawer } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { InitialsAvatar } from '../components/StatTile';
import { SelectField } from '../components/Field';
import {
  StatusBadge,
  accountBadge,
  enrollmentBadge,
} from '../components/StatusBadge';
import { Table, type Column } from '../components/Table';

const PAGE_SIZE = 20;

const ENROLLMENT_OPTIONS: { value: EnrollmentStatus; label: string }[] = [
  { value: 'created', label: 'Details incomplete' },
  { value: 'details_verified', label: 'Awaiting face enrollment' },
  { value: 'face_enrolled', label: 'Face enrolled' },
  { value: 'account_provisioned', label: 'Ready for activation' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];

/**
 * Student roster: search + filters + a read-only detail drawer.
 * This page is deliberately read-only and shows NO face data — biometric
 * enrollment lives in the mobile apps, not the admin console.
 */
export function StudentsPage() {
  const [data, setData] = useState<StudentListResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [hostelFilter, setHostelFilter] = useState('');
  const [enrollmentFilter, setEnrollmentFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [hostels, setHostels] = useState<GeofencePublic[]>([]);
  const [selected, setSelected] = useState<StudentPublic | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getStudents({
      page,
      page_size: PAGE_SIZE,
      q: query,
      hostel_id: hostelFilter,
      enrollment_status: enrollmentFilter,
      account_status: accountFilter,
    })
      .then(setData)
      .catch((cause: unknown) => setError(cause))
      .finally(() => setLoading(false));
  }, [page, query, hostelFilter, enrollmentFilter, accountFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getHostels()
      .then(setHostels)
      .catch(() => setHostels([]));
  }, []);

  const columns: Column<StudentPublic>[] = [
    {
      key: 'student',
      header: 'Student',
      render: (student) => (
        <span className="row gap-md">
          <InitialsAvatar name={student.name} />
          <span className="stack">
            <span className="cell-strong">{student.name}</span>
            <span className="cell-meta tabular">{student.student_id}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'email',
      header: 'College email',
      render: (student) =>
        student.email ? <span>{student.email}</span> : <span className="muted">Not set</span>,
    },
    {
      key: 'hostel',
      header: 'Hostel & room',
      render: (student) =>
        student.hostel ? (
          <span className="stack">
            <span>{student.hostel.name}</span>
            <span className="cell-meta">
              {student.hostel.block ? `Block ${student.hostel.block} · ` : ''}
              {student.hostel.room ? `Room ${student.hostel.room}` : 'No room'}
            </span>
          </span>
        ) : (
          <span className="muted">Unassigned</span>
        ),
    },
    {
      key: 'enrollment',
      header: 'Enrollment',
      render: (student) => <StatusBadge {...enrollmentBadge(student.enrollment_status)} />,
    },
    {
      key: 'account',
      header: 'Account',
      render: (student) => <StatusBadge {...accountBadge(student.account_status)} />,
    },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-md">Students</h1>
          <p className="page-sub">
            Roster, enrollment stage and hostel assignment.
          </p>
        </div>
      </header>

      <form
        className="toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          setQuery(searchInput.trim());
        }}
      >
        <div className="field grow" style={{ minWidth: 240 }}>
          <label htmlFor="student-search">Search</label>
          <input
            id="student-search"
            className="input"
            placeholder="Roll number, name or college email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <SelectField
          label="Hostel"
          value={hostelFilter}
          onChange={(event) => {
            setHostelFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All hostels</option>
          {hostels.map((hostel) => (
            <option key={hostel.hostel_id} value={hostel.hostel_id}>
              {hostel.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Enrollment"
          value={enrollmentFilter}
          onChange={(event) => {
            setEnrollmentFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any stage</option>
          {ENROLLMENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Account"
          value={accountFilter}
          onChange={(event) => {
            setAccountFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SelectField>
        <button type="submit" className="btn btn-secondary">
          Apply
        </button>
      </form>

      <Table
        caption="Students"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(student) => student.id}
        loading={loading && !data}
        error={error}
        onRetry={load}
        emptyMessage={
          query || hostelFilter || enrollmentFilter || accountFilter
            ? 'No students match these filters.'
            : 'No students yet.'
        }
        onRowClick={(student) => setSelected(student)}
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

      {selected ? (
        <Drawer title="Student record" onClose={() => setSelected(null)}>
          <StudentDetail student={selected} />
        </Drawer>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="stack gap-xs" style={{ padding: '10px 0', borderBottom: '1px solid var(--hairline)' }}>
      <span className="micro-label">{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Read-only identity view — no face or biometric data, by design. */
function StudentDetail({ student }: { student: StudentPublic }) {
  const enrollment = enrollmentBadge(student.enrollment_status);
  const account = accountBadge(student.account_status);
  return (
    <div className="stack">
      <div className="row gap-md" style={{ paddingBottom: 16 }}>
        <InitialsAvatar name={student.name} />
        <span className="stack">
          <span className="headline-sm">{student.name}</span>
          <span className="cell-meta tabular">{student.student_id}</span>
        </span>
      </div>

      <DetailRow label="College email" value={student.email ?? <span className="muted">Not set</span>} />
      <DetailRow label="Department" value={student.department ?? <span className="muted">Not set</span>} />
      <DetailRow label="Cohort" value={student.cohort ?? <span className="muted">Not set</span>} />
      <DetailRow
        label="Enrollment stage"
        value={<StatusBadge {...enrollment} />}
      />
      <DetailRow label="Account" value={<StatusBadge {...account} />} />
      <DetailRow
        label="Hostel"
        value={
          student.hostel ? (
            <span className="stack">
              <span>{student.hostel.name}</span>
              <span className="cell-meta">
                {student.hostel.block ? `Block ${student.hostel.block} · ` : ''}
                {student.hostel.room ? `Room ${student.hostel.room}` : 'No room assigned'}
              </span>
            </span>
          ) : (
            <span className="muted">Unassigned</span>
          )
        }
      />
      <DetailRow label="Record ID" value={<span className="code-block">{student.id}</span>} />

      <p className="body-sm muted" style={{ marginTop: 16 }}>
        Face enrollment is handled in the student app and is never shown or
        editable here.
      </p>
    </div>
  );
}
