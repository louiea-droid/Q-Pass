# TAC QR Check-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Next.js app where staff sign in with Google, scan ticket QR codes into a Google Sheet, and admins monitor check-ins, manage attendees/events, and print QR codes.

**Architecture:** Server-only Google Sheets access through one module (`src/lib/store.ts`) using a service account; pure decision logic (`qr.ts`, `checkin.ts`, `staff.ts`) unit-tested; Auth.js Google sign-in with role checks on the server for every page, route and action. Client components only for camera scanning, polling, and forms.

**Tech Stack:** Next.js 16.4 (App Router, `src/`), React 19, Tailwind 4, TypeScript, `next-auth@beta` (Auth.js v5), `@googleapis/sheets`, `html5-qrcode@2.3.8`, `qrcode`, Vitest.

**Spec:** `docs/plans/2026-11-20-qr-checkin-design.md` — read it first; this plan implements it and does not repeat it.

## Global Constraints

- Next 16 has breaking changes: read the relevant page in `node_modules/next/dist/docs/01-app/` before using any Next API. Known: middleware is now `proxy.ts`; page/route `params` and `searchParams` are `Promise`s; `cookies()`/`headers()` are async.
- Free hosting only: Netlify free plan. No paid services.
- Sheets is touched **only** in `src/lib/store.ts` (and nowhere in client code). Credentials never reach the browser.
- Every server action, route handler and page re-checks the caller via `requireStaff()` — never rely on hidden UI.
- Ticket numbers are 4-digit zero-padded strings (`"0000"`–`"9999"`), default range `0000`–`1000`.
- QR payload `<EventName>-<NNNN>`, parsed by splitting on the **last** `-`.
- Event names: `/^[A-Za-z0-9 -]{1,40}$/`, trimmed, not `Staff`/`Events`/`Log` (case-insensitive), unique, locked after creation.
- Sheet tabs/headers exactly as the spec's "Google Sheet layout".
- Log `Result` values exactly: `checked_in`, `already_checked_in`, `not_found`, `wrong_event`, `event_closed`, `undone`.
- Rows are found by matching the `Ticket` column, never by row position.
- UI work uses the project skills `senior-frontend` + `frontend-design` (see root `CLAUDE.md`); scanner is mobile-first, every screen works at 375 px width.

## Review Focus

1. A QR that is not a ticket at all (a URL, a random code) → clear "Not a TAC ticket" rejection, logged as `not_found`, no crash. (Task 2 test)
2. Event names containing `-` (e.g. `Youth-Night 2026`) → parse still yields the right event and ticket. (Task 2 test)
3. Ticket numbers that Sheets turned into numbers (`1` instead of `"0001"`) or that staff type without zeros (`57`) → normalised to `"0001"`/`"0057"`. (Task 2 test)
4. Staff tab hand-edited: emails with capitals/spaces, roles like `Admin`, Active `FALSE`/blank → matched case-insensitively and trimmed; inactive/blank-active and unknown roles refused. (Task 3 test)
5. Same ticket scanned twice (same or different phone) → second is `already_checked_in` showing original time and staff name, never overwrites. (Task 2 test)

---

### Task 1: Tooling and shared types

**Files:**
- Modify: `package.json` (deps + `"test": "vitest run"`)
- Create: `vitest.config.ts`, `src/lib/types.ts`, `.env.example`

**Interfaces:**
- Produces (`src/lib/types.ts`):
  - `type Role = 'admin' | 'scanner'`
  - `type Staff = { email: string; name: string; role: Role }`
  - `type EventInfo = { name: string; date: string; venue: string; details: string; ticketFrom: string; ticketTo: string; status: 'open' | 'closed' }`
  - `type Ticket = { ticket: string; name: string; info: string; notes: string; checkedInAt: string; checkedInBy: string; method: '' | 'QR' | 'manual' }`
  - `type LogResult = 'checked_in' | 'already_checked_in' | 'not_found' | 'wrong_event' | 'event_closed' | 'undone'`
  - `type LogEntry = { time: string; event: string; ticket: string; result: LogResult; staffEmail: string; staffName: string; method: 'QR' | 'manual' }`
  - `type ScanOutcome = { result: LogResult; ticket?: string; name?: string; message: string; checkedInAt?: string; checkedInBy?: string }`

