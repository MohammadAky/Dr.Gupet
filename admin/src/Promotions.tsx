import { TomanInput } from './TomanInput';
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import {
  confirmAction, discardDrafts, markFormSaved, normalizeDigits, showFieldErrors,
  errorMessage,
  formatDate,
  formatMoney,
  formatNumber,
  Notice,
  PageHeader,
  Paginator,
  QueryState,
  useInlinePanelFocus,
  useDetail,
  usePaged,
} from "./management";
import "./management.css";
import { JalaliDateInput } from "./JalaliDateInput";

type Coupon = {
  id: number;
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minOrderAmount: number | null;
  maxDiscount: number | null;
  startAt: string | null;
  endAt: string | null;
  totalLimit: number | null;
  perUserLimit: number | null;
  isActive: boolean;
  _count: { redemptions: number; orders: number };
};
type CouponDetail = Coupon & {
  redemptions: {
    id: number;
    amount: number;
    createdAt: string;
    user: { phone: string };
    order: { orderNumber: string };
  }[];
};
type Draft = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: string;
  minOrderAmount: string;
  maxDiscount: string;
  startAt: string;
  endAt: string;
  totalLimit: string;
  perUserLimit: string;
  isActive: boolean;
};
const blank: Draft = {
  code: "",
  type: "PERCENT",
  value: "",
  minOrderAmount: "",
  maxDiscount: "",
  startAt: "",
  endAt: "",
  totalLimit: "",
  perUserLimit: "",
  isActive: true,
};
const toDraft = (item: Coupon): Draft => ({
  code: item.code,
  type: item.type,
  value: String(item.value),
  minOrderAmount:
    item.minOrderAmount == null ? "" : String(item.minOrderAmount),
  maxDiscount: item.maxDiscount == null ? "" : String(item.maxDiscount),
  startAt: item.startAt ?? "",
  endAt: item.endAt ?? "",
  totalLimit: item.totalLimit == null ? "" : String(item.totalLimit),
  perUserLimit: item.perUserLimit == null ? "" : String(item.perUserLimit),
  isActive: item.isActive,
});
const parseInteger = (value: string, min: number): number | null | undefined =>
  value.trim() === ""
    ? null
    : /^\d+$/.test(normalizeDigits(value.trim())) &&
        Number.isSafeInteger(Number(normalizeDigits(value))) &&
        Number(normalizeDigits(value)) >= min
      ? Number(normalizeDigits(value))
      : undefined;

