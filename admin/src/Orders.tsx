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

type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED";
type Person = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
};
type OrderRow = {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  finalAmount: number;
  createdAt: string;
  trackingCode: string | null;
  refundedAt: string | null;
  user: Person;
  _count: { items: number; payments: number };
};
type OrderDetail = OrderRow & {
  items: {
    id: number;
    productName: string;
    weightGram: number;
    unitPrice: number;
    quantity: number;
    total: number;
  }[];
  payments: {
    id: number;
    status: string;
    gateway: string;
    amount: number;
    createdAt: string;
  }[];
  addressSnapshot: unknown;
  shippingMethod: string | null;
  note: string | null;
  refundNote: string | null;
  itemsTotal: number;
  discountAmount: number;
  shippingCost: number;
};
const labels: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت‌شده",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  CANCELED: "لغوشده",
};
const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  PAID: "PROCESSING",
  PROCESSING: "SHIPPED",
  SHIPPED: "DELIVERED",
};
const name = (person: Person) =>
  [person.firstName, person.lastName].filter(Boolean).join(" ") || person.phone;

export function Orders() {
  const { request } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [shippingMethod, setShippingMethod] = useState("");
  const [note, setNote] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const query = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), limit: "20" });
    if (applied) q.set("search", applied);
    if (status) q.set("status", status);
    return `/admin/orders?${q}`;
  }, [page, applied, status]);
  const list = usePaged<OrderRow>(query, revision);
  const detail = useDetail<OrderDetail>(
    selected ? `/admin/orders/${selected}` : null,
    revision,
  );
  useEffect(() => {
    queueMicrotask(() => {
      setTrackingCode(detail.data?.trackingCode || "");
      setShippingMethod(detail.data?.shippingMethod || "");
      setNote("");
      setRefundNote("");
    });
  }, [detail.data]);

  async function mutate(
    path: string,
    method: "PATCH" | "POST",
    body: unknown,
    success: string,
    confirmation?: string,
  ) {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(path, { method, body });
      setMessage(success);
      setRevision((value) => value + 1);
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      setBusy(false);
    }
  }
  function searchOrders(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied(search.trim());
  }
  const order = detail.data;
  const address =
    order?.addressSnapshot && typeof order.addressSnapshot === "object"
      ? (order.addressSnapshot as Record<string, unknown>)
      : null;
  return (
    <div className="manage-page">
      <PageHeader
        eyebrow="عملیات فروش"
        title="سفارش‌ها"
        description="سفارش‌ها را پیگیری کنید و هر تغییر وضعیت را با جزئیات همان سفارش ثبت کنید."
      />
      <section className="manage-card" aria-label="فهرست سفارش‌ها">
        <form className="manage-toolbar" onSubmit={searchOrders}>
          <label>
            شماره سفارش
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی شماره"
            />
          </label>
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
              {Object.entries(labels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button className="manage-primary" type="submit">
            جستجو
          </button>
        </form>
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
                    <th>شماره</th>
                    <th>مشتری</th>
                    <th>زمان</th>
                    <th>مبلغ</th>
                    <th>وضعیت</th>
                    <th>جزئیات</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.data.map((item) => (
                    <tr key={item.id}>
                      <td dir="ltr">{item.orderNumber}</td>
                      <td>{name(item.user)}</td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{formatMoney(item.finalAmount)}</td>
                      <td>{labels[item.status] ?? item.status}</td>
                      <td>
                        <button
                          className="manage-row-button"
                          type="button"
                          onClick={() => {
                            setSelected(item.id);
                            setMessage("");
                            setError("");
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
      {selected && (
        <section className="manage-card" aria-label="جزئیات سفارش">
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
          {order && (
            <>
              <h2>
                سفارش <span dir="ltr">{order.orderNumber}</span>
              </h2>
              <dl className="manage-facts">
                <div>
                  <dt>مشتری</dt>
                  <dd>
                    {name(order.user)} ·{" "}
                    <span dir="ltr">{order.user.phone}</span>
                  </dd>
                </div>
                <div>
                  <dt>وضعیت</dt>
                  <dd>{labels[order.status]}</dd>
                </div>
                <div>
                  <dt>جمع کالا</dt>
                  <dd>{formatMoney(order.itemsTotal)}</dd>
                </div>
                <div>
                  <dt>تخفیف / ارسال</dt>
                  <dd>
                    {formatMoney(order.discountAmount)} /{" "}
                    {formatMoney(order.shippingCost)}
                  </dd>
                </div>
                <div>
                  <dt>مبلغ قطعی</dt>
                  <dd>{formatMoney(order.finalAmount)}</dd>
                </div>
                <div>
                  <dt>نشانی</dt>
                  <dd>
                    {address
                      ? [address.province, address.city, address.fullAddress]
                          .filter((value) => typeof value === "string")
                          .join("، ")
                      : "ثبت نشده"}
                  </dd>
                </div>
                <div>
                  <dt>رهگیری</dt>
                  <dd>{order.trackingCode || "—"}</dd>
                </div>
                <div>
                  <dt>استرداد ثبت‌شده</dt>
                  <dd>{formatDate(order.refundedAt)}</dd>
                </div>
              </dl>
              <div className="manage-columns">
                <div>
                  <h2>اقلام ({formatNumber(order.items.length)})</h2>
                  <ul className="manage-sublist">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.productName} · {formatNumber(item.weightGram)} گرم
                        · {formatNumber(item.quantity)} عدد ·{" "}
                        {formatMoney(item.total)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h2>پرداخت‌ها</h2>
                  <ul className="manage-sublist">
                    {order.payments.map((payment) => (
                      <li key={payment.id}>
                        {payment.gateway} · {payment.status} ·{" "}
                        {formatMoney(payment.amount)} ·{" "}
                        {formatDate(payment.createdAt)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Notice message={error} />
              <Notice message={message} kind="success" />
              {nextStatus[order.status] && (
                <div className="manage-actions">
                  <button
                    className="manage-primary"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        `/admin/orders/${order.id}/transition`,
                        "PATCH",
                        {
                          to: nextStatus[order.status],
                          ...(order.status === "PROCESSING"
                            ? {
                                trackingCode: trackingCode.trim() || undefined,
                                shippingMethod:
                                  shippingMethod.trim() || undefined,
                              }
                            : {}),
                          ...(order.status === "PAID" && note.trim()
                            ? { note: note.trim() }
                            : {}),
                        },
                        `وضعیت به ${labels[nextStatus[order.status]!]} تغییر کرد.`,
                        `تغییر وضعیت این سفارش به ${labels[nextStatus[order.status]!]} ثبت شود؟`,
                      )
                    }
                  >
                    انتقال به {labels[nextStatus[order.status]!]}
                  </button>
                </div>
              )}
              {order.status === "PAID" && (
                <label className="manage-form">
                  یادداشت پردازش
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              )}
              {(["PAID", "PROCESSING", "SHIPPED"] as OrderStatus[]).includes(
                order.status,
              ) && (
                <div className="manage-card">
                  <h2>اطلاعات ارسال</h2>
                  <div className="manage-form">
                    <label>
                      کد رهگیری
                      <input
                        value={trackingCode}
                        onChange={(event) =>
                          setTrackingCode(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      روش ارسال
                      <input
                        value={shippingMethod}
                        onChange={(event) =>
                          setShippingMethod(event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="manage-actions">
                    <button
                      type="button"
                      disabled={busy || !trackingCode.trim()}
                      onClick={() =>
                        void mutate(
                          `/admin/orders/${order.id}/tracking`,
                          "PATCH",
                          {
                            trackingCode: trackingCode.trim(),
                            shippingMethod: shippingMethod.trim() || undefined,
                          },
                          "اطلاعات رهگیری ثبت شد.",
                        )
                      }
                    >
                      ثبت رهگیری
                    </button>
                  </div>
                </div>
              )}
              {order.status === "PENDING_PAYMENT" && (
                <div className="manage-actions">
                  <button
                    className="manage-danger"
                    disabled={busy}
                    type="button"
                    onClick={() =>
                      void mutate(
                        `/admin/orders/${order.id}/cancel`,
                        "POST",
                        { reason: note.trim() || undefined },
                        "سفارش لغو شد.",
                        "سفارش لغو و موجودی آن آزاد شود؟",
                      )
                    }
                  >
                    لغو سفارش
                  </button>
                  <label>
                    دلیل لغو
                    <input
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </label>
                </div>
              )}
              {order.payments.some((payment) => payment.status === "SUCCESS") &&
                !order.refundedAt && (
                  <div className="manage-card">
                    <h2>ثبت استرداد</h2>
                    <p>
                      این عمل فقط ثبت اداری است؛ انتقال وجه باید خارج از سامانه
                      انجام شده باشد.
                    </p>
                    <div className="manage-form">
                      <label className="manage-full">
                        شرح استرداد
                        <input
                          value={refundNote}
                          onChange={(event) =>
                            setRefundNote(event.target.value)
                          }
                        />
                      </label>
                    </div>
                    <div className="manage-actions">
                      <button
                        type="button"
                        className="manage-danger"
                        disabled={busy || !refundNote.trim()}
                        onClick={() =>
                          void mutate(
                            `/admin/orders/${order.id}/refund`,
                            "POST",
                            { refundNote: refundNote.trim() },
                            "استرداد در پرونده ثبت شد.",
                            "تأیید می‌کنید وجه خارج از سامانه مسترد شده و فقط ثبت آن انجام شود؟",
                          )
                        }
                      >
                        ثبت استرداد انجام‌شده
                      </button>
                    </div>
                  </div>
                )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
