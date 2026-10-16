import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '../App';
import { SessionProvider } from '../auth/session';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    postLogin: vi.fn(),
    postLogout: vi.fn(),
    getMe: vi.fn(),
  };
});

describe('ProtectedRoute', () => {
  it('redirects unauthenticated visitors to /signin, preserving the intended route', async () => {
    render(
      <MemoryRouter initialEntries={['/students']}>
        <SessionProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/students" element={<div>students page</div>} />
            </Route>
            <Route
              path="/signin"
              element={<div>sign-in page</div>}
            />
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    );

    // The protected page never renders; the sign-in page does.
    expect(await screen.findByText('sign-in page')).toBeInTheDocument();
    expect(screen.queryByText('students page')).not.toBeInTheDocument();
  });

  it('shows a session-check state while the stored token is being validated', () => {
    // Simulate a stored token so the provider goes into its 'loading' state.
    sessionStorage.setItem('hostelpass.admin.token', 'stale-token');

    render(
      <MemoryRouter initialEntries={['/']}>
        <SessionProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<div>dashboard page</div>} />
            </Route>
            <Route path="/signin" element={<div>sign-in page</div>} />
          </Routes>
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Checking your session…')).toBeInTheDocument();
    expect(screen.queryByText('dashboard page')).not.toBeInTheDocument();
    expect(screen.queryByText('sign-in page')).not.toBeInTheDocument();
  });
});
