import { useId, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
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

type Payment = {
  id: number;
  amount: number;
  gateway: string;
  gatewayRef: string | null;
  status: "INITIATED" | "SUCCESS" | "FAILED";
  paidAt: string | null;
  createdAt: string;
  order: { id: number; orderNumber: string; status: string; userId: number };
};
type PaymentDetail = Payment & {
  order: Payment["order"] & {
    user: { phone: string; firstName: string | null; lastName: string | null };
    items: { productName: string; quantity: number; total: number }[];
  };
};
type Audit = {
  id: number;
  adminId: number;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string | null;
  ip: string | null;
  createdAt: string;
};
type SettingKey =
  "SHIPPING_FLAT_COST" | "FREE_SHIPPING_THRESHOLD" | "ORDER_EXPIRE_MINUTES";
type Setting = {
  key: SettingKey;
  value: string;
  updatedAt: string;
  overridable: boolean;
};
const settingLabels: Record<SettingKey, string> = {
  SHIPPING_FLAT_COST: "هزینهٔ ثابت ارسال (تومان)",
  FREE_SHIPPING_THRESHOLD: "آستانهٔ ارسال رایگان (تومان)",
  ORDER_EXPIRE_MINUTES: "انقضای سفارش (دقیقه)",
};
const settingKeys = Object.keys(settingLabels) as SettingKey[];
const operationTabs = ["payments", "audit", "settings"] as const;
type OperationTab = (typeof operationTabs)[number];
const operationTabLabels: Record<OperationTab, string> = {
  payments: "پرداخت‌ها",
  audit: "لاگ عملیات",
  settings: "تنظیمات",
};

function Payments() {
  const { request } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const path = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) q.set("status", status);
    return `/admin/payments?${q}`;
  }, [page, status]);
  const list = usePaged<Payment>(path, revision);
  const detail = useDetail<PaymentDetail>(
    selected ? `/admin/payments/${selected}` : null,
    revision,
  );
  async function markFailed() {
    if (
      !selected ||
      !window.confirm(
        "این پرداخت ناموفق ثبت شود؟ این کار وضعیت سفارش را تغییر نمی‌دهد.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(`/admin/payments/${selected}/mark-failed`, {
        method: "POST",
      });
      setRevision((value) => value + 1);
      setMessage("پرداخت ناموفق ثبت شد.");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="manage-card">
        <h2>پرداخت‌ها</h2>
        <div className="manage-toolbar">
          <label>
            وضعیت
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">همه</option>
              <option value="INITIATED">آغازشده</option>
              <option value="SUCCESS">موفق</option>
              <option value="FAILED">ناموفق</option>
            </select>
          </label>
        </div>
        <QueryState
          loading={list.loading}
          error={list.error}
          empty={!list.loading && list.data?.data.length === 0}
          onRetry={() => setRevision((value) => value + 1)}
        />
        {list.data && list.data.data.length > 0 && (
          <>
            <div className="manage-table-wrap">
              <table className="manage-table">
                <thead>
                  <tr>
                    <th>شناسه</th>
                    <th>سفارش</th>
                    <th>مبلغ</th>
                    <th>درگاه</th>
                    <th>وضعیت</th>
                    <th>زمان</th>
                    <th>جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.data.map((item) => (
                    <tr key={item.id}>
                      <td>{formatNumber(item.id)}</td>
                      <td dir="ltr">{item.order.orderNumber}</td>
                      <td>{formatMoney(item.amount)}</td>
                      <td>{item.gateway}</td>
                      <td>{item.status}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="manage-row-button"
                          onClick={() => setSelected(item.id)}
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
      {selected && (
        <section className="manage-card">
          <div className="manage-actions">
            <button type="button" onClick={() => setSelected(null)}>
              بستن جزئیات
            </button>
          </div>
          <QueryState
            loading={detail.loading}
            error={detail.error}
            onRetry={() => setRevision((value) => value + 1)}
          />
          {detail.data && (
            <>
              <h2>پرداخت {formatNumber(detail.data.id)}</h2>
              <dl className="manage-facts">
                <div>
                  <dt>سفارش</dt>
                  <dd dir="ltr">{detail.data.order.orderNumber}</dd>
                </div>
                <div>
                  <dt>مبلغ</dt>
                  <dd>{formatMoney(detail.data.amount)}</dd>
                </div>
                <div>
                  <dt>مشتری</dt>
                  <dd dir="ltr">{detail.data.order.user.phone}</dd>
                </div>
                <div>
                  <dt>وضعیت سفارش</dt>
                  <dd>{detail.data.order.status}</dd>
                </div>
                <div>
                  <dt>درگاه</dt>
                  <dd>{detail.data.gateway}</dd>
                </div>
                <div>
                  <dt>ارجاع درگاه</dt>
                  <dd dir="ltr">{detail.data.gatewayRef || "—"}</dd>
                </div>
                <div>
                  <dt>پرداخت‌شده در</dt>
                  <dd>{formatDate(detail.data.paidAt)}</dd>
                </div>
              </dl>
              <Notice message={error} />
              <Notice message={message} kind="success" />
              <div className="manage-actions">
                <button
                  type="button"
                  disabled={busy || detail.data.status === "SUCCESS"}
                  onClick={() => void markFailed()}
                >
                  ثبت ناموفق
                </button>
              </div>
              <Notice
                kind="info"
                message="تطبیق دوبارهٔ پرداخت با درگاه تا رفع خطر تغییر وضعیت سفارش لغوشده در بک‌اند غیرفعال است؛ گزارش فنی در .issue/02 ثبت شده است."
              />
            </>
          )}
        </section>
      )}
    </>
  );
}

function AuditLogs() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [revision, setRevision] = useState(0);
  const path = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), limit: "20" });
    if (entity) q.set("entity", entity);
    if (action) q.set("action", action);
    return `/admin/audit-logs?${q}`;
  }, [page, entity, action]);
  const logs = usePaged<Audit>(path, revision);
  return (
    <section className="manage-card">
      <h2>لاگ عملیات مدیران</h2>
      <div className="manage-toolbar">
        <label>
          بخش
          <input
            value={entity}
            onChange={(event) => {
              setEntity(event.target.value);
              setPage(1);
            }}
            placeholder="مثلاً Order"
          />
        </label>
        <label>
          نوع عمل
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
          >
            <option value="">همه</option>
            <option value="CREATE">ایجاد</option>
            <option value="UPDATE">ویرایش</option>
            <option value="DELETE">حذف</option>
          </select>
        </label>
      </div>
      <QueryState
        loading={logs.loading}
        error={logs.error}
        empty={!logs.loading && logs.data?.data.length === 0}
        onRetry={() => setRevision((value) => value + 1)}
      />
      {logs.data && logs.data.data.length > 0 && (
        <>
          <div className="manage-table-wrap">
            <table className="manage-table">
              <thead>
                <tr>
                  <th>زمان</th>
                  <th>مدیر</th>
                  <th>عمل</th>
                  <th>بخش</th>
                  <th>شناسه</th>
                  <th>شرح</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.data.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>{formatNumber(item.adminId)}</td>
                    <td>{item.action}</td>
                    <td>{item.entity}</td>
                    <td dir="ltr">{item.entityId || "—"}</td>
                    <td>{item.summary || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginator meta={logs.data.meta} onPage={setPage} />
        </>
      )}
    </section>
  );
}

