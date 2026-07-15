# GLS TV operations runbook

## Incident first response

1. Record UTC start time, affected route, request/correlation ID, impact and operator.
2. Do not paste tokens, playlist URLs, payment references, bank data or support bodies into logs or tickets.
3. Open `/admin/access` and disable the smallest affected feature: payments, playlist imports, HLS proxy or catalog publishing.
4. Confirm the safe health endpoints and review Vercel runtime/build logs, Supabase logs, cron runs and the admin audit trail.
5. Keep payments disabled whenever activation, settlement matching or receipt integrity is uncertain.
6. Communicate only confirmed impact. Never claim a payment, refund, deletion or email delivery completed without its authoritative record.

## Recovery and rollback

- App: promote the last known-good Vercel deployment. Recheck environment variable scopes and run the critical member/admin flow.
- Database: never edit an applied migration or fabricate missing history. Prefer a reviewed forward-fix migration created with `npx supabase migration new <name>`. Use a destructive rollback only with a tested script, backup and owner approval.
- Features: kill switches are database-backed and audited. Disabling is the first containment step; re-enable only after verification.
- Account deletion: failed requests remain auditable. Resolve the failure code and retry through the AAL2 owner maintenance action. Respect legal holds.
- Rights/takedown: disable the source immediately, set rights status to `takedown` or `revoked`, record the evidence/reference, and keep catalog publishing disabled until review.

## Daily checks

- `/admin/ops`: cron failures, support backlog, import failures and retention dry-run.
- `/admin/finance`: unmatched/duplicate payments, refunds and manual settlement evidence.
- `/admin/access`: kill switches, suspended accounts and unexpected role assignments.
- `/admin/rights`: expiries and review dates. Unknown rights are never approved automatically.

## Provider limitations

Email delivery jobs remain `disabled` until the owner selects and configures a monitored SMTP/provider. The app must continue to describe these as in-app notices, not sent email.
