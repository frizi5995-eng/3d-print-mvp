# Milestones 11–24 Final Report

Scope: customer accounts, anti-spam, admin dashboard, complete status workflow,
request management, request detail operations, customer management, audit
log, admin settings, professional 3D viewer, navigation, CSV export, and a
final security/UX pass. Builds on the Milestone 1–10 MVP (upload → quote →
accept/decline → basic admin) documented in `NIGHTLY_REPORT.md`.

All 14 milestones are implemented, verified against the live production
Supabase project, and pushed to `main` (commits `8cbc84c`..`5a303b6`).

---

## 1. Features implemented

- Optional customer accounts on the existing Supabase Auth (shared with
  admin auth, no separate role system)
- Automatic claiming of prior guest requests on login/register by email
- Rate limiting + Cloudflare Turnstile anti-spam on the public quote form
  (both safely no-op until configured)
- Real admin dashboard with date-range KPIs, charts, and operational widgets
- Complete request status workflow (new → checking → waiting_for_partner →
  quote_ready → quote_sent → accepted/declined → manufacturing → shipped →
  completed), with atomic guarded transitions and backward correction
- Full-featured request queue: search, multi-filter, sort, pagination, quick
  actions, "needs attention" indicators
- Request detail control center: resend quote email, extend quote expiry,
  internal notes, operational tags, suspicious-flag review
- Customer management (`/admin/customers`), grouping registered customers by
  account and guests by normalized email
- Admin activity/audit log (`/admin/activity`) with filters
- Admin settings (`/admin/settings`) backed by `app_settings`, with real
  (not decorative) effects on behavior
- Professional ModelViewer upgrade: PBR neutral-gray material, 3-point
  studio lighting, auto-framing camera, contact shadows
- Mobile navigation menu (previously the public header had none on small
  screens) and admin sidebar counters + suspicious-queue shortcut
- CSV export of the filtered requests queue, safe-fields-only

## 2. Routes added

| Route | Purpose |
|---|---|
| `/login`, `/register` | Customer auth |
| `/account`, `/account/requests`, `/account/requests/[id]` | Customer self-service |
| `/admin/dashboard` | KPI dashboard (now the default `/admin` redirect) |
| `/admin/customers`, `/admin/customers/u/[userId]`, `/admin/customers/e/[email]` | Customer management |
| `/admin/activity` | Audit log |
| `/admin/settings` | Business settings + integration status |
| `/admin/requests/export` (route handler, GET) | CSV export |

## 3. Migrations

- `0001_init.sql` — original schema (pre-existing)
- `0002_admin.sql` — admin auth scaffolding (pre-existing)
- `0003_accounts_and_ops.sql` (this phase) — additive, `IF NOT EXISTS`
  throughout:
  - `manufacturing_requests`: `customer_user_id`, `submission_ip_hash`,
    `is_suspicious`, `spam_reason`, `internal_notes`, `tags`
  - New tables: `admin_activity_log`, `app_settings` (both RLS-enabled,
    zero policies — service-role access only, matching every other table)

No destructive migrations were run. No column was dropped, renamed, or had
its type changed.

## 4. Dashboard functionality

`getDashboardData(range)` in `src/lib/admin/dashboard.ts` — date-range KPIs
(new requests, quotes prepared, acceptance rate, average margin), a
dependency-free CSS bar chart of requests/day, status distribution, and a
"quotes expiring soon" widget. Never shows a fake 0%/empty chart — renders
"—" when there's no data yet, per the no-fake-data rule set at the start of
this phase.

## 5. Request-management improvements

