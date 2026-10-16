import type {
  AccountStatus,
  AttendanceStatus,
  EnrollmentStatus,
} from '../api/types';

export type BadgeVariant =
  | 'verified'
  | 'pending'
  | 'danger'
  | 'tint'
  | 'neutral';

/**
 * Squared-off status tag with a 6px leading dot — the design system's badge,
 * ported from `StatusBadge` in the Flutter app.
 */
export function StatusBadge({
  label,
  variant = 'neutral',
}: {
  label: string;
  variant?: BadgeVariant;
}) {
  return (
    <span className={`badge badge-${variant}`}>
      <span className="badge-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

interface BadgeSpec {
  label: string;
  variant: BadgeVariant;
}

/**
 * Student lifecycle → honest label.
 * created → details_verified → face_enrolled → account_provisioned → active,
 * plus suspended.
 */
export function enrollmentBadge(status: EnrollmentStatus | null): BadgeSpec {
  switch (status) {
    case 'created':
      return { label: 'Details incomplete', variant: 'pending' };
    case 'details_verified':
      return { label: 'Awaiting face enrollment', variant: 'pending' };
    case 'face_enrolled':
      return { label: 'Face enrolled', variant: 'tint' };
    case 'account_provisioned':
      return { label: 'Ready for activation', variant: 'tint' };
    case 'active':
      return { label: 'Active', variant: 'verified' };
    case 'suspended':
      return { label: 'Suspended', variant: 'danger' };
    default:
      return { label: 'Unknown', variant: 'neutral' };
  }
}

/** Human label for a lifecycle stage (used by the dashboard breakdown). */
export function enrollmentLabel(status: EnrollmentStatus): string {
  return enrollmentBadge(status).label;
}

export function accountBadge(status: AccountStatus): BadgeSpec {
  return status === 'active'
    ? { label: 'Active', variant: 'verified' }
    : { label: 'Inactive', variant: 'neutral' };
}

export function attendanceBadge(status: AttendanceStatus): BadgeSpec {
  switch (status) {
    case 'present':
      return { label: 'Present', variant: 'verified' };
    case 'pending':
      return { label: 'Pending', variant: 'pending' };
    case 'absent':
      return { label: 'Absent', variant: 'danger' };
  }
}
