// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { confirmAction, hasUnsavedDrafts, markFormSaved, useDraftProtection, usePaged } from "./management";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("./auth", () => ({ useAuth: () => ({ request }) }));
afterEach(() => { cleanup(); request.mockReset(); document.querySelectorAll(".admin-confirm").forEach((node) => node.remove()); });

it("keeps consequential confirmation keyboard-contained, defaults to cancel and restores its trigger", async () => {
  const opener = document.createElement("button"); document.body.append(opener); opener.focus();
  const result = confirmAction("حذف سفارش ۴۲", "حذف سفارش");
  const cancel = screen.getByRole("button", { name: "بازگشت" });
  expect(document.activeElement).toBe(cancel);
  expect(opener.hasAttribute("inert")).toBe(true);
  fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "حذف سفارش" }));
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(await result).toBe(false); expect(document.activeElement).toBe(opener);
  expect(opener.hasAttribute("inert")).toBe(false); opener.remove();
});

it("guards edited forms while leaving search controls and accepted saves clean", async () => {
  const close = vi.fn();
  function Editor() { useDraftProtection(); return <><form><label>نام<input name="name" /></label></form><form className="manage-toolbar"><label>جستجو<input /></label></form><button type="button" onClick={close}>بستن فرم</button></>; }
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("جستجو"), { target: { value: "search" } });
  expect(hasUnsavedDrafts()).toBe(false);
  fireEvent.change(screen.getByLabelText("نام"), { target: { value: "edited" } });
  expect(hasUnsavedDrafts()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "بستن فرم" }));
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "بازگشت" }));
  await act(async () => {});
  expect(hasUnsavedDrafts()).toBe(true);
  markFormSaved(screen.getByLabelText("نام").closest("form")!);
  fireEvent.click(screen.getByRole("button", { name: "بستن فرم" }));
  expect(close).toHaveBeenCalledOnce();
});

it("never exposes rows from a preceding filter while a new request is pending", async () => {
  let finish: ((data: unknown) => void) | undefined;
  request.mockImplementation((path: string) => path === "/first" ? Promise.resolve({ data: ["first"], meta: { page: 1 } }) : new Promise((resolve) => { finish = resolve; }));
  function List({ path }: { path: string }) { const result = usePaged<string>(path); return <div>{result.data?.data.join(",") ?? "loading"}</div>; }
  const view = render(<List path="/first" />);
  await screen.findByText("first");
  view.rerender(<List path="/second" />);
  expect(screen.queryByText("first")).toBeNull();
  await waitFor(() => expect(finish).toBeDefined());
  await act(async () => finish?.({ data: ["second"], meta: { page: 1 } }));
  expect(screen.getByText("second")).toBeTruthy();
});

it("tracks editor toolbars and confirms explicit draft replacement while leaving selector changes clean", async () => {
  const replace = vi.fn();
  function Editor() { useDraftProtection(); return <><form className="manage-toolbar" data-draft-editor><label>مقدار<input /></label><label>کلید<select data-draft-selector><option>A</option><option>B</option></select></label></form><button type="button" data-draft-exit onClick={replace}>مورد تازه</button></>; }
  render(<Editor />);
  fireEvent.change(screen.getByLabelText("کلید"), { target: { value: "B" } });
  expect(hasUnsavedDrafts()).toBe(false);
  fireEvent.change(screen.getByLabelText("مقدار"), { target: { value: "۲۰" } });
  expect(hasUnsavedDrafts()).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "مورد تازه" }));
  expect(replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "کنار گذاشتن تغییرها" }));
  await waitFor(() => expect(replace).toHaveBeenCalledOnce());
  expect(hasUnsavedDrafts()).toBe(false);
});

it("clears only the replaced editor while preserving a separate edited creation region", async () => {
  const replace = vi.fn();
  function Editors() { useDraftProtection(); return <><section id="create-editor" data-draft-region><form><label>ساخت<input /></label></form></section><section id="detail-editor" data-draft-region><form><label>ویرایش<input /></label></form></section><button type="button" data-draft-exit data-draft-target="detail-editor" onClick={replace}>تعویض پرونده</button></>; }
  render(<Editors />);
  fireEvent.change(screen.getByLabelText("ساخت"), { target: { value: "new draft" } });
  fireEvent.click(screen.getByRole("button", { name: "تعویض پرونده" }));
  expect(replace).toHaveBeenCalledOnce();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.change(screen.getByLabelText("ویرایش"), { target: { value: "edited draft" } });
  fireEvent.click(screen.getByRole("button", { name: "تعویض پرونده" }));
  fireEvent.click(screen.getByRole("button", { name: "کنار گذاشتن تغییرها" }));
  await waitFor(() => expect(replace).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("ویرایش").closest("form")!.dataset.dirty).toBeUndefined();
  expect(screen.getByLabelText("ساخت").closest("form")!.dataset.dirty).toBe("true");
  expect(hasUnsavedDrafts()).toBe(true);
});