- [ ] **Step 1:** `npm i next-auth@beta @googleapis/sheets html5-qrcode@2.3.8 qrcode` and `npm i -D vitest @types/qrcode`. Check `npm ls next-auth` shows no peer-dependency error with Next 16; if it does, stop and report.
- [ ] **Step 2:** Add `vitest.config.ts` (node environment, `@/` alias → `src/`), `"test": "vitest run"` script, the types above, and `.env.example` with: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SHEET_ID`.
- [ ] **Step 3:** Run `npm test` → "No test files found" (exit is fine), `npx tsc --noEmit` → no errors.
- [ ] **Step 4:** Commit `chore: add test tooling, deps and shared types`.

### Task 2: QR and check-in rules (pure)

**Files:**
- Create: `src/lib/qr.ts`, `src/lib/checkin.ts`
- Test: `src/lib/qr.test.ts`, `src/lib/checkin.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces:
  - `normalizeTicket(v: string | number): string | null` — digits only, 1–4 digits → zero-padded 4; else `null`.
  - `makePayload(event: string, ticket: string): string`
  - `parsePayload(text: string): { event: string; ticket: string } | null`
  - `isValidEventName(name: string): boolean`
  - `ticketRange(from: string, to: string): string[]`
  - `decideCheckIn(args: { scannedEvent: string | null; event: EventInfo; ticket: Ticket | undefined; now: string; staffName: string; method: 'QR' | 'manual' }): { outcome: ScanOutcome; update?: Pick<Ticket, 'checkedInAt' | 'checkedInBy' | 'method'> }` — applies the spec's rule order; `scannedEvent === null` means "not a ticket" → `not_found` with message `"Not a TAC ticket"`. Manual check-ins pass `scannedEvent = event.name`.

- [ ] **Step 1: Write failing tests.**
  - `normalizeTicket`: `1→"0001"`, `"57"→"0057"`, `"0001"→"0001"`, `"1000"→"1000"`, `"abc"→null`, `"12345"→null`, `""→null`.
  - `parsePayload`: `"TAC Thanksgiving 2026-0001"→{event:"TAC Thanksgiving 2026",ticket:"0001"}`; `"Youth-Night 2026-0042"→{event:"Youth-Night 2026",ticket:"0042"}`; `"https://example.com"→null`; `"0001"→null`; round-trip with `makePayload`.
  - `isValidEventName`: true for `"TAC Thanksgiving 2026"`; false for `""`, `"Log"`, `"staff"`, 41 chars, `"Gala/2026"`.
  - `ticketRange("0000","0003")` → `["0000","0001","0002","0003"]`.
  - `decideCheckIn`, one test per result: `wrong_event` (message names the other event), `event_closed`, `not_found` (ticket undefined), `not_found` (scannedEvent null), `already_checked_in` (returns original `checkedInAt`/`checkedInBy`, no `update`), `checked_in` with name (message contains name, `update.method === 'QR'`), `checked_in` without name (message `"Ticket 0057 — no name"`), manual (`update.method === 'manual'`).
- [ ] **Step 2:** `npm test` → FAIL (modules missing).
- [ ] **Step 3:** Implement both files.
- [ ] **Step 4:** `npm test` → all PASS.
- [ ] **Step 5:** Commit `feat: QR payload and check-in rules`.

### Task 3: Sheets store

**Files:**
- Create: `src/lib/staff.ts`, `src/lib/store.ts`
- Test: `src/lib/staff.test.ts`

