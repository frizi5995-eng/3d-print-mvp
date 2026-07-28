# Fabrik — 3D Manufacturing MVP

Customers upload a 3D model, configure a manufacturing request, and submit it.
An admin reviews the request, sets pricing, and prepares a quote. The
customer opens a secure link, sees the quote, and accepts or declines.
Payment and production are handled manually for this MVP — there is no
Stripe integration, no customer accounts, and no automated manufacturer
routing yet, by design (see [Postponed features](#postponed-features)).

Production: https://3d-print-mvp.vercel.app

## Core product flow

```
Customer                          Admin
--------                          -----
uploads 3D model
configures request
submits request         -->       reviews request
                                   sets production + customer pricing
                                   clicks "Prepare quote"
                                   (quote_token + quote_expires_at created,
                                    quote email sent if Resend is configured,
                                    otherwise "Copy quote link" is used manually)
customer opens /q/[token]
accepts or declines      -->      sees updated status + history
                                   (manual payment/manufacturing from here)
```

## Architecture

- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**
- **Tailwind CSS v4** + a small set of Base-UI-backed shadcn components
- **Supabase**: Postgres (data), Storage (private model files), Auth
  (admin login only — customers never authenticate)
- **Vercel**: hosting, connected to `main` for auto-deploy
- **Resend**: optional, for the one transactional email this app sends
  (quote-ready notification) — see [Email](#email)

All application data access goes through a single **service-role Supabase
client** (`src/lib/supabase/server.ts` → `createServiceClient()`), used from
Server Components and Server Actions only. Row Level Security is **enabled
with zero policies** on every table — the anon key (the only Supabase key
ever sent to the browser) genuinely cannot read or write any application
data, even if it leaks. This has been verified against the live production
database, not just asserted from the migration file.

A second, separate Supabase client (`createClient()` in the same file) uses
the anon key + the visitor's auth cookies, and exists **only** to answer "is
this admin request signed in as an allowlisted admin?" — it is never used to
read or write app data.

### Route groups

- `src/app/(site)/...` — customer-facing pages, wrapped in the marketing
  `Header`/`Footer` layout
- `src/app/admin/login/...` — public admin login (outside the auth guard)
- `src/app/admin/(protected)/...` — everything else under `/admin`, gated by
  a layout that calls `requireAdminUser()` before rendering anything
- `src/app/q/[token]/...` — the public customer quote page, no route group,
  no auth, resolved entirely by `quote_token`

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Home, model upload dropzone |
| `/quote?model=<id>` | Public | Configure a manufacturing request for an uploaded model |
| `/quote/success?ref=<n>` | Public | Confirmation after submitting a request |
| `/q/[token]` | Public, token-gated | View and accept/decline a prepared quote |
| `/admin/login` | Public | Admin sign-in (Supabase Auth email/password) |
| `/admin` | Admin only | Redirects to `/admin/requests` |
| `/admin/requests` | Admin only | Request list, search, status filter, operations overview |
| `/admin/requests/[id]` | Admin only | Customer info, model preview/download, pricing, status actions, quote link, history |

## Database

Two migrations in `supabase/migrations/`, applied in order:

- **`0001_init.sql`** — `models`, `manufacturing_requests`,
  `status_history`, the `request_status` enum, the private `models`
  storage bucket, and two triggers:
  - `set_updated_at` — keeps `manufacturing_requests.updated_at` current
  - `record_status_history` — inserts a `status_history` row automatically
    on every insert/status change. **No application code ever writes to
    `status_history` directly** — this is enforced at the database level so
    it can't be forgotten by a future code change.
- **`0002_admin.sql`** — adds `quote_expires_at` to `manufacturing_requests`.

Money columns are `numeric(12,2)` with `check (value >= 0)`. Model
dimensions and file size have `check (... > 0)` (dimensions stay nullable —
automatic extraction was never implemented, by design).

### Status lifecycle

```
new → checking → waiting_for_partner → quote_ready → quote_sent
                                              ↓            ↓
                                          accepted     accepted
                                              ↓            ↓
                                          declined     declined
                                              ↓
                                       manufacturing → shipped → completed
```

`manufacturing`/`shipped`/`completed` exist in the enum and are handled by
the UI (badges, filters), but there is currently no admin action that
transitions a request into or between them — that's manual (see
[Known limitations](#known-limitations)). Every transition that *is*
wired up goes through an atomically guarded `UPDATE` (`WHERE status IN
(...)`), not a read-then-write — this is what makes double-submits, race
conditions (two browser tabs), and stale/expired links safe by construction
rather than by convention.

### Quote lifecycle

1. Admin sets `customer_manufacturing_price` and `customer_shipping_price`
   on a `new`/`checking`/`waiting_for_partner` request.
2. Admin clicks **Prepare quote**. If no `quote_token` exists yet, a
   256-bit random token (`crypto.randomBytes(32)`) and a 7-day
   `quote_expires_at` are generated. Status becomes `quote_ready`. If a
   token already exists (e.g. re-preparing after an edit), it's **kept**,
   not rotated.
3. Customer opens `/q/[token]`. The page is resolved by `quote_token` alone
   — never by the internal request `id` — and validates status + expiry
   server-side before showing anything.
4. Customer clicks **Accept** or **Decline**. Both are a single
   `UPDATE ... WHERE quote_token = $1 AND status IN ('quote_ready',
   'quote_sent') AND quote_expires_at > now()`. Whichever request "wins"
   is the only one that changes any rows.
5. `/q/[token]` shows the correct terminal state (`accepted`/`declined`)
   on every subsequent visit, including after a page refresh.

## Storage

One private bucket, `models`. Never made public. All access is via
short-lived signed URLs generated server-side:

| Context | Expiry | Notes |
|---|---|---|
| Customer `/quote` config page preview | 1 hour | |
| Admin request detail preview | 1 hour | |
| Admin "Download original model" | 5 minutes | forces `Content-Disposition: attachment` |
| Public `/q/[token]` preview | 10 minutes | shorter — unauthenticated route. **No download link is ever generated here.** |

Uploads go **directly from the browser to Supabase Storage** via a signed
upload URL/token (`createSignedUploadUrl` → `uploadToSignedUrl`) — never
proxied through a Next.js server function. This is deliberate: it avoids
Vercel's serverless function body-size limits entirely for large model
files.

## Email

`src/lib/email/` builds and sends exactly one email: the quote-ready
notification (customer name, request reference, total price, expiry date,
quote URL — never production cost, margin, or manufacturer name).

If `RESEND_API_KEY` is not set, `getResendClient()` returns `null` before
ever importing the `resend` package — this is intentional, not a stub:
`resend` requires Node ≥22.12, so it's never loaded at all until a key
exists. "Prepare quote" always succeeds regardless of email outcome; the
admin toast and "Copy quote link" fallback cover the gap either way.

To enable: set `RESEND_API_KEY` in Vercel, optionally `EMAIL_FROM_ADDRESS`
once you've verified a sending domain in Resend (defaults to Resend's
`onboarding@resend.dev` sandbox sender, which works without domain
verification for early testing).

## Environment variables

See `.env.example` for the authoritative list with inline comments. Summary:

| Variable | Public/Secret | Required | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Supabase anon key (safe — RLS blocks it from app data) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Yes | Server-only, bypasses RLS — never expose to the client |
| `ADMIN_EMAILS` | Secret-ish | Yes | Comma-separated allowlist for `/admin` access |
| `NEXT_PUBLIC_APP_URL` | Public | Yes | This app's own origin, for building absolute URLs (quote links) |
| `RESEND_API_KEY` | **Secret** | No | Enables automatic quote emails when set |
| `EMAIL_FROM_ADDRESS` | Public | No | Sender for quote emails; defaults to Resend's sandbox sender |

Never commit real values — `.env.local` is git-ignored (`.env*` with
`.env.example` excepted) and must stay that way.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in real values — never commit this file
npm run dev
```

`.env.local` needs real Supabase credentials to do anything useful (the
homepage renders without them, but upload/admin/quote all call Supabase).
Get them from your Supabase project → Project Settings → API.

Optional: seed a few fake requests covering every status, for exercising
the admin UI without waiting for real submissions:
```bash
npm run db:seed
```
This refuses to run if `NODE_ENV=production`, and inserts models pointing
at storage paths that don't exist — preview/download will correctly show
"unavailable" for seeded rows, which is expected.

### Database migrations

Apply `supabase/migrations/*.sql` in order via the Supabase Dashboard SQL
Editor, or the Supabase CLI (`supabase link` then `supabase db push`) once
you've run `supabase login` yourself — that step needs your own browser/
credentials and can't be automated.

## Production deployment (Vercel)

Connected to `main` — every push to `main` triggers a production deploy.
Environment variables above must be set in Vercel's Project Settings →
Environment Variables (Production, and Preview if you want preview
deployments to work against real data). `NEXT_PUBLIC_*` variables are
inlined at **build time**, so changing one requires a redeploy, not just a
dashboard save.

No `vercel.json` — this is a zero-config Next.js deployment, no custom
build command, no image domains configured (the app never uses
`next/image`), no middleware.

## Admin authentication

Supabase Auth (email/password), gated by a server-only `ADMIN_EMAILS`
allowlist checked on **every** request — not just at login. `getAdminUser()`
calls `auth.getUser()` (which revalidates the JWT against Supabase, not just
decodes the cookie) and checks the result's email against the allowlist
fresh each time. `requireAdminUser()` is called independently in the
protected layout **and** in every admin mutation (defense in depth — a page
guard alone wouldn't stop a mutation invoked directly).

There is no middleware refreshing the Supabase session on every request
(see [Known limitations](#known-limitations)) — an expired access token
mid-session degrades to being asked to sign in again, not a security issue.

Admin accounts are created manually: Supabase Dashboard → Authentication →
Users → Add user, with "Auto Confirm User" on (there's no email
verification flow in this app).

## Known limitations

- No middleware refreshing the Supabase Auth session — see above.
- No admin action exists yet to move a request into `manufacturing`,
  `shipped`, or `completed` — those statuses exist in the schema and the
  UI (badges, sidebar filters), but the transition is manual (update the
  row directly, or build the action when it's actually needed).
- File type validation is extension-based, not magic-byte sniffing. Files
  live in a private bucket and are never served as executable content, so
  this was accepted as a reasonable MVP tradeoff rather than a gap.
- No idempotency key on request submission — a genuine double-submit
  (not a normal double-click, which the disabled-button state already
  prevents) could create two rows for the same model. Low frequency, low
  severity at MVP scale; not worth a schema change yet.
- A failed upload confirm step (upload succeeds, then the `models` insert
  fails) can leave an orphaned file in storage with no DB row. No cleanup
  job exists for this yet.
- No automated test suite. Verification throughout has been
  typecheck + lint + build plus targeted live checks against the real
  production database (see commit history for specifics).

## Postponed features

Deliberately not built, pending real demand validation: customer
registration/accounts, Stripe/payments, automatic manufacturer
routing/marketplace, a public model gallery, AI model generation,
subscriptions, and complex analytics/dashboards. The admin "operations
overview" (`/admin/requests`) is intentionally a handful of real counts,
not a dashboard product.

## Knowledge graph

`graphify-out/` (git-ignored, local only) holds a generated knowledge graph
of this codebase — `graphify query "<question>"` can answer architecture
questions faster than grep for anyone with the `graphify` CLI installed.
Regenerate with `/graphify . --update` after structural changes; see
`.claude/skills/graphify/SKILL.md` for details. Not required to build, run,
or deploy the app.
