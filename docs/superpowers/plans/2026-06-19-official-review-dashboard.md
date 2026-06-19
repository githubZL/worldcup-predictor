# 正式复盘仪表盘实施计划

> **给自动化协作者的要求：** 按任务逐步实施；如需要使用 superpowers 工作流，优先使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。清单使用 `- [ ]` 跟踪进度。

**目标：** 在模型复盘面板中展示正式快照复盘和当前模型回测的比赛行、最大误差样本和被排除样本数量。

**架构：** 扩展 `modelReviewService` 摘要输出，为不同复盘口径提供稳定的复盘比赛行和最大误差样本。前端保持简单，直接从现有仪表盘数据中渲染三行紧凑误差列表。

**技术栈：** Node.js ES modules、`node:test`、React、Vite、现有仪表盘 API。

## 文件结构

- 修改 `server/src/services/modelReviewService.js`
  - 增加按复盘口径生成比赛行和最大误差样本的能力。
  - 在 `official` 和 `backtest` 摘要中加入 `matches` 与 `biggestMisses`。
- 修改 `server/src/services/modelReviewService.test.js`
  - 增加测试，证明正式复盘只用快照，回测使用全部已完赛比赛。
- 修改 `src/App.jsx`
  - 在模型复盘区渲染紧凑最大误差样本。
  - 有需要时展示正式复盘被排除样本数量。
- 修改 `src/styles.css`
  - 增加紧凑复盘误差列表样式。

## 任务 1：后端复盘比赛行

**文件：**

- 修改：`server/src/services/modelReviewService.test.js`
- 修改：`server/src/services/modelReviewService.js`

- [ ] 编写失败测试，验证：
  - `official.sampleSize` 只统计快照比赛。
  - `official.excludedSampleSize` 统计已赛但非快照的比赛。
  - `official.matches` 只包含快照比赛。
  - `backtest.matches` 包含全部已完赛比赛。
  - `biggestMisses` 按误差稳定排序。

- [ ] 运行测试确认失败：

```bash
node --test server/src/services/modelReviewService.test.js
```

- [ ] 实现后端比赛行：
  - 新增 `buildReviewMatchRow(match, review)`。
  - 新增 `sortRowsByTime(rows)`。
  - 新增 `selectBiggestMisses(rows, limit = 5)`。
  - 调整 `buildReviewSummary`，返回 `matches` 和 `biggestMisses`。
  - 正式复盘只从快照比赛生成行。
  - 当前模型回测从全部已完赛回测结果生成行。

- [ ] 再次运行测试确认通过：

```bash
node --test server/src/services/modelReviewService.test.js
```

- [ ] 提交：

```bash
git add server/src/services/modelReviewService.js server/src/services/modelReviewService.test.js
git commit -m "feat: expose model review match rows"
```

## 任务 2：前端误差样本列表

**文件：**

- 修改：`src/App.jsx`
- 修改：`src/styles.css`

- [ ] 查找当前复盘区代码：

```bash
sed -n '560,620p' src/App.jsx
sed -n '1000,1060p' src/App.jsx
sed -n '1080,1160p' src/styles.css
```

- [ ] 在 `src/App.jsx` 中增加：
  - `const biggestReviewMisses = activeReview.biggestMisses ?? [];`
  - 在 `.review-summary` 下方渲染 `.review-miss-list`
  - 最多展示三条误差样本

示例结构：

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

- [ ] 正式复盘模式下，如果 `excludedSampleSize > 0`，在结论中追加被排除样本说明。

- [ ] 在 `src/styles.css` 中增加误差列表样式。

- [ ] 构建验证：

```bash
npm run build
```

- [ ] 提交：

```bash
git add src/App.jsx src/styles.css
git commit -m "feat: show model review miss samples"
```

## 任务 3：验证与部署

- [ ] 运行完整测试：

```bash
npm test
```

- [ ] 运行构建：

```bash
npm run build
```

- [ ] 推送：

```bash
git push origin main
```

- [ ] 部署：

```bash
ssh root@49.232.246.121 "cd /opt/worldcup-predictor && bash scripts/deploy-server.sh"
```

- [ ] 检查页面复盘面板：
  - `正式复盘` 可点击。
  - `模型回测` 可点击。
  - 两个按钮的帮助问号位于区域右侧。
  - 有误差样本时展示最多三条。
  - 正式复盘中如有被排除样本，应清楚显示。

## 自检

- 不改变预测模型权重。
- 不改变数据库结构。
- 不新增大表格，保持页面紧凑。
- 正式复盘和模型回测口径必须清楚区分。
