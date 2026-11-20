# TAC QR Check-in System — Design

Date: 2026-11-20
Status: approved 2026-11-20

Assumed defaults (user approved without answering; revisit if wrong): build the full scope (no deadline given); peak of a few check-ins per minute; all staff have Google accounts; no QR codes or names from the old prototype need migrating.

## Intent

Our church runs events (first: Thanksgiving) with pre-printed, numbered paper tickets. Registration staff should scan the QR code on each ticket with their phone so check-in is recorded automatically, and admins should see live who has arrived, who scanned them, and be able to manage attendees and check people in by hand. The system will be reused for future events. It is a non-profit project and must cost nothing to run.

## Goals

- Staff check people in by scanning a ticket's QR code with a phone camera. The result appears immediately: name (if known), or a clear rejection.
- Every check-in records when, by whom (signed-in staff member), and how (QR or manual).
- Admin dashboard: live progress (checked in vs. total), per-staff scan counts, live feed of recent scans including rejected ones.
- Admins manage attendees: assign/edit names on ticket numbers, add walk-ins, manual check-in, undo a mistaken check-in.
- Admins generate printable QR codes for an event's ticket range.
- Multiple events over time, each with its own tickets and check-ins.
- Google Sheet remains the data store, readable and editable by the team directly.

## Non-goals

- Designing or printing the tickets themselves (only the QR codes are produced; staff stick/attach them to physical tickets).
- Emailing tickets, online registration, payments.
- Offline scanning (venue must have internet; see Risks).
- Managing staff inside the app (staff list is edited in the Sheet).
- Charts and reports beyond the dashboard described below.

## Anti-goals (failure even if it "works")

- A ticket from one event being accepted at another event.
- The same ticket checked in twice without anyone noticing.
- Anyone without an approved staff account seeing attendee data.
- A setup so complicated the church team can't run it without the developer.

## Constraints

- Free: Netlify free plan (Vercel Hobby is for personal use only), Google Sheets API, free Google Cloud project.
- Existing app: `tac-rms/` — Next.js 16 (App Router, `src/`), React 19, Tailwind 4, TypeScript. Next 16 has breaking changes; read `node_modules/next/dist/docs/` before writing code (see `AGENTS.md`).
- Scale: up to 1,001 tickets per event (`0000`–`1000`), a handful of scanners at once.
- Planned upgrade path to Supabase if Sheets becomes limiting.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Next.js app + Google Sheet via service account + Google sign-in | Proper UI, data stays in a Sheet; one-time Google Cloud setup; updates every few seconds, not instant |
| B | Next.js app + Supabase | Instant/realtime, robust; team loses direct Sheet access |
| C | Everything in Google Apps Script | Least setup; plainer UI, unreliable camera in Apps Script iframes |

User chose A: "try Google Sheet first, upgrade to Supabase if it matters." Therefore all data access goes through one module (see Architecture) so the later swap touches one place.

The earlier standalone prototype (`../Code.gs`, `../index.html`) is superseded by this app and can be deleted once the app works.

## Decisions made by the user

1. Admin dashboard must also **manage people** and do **manual check-in**.
2. Tickets are numbered **0000–1000**. Each number has its own QR code.
3. Linking a name to a ticket is **optional**: names are normally assigned before the event, but an unnamed ticket can still be checked in.
4. The app generates **only the QR codes**, printed by the team and attached to physical tickets.
5. The system is **reused** across events.
6. The QR includes the **event name** as the event code (so old tickets are rejected at new events).
7. Staff access via a **Staff tab** in the Sheet with roles **admin** and **scanner**; anyone not listed is blocked.
8. Data store: **Google Sheets** now, Supabase later if needed.
9. Non-profit (church Thanksgiving) → free hosting.

## Design

### Roles

- **Scanner:** scanner page only.
- **Admin:** everything — scanner, dashboard, people, events, QR printing.
- Not in Staff tab (or inactive): sign-in is refused with a "not authorised, ask an admin" page.

### Google Sheet layout (one spreadsheet)

**`Staff`** — `Email | Name | Role | Active`
- Role is `admin` or `scanner`. Active is `TRUE`/`FALSE`. Emails compared case-insensitively.

**`Events`** — `Name | Date | Venue | Details | TicketFrom | TicketTo | Status`
- `Name` is the event code, unique, and **locked after creation** (printed QR codes depend on it). Allowed characters: letters, digits, spaces, `-`; max 40 chars (fits a tab name and a QR).
- `TicketFrom`/`TicketTo` default `0000`/`1000`.
- `Status`: `open` (scans accepted) or `closed` (scans rejected, data read-only in app).

**One tab per event, named exactly the event name** — `Ticket | Name | Info | Notes | CheckedInAt | CheckedInBy | Method`
- Created by the app with one row per ticket number, pre-filled `0000`…`1000` (stored as text so leading zeros survive).
- `Info`: free text (e.g. contact, group, family). `CheckedInBy`: staff name. `Method`: `QR` or `manual`.
- Admins may also bulk-fill names by pasting directly into this tab in Google Sheets.
- The app never assumes row order: it finds a ticket's row by matching the `Ticket` column on every read/write (*my call*), so sorting or filtering the tab by hand is safe. Deleting ticket rows makes those tickets `not_found`; the README says not to.

**`Log`** — `Time | Event | Ticket | Result | StaffEmail | StaffName | Method`
- Append-only record of **every** scan and manual action. Result is one of: `checked_in`, `already_checked_in`, `not_found`, `wrong_event`, `event_closed`, `undone`.
- Source for the dashboard's per-staff counts and live feed.

