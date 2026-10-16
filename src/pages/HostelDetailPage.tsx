import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  createRoom,
  deleteRoom,
  getHostel,
  getRooms,
  patchRoom,
  updateHostel,
} from '../api/client';
import type { GeofencePublic, RoomPublic, RoomListResponse } from '../api/types';
import { HostelFormFields, hostelFormValuesFromHostel } from '../components/HostelForm';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { TextField } from '../components/Field';
import { Table, type Column } from '../components/Table';
import { LoadingState, errorMessage } from '../components/states';
import {
  hostelFormToPayload,
  validateHostelForm,
  validateRoomForm,
  type FieldErrors,
  type HostelFormValues,
  type RoomFormValues,
} from '../lib/validation';

const ROOMS_PAGE_SIZE = 20;

/** Hostel detail: geofence/policy editor (PUT) + the room registry. */
export function HostelDetailPage() {
  const { hostelId = '' } = useParams();

  const [hostel, setHostel] = useState<GeofencePublic | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [values, setValues] = useState<HostelFormValues | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [rooms, setRooms] = useState<RoomListResponse | null>(null);
  const [roomsError, setRoomsError] = useState<unknown>(null);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomPage, setRoomPage] = useState(1);
  const [roomModal, setRoomModal] = useState<
    { kind: 'create' } | { kind: 'edit'; room: RoomPublic } | { kind: 'delete'; room: RoomPublic } | null
  >(null);

  const loadHostel = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    getHostel(hostelId)
      .then((data) => {
        setHostel(data);
        setValues(hostelFormValuesFromHostel(data));
      })
      .catch((cause: unknown) => setLoadError(cause))
      .finally(() => setLoading(false));
  }, [hostelId]);

  const loadRooms = useCallback(() => {
    setRoomsLoading(true);
    setRoomsError(null);
    getRooms(hostelId, { page: roomPage, page_size: ROOMS_PAGE_SIZE })
      .then(setRooms)
      .catch((cause: unknown) => setRoomsError(cause))
      .finally(() => setRoomsLoading(false));
  }, [hostelId, roomPage]);

  useEffect(() => loadHostel(), [loadHostel]);
  useEffect(() => loadRooms(), [loadRooms]);

  const saveGeofence = async (event: FormEvent) => {
    event.preventDefault();
    if (!values) return;
    setSaveError(null);
    const validation = validateHostelForm(values, { isNew: false });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const { name: _name, block: _block, ...update } = hostelFormToPayload(values);
    // PUT is geofence & policy only — identity (name/block) is not touched.

    setSaving(true);
    try {
      const updated = await updateHostel(hostelId, update);
      setHostel(updated);
      setValues(hostelFormValuesFromHostel(updated));
    } catch (cause) {
      setSaveError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const roomColumns: Column<RoomPublic>[] = [
    {
      key: 'identifier',
      header: 'Room',
      render: (room) => <span className="cell-strong tabular">{room.identifier}</span>,
    },
    {
      key: 'capacity',
      header: 'Capacity',
      render: (room) =>
        room.capacity === null ? <span className="muted">Not set</span> : <span className="tabular">{room.capacity}</span>,
    },
    {
      key: 'occupancy',
      header: 'Occupied',
      render: (room) => <span className="tabular">{room.student_count}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (room) => (
        <span className="row gap-md" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn-link" onClick={() => setRoomModal({ kind: 'edit', room })}>
            Edit
          </button>
          <button
            type="button"
            className="btn-link"
            style={{ color: 'var(--danger-text)' }}
            onClick={() => setRoomModal({ kind: 'delete', room })}
          >
            Delete
          </button>
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="page">
        <LoadingState label="Loading hostel…" />
      </div>
    );
  }

  if (loadError || !hostel || !values) {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1 className="headline-md">Hostel</h1>
            <p className="page-sub">
              <Link to="/hostels">← Back to hostels</Link>
            </p>
          </div>
        </header>
        <div className="error-state" role="alert">
          <span className="error-title">Couldn't load this hostel</span>
          <span className="error-message">{errorMessage(loadError)}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadHostel}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="micro-label">
            <Link to="/hostels" style={{ color: 'inherit' }}>
              Hostels
            </Link>{' '}
            / {hostel.block ? `Block ${hostel.block}` : 'Hostel'}
          </span>
          <h1 className="headline-md">{hostel.name}</h1>
          <p className="page-sub">
            {hostel.anchor_label ? `${hostel.anchor_label} · ` : ''}
            <span className="tabular">
              {hostel.latitude}, {hostel.longitude} · ±{hostel.permitted_radius_m} m
            </span>
          </p>
        </div>
      </header>

      <section className="stack gap-lg">
        <span className="micro-label">Geofence & attendance policy</span>
        <form className="section-card stack gap-lg" onSubmit={(event) => void saveGeofence(event)} noValidate>
          {saveError ? (
            <div className="error-state" role="alert">
              <span className="error-title">Couldn't save configuration</span>
              <span className="error-message">{saveError}</span>
            </div>
          ) : null}

          <HostelFormFields
            values={values}
            errors={errors}
            onChange={setValues}
            disabled={saving}
            showIdentity={false}
          />

          <div className="row gap-md" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save geofence & policy'}
            </button>
          </div>
        </form>
      </section>

      <section className="stack gap-md">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="micro-label">Rooms</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRoomModal({ kind: 'create' })}>
            New room
          </button>
        </div>
        <Table
          caption="Rooms"
          columns={roomColumns}
          rows={rooms?.items ?? []}
          rowKey={(room) => room.id}
          loading={roomsLoading && !rooms}
          error={roomsError}
          onRetry={loadRooms}
          emptyMessage="No rooms registered for this hostel yet."
        />
        {rooms ? (
          <Pagination
            page={rooms.page}
            pageSize={rooms.page_size}
            totalItems={rooms.items.length}
            hasNext={rooms.has_more}
            onPage={setRoomPage}
            busy={roomsLoading}
          />
        ) : null}
      </section>

      {roomModal?.kind === 'create' ? (
        <RoomModal
          title="New room"
          onClose={() => setRoomModal(null)}
          onSubmit={async (form) => {
            await createRoom(hostelId, {
              identifier: form.identifier.trim(),
              ...(form.capacity.trim() ? { capacity: Number(form.capacity) } : {}),
            });
            setRoomModal(null);
            loadRooms();
            loadHostel();
          }}
        />
      ) : null}

      {roomModal?.kind === 'edit' ? (
        <RoomModal
          title={`Edit room ${roomModal.room.identifier}`}
          initial={{ identifier: roomModal.room.identifier, capacity: roomModal.room.capacity === null ? '' : String(roomModal.room.capacity) }}
          onClose={() => setRoomModal(null)}
          onSubmit={async (form) => {
            await patchRoom(roomModal.room.id, {
              identifier: form.identifier.trim(),
              capacity: form.capacity.trim() ? Number(form.capacity) : null,
            });
            setRoomModal(null);
            loadRooms();
          }}
        />
      ) : null}

      {roomModal?.kind === 'delete' ? (
        <DeleteRoomModal
          room={roomModal.room}
          onClose={() => setRoomModal(null)}
          onConfirm={async () => {
            await deleteRoom(roomModal.room.id);
            setRoomModal(null);
            loadRooms();
            loadHostel();
          }}
        />
      ) : null}
    </div>
  );
}

