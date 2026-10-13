import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import {
  confirmAction, discardDrafts, markFormSaved,
  errorMessage,
  formatDate,
  formatMoney,
  formatNumber,
  gatewayLabel,
  paymentStatusLabel,
  Notice,
  PageHeader,
  Paginator,
  QueryState,
  useInlinePanelFocus,
  useDetail,
  usePaged,
} from "./management";
import { parseAdminLocation } from "./navigation";
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
  const pending = useRef(false);
  const mounted = useRef(true);
  const selectionVersion = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selectionVersion.current += 1; }; }, []);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState(() => parseAdminLocation(window.location.hash).params.get("status") ?? "");
  const [selected, setSelected] = useState<number | null>(() => Number(parseAdminLocation(window.location.hash).params.get("order")) || null);
  const { panelRef: detailPanelRef, reveal: revealDetail, restore: restoreDetail } = useInlinePanelFocus();
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
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      setTrackingCode(detail.data?.trackingCode || "");
      setShippingMethod(detail.data?.shippingMethod || "");
      setNote("");
      setRefundNote("");
    });
    return () => { current = false; };
  }, [detail.data]);

  async function mutate(
    path: string,
    method: "PATCH" | "POST",
    body: unknown,
    success: string,
    confirmation?: string,
  ) {
    if (pending.current) return;
    pending.current = true;
    const version = selectionVersion.current;
    const draftOwners = typeof body === "object" && body ? Object.keys(body).flatMap((key) => {
      const inputName = key === "reason" ? "note" : key;
      const owner = document.querySelector(`[name="${inputName}"]`)?.closest<HTMLElement>("[data-dirty='true']");
      return owner ? [owner] : [];
    }) : [];
    try {
      if (confirmation && !await confirmAction(confirmation, "تأیید عملیات سفارش")) return;
      if (!mounted.current || version !== selectionVersion.current) return;
      setBusy(true); setError(""); setMessage("");
      await request(path, { method, body });
      if (!mounted.current) return;
      draftOwners.forEach(markFormSaved);
      setRevision((value) => value + 1);
      if (version === selectionVersion.current) setMessage(success);
    } catch (problem) {
      if (mounted.current && version === selectionVersion.current) setError(errorMessage(problem));
    } finally {
      pending.current = false; if (mounted.current) setBusy(false);
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
              <table className="manage-table manage-table--orders">
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
                          onClick={(event) => {
                            revealDetail(event.currentTarget);
                            setSelected(item.id);
                            selectionVersion.current += 1; setError(""); setMessage("");
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
        <section ref={detailPanelRef} tabIndex={-1} className="manage-card" aria-label="جزئیات سفارش">
          <div className="manage-actions">
            <button type="button" onClick={async (event) => { if (await discardDrafts(event.currentTarget.closest("section"))) { selectionVersion.current += 1; setSelected(null); restoreDetail(); } }}>
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
                  <dt>زمان ثبت</dt>
                  <dd>{formatDate(order.createdAt)}</dd>
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
                        {gatewayLabel(payment.gateway)} · {paymentStatusLabel(payment.status)} ·{" "}
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
                    name="note"
                    disabled={busy}
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
                        name="trackingCode"
                        disabled={busy}
                        onChange={(event) =>
                          setTrackingCode(event.target.value)
                        }
                      />
                    </label>
                    <label>
                      روش ارسال
                      <input
                        value={shippingMethod}
                        name="shippingMethod"
                        disabled={busy}
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
                        `سفارش ${order.orderNumber} لغو و موجودی آن آزاد شود؟`,
                      )
                    }
                  >
                    لغو سفارش
                  </button>
                  <label>
                    دلیل لغو
                    <input
                      value={note}
                      name="note"
                      disabled={busy}
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
                          name="refundNote"
                          disabled={busy}
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
                            `وجه سفارش ${order.orderNumber} خارج از سامانه مسترد شده و ثبت آن انجام شود؟`,
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