`/admin/requests` gained: text search (name/email/phone/reference
number/filename), status/account-type/suspicious/material/country/date-range/
has-price/quote-expiry filters, 6 sort modes (including value and margin,
computed client-of-DB-side since PostgREST can't sort on a derived field),
pagination, and per-row quick actions. Sidebar status shortcuts now show live
counts and a "Suspicious" quick-access link.

## 6. Customer account flow

Same Supabase Auth used for admin, gated only by presence of a session (no
allowlist). On login/register, `claimRequestsForUser()` attaches any prior
guest requests matching the account's email — an operational convenience,
not a security boundary (a guest could type someone else's email; claiming
only ever *attaches* requests to *that same* email's future account, it
doesn't expose anything not already visible via the quote-token link).
Customers see their own requests only (`customer_user_id = auth.uid()` or,
for legacy guest rows, an already-claimed match) via `getMyRequestById()`
returning `null` identically for "doesn't exist" and "not yours."

## 7. Anti-spam implementation

- `checkSubmissionRateLimit()` — hashed-IP-based, blocks the 9th+ submission
  from the same IP within the window
- Cloudflare Turnstile — verified server-side, **fails open** when
  unconfigured (never blocks submissions before a site key exists) and
  **fails closed on a bad/missing token but open on a Cloudflare network
  error** once configured (an outage never blocks legitimate customers)
- `submission_ip_hash` stored (hashed, not raw IP) for later pattern review

## 8. Admin settings

`app_settings` key/value table, exposed at `/admin/settings`. Every setting
has a real effect, not just a stored value:

| Setting | Effect |
|---|---|
| Quote validity (days) | Replaces the previously-hardcoded 7-day constant in `prepareQuote()`/`extendQuoteExpiry()` |
| Minimum margin warning % | Pricing panel shows a warning when live-computed margin falls below it |
| Default material | Pre-selects the public quote form's material field |
| Support email | Included in the quote-ready email footer |
| Company display name | Included in the quote-ready email signature |
| Timezone | Shown **read-only** as `Europe/Riga` — intentionally not editable, see §12 |

Integrations (Supabase/Resend/Turnstile) show **Configured/Not configured**
only, derived from environment-variable presence — no key value is ever
read into settings.ts's config, stored in the database, or rendered.

## 9. Customer management

`/admin/customers` groups requests by `customer_user_id` (registered) or
lowercased `customer_email` (guest), with total/accepted/completed/open
counts and accepted value. Detail pages
(`/admin/customers/u/[userId]`, `/admin/customers/e/[email]`) show account
info (registered only — `createdAt`/`lastSignInAt`/`emailConfirmed`, nothing
else from the Supabase Auth user object) and full request history. Guest
grouping by email is explicitly labeled in the UI as operational
convenience, not verified identity.

## 10. Audit logging

`logAdminActivity()` (written in an earlier milestone, this phase added the
read side) fires on every mutating admin action: status changes, pricing
changes, quote prepared/resent/expiry-extended, notes/tags updated,
suspicious flag toggled, settings updated, CSV exports. `/admin/activity`
filters by admin, action, request, and date range. A failed audit write
never blocks the action it's logging (best-effort, swallowed + logged
server-side).

## 11. ModelViewer changes

Upgraded the existing shared viewer in place (used by both the public quote
page and admin request detail — no second viewer was built):

- Physically-based neutral gray `MeshPhysicalMaterial` (subtle clearcoat)
  applied uniformly across STL/OBJ/3MF, overriding any material embedded in
  the uploaded file
- Hand-authored 3-point studio lighting (key/fill/rim + hemisphere fill),
  scaled to the model's measured bounding radius — no HDRI/environment map,
  to keep the viewer free of external CDN dependencies
- Auto-framing camera via a small helper replacing drei's `<Stage
  adjustCamera>`
- Contact shadows (drei's `<ContactShadows>`) layered above the existing
  technical grid floor
- OrbitControls min/max zoom distance now scales with model size

**I could not visually verify the rendered result** — this session has no
browser/screenshot tool. The change compiles, type-checks, and the pages
that embed it serve without a server error, but the actual lighting/
material/shadow quality needs a human look. Flagged again in §16 and the
test plan.

## 12. Security decisions

- Every new admin route/action calls `requireAdminUser()` as its first
  statement — re-verified by grep across every file touched this phase, no
  gaps found
- `admin_activity_log` and `app_settings` are RLS-enabled with zero
  policies, same as every other table — service-role access only
- CSV export explicitly excludes quote tokens, signed URLs, internal notes/
  tags, and customer phone/postal code — verified with a script that
  planted those values in a test row and confirmed none appeared in the
  generated CSV
- Settings never store or display secrets; integration status is
  presence-only
- Timezone was deliberately made read-only rather than a plausible-looking
  editable field, because the codebase hardcodes `Europe/Riga` everywhere
  after the earlier timezone-bug fix — an editable field that didn't
  actually change formatting would be actively misleading

## 13. Performance / index changes

`admin_activity_log_created_at_idx` and `admin_activity_log_request_id_idx`
were added in migration `0003` to support the activity log's date-sorted,
optionally request-filtered queries. No other index changes. Dashboard,
customer list, and CSV export all read at MVP data volumes (full-table
scans over what is currently a small `manufacturing_requests` table) — flagged
as a forward-looking concern in §17, not a current problem.

## 14. Tests run

No automated test suite exists in this repo (confirmed at the start of this
phase and unchanged — the roadmap didn't ask for one to be added). Every
milestone was instead verified with a throwaway Node script run against the
**live production Supabase project** (`pflgsnotzfcfyybzthsi`), using the
service-role key, that: seeded real test rows, asserted on the exact
behavior being verified, and deleted every row/user it created — plus
`npx tsc --noEmit`, `npm run lint`, and `npm run build` before every commit.
Specifics:

- M17: 15 checks — guest/registered grouping math, case-insensitive guest
  email merging, `getCustomerAccountInfo()` leaks no extra fields
- M18: 6 checks — activity log filtering by admin/action/request, reference
  join
- M19: 6 checks — settings upsert round-trip, re-upsert doesn't duplicate,
  table restored to its exact prior state afterward
- M21/22: 4 checks — sidebar status/suspicious counts
- M23: 8 checks — internal cost/profit/margin math, CSV quote-escaping,
  confirmed no leakage of internal notes or quote tokens into the export

## 15. Commits pushed

```
8cbc84c  Migration: customer accounts + admin ops columns/tables
8e8a8b4  Milestone 11: optional customer accounts on the existing Supabase Auth
3974f7d  Milestone 12: anti-spam foundation (rate limiting + Turnstile prep)
975d5c8  Milestone 13: real admin dashboard at /admin/dashboard
d06962f  Milestone 15: complete the operational status workflow
3c7fd5c  Milestone 14: /admin/requests becomes a real operational queue
80d86aa  Milestone 16: request detail control-center upgrade
fd47904  Milestone 17: customer management (/admin/customers)
914316d  Milestone 18: admin activity/audit log (/admin/activity)
e2f80f8  Milestone 19: admin settings (/admin/settings) backed by app_settings
fee8479  Milestone 20: professional ModelViewer upgrade
625d177  Milestone 21/22: navigation polish
db2aba8  Milestone 23: CSV export of the filtered requests queue
5a303b6  Add truncation headers to CSV export response
```

## 16. Manual configuration still required

None of the following block deployment — the app degrades gracefully
without them (already true before this phase, unchanged):

- `RESEND_API_KEY` + a verified sending domain — until set, quotes are
  prepared with a copyable link instead of an emailed one
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` — until set, the quote form
  has no bot check beyond the IP rate limit
- **Recommended before relying on it**: open `/admin/settings` once and
  confirm the default support email/company name/quote validity are what
  you actually want — they currently default to placeholder values
  (`hello@fabrik.example`, "Fabrik", 7 days)
- **Recommended**: a human visual pass on the ModelViewer changes (§11) —
  I have no way to confirm the lighting/material/shadows actually look
  right in a real browser

## 17. Known limitations

- No automated test suite (pre-existing, unchanged this phase)
- Dashboard/customer-list/export queries scan the full `manufacturing_requests`
  table rather than using targeted indexes — fine at current volume, worth
  revisiting if the table grows into the tens of thousands of rows
- Guest-to-guest and guest-to-registered grouping by email is explicitly
  *not* identity verification — documented in the UI, but worth knowing if
  you ever build anything that treats it as such
- Admin sidebar is desktop-oriented (fixed-width, no mobile collapse) — a
  deliberate scope call for a backoffice tool, not an oversight; the public
  customer-facing header got the mobile nav instead
- ModelViewer visual quality is unverified (see §11, §16)

## 18. Recommended next business/product step

The explicit "DO NOT BUILD YET" list from the roadmap (Stripe/payments, AI
generation, manufacturer marketplace, public gallery, subscriptions, complex
RBAC, mobile app) still stands — nothing in this phase touched any of it.

With accounts, anti-spam, and full operational tooling now in place, the
highest-leverage next step is likely **getting Resend + a verified sending
domain configured** so quote-ready emails actually reach customers instead
of relying on the admin manually copying a link — it's the one piece of the
already-built pipeline that's currently running in its degraded mode by
default. Everything else on the roadmap is genuinely optional polish at this
point.

Per your instruction, I'm not proposing a new roadmap beyond this.

---

# Manual Browser Test Plan

I have no browser/screenshot tooling in this session, so none of the
following has been executed — this is what to click through manually before
trusting the build.

## GUEST (no account, no admin)

1. Visit `/`, upload a model, confirm the viewer renders (check the new
   lighting/material/shadows look intentional, not broken)
2. Configure a quote as a guest, submit, confirm success page
3. Visit `/login` and `/register` — confirm both are reachable and don't
   error
4. On mobile width (or a narrow browser window), confirm the header shows a
   hamburger menu and every link in it works (How it works/Materials/FAQ/
   Sign in)
5. Submit 9+ quote requests rapidly from the same connection — confirm the
   9th+ is rejected by the rate limiter, and that this doesn't affect a
   request from a different browser/network

## ACCOUNT (registered customer)

1. Register, confirm a prior guest submission (same email) now appears
   under `/account/requests`
2. Submit a new quote while logged in, confirm it's attached to the account
   immediately (no claiming needed)
3. Open `/account/requests/[id]` for your own request — works
4. Try `/account/requests/[id]` for a request that isn't yours (guess or
   reuse another test account's ID) — confirm it 404s, not a data leak
5. Sign out via `/account`, confirm session actually ends (revisit
   `/account/requests`, should redirect to login)

## SECURITY

1. As a signed-out user, try to hit any `/admin/*` route directly — should
   redirect to `/admin/login`
2. As a signed-in non-admin customer, try the same — should still redirect
   (allowlist check, not just "signed in")
3. Try `/admin/requests/export?status=all` while signed out — should not
   return a CSV
4. Confirm the CSV export doesn't contain a quote token or signed URL for
   any row (open the downloaded file, search for `http`)

## ADMIN

1. Sign in at `/admin/login`, confirm landing on `/admin/dashboard`
2. Sidebar: click Dashboard, Customers, Activity, Settings — all load, all
   highlight correctly as active
3. Sidebar: confirm status shortcut counts match what's actually in
   `/admin/requests` for each status; if any request is flagged
   suspicious, confirm the "Suspicious" link appears with the right count
4. `/admin/requests`: exercise every filter (status, account type,
   suspicious, material, country, date range, has-price, quote expiry),
   search, and every sort option
5. Click "Export CSV" with a filter applied — confirm the downloaded file
   matches only the filtered rows, and open it in a spreadsheet app to
   confirm it's well-formed (test with a customer name containing a comma
   if you have one)
