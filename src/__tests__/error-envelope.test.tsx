import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { ApiError, getStats } from '../api/client';
import { DashboardPage } from '../pages/DashboardPage';
import { ErrorState } from '../components/states';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    getStats: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('API error envelope handling', () => {
  it('renders a {error:{code,message}} envelope as an ErrorState, not a crash', async () => {
    // The exact payload a warden token gets from GET /admin/stats (HTTP 403).
    (getStats as Mock).mockRejectedValue(
      new ApiError(403, 'forbidden', 'Admin access required.'),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('forbidden');
    expect(alert).toHaveTextContent('HTTP 403');
    expect(alert).toHaveTextContent('Admin access required.');
    // A recovery affordance is offered; the rest of the page still renders.
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('surfaces validation details from a 400 invalid_payload envelope', async () => {
    (getStats as Mock).mockRejectedValue(
      new ApiError(400, 'invalid_payload', 'Request payload is invalid.', {
        fields: [{ field: 'latitude', message: 'Field required', type: 'missing' }],
      }),
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Request payload is invalid.');
  });

  it('ErrorState renders a plain Error without an envelope too', () => {
    render(<ErrorState error={new Error('plain failure')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('plain failure');
  });
});

describe('client request layer (real module, mocked fetch)', () => {
  const fetchMock = vi.fn();
  let actual: typeof import('../api/client');

  beforeAll(async () => {
    actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  });

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses the server error envelope into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 'rate_limited', message: 'Too many requests.', details: {} } }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(actual.getStats()).rejects.toMatchObject({
      status: 429,
      code: 'rate_limited',
      message: 'Too many requests.',
    });
  });
});
