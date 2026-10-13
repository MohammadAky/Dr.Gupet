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
import { Care, carePayload } from "./Care";
import { useDraftProtection } from "./management";

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

it("loads and updates the pharmacy on-duty status through its existing API", async () => {
  let onDuty = true;
  const pharmacy = () => ({
    id: 23,
    name: "داروخانهٔ آزمایشی",
    province: "خراسان رضوی",
    city: "مشهد",
    address: "نشانی آزمایشی مشهد",
    isActive: true,
    isVerified: true,
    onDuty,
    medicines: [],
  });
  requestMock.mockImplementation((path: string, options?: { method?: string; body?: { onDuty?: boolean } }) => {
    if (path === "/admin/pet-types") return Promise.resolve([]);
    if (path.startsWith("/admin/medicines?"))
      return Promise.resolve({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    if (path.startsWith("/admin/pharmacies?"))
      return Promise.resolve({ data: [pharmacy()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    if (path === "/admin/pharmacies/23") {
      if (options?.method === "PATCH") onDuty = options.body?.onDuty === true;
      return Promise.resolve(pharmacy());
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<Care />);
  fireEvent.click(screen.getByRole("button", { name: "داروخانه‌ها" }));
  expect(await screen.findByText("داروخانهٔ آزمایشی")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "جزئیات و ویرایش" }));
  const checkbox = await screen.findByRole("checkbox", { name: "کشیک" }) as HTMLInputElement;
  expect(checkbox.checked).toBe(true);
  fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith(
    "/admin/pharmacies/23",
    expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ onDuty: false }) }),
  ));
  await waitFor(() => expect((screen.getByRole("checkbox", { name: "کشیک" }) as HTMLInputElement).checked).toBe(false));
  expect(screen.queryByText(/کشیک فعلاً/)).toBeNull();
});

it("isolates the editor, traps keyboard focus and restores the page on close", async () => {
  requestMock.mockImplementation((path: string) => {
    if (path === "/admin/pet-types") return Promise.resolve([]);
    return Promise.resolve({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });
  const { container } = render(<Care />);
  const trigger = screen.getByRole("button", { name: "+ افزودن دارو" });
  trigger.focus();
  const priorOverflow = document.body.style.overflow;
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog");
  expect(container.hasAttribute("inert")).toBe(true);
  expect(document.body.style.overflow).toBe("hidden");
  const close = screen.getByRole("button", { name: "بستن" });
  expect(document.activeElement).toBe(close);
  const controls = dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]");
  const last = controls[controls.length - 1];
  if (!last) throw new Error("The editor must have focusable controls");
  last.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(document.activeElement).toBe(close);
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(container.hasAttribute("inert")).toBe(false);
  expect(document.body.style.overflow).toBe(priorOverflow);
  expect(document.activeElement).toBe(trigger);
  await act(async () => {});
});

it("retains a newly created record when detail reload fails so saving again cannot duplicate it", async () => {
  requestMock.mockImplementation((path: string, options?: { method?: string }) => {
    if (path === "/admin/pet-types") return Promise.resolve([]);
    if (path.startsWith("/admin/medicines?"))
      return Promise.resolve({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    if (path === "/admin/medicines" && options?.method === "POST")
      return Promise.resolve({ id: 31, name: "داروی ثبت‌شده", isActive: true });
    if (path === "/admin/medicines/31" && options?.method === "PATCH")
      return Promise.resolve({ id: 31, name: "داروی ثبت‌شده", isActive: true });
    if (path === "/admin/medicines/31") return Promise.reject(new TypeError("offline"));
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<Care />);
  fireEvent.click(screen.getByRole("button", { name: "+ افزودن دارو" }));
  fireEvent.change(screen.getByRole("textbox", { name: /نام دارو/ }), { target: { value: "داروی ثبت‌شده" } });
  fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));
  await waitFor(() => expect(screen.getByRole("dialog", { name: "ویرایش دارو" })).toBeTruthy());
  await waitFor(() => expect((screen.getByRole("button", { name: "ذخیره" }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole("textbox", { name: /نام دارو/ }).getAttribute("value")).toBe("داروی ثبت‌شده");
  fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));
  await waitFor(() => expect(requestMock).toHaveBeenCalledWith("/admin/medicines/31", expect.objectContaining({ method: "PATCH" })));
  expect(requestMock.mock.calls.filter(([path, options]) => path === "/admin/medicines" && options?.method === "POST")).toHaveLength(1);
  await waitFor(() => expect((screen.getByRole("button", { name: "ذخیره" }) as HTMLButtonElement).disabled).toBe(false));
});

it("retries failed care reads and announces editor errors only once", async () => {
  let failed = true;
  requestMock.mockImplementation((path: string) => {
    if (path === "/admin/pet-types") return Promise.resolve([]);
    if (path.startsWith("/admin/medicines?"))
      return failed
        ? Promise.reject(new TypeError("offline"))
        : Promise.resolve({ data: [{ id: 19, name: "داروی بازیابی‌شده", isActive: true }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    if (path === "/admin/medicines") return Promise.reject(new TypeError("offline"));
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<Care />);
  await screen.findByRole("alert");
  failed = false;
  fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
  await screen.findByText("داروی بازیابی‌شده");
  expect(screen.queryByRole("alert")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "+ افزودن دارو" }));
  fireEvent.change(screen.getByRole("textbox", { name: /نام دارو/ }), { target: { value: "داروی جدید" } });
  fireEvent.click(screen.getByRole("button", { name: "ذخیره" }));
  await screen.findByRole("alert");
  expect(screen.getAllByRole("alert")).toHaveLength(1);
});

it("keeps nested draft confirmation in control of Tab and Escape without closing its care editor", async () => {
  requestMock.mockImplementation((path: string) => Promise.resolve(path === "/admin/pet-types" ? [] : { data: [], meta: { page: 1, totalPages: 0 } }));
  function ProtectedCare() { useDraftProtection(); return <Care />; }
  render(<ProtectedCare />);
  fireEvent.click(screen.getByRole("button", { name: "+ افزودن دارو" }));
  fireEvent.change(screen.getByRole("textbox", { name: /نام دارو/ }), { target: { value: "پیش‌نویس دارو" } });
  fireEvent.keyDown(document, { key: "Escape" });
  const cancel = screen.getByRole("button", { name: "بازگشت" });
  fireEvent.keyDown(cancel, { key: "Tab" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "کنار گذاشتن تغییرها" }));
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await act(async () => {});
  expect(screen.queryByRole("dialog", { name: "کنار گذاشتن تغییرها" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "افزودن دارو" })).toBeTruthy();
  expect((screen.getByRole("textbox", { name: /نام دارو/ }) as HTMLInputElement).value).toBe("پیش‌نویس دارو");
});

it("accepts Persian decimal coordinates and rejects hexadecimal, exponents and out-of-range coordinates", () => {
  const place = { name: "مرکز آزمایشی", province: "تهران", city: "تهران", address: "نشانی آزمایشی", lat: "۳۵٫۷", lng: "۵۱.۴" };
  expect(carePayload("pharmacies", place, [])).toMatchObject({ lat: 35.7, lng: 51.4 });
  for (const lat of ["0x20", "1e1", "۹۱"]) expect(() => carePayload("pharmacies", { ...place, lat }, [])).toThrow();
});
