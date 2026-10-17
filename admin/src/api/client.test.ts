// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiBlob, apiRequest } from "./client";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function waitingFetch() {
  let signal!: AbortSignal;
  const fetchMock = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    signal = options.signal!;
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, signal: () => signal };
}

describe("bounded admin request timeouts", () => {
  it("keeps the default at fifteen seconds and aborts the pending request", async () => {
    const pending = waitingFetch();
    const result = expect(apiRequest("/admin/dashboard")).rejects.toMatchObject({ status: 0, code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(14_999); expect(pending.signal().aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await result;
    expect(pending.signal().aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  });

  it("allows a CSV override to stay pending past the default and aborts at seventy seconds", async () => {
    const pending = waitingFetch();
    const result = expect(apiRequest("/admin/products/sync", { method: "POST", body: { rows: [] }, timeoutMs: 70_000 })).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(15_000); expect(pending.signal().aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(54_999); expect(pending.signal().aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await result;
    expect(pending.fetchMock).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, -1, 70_001, 1.5, Infinity, NaN])("rejects an invalid timeout %s before sending traffic", async timeoutMs => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(apiRequest("/admin/products/sync", { timeoutMs })).rejects.toMatchObject({ code: "INVALID_TIMEOUT" });
    expect(fetchMock).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the override timer after a successful authenticated CSV Blob response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("stock\n0", { headers: { "Content-Type": "text/csv" } })));
    const blob = await apiBlob("/admin/products/export.csv", { timeoutMs: 70_000, token: "memory-only" });
    expect(await blob.text()).toBe("stock\n0"); expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(70_000);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