**Interfaces:**
- Consumes: Task 1 types, Task 2 `normalizeTicket`, `ticketRange`, `decideCheckIn`, `isValidEventName`.
- Produces:
  - `staff.ts`: `parseStaffRows(rows: string[][]): Staff[]` (skips header; trims; lowercases email; role lowercased must be `admin`/`scanner`; Active must be `TRUE` case-insensitive) and `findStaff(list: Staff[], email: string): Staff | undefined`.
  - `store.ts` (all `async`, server-only — first line `import 'server-only'`):
    - `ensureSchema(): Promise<void>` — creates missing `Staff`/`Events`/`Log` tabs with headers.
    - `getStaffList(): Promise<Staff[]>` — cached in module memory 60 s.
    - `listEvents(): Promise<EventInfo[]>` / `getEvent(name: string): Promise<EventInfo | undefined>`
    - `createEvent(e: EventInfo): Promise<void>` — validates name + uniqueness (throws `Error` with user-facing message), appends to `Events`, creates tab named `e.name` with headers and one row per `ticketRange`, writing the `Ticket` column as text (`valueInputOption: 'RAW'`).
    - `updateEvent(name: string, patch: Partial<Omit<EventInfo, 'name'>>): Promise<void>` — never changes `name`.
    - `listTickets(event: string): Promise<Ticket[]>` — normalises `ticket` via `normalizeTicket`.
    - `updateTicket(event: string, ticket: string, patch: Partial<Pick<Ticket, 'name' | 'info' | 'notes'>>): Promise<void>`
    - `checkIn(args: { payload: string | null; event: string; ticket?: string; staff: Staff; method: 'QR' | 'manual' }): Promise<ScanOutcome>` — QR: parse `payload`; manual: use `ticket`. Reads the event tab once, finds row by `Ticket` column, calls `decideCheckIn`, writes `update` to that row if present, appends one `Log` row for every outcome.
    - `undoCheckIn(event: string, ticket: string, staff: Staff): Promise<void>` — clears the three check-in cells, logs `undone`.
    - `getDashboard(event: string): Promise<{ total: number; named: number; checkedIn: number; perStaff: { name: string; count: number }[]; recent: LogEntry[] }>` — one `batchGet` of the event tab + `Log`; `perStaff` counts `checked_in` minus `undone` per staff for this event; `recent` = last 30 log rows for this event, newest first.
  - Sheets client: `@googleapis/sheets` with JWT from `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` (replace literal `\n` with newlines). On HTTP 429, retry up to 3 times with 500 ms/1 s/2 s backoff, then throw `Error("Busy, try again")`.

- [ ] **Step 1: Failing tests for `staff.ts`:** `" Maria@Church.org "` matches `findStaff(list,"maria@church.org")`; role `"Admin"` → `admin`; Active `"FALSE"`, `""`, and role `"owner"` rows are excluded; header row skipped.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement `staff.ts` → `npm test` PASS.
- [ ] **Step 4:** Implement `store.ts`.
- [ ] **Step 5: Manual check** with a test Sheet and real `.env.local`: a throwaway script `npx tsx scripts/smoke.ts` (not committed) that runs `ensureSchema`, `createEvent({name:"Test Event",…,"0000","0005"})`, `checkIn` twice for `0001` → `checked_in` then `already_checked_in`, `getDashboard`. Expect the tabs/rows visible in the Sheet. Delete the script.
- [ ] **Step 6:** Commit `feat: Google Sheets store`.

### Task 4: Sign-in and access control

