// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Care } from "./Care";

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request: requestMock }) }));

afterEach(() => {
  cleanup();
  requestMock.mockReset();
});

it("creates a medicine through the admin API and reloads its real detail", async () => {
  requestMock.mockImplementation(
    (path: string, options?: { method?: string }) => {
      if (path.startsWith("/admin/medicines?") && !options?.method)
        return Promise.resolve({
          data: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      if (path === "/admin/pet-types") return Promise.resolve([]);
      if (path === "/admin/medicines" && options?.method === "POST")
        return Promise.resolve({
          id: 17,
          name: "داروی آزمایشی",
          isActive: true,
        });
      if (path === "/admin/medicines/17")
        return Promise.resolve({
          id: 17,
          name: "داروی آزمایشی",
          isActive: true,
          petTypes: [],
        });
      throw new Error(`Unexpected request: ${path}`);
    },
  );
  render(<Care />);
  fireEvent.click(screen.getByRole("button", { name: "+ افزودن دارو" }));
  fireEvent.change(screen.getByRole("textbox", { name: /نام دارو/ }), {
    target: { value: "داروی آزمایشی" },
  });
  fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith(
      "/admin/medicines",
      expect.objectContaining({
        method: "POST",
        body: expect.objectContaining({
          name: "داروی آزمایشی",
          petTypeIds: [],
          isActive: true,
        }),
      }),
    ),
  );
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith("/admin/medicines/17"),
  );
  expect(screen.queryByText(/دادهٔ ساختگی/)).toBeNull();
});

it("ignores a delayed medicine detail after switching to pharmacies", async () => {
  let resolveMedicine: ((value: unknown) => void) | undefined;
  requestMock.mockImplementation((path: string) => {
    if (path.startsWith("/admin/medicines?"))
      return Promise.resolve({
        data: [{ id: 17, name: "داروی تأخیری", isActive: true }],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    if (path.startsWith("/admin/pharmacies?"))
      return Promise.resolve({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    if (path === "/admin/pet-types") return Promise.resolve([]);
    if (path === "/admin/medicines/17")
      return new Promise((resolve) => { resolveMedicine = resolve; });
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<Care />);
  expect(await screen.findByText("داروی تأخیری")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "جزئیات و ویرایش" }));
  await waitFor(() =>
    expect(requestMock).toHaveBeenCalledWith("/admin/medicines/17"),
  );
  fireEvent.click(screen.getByRole("button", { name: "داروخانه‌ها" }));
  await act(async () => {
    resolveMedicine?.({ id: 17, name: "داروی تأخیری", isActive: true, petTypes: [] });
  });
  expect(screen.getByRole("heading", { name: "داروخانه‌ها" })).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(requestMock.mock.calls.some(([path, options]) =>
    path === "/admin/pharmacies/17" && options?.method === "DELETE",
  )).toBe(false);
});
