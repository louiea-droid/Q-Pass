# Door Aids, Offline Scanning, Guest Import and Event Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the phone scanner work better at a real door (sound, screen stays on, flashlight, keeps working offline, no accidental sign-out), let admins import a guest list from CSV, and show an after-event report on the Events page.

**Architecture:** Door aids live in the scanner client (`src/app/scan/`), with browser-only helpers in small files. The offline queue is a pure module over a `Storage`-like interface (testable without a browser) that the scanner calls when a scan fails for network reasons. CSV import and the report reuse the existing store functions (`listTickets`, `updateTicket`), so there is no database or `schema.sql` change. Pure logic (CSV parsing, queue, arrival buckets, no-shows) goes in `src/lib/` with Vitest tests.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind 4, Vitest, html5-qrcode 2.3.8, Web Audio, Screen Wake Lock API.

**Spec:** This conversation's decisions, summarized here (no separate spec file):
1. Sound: a short high beep for a green result, a low buzz for any red result.
2. Keep the phone screen awake while the scanner has an event selected.
3. Flashlight button, shown only when the camera supports it (Android Chrome; iPhones do not).
4. Offline: if a scan can't reach the server, save it on the phone, show an **amber "Saved offline"** card (not green), send it automatically when back online. Duplicates found during sync show up red in the Check-in log (the server already logs them).
5. CSV import on the Tickets page: rows of **ticket number + name**, optionally details and notes.
7. + 8. On the **Events page, selecting an event shows its report**: arrivals per 15 minutes chart, and a no-show list with a download.
9. Sign out asks for confirmation first (desktop header and scanner menu).

## Global Constraints

- No new npm dependencies. No changes to `supabase/schema.sql` or `Code.gs`.
- Colors only from tokens in `src/app/globals.css` (`primary`, `accent`, `ok`, `bad`, `note`, etc.). Amber offline card uses `bg-note text-note-ink`.
- Copy is plain and short, written for volunteers. Use "details" in UI text for the `info` field.
- Admin-only actions call `requireStaff('admin')`; anything that changes tickets also calls `requireOpenEvent(event)` (existing, `src/app/actions.ts:44`).
- Every new browser API call is wrapped so a missing or refused API never breaks scanning.
- Run `npx tsc --noEmit`, `npx eslint src`, `npx vitest run` before each commit.

## Review Focus

- **CSV exported from this app re-imported**: cells like `="0001"`, a UTF-8 BOM, header `Info` instead of `Details`. Must import cleanly (test in Task 4).
- **Blank cells in the CSV**: must not wipe an existing name, details or notes (test in Task 4).
- **Ticket numbers typed as `57` or ` 0057 `**: normalize to `0057`; numbers not in this event are listed back to the admin, not silently dropped (test in Task 4).
- **Wi-Fi connected but no internet** (`navigator.onLine` is true but the request fails): still counts as offline and queues the scan (test in Task 2).
- **Chart times on Vercel**: the server runs in UTC, so time labels must be formatted in the browser, not on the server (Task 6 formats in a client component; bucket test in Task 5 uses UTC-only math).

---

### Task 1: Scanner door aids (sound, screen awake, flashlight)

**Files:**
- Create: `src/app/scan/door.ts`
- Modify: `src/app/scan/Scanner.tsx` (the `run()` function at ~line 70, the camera effect at ~line 114, the header at ~line 153)

**Interfaces:**
- Produces: `playTone(ok: boolean): void`, `unlockAudio(): void`, `useWakeLock(active: boolean): void`, all from `src/app/scan/door.ts`.

- [ ] **Step 1: Write `door.ts`**
  - `unlockAudio()`: create a single shared `AudioContext` lazily and `resume()` it. Call it from the scanner's first `pointerdown` (iOS only allows audio after a tap).
  - `playTone(ok)`: green = 880 Hz sine, 120 ms. Red = two 220 Hz square pulses of 150 ms with a 80 ms gap. Gain 0.2 with a 10 ms fade in and out (no clicks). No-op if `AudioContext` is unavailable.
  - `useWakeLock(active)`: when `active`, `navigator.wakeLock?.request('screen')`, re-request on `visibilitychange` back to visible, release on cleanup. Swallow every error.
