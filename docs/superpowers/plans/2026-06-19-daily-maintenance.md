# 每日维护实施计划

> **给自动化协作者的要求：** 按任务逐步实施；如需要使用 superpowers 工作流，优先使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。清单使用 `- [ ]` 跟踪进度。

**目标：** 新增每日维护命令，用于同步近期 ESPN 比赛数据，并创建赛前预测快照。

**架构：** 新增聚焦的 `maintenanceService`，负责解析北京时间日期窗口、编排 ESPN 同步和预测快照创建，并返回结构化摘要。不引入服务端定时器或新的数据库模型。

**技术栈：** Node.js ES modules、内置 `node:test`、现有 ESPN 同步服务、现有预测快照服务、npm scripts。

## 文件结构

- 新建 `server/src/services/maintenanceService.js`
  - 负责日期窗口计算、参数解析辅助函数、维护编排、状态分类和可序列化错误摘要。
- 新建 `server/src/services/maintenanceService.test.js`
  - 使用依赖注入测试日期窗口、dry-run 传递、成功、部分失败和全部失败。
- 新建 `server/src/scripts/runDailyMaintenance.js`
  - CLI 入口，读取 `--date-from`、`--date-to`、`--dry-run`，调用服务，打印 JSON，并仅在状态为 `failed` 时以非 0 退出。
- 修改 `package.json`
  - 新增 `maintenance:daily`。

## 任务 1：维护服务日期窗口

**文件：**

- 新建：`server/src/services/maintenanceService.js`
- 测试：`server/src/services/maintenanceService.test.js`

- [ ] 编写失败测试：验证默认窗口为北京时间昨天到明天，显式日期可以覆盖默认值。

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

- [ ] 运行测试，确认因为服务文件不存在而失败：

```bash
node --test server/src/services/maintenanceService.test.js
```

- [ ] 实现最小功能：

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

- [ ] 再次运行测试确认通过：

```bash
node --test server/src/services/maintenanceService.test.js
```

- [ ] 提交：

```bash
git add server/src/services/maintenanceService.js server/src/services/maintenanceService.test.js
git commit -m "feat: add maintenance date window"
```

## 任务 2：维护任务编排

**文件：**

- 修改：`server/src/services/maintenanceService.js`
- 修改：`server/src/services/maintenanceService.test.js`

- [ ] 编写失败测试：验证维护流程会先同步 ESPN，再创建快照；ESPN 失败但快照成功时返回 `partial`；两者都失败时返回 `failed`。

- [ ] 运行测试确认失败：

```bash
node --test server/src/services/maintenanceService.test.js
```

- [ ] 实现 `runDailyMaintenance()`：
  - 默认依赖 `syncEspnEnrichment`
  - 默认依赖 `createMissingPredictionSnapshots`
  - 接收依赖注入，方便测试
  - 收集 `errors`
  - 返回 `ok`、`partial` 或 `failed`

- [ ] 运行测试确认通过：

```bash
node --test server/src/services/maintenanceService.test.js
```

- [ ] 提交：

```bash
git add server/src/services/maintenanceService.js server/src/services/maintenanceService.test.js
git commit -m "feat: orchestrate daily maintenance"
```

## 任务 3：CLI 入口与 npm 脚本

**文件：**

- 新建：`server/src/scripts/runDailyMaintenance.js`
- 修改：`package.json`

- [ ] 新增 CLI 参数解析：
  - `--date-from=YYYY-MM-DD`
  - `--date-to=YYYY-MM-DD`
  - `--dry-run`

- [ ] 调用 `runDailyMaintenance()` 并打印 JSON。
- [ ] 当状态为 `failed` 时设置 `process.exitCode = 1`，其他状态保持成功退出。
- [ ] 在 `package.json` 中新增：

```json
"maintenance:daily": "node server/src/scripts/runDailyMaintenance.js"
```

- [ ] 验证：

```bash
npm run maintenance:daily -- --dry-run
npm run maintenance:daily -- --date-from=2026-06-18 --date-to=2026-06-20 --dry-run
```

- [ ] 提交：

```bash
git add server/src/scripts/runDailyMaintenance.js package.json
git commit -m "feat: add daily maintenance command"
```

## 任务 4：整体验证

- [ ] 运行服务测试：

```bash
npm test
```

- [ ] 运行前端构建：

```bash
npm run build
```

- [ ] 如需要，手动执行一次 dry-run，检查 JSON 摘要是否包含：
  - `options`
  - `window`
  - `espn`
  - `snapshot`
  - `status`
  - `errors`

## 自检

- 不引入新数据库表。
- 不在 Fastify 中增加定时任务。
- 快照不覆盖旧快照。
- ESPN 失败时仍尽量创建快照。
- 失败状态不会被成功退出码掩盖。
