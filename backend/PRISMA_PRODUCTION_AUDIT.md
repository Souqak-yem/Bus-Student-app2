# Prisma Production Audit

## 1) Executive summary

- Total Prisma migrations present in repo: 9
- Local failed migration count detected: 1
- Production database status: UNVERIFIED — local DB is not production
- Important rule: no schema fix is considered valid unless confirmed against the actual production database state

## 2) Local vs Production distinction

This audit distinguishes clearly between:

- LOCAL DATABASE: evidence gathered from the developer workspace / local PostgreSQL state
- PRODUCTION DATABASE: Neon/Render database state, which remains unverified in this environment and must be checked from Render/Neon itself

The local DB can show migration drift, failed migration status, or duplicate constraints, but it is not proof of production correctness.

## 3) Migration inventory

Migrations found in `backend/prisma/migrations`:

1. 20260707160916_add_destinations
2. 20260707201908_add_cart_system
3. 20260707205015_add_saturday_operation
4. 20260707225339_add_extra_registration_fee
5. 20260710195356_add_extra_fee_start
6. 20260726000000_add_trip_type_to_active_buses
7. 20260810143900_add_student_registration_requests
8. 20260813120000_add_missing_student_gender_fields
9. 20260813130000_add_push_subscriptions_table

## 4) Schema vs migration comparison

### A. Models / tables present in schema and tracked by migration

These are represented in tracked Prisma migrations and match schema intent:

- `users`
- `destinations`
- `pricing_areas`
- `pricing`
- `students`
- `student_registration_requests`
- `buses`
- `bus_students`
- `student_transfers`
- `assignments`
- `daily_operations`
- `active_buses`
- `return_queue`
- `bus_loads`
- `campaigns`
- `campaign_enrollments`
- `subscriptions`
- `daily_execution_dates`
- `payments`
- `attendances`
- `audit_logs`
- `weekly_sheets`
- `weekly_sheet_students`
- `bus_student_orders`
- `notifications`
- `carts`
- `cart_items`
- `saturday_operations`
- `saturday_active_buses`
- `saturday_bus_loads`
- `saturday_return_queue`
- `saturday_assignments`
- `saturday_boarding_timers`
- `message_templates`
- `weekly_sheet_versions`
- `emergency_reports`
- `emergency_logs`
- `student_financial`
- `push_subscriptions`

### B. Schema items that are not covered by a migration file

The following schema features are present in `schema.prisma` but do not have corresponding migration coverage in the repo history:

- `AppSetting` model -> table `app_settings`
- `ReturnBoardingTimer` model -> table `return_boarding_timers`
- `Cart.depositReference` column
- `CampaignEnrollment.depositReference` column

### C. Schema items with migration but known local-risk / partial status

- `StudentGender` enum and `students.gender` / `student_registration_requests.gender` were added by migration `20260813120000_add_missing_student_gender_fields`
- `push_subscriptions` table was created by `20260813130000_add_push_subscriptions_table`, but local check reported a duplicate FK issue and failed migration status in the local DB; this is local-only evidence and not production proof

## 5) Required audit table

| Model/Table | Schema Change | Migration | Production Status | Action |
| --- | --- | --- | --- | --- |
| `students` | `gender StudentGender?` | `20260813120000_add_missing_student_gender_fields` | UNVERIFIED in production; local-only status exists | Verify live DB; no app-level workaround; if missing in production, include in unified migration only |
| `student_registration_requests` | `gender StudentGender?` | `20260813120000_add_missing_student_gender_fields` | UNVERIFIED in production; local-only status exists | Verify live DB; no app-level workaround; if missing, include in unified migration only |
| `StudentGender` | enum `MALE`, `FEMALE` | `20260813120000_add_missing_student_gender_fields` | UNVERIFIED in production | Verify live DB before any migration or resolve command |
| `carts` | `depositReference String?` | No migration found in repo | UNVERIFIED; schema drift suspected | Must be checked against production; if absent in production, include in unified migration |
| `campaign_enrollments` | `depositReference String?` | No migration found in repo | UNVERIFIED; schema drift suspected | Must be checked against production; if absent, include in unified migration |
| `push_subscriptions` | table + FK + unique index | `20260813130000_add_push_subscriptions_table` | LOCAL FAILED; production unverified | Do not assume production is fixed; verify DB state and/or migration status on Render/Neon |
| `app_settings` | `AppSetting` model + table `app_settings` | No migration found in repo | UNVERIFIED; table likely absent in production if migration not applied | Must be verified in production; if missing, include in unified migration |
| `return_boarding_timers` | `ReturnBoardingTimer` model + table `return_boarding_timers` | No migration found in repo | UNVERIFIED; table likely absent in production if migration not applied | Must be verified in production; if missing, include in unified migration |
| `return_boarding_timers` | related fields: `startedAt`, `durationMinutes`, `endedAt`, `notified*` flags | No migration found in repo | UNVERIFIED | Must be validated against live schema before any change |
| `app_settings` | fields: `key`, `value`, `valueType`, `description`, `updatedAt`, `createdAt` | No migration found in repo | UNVERIFIED | Must be validated against live schema before any change |
| `saturday_boarding_timers` | `SaturdayBoardingTimer` model exists in schema | No migration found in repo | UNVERIFIED | Check live DB; this may be another example of schema/migration drift |
| `users.pushSubscriptions` | relation to `PushSubscription` | `20260813130000_add_push_subscriptions_table` (local migration file) | UNVERIFIED in production | Verify actual DB relation exists in production; do not patch app code to mask missing relation |
| `students` | `homeDeliveryFee*` and other fields | included in initial large base migration | UNVERIFIED in production | No action unless production mismatch is confirmed |

