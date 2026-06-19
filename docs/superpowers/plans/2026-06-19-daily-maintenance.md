# Daily Maintenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily maintenance command that syncs recent ESPN match data and creates pre-match prediction snapshots.

**Architecture:** Add a focused `maintenanceService` that resolves a Beijing-time date window, composes ESPN sync and prediction snapshots, and returns a structured summary. Add a CLI wrapper plus an npm script, without adding server-side timers or new database models.

**Tech Stack:** Node.js ES modules, built-in `node:test`, existing ESPN sync service, existing prediction snapshot service, npm scripts.

---

## File Structure

- Create `server/src/services/maintenanceService.js`
  - Owns date window calculation, option parsing helpers, maintenance orchestration, status classification, and serializable error summaries.
- Create `server/src/services/maintenanceService.test.js`
  - Tests date window, dry-run propagation, success, partial failure, and full failure using dependency injection.
- Create `server/src/scripts/runDailyMaintenance.js`
  - CLI entrypoint that reads `--date-from`, `--date-to`, `--dry-run`, calls the service, prints JSON, and exits non-zero only when status is `failed`.
- Modify `package.json`
  - Add `maintenance:daily`.

## Task 1: Maintenance Service Date Window

**Files:**
- Create: `server/src/services/maintenanceService.js`
- Test: `server/src/services/maintenanceService.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `server/src/services/maintenanceService.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { resolveMaintenanceWindow } from "./maintenanceService.js";

test("resolveMaintenanceWindow defaults to yesterday through tomorrow in Beijing time", () => {
  const window = resolveMaintenanceWindow({
    now: new Date("2026-06-19T01:30:00.000Z"),
  });

  assert.deepEqual(window, {
    dateFrom: "2026-06-18",
    dateTo: "2026-06-20",
    timezone: "Asia/Shanghai",
  });
});

