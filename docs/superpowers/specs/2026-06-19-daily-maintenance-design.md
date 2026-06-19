# Daily Maintenance Design

## Goal

Add a lightweight maintenance workflow that keeps match data fresh and creates pre-match prediction snapshots without changing the running Fastify server into a scheduler.

The first version should solve two immediate needs:

- Recently played matches should move from scheduled to finished after ESPN data is synced.
- Upcoming matches should get immutable pre-match prediction snapshots for official review.

## Current Context

The project already has the core pieces:

- `syncEspnEnrichment` updates ESPN enrichment data and match result fields.
- `createMissingPredictionSnapshots` creates prediction rows for upcoming matches that do not already have a snapshot for the current model version.
- `dataGateway` prefers a stored prediction snapshot when one exists and computes a live prediction otherwise.
- `modelReviewService` can distinguish official snapshot review from current-model backtest.

This feature should compose those pieces rather than introduce a new scheduler, queue, or database model.

## Proposed Interface

Add a script:

```bash
npm run maintenance:daily
```

The script should also support:

```bash
npm run maintenance:daily -- --date-from=2026-06-18 --date-to=2026-06-20
npm run maintenance:daily -- --dry-run
```

Default date window:

- From yesterday in Beijing time.
- To tomorrow in Beijing time.

This window is intentionally small. It updates recently completed matches, today matches, and near-future matches without scanning the whole tournament on every run.

## Data Flow

1. Resolve the maintenance window.
2. Run ESPN enrichment sync for the window.
3. Create missing prediction snapshots for future, not-finished matches.
4. Print a compact JSON summary.

The summary should include:

- input options
- resolved date window
- ESPN sync result
- snapshot result
- status: `ok`, `partial`, or `failed`

## Snapshot Rules

Snapshots are for official review, so they must stay conservative:

- Create only when the match is not finished.
- Create only when kickoff time is in the future.
- Create only when no current model-version snapshot exists.
- Do not overwrite existing snapshots.
- Use the current `MODEL_VERSION`.

If a model version changes later, the existing query by model version lets the new model create its own snapshots without deleting old ones.

## Error Handling

The maintenance command should be readable when run manually or by cron.

- If ESPN sync fails, report the error.
- If snapshot creation still can run safely, run it and mark the result as `partial`.
- If both fail or setup is invalid, mark the result as `failed`.
- Do not hide errors behind a success exit code when the whole maintenance run fails.

For the first implementation, it is acceptable for a failed ESPN sync to continue to snapshot creation, because snapshots can still be useful when the database already has enough data.

## Out of Scope

This version will not:

- Add server-side timers inside Fastify.
- Add BullMQ, Redis, or a task queue.
- Add a new database model for maintenance runs.
- Auto-deploy cron jobs to the remote server.
- Change frontend layout.

Those can be added after the basic workflow is proven stable.

## Testing

Add focused tests for the maintenance service:

- Default Beijing date window resolves yesterday through tomorrow.
- CLI options override the default window.
- `dry-run` is passed through to ESPN sync.
- Snapshot creation runs after ESPN sync.
- ESPN sync failure still allows snapshot creation and returns `partial`.
- Full failure returns `failed`.

Existing snapshot and ESPN sync service tests should remain unchanged unless a bug is found.

## Operational Usage

Manual run:

```bash
npm run maintenance:daily
```

Future cron usage:

```bash
cd /path/to/worldcup-predictor && npm run maintenance:daily
```

The script output should be JSON so it can be logged and inspected later.
