# Official Review Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose official snapshot review and current-model backtest rows, biggest misses, and excluded sample counts in the model review panel.

**Architecture:** Extend `modelReviewService` summary output with stable reviewed rows and biggest misses for each review policy. Keep the frontend simple by rendering a compact three-row miss list from existing dashboard data.

**Tech Stack:** Node.js ES modules, `node:test`, React, Vite, existing dashboard API.

---

## File Structure

- Modify `server/src/services/modelReviewService.js`
  - Add policy-specific row builders and biggest-miss selection.
  - Include `matches` and `biggestMisses` on both `official` and `backtest` summaries.
- Modify `server/src/services/modelReviewService.test.js`
  - Add tests proving official rows use snapshots only and backtest rows use all finished matches.
- Modify `src/App.jsx`
  - Render compact biggest-miss rows in the model review section.
  - Show official excluded count when relevant.
- Modify `src/styles.css`
  - Add compact review miss list styles.

## Task 1: Backend Review Rows

**Files:**
- Modify: `server/src/services/modelReviewService.test.js`
- Modify: `server/src/services/modelReviewService.js`

- [ ] **Step 1: Write the failing test**

Append this test to `server/src/services/modelReviewService.test.js`:

```js
test("buildModelReview exposes official snapshot rows and backtest rows separately", () => {
  const review = buildModelReview([
    {
      id: "snapshot-hit",
      time: "2026-06-18T16:00:00.000Z",
      home: "墨西哥",
      away: "韩国",
      modelVersion: "poisson-v0.8",
      predictionSource: "snapshot",
      predictionReview: {
        isFinished: true,
        actualScore: "1 - 0",
        predictedScore: "1 - 0",
        fullTimeHit: true,
        scoreHit: true,
        goalDiffError: 0,
        totalGoalsError: 0,
      },
      backtestReview: {
        isFinished: true,
        actualScore: "1 - 0",
        predictedScore: "1 - 1",
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 1,
        totalGoalsError: 1,
      },
    },
    {
      id: "computed-miss",
      time: "2026-06-18T19:00:00.000Z",
      home: "瑞士",
      away: "波黑",
      modelVersion: "poisson-v0.8",
      predictionSource: "computed",
      predictionReview: {
        isFinished: true,
        actualScore: "4 - 1",
        predictedScore: "1 - 1",
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 3,
        totalGoalsError: 3,
      },
      backtestReview: {
        isFinished: true,
        actualScore: "4 - 1",
        predictedScore: "1 - 1",
        fullTimeHit: false,
        scoreHit: false,
        goalDiffError: 3,
        totalGoalsError: 3,
      },
    },
  ]);

  assert.equal(review.official.sampleSize, 1);
  assert.equal(review.official.excludedSampleSize, 1);
  assert.deepEqual(review.official.matches.map((row) => row.id), ["snapshot-hit"]);
  assert.deepEqual(review.official.biggestMisses.map((row) => row.id), ["snapshot-hit"]);

  assert.equal(review.backtest.sampleSize, 2);
  assert.deepEqual(review.backtest.matches.map((row) => row.id), ["snapshot-hit", "computed-miss"]);
  assert.deepEqual(review.backtest.biggestMisses.map((row) => row.id), ["computed-miss", "snapshot-hit"]);
  assert.equal(review.backtest.biggestMisses[0].actualScore, "4 - 1");
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test server/src/services/modelReviewService.test.js
```

Expected: FAIL because `official.matches` is undefined.

- [ ] **Step 3: Implement backend rows**

Update `server/src/services/modelReviewService.js`:

- Add `buildReviewMatchRow(match, review)` returning the agreed row shape.
- Add `sortRowsByTime(rows)`.
- Add `selectBiggestMisses(rows, limit = 5)`.
- Change `buildReviewSummary` to accept `rows = []` and return `matches` plus `biggestMisses`.
- Build official rows from snapshot matches only.
- Build backtest rows from all finished backtest reviews.

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
node --test server/src/services/modelReviewService.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/modelReviewService.js server/src/services/modelReviewService.test.js
git commit -m "feat: expose model review match rows"
```

## Task 2: Frontend Miss List

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Inspect current review block**

Run:

```bash
sed -n '560,620p' src/App.jsx
sed -n '1000,1060p' src/App.jsx
sed -n '1080,1160p' src/styles.css
```

Expected: Locate `activeReview`, `modelReviewSummary`, and review card markup.

- [ ] **Step 2: Add frontend rendering**

In `src/App.jsx`:

- Define `const biggestReviewMisses = activeReview.biggestMisses ?? [];`
- Under `.review-summary`, render a `.review-miss-list` when `biggestReviewMisses.length > 0`.
- Show up to three rows:

```jsx
<div className="review-miss-list">
  <b>误差样本</b>
  {biggestReviewMisses.slice(0, 3).map((row) => (
    <div className="review-miss-row" key={row.id}>
      <span>{row.home} vs {row.away}</span>
      <em>{row.actualScore} / 预测 {row.predictedScore}</em>
      <i>{row.fullTimeHit ? "胜平负命中" : "胜平负未中"} · {row.scoreHit ? "比分命中" : "比分未中"} · 净胜球误差 {row.goalDiffError}</i>
    </div>
  ))}
</div>
```

- For official mode, append excluded text to the current conclusion only when `excludedSampleSize > 0`.

- [ ] **Step 3: Add styles**

In `src/styles.css`, add:

```css
.review-miss-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.review-miss-list > b {
  color: var(--text);
  font-size: 13px;
}

.review-miss-row {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) minmax(120px, auto) minmax(220px, 1.4fr);
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid rgba(127, 225, 133, 0.12);
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  color: var(--muted);
  font-size: 12px;
}

.review-miss-row span {
  color: var(--text);
  font-weight: 700;
}

.review-miss-row em {
  color: var(--gold);
  font-style: normal;
}

.review-miss-row i {
  color: var(--muted);
  font-style: normal;
}
```

- [ ] **Step 4: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/styles.css
git commit -m "feat: show model review miss samples"
```

## Task 3: Verification and Deployment

**Files:**
- No new source changes expected.

- [ ] **Step 1: Run full tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```

Expected: Push succeeds.

- [ ] **Step 4: Deploy server**

```bash
ssh root@49.232.246.121 "cd /opt/worldcup-predictor && git pull --ff-only && npm ci && npx prisma generate && VITE_API_BASE_URL= npm run build && systemctl restart worldcup-predictor.service && nginx -t && nginx -s reload"
```

Expected: Service restarts and Nginx reloads.

- [ ] **Step 5: Verify production endpoints**

```bash
curl -sS http://49.232.246.121/api/health
curl -sS http://49.232.246.121/api/dashboard | head -c 300
```

Expected: Both return JSON successfully.

---

## Self-Review

- Spec coverage: Covers official/backtest rows, biggest misses, excluded counts, frontend compact list, tests, and deployment.
- Placeholder scan: No implementation placeholders remain.
- Type consistency: `matches`, `biggestMisses`, `actualScore`, `predictedScore`, `goalDiffError`, and `totalGoalsError` are consistent across backend and frontend.