## 6) Missing migration findings

### Missing table/model migration coverage

The following schema objects currently exist in `schema.prisma` but do not appear in any SQL migration file under `backend/prisma/migrations`:

- `AppSetting` → `app_settings`
- `ReturnBoardingTimer` → `return_boarding_timers`

### Missing column migration coverage

The following columns are present in the schema but not found in the migration SQL as a documented migration step:

- `carts.depositReference`
- `campaign_enrollments.depositReference`

### Failed or conflicting migration files

Local evidence indicates:

- `20260813130000_add_push_subscriptions_table` is in the repo and is the likely migration for the push subscriptions feature
- Local DB status reported a failure in that migration due to duplicate FK behavior, which means a migration may be in a conflicted state on the local database
- This is local evidence only and must not be treated as production truth

## 7) Migration integrity assessment

A single consolidated migration should be prepared only if the actual production database is missing any of the valid schema changes above.

The required rule is:

- do not create one migration per UI error
- do not create migration files casually
- do not run `db push`
- do not run `migrate reset`
- do not delete tables or data
- do not change `DATABASE_URL`
- do not change Neon provider

If a unified migration is required, it should:

- include all missing schema changes in one file
- use safe `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` where appropriate
- use `CREATE TABLE IF NOT EXISTS` only when it is explicitly required and safe
- avoid recreating existing tables
- avoid destructive operations

No unified migration was created in this report-only phase, because production state was not verified and the user explicitly asked for a report before migration execution.

## 8) Package and deploy configuration review

### `backend/package.json`

Current backend start command:

```json
"start": "npx prisma migrate deploy && npx prisma generate && node src/index.js"
```

This already satisfies the requirement to run Prisma migration deploy before app startup.

### `render.yaml`

Current Render config already contains:

```yaml
startCommand: npx prisma migrate deploy --schema=prisma/schema.prisma && npx prisma generate && node src/index.js
```

This matches the required deploy behavior.

Conclusion:

- `package.json`: already correct
- `render.yaml`: already correct for Render deploy flow
- Manual Render service dashboard must still be checked, because a manually created service may override the repo config in the dashboard

## 9) Production-do-not-assume policy

The following must remain true:

- Local `npx prisma migrate status` success is not proof that Neon is correct
- Local DB is not production DB
- Production must be validated directly from Render/Neon environment or Render dashboard
- The app may be crashing because the live DB is missing a column/table even if local DB is healthy

## 10) Test order after migration deployment

Once production schema is confirmed and the deployment flow is active, test in this sequence:

1. Health endpoint
2. Login
3. `/api/auth/me`
4. Register new student
5. Cart
6. Subscription / payment
7. Daily operations
8. Saturday operations
9. Return trip
10. Tracking
11. Notifications

Important: if a Prisma error appears, do not patch the app logic. Instead:

- identify the exact missing table or column
- confirm if it exists in `schema.prisma`
- confirm if it has migration coverage
- if migration exists, do not add another migration blindly
- if migration is missing, add it only to the unified migration after reviewing the full schema

## 11) Final checklist responses

### 1) Number of migrations present

9

### 2) Number of failed migrations

Local evidence: 1 failed migration (`20260813130000_add_push_subscriptions_table`) due duplicate FK/constraint issue

Production failed count: UNVERIFIED

### 3) Models in schema with no migration

- `AppSetting`
- `ReturnBoardingTimer`

### 4) Columns in schema with no migration

- `carts.depositReference`
- `campaign_enrollments.depositReference`

### 5) Unified migration requirement

Required only if production DB is missing the real schema objects. The repo currently shows likely drift for:

- `app_settings`
- `return_boarding_timers`
- `carts.depositReference`
- `campaign_enrollments.depositReference`

No unified migration was created in this report-only phase.

### 6) Does `package.json` apply `migrate deploy` before server start?

Yes.

### 7) Does `render.yaml` need modification?

No change is needed based on the repo contents, because it already uses:

```bash
npx prisma migrate deploy --schema=prisma/schema.prisma
```

Before startup. Manual Render dashboard override still needs checking if the service was created manually.

### 8) Files changed

- Created: `backend/PRISMA_PRODUCTION_AUDIT.md`

No database or application logic changes were performed in this phase.

### 9) Risk to data

- Medium risk if production DB drift is real and app logic continues to query missing columns/tables
- No destructive action was taken
- No deletion, no reset, no `db push`, no `DATABASE_URL` change, no Neon provider change

### 10) Ready for commit and push?

No — not for production correctness claims.

The repo is ready for a review commit only if the intent is to keep the audit/report in the branch, but it is not ready to claim that Production is fixed or schema-healthy without direct verification against the actual Neon database.

## 12) Final conclusion

The repo shows a real schema / migration audit concern, especially for `AppSetting`, `ReturnBoardingTimer`, and the missing `depositReference` columns. However, there is no verified evidence that the production Neon DB is actually missing them, and the local DB results cannot be treated as production proof.

The correct next step is:

- verify the live Render/Neon database state
- confirm the migration state there
- then, and only then, create the single unified migration if production is missing the required schema objects
