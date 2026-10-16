import { Outlet } from 'react-router-dom';

import { Sidebar } from './Sidebar';

/** App chrome: fixed sidebar + scrollable content column. */
export function Layout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-area">
        <Outlet />
      </main>
    </div>
  );
}
