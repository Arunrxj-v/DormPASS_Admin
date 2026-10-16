import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { createHostel, getHostels } from '../api/client';
import type { GeofencePublic } from '../api/types';
import { HostelFormFields, emptyHostelFormValues } from '../components/HostelForm';
import { Modal } from '../components/Modal';
import { Table, type Column } from '../components/Table';
import { errorMessage } from '../components/states';
import {
  hostelFormToPayload,
  validateHostelForm,
  type FieldErrors,
  type HostelFormValues,
} from '../lib/validation';

/**
 * Hostel registry — geofence & attendance-policy configuration. This is the
 * config the Student/Warden apps cannot touch; every verify enforces it.
 */
export function HostelsPage() {
  const [hostels, setHostels] = useState<GeofencePublic[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getHostels()
      .then(setHostels)
      .catch((cause: unknown) => setError(cause))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns: Column<GeofencePublic>[] = [
    {
      key: 'name',
      header: 'Hostel',
      render: (hostel) => (
        <span className="stack">
          <Link
            to={`/hostels/${hostel.hostel_id}`}
            className="cell-strong"
            style={{ color: 'var(--primary)', textDecoration: 'none' }}
          >
            {hostel.name}
          </Link>
          {hostel.block ? <span className="cell-meta">Block {hostel.block}</span> : null}
        </span>
      ),
    },
    {
      key: 'geofence',
      header: 'Geofence',
      render: (hostel) => (
        <span className="stack cell-meta">
          <span className="tabular">
            {hostel.latitude}, {hostel.longitude}
          </span>
          <span className="tabular">
            ±{hostel.permitted_radius_m} m · accuracy ≤{hostel.max_location_accuracy_m} m
          </span>
        </span>
      ),
    },
    {
      key: 'window',
      header: 'Attendance window',
      render: (hostel) => (
        <span className="stack cell-meta">
          <span className="tabular">
            {hostel.window_start}–{hostel.window_end}
          </span>
          <span>{hostel.timezone}</span>
        </span>
      ),
    },
    {
      key: 'warden',
      header: 'Warden',
      render: (hostel) =>
        hostel.warden_name ? (
          <span>
            {hostel.warden_name}
            {hostel.warden_extension ? (
              <span className="cell-meta"> · ext {hostel.warden_extension}</span>
            ) : null}
          </span>
        ) : (
          <span className="muted">Not set</span>
        ),
    },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="headline-md">Hostels</h1>
          <p className="page-sub">
            Geofence anchors, attendance windows and room registries.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          New hostel
        </button>
      </header>

      <Table
        caption="Hostels"
        columns={columns}
        rows={hostels ?? []}
        rowKey={(hostel) => hostel.hostel_id}
        loading={loading && !hostels}
        error={error}
        onRetry={load}
        emptyMessage="No hostels yet."
      />

      {creating ? (
        <CreateHostelModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateHostelModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [values, setValues] = useState<HostelFormValues>(emptyHostelFormValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const validation = validateHostelForm(values, { isNew: true });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await createHostel(hostelFormToPayload(values));
      onCreated();
    } catch (cause) {
      // e.g. 409 duplicate name+block — shown verbatim from the envelope.
      setFormError(errorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="New hostel" onClose={onClose}>
      <form className="stack gap-lg" onSubmit={(event) => void submit(event)} noValidate>
        {formError ? (
          <div className="error-state" role="alert">
            <span className="error-title">Couldn't create hostel</span>
            <span className="error-message">{formError}</span>
          </div>
        ) : null}

        <HostelFormFields values={values} errors={errors} onChange={setValues} disabled={submitting} />

        <div className="row gap-md" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create hostel'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
