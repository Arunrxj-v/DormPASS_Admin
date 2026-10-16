import type { GeofencePublic } from '../api/types';
import { SelectField, TextField } from './Field';
import type { FieldErrors, HostelFormValues } from '../lib/validation';

export function emptyHostelFormValues(): HostelFormValues {
  return {
    name: '',
    block: '',
    anchor_label: '',
    latitude: '',
    longitude: '',
    permitted_radius_m: '',
    max_location_accuracy_m: '',
    boundary_policy: 'conservative',
    timezone: 'Asia/Kolkata',
    window_start: '20:30',
    window_end: '22:30',
    require_liveness: true,
    face_match_threshold: '0.75',
    warden_name: '',
    warden_extension: '',
  };
}

export function hostelFormValuesFromHostel(hostel: GeofencePublic): HostelFormValues {
  return {
    name: hostel.name,
    block: hostel.block ?? '',
    anchor_label: hostel.anchor_label ?? '',
    latitude: String(hostel.latitude),
    longitude: String(hostel.longitude),
    permitted_radius_m: String(hostel.permitted_radius_m),
    max_location_accuracy_m: String(hostel.max_location_accuracy_m),
    boundary_policy: hostel.boundary_policy,
    timezone: hostel.timezone,
    window_start: hostel.window_start,
    window_end: hostel.window_end,
    require_liveness: hostel.require_liveness,
    face_match_threshold: String(hostel.face_match_threshold),
    warden_name: hostel.warden_name ?? '',
    warden_extension: hostel.warden_extension ?? '',
  };
}

/**
 * The geofence & policy form shared by hostel create and detail-edit.
 * latitude / longitude / permitted_radius_m / max_location_accuracy_m are
 * required by the API, so they are always shown and validated.
 */
export function HostelFormFields({
  values,
  errors,
  onChange,
  disabled,
  showIdentity = true,
}: {
  values: HostelFormValues;
  errors: FieldErrors;
  onChange: (next: HostelFormValues) => void;
  disabled?: boolean;
  /** Hide name/block on the edit form (PUT is geofence & policy only). */
  showIdentity?: boolean;
}) {
  const set = <K extends keyof HostelFormValues>(key: K, value: HostelFormValues[K]) =>
    onChange({ ...values, [key]: value });

  return (
    <>
      {showIdentity ? (
        <>
          <TextField
            label="Hostel name"
            required
            value={values.name}
            onChange={(event) => set('name', event.target.value)}
            error={errors['name']}
            disabled={disabled}
          />
          <div className="form-row">
            <TextField
              label="Block"
              value={values.block}
              onChange={(event) => set('block', event.target.value)}
              error={errors['block']}
              disabled={disabled}
              placeholder="e.g. B"
            />
            <TextField
              label="Anchor label"
              value={values.anchor_label}
              onChange={(event) => set('anchor_label', event.target.value)}
              error={errors['anchor_label']}
              disabled={disabled}
              placeholder="e.g. Ganga Block B"
            />
          </div>
        </>
      ) : null}

      <span className="micro-label">Geofence — required</span>
      <div className="form-row">
        <TextField
          label="Latitude"
          required
          inputMode="decimal"
          value={values.latitude}
          onChange={(event) => set('latitude', event.target.value)}
          error={errors['latitude']}
          disabled={disabled}
        />
        <TextField
          label="Longitude"
          required
          inputMode="decimal"
          value={values.longitude}
          onChange={(event) => set('longitude', event.target.value)}
          error={errors['longitude']}
          disabled={disabled}
        />
      </div>
      <div className="form-row">
        <TextField
          label="Permitted radius (m)"
          required
          inputMode="decimal"
          value={values.permitted_radius_m}
          onChange={(event) => set('permitted_radius_m', event.target.value)}
          error={errors['permitted_radius_m']}
          disabled={disabled}
        />
        <TextField
          label="Max location accuracy (m)"
          required
          inputMode="decimal"
          value={values.max_location_accuracy_m}
          onChange={(event) => set('max_location_accuracy_m', event.target.value)}
          error={errors['max_location_accuracy_m']}
          disabled={disabled}
        />
      </div>
      <SelectField
        label="Boundary policy"
        value={values.boundary_policy}
        onChange={(event) => set('boundary_policy', event.target.value)}
        disabled={disabled}
        hint="Conservative: the strictest enforcement the platform supports."
      >
        <option value="conservative">Conservative</option>
      </SelectField>

      <span className="micro-label">Attendance policy</span>
      <div className="form-row">
        <TextField
          label="Timezone (IANA)"
          value={values.timezone}
          onChange={(event) => set('timezone', event.target.value)}
          error={errors['timezone']}
          disabled={disabled}
          placeholder="Asia/Kolkata"
        />
        <TextField
          label="Face match threshold (0–1)"
          inputMode="decimal"
          value={values.face_match_threshold}
          onChange={(event) => set('face_match_threshold', event.target.value)}
          error={errors['face_match_threshold']}
          disabled={disabled}
        />
      </div>
      <div className="form-row">
        <TextField
          label="Window start"
          value={values.window_start}
          onChange={(event) => set('window_start', event.target.value)}
          error={errors['window_start']}
          disabled={disabled}
          placeholder="20:30"
        />
        <TextField
          label="Window end"
          value={values.window_end}
          onChange={(event) => set('window_end', event.target.value)}
          error={errors['window_end']}
          disabled={disabled}
          placeholder="22:30"
        />
      </div>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={values.require_liveness}
          onChange={(event) => set('require_liveness', event.target.checked)}
          disabled={disabled}
        />
        <span>
          Require liveness check
          <span className="muted"> — face verification must prove a live person.</span>
        </span>
      </label>

      <span className="micro-label">Warden contact</span>
      <div className="form-row">
        <TextField
          label="Warden name"
          value={values.warden_name}
          onChange={(event) => set('warden_name', event.target.value)}
          error={errors['warden_name']}
          disabled={disabled}
        />
        <TextField
          label="Extension"
          value={values.warden_extension}
          onChange={(event) => set('warden_extension', event.target.value)}
          error={errors['warden_extension']}
          disabled={disabled}
          placeholder="e.g. 204"
        />
      </div>
    </>
  );
}
