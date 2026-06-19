# 世界杯预测 API

## 技术栈

- Fastify
- Prisma 5
- PostgreSQL
- Open-Meteo 天气 API
- TheSportsDB 可选公开 API

## 本地启动

```bash
cp .env.example .env
npm run prisma:generate
npm run server
```

`DATABASE_URL` 用于远程 PostgreSQL 数据库。当前 API 在数据库未配置或无数据时也可以运行，因为会使用本地兜底数据；同时 Prisma schema 和 Prisma client 已经为持久化数据做好准备。

拿到 PostgreSQL 凭据后执行：

```bash
npm run prisma:migrate
npm run db:seed
npm run server
```

早期远程数据库初始化如果暂时不创建迁移文件，可以使用：

```bash
npm run db:push
npm run db:seed
```

## 环境变量

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/worldcup_predictor?schema=public
SERVER_HOST=127.0.0.1
SERVER_PORT=4000
ENABLE_LIVE_WEATHER=true
ENABLE_SPORTSDB=true
```

## 接口

```text
GET /api/health
GET /api/dashboard
GET /api/matches
GET /api/matches/:id
GET /api/teams
POST /api/admin/sync-fifa
```

## 数据策略

API 使用数据网关聚合多类数据：

1. 本地兜底数据：赛程、球队、场馆、排名和模型复盘。
2. Open-Meteo：当开球时间仍处于天气预报窗口内时获取天气。
3. TheSportsDB：可选的公开球队信息补充。
4. PostgreSQL/Prisma：配置凭据后用于持久化赛程、球队、场馆和预测数据。

当 `DATABASE_URL` 已配置且数据库中有记录时，`/api/dashboard` 和 `/api/matches` 会从 PostgreSQL 读取赛程、球队和场馆。没有数据库或没有数据时，会自动回退到本地兜底数据。

## FIFA 赛程同步

可通过下面命令把 FIFA 2026 赛程同步到 PostgreSQL：

```bash
npm run sync:fifa
```

也可以通过接口触发：

```bash
curl -X POST http://127.0.0.1:4000/api/admin/sync-fifa
```

来源接口：

```text
https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200&language=en
```

同步会写入 FIFA 球队、场馆和 104 场比赛。未来比赛会忽略 FIFA 返回的占位比分，并保持 `scheduled` 状态。

竞彩赔率数据当前有意暂不接入。