### QR codes

- Payload: `<EventName>-<NNNN>`, e.g. `TAC Thanksgiving 2026-0001`. Parse by splitting on the **last** `-`.
- Printed label: QR about 3 cm square with the ticket number large underneath; A4 grid, ~35 per page, light cut lines.
- Admin picks a range (e.g. `0000`–`0099`) to print or reprint a batch. Uses browser print (print CSS), no PDF library.

### Scan / check-in rules

Given a scanned payload while the staff member has an event selected:
1. Event part ≠ selected event → `wrong_event` ("This ticket is for <other event>").
2. Event closed → `event_closed`.
3. Number not in event's range → `not_found`.
4. Ticket already has `CheckedInAt` → `already_checked_in`, show time and who checked it in.
5. Otherwise write `CheckedInAt`, `CheckedInBy`, `Method=QR` → `checked_in`, show name or "Ticket 0057 — no name".
Every outcome is appended to `Log`.

Unnamed ticket on success: show an optional "Add name" field; staff can type a name or skip.

Before writing, the server re-reads that ticket's row to reduce (not eliminate) double check-ins; see Risks.

### Screens

**Sign-in** — Google sign-in button. Unauthorised accounts see a refusal page.

**Scanner (`/scan`)** — mobile-first.
- Pick the event (open events only; remembered on the device).
- Continuous camera scanning; big green/red result card with name/ticket, auto-ready for the next scan after ~2 s; same code ignored for 5 s.
- Sound/vibration on result (*my call*; easy to drop).
- "Type ticket number" box for damaged/unreadable QR codes (*my call*), recorded as `manual`.

**Dashboard (`/admin`)** — event selector at top; refreshes every 5–10 s.
- Totals: checked in / named tickets / total tickets; not-yet-arrived count.
- Per-staff counts (successful check-ins per staff member).
- Live feed: last ~30 `Log` entries, rejections highlighted.

**People (`/admin/people`)**
- Table of the event's tickets: number, name, info, status, time, by whom, method.
- Search by number or name; filters: checked in / not checked in / no name.
- Edit name/info/notes; manual check-in; undo check-in (admin only, logged as `undone`).
- Walk-in = staff hands over a physical ticket, admin finds that number and types the name (no separate flow needed).

**Events (`/admin/events`)**
- List events; create event (name locked after creation, range defaults 0000–1000) which also creates its tab; edit date/venue/details; open/close.

**QR codes (`/admin/events/[event]/qr`)**
- Range picker + print button, as above.

### Architecture

- Next.js App Router; server-side route handlers / server actions call the Sheets API. The browser never talks to Google Sheets directly and never sees credentials.
- **`src/lib/store.ts`** is the only module that touches Google Sheets (staff lookup, events, tickets, log). It exposes plain functions (e.g. `getStaff`, `listEvents`, `createEvent`, `checkIn`, `getDashboard`). Swapping to Supabase later replaces this file only.
- Auth: Auth.js (NextAuth) with the Google provider (*my call*); on sign-in and on each protected request the email is checked against `Staff` (staff list cached ~60 s in memory). Role checks enforced on the server for every action, not only by hiding UI.
- QR generation: `qrcode` npm package rendered client-side as SVG (*my call*). QR scanning: `html5-qrcode` (*my call*; same lib as the prototype).
- Timestamps stored as ISO strings in the Sheet; shown in the viewer's local time.
- Secrets in environment variables: Google OAuth client ID/secret, service-account email + private key, spreadsheet ID, Auth secret. Documented in `.env.example`.

### Setup the team must do (documented in README with screenshots-level steps)

1. Create the Google Sheet with `Staff`, `Events`, `Log` tabs and headers (or the app creates missing tabs/headers on first run — *my call: app creates them*).
2. Google Cloud project (free): enable Sheets API, create a service account + key, create OAuth client for sign-in.
3. Share the Sheet with the service-account email as Editor.
4. Add yourself to `Staff` as `admin`.
5. Deploy to Netlify, set environment variables.

## Risks and limits

- **Google Sheets API quotas** (per-minute read/write limits per project and per user; the service account counts as one user). Several scanners at rush plus dashboards polling could hit them. Mitigation: dashboard polls every 10 s and reads in one batch request, short server-side caching where possible, retry with backoff on 429 errors and a friendly "busy, try again" message on the scanner. Builder: verify current quota numbers and size polling accordingly. If limits are hit in practice → Supabase upgrade.
- **No transactions in Sheets:** two scanners scanning the same ticket within the same second could both succeed. The re-read narrows the window; both scans still appear in `Log`, so it is visible. Accepted for v1; Supabase fixes it with an atomic update.
- **Serverless instances don't share memory:** caches are per instance; correctness must not depend on them.
- **Internet required** at the venue (phone data as backup).
- **Event names are locked** after creation; a typo in the name means creating a new event before printing.

## Left to the builder

- Exact component structure, styling within Tailwind (use the project's frontend skills), polling interval within 5–10 s.
- Exact Auth.js / Next 16 integration details (follow Next 16 docs in `node_modules/next/dist/docs/`).
- Whether reads of a single ticket use a range read or a cached tab read, subject to the quota note.

## Verification

- A small check for QR payload parsing and the check-in rules (all six results).
- Manual end-to-end with a test Sheet: create event, print a QR range, scan on a phone over HTTPS, see it on the dashboard, manual check-in, undo, wrong-event and duplicate scans, unauthorised account refused.
