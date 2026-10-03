import { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth";
import { periodLabels, periodQuery, type SalesPeriod } from "./period";
import {
  errorMessage,
  formatMoney,
  formatNumber,
  Notice,
  PageHeader,
} from "./management";
import "./management.css";

type Sales = {
  totals: { orders: number; paidOrders: number; revenue: number };
  byStatus: { status: string; count: number }[];
  byDay: { date: string; orders: number; revenue: number }[];
};
type Top = { data: { productName: string; quantity: number; total: number }[] };
type Low = {
  threshold: number;
  data: {
    id: number;
    sku: string;
    weightGram: number;
    stock: number;
    price: number;
    product: { name: string; isActive: boolean };
  }[];
};
type Growth = {
  totals: { users: number; admins: number; customers: number };
  byDay: { date: string; count: number }[];
};
type Coupons = {
  data: {
    id: number;
    code: string;
    type: string;
    value: number;
    isActive: boolean;
    redemptions: number;
    totalDiscount: number;
  }[];
};
type Loaded<T> = { data: T | null; error: string };
type Bundle = {
  key: string;
  sales: Loaded<Sales>;
  top: Loaded<Top>;
  low: Loaded<Low>;
  growth: Loaded<Growth>;
  coupons: Loaded<Coupons>;
};
const empty = <T,>(): Loaded<T> => ({ data: null, error: "" });
const failed = (problem: unknown) => ({
  data: null,
  error: errorMessage(problem),
});
const fromResult = <T,>(result: PromiseSettledResult<T>): Loaded<T> =>
  result.status === "fulfilled"
    ? { data: result.value, error: "" }
    : failed(result.reason);

export function Reports() {
  const { read, download } = useAuth();
  const [period, setPeriod] = useState<SalesPeriod>("14d");
  const [revision, setRevision] = useState(0);
  const [exportBusy, setExportBusy] = useState("");
  const [exportError, setExportError] = useState("");
  const [bundle, setBundle] = useState<Bundle>({
    key: "",
    sales: empty(),
    top: empty(),
    low: empty(),
    growth: empty(),
    coupons: empty(),
  });
  const range = useMemo(
    () => periodQuery(period).split("?")[1] || "",
    [period],
  );
  const key = `${range}:${revision}`;
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      read<Sales>(`/admin/reports/sales?${range}`),
      read<Top>(`/admin/reports/top-products?${range}&limit=20`),
      read<Low>("/admin/reports/low-stock"),
      read<Growth>(`/admin/reports/users?${range}`),
      read<Coupons>("/admin/reports/coupons"),
    ]).then(([sales, top, low, growth, coupons]) => {
      if (active)
        setBundle({
          key,
          sales: fromResult(sales),
          top: fromResult(top),
          low: fromResult(low),
          growth: fromResult(growth),
          coupons: fromResult(coupons),
        });
    });
    return () => {
      active = false;
    };
  }, [read, range, key]);
  const loading = bundle.key !== key;

  async function exportCsv(
    kind: "sales" | "top-products" | "users" | "coupons",
  ) {
    const suffix =
      kind === "coupons"
        ? ""
        : `?${range}${kind === "top-products" ? "&limit=20" : ""}`;
    setExportBusy(kind);
    setExportError("");
    try {
      const blob = await download(`/admin/reports/${kind}.csv${suffix}`);
      const csv = new Blob(["\ufeff", blob], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(csv);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `dr-gupet-${kind}-${period}.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (problem) {
      setExportError(errorMessage(problem));
    } finally {
      setExportBusy("");
    }
  }
  return (
    <div className="manage-page">
      <PageHeader
        eyebrow="داده‌های فروشگاه"
        title="گزارش‌ها"
        description="روند فروش، رشد کاربران، کالاهای پرفروش، موجودی و عملکرد کدهای تخفیف را از API زنده بررسی کنید."
        action={
          <button
            type="button"
            onClick={() => setRevision((value) => value + 1)}
          >
            تازه‌سازی
          </button>
        }
      />
      <div className="manage-tabs" role="group" aria-label="بازهٔ گزارش">
        {(Object.keys(periodLabels) as SalesPeriod[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={period === item}
            onClick={() => setPeriod(item)}
          >
            {periodLabels[item]}
          </button>
        ))}
      </div>
      <Notice message={exportError} />
      {loading && (
        <p role="status" className="manage-state">
          در حال دریافت گزارش‌ها…
        </p>
      )}
      {!loading && (
        <>
          <section className="manage-card">
            <div className="manage-report-head">
              <h2>فروش · {periodLabels[period]}</h2>
              <button
                type="button"
                disabled={!!exportBusy}
                onClick={() => void exportCsv("sales")}
              >
                {exportBusy === "sales" ? "در حال دریافت…" : "دریافت CSV"}
              </button>
            </div>
            <Notice message={bundle.sales.error} />
            {bundle.sales.data && (
              <>
                <dl className="manage-facts">
                  <div>
                    <dt>مجموع فروش</dt>
                    <dd>{formatMoney(bundle.sales.data.totals.revenue)}</dd>
                  </div>
                  <div>
                    <dt>سفارش‌ها</dt>
                    <dd>{formatNumber(bundle.sales.data.totals.orders)}</dd>
                  </div>
                  <div>
                    <dt>سفارش‌های پرداخت‌شده</dt>
                    <dd>{formatNumber(bundle.sales.data.totals.paidOrders)}</dd>
                  </div>
                </dl>
                <div className="manage-table-wrap">
                  <table className="manage-table">
                    <thead>
                      <tr>
                        <th>روز</th>
                        <th>سفارش</th>
                        <th>فروش</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundle.sales.data.byDay.map((day) => (
                        <tr key={day.date}>
                          <td dir="ltr">{day.date}</td>
                          <td>{formatNumber(day.orders)}</td>
                          <td>{formatMoney(day.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {bundle.sales.data.byDay.length === 0 && (
                  <p className="manage-state">
                    داده‌ای در این بازه ثبت نشده است.
                  </p>
                )}
              </>
            )}
          </section>
          <div className="manage-columns">
            <section className="manage-card">
              <div className="manage-report-head">
                <h2>محصولات پرفروش</h2>
                <button
                  type="button"
                  disabled={!!exportBusy}
                  onClick={() => void exportCsv("top-products")}
                >
                  دریافت CSV
                </button>
              </div>
              <Notice message={bundle.top.error} />
              {bundle.top.data && (
                <>
                  <div className="manage-table-wrap">
                    <table className="manage-table">
                      <thead>
                        <tr>
                          <th>محصول</th>
                          <th>تعداد</th>
                          <th>مبلغ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bundle.top.data.data.map((item) => (
                          <tr key={item.productName}>
                            <td>{item.productName}</td>
                            <td>{formatNumber(item.quantity)}</td>
                            <td>{formatMoney(item.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {bundle.top.data.data.length === 0 && (
                    <p className="manage-state">داده‌ای ثبت نشده است.</p>
                  )}
                </>
              )}
            </section>
            <section className="manage-card">
              <h2>موجودی کم</h2>
              <Notice message={bundle.low.error} />
              {bundle.low.data && (
                <>
                  <p>
                    آستانهٔ گزارش: {formatNumber(bundle.low.data.threshold)} عدد
                  </p>
                  <div className="manage-table-wrap">
                    <table className="manage-table">
                      <thead>
                        <tr>
                          <th>محصول</th>
                          <th>SKU</th>
                          <th>وزن</th>
                          <th>موجودی</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bundle.low.data.data.map((item) => (
                          <tr key={item.id}>
                            <td>{item.product.name}</td>
                            <td dir="ltr">{item.sku}</td>
                            <td>{formatNumber(item.weightGram)} گرم</td>
                            <td>{formatNumber(item.stock)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {bundle.low.data.data.length === 0 && (
                    <p className="manage-state">موردی زیر آستانه نیست.</p>
                  )}
                </>
              )}
            </section>
          </div>
          <div className="manage-columns">
            <section className="manage-card">
              <div className="manage-report-head">
                <h2>رشد کاربران</h2>
                <button
                  type="button"
                  disabled={!!exportBusy}
                  onClick={() => void exportCsv("users")}
                >
                  دریافت CSV
                </button>
              </div>
              <Notice message={bundle.growth.error} />
              {bundle.growth.data && (
                <>
                  <dl className="manage-facts">
                    <div>
                      <dt>کل ثبت‌نام‌ها</dt>
                      <dd>{formatNumber(bundle.growth.data.totals.users)}</dd>
                    </div>
                    <div>
                      <dt>مشتریان</dt>
                      <dd>
                        {formatNumber(bundle.growth.data.totals.customers)}
                      </dd>
                    </div>
                  </dl>
                  <div className="manage-table-wrap">
                    <table className="manage-table">
                      <thead>
                        <tr>
                          <th>روز</th>
                          <th>ثبت‌نام</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bundle.growth.data.byDay.map((day) => (
                          <tr key={day.date}>
                            <td dir="ltr">{day.date}</td>
                            <td>{formatNumber(day.count)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {bundle.growth.data.byDay.length === 0 && (
                    <p className="manage-state">داده‌ای ثبت نشده است.</p>
                  )}
                </>
              )}
            </section>
            <section className="manage-card">
              <div className="manage-report-head">
                <h2>عملکرد تخفیف‌ها</h2>
                <button
                  type="button"
                  disabled={!!exportBusy}
                  onClick={() => void exportCsv("coupons")}
                >
                  دریافت CSV
                </button>
              </div>
              <Notice message={bundle.coupons.error} />
              {bundle.coupons.data && (
                <>
                  <div className="manage-table-wrap">
                    <table className="manage-table">
                      <thead>
                        <tr>
                          <th>کد</th>
                          <th>استفاده</th>
                          <th>تخفیف کل</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bundle.coupons.data.data.map((item) => (
                          <tr key={item.id}>
                            <td dir="ltr">{item.code}</td>
                            <td>{formatNumber(item.redemptions)}</td>
                            <td>{formatMoney(item.totalDiscount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {bundle.coupons.data.data.length === 0 && (
                    <p className="manage-state">کدی ثبت نشده است.</p>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