function RoomModal({
  title,
  initial = { identifier: '', capacity: '' },
  onSubmit,
  onClose,
}: {
  title: string;
  initial?: RoomFormValues;
  onSubmit: (values: RoomFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RoomFormValues>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const validation = validateRoomForm(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (cause) {
      // e.g. 409 duplicate identifier in this hostel.
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
            <span className="error-title">Couldn't save room</span>
            <span className="error-message">{formError}</span>
          </div>
        ) : null}
        <TextField
          label="Room identifier"
          required
          value={form.identifier}
          onChange={(event) => setForm({ ...form, identifier: event.target.value })}
          error={errors['identifier']}
          disabled={submitting}
          placeholder="e.g. 314"
        />
        <TextField
          label="Capacity"
          inputMode="numeric"
          value={form.capacity}
          onChange={(event) => setForm({ ...form, capacity: event.target.value })}
          error={errors['capacity']}
          disabled={submitting}
          hint="Optional. Whole number 1–1000."
        />
        <div className="row gap-md" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save room'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteRoomModal({
  room,
  onConfirm,
  onClose,
}: {
  room: RoomPublic;
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
      // The server 409s if students are still assigned — shown verbatim.
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Delete room" onClose={onClose}>
      <div className="stack gap-lg">
        <p style={{ margin: 0 }}>
          Delete room <strong className="tabular">{room.identifier}</strong>?{' '}
          {room.student_count > 0 ? (
            <>
              <strong>{room.student_count}</strong> student(s) are still assigned to
              it — the server will refuse until they are moved.
            </>
          ) : (
            'No students are currently assigned to it.'
          )}
        </p>
        {error ? (
          <div className="error-state" role="alert">
            <span className="error-title">Couldn't delete room</span>
            <span className="error-message">{error}</span>
          </div>
        ) : null}
        <div className="row gap-md" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger-solid" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete room'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
