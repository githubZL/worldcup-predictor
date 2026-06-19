# Operations Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server deployment script and show latest maintenance-task health in the dashboard.

**Architecture:** Create a focused maintenance status service that compacts maintenance results, writes `logs/maintenance-latest.json`, and reads it into dashboard metadata. Keep deployment as a server-side shell script.

**Tech Stack:** Node.js ES modules, `node:test`, React, Vite, shell script, existing Fastify dashboard API.

---

## File Structure

- Create `server/src/services/maintenanceStatusService.js`
  - Compact maintenance output, write latest status file, read latest status file.
- Create `server/src/services/maintenanceStatusService.test.js`
  - Unit-test compaction, write/read, missing file, malformed file.
- Modify `server/src/scripts/runDailyMaintenance.js`
  - Write latest status in a `finally`-style flow after maintenance result exists.
- Modify `server/src/services/dataGateway.js`
  - Add `meta.maintenance`.
- Modify `src/App.jsx`
  - Read `dashboardData.meta.maintenance` and render compact maintenance text.
- Modify `src/styles.css`
  - Style compact maintenance status.
- Create `scripts/deploy-server.sh`
  - Server-side repeatable deploy command sequence.

## Task 1: Maintenance Status Service

**Files:**
- Create: `server/src/services/maintenanceStatusService.js`
- Test: `server/src/services/maintenanceStatusService.test.js`

- [ ] **Step 1: Write failing tests**

Create tests that assert:

- `compactMaintenanceStatus(result)` removes ESPN `details`
- `writeLatestMaintenanceStatus(result, { filePath })` writes JSON
- `readLatestMaintenanceStatus({ filePath })` reads it back
- missing file returns `{ status: "unknown", message: "尚无维护任务状态" }`
- malformed file returns `{ status: "unknown", message: "维护任务状态文件不可读" }`

- [ ] **Step 2: Run tests to verify failure**

```bash
node --test server/src/services/maintenanceStatusService.test.js
```

Expected: fail because service file does not exist.

- [ ] **Step 3: Implement service**

Implement:

- `compactMaintenanceStatus(result, { generatedAt = new Date().toISOString() } = {})`
- `writeLatestMaintenanceStatus(result, { filePath = "logs/maintenance-latest.json" } = {})`
- `readLatestMaintenanceStatus({ filePath = "logs/maintenance-latest.json" } = {})`

- [ ] **Step 4: Verify tests pass**

```bash
node --test server/src/services/maintenanceStatusService.test.js
```

- [ ] **Step 5: Commit**

```bash
git add server/src/services/maintenanceStatusService.js server/src/services/maintenanceStatusService.test.js
git commit -m "feat: add maintenance status service"
```

## Task 2: Write Status From Maintenance Script and Expose Meta

**Files:**
- Modify: `server/src/scripts/runDailyMaintenance.js`
- Modify: `server/src/services/dataGateway.js`

- [ ] **Step 1: Add tests**

Add a data gateway test asserting `getDashboard` can include `meta.maintenance` by reading a status service dependency if dependency injection already exists. If dependency injection is too invasive, test `readLatestMaintenanceStatus` in Task 1 and manually verify dashboard output.

- [ ] **Step 2: Update script**

After `runDailyMaintenance`, call `writeLatestMaintenanceStatus(result)`.

- [ ] **Step 3: Update dashboard meta**

Import `readLatestMaintenanceStatus` and add `maintenance` to `meta`.

- [ ] **Step 4: Verify**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add server/src/scripts/runDailyMaintenance.js server/src/services/dataGateway.js
git commit -m "feat: expose maintenance status in dashboard"
```

## Task 3: Frontend Status and Deploy Script

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Create: `scripts/deploy-server.sh`

- [ ] **Step 1: Add frontend maintenance text**

In `src/App.jsx`, derive a compact text from `dashboardData.meta.maintenance`:

- unknown: `维护状态：未知`
- ok: `维护状态：正常 · 最近同步：... · ESPN ... 场 · 快照 ...`
- partial/failed: show `部分失败` / `失败` and error count

- [ ] **Step 2: Style text**

Add a small `.maintenance-status` style that fits the existing header/footer density.

- [ ] **Step 3: Add deploy script**

Create `scripts/deploy-server.sh` with:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --ff-only
npm ci
npx prisma generate
VITE_API_BASE_URL= npm run build
systemctl restart worldcup-predictor.service
nginx -t
nginx -s reload
```

- [ ] **Step 4: Verify**

```bash
npm test
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/styles.css scripts/deploy-server.sh
git commit -m "feat: show maintenance status"
```

## Task 4: Push and Deploy

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Deploy**

```bash
ssh root@49.232.246.121 "cd /opt/worldcup-predictor && bash scripts/deploy-server.sh"
```

- [ ] **Step 3: Run maintenance once**

```bash
ssh root@49.232.246.121 "cd /opt/worldcup-predictor && npm run maintenance:daily"
```

- [ ] **Step 4: Verify production**

```bash
curl -sS http://49.232.246.121/api/dashboard | head -c 500
curl -sS http://49.232.246.121/ | head -c 300
```

---

## Self-Review

- Spec coverage: deployment script, latest maintenance JSON, dashboard metadata, frontend display.
- Placeholder scan: no open placeholders remain.
- Type consistency: status fields are shared through `meta.maintenance`.
