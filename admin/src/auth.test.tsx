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
      <button onClick={() =>
        void Promise.all([
          auth.read<{ value: string }>("/admin/dashboard"),
          auth.read<{ value: string }>("/admin/dashboard"),
        ]).then((values) => setResult(values.map((item) => item.value).join(",")))
          .catch((error: Error) => setResult(error.message))
      }>parallel</button>
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

  it("uses one refresh token for simultaneous expired requests", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/otp/verify"))
        return response({ accessToken: "access-1", refreshToken: "refresh-1" });
      if (url.endsWith("/admin/me"))
        return response({ id: 1, role: "ADMIN", phone: "09120000000" });
      if (url.endsWith("/auth/refresh"))
        return response({ accessToken: "access-2", refreshToken: "refresh-2" });
      if (url.endsWith("/admin/dashboard"))
        return (init.headers as Record<string, string>).Authorization === "Bearer access-1"
          ? response(null, 401) : response({ value: "ready" });
      throw new Error("unexpected request");
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthProvider><Harness /></AuthProvider>);
    fireEvent.click(screen.getByText("verify"));
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("admin"));
    fireEvent.click(screen.getByText("parallel"));
    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("ready,ready"));
    const calls = fetchMock.mock.calls;
    expect(calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
    expect(calls.every(([, init]) => init.credentials === "omit")).toBe(true);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("retries a delayed stale 401 with the rotated access token", async () => {
    let releaseLate401: ((value: Response) => void) | undefined;
    let oldReads = 0;
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/otp/verify"))
        return response({ accessToken: "access-1", refreshToken: "refresh-1" });
      if (url.endsWith("/admin/me"))
        return response({ id: 1, role: "ADMIN", phone: "09120000000" });
      if (url.endsWith("/auth/refresh"))
        return response({ accessToken: "access-2", refreshToken: "refresh-2" });
      if (url.endsWith("/admin/dashboard")) {
        if ((init.headers as Record<string, string>).Authorization === "Bearer access-1") {
          oldReads += 1;
          if (oldReads === 2) return await new Promise<Response>((resolve) => { releaseLate401 = resolve; });
          return response(null, 401);
        }
        return response({ value: "ready" });
      }
      throw new Error("unexpected request");
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthProvider><Harness /></AuthProvider>);
    fireEvent.click(screen.getByText("verify"));
    await waitFor(() => expect(screen.getByTestId("mode").textContent).toBe("admin"));
    fireEvent.click(screen.getByText("parallel"));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/admin/dashboard"))).toHaveLength(3));
    releaseLate401?.(response(null, 401));
    await waitFor(() => expect(screen.getByTestId("result").textContent).toBe("ready,ready"));
    expect(screen.getByTestId("mode").textContent).toBe("admin");
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
    expect(document.cookie).toBe("");
  });
});