**Files:**
- Create: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/guard.ts`, `src/app/signin/page.tsx`, `src/app/denied/page.tsx`
- Modify: `src/app/page.tsx` (replace starter), `src/app/layout.tsx` (title "TAC Check-in", header with staff name + sign out)

**Interfaces:**
- Consumes: `getStaffList`, `findStaff`, `ensureSchema`.
- Produces:
  - `auth.ts`: exports `{ handlers, auth, signIn, signOut }` from `NextAuth({ providers: [Google] })`; `signIn` callback returns `'/denied'` unless `findStaff` matches.
  - `guard.ts`: `requireStaff(role?: Role): Promise<Staff>` — no session → `redirect('/signin')`; not in current Staff list or role mismatch (`'admin'` required, `scanner` given) → `redirect('/denied')`. Admins satisfy `'scanner'`.
  - `/` → admins to `/admin`, scanners to `/scan`. `/signin` calls `ensureSchema()` once then shows a "Sign in with Google" button.

- [ ] **Step 1:** Read `node_modules/next/dist/docs/01-app/02-guides/authentication.md` and the installed `next-auth` README for the v5 + App Router route handler shape.
- [ ] **Step 2:** Implement the files.
- [ ] **Step 3: Manual check** (`npm run dev`): listed admin → lands on `/admin` (404 is fine for now); unlisted Google account → `/denied`; after setting own Active to `FALSE`, within 60 s a page load → `/denied`.
- [ ] **Step 4:** `npx tsc --noEmit` and `npm run lint` clean. Commit `feat: Google sign-in with Staff-tab roles`.

### Task 5: Scanner page

**Files:**
- Create: `src/app/scan/page.tsx` (server: `requireStaff('scanner')`, loads open events), `src/app/scan/Scanner.tsx` (client), `src/app/actions.ts`

**Interfaces:**
- Consumes: `requireStaff`, `listEvents`, `checkIn`, `updateTicket`.
- Produces (`src/app/actions.ts`, `'use server'`, each starts with `requireStaff`):
  - `scanAction(event: string, payload: string): Promise<ScanOutcome>`
  - `manualScanAction(event: string, ticketInput: string): Promise<ScanOutcome>` — `normalizeTicket` first; invalid → `not_found` outcome without a Sheets write.
  - `setNameAction(event: string, ticket: string, name: string): Promise<void>` — allowed for scanners **only** when that ticket's name is blank (server-checked); admins always.

- [ ] **Step 1:** Implement per spec "Scanner": event picker (open events, remembered in `localStorage` in try/catch), `Html5Qrcode` camera, result card (green `checked_in`, red otherwise; shows name / "Ticket NNNN — no name" / "already checked in at <local time> by <name>"), 2 s cooldown, same payload ignored for 5 s, `navigator.vibrate` if available, "Type ticket number" input, optional "Add name" input after a nameless `checked_in`. Errors from actions show "Busy, try again" in the red card.
- [ ] **Step 2: Manual check** on a phone over HTTPS (`npx ngrok http 3000` or a Netlify deploy preview): scan a printed test QR, duplicate, a QR from another event, a random QR (any product barcode/URL) → expected messages; typed `57` → ticket `0057`; Log tab has one row per attempt.
- [ ] **Step 3:** Commit `feat: scanner page`.

### Task 6: Admin dashboard

**Files:**
- Create: `src/app/admin/layout.tsx` (`requireStaff('admin')`, nav: Dashboard / People / Events / Scanner), `src/app/admin/page.tsx`, `src/app/admin/Dashboard.tsx` (client), `src/app/api/dashboard/route.ts`

**Interfaces:**
- Consumes: `getDashboard`, `listEvents`, `requireStaff`.
- Produces: `GET /api/dashboard?event=<name>` → JSON of `getDashboard`; 401 JSON (not redirect) when not admin.

- [ ] **Step 1:** Implement per spec "Dashboard": event selector (`?event=` search param, default first open event), totals (checked in / named / total / not yet arrived), per-staff counts, live feed with rejections highlighted, polling every 10 s (pause while tab hidden via `document.visibilityState`), "Updated hh:mm:ss" stamp, empty state when no events exist linking to Events.
- [ ] **Step 2: Manual check:** scan on phone → dashboard updates within 10 s; scanner-role account gets 401 from `/api/dashboard` and `/denied` on `/admin`.
- [ ] **Step 3:** Commit `feat: admin dashboard`.

### Task 7: People management

**Files:**
- Create: `src/app/admin/people/page.tsx`, `src/app/admin/people/PeopleTable.tsx` (client)
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `listTickets`, `updateTicket`, `checkIn`, `undoCheckIn`.
- Produces (admin-only actions): `updateTicketAction(event: string, ticket: string, patch: { name?: string; info?: string; notes?: string }): Promise<void>`, `manualCheckInAction(event: string, ticket: string): Promise<ScanOutcome>`, `undoCheckInAction(event: string, ticket: string): Promise<void>`.

- [ ] **Step 1:** Implement per spec "People": table, search (number or name, client-side over the loaded list), filters (all / checked in / not checked in / no name), inline edit, manual check-in, undo with confirm dialog. Closed events: read-only (server actions reject too).
- [ ] **Step 2: Manual check:** edit a name in the app → visible in Sheet; edit in Sheet → visible after reload; manual check-in → Method `manual`; undo → cells cleared + `undone` in Log; sort the event tab by Name in Google Sheets, then check in `0003` → correct person updated.
- [ ] **Step 3:** Commit `feat: people management`.

### Task 8: Events and QR printing

**Files:**
- Create: `src/app/admin/events/page.tsx`, `src/app/admin/events/EventForm.tsx` (client), `src/app/admin/events/[event]/qr/page.tsx`, `src/app/admin/events/[event]/qr/QrSheet.tsx` (client)
- Modify: `src/app/actions.ts`

**Interfaces:**
- Consumes: `listEvents`, `createEvent`, `updateEvent`, `getEvent`, `makePayload`, `ticketRange`.
- Produces: `createEventAction(e: EventInfo): Promise<{ error?: string }>`, `updateEventAction(name: string, patch: Partial<Omit<EventInfo,'name'>>): Promise<void>`.

- [ ] **Step 1:** Events page per spec: list, create form (name with live validation + "can't be changed later" note, date, venue, details, range default `0000`–`1000`), edit others, open/close toggle.
- [ ] **Step 2:** QR page: `params` is a `Promise` — `await` it and `decodeURIComponent` the event name. Range inputs (default whole range); renders SVGs from `qrcode.toString(payload, { type: 'svg', margin: 1 })`; print CSS: A4, 5 columns × 7 rows, 30 mm QR, ticket number in large bold under it, light dashed cut lines, nav hidden when printing; "Print" button calls `window.print()`.
- [ ] **Step 3: Manual check:** create `Test Event` with range `0000`–`0010` → tab with 11 rows appears; print preview shows 11 labels on one A4 page; scanning a printed label on `/scan` → `checked_in`; invalid name `Log` rejected with a message.
- [ ] **Step 4:** Commit `feat: events and QR printing`.

### Task 9: Setup guide and deploy

**Files:**
- Modify: `README.md` (replace starter text)
- Delete: `../Code.gs`, `../index.html` (superseded prototype — confirm with user first)

- [ ] **Step 1:** README in plain language for church volunteers: (1) create the Google Sheet and copy its ID, (2) Google Cloud project → enable Sheets API → service account + JSON key, (3) share Sheet with the service-account email as Editor, (4) OAuth consent screen (External, add test users or publish) + OAuth client with redirect `https://<site>/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`, (5) add yourself to `Staff` as `admin` with Active `TRUE`, (6) Netlify: import the repo, set the six env vars, deploy; (7) day-of checklist: open the site the day before, test-scan one ticket, phones charged, mobile data as backup; don't delete rows in event tabs.
- [ ] **Step 2:** Deploy to Netlify; run the full spec "Verification" end-to-end on the deployed URL with a phone.
- [ ] **Step 3:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean. Commit `docs: setup guide`.
