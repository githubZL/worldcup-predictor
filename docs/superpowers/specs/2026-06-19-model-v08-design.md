# 世界杯预测模型 v0.8 设计

## 背景

当前模型版本为 `poisson-v0.7`，核心能力包括基于球队实力、天气、海拔、赛制、ESPN 近期状态和球队统计生成 xG，再通过泊松比分矩阵输出胜平负、比分、半全场、让球倾向和大胜概率。上一轮已经修复 ESPN 完赛比分回写，页面和回测能正确识别已赛比赛。

目前短板是：模型信号分散在 xG 组件和 factors 中，缺少统一的因子层；赛程体能、冷门风险、进攻产出质量、阵容可用性等信息没有形成稳定结构，后续页面解释和回测分组不够顺手。

## 目标

将模型升级为 `poisson-v0.8`，新增统一的 `modelSignals` 因子层，让每个预测都能解释“哪些因素影响了结果、方向是什么、权重多大、可信度如何”。第一阶段只使用当前已经接入或可从现有字段推导的数据，不引入新数据库表，不改前端主布局。

## 非目标

- 不接真实竞彩赔率。
- 不实现机器学习训练或自动调参。
- 不大改前端视觉布局。
- 不改变 ESPN 同步源选择。
- 不把赛后数据用于赛前快照预测。当前模型回测仍使用现有回测口径，赛前快照机制另列后续任务。

## 模型输出

`buildPrediction()` 继续保留现有字段：

- `modelVersion`
- `score`
- `halfFull`
- `fullPick`
- `handicapPick`
- `probs`
- `xg`
- `risk`
- `factors`
- `predictionBreakdown`

新增：

- `predictionBreakdown.modelSignals`

`modelSignals` 是对象数组或分组对象，第一阶段采用分组对象，便于前端按类别展示：

```js
{
  baseStrength: { impact, confidence, label, details },
  form: { impact, confidence, label, details },
  production: { impact, confidence, label, details },
  fatigue: { impact, confidence, label, details },
  environment: { impact, confidence, label, details },
  tactical: { impact, confidence, label, details },
  availability: { impact, confidence, label, details },
  upsetRisk: { level, score, label, details }
}
```

其中：

- `impact`：正数偏主队，负数偏客队，0 为中性。
- `confidence`：`low | medium | high`。
- `label`：面向页面展示的中文说明。
- `details`：保留可回测、可调参的数值输入。

## 因子设计

### 基础实力

来源：`resolveTeamStrength()` 输出的 rank、attack、defense、source、confidence。

逻辑：

- 复用现有 `rankEdge`、`homeAttackEdge`、`awayAttackEdge`。
- 合成一个 `baseStrength.impact`。
- 占位球队降低 confidence。

用途：

- 页面解释强弱差。
- 回测按热门/冷门、强弱差分组。

### 近期状态

来源：ESPN `recentForm`，优先使用 `teamScore/opponentScore/result`。

逻辑：

- 复用现有 `recentFormRecord`。
- 增加 `pointsPerMatchDiff`、`goalDifferenceDiff` 到 details。
- `impact` 由双方近期状态 edge 差计算。

用途：

- 解释“近期状态拉升/压低”。
- 后续回测近期状态是否过度加权。

### 进攻产出

来源：ESPN `teamMatchStats` 的 totalShots、shotsOnTarget、possessionPct、goalDifference、totalGoals、goalsConceded。

逻辑：

- 复用现有 `buildTeamStatsEdge()`。
- details 暴露双方射门、射正、控球、进失球摘要。
- 样本不足时 confidence 为 low。

用途：

- 区分“强队名气强”和“近期进攻产出真的强”。

### 赛程体能

来源：ESPN `recentForm.eventDate`。

逻辑：

- 从双方 recentForm 中找最近一场有效比赛日期。
- 用当前比赛 kickoff 时间减去最近比赛日期得到休息天数。
- 休息天数差超过 2 天才给轻微修正。
- 低于 3 天休息的球队增加疲劳风险。

权重：

- 最大 xG edge 不超过 0.08。
- 当前阶段只进入 signals 和风险说明，不强推大幅 xG 变化。

### 环境场地

来源：venue altitude、country、weatherText、stage。

