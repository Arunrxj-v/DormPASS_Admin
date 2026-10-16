/**
 * Client-side form validation.
 *
 * These rules mirror the server's pydantic constraints (they exist to give
 * fast inline feedback, NOT as the source of truth — every submission is
 * still validated by the API, and server-side errors are surfaced verbatim).
 */

import type { HostelCreateBody } from '../api/types';

export type FieldErrors = Record<string, string>;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface WardenFormValues {
  username: string;
  password: string;
}

/**
 * Warden create/edit validation. The server enforces username 3–64 chars
 * with no whitespace and password ≥ 10 chars.
 */
export function validateWardenForm(
  values: WardenFormValues,
  { isNew }: { isNew: boolean },
): FieldErrors {
  const errors: FieldErrors = {};
  const username = values.username.trim();
  const password = values.password;

  if (isNew) {
    if (!username) {
      errors['username'] = 'Username is required.';
    } else if (/\s/.test(values.username)) {
      errors['username'] = 'Username cannot contain whitespace.';
    } else if (username.length < 3) {
      errors['username'] = 'Username must be at least 3 characters.';
    } else if (username.length > 64) {
      errors['username'] = 'Username must be at most 64 characters.';
    }
  }

  if (password.length > 0) {
    if (password.length < 10) {
      errors['password'] = 'Password must be at least 10 characters.';
    } else if (password.length > 128) {
      errors['password'] = 'Password must be at most 128 characters.';
    }
  } else if (isNew) {
    errors['password'] = 'Password is required.';
  }

  return errors;
}

export interface HostelFormValues {
  name: string;
  block: string;
  anchor_label: string;
  latitude: string;
  longitude: string;
  permitted_radius_m: string;
  max_location_accuracy_m: string;
  boundary_policy: string;
  timezone: string;
  window_start: string;
  window_end: string;
  require_liveness: boolean;
  face_match_threshold: string;
  warden_name: string;
  warden_extension: string;
}

function requiredNumber(
  errors: FieldErrors,
  field: keyof HostelFormValues & string,
  raw: string,
  label: string,
  { min, max }: { min: number; max: number },
): void {
  const value = Number(raw);
  if (raw.trim() === '') {
    errors[field] = `${label} is required.`;
  } else if (!Number.isFinite(value)) {
    errors[field] = `${label} must be a number.`;
  } else if (value < min || value > max) {
    errors[field] = `${label} must be between ${min} and ${max}.`;
  }
}

/**
 * Hostel geofence & policy validation. latitude / longitude /
 * permitted_radius_m / max_location_accuracy_m are REQUIRED by the API —
 * a hostel without a usable geofence would silently deny attendance for
 * every student in it, so the server refuses to create one.
 */
export function validateHostelForm(
  values: HostelFormValues,
  { isNew }: { isNew: boolean },
): FieldErrors {
  const errors: FieldErrors = {};

  if (isNew && !values.name.trim()) {
    errors['name'] = 'Hostel name is required.';
  }

  requiredNumber(errors, 'latitude', values.latitude, 'Latitude', {
    min: -90,
    max: 90,
  });
  requiredNumber(errors, 'longitude', values.longitude, 'Longitude', {
    min: -180,
    max: 180,
  });
  requiredNumber(
    errors,
    'permitted_radius_m',
    values.permitted_radius_m,
    'Permitted radius (m)',
    { min: 0.01, max: 100_000 },
  );
  requiredNumber(
    errors,
    'max_location_accuracy_m',
    values.max_location_accuracy_m,
    'Max location accuracy (m)',
    { min: 0.01, max: 10_000 },
  );

  if (values.timezone.trim() && !isValidTimeZone(values.timezone.trim())) {
    errors['timezone'] = 'Unknown timezone — use a real IANA name (e.g. Asia/Kolkata).';
  }
  if (values.window_start && !HHMM.test(values.window_start)) {
    errors['window_start'] = 'Window time must be HH:MM (24h).';
  }
  if (values.window_end && !HHMM.test(values.window_end)) {
    errors['window_end'] = 'Window time must be HH:MM (24h).';
  }
  if (values.face_match_threshold !== '') {
    const threshold = Number(values.face_match_threshold);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      errors['face_match_threshold'] = 'Face match threshold must be between 0 and 1.';
    }
  }
  if (values.block.length > 32) {
    errors['block'] = 'Block must be at most 32 characters.';
  }
  if (values.anchor_label.length > 128) {
    errors['anchor_label'] = 'Anchor label must be at most 128 characters.';
  }
  if (values.warden_name.length > 128) {
    errors['warden_name'] = 'Warden name must be at most 128 characters.';
  }
  if (values.warden_extension.length > 16) {
    errors['warden_extension'] = 'Extension must be at most 16 characters.';
  }

  return errors;
}

/** Convert validated hostel form strings into the API's typed payload. */
export function hostelFormToPayload(values: HostelFormValues): HostelCreateBody {
  const payload: HostelCreateBody = {
    name: values.name.trim(),
    latitude: Number(values.latitude),
    longitude: Number(values.longitude),
    permitted_radius_m: Number(values.permitted_radius_m),
    max_location_accuracy_m: Number(values.max_location_accuracy_m),
    boundary_policy: 'conservative',
    require_liveness: values.require_liveness,
  };
  if (values.block.trim()) payload.block = values.block.trim();
  if (values.anchor_label.trim()) payload.anchor_label = values.anchor_label.trim();
  if (values.timezone.trim()) payload.timezone = values.timezone.trim();
  if (values.window_start) payload.window_start = values.window_start;
  if (values.window_end) payload.window_end = values.window_end;
  if (values.face_match_threshold !== '') {
    payload.face_match_threshold = Number(values.face_match_threshold);
  }
  if (values.warden_name.trim()) payload.warden_name = values.warden_name.trim();
  if (values.warden_extension.trim()) {
    payload.warden_extension = values.warden_extension.trim();
  }
  return payload;
}

export interface RoomFormValues {
  identifier: string;
  capacity: string;
}

export function validateRoomForm(values: RoomFormValues): FieldErrors {
  const errors: FieldErrors = {};
  const identifier = values.identifier.trim();
  if (!identifier) {
    errors['identifier'] = 'Room identifier is required.';
  } else if (identifier.length > 32) {
    errors['identifier'] = 'Identifier must be at most 32 characters.';
  }
  if (values.capacity.trim() !== '') {
    const capacity = Number(values.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
      errors['capacity'] = 'Capacity must be a whole number between 1 and 1000.';
    }
  }
  return errors;
}
