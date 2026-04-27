# Muninn frontend

The **Muninn** web app: a **Next.js** (Pages Router) client for camp **programs**, **courses**, **parent** accounts, **students**, **enrollments**, and **AI-generated end-of-camp reports**. It authenticates with **Clerk** and talks to the **Muninn FastAPI** backend over HTTPS using the signed-in user’s **Bearer** token.

This project uses **static export** (`output: 'export'` in `next.config.ts`), so there is no Next.js server at runtime. The app is a static bundle (for example S3 + CloudFront); all data comes from the external API.

**Platform architecture** (Mermaid diagram, AWS overview, and handwritten sketch) lives in the repository root: **[`README.md`](../README.md)**.

---

## How it works

### Authentication and roles

- **Clerk** wraps the app in `_app.tsx` via `ClerkProvider` and `ClerkAuthGate`.
- **Public routes** (no sign-in required): `/`, `/sign-in/*`, `/sign-up/*`. Any other path requires a signed-in user; unauthenticated users are sent back to `/`.
- **API user record** — After sign-in, `useMuninnUserProfile` calls `GET /api/user/me` (see `hooks/useMuninnUserProfile.ts`) to load the Muninn `users` row, including `role`. First access can create or link that row to the Clerk user.
- **Admin vs non-admin** — `AppLayout` uses `isAdmin` (`user.role === "admin"`) to show full navigation (programs, courses, students, parents) or a restricted set (home, profile). Non-admins are redirected to `/profile` with a `restricted=1` query if they hit admin-only routes.

### Backend API

- `lib/muninn-api.ts` implements typed helpers for programs, courses, students, parents, enrollments, user profile, and job listing. Some flows (for example the report generator) also use `fetch` with the same base URL and Bearer token for `GET/POST` job endpoints. Every authenticated `muninnRequest` call reads a JWT via Clerk’s `getToken()` and sends `Authorization: Bearer …`.
- Base URL: **`NEXT_PUBLIC_API_URL`** or **`NEXT_PUBLIC_MUNINN_API_URL`**, defaulting to `http://localhost:8000` in development. Health checks use `GET /health` (no auth).
- The hook `useMuninnApi` (`hooks/useMuninnApi.ts`) builds a small client from `useAuth().getToken` for use in components.

### Main UI areas

| Area | Path / notes |
|------|----------------|
| Home | `/` — marketing-style landing; sign-in / sign-up when logged out. |
| Programs | `/programs` — list, create, edit; program detail and enrollments under `/programs/[programId]`. |
| Per-enrollment reports | `/programs/[programId]/enrollments/[enrollmentId]/reports` — view report history for that enrollment. |
| Courses | `/courses` — course catalog and creation. |
| Students | `/students`, `/students/[studentId]` — students tied to parents. |
| Parents (admin) | `/admin/parents` — manage parent user rows / Clerk linkage. |
| Generate report (batch) | `/generate-report/generate-report` — select enrollments, start report **jobs**, poll status, open markdown in a modal (`components/generate-report/`, `useGenerateReport`, `useJobReportViewer`). |
| Profile | `/profile` — user profile and Muninn `users` fields. |

### Tech stack

- **Next.js 16** (App entry: `pages/`), **React 19**, **TypeScript**
- **Tailwind CSS 4** (`styles/globals.css`, PostCSS)
- **@clerk/nextjs** for authentication UI and session
- **react-markdown** (+ **remark-gfm**, **remark-breaks**) for rendering report markdown in the browser

---

## Getting started

### Prerequisites

- **Node.js 20+** (aligned with repo CI)
- A running **Muninn API** (e.g. `backend/api`) and correct **`NEXT_PUBLIC_API_URL`**
- A **Clerk** application: publishable (and, on the server, secret) keys configured for your app URL

### Install and dev server

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dev server is for local use only; production is a static export.

### Build and static output

```bash
npm run build
```

The static site is emitted to **`out/`** (Next `output: "export"`). Serve `out/` from any static host, or use the project’s **Terraform** / **GitHub Actions** pipeline for AWS (S3/CloudFront) as configured in this repo.

```bash
npm run start
```

`next start` is **not** used with static export for production; it only applies if you change the config to a server build. For the current setup, deploy the `out/` directory.

### Lint

```bash
npm run lint
```

---

## Environment variables

Set these in `.env.local` (local) or your hosting / CI environment (production).

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (browser). |
| `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_MUNINN_API_URL` | Muninn API origin, no trailing slash (e.g. `https://api.example.com` or `http://localhost:8000`). |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `…_SIGN_UP_URL` (if used) | Optional Clerk URL overrides. |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` / `…_AFTER_SIGN_UP_URL` | Post-auth redirects; align paths with real routes in `pages/`. |

Server-only Clerk variables apply to the API, not this static frontend, unless you add server code later.

---

## Project layout (high level)

| Path | Role |
|------|------|
| `pages/` | Routes and page components (`_app`, `_document`, `index`, `programs/`, `generate-report/`, etc.). |
| `components/` | Layout (`AppLayout`, `ClerkAuthGate`), feature modules under `programs/`, `generate-report/`, `courses/`, … |
| `hooks/` | `useMuninnApi`, `useMuninnUserProfile`, `useGenerateReport`, `useJobReportViewer`, … |
| `lib/muninn-api.ts` | HTTP client and endpoint wrappers. |
| `lib/types.ts` | Shared TypeScript types for API shapes. |
| `styles/globals.css` | Global styles and Tailwind entry. |

---

## Related repositories / packages

- **`backend/api/`** — FastAPI app that implements `/api/...` and uses the database package.
- **`backend/database/`** — **`muninn-database`**: Aurora + models consumed by the API and Lambdas.
- **`.github/workflows/deploy.yml`** — includes a frontend deploy step after agents/database.

---

## Agent notes (Next.js)

This repo pins a **current** Next major version; conventions may differ from older docs. See `AGENTS.md` in this folder for a short note on checking `node_modules/next` docs when something behaves unexpectedly.