逻辑：

- 复用天气、海拔、东道主、赛制修正。
- 合并为 environment signal。
- 恶劣天气、高海拔、东道主分别保留 details。

### 战术与强弱悬殊

来源：rankDiff、attack/defense gap、mismatch adjustment、score matrix。

逻辑：

- 复用 v0.7 mismatch。
- 将 blowout 概率和强弱悬殊触发原因纳入 tactical signal。
- 不强行改变 top scoreline，只暴露大胜尾部概率。

### 阵容可用性

来源：ESPN lineups。

当前约束：

- 现在 ESPN lineup 数据质量不稳定，部分未来比赛只有阵容壳，无球员。
- 第一阶段不直接改变 xG。

逻辑：

- 统计双方 lineups 条数和 athletes 数。
- 如果有球员数据，confidence 为 medium，否则 low。
- `impact` 保持 0。
- `label` 说明“阵容数据已观测/阵容数据不足”。

### 冷门风险

来源：fullTime probabilities、mismatch、recentForm、production、placeholder、weather。

逻辑：

- 计算 `upsetRisk.score`，0-100。
- 以下情况增加冷门风险：
  - 胜平负头号概率低于 45。
  - 主客胜概率差小于 12。
  - 热门队有明显近期状态或产出劣势。
  - 恶劣天气。
  - 占位球队。
  - 强弱悬殊但弱队近期状态不差。
- 映射 level：`低 | 中 | 高`。

用途：

- 替代当前较粗的 `risk` 逻辑，`risk` 字段继续保留并由 upsetRisk level 映射。

## 数据流

1. `dataGateway` 构造 `predictionEnrichment`，传入 `buildPrediction()`。
2. `buildExpectedGoals()` 继续计算 xG 和原有 components/adjustments。
3. 新增内部函数 `buildModelSignals()`，读取 strength、expectedGoals、scoreMatrix、enrichment、match、venue、weather。
4. `buildPrediction()` 输出 `predictionBreakdown.modelSignals`。
5. `risk` 使用 `modelSignals.upsetRisk.level`。
6. 回测报告暂不改变结构，但可以在下一阶段读取 `modelSignals` 做分组。

## 版本策略

- 版本号升级为 `poisson-v0.8`。
- 更新所有测试中的版本预期。
- 不迁移旧 Prediction 快照；旧快照仍按自身 modelVersion 复盘。
- 当前模型回测将以 v0.8 实时计算结果为准。

## 测试策略

新增或更新以下测试：

- `buildPrediction keeps legacy fields...`：断言 modelVersion 为 v0.8，且存在 modelSignals。
- `buildPrediction exposes model signals...`：断言基础实力、近期状态、进攻产出、环境、战术、阵容、冷门风险均存在。
- `buildPrediction derives fatigue from recent form dates...`：构造双方 recentForm 日期，休息天数差触发 fatigue impact。
- `buildPrediction keeps lineup availability observable without xG overfit...`：有 lineup athletes 时 availability confidence 提升，但 xG 不因阵容直接变化。
- `buildPrediction maps upset risk into legacy risk...`：均势/占位/恶劣天气风险更高，明显强弱场风险更低或保持中低。

验收命令：

```bash
node --test server/src/services/predictionService.test.js
npm test
npm run build
npx prisma validate --schema prisma/schema.prisma
env ENABLE_LIVE_WEATHER=false npm run report:model-backtest
```

真实库回测需要网络权限连接远程 PostgreSQL。

## 风险与边界

- 目前 ESPN teamMatchStats 对已赛后的数据更完整，赛前预测必须通过 `preMatchEspnStats()` 过滤，不能把赛后本场统计喂回赛前预测。
- lineups 数据质量还不稳定，只可观测，不加权。
- fatigue 依赖 recentForm 日期，如果 lastFiveGames 不是国家队正式赛，需要低权重处理。
- 冷门风险是解释层，不等于竞彩投注建议。

## 交付标准

- v0.8 输出保持向后兼容。
- 每场预测都有完整 `modelSignals`。
- 单测、构建、Prisma 校验通过。
- 真实库回测可输出 v0.8 指标。
- 页面不崩溃；即使前端暂不展示 `modelSignals`，API 数据结构已准备好。
