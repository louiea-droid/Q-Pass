# TAC Check-in

Staff scan the QR code on each paper ticket with their phone, and the check-in is saved to a Google Sheet. Admins watch arrivals live, fix names, check people in by hand, and print QR codes for new events.

Everything runs on free plans. You don't need a Google Cloud account or a card.

## What lives where

- **The Google Sheet** holds all the data. You can open it any time to read or edit names.
  - `Events`: one row per event.
  - One tab per event, named exactly like the event, with one row per ticket number.
  - `Log`: every scan, including rejected ones, with the name staff typed when they signed in.
- **A small script inside the Sheet** (`apps-script/Code.gs`) lets the app read and write it.
- **This app** is the sign-in page, the scanner and the admin pages.

Don't delete rows from an event tab. Sorting or filtering is fine; deleting a row makes that ticket "not found".

## Signing in

There are two passcodes, set by you:

- the **scanner passcode** opens the scanner only;
- the **admin passcode** opens everything (dashboard, people, events, QR printing, and the scanner).

Staff also type their name, and that name is recorded with every check-in they make. Sign-ins last 12 hours. If a passcode leaks, change that passcode **and** `AUTH_SECRET` in the settings, then redeploy. That signs everyone out, and only people with the new passcode can get back in.

## One-time setup (about 10 minutes)

### 1. Make the Sheet and add the script

1. Create an empty Google Sheet with your Gmail.
2. In the Sheet, open **Extensions → Apps Script**. Delete what's there and paste in everything from `apps-script/Code.gs`. Click **Save**.
3. Click the gear (**Project Settings**). Under **Script properties**, add a property named `SECRET`. For its value, copy `APPS_SCRIPT_SECRET` from your `.env.local` (it was generated for you).
4. Click **Deploy → New deployment**. Pick type **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy**.
5. Google asks you to authorize. Choose your account. If it says "Google hasn't verified this app", click **Advanced → Go to (your project)**: it's your own script.
6. Copy the **Web app URL** (it ends in `/exec`). That's `APPS_SCRIPT_URL`.

"Anyone" only means the app can reach the script without a Google login. The script refuses every request that doesn't carry your secret.

### 2. Fill in the settings

Open `.env.local` (copy `.env.example` if it doesn't exist) and fill in:

- `APPS_SCRIPT_URL`: the web app URL from step 1.6.
- `SCANNER_PASSCODE` and `ADMIN_PASSCODE`: choose two different passcodes that are hard to guess, like `harvest-lamp-17`.
- `AUTH_SECRET` and `APPS_SCRIPT_SECRET` are already filled in. If you start from `.env.example`, generate each with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Never share or commit `.env.local`. Git already ignores it.

### 3. Try it on your computer

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The first visit creates the `Events` and `Log` tabs in your Sheet. Sign in with your name and the admin passcode, then:

1. Go to **Events** and create the event. Its ticket tab appears in the Sheet.
2. Click **Print QR codes**, print a few, and test-scan them.

Phone cameras only work on `https://` sites, so test scanning on a phone after putting it online (or scan with your laptop's webcam on localhost).

### If you change the script later

Editing `Code.gs` isn't live until you redeploy: **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**. The URL stays the same.

## Put it online (Netlify, free)

1. Push this folder to a GitHub repository (private is fine).
2. On <https://app.netlify.com>, choose **Add new site → Import an existing project** and pick the repository. Netlify detects Next.js by itself.
3. Under **Site configuration → Environment variables**, add the same five values as in `.env.local`.
4. Deploy, and share the site address and the scanner passcode with your team.

## Day before the event

- Make sure the event is **open** on the Events page.
- Have every scanner sign in on their own phone, with their name and the scanner passcode, and pick the event.
- Scan one test ticket, then undo it on the People page.
- Charge the phones. Mobile data is a good backup if the venue Wi-Fi drops; the app needs internet.

## During the event

- **Green** means checked in. **Red** tells you why: already used (with the time and who scanned it), wrong event, closed event, or not a ticket.
- If a QR code won't scan, type the ticket number in the box under the camera.
- Admins can fix names and check people in by hand on **People**, and watch arrivals on **Dashboard**. The dashboard refreshes every 10 seconds.
- Two phones scanning the same ticket at the same moment is safe: the Sheet script handles one at a time, so only one shows green.

## If something goes wrong

- **"That passcode isn't right"**: check for typos; passcodes are case-sensitive.
- **"Can't reach the Google Sheet: Wrong secret"**: `APPS_SCRIPT_SECRET` in the settings must match the script's `SECRET` property exactly.
- **"Can't reach the Google Sheet"** with another message: check `APPS_SCRIPT_URL`, and that the deployment is set to **Execute as: Me** and **Anyone**.
- **Scans feel slow**: each one is a trip to Google's script, usually 1 to 2 seconds. Google allows a free script about 90 minutes of running time per day, which covers thousands of scans plus the dashboard.

## For developers

Next.js 16 (App Router), React 19, Tailwind 4. All Sheet access is in `src/lib/store.ts`, which calls the Apps Script web app in `apps-script/Code.gs`; moving to Supabase means replacing `store.ts`. Check-in rules are in `src/lib/checkin.ts`, QR parsing in `src/lib/qr.ts`, sessions in `src/lib/session.ts`, all unit-tested (`npm test`). Design and plan: `docs/plans/`.