export function Promotions() {
  const editorGeneration = useRef(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; editorGeneration.current += 1; }; }, []);
  const { request } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [active, setActive] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const { panelRef: editorPanelRef, reveal: revealEditor, restore: restoreEditor } = useInlinePanelFocus();
  const [draft, setDraft] = useState<Draft>(blank);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const path = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), limit: "20" });
    if (applied) q.set("search", applied);
    if (active) q.set("isActive", active);
    return `/admin/coupons?${q}`;
  }, [page, applied, active]);
  const list = usePaged<Coupon>(path, revision);
  const detail = useDetail<CouponDetail>(
    selected ? `/admin/coupons/${selected}` : null,
    revision,
  );
  useEffect(() => {
    let current = true;
    if (detail.data && !creating)
      queueMicrotask(() => {
        if (current && detail.data) setDraft(toDraft(detail.data));
      });
    return () => { current = false; };
  }, [detail.data, creating]);
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function showCreate() {
    editorGeneration.current += 1;
    setSelected(null);
    setCreating(true);
    setDraft(blank);
    setError("");
    setMessage("");
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied(search.trim());
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = event.currentTarget;
    const generation = editorGeneration.current;
    setError("");
    setMessage("");
    const value = parseInteger(draft.value, 1);
    const minOrderAmount = parseInteger(draft.minOrderAmount, 0);
    const maxDiscount = parseInteger(draft.maxDiscount, 0);
    const totalLimit = parseInteger(draft.totalLimit, 1);
    const perUserLimit = parseInteger(draft.perUserLimit, 1);
    const fieldErrors: Record<string, string> = {};
    if (draft.code.trim().length < 2) fieldErrors.code = "کد باید دست‌کم دو نویسه داشته باشد.";
    if (value == null) fieldErrors.value = "مقدار باید عدد صحیح بزرگ‌تر از صفر باشد.";
    for (const [key, parsed] of Object.entries({ minOrderAmount, maxDiscount, totalLimit, perUserLimit })) {
      if (parsed === undefined) fieldErrors[key] = "عدد صحیح معتبر وارد کنید.";
    }
    if (draft.type === "PERCENT" && value != null && value > 100) fieldErrors.value = "درصد تخفیف بیش از ۱۰۰ مجاز نیست.";
    showFieldErrors(form, fieldErrors);
    if (Object.keys(fieldErrors).length) { setError("فیلدهای مشخص‌شده را اصلاح کنید."); return; }
    if (
      !draft.code.trim() ||
      draft.code.trim().length < 2 ||
      value == null ||
      [minOrderAmount, maxDiscount, totalLimit, perUserLimit].includes(
        undefined,
      )
    ) {
      setError("کد و مقدار معتبر و عددهای صحیح وارد کنید.");
      return;
    }
    if (draft.type === "PERCENT" && value > 100) {
      setError("درصد تخفیف بیش از ۱۰۰ مجاز نیست.");
      return;
    }
    if ([draft.startAt, draft.endAt].some((date) => date && Number.isNaN(Date.parse(date)))) {
      setError("تاریخ و ساعت معتبر وارد کنید.");
      return;
    }
    const startAt = draft.startAt || null;
    const endAt = draft.endAt || null;
    if (startAt && endAt && startAt > endAt) {
      showFieldErrors(form, { endAt: "پایان بازه باید پس از شروع باشد." });
      setError("پایان بازه باید پس از شروع باشد.");
      return;
    }
    const body = {
      type: draft.type,
      value,
      minOrderAmount,
      maxDiscount,
      startAt,
      endAt,
      totalLimit,
      perUserLimit,
      isActive: draft.isActive,
      ...(creating ? { code: draft.code.trim().toUpperCase() } : {}),
    };
    pending.current = true; setBusy(true);
    try {
      const result = await request<Coupon>(
        creating ? "/admin/coupons" : `/admin/coupons/${selected}`,
        { method: creating ? "POST" : "PATCH", body },
      );
      if (!mounted.current) return;
      markFormSaved(form);
      setRevision((current) => current + 1);
      if (generation !== editorGeneration.current) return;
      setCreating(false);
      setSelected(result.id);
      setMessage("کد تخفیف ثبت شد.");
    } catch (problem) {
      if (mounted.current && generation === editorGeneration.current) setError(errorMessage(problem));
    } finally {
      pending.current = false; if (mounted.current) setBusy(false);
    }
  }
  async function remove() {
    if (!selected || pending.current) return;
    const id = selected;
    const generation = editorGeneration.current;
    pending.current = true;
    try {
      if (!await confirmAction(`کد ${detail.data?.code ?? id} حذف می‌شود؛ اگر استفاده شده باشد، فقط غیرفعال خواهد شد.`, "حذف کد تخفیف")) return;
      if (!mounted.current || generation !== editorGeneration.current) return;
      setBusy(true); setError(""); setMessage("");
      await request(`/admin/coupons/${id}`, { method: "DELETE" });
      if (!mounted.current) return;
      setRevision((current) => current + 1);
      if (generation !== editorGeneration.current) return;
      setSelected(null);
      restoreEditor();
      setMessage("کد تخفیف حذف یا غیرفعال شد.");
    } catch (problem) {
      if (mounted.current && generation === editorGeneration.current) setError(errorMessage(problem));
    } finally {
      pending.current = false; if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="manage-page">
      <PageHeader
        eyebrow="بازاریابی"
        title="کدهای تخفیف"
        description="قواعد تخفیف را پیش از انتشار بررسی کنید؛ مبالغ به تومان هستند."
        action={
          <button type="button" className="manage-primary" data-draft-exit disabled={busy} onClick={(event) => { showCreate(); revealEditor(event.currentTarget); }}>
            + کد جدید
          </button>
        }
      />
      <section className="manage-card" aria-label="فهرست تخفیف‌ها">
        <form className="manage-toolbar" onSubmit={apply}>
          <label>
            کد
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی کد"
            />
          </label>
          <label>
            وضعیت
            <select
              value={active}
              onChange={(event) => {
                setActive(event.target.value);
                setPage(1);
              }}
            >
              <option value="">همه</option>
              <option value="true">فعال</option>
              <option value="false">غیرفعال</option>
            </select>
          </label>
          <button type="submit" className="manage-primary">
            جستجو
          </button>
        </form>
        <QueryState
          loading={list.loading}
          error={list.error}
          empty={!list.loading && list.data?.data.length === 0}
          onRetry={() => setRevision((current) => current + 1)}
        />
        {list.data && list.data.data.length > 0 && (
          <>
            <div className="manage-table-wrap">
              <table className="manage-table manage-table--coupons">
                <thead>
                  <tr>
                    <th>کد</th>
                    <th>نوع</th>
                    <th>مقدار</th>
                    <th>استفاده</th>
                    <th>وضعیت</th>
                    <th>جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.data.map((item) => (
                    <tr key={item.id}>
                      <td dir="ltr">{item.code}</td>
                      <td>{item.type === "PERCENT" ? "درصدی" : "مبلغ ثابت"}</td>
                      <td>
                        {item.type === "PERCENT"
                          ? `${formatNumber(item.value)}٪`
                          : formatMoney(item.value)}
                      </td>
                      <td>{formatNumber(item._count.redemptions)}</td>
                      <td>{item.isActive ? "فعال" : "غیرفعال"}</td>
                      <td>
                        <button
                          className="manage-row-button"
                          type="button"
                          onClick={(event) => {
                            editorGeneration.current += 1;
                            revealEditor(event.currentTarget);
                            setSelected(item.id);
                            setCreating(false);
                            setError("");
                            setMessage("");
                          }}
                        >
                          بررسی
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator meta={list.data.meta} onPage={setPage} />
          </>
        )}
      </section>
      {(selected || creating) && (
        <section
          ref={editorPanelRef}
          tabIndex={-1}
          className="manage-card"
          aria-label={creating ? "ساخت کد تخفیف" : "جزئیات کد تخفیف"}
        >
          <div className="manage-actions">
            <button
              type="button"
              onClick={async (event) => {
                if (!pending.current && !await discardDrafts(event.currentTarget.closest("section"))) return;
                editorGeneration.current += 1;
                setSelected(null);
                setCreating(false);
                restoreEditor();
              }}
            >
              بستن فرم
            </button>
          </div>
          {!creating && (
            <QueryState
              loading={detail.loading}
              error={detail.error}
              onRetry={() => setRevision((current) => current + 1)}
            />
          )}
          {(creating || detail.data) && (
            <>
              <h2>
                {creating
                  ? "کد تخفیف تازه"
                  : `ویرایش ${detail.data?.code || ""}`}
              </h2>
              <Notice message={error} />
              <Notice message={message} kind="success" />
              <form onSubmit={(event) => void save(event)} noValidate>
                <fieldset className="manage-fieldset" disabled={busy}>
                <div className="manage-form">
                  <label>
                    کد
                    <input
                      required
                      name="code"
                      minLength={2}
                      maxLength={50}
                      dir="ltr"
                      value={draft.code}
                      disabled={!creating}
                      onChange={(event) => set("code", event.target.value)}
                    />
                  </label>
                  <label>
                    نوع
                    <select
                      value={draft.type}
                      onChange={(event) =>
                        set("type", event.target.value as Draft["type"])
                      }
                    >
                      <option value="PERCENT">درصدی</option>
                      <option value="FIXED">مبلغ ثابت</option>
                    </select>
                  </label>
                  <label>
                    مقدار {draft.type === "PERCENT" ? "(درصد)" : "(تومان)"}
                    {draft.type === "FIXED" ? (
                      <TomanInput required name="value" value={draft.value} onValueChange={(value) => set("value", value)} />
                    ) : (
<input
                      required
                      inputMode="numeric"
                      name="value"
                      value={draft.value}
                      onChange={(event) => set("value", event.target.value)}
                    />
                    )}
                  </label>
                  <label>
                    حداقل سفارش (تومان)
                    <TomanInput

                      value={draft.minOrderAmount}
                      name="minOrderAmount"
                      onValueChange={(value) =>
                        set("minOrderAmount", value)
                      }
                    />
                  </label>
                  <label>
                    سقف تخفیف (تومان)
                    <TomanInput

                      value={draft.maxDiscount}
                      name="maxDiscount"
                      onValueChange={(value) =>
                        set("maxDiscount", value)
                      }
                    />
                  </label>
                  <label>
                    سقف استفادهٔ کل
                    <input
                      inputMode="numeric"
                      value={draft.totalLimit}
                      name="totalLimit"
                      onChange={(event) =>
                        set("totalLimit", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    سقف هر کاربر
                    <input
                      inputMode="numeric"
                      value={draft.perUserLimit}
                      name="perUserLimit"
                      onChange={(event) =>
                        set("perUserLimit", event.target.value)
                      }
                    />
                  </label>
                  <div>
                    <label htmlFor="startAt">شروع</label>
                    <JalaliDateInput id="startAt" name="startAt" value={draft.startAt} withTime disabled={busy} onChange={(value) => set("startAt", value)} />
                  </div>
                  <div>
                    <label htmlFor="endAt">پایان</label>
                    <JalaliDateInput id="endAt" name="endAt" value={draft.endAt} withTime disabled={busy} onChange={(value) => set("endAt", value)} />
                  </div>
                  <p className="credential-hint manage-full">تقویم شمسی؛ ساعت بر اساس منطقهٔ زمانی تهران است.</p>
                  <label>
                    فعال
                    <select
                      value={String(draft.isActive)}
                      onChange={(event) =>
                        set("isActive", event.target.value === "true")
                      }
                    >
                      <option value="true">بله</option>
                      <option value="false">خیر</option>
                    </select>
                  </label>
                </div>
                <div className="manage-actions">
                  <button
                    type="submit"
                    className="manage-primary"
                    disabled={busy}
                  >
                    {busy ? "در حال ثبت…" : "ذخیرهٔ کد تخفیف"}
                  </button>
                  {!creating && (
                    <button
                      type="button"
                      className="manage-danger"
                      disabled={busy}
                      onClick={() => void remove()}
                    >
                      حذف / غیرفعال‌سازی
                    </button>
                  )}
                </div>
                </fieldset>
              </form>
              {detail.data && !creating && (
                <>
                  <dl className="manage-facts">
                    <div>
                      <dt>آغاز</dt>
                      <dd>{formatDate(detail.data.startAt)}</dd>
                    </div>
                    <div>
                      <dt>پایان</dt>
                      <dd>{formatDate(detail.data.endAt)}</dd>
                    </div>
                  </dl>
                  <h2>استفاده‌های اخیر</h2>
                  <ul className="manage-sublist">
                    {detail.data.redemptions.map((use) => (
                      <li key={use.id}>
                        <span dir="ltr">{use.order.orderNumber}</span> ·{" "}
                        {use.user.phone} · {formatMoney(use.amount)} ·{" "}
                        {formatDate(use.createdAt)}
                      </li>
                    ))}
                  </ul>
                  {detail.data.redemptions.length === 0 && (
                    <p>هنوز استفاده نشده است.</p>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}
      {!selected && !creating && <Notice message={message} kind="success" />}
    </div>
  );
}