- [ ] **Step 2: Wire into `Scanner.tsx`**
  - In `run()`, call `playTone(ok)` next to the existing `navigator.vibrate` call. On the catch path (error), call `playTone(false)`.
  - `useWakeLock(!!event)`.
  - Add `onPointerDown={unlockAudio}` on the scanner's outer `div`.
  - Keep the `Html5Qrcode` instance in a `useRef`. After `qr.start()` resolves, read `qr.getRunningTrackCameraCapabilities().torchFeature()`. If `isSupported()`, show a round 44px flashlight button inside the camera box (top-right, `aria-pressed`, label "Flashlight"), toggling via `torch.apply(!on)`. Hide it when unsupported. Reset to off when the event changes.
- [ ] **Step 3: Verify**
  Run: `npx tsc --noEmit && npx eslint src/app/scan && npx vitest run`. Expected: all pass.
  Manual (phone on the dev server over HTTPS or the deployed preview): green beep, red double buzz, screen does not dim after 1 minute, flashlight button appears on Android and toggles the light, and does not appear on iPhone.
- [ ] **Step 4: Commit** `feat(scanner): sound on scan, keep screen awake, flashlight toggle`

### Task 2: Offline queue (pure module)

**Files:**
- Create: `src/lib/offline.ts`
- Test: `src/lib/offline.test.ts`

**Interfaces:**
- Produces:
  - `type QueuedScan = { id: string; event: string; method: 'QR' | 'manual'; value: string; at: string }` (`value` is the QR payload or the typed ticket number; `at` is an ISO time)
  - `const QUEUE_KEY = 'qpass-offline-queue'`
  - `readQueue(s: Pick<Storage, 'getItem'>): QueuedScan[]` (bad or missing JSON gives `[]`)
  - `enqueue(s: Pick<Storage, 'getItem' | 'setItem'>, scan: Omit<QueuedScan, 'id'>): QueuedScan[]` (adds an id from `crypto.randomUUID()`, returns the new queue)
  - `drain(s: Pick<Storage, 'getItem' | 'setItem'>, send: (q: QueuedScan) => Promise<void>): Promise<{ sent: number; left: number }>` sends oldest first, removes each one after `send` resolves, and stops at the first rejection, leaving it and the rest queued
  - `isNetworkError(e: unknown, online: boolean): boolean` returns true when `!online`, or when the error message matches `/fetch|network|load failed|connection/i`

- [ ] **Step 1: Write the failing tests** (fake storage = a `Map` with `getItem`/`setItem`)
  - `readQueue` returns `[]` for a missing key and for `'not json'`.
  - `enqueue` twice, then `readQueue` returns both in order, with distinct ids.
  - `drain` with an always-resolving `send` gives `{ sent: 2, left: 0 }` and an empty queue.
  - `drain` where `send` rejects on the 2nd item gives `{ sent: 1, left: 2 }` for 3 items, and the queue still holds items 2 and 3 in order.
  - `isNetworkError(new Error('x'), false)` is `true`. `isNetworkError(new TypeError('Failed to fetch'), true)` is `true`. `isNetworkError(new Error('Load failed'), true)` (Safari) is `true`. `isNetworkError(new Error('Event not found'), true)` is `false`.
