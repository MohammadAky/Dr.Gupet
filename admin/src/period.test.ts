import { expect, it } from "vitest";
import { periodQuery, sampleSalesReport } from "./period";

it("requests exact local calendar ranges with a bounded ISO end", () => {
  const now = new Date(2026, 9, 1, 13, 20);
  for (const [period, days] of [
    ["today", 1],
    ["7d", 7],
    ["14d", 14],
    ["30d", 30],
  ] as const) {
    const params = new URLSearchParams(periodQuery(period, now).split("?")[1]);
    const from = new Date(params.get("from") || "");
    const expected = new Date(now);
    expected.setHours(0, 0, 0, 0);
    expected.setDate(expected.getDate() - days + 1);
    expect(from.toISOString()).toBe(expected.toISOString());
    expect(params.get("to")).toBe(now.toISOString());
  }
});

it("keeps local demo totals consistent with its shown range", () => {
  const report = sampleSalesReport("7d", new Date(2026, 9, 1));
  expect(report.byDay).toHaveLength(7);
  expect(report.totals.revenue).toBe(
    report.byDay.reduce((sum, day) => sum + day.revenue, 0),
  );
});
