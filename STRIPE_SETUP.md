# Stripe Setup — Test Mode First

This covers getting the Stripe invoicing integration working end-to-end in
**test mode**, then safely switching to live mode later. Do the whole
checklist in test mode before touching live keys.

## 1. Create a Stripe account

1. Go to https://dashboard.stripe.com/register and sign up (or sign in if
   Fabrik already has one).
2. You don't need to finish business verification to use test mode — you can
   start immediately. Verification is only required before you can accept
   real (live-mode) payments.

## 2. Get test-mode API keys

1. In the Stripe Dashboard, make sure the toggle in the top-left says **Test
   mode** (not "Live mode").
2. Go to **Developers -> API keys** (or https://dashboard.stripe.com/test/apikeys).
3. Copy the **Secret key** (starts `sk_test_...`). This is `STRIPE_SECRET_KEY`.
4. You do **not** need the publishable key — this integration uses Stripe's
   hosted invoice page, not Stripe.js, so no client-side key is required.

## 3. Vercel environment variables

In the Vercel project (Settings -> Environment Variables), add for the
**Preview** and/or **Production** environment you're testing against:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` from step 2 |
| `STRIPE_WEBHOOK_SECRET` | from step 4 below (`whsec_...`) |

Also set them in `.env.local` for local development (already has blank
placeholders after this change — just fill them in). Redeploy after adding
env vars in Vercel; they don't apply to already-running deployments.

## 4. Webhook endpoint setup

1. In the Stripe Dashboard (test mode), go to **Developers -> Webhooks ->
   Add endpoint** (https://dashboard.stripe.com/test/webhooks).
2. Endpoint URL: `https://<your-vercel-domain>/api/stripe/webhook`
   (e.g. `https://3d-print-mvp.vercel.app/api/stripe/webhook`).
3. Select events to send — at minimum:
   - `invoice.paid`
   - `invoice.payment_failed`
   - `invoice.voided`
   - `charge.refunded`
4. Save the endpoint, then click into it and reveal the **Signing secret**
   (starts `whsec_...`). This is `STRIPE_WEBHOOK_SECRET` — set it in Vercel
   and redeploy.

**Testing locally** (before deploying): install the [Stripe CLI](https://docs.stripe.com/stripe-cli),
run `stripe login`, then `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
It prints a `whsec_...` value for local use — put that in `.env.local`
instead of the dashboard one while testing locally.

## 5. Stripe business/public invoice information

Before sending real invoices (even in test mode, so they look right), set:

1. **Settings -> Business -> Business details** — legal name, address. This
   is what appears on the invoice.
2. **Settings -> Business -> Public details / Branding** — support email,
   phone, and (optionally) a logo/icon and brand color for the hosted
   invoice page and invoice PDF.
3. **Tax**: this integration deliberately does **not** set any tax rate or
   enable Stripe Tax — invoice totals equal exactly the accepted Fabrik
   quote, with no VAT added by this code. If Latvian VAT needs to appear on
   invoices, that's a separate, deliberate decision for the business's
   accountant/Stripe Tax configuration — not something to switch on
   silently. Until then, invoices are VAT-inclusive-or-exclusive exactly as
   Fabrik's own pricing already is, with no Stripe-added line.

None of this is required to functionally test the flow below, but the
invoice PDF will look like a placeholder ("Test Business") until you do it.

## 6. Running a test €transaction

1. Make sure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set and the
   app is deployed (or running locally with `stripe listen` per step 4).
2. As an admin, go through the normal flow: upload a model, submit a quote
   request, set pricing in `/admin/requests/[id]`, click **Prepare quote**.
3. Open the quote link (`/q/<token>`) as the customer would, click **Accept
   quote**. This automatically creates and sends a Stripe invoice — check
   `/admin/requests/[id]`'s new **Payment** panel, it should now show
   "Invoice sent" and an "Open hosted invoice page" link.
4. Click **Pay invoice** (on the `/q/[token]` accepted page or the account
   request page) — this opens Stripe's hosted invoice page.
5. Pay with a Stripe test card: **4242 4242 4242 4242**, any future expiry,
   any 3-digit CVC, any postal code.
6. Within a few seconds, the webhook should fire and the admin Payment panel
   should flip to "Paid" (you may need to refresh). `StatusActions` on the
   request should now let you click **Start manufacturing**.

Other useful test cards: `4000 0000 0000 0002` (card declined — verify
`payment_status` becomes `payment_failed`, never `paid`).

## 7. Checking the invoice PDF

1. In the Stripe Dashboard (test mode) -> **Invoices**, find the invoice for
   this test request.
2. Open it — you can view/download the PDF from there, or use the
   "Open hosted invoice page" link from the admin panel, which also lets you
   download the PDF as the customer would.
3. Confirm: two line items ("Manufacturing" and "Delivery"), total exactly
   matching what you set as the customer price in `/admin/requests/[id]`.

## 8. Checking the webhook

1. Stripe Dashboard -> **Developers -> Webhooks -> [your endpoint]** shows a
   log of every delivery attempt, with response status and body.
2. A successful delivery should show `200` and the app's `ok` response body.
3. If you see repeated retries or a non-200, check Vercel's function logs
   for `/api/stripe/webhook` for the `console.error` output (signature
   failures, processing errors are logged there, never the secret itself).
4. You can also click **Send test webhook** on an event type from the
   Stripe Dashboard to fire a synthetic event without a real payment — useful
   for checking `invoice.payment_failed`/`invoice.voided` handling without
   needing a real declined card each time. Note synthetic test events won't
   match a real `stripe_invoice_id` in your database unless you use an
   invoice ID that actually exists.

## 9. Switching from test to live mode safely

Do this only once steps 1–8 all work correctly in test mode.

1. Complete Stripe's business verification (Settings -> Business -> finish
   any pending requirements) — required before live charges are accepted.
2. Re-do steps 2–4 **in live mode** (toggle to "Live mode" in the Dashboard
   first): get a live secret key (`sk_live_...`), create a **separate** live
   webhook endpoint (same URL, but live-mode signing secret is different —
   `whsec_...` values differ between test and live), and get its signing
   secret.
3. In Vercel, update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to the
   live-mode values for the **Production** environment specifically — do not
   overwrite Preview/test env vars if you want to keep testing safely
   against test mode in previews.
4. Redeploy production.
5. Do **one** small real test transaction yourself first (a real card, a
   real minimal-priced test request) before treating it as production-ready.
6. Test-mode data (customers, invoices) never carries over to live mode —
   they're entirely separate in Stripe. Nothing in this app's database
   needs to change; `stripe_customer_id`/`stripe_invoice_id` values from
   test mode simply won't resolve against live-mode Stripe, which is fine
   since no live request would have a test-mode id anyway (test and
   production databases should already be separate, or you're testing in
   the same DB — in the latter case, avoid running further test-mode
   accepts once you've switched to live keys, since the app has no
   test/live segregation in its own schema and will always call Stripe
   under whichever key is currently configured).
