// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Operations } from "./Operations";
import { hasUnsavedDrafts, useDraftProtection } from "./management";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request: requestMock }) }));

const emptyPage = { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };

beforeEach(() => {
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/admin/payments?") ||
        path.startsWith("/admin/audit-logs?") || path === "/admin/settings") {
      return Promise.resolve(emptyPage);
    }
    throw new Error(`Unexpected request: ${path}`);
  });
});

it("protects unsaved settings from key and keyboard tab changes, then clears the draft after one normalized save", async () => {
  let complete: ((value: unknown) => void) | undefined;
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (options?.method === "PUT") return new Promise((resolve) => { complete = resolve; });
    if (path === "/admin/settings") return Promise.resolve({ data: [{ key: "SHIPPING_FLAT_COST", value: "20000", updatedAt: "2026-10-01T00:00:00Z", overridable: true }], meta: { page: 1, totalPages: 1 } });
    return Promise.resolve(emptyPage);
  });
  function ProtectedOperations() { useDraftProtection(); return <Operations initialTab="settings" />; }
  render(<ProtectedOperations />);
  const input = await screen.findByLabelText("مقدار جدید");
  fireEvent.change(input, { target: { value: "۳۰۰۰۰" } });
  expect(hasUnsavedDrafts()).toBe(true);
  fireEvent.change(screen.getByLabelText("کلید"), { target: { value: "ORDER_EXPIRE_MINUTES" } });
  fireEvent.click(screen.getByRole("button", { name: "بازگشت" }));
  await act(async () => {});
  expect((input as HTMLInputElement).value).toBe("۳۰٬۰۰۰");
  expect((screen.getByLabelText("کلید") as HTMLSelectElement).value).toBe("SHIPPING_FLAT_COST");
  fireEvent.keyDown(screen.getByRole("tab", { name: "تنظیمات" }), { key: "Home" });
  fireEvent.click(screen.getByRole("button", { name: "بازگشت" }));
  await act(async () => {});
  expect(screen.getByRole("tab", { name: "تنظیمات" }).getAttribute("aria-selected")).toBe("true");
  const form = input.closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  fireEvent.click(screen.getByRole("button", { name: "ذخیرهٔ تنظیم فروشگاه" }));
  await waitFor(() => expect(complete).toBeDefined());
  expect(requestMock.mock.calls.filter(([, options]) => options?.method === "PUT")).toHaveLength(1);
  expect(requestMock).toHaveBeenCalledWith("/admin/settings", expect.objectContaining({ method: "PUT", body: { key: "SHIPPING_FLAT_COST", value: "30000" } }));
  expect((input as HTMLInputElement).disabled).toBe(true);
  await act(async () => complete?.({}));
  expect(hasUnsavedDrafts()).toBe(false);
  expect((input as HTMLInputElement).value).toBe("");
});

afterEach(() => {
  cleanup();
  requestMock.mockReset();
});

describe("Operations tabs", () => {
  it("uses unique per-instance tab IDs with valid panel relationships and one tab stop", async () => {
    render(<><Operations /><Operations initialTab="settings" /></>);
    const tabs = screen.getAllByRole("tab");
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(tabs).toHaveLength(6);
    expect(panels).toHaveLength(6);
    expect(new Set(tabs.map((tab) => tab.id)).size).toBe(6);
    expect(new Set(panels.map((panel) => panel.id)).size).toBe(6);
    for (const tab of tabs) {
      const panel = document.getElementById(tab.getAttribute("aria-controls")!);
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute("aria-labelledby")).toBe(tab.id);
    }
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(2);
    expect(tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(2);
    expect(screen.getAllByRole("tabpanel")).toHaveLength(2);
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/payments\?/), expect.anything()));
  });

  it("automatically selects and focuses tabs with RTL arrows, wrap, Home, and End", async () => {
    render(<Operations />);
    const tabs = screen.getAllByRole("tab") as HTMLButtonElement[];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["پرداخت‌ها", "لاگ عملیات", "تنظیمات"]);
    tabs[0]!.focus();

    fireEvent.keyDown(tabs[0]!, { key: "ArrowLeft" });
    expect(tabs[1]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]!.tabIndex).toBe(0);
    expect(tabs[0]!.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(tabs[1]);
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tabs[1]!.id);
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/audit-logs\?/), expect.anything()));

    fireEvent.keyDown(tabs[1]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs[2]!.getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[2]!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0]!, { key: "End" });
    expect(document.activeElement).toBe(tabs[2]);
    fireEvent.keyDown(tabs[2]!, { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
  });

  it("keeps click activation and mounts only the chosen API view", async () => {
    render(<Operations initialTab="audit" />);
    const tabs = screen.getAllByRole("tab") as HTMLButtonElement[];
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/audit-logs\?/), expect.anything()));
    expect(requestMock.mock.calls.some(([path]) => String(path).startsWith("/admin/payments?"))).toBe(false);
    fireEvent.click(tabs[2]!);
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tabs[2]!.id);
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith("/admin/settings", expect.anything()));
    fireEvent.click(tabs[0]!);
    await waitFor(() => expect(requestMock).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/payments\?/), expect.anything()));
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]!.tabIndex).toBe(-1);
    expect(tabs[2]!.tabIndex).toBe(-1);
  });
});
