import type { ReactNode } from 'react';

/** Light-gray telemetry tile ("Students 8", "Rooms 3"). */
export function StatTile({
  label,
  value,
  title,
}: {
  label: string;
  value: ReactNode;
  title?: string;
}) {
  return (
    <div className="stat-tile">
      <span className="stat-label">{label}</span>
      <span className="stat-value" title={title}>
        {value}
      </span>
    </div>
  );
}

/** Rounded monogram avatar — the design's institutional identity mark. */
export function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="avatar" aria-hidden="true">
      {initials || '?'}
    </span>
  );
}
