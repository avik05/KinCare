# KinCare

Verified caregivers for elderly parents, and proof of every visit, for families who live in another city.
IT for Managers capstone, GLIM Chennai, Section 4, Group 5 (TCS).

- Requirements: [`docs/BRD.pdf`](docs/BRD.pdf)
- Clickable prototype: [`docs/prototype.html`](docs/prototype.html)
- Data model: [`docs/data-schema.pdf`](docs/data-schema.pdf)

## What it does

| Who | What they can do | BRD |
|---|---|---|
| Family | Add a parent with consent; book a verified caregiver for 14 days; see check-ins, door photos, tasks and readings; get alerts; rate and renew; close the account and delete the data | FR1, FR2, FR4, FR8 |
| Caregiver | See shifts; check in with location and a photo; tick tasks; record BP and sugar; check out | FR3 |
| Elder | See who is coming today; hold SOS for 2 seconds | FR5 |
| Coordinator | Work the alert queue; assign a verified replacement; add caregivers and mark ID, police and training checks | FR6, FR7 |
| Care Operations head | The four KPIs; escalations; demo settings | FR9, BR5 |

The database enforces the business rules, not just the screens: 14-day minimum and no overlapping bookings (BR1), verified caregivers only (BR2), missed check-in alerts within 30 minutes via a job that runs every minute (BR3), who can see addresses and health readings (BR4), and escalation of a second miss (BR5).

## Demo accounts

Password for all: `KinCare@2026`

| Email | Role |
|---|---|
| meera@kincare.demo | Family (mother Kamala in Chennai) |
| arjun@kincare.demo, farah@kincare.demo | Families |
| kamala@kincare.demo | Elder |
| lakshmi@kincare.demo, selvi@kincare.demo, priya@kincare.demo | Caregivers |
| ravi@kincare.demo | Coordinator |
| nandini@kincare.demo | Care Operations head |

All people, phone numbers and addresses are invented.

### Running the live demo
1. Sign in as Nandini → **Settings** → **Reset demo data**. Kamala's shift now starts 10 minutes from now.
2. For a short demo, set **Missed check-in alert** to 2 minutes. Set it back to 30 afterwards (the BRD rule).
3. Either check in as Lakshmi (phone camera and location), or let the shift pass to show the missed-check-in alert on Meera's and Ravi's screens, then assign a replacement as Ravi.

## Stack

React + Vite + TypeScript, Supabase (Postgres, login, photo storage, pg_cron), deployed on Vercel. Free tiers only.

## Setup from scratch

1. **Supabase**: create a project, then paste `supabase/setup.sql` into SQL Editor and run it once. It creates the tables, rules, storage bucket, the every-minute check and the demo data. (`npm run sql:bundle` rebuilds it from `supabase/migrations`.)
2. **Vercel**: import this repository, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`), deploy.
3. **Local**: `npm install`, copy `.env.example` to `.env.local`, `npm run dev`.

Only the publishable key is used in the browser. Never commit the service role key or database password.

## Testing the rules

`supabase/test/` has stand-ins for Supabase's `auth` and `storage` schemas and `rules.sql`, which runs every business rule as each role on plain Postgres:

```
psql -f supabase/test/stubs.sql
psql -f supabase/migrations/*.sql   # in order, skipping 0004 (pg_cron)
psql -f supabase/test/rules.sql
```
