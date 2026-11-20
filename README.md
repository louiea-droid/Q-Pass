# TAC Check-in

Staff scan the QR code on each paper ticket with their phone, and the check-in is saved to a Google Sheet. Admins watch arrivals live, fix names, check people in by hand, and print QR codes for new events.

Everything here runs on free plans. You never need to enter a card.

## What lives where

- **The Google Sheet** holds all the data. You can open it any time to read or edit names.
  - `Staff`: who may sign in (email, name, role `admin` or `scanner`, Active `TRUE`/`FALSE`).
  - `Events`: one row per event.
  - One tab per event, named exactly like the event, with one row per ticket number.
  - `Log`: every scan, including rejected ones.
- **This app** is the scanner page and the admin pages. It reads and writes the Sheet for you.

Don't delete rows from an event tab. Sorting or filtering is fine; deleting a row makes that ticket "not found".

## One-time setup (about 15 minutes)

### 1. Make the Sheet

Create an empty Google Sheet. Copy the long ID from its address:
`docs.google.com/spreadsheets/d/THIS_PART/edit`. That's your `SHEET_ID`.

### 2. Make a Google Cloud project (free, no card)

Go straight to <https://console.cloud.google.com/projectcreate>. If Google offers a "free trial" or asks for a card, close that page: you don't need the trial. Accept the terms, name the project "TAC Check-in", and create it.

Then open **APIs & Services → Library**, search for **Google Sheets API**, and click **Enable**.

### 3. Give the app a robot account for the Sheet

1. **IAM & Admin → Service Accounts → Create service account.** Name it `tac-sheets`, skip the roles step, click **Done**.
2. Open it, go to **Keys → Add key → Create new key → JSON**. A file downloads. Keep it private.
3. In that file, `client_email` is your `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `private_key` is your `GOOGLE_PRIVATE_KEY`.
4. Share your Google Sheet with the `client_email` address as **Editor**, the same way you'd share it with a person.

### 4. Set up "Sign in with Google"

1. **APIs & Services → OAuth consent screen.** Choose **External**, fill in an app name and your email.
2. Under **Audience → Test users**, add the Gmail address of every staff member. (Only listed test users can sign in until you publish the app. For a church team, keeping it in testing is fine.)
3. **Credentials → Create credentials → OAuth client ID → Web application.** Under **Authorized redirect URIs** add:
   - `http://localhost:3000/api/auth/callback/google`
   - later, your live address: `https://YOUR-SITE.netlify.app/api/auth/callback/google`
4. Copy the Client ID (`AUTH_GOOGLE_ID`) and Client secret (`AUTH_GOOGLE_SECRET`).

### 5. Fill in the settings

Copy `.env.example` to `.env.local` and paste in each value. Then run `npx auth secret`, which adds `AUTH_SECRET` for you. Put your own email in `ADMIN_EMAILS` so you can sign in as admin before the Staff tab has anything in it.

Never commit `.env.local` or the JSON key. Git already ignores `.env.local`.

### 6. Try it on your computer

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The first visit creates the `Staff`, `Events` and `Log` tabs in your Sheet. Sign in, then:

1. Add your staff to the `Staff` tab (email, name, `admin` or `scanner`, `TRUE`).
2. In the app, go to **Events** and create the event. Its ticket tab appears in the Sheet.
3. Click **Print QR codes**, print a few, and test-scan them.

Phone cameras only work on `https://` sites, so test scanning on a phone after the next step (or scan with your laptop's webcam on localhost).

## Put it online (Netlify, free)

1. Push this folder to a GitHub repository (private is fine).
2. On <https://app.netlify.com>, choose **Add new site → Import an existing project** and pick the repository. Netlify detects Next.js by itself.
3. Under **Site configuration → Environment variables**, add the same values as in `.env.local`. For `GOOGLE_PRIVATE_KEY`, paste the whole key including `-----BEGIN PRIVATE KEY-----`.
4. Deploy. Add the live redirect address from step 4.3 to your Google OAuth client.

## Day before the event

- Open the site once. (Nothing pauses on these free plans, but it's a good check.)
- Make sure the event is **open** on the Events page.
- Have every scanner sign in on their own phone and pick the event.
- Scan one test ticket, then undo it on the People page.
- Charge the phones. Mobile data is a good backup if the venue Wi-Fi drops; the app needs internet.

## During the event

- **Green** means checked in. **Red** tells you why: already used (with the time and who scanned it), wrong event, closed event, or not a ticket.
- If a QR code won't scan, type the ticket number in the box under the camera.
- Admins can fix names and check people in by hand on **People**, and watch arrivals on **Dashboard**. The dashboard refreshes every 10 seconds.

## If something goes wrong

- **"You're not on the staff list"**: add the email to the `Staff` tab with Active `TRUE`. It takes up to a minute to apply.
- **Google says "access blocked" at sign-in**: add that Gmail as a test user (setup step 4.2).
- **"Can't reach the Google Sheet"**: check `SHEET_ID`, and that the Sheet is shared with the service account as Editor.
- **"Busy, try again"**: Google limits how many requests the app can make per minute. Wait a few seconds. If it happens a lot at the door, the app may need to move to a database like Supabase.

## For developers

Next.js 16 (App Router), React 19, Tailwind 4, Auth.js v5. All Google Sheets access is in `src/lib/store.ts`, so moving to Supabase means replacing that one file. Check-in rules are in `src/lib/checkin.ts` and QR parsing in `src/lib/qr.ts`, both unit-tested (`npm test`). Design and plan: `docs/plans/`.
