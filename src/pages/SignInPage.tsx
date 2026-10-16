import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { isApiError } from '../api/client';
import { SessionError, useSession } from '../auth/session';
import { TextField } from '../components/Field';
import { errorMessage } from '../components/states';

interface LocationState {
  from?: { pathname: string };
}

/**
 * Sign-in. Credentials are typed here and sent straight to POST /auth/login —
 * nothing is stored. There is deliberately NO role selector: the backend
 * decides the role, and this console refuses anything that is not `admin`.
 */
export function SignInPage() {
  const { status, expired, signIn } = useSession();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const errors: { username?: string; password?: string } = {};
    if (!username.trim()) errors.username = 'Username is required.';
    if (!password) errors.password = 'Password is required.';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
    } catch (error) {
      if (error instanceof SessionError) {
        setFormError(error.message);
      } else if (isApiError(error) && error.status === 401) {
        setFormError(error.message);
      } else {
        setFormError(errorMessage(error));
      }
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: 420, justifyContent: 'center', flex: 1 }}>
      <div className="stack gap-lg">
        <div className="row gap-md">
          <span className="brand-tile" aria-hidden="true">
            HP
          </span>
          <span>
            <span className="brand-wordmark">HostelPass</span>
            <br />
            <span className="brand-sub">Admin console</span>
          </span>
        </div>
        <div>
          <h1 className="headline-md">Sign in</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Hostel operations — wardens, geofences, rooms and audit.
          </p>
        </div>
      </div>

      <form className="section-card stack gap-lg" onSubmit={(event) => void onSubmit(event)} noValidate>
        {expired ? (
          <div className="info-box" role="status" style={{ color: 'var(--text-primary)' }}>
            Your session expired. Please sign in again.
          </div>
        ) : location.state ? (
          <div className="info-box" role="status" style={{ color: 'var(--text-primary)' }}>
            Sign in to continue.
          </div>
        ) : null}

        {formError ? (
          <div className="error-state" role="alert">
            <span className="error-title">Sign-in failed</span>
            <span className="error-message">{formError}</span>
          </div>
        ) : null}

        <TextField
          label="Username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          error={fieldErrors.username}
          required
          disabled={submitting}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          required
          disabled={submitting}
        />
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="body-sm muted" style={{ margin: 0 }}>
          Administrator accounts only. Wardens and students sign in through the
          HostelPass mobile apps.
        </p>
      </form>
    </div>
  );
}
