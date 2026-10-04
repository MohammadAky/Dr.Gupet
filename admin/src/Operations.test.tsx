// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Operations } from "./Operations";

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
