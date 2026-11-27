import test from "node:test";
import assert from "node:assert/strict";
import {
  metricTime,
  latestMetricTime,
  formatMetricTime,
} from "../src/web/metric-time.js";
test("metric timestamps accept seconds, milliseconds and ISO without inventing missing dates", () => {
  const ms = Date.parse("2026-11-10T06:00:00Z");
  for (const v of [ms, ms / 1000, String(ms / 1000), "2026-11-10T06:00:00Z"])
    assert.equal(metricTime(v), ms);
  for (const v of [null, undefined, "", "invalid", 0, Infinity])
    assert.equal(metricTime(v), null);
  assert.equal(latestMetricTime([null, ms - 1000, ms]), ms);
  assert.equal(latestMetricTime([null, "bad"]), null);
  assert.equal(formatMetricTime(null, "en"), null);
});
