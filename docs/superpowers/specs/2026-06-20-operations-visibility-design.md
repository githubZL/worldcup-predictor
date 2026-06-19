# Operations Visibility Design

## Goal

Make production operations easier to run and inspect by adding:

- a repeatable server deployment script
- a latest maintenance status JSON file
- a small frontend maintenance status display

This iteration should stay lightweight and avoid adding a database table, queue, or monitoring platform.

## Current Context

The server is deployed at `/opt/worldcup-predictor`.

The app already has:

- `npm run maintenance:daily`
- hourly cron execution on the server
- `worldcup-predictor.service`
- Nginx serving `dist`
- dashboard metadata with `generatedAt` and data source labels

The missing piece is operational visibility: the page does not show whether the hourly maintenance task is healthy, and deployment is still a manual command sequence.

## Deployment Script

Add `scripts/deploy-server.sh`.

The script should run on the server from the repository root and perform:

1. `git pull --ff-only`
2. `npm ci`
3. `npx prisma generate`
4. `VITE_API_BASE_URL= npm run build`
5. `systemctl restart worldcup-predictor.service`
6. `nginx -t`
7. `nginx -s reload`

The script should be intentionally server-oriented. It does not need to SSH into the server itself.

## Maintenance Latest File

Each `npm run maintenance:daily` run should write a compact latest status file after the run completes:

```text
logs/maintenance-latest.json
```

The file should include:

- `generatedAt`
- `status`
- `window`
- `dryRun`
- `espn`
  - `events`
  - `matched`
  - `persisted`
  - `failed`
- `snapshot`
  - `created`
  - `skipped`
  - `total`
- `errorCount`
- `errors`

The file should be written for successful, partial, and failed runs. It should not include huge detail arrays from ESPN sync.

## Dashboard Metadata

The dashboard API should include:

```js
meta.maintenance = {
  generatedAt,
  status,
  window,
  dryRun,
  espn,
  snapshot,
  errorCount,
  errors,
}
```

If the file does not exist or cannot be parsed, the API should return:

```js
meta.maintenance = {
  status: "unknown",
  message: "尚无维护任务状态"
}
```

## Frontend Display

The existing top status area should show a compact maintenance line:

- maintenance status label
- latest maintenance time
- ESPN persisted count
- snapshot created count

Example:

```text
维护状态：正常 · 最近同步：2026/06/20 14:00 · ESPN 11 场 · 快照 0
```

If status is unknown:

```text
维护状态：未知
```

## Out of Scope

This iteration will not:

- add Prometheus/Grafana
- add alerting
- add a maintenance database table
- build an admin page
- change prediction model logic
- change cron frequency

## Testing

Backend tests should prove:

- compact maintenance status removes large `details`
- latest file write happens for a maintenance run
- dashboard metadata returns parsed maintenance status
- malformed or missing status file returns `unknown`

Frontend verification should use `npm run build`.
