import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { AuthProvider, useAuth } from "./auth";

function response(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify(
      status === 200
        ? { success: true, data }
        : {
            success: false,
            message: "دسترسی مجاز نیست",
            code: "FORBIDDEN",
          },
    ),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function Harness() {
  const auth = useAuth();
  const [result, setResult] = useState("");
  return (
    <div>
      <span data-testid="mode">{auth.mode}</span>
      <button
        onClick={() =>
          void auth
            .verifyOtp("09120000000", "12345")
            .then(() => setResult("ok"))
            .catch((error: Error) => setResult(error.message))
        }
      >
        verify
      </button>
      <button
        onClick={() =>
          void auth
            .read<{ value: string }>("/admin/dashboard")
            .then((data) => setResult(data.value))
            .catch((error: Error) => setResult(error.message))
        }
      >
        read
      </button>
      <button onClick={auth.enterPreview}>preview</button>
      <button onClick={auth.logout}>logout</button>
      <span data-testid="result">{result}</span>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie.split(";").forEach((cookie) => {
    document.cookie = `${cookie.split("=")[0]}=; Max-Age=0; Path=/`;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("admin identity and browser storage", () => {
  it("rejects a non-admin response before exposing the dashboard", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ accessToken: "private-a", refreshToken: "private-r" }),
      )
      .mockResolvedValueOnce(
        response({ id: 5, role: "USER", phone: "09120000000" }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("verify"));
    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toContain(
        "دسترسی ندارد",
      ),
    );
    expect(screen.getByTestId("mode").textContent).toBe("guest");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("keeps admin tokens in memory, omits cookies, and retries once with a rotated token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ accessToken: "access-1", refreshToken: "refresh-1" }),
      )
      .mockResolvedValueOnce(
        response({
          id: 1,
          role: "ADMIN",
          phone: "09120000000",
          firstName: "مدیر",
        }),
      )
      .mockResolvedValueOnce(response(null, 401))
      .mockResolvedValueOnce(
        response({ accessToken: "access-2", refreshToken: "refresh-2" }),
      )
      .mockResolvedValueOnce(response({ value: "dashboard-ready" }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("verify"));
    await waitFor(() =>
      expect(screen.getByTestId("mode").textContent).toBe("admin"),
    );
    fireEvent.click(screen.getByText("read"));
    await waitFor(() =>
      expect(screen.getByTestId("result").textContent).toBe("dashboard-ready"),
    );
    const requests = fetchMock.mock.calls as Array<[string, RequestInit]>;
    expect(requests[2]?.[1].headers).toMatchObject({
      Authorization: "Bearer access-1",
    });
    expect(requests[4]?.[1].headers).toMatchObject({
      Authorization: "Bearer access-2",
    });
    expect(
      requests.every(
        ([, init]) => init.credentials === "omit" && init.cache === "no-store",
      ),
    ).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("ends the local session when the backend revokes the admin role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ accessToken: "access-1", refreshToken: "refresh-1" }),
      )
      .mockResolvedValueOnce(
        response({ id: 1, role: "ADMIN", phone: "09120000000" }),
      )
      .mockResolvedValueOnce(response(null, 403));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("verify"));
    await waitFor(() =>
      expect(screen.getByTestId("mode").textContent).toBe("admin"),
    );
    fireEvent.click(screen.getByText("read"));
    await waitFor(() =>
      expect(screen.getByTestId("mode").textContent).toBe("guest"),
    );
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("keeps local preview separate from the API and exits without reopening it", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/?demo=1");
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    fireEvent.click(screen.getByText("preview"));
    expect(screen.getByTestId("mode").textContent).toBe("preview");
    expect(window.location.search).toBe("");
    fireEvent.click(screen.getByText("logout"));
    expect(screen.getByTestId("mode").textContent).toBe("guest");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("disables the preview flag outside development", async () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    const production = await import("./auth");
    const productionData = await import("./dashboard-data");
    expect(production.LOCAL_PREVIEW).toBe(false);
    expect(productionData.sampleDashboard).toBeNull();
  });
});
