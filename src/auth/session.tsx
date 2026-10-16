/**
 * Session state for the Admin Console.
 *
 * TOKEN STORAGE CHOICE — the access token lives in React state (memory) with
 * a `sessionStorage` mirror so a page reload can restore the session via
 * GET /auth/me. `localStorage` is deliberately NOT used: the mirror dies with
 * the browser tab, and it is cleared on sign-out and on any 401. Passwords
 * are never stored anywhere — they only travel over the login request.
 *
 * SECURITY — Bearer headers only (no cookies ⇒ no CSRF surface). The client
 * refuses any login whose role is not `admin` (defense in depth: the server
 * also 403s every /admin/* call for non-admin tokens). On a 401 caused by an
 * expired/revoked token the API client refreshes once; if that fails the
 * session is cleared and the router bounces to /signin preserving the
 * intended route.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  configureAuthHandlers,
  getAuthToken,
  getMe,
  postLogin,
  postLogout,
  postRefresh,
  resetAuthHandlers,
  setAuthToken,
} from '../api/client';
import type { LoginResponse, StudentPublic } from '../api/types';

const STORAGE_KEY = 'hostelpass.admin.token';

/** Refresh this many ms before the server-declared expiry. */
const REFRESH_LEAD_MS = 60_000;

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export class SessionError extends Error {
  readonly kind: 'non_admin' | 'expired';
  constructor(kind: 'non_admin' | 'expired', message: string) {
    super(message);
    this.name = 'SessionError';
    this.kind = kind;
  }
}

interface SessionContextValue {
  status: SessionStatus;
  user: StudentPublic | null;
  /** True when the session ended because a token expired/was revoked. */
  expired: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function readStoredToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null): void {
  try {
    if (token === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* storage unavailable — the in-memory token still works */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<StudentPublic | null>(null);
  const [expired, setExpired] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (refreshTimer.current !== null) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const clearSession = useCallback(
    (opts: { expired: boolean }) => {
      clearTimer();
      setAuthToken(null);
      storeToken(null);
      setUser(null);
      setStatus('unauthenticated');
      setExpired(opts.expired);
    },
    [clearTimer],
  );

  const scheduleRefresh = useCallback(
    (expiresInSeconds: number) => {
      clearTimer();
      const delay = Math.max(expiresInSeconds * 1000 - REFRESH_LEAD_MS, 5_000);
      refreshTimer.current = setTimeout(() => {
        void (async () => {
          const token = getAuthToken();
          if (!token) return;
          const result = await postRefresh(token);
          if (result?.access_token) {
            setAuthToken(result.access_token);
            storeToken(result.access_token);
            scheduleRefresh(result.expires_in);
          } else {
            clearSession({ expired: true });
          }
        })();
      }, delay);
    },
    [clearTimer, clearSession],
  );

  const adoptSession = useCallback(
    (login: LoginResponse) => {
      setAuthToken(login.access_token);
      storeToken(login.access_token);
      setUser(login.student);
      setStatus('authenticated');
      setExpired(false);
      scheduleRefresh(login.expires_in);
    },
    [scheduleRefresh],
  );

  // Wire the API client's expiry hooks to this session.
  useEffect(() => {
    configureAuthHandlers({
      refresh: async () => {
        const token = getAuthToken();
        if (!token) return false;
        const result = await postRefresh(token);
        if (!result?.access_token) return false;
        setAuthToken(result.access_token);
        storeToken(result.access_token);
        scheduleRefresh(result.expires_in);
        return true;
      },
      onUnauthorized: () => clearSession({ expired: true }),
    });
    return () => {
      resetAuthHandlers();
      clearTimer();
    };
  }, [clearSession, clearTimer, scheduleRefresh]);

  // Restore a session after reload: token from sessionStorage → GET /auth/me.
  useEffect(() => {
    let cancelled = false;
    const token = readStoredToken();
    if (!token) {
      setStatus('unauthenticated');
      return;
    }
    setAuthToken(token);
    void (async () => {
      try {
        const me = await getMe();
        if (cancelled) return;
        if (me.role !== 'admin') {
          // A non-admin token must never be usable in this console.
          clearSession({ expired: false });
          return;
        }
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (cancelled) return;
        clearSession({ expired: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  const signIn = useCallback(
    async (username: string, password: string) => {
      const login = await postLogin(username, password);
      if (login.student.role !== 'admin') {
        // Client-side role gate. Revoke the just-issued token so a warden
        // token never lingers in this tab; the server would 403 it anyway.
        setAuthToken(login.access_token);
        try {
          await postLogout();
        } catch {
          /* best-effort revocation */
        }
        setAuthToken(null);
        throw new SessionError(
          'non_admin',
          'This console is for hostel administrators only. Sign in with an admin account.',
        );
      }
      adoptSession(login);
    },
    [adoptSession],
  );

  const signOut = useCallback(async () => {
    const token = getAuthToken();
    if (token) {
      try {
        await postLogout(); // revoke server-side
      } catch {
        /* local sign-out proceeds even if the server is unreachable */
      }
    }
    clearSession({ expired: false });
  }, [clearSession]);

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, expired, signIn, signOut }),
    [status, user, expired, signIn, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