- [ ] **Step 2: Run** `npx vitest run src/lib/offline.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `src/lib/offline.ts`** to the interfaces above.
- [ ] **Step 4: Run** `npx vitest run src/lib/offline.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(offline): scan queue stored on the phone`

### Task 3: Offline scanning in the scanner

**Files:**
- Modify: `src/app/scan/Scanner.tsx`

**Interfaces:**
- Consumes: everything from Task 2; `scanAction`, `manualScanAction` (existing); `playTone` (Task 1).

- [ ] **Step 1: Queue on network failure.** Change `run(action)` to `run(action, queued: Omit<QueuedScan, 'id'>)`, where callers pass `{ event, method: 'QR', value: text, at: new Date().toISOString() }` or the manual equivalent. In the catch: if `isNetworkError(e, navigator.onLine)`, call `enqueue(localStorage, queued)`, set new state `savedOffline = queued.value`, set `pending` to the queue length, vibrate and `playTone(true)`, and do not pause. Otherwise keep the existing error message.
- [ ] **Step 2: Amber card.** When `savedOffline` is set, show (in place of a result card, same min height as the green and red cards) a card with `bg-note text-note-ink`. Title "Saved offline". Body: "Ticket {value} will be checked when the internet is back. Let them in." Footer: "Ready for the next person." For a QR scan, show the ticket number parsed with `parsePayload` (existing, `src/lib/qr.ts`), falling back to "this ticket".
- [ ] **Step 2b: Pending badge.** When `pending > 0`, show a pill under the "Scanning as" row: "{n} scan(s) waiting to send". Use `role="status"`.
- [ ] **Step 3: Sync.** One effect that calls `drain(localStorage, send)` on mount, on the `online` event, and every 15 s while `pending > 0`. Guard against overlapping drains with a ref. `send(q)` calls `scanAction(q.event, q.value)` or `manualScanAction(q.event, q.value)`. Any returned outcome counts as sent: a duplicate is logged red by the server and appears in the Check-in log. After each drain, update `pending` and call `refreshCount()`.
  Add a `// ponytail:` comment: offline scans are stamped with the sync time, not the scan time (`check_in` uses `now()`), so the arrivals chart can shift by the outage length. The upgrade path is a `p_at` parameter on `check_in`.
- [ ] **Step 4: Verify.** `npx tsc --noEmit && npx eslint src/app/scan && npx vitest run`. Expected: pass.
  Manual (Chrome DevTools, Network set to Offline): scan a code. The amber card shows and the badge reads 1. Set Network back to Online: within 15 s the badge clears and the scan appears in the desk's Check-in log. Scan an already used ticket offline: amber card at the door, red "Already used" row in the log after sync. Reload the page while offline-queued (online): the queue survives and sends.
- [ ] **Step 5: Commit** `feat(scanner): keep scanning offline and send when back online`

### Task 4: Guest list CSV import

**Files:**
- Modify: `src/lib/csv.ts` (add parser)
- Test: `src/lib/csv.test.ts` (add cases)
- Modify: `src/app/actions.ts` (add action)
- Create: `src/app/admin/tickets/ImportGuests.tsx`
- Modify: `src/app/admin/tickets/page.tsx` (button next to "Download list")

**Interfaces:**
- Produces:
  - `type GuestRow = { line: number; ticket: string; name: string; info: string; notes: string }` (`ticket` normalized, `line` is 1-based in the file)
  - `parseGuestCsv(text: string): { rows: GuestRow[]; badLines: number[] }`
  - `importGuestsAction(event: string, csv: string): Promise<ActionResult & { updated?: number; unknown?: string[]; badLines?: number[] }>`

