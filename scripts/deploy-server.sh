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
