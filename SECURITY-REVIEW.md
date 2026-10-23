# Security review: Supabase authorization (2026-10-22)

Status: **investigation required; do not run a migration blindly**.

## Confirmed from repository

- `app.js` checks `profile.seller_approved || profile.is_admin` to choose `active` versus `pending` for newly submitted listings. Client-side checks are not security boundaries.
- `supabase-schema.sql` and `supabase-step-2-item-policies.sql` grant authenticated users insert/update/delete on their own items without constraining listing `status`.
- `supabase-schema.sql` grants authenticated users update of their own profile without protecting privileged fields. If `seller_approved` and `is_admin` were later added without column-specific protection, users might be able to grant themselves privileges.
- The README refers to later SQL steps that were not found at the expected paths in this review. The deployed Supabase policies are unknown.

## Required before any live change

1. In Supabase SQL Editor, inspect `pg_policies` for `public.items`, `public.profiles`, and `storage.objects` (do not export customer data).
2. Check whether `authenticated` can update `profiles.is_admin` or `profiles.seller_approved`; if so, remove that permission with a tested migration.
3. Ensure no permissive policy allows an unapproved seller to insert/update an `active` listing. Note that PostgreSQL combines permissive policies with OR, so adding a stricter policy without removing the old permissive one does not fix it.
4. Ensure non-admin users cannot modify other users' listings or change moderation state.
5. Test anonymous, unapproved seller, approved seller, and administrator roles in a staging Supabase project before production rollout.

No live database settings were changed by this review.

## Read-only database diagnostic

Run `security/supabase-authorization-audit.sql` in the Supabase SQL Editor.
It lists policy definitions and privileges for the security-sensitive columns without querying user or listing data.
Compare the results against the expected approval workflow before writing a migration.
Do not post secret keys, session tokens, or customer data in a pull request.