- [ ] **Step 1: Write the failing parser tests** in `csv.test.ts`
  - Header `Ticket,Name,Details,Notes` + `57,Ana Cruz,Table 4,` gives `[{ line: 2, ticket: '0057', name: 'Ana Cruz', info: 'Table 4', notes: '' }]`.
  - Round trip: `parseGuestCsv(ticketsCsv([...two tickets]))` (with a leading `'﻿'`) gives the same ticket/name/info/notes (covers `="0001"`, header `Info`, BOM).
  - No header: `0012,Ben` gives ticket `0012`, name `Ben`.
  - Quoted cells: `"0013","Cruz, Ana ""Annie"""` gives name `Cruz, Ana "Annie"`.
  - CRLF, LF and a trailing blank line all parse the same. Fully blank lines are skipped and are not bad lines.
  - `abc,Name` (non-blank, invalid ticket) puts that line in `badLines`.
  - A leading `'` added by the export's formula guard (`'=x`) is stripped back to `=x`.
- [ ] **Step 2: Run** `npx vitest run src/lib/csv.test.ts`. Expected: FAIL, `parseGuestCsv` is not exported.
- [ ] **Step 3: Implement `parseGuestCsv`.** A small RFC 4180 tokenizer (quotes, doubled quotes, commas and newlines inside quotes). Strip the BOM. Header mode when any cell in row 1 matches `/^ticket/i`: map columns by header (`ticket`, `name`, `info` or `details`, `notes`, case-insensitive). Otherwise positional ticket, name, info, notes. Per cell: unwrap `="…"`, strip a single leading `'`, trim. Ticket goes through `normalizeTicket` (`src/lib/qr.ts`).
- [ ] **Step 4: Run** the csv tests. Expected: PASS.
- [ ] **Step 5: Add `importGuestsAction`** in `src/app/actions.ts`. It requires admin and `requireOpenEvent`, and rejects more than 5000 rows ("Import up to 5000 rows at a time."). Rows whose ticket is not in `listTickets(event)` go to `unknown` and are skipped. For a duplicate ticket, the last row wins. The patch contains only non-empty fields, so blank cells keep existing values; rows with no non-empty fields are skipped. Apply via `updateTicket` in batches of 10 with `Promise.all`, with a `// ponytail:` comment noting the ceiling (≈1 s per 100 rows on Supabase, slower on Sheets) and that a bulk upsert is the upgrade path. Return `{ updated, unknown, badLines }`.
- [ ] **Step 6: Build `ImportGuests.tsx`** (client). A button "Import names" opens a `popover` dialog, using the same pattern and classes as `ShareScanner.tsx`. It contains a file input (`accept=".csv,text/csv"`), a one-line format hint ("Columns: Ticket, Name, and optional Details and Notes. Blank cells keep what's there."), and an Import button. It reads the file with `file.text()` and calls the action. On success it shows "{n} tickets updated", plus "Not in this event: …" and "Couldn't read lines: …" when present, then calls `router.refresh()`. On a closed event, the action's error message is shown.
- [ ] **Step 7: Verify** `npx tsc --noEmit && npx eslint src && npx vitest run`. Expected: pass. Manual: export the CSV, edit two names in Excel, re-import, and the two names change while the others stay.
- [ ] **Step 8: Commit** `feat(tickets): import guest names from a CSV file`

### Task 5: Report data (arrival buckets, no-shows, no-show download)

**Files:**
- Modify: `src/lib/display.ts`
- Test: `src/lib/display.test.ts`
- Modify: `src/app/api/export/route.ts`

**Interfaces:**
- Produces:
  - `arrivalBuckets(times: string[], minutes = 15): { start: number; count: number }[]`. `start` is epoch ms aligned down to a multiple of `minutes`. The result is contiguous from the first to the last non-empty bucket (zero buckets in between). Empty or blank input gives `[]`.
  - `noShows<T extends { ticket: string; name: string; checkedInAt: string }>(tickets: T[]): T[]` returns named tickets with no check-in, sorted by ticket.
  - Export route: `GET /api/export?event=X&only=noshow` gives CSV of `noShows(...)`, filename `"{event} no-shows.csv"`.

- [ ] **Step 1: Write the failing tests**
  - `arrivalBuckets(['2027-01-03T10:01:00Z','2027-01-03T10:14:59Z','2027-01-03T10:46:00Z'])` gives starts at 10:00, 10:15, 10:30, 10:45 UTC with counts `[2, 0, 0, 1]`.
  - `arrivalBuckets(['', 'x'])` gives `[]`.
  - `noShows` over `[{0003,'C',''},{0001,'A',''},{0002,'',''},{0004,'D','2027…'}]` gives tickets `0001, 0003`.
