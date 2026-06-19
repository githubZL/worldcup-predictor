# 运维可见性设计

## 目标

通过以下能力让生产环境更容易部署、运行和检查：

- 可重复执行的服务器部署脚本。
- 最新维护任务状态 JSON 文件。
- 前端展示一行轻量维护状态。

本轮保持轻量，不新增数据库表、任务队列或监控平台。

## 当前上下文

服务器部署目录为 `/opt/worldcup-predictor`。

应用已经具备：

- `npm run maintenance:daily`
- 服务器上每小时执行一次的 cron
- `worldcup-predictor.service`
- Nginx 托管 `dist`
- 仪表盘元信息中的 `generatedAt` 和数据源标签

缺失的是运维可见性：页面无法显示每小时维护任务是否健康，部署流程也仍是手动命令串。

## 部署脚本

新增 `scripts/deploy-server.sh`。

脚本在服务器仓库根目录运行，执行：

1. `git pull --ff-only`
2. `npm ci`
3. `npx prisma generate`
4. `VITE_API_BASE_URL= npm run build`
5. `systemctl restart worldcup-predictor.service`
6. `nginx -t`
7. `nginx -s reload`

脚本定位为服务器侧脚本，不需要自己 SSH 到服务器。

## 最新维护状态文件

每次执行 `npm run maintenance:daily` 后，都应写入紧凑状态文件：

```text
logs/maintenance-latest.json
```

文件应包含：

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

无论运行成功、部分失败还是失败，都应写入该文件。文件中不应包含 ESPN 同步返回的大型 `details` 数组。

## 仪表盘元信息

仪表盘 API 应包含：

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

如果状态文件不存在或无法解析，API 应返回：

```js
meta.maintenance = {
  status: "unknown",
  message: "尚无维护任务状态"
}
```

## 前端展示

顶部状态区展示一行紧凑维护信息：

- 维护状态标签
- 最近维护时间
- ESPN 写入场次数
- 快照创建数量

示例：

```text
维护状态：正常 · 最近同步：2026/06/20 14:00 · ESPN 11 场 · 快照 0
```

未知状态示例：

```text
维护状态：未知
```

## 暂不包含

本轮不做：

- Prometheus/Grafana
- 告警系统
- 维护任务数据库表
- 管理后台页面
- 预测模型逻辑修改
- cron 频率调整

## 测试

后端测试应证明：

- 维护状态会移除大型 `details`
- 维护运行后会写入最新状态文件
- 仪表盘元信息可以返回解析后的维护状态
- 状态文件缺失或格式错误时返回 `unknown`

前端通过 `npm run build` 验证。
