# KinCare

IT for Managers capstone, GLIM Chennai, Section 4, Group 5 (TCS). Owner: Avik Majumdar.

KinCare is a mobile-first web app for families who arrange home care for an elderly parent living in another city. It books verified caregivers, records proof of every visit, and alerts the family when a caregiver fails to turn up.

The specification is `docs/BRD.pdf` (submitted Milestone 2). The look and every screen come from `docs/prototype.html`. The data model is `docs/data-schema.pdf`. When the BRD and anything else disagree, the BRD wins.

## Stack (fixed)
- React 18 + Vite + TypeScript, plain CSS (tokens copied from the prototype). No UI kit.
- Supabase for the database, login (email and password) and check-in photo storage.
- Deployed on Vercel from the `main` branch at https://kincare-glim.vercel.app. Installable as a PWA.
- Free tiers only. Do not add paid services or anything that needs a card.

## Users and access
| Role | What they do | Access |
|---|---|---|
| family | Adds parents with consent, books care, sees the timeline, gets alerts, rates and renews, closes the account | Own parents only |
| elder | Sees who is coming today, presses SOS | Own parent record only |
| caregiver | Sees shifts, checks in with location and photo, logs tasks and readings, checks out | Own shifts; a parent's address and readings only during a current shift |
| coordinator | Verifies caregivers, works the alert queue, assigns replacements | All records |
| admin | Care Operations head: KPIs, escalations, demo settings | All records |

## Business rules (enforce in the database, not only the UI)
- **BR1** A booking is at least 14 days of 12- or 24-hour shifts at one address.
- **BR2** A caregiver is visible to families only when ID, police check and training are all complete.
- **BR3** No check-in within `settings.no_show_minutes` (30 by default) of shift start: the shift becomes `missed`, an alert goes to family and coordinator, and a replacement must be assigned within 4 hours.
- **BR4** Health readings are visible only to the family, staff, and the caregiver on that shift. A caregiver sees an address only for a current shift.
- **BR5** If a replacement shift is also missed, the alert is escalated to the admin.
- Consent is required before a parent profile is saved. Closing an account deletes the parent's profile, readings and photos.

## Where things live
- `supabase/migrations/` schema, row-level security, functions, cron, demo data (`reset_demo_data()` in 0005). New changes go in a new numbered migration. `supabase/setup.sql` is all of them in one file for the Supabase SQL editor (regenerate with `npm run sql:bundle`).
- `src/` the app. `src/screens/<role>/` one file per screen. `src/lib/` Supabase client and data helpers. `src/styles.css` design tokens and components.

## Working rules
- Only invented sample data. Never real names, phone numbers or addresses.
- Writes that enforce a rule go through Postgres functions (`book_care`, `check_in`, `assign_replacement`, ...), never direct table inserts from the client.
- Never put the service role key, database password or any secret in the code or in prompts. The browser uses only the publishable key from `VITE_SUPABASE_*` env vars.
- Commit after every working feature, with the requirement in the message, e.g. `FR3: caregiver check-in`.
- Log every prompt and what changed in the team's prompt history document.
- Copy is plain, active and in sentence case. Times are shown in India time (Asia/Kolkata).
