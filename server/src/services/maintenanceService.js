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
