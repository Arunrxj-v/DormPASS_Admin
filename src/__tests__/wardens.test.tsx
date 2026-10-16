import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { WardenListResponse } from '../api/types';
import { WardensPage } from '../pages/WardensPage';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    getWardens: vi.fn(),
    getHostels: vi.fn(),
    createWarden: vi.fn(),
    patchWarden: vi.fn(),
    deleteWarden: vi.fn(),
  };
});

const { getWardens, getHostels, createWarden } = await import('../api/client');

const EMPTY_WARDENS: WardenListResponse = {
  page: 1,
  page_size: 20,
  total_pages: 0,
  has_more: false,
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  (getWardens as Mock).mockResolvedValue(EMPTY_WARDENS);
  (getHostels as Mock).mockResolvedValue([]);
  (createWarden as Mock).mockResolvedValue({});
});

async function openCreateModal(user: ReturnType<typeof userEvent.setup>) {
  render(
    <MemoryRouter>
      <WardensPage />
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: /new warden/i }));
}

describe('WardensPage — create warden validation', () => {
  it('rejects a username with whitespace and a password under 10 characters', async () => {
    const user = userEvent.setup();
    await openCreateModal(user);

    await user.type(screen.getByLabelText(/username/i), 'night warden');
    await user.type(screen.getByLabelText(/^password/i), 'short');
    await user.click(screen.getByRole('button', { name: /create warden/i }));

    expect(await screen.findByText('Username cannot contain whitespace.')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 10 characters.')).toBeInTheDocument();
    expect(createWarden).not.toHaveBeenCalled();
  });

  it('requires a username and a password on create', async () => {
    const user = userEvent.setup();
    await openCreateModal(user);

    await user.click(screen.getByRole('button', { name: /create warden/i }));

    expect(await screen.findByText('Username is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(createWarden).not.toHaveBeenCalled();
  });

  it('creates the warden once the form is valid', async () => {
    const user = userEvent.setup();
    await openCreateModal(user);

    await user.type(screen.getByLabelText(/username/i), 'night_warden');
    await user.type(screen.getByLabelText(/^password/i), 'longenoughpass');
    await user.click(screen.getByRole('button', { name: /create warden/i }));

    await vi.waitFor(() => {
      expect(createWarden).toHaveBeenCalledWith({
        username: 'night_warden',
        password: 'longenoughpass',
        hostel_ids: [],
      });
    });
  });

  it('never offers a role selector — roles are backend-granted only', async () => {
    const user = userEvent.setup();
    await openCreateModal(user);

    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeEnabled();
  });
});
