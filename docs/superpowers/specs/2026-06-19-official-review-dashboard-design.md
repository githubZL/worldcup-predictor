# Official Review Dashboard Design

## Goal

Make the model review section use trustworthy database-backed review data:

- Official review uses only pre-match prediction snapshots.
- Current-model backtest uses the latest model recomputed over finished matches.
- The frontend shows the difference clearly and exposes concrete miss examples.

This work should not change the prediction model itself.

## Current Context

The project already separates two review policies in `modelReviewService`:

- `official_snapshot_only`
- `current_model_backtest`

The frontend already has two tabs:

- `正式复盘`
- `模型回测`

The missing pieces are richer review output and clearer UI evidence. The user should be able to see why a headline metric is what it is, including which matches were missed and how many finished matches were excluded from official review because no pre-match snapshot existed.

## Data Semantics

### Official Review

Official review includes only finished matches where:

- `predictionSource === "snapshot"`
- `predictionReview.isFinished === true`

Official review should expose:

- sample size
- total finished matches
- excluded sample size
- review policy
- win/draw/loss hit rate
- exact score hit rate
- goal-difference-within-one rate
- average goal-difference error
- average total-goals error
- reviewed match rows
- biggest misses

### Current-Model Backtest

Current-model backtest includes finished matches using:

- `match.backtestReview`, when present
- otherwise `match.predictionReview`

This is useful for model iteration, but it must be labeled as a current-model replay rather than a formal score.

It should expose the same row and miss fields as official review.

## Match Row Shape

Each reviewed row should include:

- `id`
- `time`
- `home`
- `away`
- `modelVersion`
- `predictionSource`
- `actualScore`
- `predictedScore`
- `fullTimeHit`
- `scoreHit`
- `goalDiffError`
- `totalGoalsError`

Rows should be sorted by match time ascending. Biggest misses should sort by:

1. goal-difference error descending
2. total-goals error descending
3. match time ascending

## Frontend Behavior

The model review panel should keep the current two tabs.

For each tab, show:

- the existing metric cards
- the current conclusion sentence
- a compact “误差样本” list with up to three biggest misses
- for official review only, show excluded finished sample count when greater than zero

The list should not become a large table yet. A compact three-row list is enough for this iteration.

Example row:

```text
墨西哥 1-0 韩国 | 预测 1-1 | 胜平负未中 · 比分未中 · 净胜球误差 1
```

## Out of Scope

This iteration will not:

- change prediction weights
- add drill-down pages
- add charts
- change database schema
- clean historical snapshots
- redesign the whole review card

## Testing

Backend tests should prove:

- official review includes match rows and biggest misses from snapshot matches only
- current-model backtest includes all finished matches
- finished computed matches are counted as excluded in official review
- biggest misses are sorted predictably

Frontend should be verified by build and a quick browser/page check after deployment.
