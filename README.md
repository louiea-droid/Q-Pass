# Q-Pass

Staff scan the QR code on each paper ticket with their phone, and the check-in is saved straight away. Admins watch arrivals live, fix names, check people in by hand, download the list as a spreadsheet, and print QR codes for new events.

Everything runs on free plans. You don't need a card.

## Where the data lives

The app can keep its data in one of two places. It picks **Supabase** when `SUPABASE_URL` is set, and the **Google Sheet** otherwise.

- **Supabase (recommended).** A free online database. A scan takes a fraction of a second. To get a spreadsheet, use **Download CSV** on the People page; it opens in Excel or Google Sheets.
- **Google Sheet (through Apps Script).** The data sits in a Sheet you can open and edit directly. It works, but Google's script service is slow: we measured 1.5 to 14 seconds per scan. Fine for a small, quiet event; risky with a queue at the door.

Either way, two phones scanning the same ticket at the same moment is safe: only one of them shows green.

## Signing in

There are two passcodes, set by you, and they must be different:

- the **scanner passcode** opens the scanner only;
- the **admin passcode** opens everything (dashboard, people, events, QR printing, and the scanner).

Staff also type their name, and that name is recorded with every check-in they make. Sign-ins last 12 hours. If a passcode leaks, change that passcode **and** `AUTH_SECRET` in the settings, then restart or redeploy. That signs everyone out.

## One-time setup with Supabase (about 10 minutes)

### 1. Make the database

1. Sign up at <https://supabase.com> (free) and click **New project**. Pick any name and a strong database password (you won't need it in the app), and the region closest to you (e.g. Singapore).
2. When it's ready, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**. It should say "Success".
3. Open **Project Settings → API** (or **API Keys**). Copy the **Project URL** into `SUPABASE_URL`, and the **service_role** secret key into `SUPABASE_SERVICE_ROLE_KEY`.

The service_role key can read and change everything. Keep it only in `.env.local` and in Netlify's settings, never in chats, screenshots or code.

On the free plan Supabase pauses a project after a week with no use. Open the app a day or two before each event; if it's paused, click **Restore** in the Supabase dashboard.

### 2. Fill in the rest of the settings

In `.env.local` (copy `.env.example` if it doesn't exist):

- `SCANNER_PASSCODE` and `ADMIN_PASSCODE`: two **different** passcodes that are hard to guess, like `harvest-lamp-17`.
- `AUTH_SECRET`: random text, 32+ characters. Generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Never share or commit `.env.local`. Git already ignores it.

### 3. Try it on your computer

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, sign in with your name and the admin passcode, then:

1. Go to **Events** and create the event.
2. Click **Print QR codes**, print a few, and test-scan them.

Phone cameras only work on `https://` sites, so test scanning on a phone after putting it online (or use your laptop's webcam on localhost).

## Using the Google Sheet instead

Leave `SUPABASE_URL` empty and set these instead:

1. In an empty Google Sheet, open **Extensions → Apps Script**, paste everything from `apps-script/Code.gs`, and save.
2. **Project Settings → Script properties**: add `SECRET` with the same value as `APPS_SCRIPT_SECRET` in `.env.local` (random text, generate it like `AUTH_SECRET`).
3. **Deploy → New deployment → Web app**, **Execute as: Me**, **Who has access: Anyone**. Authorize it (on "Google hasn't verified this app", choose **Advanced → Go to …**: it's your own script).
4. Put the web app URL (ends in `/exec`) in `APPS_SCRIPT_URL`.

The app creates the `Events` and `Log` tabs on first visit. Editing the script later needs **Deploy → Manage deployments → edit → New version**. Don't delete rows in an event tab; sorting and filtering are fine.

Moving between Supabase and the Sheet doesn't copy data across. Pick one before you print QR codes and enter names.

## Put it online (Netlify, free)

1. Push this folder to a GitHub repository (private is fine).
2. On <https://app.netlify.com>, choose **Add new site → Import an existing project** and pick the repository. Netlify detects Next.js by itself.
3. Under **Site configuration → Environment variables**, add the same values as in `.env.local`.
4. Deploy, and share the site address and the scanner passcode with your team.

## Handing out tickets

Open **Tickets**, find the ticket number you are handing over, and type the person's name (plus any details). A ticket with a name counts as **given**; clear the name to make it not given again. Press **Enter** to jump to the next ticket's name. Changes save on their own. Names are optional: a ticket with no name still works at the door.

## Day before the event

- Open the app (this also wakes Supabase if it paused). Make sure the event is **open** on the Events page.
- Have every scanner sign in on their own phone, with their name and the scanner passcode, and pick the event.
- Scan one test ticket, then undo it on the People page.
- Charge the phones. Mobile data is a good backup if the venue Wi-Fi drops; the app needs internet.

## During the event

- **Green** means checked in. **Red** tells you why: already used (with the time and who scanned it), wrong event, closed event, or not a ticket.
- If a QR code won't scan, type the ticket number in the box under the camera.
- Admins can fix names and check people in by hand on **People**, and watch arrivals on **Dashboard**. The dashboard refreshes every 10 seconds.
- **Download CSV** on the People page gives you the full list for Excel or Google Sheets at any time.

## If something goes wrong

- **"That passcode isn't right"**: check for typos; passcodes are case-sensitive.
- **"Can't reach the database: Invalid API key"**: `SUPABASE_SERVICE_ROLE_KEY` is wrong or is the public anon key. Use the service_role key.
- **"relation … does not exist"**: run `supabase/schema.sql` in the Supabase SQL Editor.
- **Nothing loads and Supabase shows "Paused"**: click **Restore** in the Supabase dashboard.
- **"Can't reach the database: Wrong secret"** (Sheet mode): `APPS_SCRIPT_SECRET` must match the script's `SECRET` property exactly.

## For developers

Next.js 16 (App Router), React 19, Tailwind 4. `src/lib/store.ts` picks a backend: `store-supabase.ts` (PostgREST with the service_role key; atomic `check_in` and one-call `dashboard` functions in `supabase/schema.sql`) or `store-sheets.ts` (calls `apps-script/Code.gs`). Both export the same functions. Check-in rules are in `src/lib/checkin.ts`, QR parsing in `src/lib/qr.ts`, sessions in `src/lib/session.ts`, CSV in `src/lib/csv.ts`, all unit-tested (`npm test`). Design and plan: `docs/plans/`.