function Settings() {
  const { request } = useAuth();
  const [revision, setRevision] = useState(0);
  const [key, setKey] = useState<SettingKey>("SHIPPING_FLAT_COST");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const settings = usePaged<Setting>("/admin/settings", revision);
  const current = settings.data?.data.find((item) => item.key === key);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const trimmed = value.trim();
    const n = Number(trimmed);
    if (
      !/^\d+$/.test(trimmed) ||
      !Number.isSafeInteger(n) ||
      (key === "ORDER_EXPIRE_MINUTES" ? n < 1 : n < 0)
    ) {
      setError("مقدار باید عدد صحیح و معتبر باشد.");
      return;
    }
    if (
      !window.confirm(`${settingLabels[key]} به ${formatNumber(n)} تغییر کند؟`)
    )
      return;
    setBusy(true);
    try {
      await request("/admin/settings", {
        method: "PUT",
        body: { key, value: trimmed },
      });
      setRevision((x) => x + 1);
      setValue("");
      setMessage("تنظیمات ذخیره شد؛ اعمال آن ممکن است تا ۳۰ ثانیه زمان ببرد.");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }
  async function clear() {
    if (
      !current ||
      !window.confirm(
        `مقدار ${settingLabels[key]} حذف شود تا مقدار پیش‌فرض محیط اعمال شود؟`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(`/admin/settings/${key}`, { method: "DELETE" });
      setRevision((x) => x + 1);
      setMessage("مقدار سفارشی حذف شد؛ پیش‌فرض محیط اعمال می‌شود.");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="manage-card">
      <h2>تنظیمات فروشگاه</h2>
      <p>
        فقط مقدارهای ثبت‌شده در پایگاه داده نمایش داده می‌شوند؛ خالی بودن به
        معنی استفاده از مقدار محیط است.
      </p>
      <QueryState
        loading={settings.loading}
        error={settings.error}
        empty={false}
        onRetry={() => setRevision((value) => value + 1)}
      />
      {settings.data && (
        <>
          <dl className="manage-facts">
            {settingKeys.map((item) => {
              const found = settings.data?.data.find((row) => row.key === item);
              return (
                <div key={item}>
                  <dt>{settingLabels[item]}</dt>
                  <dd>
                    {found
                      ? `${found.value} · ${formatDate(found.updatedAt)}`
                      : "پیش‌فرض محیط"}
                  </dd>
                </div>
              );
            })}
          </dl>
          <form
            className="manage-toolbar"
            onSubmit={(event) => void submit(event)}
          >
            <label>
              کلید
              <select
                value={key}
                onChange={(event) => {
                  setKey(event.target.value as SettingKey);
                  setValue("");
                }}
              >
                {settingKeys.map((item) => (
                  <option key={item} value={item}>
                    {settingLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              مقدار جدید
              <input
                inputMode="numeric"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={current?.value || "عدد صحیح"}
              />
            </label>
            <button type="submit" className="manage-primary" disabled={busy}>
              ذخیره
            </button>
            <button
              type="button"
              disabled={busy || !current}
              onClick={() => void clear()}
            >
              بازگشت به پیش‌فرض
            </button>
          </form>
          <Notice message={error} />
          <Notice message={message} kind="success" />
        </>
      )}
    </section>
  );
}

export function Operations({
  initialTab = "payments",
}: {
  initialTab?: OperationTab;
}) {
  const [tab, setTab] = useState<OperationTab>(initialTab);
  const instanceId = useId();
  const tabId = (item: OperationTab) => `${instanceId}-${item}-tab`;
  const panelId = (item: OperationTab) => `${instanceId}-${item}-panel`;

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: OperationTab) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const index = operationTabs.indexOf(current);
    let nextIndex: number;
    switch (event.key) {
      case "ArrowLeft":
        nextIndex = (index + 1) % operationTabs.length;
        break;
      case "ArrowRight":
        nextIndex = (index - 1 + operationTabs.length) % operationTabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = operationTabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = operationTabs[nextIndex] ?? current;
    setTab(next);
    event.currentTarget.ownerDocument.getElementById(tabId(next))?.focus();
  }

  return (
    <div className="manage-page">
      <PageHeader
        eyebrow="نظارت و تنظیم"
        title="عملیات"
        description="پرداخت‌ها، رخدادهای مدیریتی و تنظیمات عملیاتی فروشگاه را پیگیری کنید."
      />
      <div className="manage-tabs" role="tablist" aria-label="بخش‌های عملیات" dir="rtl">
        {operationTabs.map((item) => (
          <button
            key={item}
            id={tabId(item)}
            type="button"
            role="tab"
            aria-selected={tab === item}
            aria-controls={panelId(item)}
            tabIndex={tab === item ? 0 : -1}
            onKeyDown={(event) => onTabKeyDown(event, item)}
            onClick={() => setTab(item)}
          >
            {operationTabLabels[item]}
          </button>
        ))}
      </div>
      {operationTabs.map((item) => (
        <div
          key={item}
          id={panelId(item)}
          role="tabpanel"
          aria-labelledby={tabId(item)}
          tabIndex={tab === item ? 0 : -1}
          hidden={tab !== item}
        >
          {tab === item && (
            item === "payments" ? <Payments /> : item === "audit" ? <AuditLogs /> : <Settings />
          )}
        </div>
      ))}
    </div>
  );
}
