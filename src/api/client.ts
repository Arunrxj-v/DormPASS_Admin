/**
 * Typed fetch client for the HostelPass admin API.
 *
 * - No axios, no cookies: auth is an `Authorization: Bearer <token>` header,
 *   so there is no CSRF surface.
 * - Every non-2xx response uses the backend's error envelope
 *   `{ error: { code, message, details } }`; it is surfaced as `ApiError`.
 * - On 401 `token_invalid`/`token_revoked` the client attempts ONE token
 *   refresh and retries the request once; if that fails it invokes the
 *   registered unauthorized handler (which clears the session and lets the
 *   router bounce to /signin). 401 `invalid_credentials` (bad password) never
 *   triggers a refresh.
 */

import type {
  AdminAttendanceItem,
  AdminStats,
  AttendanceListResponse,
  AuditLogListResponse,
  CorrectionBody,
  GeofencePublic,
  HostelCreateBody,
  HostelUpdateBody,
  LoginResponse,
  RoomCreateBody,
  RoomListResponse,
  RoomPatchBody,
  StudentListResponse,
  StudentPublic,
  WardenCreateBody,
  WardenListResponse,
  WardenPatchBody,
  WardenPublic,
} from './types';

/**
 * Base URL of the existing FastAPI backend. Overridable per environment via
 * VITE_API_BASE — it is an endpoint address, not a secret. No credentials of
 * any kind live in this codebase.
 */
export const API_BASE: string =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  'http://127.0.0.1:8000/api/v1';

/** Error envelope for every non-2xx response. */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** First field-level validation message, when the server sent one. */
  get fieldMessage(): string | null {
    const fields = this.details['fields'];
    if (Array.isArray(fields) && fields.length > 0) {
      const first = fields[0] as { message?: unknown };
      if (typeof first.message === 'string') return first.message;
    }
    return null;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Codes the server uses for a dead/expired/revoked bearer token. */
const TOKEN_ERROR_CODES = new Set(['token_invalid', 'token_revoked']);

// ---------------------------------------------------------------------------
// Token holder + auth hooks
//
// The session layer (auth/session.tsx) owns the token; this module only holds
// a reference to the current value and two callbacks for expiry handling.
// ---------------------------------------------------------------------------

let authToken: string | null = null;
let refreshHandler: (() => Promise<boolean>) | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function configureAuthHandlers(handlers: {
  refresh: () => Promise<boolean>;
  onUnauthorized: () => void;
}): void {
  refreshHandler = handlers.refresh;
  unauthorizedHandler = handlers.onUnauthorized;
}

export function resetAuthHandlers(): void {
  refreshHandler = null;
  unauthorizedHandler = null;
}

// ---------------------------------------------------------------------------
// Core request
// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the bearer token. Defaults to true. */
  auth?: boolean;
  /** Internal: prevents an infinite refresh/retry loop. */
  isRetry?: boolean;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toApiError(status: number, body: unknown): ApiError {
  if (
    body !== null &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as ApiErrorEnvelope).error === 'object' &&
    (body as ApiErrorEnvelope).error !== null
  ) {
    const env = (body as ApiErrorEnvelope).error;
    return new ApiError(
      status,
      env.code ?? 'unknown_error',
      env.message ?? `Request failed with status ${status}.`,
      env.details ?? {},
    );
  }
  return new ApiError(status, 'unknown_error', `Request failed with status ${status}.`);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, isRetry = false } = options;

  const send = async (token: string | null): Promise<Response> => {
    const headers = new Headers({ Accept: 'application/json' });
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res: Response;
  try {
    res = await send(auth ? authToken : null);
  } catch {
    throw new ApiError(
      0,
      'network_error',
      'Could not reach the HostelPass server. Check that the API is running.',
    );
  }

  const parsed = await parseBody(res);

  if (!res.ok) {
    const error = toApiError(res.status, parsed);

    // Dead token → try to refresh exactly once, then retry the request once.
    if (
      res.status === 401 &&
      TOKEN_ERROR_CODES.has(error.code) &&
      auth &&
      !isRetry &&
      refreshHandler
    ) {
      const refreshed = await refreshHandler();
      if (refreshed) {
        return request<T>(path, { ...options, isRetry: true });
      }
      unauthorizedHandler?.();
    } else if (res.status === 401 && TOKEN_ERROR_CODES.has(error.code) && auth && isRetry) {
      // Refreshed token was also rejected — the session is over.
      unauthorizedHandler?.();
    }

    throw error;
  }

  return parsed as T;
}

// ---------------------------------------------------------------------------
// Auth endpoints
// ---------------------------------------------------------------------------

/**
 * POST /auth/login — the wire field for a username login is `student_id`.
 * The caller (auth/session.tsx) rejects any response whose role is not admin.
 */