6. Open a request detail page: prepare a quote, confirm the expiry date
   matches whatever is set in `/admin/settings` (default 7 days), then go
   change "Quote validity" in Settings and confirm a *new* quote respects
   the new value
7. On a request, change status forward through the full workflow
   (new → checking → ... → completed), then use "Revert to X" and confirm
   it goes backward correctly
8. Set an internal note, toggle a tag, flag as suspicious with a reason —
   confirm all three persist after a page reload
9. `/admin/customers`: click into both a registered and a guest customer,
   confirm request history and totals look right
10. `/admin/activity`: filter by each admin, each action type, and a date
    range; click through to a linked request
11. `/admin/settings`: change every field, save, reload the page, confirm
    values persisted; confirm the Integrations section shows
    Configured/Not configured correctly for whatever's actually set in your
    environment (never a key value)
12. Set pricing on a request below the configured minimum-margin threshold
    — confirm the warning appears in the pricing panel

## VIEWER (3D model preview)

1. Upload an STL, an OBJ, and a 3MF (one of each) and confirm all three
   render with the same neutral-gray material — this is the part I could
   not verify myself
2. Confirm the model is lit clearly from multiple angles (rotate it) — no
   fully black/unlit side
3. Confirm there's a soft shadow under the model and a grid floor visible
4. Zoom in/out — confirm you can't zoom inside the model or fly arbitrarily
   far away
5. Fullscreen and reset-view buttons both work
6. Try a deliberately broken/empty file if you have one — confirm the
   error-boundary fallback ("Couldn't preview this model...") shows instead
   of a blank crash
