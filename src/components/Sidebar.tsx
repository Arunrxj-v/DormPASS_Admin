import { NavLink } from 'react-router-dom';

import { useSession } from '../auth/session';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/wardens', label: 'Wardens' },
  { to: '/hostels', label: 'Hostels & rooms' },
  { to: '/students', label: 'Students' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/audit', label: 'Audit log' },
];

export function Sidebar() {
  const { user, signOut } = useSession();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-tile" aria-hidden="true">
          HP
        </span>
        <span>
          <span className="brand-wordmark">HostelPass</span>
          <br />
          <span className="brand-sub">Admin console</span>
        </span>
      </div>

      <nav className="sidebar-nav" aria-label="Console sections">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="account-name">{user?.student_id ?? '—'}</span>
        <span className="account-role">Administrator</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </aside>
  );
}
