import { expect, it } from "vitest";
import { periodQuery, tehranDayKey } from "./period";

it("requests Tehran calendar ranges with an explicit zone and bounded ISO end", () => {
  const now = new Date("2026-10-01T09:50:00.000Z");
  for (const [period, days] of [
    ["today", 1],
    ["7d", 7],
    ["14d", 14],
    ["30d", 30],
  ] as const) {
    const params = new URLSearchParams(periodQuery(period, now).split("?")[1]);
    const from = new Date(params.get("from") || "");
    const expected = new Date("2026-09-30T20:30:00.000Z");
    expected.setUTCDate(expected.getUTCDate() - days + 1);
    expect(from.toISOString()).toBe(expected.toISOString());
    expect(params.get("to")).toBe(now.toISOString());
    expect(params.get("tz")).toBe("Asia/Tehran");
  }
});

it("uses Tehran's day boundary independent of the browser time zone", () => {
  expect(tehranDayKey(new Date("2026-09-30T20:29:59.000Z"))).toBe("2026-09-30");
  expect(tehranDayKey(new Date("2026-09-30T20:30:00.000Z"))).toBe("2026-10-01");
});
