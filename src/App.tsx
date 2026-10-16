import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { SessionProvider, useSession } from './auth/session';
import { Layout } from './components/Layout';
import { LoadingState } from './components/states';
import { AuditPage } from './pages/AuditPage';
import { AttendancePage } from './pages/AttendancePage';
import { DashboardPage } from './pages/DashboardPage';
import { HostelDetailPage } from './pages/HostelDetailPage';
import { HostelsPage } from './pages/HostelsPage';
import { SignInPage } from './pages/SignInPage';
import { StudentsPage } from './pages/StudentsPage';
import { WardensPage } from './pages/WardensPage';

/**
 * Protected route shell. Unauthenticated visitors are redirected to /signin
 * with the intended location preserved in router state. This is a convenience
 * gate only — every /admin/* call is independently authorized by the server
 * (a non-admin token gets a 403 envelope rendered as an ErrorState).
 */
/** Exported for tests. */
export function ProtectedRoute() {
  const { status } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="page" style={{ justifyContent: 'center', flex: 1 }}>
        <LoadingState label="Checking your session…" />
      </div>
    );
  }
  if (status !== 'authenticated') {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }
  return <Layout />;
}

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/signin" element={<SignInPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/wardens" element={<WardensPage />} />
            <Route path="/hostels" element={<HostelsPage />} />
            <Route path="/hostels/:hostelId" element={<HostelDetailPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/audit" element={<AuditPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  );
}