test("resolveMaintenanceWindow lets explicit dates override defaults", () => {
  const window = resolveMaintenanceWindow({
    now: new Date("2026-06-19T01:30:00.000Z"),
    dateFrom: "2026-06-10",
    dateTo: "2026-06-12",
  });

  assert.deepEqual(window, {
    dateFrom: "2026-06-10",
    dateTo: "2026-06-12",
    timezone: "Asia/Shanghai",
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test server/src/services/maintenanceService.test.js
```

Expected: FAIL because `maintenanceService.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `server/src/services/maintenanceService.js`:

```js
const BEIJING_TIMEZONE = "Asia/Shanghai";
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDateInBeijing(date) {
  return new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

export function resolveMaintenanceWindow({ now = new Date(), dateFrom, dateTo } = {}) {
  const todayStartUtc = new Date(`${formatDateInBeijing(now)}T00:00:00.000Z`);
  return {
    dateFrom: dateFrom ?? formatDateInBeijing(new Date(todayStartUtc.getTime() - DAY_MS)),
    dateTo: dateTo ?? formatDateInBeijing(new Date(todayStartUtc.getTime() + DAY_MS)),
    timezone: BEIJING_TIMEZONE,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test server/src/services/maintenanceService.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/maintenanceService.js server/src/services/maintenanceService.test.js
git commit -m "feat: add maintenance date window"
```

## Task 2: Maintenance Orchestration

**Files:**
- Modify: `server/src/services/maintenanceService.js`
- Modify: `server/src/services/maintenanceService.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `server/src/services/maintenanceService.test.js`:

```js
import { runDailyMaintenance } from "./maintenanceService.js";

test("runDailyMaintenance syncs ESPN data then creates snapshots", async () => {
  const calls = [];
  const result = await runDailyMaintenance(
    {
      now: new Date("2026-06-19T01:30:00.000Z"),
      dryRun: true,
    },
    {
      syncEspnEnrichment: async (options) => {
        calls.push(["sync", options]);
        return { matched: 3, persisted: 3 };
      },
      createMissingPredictionSnapshots: async () => {
        calls.push(["snapshot"]);
        return { created: 2, skipped: 5, total: 7 };
      },
    },
  );

  assert.equal(result.status, "ok");
  assert.deepEqual(result.window, {
    dateFrom: "2026-06-18",
    dateTo: "2026-06-20",
    timezone: "Asia/Shanghai",
  });
  assert.deepEqual(calls, [
    [
      "sync",
      {
        dateFrom: "2026-06-18",
        dateTo: "2026-06-20",
        dryRun: true,
      },
    ],
    ["snapshot"],
  ]);
  assert.deepEqual(result.snapshot, { created: 2, skipped: 5, total: 7 });
});

test("runDailyMaintenance returns partial when ESPN sync fails but snapshots succeed", async () => {
  const result = await runDailyMaintenance(
    { now: new Date("2026-06-19T01:30:00.000Z") },
    {
      syncEspnEnrichment: async () => {
        throw new Error("espn unavailable");
      },
      createMissingPredictionSnapshots: async () => ({ created: 1, skipped: 0, total: 1 }),
    },
  );

  assert.equal(result.status, "partial");
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].step, "espn-sync");
  assert.equal(result.errors[0].message, "espn unavailable");
  assert.deepEqual(result.snapshot, { created: 1, skipped: 0, total: 1 });
});

test("runDailyMaintenance returns failed when both sync and snapshots fail", async () => {
  const result = await runDailyMaintenance(
    { now: new Date("2026-06-19T01:30:00.000Z") },
    {
      syncEspnEnrichment: async () => {
        throw new Error("espn unavailable");
      },
      createMissingPredictionSnapshots: async () => {
        throw new Error("database unavailable");
      },
    },
  );

  assert.equal(result.status, "failed");
  assert.deepEqual(
    result.errors.map((error) => [error.step, error.message]),
    [
      ["espn-sync", "espn unavailable"],
      ["prediction-snapshot", "database unavailable"],
    ],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test server/src/services/maintenanceService.test.js
```

Expected: FAIL because `runDailyMaintenance` is not exported.

- [ ] **Step 3: Write minimal implementation**

Update `server/src/services/maintenanceService.js`:

```js
import { syncEspnEnrichment as defaultSyncEspnEnrichment } from "./espnEnrichmentSyncService.js";
import { createMissingPredictionSnapshots as defaultCreateMissingPredictionSnapshots } from "./predictionSnapshotService.js";

const BEIJING_TIMEZONE = "Asia/Shanghai";
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDateInBeijing(date) {
  return new Date(date.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function summarizeError(step, error) {
  return {
    step,
    message: error instanceof Error ? error.message : String(error),
  };
}

export function resolveMaintenanceWindow({ now = new Date(), dateFrom, dateTo } = {}) {
  const todayStartUtc = new Date(`${formatDateInBeijing(now)}T00:00:00.000Z`);
  return {
    dateFrom: dateFrom ?? formatDateInBeijing(new Date(todayStartUtc.getTime() - DAY_MS)),
    dateTo: dateTo ?? formatDateInBeijing(new Date(todayStartUtc.getTime() + DAY_MS)),
    timezone: BEIJING_TIMEZONE,
  };
}

export async function runDailyMaintenance(
  { now = new Date(), dateFrom, dateTo, dryRun = false } = {},
  {
    syncEspnEnrichment = defaultSyncEspnEnrichment,
    createMissingPredictionSnapshots = defaultCreateMissingPredictionSnapshots,
  } = {},
) {
  const window = resolveMaintenanceWindow({ now, dateFrom, dateTo });
  const errors = [];
  let espnSync = null;
  let snapshot = null;

  try {
    espnSync = await syncEspnEnrichment({
      dateFrom: window.dateFrom,
      dateTo: window.dateTo,
      dryRun,
    });
  } catch (error) {
    errors.push(summarizeError("espn-sync", error));
  }

  try {
    snapshot = await createMissingPredictionSnapshots({ now });
  } catch (error) {
    errors.push(summarizeError("prediction-snapshot", error));
  }

  const status = errors.length === 0 ? "ok" : snapshot ? "partial" : "failed";

  return {
    status,
    options: { dryRun },
    window,
    espnSync,
    snapshot,
    errors,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test server/src/services/maintenanceService.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/maintenanceService.js server/src/services/maintenanceService.test.js
git commit -m "feat: orchestrate daily maintenance"
```

## Task 3: CLI Script and NPM Command

**Files:**
- Create: `server/src/scripts/runDailyMaintenance.js`
- Modify: `package.json`

- [ ] **Step 1: Write the failing command expectation**

Run:

```bash
npm run maintenance:daily -- --dry-run
```

Expected: FAIL because the script does not exist in `package.json`.

- [ ] **Step 2: Create CLI script**

Create `server/src/scripts/runDailyMaintenance.js`:

```js
import "dotenv/config";

import { runDailyMaintenance } from "../services/maintenanceService.js";

function readArg(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const args = new Set(process.argv.slice(2));

const result = await runDailyMaintenance({
  dateFrom: readArg("date-from"),
  dateTo: readArg("date-to"),
  dryRun: args.has("--dry-run"),
});

console.log(JSON.stringify(result, null, 2));

if (result.status === "failed") {
  process.exitCode = 1;
}
```

- [ ] **Step 3: Add npm script**

Modify `package.json` scripts:

```json
"maintenance:daily": "node server/src/scripts/runDailyMaintenance.js"
```

- [ ] **Step 4: Run command to verify it works**

Run:

```bash
npm run maintenance:daily -- --dry-run
```

Expected: JSON output with `status`, `window`, `espnSync`, `snapshot`, and `errors`.

- [ ] **Step 5: Commit**

```bash
git add package.json server/src/scripts/runDailyMaintenance.js
git commit -m "feat: add daily maintenance command"
```

## Task 4: Final Verification and Push

**Files:**
- No source changes expected.

- [ ] **Step 1: Run focused tests**

```bash
node --test server/src/services/maintenanceService.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Inspect git status**

```bash
git status -sb
```

Expected: clean branch ahead of `origin/main` by implementation commits.

- [ ] **Step 5: Push**

```bash
git push
```

Expected: implementation commits are uploaded to `origin/main`.

---

## Self-Review

- Spec coverage: The plan covers the lightweight script, default Beijing window, explicit CLI overrides, dry-run passthrough, JSON summary, partial failure, and no server timers.
- Placeholder scan: No TBD/TODO/implement-later placeholders remain.
- Type consistency: `resolveMaintenanceWindow`, `runDailyMaintenance`, `dateFrom`, `dateTo`, `dryRun`, `espnSync`, and `snapshot` are used consistently across tests, service, and CLI.
