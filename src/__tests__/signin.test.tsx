import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ApiError } from '../api/client';
import type { LoginResponse } from '../api/types';
import { SessionProvider } from '../auth/session';
import { SignInPage } from '../pages/SignInPage';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    postLogin: vi.fn(),
    postLogout: vi.fn(),
  };
});

const { postLogin, postLogout } = await import('../api/client');

function adminLogin(overrides: Partial<LoginResponse['student']> = {}): LoginResponse {
  return {
    access_token: 'test-token',
    token_type: 'bearer',
    expires_in: 1800,
    student: {
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
      ...overrides,
    },
  };
}

function renderSignIn() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <SignInPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SignInPage', () => {
  it('refuses a warden-role login response client-side and revokes the token', async () => {
    // The server happily issues a warden token — the console must reject it.
    (postLogin as Mock).mockResolvedValue(
      adminLogin({ id: 'w-1', student_id: 'warden', role: 'warden' }),
    );
    (postLogout as Mock).mockResolvedValue(undefined);

    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/username/i), 'warden');
    await user.type(screen.getByLabelText(/password/i), 'WardenPass123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/for hostel administrators only/i),
    ).toBeInTheDocument();
    // We stayed on the sign-in page — no console access for wardens.
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    // The just-issued warden token was revoked rather than stored.
    expect(postLogout).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('hostelpass.admin.token')).toBeNull();
  });

  it('surfaces a server 401 invalid_credentials envelope as a sign-in error', async () => {
    (postLogin as Mock).mockRejectedValue(
      new ApiError(
        401,
        'invalid_credentials',
        'Incorrect email or roll number, or password.',
      ),
    );

    const user = userEvent.setup();
    renderSignIn();

    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(
      await screen.findByText(/incorrect email or roll number, or password/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(postLogout).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('hostelpass.admin.token')).toBeNull();
  });

  it('signs an admin in and redirects to the route they came from', async () => {
    (postLogin as Mock).mockResolvedValue(adminLogin());

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/wardens', state: { from: { pathname: '/wardens' } } }]}>
        <SessionProvider>
          <SignInPage />
        </SessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/sign in to continue/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'AdminPass123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Success navigates away from the sign-in form (toward /wardens).
    await vi.waitFor(() => {
      expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    });
    expect(sessionStorage.getItem('hostelpass.admin.token')).toBe('test-token');
  });
});
