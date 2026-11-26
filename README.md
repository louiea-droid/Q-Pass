# Q-Pass

Staff scan the QR code on each paper ticket with their phone, and the check-in is saved straight away. Admins watch arrivals live, fix names, check people in by hand, download the list as a spreadsheet, and download QR codes for new events.

Everything runs on free plans. You don't need a card.

## Where the data lives

The data lives in **Supabase**, a free online database. A scan takes a fraction of a second. To get a spreadsheet, use **Download CSV** on the People page; it opens in Excel or Google Sheets.

Two phones scanning the same ticket at the same moment is safe: only one of them shows green.

## Signing in

There are two passcodes, set by you, and they must be different:

- the **scanner passcode** opens the scanner only;
- the **admin passcode** opens everything (dashboard, people, events, QR codes, and the scanner).

Staff also type their name, and that name is recorded with every check-in they make. Sign-ins last 12 hours. If a passcode leaks, change that passcode **and** `AUTH_SECRET` in the settings, then restart or redeploy. That signs everyone out.

## One-time setup with Supabase (about 10 minutes)

### 1. Make the database

1. Sign up at <https://supabase.com> (free) and click **New project**. Pick any name and a strong database password (you won't need it in the app), and the region closest to you (e.g. Singapore).
2. When it's ready, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**. It should say "Success".
3. Open **Project Settings → API** (or **API Keys**). Copy the **Project URL** into `SUPABASE_URL`, and the **service_role** secret key into `SUPABASE_SERVICE_ROLE_KEY`.

The service_role key can read and change everything. Keep it only in `.env.local` and in Vercel's settings, never in chats, screenshots or code.

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
2. Click **QR codes**, then **Download all** (one zip file of PNG images, each named by its ticket number with the number printed under the code). Print a few and test-scan them.

Phone cameras only work on `https://` sites, so test scanning on a phone after putting it online (or use your laptop's webcam on localhost).

## Test the camera on a phone before going online

Phones only allow the camera on secure (https) sites. To try it on your own network first:

1. Run `npm run dev:phone` (instead of `npm run dev`).
2. Connect the phone to the same Wi-Fi, or to this PC’s hotspot.
3. Open `https://<this PC’s address>:3000/scan` on the phone. The PC’s address is in `next.config.ts` under `allowedDevOrigins`; add yours there if it’s different.
4. The phone warns that the connection isn’t private. That’s expected for a test certificate: tap **Advanced → Proceed**.

## Put it online (Vercel, free)

1. Push this folder to a GitHub repository (private is fine).
2. On <https://vercel.com>, choose **Add New → Project** and import the repository. Vercel detects Next.js by itself.
3. Before deploying, open **Environment Variables** and add the same values as in `.env.local`. To change them later, go to **Settings → Environment Variables**, then redeploy.
4. Under **Settings → Functions**, set the region to the one closest to your Supabase project (e.g. Singapore), so each scan is quick.
5. Deploy. Then open the site, sign in as admin, and use **Share scanner** on the Check-in desk to get volunteers in.
6. Vercel builds again by itself every time you push to GitHub.

## Handing out tickets

For a family or group, click **Give tickets**, type one name, then type the ticket numbers you handed over, separated by a space or comma (`10-14` adds a run). It won't overwrite tickets already given to someone else. To take tickets back, click **Remove** on their rows. Tickets with the same name count as one group, and the scanner shows how many of the group are already in (for example "2 of 5 in this group are here").

For single tickets, open **Tickets**, find the ticket number you are handing over, and type the person's name (plus any details). A ticket with a name counts as **given**; clear the name to make it not given again. Press **Enter** to jump to the next ticket's name. Changes save on their own. Names are optional: a ticket with no name still works at the door.

## Day before the event

- Open the app (this also wakes Supabase if it paused). Make sure the event is **open** on the Events page.
- On the Check-in desk, click **Share scanner**. Volunteers point their phone camera at the QR code, then sign in with their own name and the scanner passcode (tap **Show** to read it out). They only get the scanner, never the admin pages.
- Scan one test ticket, then undo it on the Check-in desk.
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

## For developers

Next.js 16 (App Router), React 19, Tailwind 4. When `supabase/schema.sql` changes, run it again in the Supabase SQL Editor **before** deploying the new app (it is safe to re-run). Data access is in `src/lib/store-supabase.ts` (PostgREST with the service_role key; atomic `check_in` and one-call `dashboard` functions in `supabase/schema.sql`), used through `src/lib/store.ts`. Door scans go through `src/app/api/scan/route.ts`. Check-in rules are in `src/lib/checkin.ts`, QR parsing in `src/lib/qr.ts`, sessions in `src/lib/session.ts`, CSV in `src/lib/csv.ts`, all unit-tested (`npm test`). Design and plan: `docs/plans/`.
