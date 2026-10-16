# HostelPass Admin Console

React + TypeScript web console for HostelPass hostels. It is one of three
front-ends that talk to the **single** FastAPI backend in `../DormPASS_Student/server/`:

| App | Who it is for | Path |
| --- | --- | --- |
| Student app (Flutter) | Students — check-in, activation | `../DormPASS_Student/app/` |
| Warden app (Flutter) | Wardens — roster, face enrollment | `../DormPASS_Warden/app/` |
| **Admin console (this)** | Administrators — wardens, hostels, rooms, audit | `../DormPASS_Admin/` |

There is no second backend, no second database, and no second auth system. Every
figure this console renders comes from a live API call; there are no invented
metrics, decorative charts, or placeholder controls.

## What it does

- **Dashboard** — real counts from `GET /admin/stats`: hostels, rooms, warden
  totals (active/inactive), and student counts by enrollment status.
- **Wardens** — search, create, assign hostels, activate/deactivate, reset
  password, delete. Roles are **never** chosen in the browser; the backend
  grants them, and this console refuses any session whose role is not `admin`.
- **Hostels** — create blocks and edit geofence & attendance policy
  (anchor coordinates, permitted radius, accuracy ceiling, curfew window,
  timezone, liveness, face-match threshold). These are admin-only settings that
  the student and warden apps cannot touch.
- **Rooms** — a per-hostel room registry with live occupancy. When a hostel has
  rooms registered, the backend rejects a student assigned to an unregistered
  room.
- **Students** — search and filter by hostel / enrollment status / account
  status. Read-only overview plus suspend/unsuspend and audit-logged face-data
  deletion. No biometric templates are ever shown.
- **Attendance** — review, approve/reject, and audit-logged corrections. The
  server remains the authority on every decision.
- **Audit log** — paginated admin action history (no passwords, tokens, or
  biometric data).

## Running it

```bash
npm install
npm run dev        # http://localhost:5173  (already in the backend CORS allow-list)
npm run build      # type-checks, then bundles to dist/
npm test           # Vitest + React Testing Library
npm run lint       # Oxlint
```

Sign in with an **administrator** account. There is no self-registration of any
kind — admin accounts are created server-side only:

```bash
cd ../DormPASS_Student/server
docker compose exec api python -m app.cli create-admin
```

## Pointing it at a different server

The API base URL is read from the `VITE_API_BASE` environment variable at build
time. It is an **endpoint address, not a secret** — no credentials of any kind
live in this codebase.

```bash
# dev
VITE_API_BASE=https://hostelpass.lan/api/v1 npm run dev

# production bundle
VITE_API_BASE=https://hostelpass.lan/api/v1 npm run build
```

If unset, it defaults to `http://127.0.0.1:8000/api/v1` (the local Docker
stack). Because it is baked in at build time, rebuild rather than editing
`dist/` by hand.

## Security model

- **Server-enforced, not client-enforced.** Every `/admin/*` call returns 403
  for a non-admin token regardless of what the UI shows. Hiding a button is not
  authorization; the backend check is the real one.
- **Bearer header, not cookies.** Auth is an `Authorization: Bearer <token>`
  header, so there is no CSRF surface.
- **Token in `sessionStorage`, cleared on sign-out and on 401.** Passwords are
  never stored or logged.
- **Expiry handling.** On a 401 `token_invalid`/`token_revoked` the client
  refreshes once and retries the request; if that fails it clears the session
  and bounces to sign-in with a "your session expired" notice. A 401
  `invalid_credentials` (bad password) never triggers a refresh.
- **No role selector anywhere in the UI.** The backend decides the role.

## Design

Tokens, type scale, spacing, and status colours are ported 1:1 from the Flutter
apps' design system (`DormPASS_Student/app/lib/core/theme/`) and the Stitch
source designs, so the console reads as the same product: hairline separation
instead of decorative shadows, 8pt spacing, tabular figures for numerics, and
zero gradients.

## Tech

React 19 · TypeScript · React Router 7 · Vite 8 · Vitest + Testing Library.
Hand-rolled components and CSS custom properties — no heavy UI kit.