export function postLogin(
  studentId: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { student_id: studentId, password },
    auth: false,
  });
}

/** POST /auth/refresh — raw refresh used by the session's refresh handler. */
export async function postRefresh(
  token: string,
): Promise<LoginResponse | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as LoginResponse;
  } catch {
    return null;
  }
}

/** POST /auth/logout — revokes the token server-side (204). */
export function postLogout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' });
}

/** GET /auth/me — current identity; used to restore a session on reload. */
export function getMe(): Promise<StudentPublic> {
  return request<StudentPublic>('/auth/me');
}

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------

export function getStats(): Promise<AdminStats> {
  return request<AdminStats>('/admin/stats');
}

export function getWardens(params: {
  page?: number;
  page_size?: number;
  q?: string;
  account_status?: string;
}): Promise<WardenListResponse> {
  return request<WardenListResponse>(
    `/admin/wardens?${new URLSearchParams(clean(params))}`,
  );
}

export function createWarden(body: WardenCreateBody): Promise<WardenPublic> {
  return request<WardenPublic>('/admin/wardens', { method: 'POST', body });
}

export function patchWarden(
  username: string,
  body: WardenPatchBody,
): Promise<WardenPublic> {
  return request<WardenPublic>(
    `/admin/wardens/${encodeURIComponent(username)}`,
    { method: 'PATCH', body },
  );
}

export function deleteWarden(username: string): Promise<void> {
  return request<void>(`/admin/wardens/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
}

export function getHostels(): Promise<GeofencePublic[]> {
  return request<GeofencePublic[]>('/admin/hostels');
}

export function getHostel(hostelId: string): Promise<GeofencePublic> {
  return request<GeofencePublic>(`/admin/hostels/${hostelId}`);
}

export function createHostel(body: HostelCreateBody): Promise<GeofencePublic> {
  return request<GeofencePublic>('/admin/hostels', { method: 'POST', body });
}

export function updateHostel(
  hostelId: string,
  body: HostelUpdateBody,
): Promise<GeofencePublic> {
  return request<GeofencePublic>(`/admin/hostels/${hostelId}`, {
    method: 'PUT',
    body,
  });
}

export function getRooms(
  hostelId: string,
  params: { page?: number; page_size?: number } = {},
): Promise<RoomListResponse> {
  return request<RoomListResponse>(
    `/admin/hostels/${hostelId}/rooms?${new URLSearchParams(clean(params))}`,
  );
}

export function createRoom(
  hostelId: string,
  body: RoomCreateBody,
): Promise<unknown> {
  return request<unknown>(`/admin/hostels/${hostelId}/rooms`, {
    method: 'POST',
    body,
  });
}

export function patchRoom(roomId: string, body: RoomPatchBody): Promise<unknown> {
  return request<unknown>(`/admin/rooms/${roomId}`, { method: 'PATCH', body });
}

export function deleteRoom(roomId: string): Promise<void> {
  return request<void>(`/admin/rooms/${roomId}`, { method: 'DELETE' });
}

export function getStudents(params: {
  page?: number;
  page_size?: number;
  q?: string;
  hostel_id?: string;
  enrollment_status?: string;
  account_status?: string;
}): Promise<StudentListResponse> {
  return request<StudentListResponse>(
    `/admin/students?${new URLSearchParams(clean(params))}`,
  );
}

export function getAttendance(params: {
  student_id?: string;
  date?: string;
  status?: string;
  month?: string;
  page?: number;
  page_size?: number;
}): Promise<AttendanceListResponse> {
  return request<AttendanceListResponse>(
    `/admin/attendance?${new URLSearchParams(clean(params))}`,
  );
}

export function approveAttendance(recordId: string): Promise<AdminAttendanceItem> {
  return request<AdminAttendanceItem>(
    `/admin/attendance/${recordId}/approve`,
    { method: 'POST' },
  );
}

export function rejectAttendance(recordId: string): Promise<void> {
  return request<void>(`/admin/attendance/${recordId}/reject`, {
    method: 'POST',
  });
}

export function correctAttendance(
  recordId: string,
  body: CorrectionBody,
): Promise<AdminAttendanceItem> {
  return request<AdminAttendanceItem>(
    `/admin/attendance/${recordId}/correction`,
    { method: 'POST', body },
  );
}

export function getAuditLogs(params: {
  page?: number;
  page_size?: number;
}): Promise<AuditLogListResponse> {
  return request<AuditLogListResponse>(
    `/admin/audit-logs?${new URLSearchParams(clean(params))}`,
  );
}

/** Drop undefined/empty params so the query string stays clean. */
function clean(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    out[key] = String(value);
  }
  return out;
}
