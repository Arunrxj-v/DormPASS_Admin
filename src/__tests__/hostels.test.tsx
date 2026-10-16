import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { HostelsPage } from '../pages/HostelsPage';

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>();
  return {
    ...actual,
    getHostels: vi.fn(),
    createHostel: vi.fn(),
  };
});

const { getHostels, createHostel } = await import('../api/client');

beforeEach(() => {
  vi.clearAllMocks();
  (getHostels as Mock).mockResolvedValue([]);
  (createHostel as Mock).mockResolvedValue({});
});

async function openCreateModal(user: ReturnType<typeof userEvent.setup>) {
  render(
    <MemoryRouter>
      <HostelsPage />
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: /new hostel/i }));
}

describe('HostelsPage — create hostel validation', () => {
  it('requires the four geofence fields (latitude, longitude, radius, accuracy)', async () => {
    const user = userEvent.setup();
    await openCreateModal(user);

    await user.click(screen.getByRole('button', { name: /create hostel/i }));

    expect(await screen.findByText('Hostel name is required.')).toBeInTheDocument();
    expect(screen.getByText('Latitude is required.')).toBeInTheDocument();
    expect(screen.getByText('Longitude is required.')).toBeInTheDocument();
    expect(screen.getByText('Permitted radius (m) is required.')).toBeInTheDocument();
    expect(screen.getByText('Max location accuracy (m) is required.')).toBeInTheDocument();
    expect(createHostel).not.toHaveBeenCalled();
  });

  it('rejects out-of-range coordinates before hitting the API', async () => {
    const user = userEvent.setup();
    await openCreateModal(user);

    await user.type(screen.getByLabelText(/hostel name/i), 'Test Block');
    await user.type(screen.getByLabelText(/^latitude/i), '120');
    await user.type(screen.getByLabelText(/^longitude/i), '79.1');
    await user.type(screen.getByLabelText(/permitted radius/i), '100');
    await user.type(screen.getByLabelText(/max location accuracy/i), '40');
    await user.click(screen.getByRole('button', { name: /create hostel/i }));

    expect(await screen.findByText('Latitude must be between -90 and 90.')).toBeInTheDocument();
    expect(createHostel).not.toHaveBeenCalled();
  });

  it('creates the hostel with numeric geofence values once valid', async () => {
    const user = userEvent.setup();
    await openCreateModal(user);

    await user.type(screen.getByLabelText(/hostel name/i), 'Test Block');
    await user.type(screen.getByLabelText(/^latitude/i), '12.97');
    await user.type(screen.getByLabelText(/^longitude/i), '79.16');
    await user.type(screen.getByLabelText(/permitted radius/i), '120');
    await user.type(screen.getByLabelText(/max location accuracy/i), '50');
    await user.click(screen.getByRole('button', { name: /create hostel/i }));

    await vi.waitFor(() => {
      expect(createHostel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Block',
          latitude: 12.97,
          longitude: 79.16,
          permitted_radius_m: 120,
          max_location_accuracy_m: 50,
        }),
      );
    });
  });

  it('rejects a malformed attendance window', async () => {
    const user = userEvent.setup();
    await openCreateModal(user);

    await user.type(screen.getByLabelText(/hostel name/i), 'Test Block');
    await user.type(screen.getByLabelText(/^latitude/i), '12.97');
    await user.type(screen.getByLabelText(/^longitude/i), '79.16');
    await user.type(screen.getByLabelText(/permitted radius/i), '120');
    await user.type(screen.getByLabelText(/max location accuracy/i), '50');
    await user.clear(screen.getByLabelText(/window start/i));
    await user.type(screen.getByLabelText(/window start/i), '2030');
    await user.click(screen.getByRole('button', { name: /create hostel/i }));

    expect(await screen.findByText('Window time must be HH:MM (24h).')).toBeInTheDocument();
    expect(createHostel).not.toHaveBeenCalled();
  });
});
