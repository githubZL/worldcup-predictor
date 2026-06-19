# World Cup Predictor API

## Stack

- Fastify
- Prisma 5
- PostgreSQL
- Open-Meteo weather API
- TheSportsDB optional public API

## Setup

```bash
cp .env.example .env
npm run prisma:generate
npm run server
```

`DATABASE_URL` is reserved for the remote PostgreSQL database. The current API can run without a database because it uses local fallback data while the schema and Prisma client are being prepared.

After PostgreSQL credentials are available:

```bash
npm run prisma:migrate
npm run db:seed
npm run server
```

For early remote database setup without creating migration files, use:

```bash
npm run db:push
npm run db:seed
```

## Environment

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/worldcup_predictor?schema=public
SERVER_HOST=127.0.0.1
SERVER_PORT=4000
ENABLE_LIVE_WEATHER=true
ENABLE_SPORTSDB=true
```

## API

```text
GET /api/health
GET /api/dashboard
GET /api/matches
GET /api/matches/:id
GET /api/teams
POST /api/admin/sync-fifa
```

## Data Strategy

The API uses a data gateway:

1. Local fallback data for fixtures, teams, venues, rankings, and model review.
2. Open-Meteo for weather when the kickoff time is within the forecast horizon.
3. TheSportsDB for optional public team enrichment.
4. PostgreSQL/Prisma schema is ready for persistent data after credentials are added.

When `DATABASE_URL` is configured and database rows exist, `/api/dashboard` and `/api/matches` read fixtures, teams, and venues from PostgreSQL. Without a database, they automatically use local fallback data.

## FIFA Schedule Sync

The FIFA 2026 schedule can be synced into PostgreSQL with:

```bash
npm run sync:fifa
```

or through the API:

```bash
curl -X POST http://127.0.0.1:4000/api/admin/sync-fifa
```

Source endpoint:

```text
https://api.fifa.com/api/v3/calendar/matches?idCompetition=17&idSeason=285023&count=200&language=en
```

The sync writes FIFA teams, venues, and 104 matches into PostgreSQL. Future matches ignore any placeholder score values returned by FIFA and remain `scheduled`.

竞彩赔率 data is intentionally excluded for now.
