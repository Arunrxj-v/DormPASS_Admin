/**
 * Response types for the HostelPass admin API.
 *
 * Every shape here was verified against the LIVE backend
 * (http://127.0.0.1:8000/api/v1) with curl before being written — see the
 * project README for the captured responses.
 */

export type Role = 'student' | 'warden' | 'admin';

export type AccountStatus = 'active' | 'inactive';

export type EnrollmentStatus =
  | 'created'
  | 'details_verified'
  | 'face_enrolled'
  | 'account_provisioned'
  | 'active'
  | 'suspended';

export type AttendanceStatus = 'present' | 'pending' | 'absent';

export type BoundaryPolicy = 'conservative';

export interface HostelRef {
  id: string;
  name: string;
  block: string | null;
  room: string | null;
}

/** GET /auth/me, and the `student` member of POST /auth/login. */
export interface StudentPublic {
  id: string;
  student_id: string;
  name: string;
  email: string | null;
  enrollment_status: EnrollmentStatus | null;
  department: string | null;
  cohort: string | null;
  role: Role;
  account_status: AccountStatus;
  hostel: HostelRef | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  /** Lifetime in seconds (1800 in this deployment). */
  expires_in: number;
  student: StudentPublic;
}

export interface AdminStats {
  hostels: number;
  rooms: number;
  wardens: {
    total: number;
    active: number;
    inactive: number;
  };
  students: {
    total: number;
    active: number;
    pending_enrollment: number;
    suspended: number;
    by_status: Partial<Record<EnrollmentStatus, number>>;
  };
}

export interface WardenPublic {
  id: string;
  username: string;
  role: Role;
  account_status: AccountStatus;
  hostel_ids: string[];
  hostel_names: string[];
  created_at: string;
}

export interface GeofencePublic {
  hostel_id: string;
  name: string;
  block: string | null;
  anchor_label: string | null;
  latitude: number;
  longitude: number;
  permitted_radius_m: number;
  max_location_accuracy_m: number;
  boundary_policy: BoundaryPolicy;
  timezone: string;
  /** HH:MM, 24h. */
  window_start: string;
  /** HH:MM, 24h. */
  window_end: string;
  require_liveness: boolean;
  face_match_threshold: number;
  warden_name: string | null;
  warden_extension: string | null;
}

export interface RoomPublic {
  id: string;
  hostel_id: string;
  identifier: string;
  /** May be null when no capacity was ever recorded. */
  capacity: number | null;
  /** Live occupancy: students whose room string matches this identifier. */
  student_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminAttendanceItem {
  /**
   * Null for synthesized rows (e.g. a day that auto-became `absent` because
   * the curfew window was missed). Such rows are not actionable records.
   */
  id: string | null;
  reference: string | null;
  date: string;
  recorded_at: string | null;
  recorded_at_local: string | null;
  status: AttendanceStatus;
  outcome: string | null;
  distance_m: number | null;
  accuracy_m: number | null;
  /**
   * Present in the wire payload for verified records. Intentionally not
   * rendered anywhere in the console — the admin surface does not display
   * biometric values.
   */
  face_similarity?: number | null;
  liveness_method?: string | null;
  liveness_score?: number | null;
  gate: string | null;
  reason: string | null;
  student: {
    id: string;
    student_id: string;
    name: string;
  };
}

export interface AuditLogPublic {
  id: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

/** Shared pagination envelope (page/page_size/total_pages/has_more). */
export interface PageEnvelope {
  page: number;
  page_size: number;
  total_pages: number;
  has_more: boolean;
}

export interface WardenListResponse extends PageEnvelope {
  items: WardenPublic[];
}

export interface StudentListResponse extends PageEnvelope {
  items: StudentPublic[];
}

export interface RoomListResponse extends PageEnvelope {
  items: RoomPublic[];
}

export interface AttendanceListResponse extends PageEnvelope {
  items: AdminAttendanceItem[];
}

export interface AuditLogListResponse extends PageEnvelope {
  items: AuditLogPublic[];
}

/** Request bodies (mirrors of the server's pydantic schemas). */

export interface WardenCreateBody {
  username: string;
  password: string;
  hostel_ids: string[];
}

export interface WardenPatchBody {
  password?: string;
  hostel_ids?: string[];
  /** Roles are NEVER client-writable — there is deliberately no role field. */
  account_status?: AccountStatus;
}

export interface HostelCreateBody {
  name: string;
  block?: string;
  anchor_label?: string;
  latitude: number;
  longitude: number;
  permitted_radius_m: number;
  max_location_accuracy_m: number;
  boundary_policy?: BoundaryPolicy;
  timezone?: string;
  window_start?: string;
  window_end?: string;
  require_liveness?: boolean;
  face_match_threshold?: number;
  warden_name?: string;
  warden_extension?: string;
}

/** PUT /admin/hostels/{id} — every field optional, geofence & policy only. */
export type HostelUpdateBody = Partial<HostelCreateBody>;

export interface RoomCreateBody {
  identifier: string;
  capacity?: number;
}

export interface RoomPatchBody {
  identifier?: string;
  /** null clears the capacity (the server's schema allows an explicit null). */
  capacity?: number | null;
}

export interface CorrectionBody {
  new_status: AttendanceStatus;
  reason: string;
}
