import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import {
  errorMessage,
  formatDate,
  formatMoney,
  formatNumber,
  Notice,
  PageHeader,
  Paginator,
  QueryState,
  useDetail,
  usePaged,
} from "./management";
import "./management.css";

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
const localDate = (value: string | null) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString().slice(0, 16)
    : "";
const toDraft = (item: Coupon): Draft => ({
  code: item.code,
  type: item.type,
  value: String(item.value),
  minOrderAmount:
    item.minOrderAmount == null ? "" : String(item.minOrderAmount),
  maxDiscount: item.maxDiscount == null ? "" : String(item.maxDiscount),
  startAt: localDate(item.startAt),
  endAt: localDate(item.endAt),
  totalLimit: item.totalLimit == null ? "" : String(item.totalLimit),
  perUserLimit: item.perUserLimit == null ? "" : String(item.perUserLimit),
  isActive: item.isActive,
});
const parseInteger = (value: string, min: number): number | null | undefined =>
  value.trim() === ""
    ? null
    : /^\d+$/.test(value.trim()) &&
        Number.isSafeInteger(Number(value)) &&
        Number(value) >= min
      ? Number(value)
      : undefined;

export function Promotions() {
  const { request } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [active, setActive] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
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
    if (detail.data && !creating)
      queueMicrotask(() => {
        if (detail.data) setDraft(toDraft(detail.data));
      });
  }, [detail.data, creating]);
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function showCreate() {
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
    setError("");
    setMessage("");
    const value = parseInteger(draft.value, 1);
    const minOrderAmount = parseInteger(draft.minOrderAmount, 0);
    const maxDiscount = parseInteger(draft.maxDiscount, 0);
    const totalLimit = parseInteger(draft.totalLimit, 1);
    const perUserLimit = parseInteger(draft.perUserLimit, 1);
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
    const startAt = draft.startAt
      ? new Date(draft.startAt).toISOString()
      : null;
    const endAt = draft.endAt ? new Date(draft.endAt).toISOString() : null;
    if (startAt && endAt && startAt > endAt) {
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
    setBusy(true);
    try {
      const result = await request<Coupon>(
        creating ? "/admin/coupons" : `/admin/coupons/${selected}`,
        { method: creating ? "POST" : "PATCH", body },
      );
      setCreating(false);
      setSelected(result.id);
      setRevision((current) => current + 1);
      setMessage("کد تخفیف ثبت شد.");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !selected ||
      !window.confirm("این کد تخفیف حذف یا در صورت استفاده، غیرفعال شود؟")
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(`/admin/coupons/${selected}`, { method: "DELETE" });
      setSelected(null);
      setRevision((current) => current + 1);
      setMessage("کد تخفیف حذف یا غیرفعال شد.");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="manage-page">
      <PageHeader
        eyebrow="بازاریابی"
        title="کدهای تخفیف"
        description="قواعد تخفیف را پیش از انتشار بررسی کنید؛ مبالغ به تومان هستند."
        action={
          <button type="button" className="manage-primary" onClick={showCreate}>
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
              <table className="manage-table">
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
                          onClick={() => {
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
          className="manage-card"
          aria-label={creating ? "ساخت کد تخفیف" : "جزئیات کد تخفیف"}
        >
          <div className="manage-actions">
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setCreating(false);
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
              <form onSubmit={(event) => void save(event)}>
                <div className="manage-form">
                  <label>
                    کد
                    <input
                      required
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
                    <input
                      required
                      inputMode="numeric"
                      value={draft.value}
                      onChange={(event) => set("value", event.target.value)}
                    />
                  </label>
                  <label>
                    حداقل سفارش (تومان)
                    <input
                      inputMode="numeric"
                      value={draft.minOrderAmount}
                      onChange={(event) =>
                        set("minOrderAmount", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    سقف تخفیف (تومان)
                    <input
                      inputMode="numeric"
                      value={draft.maxDiscount}
                      onChange={(event) =>
                        set("maxDiscount", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    سقف استفادهٔ کل
                    <input
                      inputMode="numeric"
                      value={draft.totalLimit}
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
                      onChange={(event) =>
                        set("perUserLimit", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    شروع
                    <input
                      type="datetime-local"
                      value={draft.startAt}
                      onChange={(event) => set("startAt", event.target.value)}
                    />
                  </label>
                  <label>
                    پایان
                    <input
                      type="datetime-local"
                      value={draft.endAt}
                      onChange={(event) => set("endAt", event.target.value)}
                    />
                  </label>
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
