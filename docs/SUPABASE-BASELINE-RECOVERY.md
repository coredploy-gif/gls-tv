# Supabase baseline and migration recovery

Production contains historical objects whose original migration SQL is not fully present in this repository. Do not fabricate that history.

## Forward migration procedure

1. Run `npx supabase migration new --help`.
2. Create the file with `npx supabase migration new <descriptive_name>`.
3. Compare assumptions with production using `list_tables` and a read-only schema inspection.
4. Review RLS, grants, fixed `search_path`, foreign-key indexes and destructive statements.
5. Test locally when a local baseline is available. Otherwise use idempotent forward DDL and a production backup/change window.
6. Apply the exact reviewed SQL once, verify expected objects, then run Supabase Security and Performance Advisors.
7. Record the applied migration name and verification evidence in the launch checklist.

## Reconstructing a clean baseline

1. Export schema-only SQL from a controlled production snapshot using the Supabase CLI/dashboard tooling available to the owner.
2. Store it as a clearly dated baseline artifact, excluding data, secrets and generated auth/storage internals.
3. Restore into a disposable project and apply every repository migration after the baseline.
4. Run automated tests and both advisors; compare tables, constraints, indexes, grants, policies and functions to production.
5. Only after a successful restore drill should the baseline become the documented starting point for new environments.

Migration filename order is history. Never rename or edit a migration after it has been applied; add a forward fix instead.
