# BLOCK 1 AUDIT CHECKPOINT — Credit Tracker

Branch: `audit/block1-trust`  
Status: local only. No git commit, push, merge or deploy has been performed.

## Changed tracked files
- `server/.gitignore`
- `server/src/modules/credits/credits.service.ts`
- `server/src/utils/finance/pastPayments.ts`

## New untracked files
- `server/.env.test.example`
- `server/docker-compose.test.yml`
- `server/src/modules/credits/renewFreezeCycle.idempotency.test.ts`
- `server/src/utils/finance/block1.trust.test.ts`
- `server/src/utils/finance/creditCard.edge.test.ts`
- `server/src/utils/finance/date.edge.test.ts`
- `server/src/utils/finance/pastPayments.semantics.test.ts`

## Verified checks
- `npm run test:finance`: 85/85 tests passed, 10 files.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- Browser/PWA UI verification with Render shows live deploy works, but local cached PWA required cache clearing.

## Business logic changes completed
1. `pastPayments.ts`
   - Added `PlanPastPaymentsOptions`.
   - Added `assumeAllDuePaid`:
     - `true` allows past payments to be counted under explicit import/user intent.
     - default remains conservative.
   - Auto path prevents a single overdue payment from silently closing credit/outstanding.
   - `create()` uses `assumeAllDuePaid: dto.markPastAsPaid === true`.
   - `update()` uses the same setting only in the explicit branch.

2. `credits.service.ts` `renewFreezeCycle`
   - Conditional `updateMany` now owns:
     - `id`, `userId`, `frozen`, and
     - `nextFreezeCheckAt = null OR nextFreezeCheckAt <= today`.
   - 409 on `renewal.count !== 1`.
   - PaymentEvent only after successful atomic update.
   - No schema/fields added.
   - `totalPaid/outstanding/PaymentEvent` semantics preserved.

## Unit-level C2 coverage
- single overdue payment stays pending in conservative mode.
- explicit `markPastAsPaid` preserves planner behavior.
- multi-payment past/future behavior.
- gap: real `create()`/`update()` database integration not executed in this environment.

## Unit-level/mock C3 coverage
- null / future / today dates.
- no event for zero amount.
- repeat => no second event (mock-level).
- unfrozen card rejects before updateMany.
- unit tests use mocked Prisma; not real concurrent DB transmission.

## C4–C6 unresolved audit items (no formula changes)
- `monthlyPayments` comment vs implementation discrepancy.
- `monthsBetween` off-by-one boundary behavior.
- `buildCreditCardSchedule` residual term mismatch risk.
- accelerator/runtime annualRate convergence for frozen cards.
- C5 `effectiveAnnualRate` semantics should be reviewed against runtime data.

## Remaining risks
1. C3 concurrency/rollback not integration-tested.
2. C2 persisted-row semantics not integration-tested.
3. No isolated PostgreSQL/Docker available in current environment.
4. `PaymentEvent` has no unique constraint for duplicate protection at schema level.
5. `graceReplenishSum` represents plan amount, not proven deposited amount.
6. Overpayment not represented as a separate balance/credit field.
7. monthlyPayments ambiguity against current calendar month.

## Prepared safe test DB configuration (not started)
- `docker-compose.test.yml`
  - local Postgres on port 5433
  - test-only volumes/data
  - credentials test-only
- `.env.test.example`
  - `DATABASE_URL` / `DIRECT_URL` points only to `localhost:5433`.
- `.env.test` ignored by `.gitignore`.
- No `.env` or `.env.test` currently present.

## Planned safe commands when a real isolated PostgreSQL is available
```powershell
cd credit-tracker/server
docker compose -f docker-compose.test.yml config
docker compose -f docker-compose.test.yml up -d
$env:DATABASE_URL='postgresql://credit_test:credit_test_password@localhost:5433/credit_tracker_test?schema=public'
$env:DIRECT_URL=$env:DATABASE_URL
npx prisma migrate deploy
npm run test:finance
docker compose -f docker-compose.test.yml down -v
```

## Integration scenarios pending (only with safe DB)
### C3
- two concurrent renewal requests;
- at most one successful update;
- at most one `PaymentEvent`;
- second call yields 409;
- rollback on `PaymentEvent.create` failure;
- zero/partial/equal/over amount semantics against real rows.

### C2
- single overdue payment without `markPastAsPaid`;
- explicit `markPastAsPaid`;
- multiple payments;
- manual outstanding;
- preserve paid rows in `update`;
- duplicate PaymentEvent protection.

## Current git status
```text
 M server/.gitignore
 M server/src/modules/credits/credits.service.ts
 M server/src/utils/finance/pastPayments.ts
?? server/.env.test.example
?? server/docker-compose.test.yml
?? server/.env (absent)
?? server/.env.test (absent)
?? server/src/modules/credits/renewFreezeCycle.idempotency.test.ts
?? server/src/utils/finance/block1.trust.test.ts
?? server/src/utils/finance/creditCard.edge.test.ts
?? server/src/utils/finance/date.edge.test.ts
?? server/src/utils/finance/pastPayments.semantics.test.ts
```

## Policy maintained
- no push
- no merge
- no deploy
- no commit
- no external DB / production access
- no financial logic changes beyond approved C2/C3
- block 2 not started

Tracked changes were also exported to `block1_tracked_changes.diff`.
