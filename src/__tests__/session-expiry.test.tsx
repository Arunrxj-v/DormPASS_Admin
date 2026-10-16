/**
 * Session-expiry behaviour: a 401 caused by a dead token triggers ONE refresh
 * attempt and a request retry; if the refresh fails the unauthorized hook
 * fires, which clears the session and bounces the user to /signin with the
 * "session expired" notice.
 *
 * These tests run against the REAL api client and session provider with a
 * stubbed `fetch` — no module mocks.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  configureAuthHandlers,
  getStats,
  resetAuthHandlers,
  setAuthToken,
} from '../api/client';
import { ProtectedRoute } from '../App';
import { SessionProvider } from '../auth/session';
import { DashboardPage } from '../pages/DashboardPage';
import { SignInPage } from '../pages/SignInPage';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const TOKEN_INVALID = {
  error: { code: 'token_invalid', message: 'Missing bearer token.', details: {} },
};

const ADMIN_ME = {
  id: 'u-1',
  student_id: 'admin',
  name: 'admin',
  email: null,
  enrollment_status: null,
  department: null,
  cohort: null,
  role: 'admin',
  account_status: 'active',
  hostel: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetAuthHandlers();
  setAuthToken(null);
});

describe('token expiry → refresh-or-redirect', () => {
  it('refreshes once and retries the request with the new token', async () => {
    const refresh = vi.fn().mockImplementation(async () => {
      setAuthToken('new-token');
      return true;
    });
    const onUnauthorized = vi.fn();
    configureAuthHandlers({ refresh, onUnauthorized });
    setAuthToken('expired-token');

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, TOKEN_INVALID))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          hostels: 2,
          rooms: 3,
          wardens: { total: 2, active: 1, inactive: 1 },
          students: { total: 8, active: 4, pending_enrollment: 4, suspended: 0, by_status: {} },
        }),
      );

    const stats = await getStats();

    expect(stats.hostels).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // The retried request carries the refreshed token.
    const retryHeaders = (fetchMock.mock.calls[1]?.[1]?.headers ?? null) as Headers | null;
    expect(retryHeaders?.get('Authorization')).toBe('Bearer new-token');
  });

  it('fires the unauthorized hook (redirect to sign-in) when refresh fails', async () => {
    const refresh = vi.fn().mockResolvedValue(false);
    const onUnauthorized = vi.fn();
    configureAuthHandlers({ refresh, onUnauthorized });
    setAuthToken('expired-token');

    fetchMock.mockResolvedValue(jsonResponse(401, TOKEN_INVALID));

    await expect(getStats()).rejects.toMatchObject({ code: 'token_invalid' });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does NOT refresh on invalid_credentials (that is a bad password, not a dead token)', async () => {
    const refresh = vi.fn();
    const onUnauthorized = vi.fn();
    configureAuthHandlers({ refresh, onUnauthorized });

    fetchMock.mockResolvedValue(
      jsonResponse(401, {
        error: { code: 'invalid_credentials', message: 'Incorrect password.', details: {} },
      }),
    );

    await expect(getStats()).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(refresh).not.toHaveBeenCalled();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('an expired session bounces to /signin with the "session expired" notice', async () => {
    sessionStorage.setItem('hostelpass.admin.token', 'stored-token');

    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/auth/me')) return jsonResponse(200, ADMIN_ME);
      if (url.endsWith('/auth/refresh')) return jsonResponse(500, { error: { code: 'server_error', message: 'boom', details: {} } });
      if (url.endsWith('/admin/stats')) return jsonResponse(401, TOKEN_INVALID);
      return jsonResponse(404, { error: { code: 'not_found', message: 'nope', details: {} } });
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardPage />} />
            </Route>
            {/* The REAL sign-in page, so the expiry notice is the one the
                user actually sees — not a placeholder div. */}
            <Route path="/signin" element={<SignInPage />} />
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/your session expired/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('hostelpass.admin.token')).toBeNull();
  });
});
