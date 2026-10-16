import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  createWarden,
  deleteWarden,
  getHostels,
  getWardens,
  patchWarden,
} from '../api/client';
import type { AccountStatus, GeofencePublic, WardenPublic, WardenListResponse } from '../api/types';
import { SelectField, TextField } from '../components/Field';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { StatusBadge, accountBadge } from '../components/StatusBadge';
import { Table, type Column } from '../components/Table';
import { errorMessage } from '../components/states';
import { validateWardenForm, type FieldErrors } from '../lib/validation';

const PAGE_SIZE = 20;

/**
 * Warden directory — create, assign hostels, activate/deactivate, reset
 * password, delete. There is no role control anywhere: the backend assigns
 * roles and PATCH /admin/wardens/{username} has no role field.
 */
export function WardensPage() {
  const [data, setData] = useState<WardenListResponse | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [hostels, setHostels] = useState<GeofencePublic[]>([]);

  const [modal, setModal] = useState<
    | { kind: 'create' }
    | { kind: 'edit'; warden: WardenPublic }
    | { kind: 'delete'; warden: WardenPublic }
    | null
  >(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getWardens({ page, page_size: PAGE_SIZE, q: query, account_status: statusFilter })
      .then((response) => setData(response))
      .catch((cause: unknown) => setError(cause))
      .finally(() => setLoading(false));
  }, [page, query, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getHostels()
      .then(setHostels)
      .catch(() => setHostels([])); // hostel names still come from each row
  }, []);

  const columns: Column<WardenPublic>[] = [
    {
      key: 'username',
      header: 'Username',
      render: (warden) => <span className="cell-strong">{warden.username}</span>,
    },
    {
      key: 'hostels',
      header: 'Assigned hostels',
      render: (warden) =>
        warden.hostel_names.length > 0 ? (
          <span>{warden.hostel_names.join(', ')}</span>
        ) : (
          <span className="muted">None</span>
        ),
    },
    {
      key: 'status',
      header: 'Account',
      render: (warden) => <StatusBadge {...accountBadge(warden.account_status)} />,
    },
    {
      key: 'created',
      header: 'Created',
      render: (warden) => (
        <span className="cell-meta tabular">
          {new Date(warden.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (warden) => (
        <span className="row gap-md" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-link"
            onClick={() => setModal({ kind: 'edit', warden })}
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-link"
            onClick={() => void toggleStatus(warden)}
          >
            {warden.account_status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            className="btn-link"
            style={{ color: 'var(--danger-text)' }}
            onClick={() => setModal({ kind: 'delete', warden })}
          >
            Delete
          </button>
        </span>
      ),
    },
  ];

  const toggleStatus = async (warden: WardenPublic) => {
    const account_status: AccountStatus =
      warden.account_status === 'active' ? 'inactive' : 'active';
    try {
      await patchWarden(warden.username, { account_status });
      load();
    } catch (cause) {
      setError(cause);
    }
  };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-md">Wardens</h1>
          <p className="page-sub">
            Warden accounts and their hostel assignments.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setModal({ kind: 'create' })}
        >
          New warden
        </button>
      </header>

      <form className="toolbar" onSubmit={onSearch}>
        <div className="field grow" style={{ minWidth: 240 }}>
          <label htmlFor="warden-search">Search</label>
          <input
            id="warden-search"
            className="input"
            placeholder="Username"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>
        <SelectField
          label="Account status"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </SelectField>
        <button type="submit" className="btn btn-secondary">
          Apply
        </button>
      </form>

      <Table
        caption="Warden accounts"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(warden) => warden.id}
        loading={loading && !data}
        error={error}
        onRetry={load}
        emptyMessage={query || statusFilter ? 'No wardens match these filters.' : 'No wardens yet.'}
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

      {modal?.kind === 'create' ? (
        <WardenFormModal
          title="New warden"
          hostels={hostels}
          onClose={() => setModal(null)}
          onSubmit={async (values) => {
            await createWarden({
              username: values.username.trim(),
              password: values.password,
              hostel_ids: values.hostelIds,
            });
            setModal(null);
            load();
          }}
        />
      ) : null}

      {modal?.kind === 'edit' ? (
        <WardenFormModal
          title={`Edit ${modal.warden.username}`}
          hostels={hostels}
          isNew={false}
          initialUsername={modal.warden.username}
          initialHostelIds={modal.warden.hostel_ids}
          initialAccountStatus={modal.warden.account_status}
          onClose={() => setModal(null)}
          onSubmit={async (values) => {
            const body: Parameters<typeof patchWarden>[1] = {
              hostel_ids: values.hostelIds,
              account_status: values.accountStatus,
            };
            if (values.password.length > 0) body.password = values.password;
            await patchWarden(modal.warden.username, body);
            setModal(null);
            load();
          }}
        />
      ) : null}

      {modal?.kind === 'delete' ? (
        <DeleteWardenModal
          warden={modal.warden}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await deleteWarden(modal.warden.username);
            setModal(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

interface WardenFormValues {
  username: string;
  password: string;
  hostelIds: string[];
  accountStatus: AccountStatus;
}

function WardenFormModal({
  title,
  hostels,
  isNew = true,
  initialUsername = '',
  initialHostelIds = [],
  initialAccountStatus = 'active',
  onSubmit,
  onClose,
}: {
  title: string;
  hostels: GeofencePublic[];
  isNew?: boolean;
  initialUsername?: string;
  initialHostelIds?: string[];
  initialAccountStatus?: AccountStatus;
  onSubmit: (values: WardenFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState('');
  const [hostelIds, setHostelIds] = useState<string[]>(initialHostelIds);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(initialAccountStatus);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleHostel = (id: string) => {
    setHostelIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const validation = validateWardenForm({ username, password }, { isNew });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit({ username, password, hostelIds, accountStatus });
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form className="stack gap-lg" onSubmit={(event) => void submit(event)} noValidate>
        {formError ? (
          <div className="error-state" role="alert">
            <span className="error-title">Couldn't save warden</span>
            <span className="error-message">{formError}</span>
          </div>
        ) : null}

        <TextField
          label="Username"
          required={isNew}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={errors['username']}
          disabled={!isNew || submitting}
          autoComplete="off"
          hint={isNew ? undefined : 'Usernames cannot be changed here.'}
        />

        <TextField
          label={isNew ? 'Password' : 'New password'}
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors['password']}
          disabled={submitting}
          required={isNew}
          hint={isNew ? 'At least 10 characters.' : 'Leave blank to keep the current password.'}
        />

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="label-md muted" style={{ padding: 0, marginBottom: 8 }}>
            Assigned hostels
          </legend>
          {hostels.length === 0 ? (
            <p className="body-sm muted" style={{ margin: 0 }}>
              No hostels exist yet. Create one on the Hostels page first.
            </p>
          ) : (
            <div className="stack gap-sm">
              {hostels.map((hostel) => (
                <label key={hostel.hostel_id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={hostelIds.includes(hostel.hostel_id)}
                    onChange={() => toggleHostel(hostel.hostel_id)}
                    disabled={submitting}
                  />
                  <span>
                    {hostel.name}
                    {hostel.block ? <span className="muted"> · Block {hostel.block}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {!isNew ? (
          <SelectField
            label="Account status"
            value={accountStatus}
            onChange={(event) => setAccountStatus(event.target.value as AccountStatus)}
            disabled={submitting}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </SelectField>
        ) : null}

        <div className="row gap-md" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isNew ? 'Create warden' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteWardenModal({
  warden,
  onConfirm,
  onClose,
}: {
  warden: WardenPublic;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (cause) {
      // e.g. a 409 from the server — shown verbatim, the row is NOT deleted.
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Delete warden" onClose={onClose}>
      <div className="stack gap-lg">
        <p style={{ margin: 0 }}>
          Delete <strong>{warden.username}</strong>? Their sign-in token is revoked
          immediately and they lose access to every hostel.
        </p>
        {error ? (
          <div className="error-state" role="alert">
            <span className="error-title">Couldn't delete warden</span>
            <span className="error-message">{error}</span>
          </div>
        ) : null}
        <div className="row gap-md" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger-solid" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete warden'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
