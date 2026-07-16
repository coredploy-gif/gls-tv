# GLS TV production launch checklist

Last reviewed: 15 July 2026  
Production: [https://gls-tv.vercel.app](https://gls-tv.vercel.app)  
Supabase project: `fzzfazrinsyfwhylberv`

This is the launch source of truth. Do not mark a section complete without
testing the real production flow. Never paste secret values into this file,
GitHub, screenshots, support tickets, or chat.

## Current position

The app is deployed and the main manual billing foundation exists:

- Vercel production is live and linked to GitHub.
- The production deployment is `READY`, its Git commit matches `main`, and the
audited build and TypeScript checks pass.
- Public production checks found no recent 5xx responses, and the PWA manifest,
service worker, and icon are active.
- Supabase contains the manual billing tables, member references, payment
requests, payment events, receipts, reminders, audit log, and cron run log.
- Members can choose a plan, receive a unique member/payment reference, pay
through a Yoco payment link/QR or EFT, submit proof, and view a receipt.
- Admin has payment queue, member search, reports, receipts, refunds, payment
settings, daily operations, reminders, and audit pages.
- Manual/Yoco memberships are 30 days with no automatic debit.
- The 15 July launch-security database migration is applied in production:
privileged profile writes and channel RPCs are restricted, advised FK indexes
exist, and manual payment activation is atomic/idempotent.
- The hardened Next.js code passes focused lint, TypeScript, and a production
build locally. It is not counted as production-flow verification until deployed.
- Vercel Hobby-compatible daily jobs are configured at 02:00, 03:00, and 04:00
UTC for stream health, reminders, and manual billing.

This is suitable for a controlled beta after the launch blockers below are
closed. Do not take public payments yet.

## P0 — complete before inviting public users or taking money

### 1. Rotate the exposed Supabase service-role secret

The current service-role JWT was shared in chat. Treat it as compromised even
if the chat is private.

- [ ] In Supabase, rotate/regenerate the service-role/secret key.
- [ ] Replace `SUPABASE_SERVICE_ROLE_KEY` in Vercel Production, Preview, and
  ```
  Development as appropriate.
  ```
- [ ] Replace it in local `.env.local`.
- [ ] Redeploy production after replacing it.
- [ ] Confirm `/admin`, Finance, Daily Ops, and Audit work.
- [ ] Confirm the old key no longer works.

Never expose this key as `NEXT_PUBLIC_*`.

### 2. Close the Supabase security warnings

The live Supabase Security Advisor currently reports:

- Anonymous and signed-in users can execute the `SECURITY DEFINER` functions
`rollup_channel_health(text)` and `upsert_channel_seed(jsonb)`.
- `next_gls_ticket_number` and `helpdesk_set_ticket_number` have mutable
`search_path`.
- Leaked-password protection is disabled.
- Several service-only tables have RLS enabled with no client policies. This
intentionally blocks browser access, but the design should be documented and
verified after every migration.

Required:

- [x] Revoke function execution from `anon` and `authenticated` unless a
  ```
  specific function is deliberately public.
  ```
- [x] Set a fixed safe `search_path` on both helpdesk functions.
- [ ] Enable leaked-password protection in Supabase Auth if the project plan
  ```
  supports it.
  ```
- [ ] Re-run Supabase Security Advisor and resolve every warning or document a
  ```
  deliberate exception.
  ```

References:

- [https://supabase.com/docs/guides/database/database-linter](https://supabase.com/docs/guides/database/database-linter)
- [https://supabase.com/docs/guides/auth/password-security](https://supabase.com/docs/guides/auth/password-security)

### 3. Enforce paid/trial access on every protected request

The current profile-selection flow checks entitlement, but the route proxy only
checks authentication and the active-viewer cookie. A member who already has an
active-viewer cookie may be able to keep opening protected pages after access
expires until state/cookies are refreshed. The daily expiry job can also leave
up to roughly 24 hours of delay.

- [x] Add server-side entitlement enforcement for protected viewing routes and
  ```
  sensitive APIs, not only `/profiles`.
  ```
- [x] Validate subscription status and `current_period_end`, not only
  ```
  `profiles.is_premium`.
  ```
- [x] Clear or reject the active-viewer cookie when entitlement ends.
- [ ] Decide and document any grace period.
- [ ] Test trial expiry, paid expiry, refund, revoked access, renewal, and admin
  ```
  exception in production.
  ```

### 4. Prevent members from granting themselves premium

The live `profiles_update_own` RLS policy currently permits authenticated
members to update privileged profile columns, including `is_premium`, `plan`,
`trial_bypassed`, `is_admin_exception`, and profile limits.

- [x] Replace broad profile updates with a narrow API/RPC for harmless editable
  ```
  fields such as display name.
  ```
- [x] Revoke direct member updates to all plan, premium, trial, exception, and
  ```
  limit columns.
  ```
- [ ] Test attempts to change every privileged field through Supabase REST as a
  ```
  normal signed-in member.
  ```

### 5. Secure stream and URL-fetching surfaces

`/api/hls` is currently an unauthenticated general HTTP proxy with disabled
upstream TLS verification, incomplete private-network protection, permissive
CORS, whole-segment buffering, and no strict host/rate/response-size limits.
Playlist importing also fetches member-supplied URLs without complete
private-network protection.

- [x] Require active entitlement for HLS/media delivery.
- [x] Restore TLS certificate verification.
- [x] Use an explicit lawful host allowlist.
- [x] Block private, reserved, loopback, link-local, metadata, and rebinding
  ```
  targets after every DNS lookup and redirect, for IPv4 and IPv6.
  ```
- [x] Add redirect, timeout, content-type, and response-size limits. Segment
  ```
  responses remain bounded-buffered rather than fully streamed.
  ```
- [x] Add a per-user/IP HLS quota. This is an instance-local Vercel guard; add a
  ```
  durable shared limiter before high-volume public launch.
  ```
- [x] Apply the same SSRF protections to playlist URL imports.
- [x] Ensure the deployed `health-sweep` Edge Function fails closed when
  ```
  `CRON_SECRET` is missing and cannot be called anonymously (production
  version 2 deployed 15 July 2026; bearer secret required in function code).
  ```
- [x] Disable unauthenticated helpdesk ticket creation; signed-in submissions
  ```
  have validation and a honeypot.
  ```

### 6. Replace all customer-facing Stripe-era copy and dormant finance flows

The launch copy now describes Yoco/EFT manual 30-day renewal. Dormant legacy
Stripe administration remains in the repository but is clearly labelled and
must stay unused for launch.

- [x] Rewrite Legal and data-policy copy for Yoco payment links and manual EFT.
- [x] Remove statements that a card will be debited automatically.
- [x] Update past-due/reminder wording to “renew with Yoco or EFT”.
- [x] Clearly label dormant Stripe-only admin pages and actions.
- [ ] Confirm pricing, checkout, receipts, reminders, support replies, and legal
  ```
  copy all describe the same 30-day manual-renewal product.
  ```

### 7. Publish complete legal and customer policies

Versioned policy sections are published in code. Owner identity, monitored
contact details, response time, legal review, and acceptance evidence remain.

- [x] Terms of Service.
- [x] Privacy Policy covering Supabase, Vercel, Yoco, device identifiers, IP
  ```
  hashing, support messages, retention, and user deletion requests.
  ```
- [x] Refund and cancellation policy explaining how Yoco/EFT refunds are
  ```
  externally completed and recorded. Owner response time remains unset.
  ```
- [x] Acceptable Use Policy for imported playlists and streams.
- [ ] Copyright/takedown policy and a monitored contact address.
- [ ] Support contact, expected response time, and business/trading identity.
- [x] User consent links at registration and before payment.
- [ ] Version/date the policies and retain acceptance evidence.

GLS TV’s “software utility” wording does not by itself remove copyright or
broadcast-rights risk. Obtain permission for every curated stream, logo,
metadata source, schedule feed, movie, and series offered by GLS TV. Remove any
source whose rights or redistribution terms cannot be demonstrated.

### 8. Configure production authentication correctly

- [ ] Set the Supabase Auth Site URL to the final production origin.
- [ ] Add exact allowed redirect URLs for production and only the required
  ```
  Vercel preview pattern.
  ```
- [ ] Test registration, email verification, sign-in, sign-out, password reset,
  ```
  expired links, and account recovery on production.
  ```
- [ ] Replace Supabase’s limited default mail sender with a branded SMTP provider
  ```
  before a wider launch.
  ```
- [ ] Set sensible password minimums and rate limits.
- [ ] Create a second recovery admin account and protect both admin email
  ```
  accounts with MFA.
  ```

### 9. Use a Vercel plan that permits paid commercial operation

The current schedules were made compatible with Hobby cron limits, but cron
compatibility does not mean Hobby permits a paid commercial service.

- [ ] Confirm the current Vercel plan and current terms in the owner dashboard.
- [ ] Upgrade to Vercel Pro before accepting payments if the project is still on
  ```
  a non-commercial Hobby plan.
  ```
- [ ] Add a billing/spend alert and review function, bandwidth, image, and edge
  ```
  usage limits before opening access broadly.
  ```

## What the owner must provide and configure

### A. Yoco

- [ ] Complete Yoco merchant identity/onboarding and confirm the account may be
  ```
  used for this product.
  ```
- [ ] Add and verify the payout bank account.
- [ ] Obtain a live Yoco secret key; do not use a test key in production.
- [ ] Add `YOCO_SECRET_KEY` to Vercel Production only, then redeploy.
- [ ] In `/admin/finance/settings`, enable Yoco and confirm the page reports that
  ```
  Yoco is configured.
  ```
- [ ] Make one small real payment from another device/account.
- [ ] Confirm the QR/link amount and reference, Yoco status, admin activation,
  ```
  receipt, membership end date, and payout settlement.
  ```
- [ ] Refund that test payment in Yoco and confirm the GLS refund record matches.

Yoco activation currently uses admin sync and a daily poll of the latest 100
payment links. For instant, higher-volume activation, add a signed Yoco webhook
after validating the current Yoco API/webhook contract.

### B. EFT/bank details

Enter these at `/admin/finance/settings`; do not hard-code them:

- [ ] Trading name.
- [ ] Monitored support email.
- [ ] Bank name.
- [ ] Account holder.
- [ ] Account number.
- [ ] Branch code.
- [ ] Account type.
- [ ] Payment instructions.
- [ ] Receipt footer.

The production settings row currently has EFT enabled while bank details and the
support email are incomplete. Disable EFT until all fields are verified.

Before enabling EFT:

- [ ] Confirm the bank permits business/trading receipts into that account.
- [ ] Prefer a dedicated account so reconciliation and tax records stay clean.
- [ ] Test one real EFT using the exact generated payment reference.
- [ ] Never activate from a proof-of-payment image alone; match the amount,
  ```
  reference, settled bank transaction, and unique transaction ID.
  ```

### C. Business, tax, and records

- [ ] Decide the legal seller/trader name shown to customers.
- [ ] Confirm with Yoco and the bank whether a sole proprietor/personal account
  ```
  is acceptable for this activity.
  ```
- [ ] Keep monthly exports of receipts, refunds, Yoco settlements, and bank
  ```
  statements.
  ```
- [ ] Separate gross sales, processor fees, refunds, and net deposits.
- [ ] Confirm South African income-tax, consumer-protection, POPIA, and any VAT
  ```
  obligations with a qualified adviser. Do not label receipts “VAT invoice”
  unless properly registered and compliant.
  ```
- [ ] Define a data-retention and account-deletion process.

### D. Support and operations

Verified in production DB `fzzfazrinsyfwhylberv` (15 July 2026): public
`contact_enquiries` + durable `api_rate_limits`, expanded KB articles, and a
`[DEMO] Playback buffering on Sports channel` helpdesk ticket with message
history. In-app surfaces: `/notifications`, `/admin/inbox`, Message GLS on
`/auth`, and Intercom-style chat widget. Owner still must publish a monitored
email and hours below.

- [ ] Choose one monitored support email and publish it everywhere.
- [ ] Set daily support/payment verification hours and customer expectations.
- [ ] Prepare short templates for payment received, proof unmatched, activated,
  ```
  renewal due, expired, refund started, and refund completed.
  ```
- [ ] Keep recovery codes and ownership access for GitHub, Vercel, Supabase,
  ```
  Yoco, the bank, domain registrar, and support email in a password manager.
  ```
- [ ] Ensure at least one trusted backup operator can handle outages/payments.

## Required Vercel production variables

Verify names and scopes in Vercel; never record values here:

The audit could not inspect the authenticated Vercel dashboard, so the presence
and Production/Preview/Development scopes of these names remain owner checks.

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `NEXT_PUBLIC_SITE_URL` = final HTTPS production origin, no trailing slash
- [ ] `CRON_SECRET` = a strong random secret
- [ ] `EADMIN_EMAILS` = exact comma-separated admin emails
- [ ] `TMDB_API_KEY` if TMDB-backed metadata remains enabled and licensed
- [ ] `YOCO_SECRET_KEY` when Yoco is enabled
- [ ] `GLS_STREAM_PROXY` only if a lawful, trusted proxy is required

Leave Stripe variables unset while Stripe is dormant. If Stripe is reintroduced,
treat it as a separate tested billing launch with webhooks, prices, legal copy,
and reconciliation.

After any environment change, redeploy and test the affected server route.

## P1 — complete during the controlled beta

### Production reliability and security

- [ ] Add Content-Security-Policy and Strict-Transport-Security headers after
  ```
  testing all stream, image, Supabase, and Yoco origins.
  ```
- [ ] Add error monitoring and alerts for API 5xx responses, failed crons,
  ```
  payment activation failures, and auth failures.
  ```
- [ ] Add uptime checks for the home page, auth, pricing, and a safe health
  ```
  endpoint.
  ```
- [ ] Add rate limiting and abuse protection to auth-adjacent, support, payment,
  ```
  HLS proxy, and expensive public APIs.
  ```
- [ ] Confirm logs never contain keys, bank details, proof notes, or unnecessary
  ```
  personal data.
  ```
- [ ] Run dependency, secret, and security scans before each release.
- [ ] Document rollback: previous Vercel deployment, database migration
  ```
  rollback/forward fix, and emergency billing disable.
  ```

### Database performance and recovery

The live Performance Advisor currently reports unindexed foreign keys,
non-optimal RLS expressions, and duplicate permissive policies.

- [x] Add appropriate indexes for foreign keys used by billing events, helpdesk,
  ```
  payment events, trial claims, and stream seeds.
  ```
- [x] Change RLS `auth.uid()` expressions to `(select auth.uid())` where advised.
- [x] Consolidate duplicate SELECT policies on channels, knowledge articles, and
  ```
  admin system links.
  ```
- [x] Re-run both Supabase advisors after migrations (15 July 2026). Security
  ```
  warnings now only include owner-controlled leaked-password protection;
  no privileged-function/search-path warnings remain.
  ```
- [ ] Confirm the backup/PITR capability of the current Supabase plan.
- [ ] Schedule encrypted exports and perform a restore drill.
- [ ] Do not remove “unused” new indexes merely because the database has almost
  ```
  no production traffic yet.
  ```
- [ ] Reconcile migration history: production currently reports more applied
  ```
  migrations than exist in this repository. Commit the missing core schema,
  channel-health, and RPC migrations so a clean rebuild is reproducible.
  ```

### Billing robustness

- [x] Make activation atomic/idempotent so a partial database failure cannot
  ```
  set premium access without a receipt, or create a receipt without access.
  ```
- [ ] Add a reconciliation view comparing GLS receipts, Yoco transactions, and
  ```
  bank deposits.
  ```
- [ ] Add CSV exports for payments, receipts, refunds, members, and monthly
  ```
  revenue.
  ```
- [ ] Store processor fees and settlement IDs if Yoco supplies them.
- [x] Add an explicit owner action for actual refund completion; “Record refund”
  ```
  currently records GLS state but does not send money through bank/Yoco.
  ```
- [ ] Decide whether refunded membership ends immediately or remains active; test
  ```
  the chosen rule.
  ```
- [ ] Add webhook-driven Yoco activation when volume requires near-real-time
  ```
  access.
  ```

### Product and customer experience

- [ ] Test phone, tablet, desktop, low bandwidth, Android PWA install, and iOS
  ```
  “Add to Home Screen”.
  ```
- [ ] Add proper PNG/maskable/apple-touch icons rather than relying only on SVG.
- [ ] Add `robots.txt`, sitemap, canonical metadata, social preview image, and
  ```
  production favicon set when public discovery is desired.
  ```
- [ ] Add accessible labels, keyboard tests, contrast tests, and screen-reader
  ```
  checks for auth, checkout, player, and admin payment actions.
  ```
- [ ] Define browser/device support and a graceful unsupported-device message.
- [ ] Verify every curated channel from the target South African network and
  ```
  clearly label geo-restricted or third-party availability.
  ```

## End-to-end launch test

Perform this with a new non-admin email and a device/network that has not used a
trial:

- [ ] Register and verify email.
- [ ] Confirm the 14-day trial and device lock behave as advertised.
- [ ] Create/select a viewer profile and play representative live/VOD content.
- [ ] Choose each plan and confirm the amount is R45/R55/R65.
- [ ] Create a payment request and confirm unique member/payment references.
- [ ] Test Yoco QR/link on a separate phone.
- [ ] Test EFT details and proof submission.
- [ ] Confirm the admin can search by email, member reference, payment reference,
  ```
  bank/Yoco transaction ID, and status.
  ```
- [ ] Confirm duplicate transaction IDs and duplicate approvals are rejected.
- [ ] Approve a payment and verify 30 days are added from the later of now or the
  ```
  existing paid end date.
  ```
- [ ] Confirm in-app notification, premium access, plan profile limits, numbered
  ```
  receipt, print/PDF output, reports, and audit event.
  ```
- [ ] Test rejection and corrected resubmission.
- [ ] Test renewal before expiry.
- [ ] Test expiry and confirm protected content is immediately blocked.
- [ ] Test an actual refund plus the GLS refund record and customer notice.
- [ ] Test admin/helpdesk behavior on mobile and after a fresh sign-in.
- [ ] Confirm all three cron jobs write successful entries to Daily Ops.
  ```
  Production currently has no `ops_cron_runs` evidence, so each job still
  needs a verified successful run.
  ```

## Launch-day runbook

- [ ] Freeze non-essential code changes.
- [ ] Confirm the latest Git commit equals the Vercel production deployment.
- [ ] Confirm Vercel build and runtime logs have no unexplained errors.
- [ ] Confirm all environment variables and Supabase redirect URLs.
- [ ] Confirm database migrations and both Supabase advisors.
- [ ] Confirm Yoco and EFT can be disabled quickly from Finance Settings.
- [ ] Run the end-to-end test above.
- [ ] Check the top channels from the target network.
- [ ] Publish support hours and policies.
- [ ] Start with a small invite-only group.
- [ ] Keep the admin payment queue and logs open during the first payments.
- [ ] Record every incident and customer complaint in Helpdesk/Audit.

## Daily owner routine

- [ ] Open `/admin/ops`; check cron failures, channel health, tickets, and
  ```
  reminders.
  ```
- [ ] Open `/admin/finance/payments`; match settled transactions before approval.
- [ ] Sync Yoco payments when customers need access before the daily cron.
- [ ] Respond to rejected/unmatched payments with a specific reason.
- [ ] Check support tickets and urgent in-app reminders.
- [ ] Check Vercel and Supabase errors.
- [ ] Never share admin screenshots containing personal or bank information.

## Weekly and monthly routine 6

 146+

Weekly:

- [ ] Reconcile every GLS receipt against Yoco/bank activity.
- [ ] Review pending, expired, rejected, duplicate, and refunded items.
- [ ] Review admin audit logs and unusual sign-in/payment activity.
- [ ] Test representative channels and remove unlawful/dead sources.
- [ ] Export operational and finance records.

Monthly:

- [ ] Reconcile gross revenue, fees, refunds, and net deposits.
- [ ] Back up/export critical database and finance data.
- [ ] Review access to GitHub, Vercel, Supabase, Yoco, bank, domain, and email.
- [ ] Rotate credentials when staff/access changes or exposure is suspected.
- [ ] Re-run Supabase Security/Performance Advisors and dependency scans.
- [ ] Review policies, retention, tax records, support load, and plan pricing.

## Go/no-go rule

Go to a small invite-only beta only when every P0 item is complete and one real
Yoco or EFT payment has passed the full payment → activation → receipt →
reconciliation → refund test.

Go to a wider public launch only after beta users complete the flow without
manual data repair, entitlement expiry is reliably enforced, content rights are
documented, and the owner can perform the daily/weekly routines consistently.