// Metric observation time, never the browser poll or run heartbeat time.
export function metricTime(value) {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" || /^\d+(?:\.\d+)?$/.test(value);
  const n = numeric ? Number(value) : Date.parse(value);
  const ms = numeric && n < 1e12 ? n * 1000 : n;
  return Number.isFinite(ms) &&
    ms > 0 &&
    Number.isFinite(new Date(ms).getTime())
    ? ms
    : null;
}
export function latestMetricTime(values) {
  const times = values.map(metricTime).filter((t) => t !== null);
  return times.length ? Math.max(...times) : null;
}
export function formatMetricTime(value, locale) {
  const ms = metricTime(value);
  return ms === null
    ? null
    : new Date(ms).toLocaleString(locale, { hour12: false });
}