- [ ] **Step 2: Run** `npx vitest run src/lib/display.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both functions. Use `Date.parse`, skip `NaN`, and align with `Math.floor(ms / step) * step`.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Add `only=noshow`** to the export route (same admin check and BOM).
- [ ] **Step 6: Commit** `feat(report): arrival buckets and no-show list`

### Task 6: Event report on the Events page

**Files:**
- Create: `src/app/admin/events/EventReport.tsx` (server component)
- Create: `src/app/admin/events/ArrivalsChart.tsx` (client component)
- Modify: `src/app/admin/events/page.tsx` (read `searchParams.report`, add a "Report" link on each card)

**Interfaces:**
- Consumes: `arrivalBuckets`, `noShows`, `arrivalCounts` (`src/lib/display.ts`), `listTickets`.
- Produces: `<EventReport event={EventInfo} tickets={Ticket[]} />`, `<ArrivalsChart buckets={{ start: number; count: number }[]} />`

- [ ] **Step 1: Events page selection.** Each event card gets a secondary link "Report" → `?report={encodeURIComponent(name)}#report`. The selected card shows `aria-current="true"` and an `accent` outline. When `report` matches an event, render `<EventReport>` above the list in a `<section id="report">` with a close link back to `/admin/events`.
- [ ] **Step 2: `EventReport`.** Header with the event name and date. Stat row: tickets given, arrived, no-shows, checked in without a name (from `arrivalCounts` plus `noShows(...).length`). Then `<ArrivalsChart buckets={arrivalBuckets(tickets.map(t => t.checkedInAt))} />`. Then the no-show list: the first 50 as rows (ticket number + name + details), with "and {n} more" after them, and a "Download no-shows" link to `/api/export?event=…&only=noshow`. Empty states: "No one has checked in yet." for the chart and "Everyone with a name arrived." for no-shows.
- [ ] **Step 3: `ArrivalsChart`** (client, so labels use the viewer's time zone). Load the `dataviz` skill before writing it. Vertical bars as plain divs (no chart library), each bar's height scaled to the max count. The busiest bucket is highlighted with `bg-accent`, the others are `bg-primary`. X labels show `h:mm` every 4th bucket (hourly) and the y-axis max is labelled. Each bar has `title` and an `sr-only` label "{time}: {n} arrivals". Horizontal scroll inside its own container when there are more than ~40 buckets.
- [ ] **Step 4: Verify** `npx tsc --noEmit && npx eslint src && npx vitest run`. Expected: pass. Manual: Events, then Report on "TAC 50th Thanksgiving 2027". The chart shows the 9 check-ins at local times, the no-show count is 28, and the download opens in Excel.
- [ ] **Step 5: Commit** `feat(events): event report with arrivals chart and no-show list`

### Task 7: Confirm before signing out

**Files:**
- Create: `src/app/SignOutButton.tsx` (client)
- Modify: `src/app/admin/AdminHeader.tsx` (replace the form button), `src/app/scan/Scanner.tsx` (avatar menu "Sign out")

**Interfaces:**
- Consumes: `signOutAction` (existing, `src/app/signin/actions.ts`); `readQueue`, `QUEUE_KEY` (Task 2).
- Produces: `<SignOutButton className?: string />`

- [ ] **Step 1: Build `SignOutButton`.** The trigger button keeps the caller's classes and text "Sign out" and opens a `popover` dialog (same pattern as `ShareScanner.tsx`). The dialog has the title "Sign out?" and the body "You'll need your name and the passcode to sign back in." If `readQueue(localStorage).length > 0`, it adds a `bg-note` warning: "{n} offline scans haven't been sent yet. Stay signed in until the internet is back." Buttons: "Cancel" (closes; autofocused, so Enter doesn't sign out by accident) and "Sign out" (`<form action={signOutAction}>` submit, `bg-bad text-on-flag`).
- [ ] **Step 2: Use it** in `AdminHeader.tsx` (keeping the theme toggle and name in the same row) and in the scanner's avatar menu.
- [ ] **Step 3: Verify** `npx tsc --noEmit && npx eslint src && npx vitest run`. Expected: pass. Manual: clicking Sign out opens the dialog, Cancel and Esc keep you signed in, and Sign out signs out. With a queued offline scan, the warning shows.
- [ ] **Step 4: Commit** `feat: confirm before signing out`

---

## Order and dependencies

Task 1 and Task 7 are independent of the rest. Task 3 needs Task 2. Task 7's offline warning needs Task 2 (do Task 7 after Task 2). Task 6 needs Task 5. Task 4 stands alone.
Suggested order: 1, 2, 3, 7, 4, 5, 6.
