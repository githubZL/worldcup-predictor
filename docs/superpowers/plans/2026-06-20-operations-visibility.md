# 运维可见性实施计划

> **给自动化协作者的要求：** 按任务逐步实施；如需要使用 superpowers 工作流，优先使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`。清单使用 `- [ ]` 跟踪进度。

**目标：** 新增服务器部署脚本，并在仪表盘展示最新维护任务健康状态。

**架构：** 新增聚焦的维护状态服务，用于压缩维护结果、写入 `logs/maintenance-latest.json`，并把该状态读入仪表盘元信息。部署流程保持为服务器侧 shell 脚本。

**技术栈：** Node.js ES modules、`node:test`、React、Vite、shell 脚本、现有 Fastify 仪表盘 API。

## 文件结构

- 新建 `server/src/services/maintenanceStatusService.js`
  - 压缩维护输出，写入最新状态文件，读取最新状态文件。
- 新建 `server/src/services/maintenanceStatusService.test.js`
  - 单测覆盖压缩、写入/读取、缺失文件和格式错误文件。
- 修改 `server/src/scripts/runDailyMaintenance.js`
  - 在维护运行有结果后写入最新状态。
- 修改 `server/src/services/dataGateway.js`
  - 增加 `meta.maintenance`。
- 修改 `src/App.jsx`
  - 读取 `dashboardData.meta.maintenance` 并渲染紧凑维护状态。
- 修改 `src/styles.css`
  - 增加维护状态样式。
- 新建 `scripts/deploy-server.sh`
  - 服务器侧可重复部署命令。

## 任务 1：维护状态服务

**文件：**

- 新建：`server/src/services/maintenanceStatusService.js`
- 测试：`server/src/services/maintenanceStatusService.test.js`

- [ ] 编写失败测试，断言：
  - `compactMaintenanceStatus(result)` 会移除 ESPN `details`
  - `writeLatestMaintenanceStatus(result, { filePath })` 会写入 JSON
  - `readLatestMaintenanceStatus({ filePath })` 可以读回状态
  - 缺失文件返回 `{ status: "unknown", message: "尚无维护任务状态" }`
  - 格式错误文件返回 `{ status: "unknown", message: "维护任务状态文件不可读" }`
- [ ] 运行测试确认失败：

```bash
node --test server/src/services/maintenanceStatusService.test.js
```

- [ ] 实现服务函数：
  - `compactMaintenanceStatus(result, { generatedAt = new Date().toISOString() } = {})`
  - `writeLatestMaintenanceStatus(result, { filePath = "logs/maintenance-latest.json" } = {})`
  - `readLatestMaintenanceStatus({ filePath = "logs/maintenance-latest.json" } = {})`
- [ ] 再次运行测试确认通过：

```bash
node --test server/src/services/maintenanceStatusService.test.js
```

- [ ] 提交：

```bash
git add server/src/services/maintenanceStatusService.js server/src/services/maintenanceStatusService.test.js
git commit -m "feat: add maintenance status service"
```

## 任务 2：维护脚本写状态并暴露元信息

**文件：**

- 修改：`server/src/scripts/runDailyMaintenance.js`
- 修改：`server/src/services/dataGateway.js`

- [ ] 增加测试：如果数据网关已有依赖注入能力，断言 `getDashboard` 会包含 `meta.maintenance`；如果改动过重，则保留任务 1 的状态服务测试并手动验证仪表盘输出。
- [ ] 在 `runDailyMaintenance` 之后调用 `writeLatestMaintenanceStatus(result)`。
- [ ] 在仪表盘元信息中导入 `readLatestMaintenanceStatus` 并添加 `maintenance` 字段。
- [ ] 验证：

```bash
npm test
```

- [ ] 提交：

```bash
git add server/src/scripts/runDailyMaintenance.js server/src/services/dataGateway.js
git commit -m "feat: expose maintenance status in dashboard"
```

## 任务 3：前端状态展示与部署脚本

**文件：**

- 修改：`src/App.jsx`
- 修改：`src/styles.css`
- 新建：`scripts/deploy-server.sh`

- [ ] 在 `src/App.jsx` 中根据 `dashboardData.meta.maintenance` 生成紧凑文案：
  - 未知：`维护状态：未知`
  - 正常：`维护状态：正常 · 最近同步：... · ESPN ... 场 · 快照 ...`
  - 部分失败/失败：展示对应状态和错误数量
- [ ] 增加 `.maintenance-status` 样式，使其适配现有头部/底部密度。
- [ ] 新增部署脚本：

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

- [ ] 验证：

```bash
npm test
npm run build
```

- [ ] 提交：

```bash
git add src/App.jsx src/styles.css scripts/deploy-server.sh
git commit -m "feat: show maintenance status"
```

## 任务 4：推送与部署

- [ ] 推送：

```bash
git push origin main
```

- [ ] 部署：

```bash
ssh root@49.232.246.121 "cd /opt/worldcup-predictor && bash scripts/deploy-server.sh"
```

- [ ] 手动运行一次维护：

```bash
ssh root@49.232.246.121 "cd /opt/worldcup-predictor && npm run maintenance:daily"
```

- [ ] 验证生产环境：

```bash
curl -sS http://49.232.246.121/api/dashboard | head -c 500
curl -sS http://49.232.246.121/ | head -c 300
```

## 自检

- 规格覆盖：部署脚本、最新维护 JSON、仪表盘元信息、前端展示。
- 占位检查：不保留未处理占位项。
- 类型一致性：状态字段统一通过 `meta.maintenance` 传递。
