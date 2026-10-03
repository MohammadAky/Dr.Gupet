import { useEffect, useState, type FormEvent } from "react";
import { AuthProvider, useAuth } from "./auth";
import { ApiError } from "./api/client";
import { Catalog } from "./Catalog";
import { Care } from "./Care";
import { Orders } from "./Orders";
import { Users } from "./Users";
import { Promotions } from "./Promotions";
import { Operations } from "./Operations";
import { Reports } from "./Reports";
import { type DashboardData } from "./dashboard-data";
import { ThemeToggle } from "./ThemeToggle";
import {
  periodLabels,
  periodQuery,
  REPORT_TIME_ZONE,
  tehranDayKey,
  type SalesPeriod,
  type SalesReport,
} from "./period";

const number = new Intl.NumberFormat("fa-IR");
const money = (value: number) => `${number.format(value)} تومان`;
const dateFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  month: "short",
  day: "numeric",
});
const orderStatus: Record<string, string> = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت‌شده",
  PROCESSING: "در حال پردازش",
  SHIPPED: "ارسال‌شده",
  DELIVERED: "تحویل‌شده",
  CANCELED: "لغوشده",
};

function humanError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError)
    return "ارتباط با بک‌اند برقرار نشد. اجرای API را بررسی کنید.";
  return "درخواست انجام نشد. دوباره تلاش کنید.";
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <img src="/brand/logo.jpg" width="48" height="48" alt="" />
      <div>
        <strong>دکتر گوپت</strong>
        <span>مدیریت فروشگاه</span>
      </div>
    </div>
  );
}

function Login() {
  const { requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const normalizeDigits = (value: string) =>
    value
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
      .replace(/[\s-]/g, "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalizedPhone = normalizeDigits(phone);
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شمارهٔ موبایل را به صورت ۰۹ و ۹ رقم بعدی وارد کنید.");
      return;
    }
    if (step === "code" && !/^\d{5,6}$/.test(normalizeDigits(code))) {
      setError("کد تأیید باید ۵ یا ۶ رقم باشد.");
      return;
    }
    setBusy(true);
    try {
      if (step === "phone") {
        await requestOtp(normalizedPhone);
        setPhone(normalizedPhone);
        setStep("code");
      } else {
        await verifyOtp(normalizedPhone, normalizeDigits(code));
      }
    } catch (problem) {
      setError(humanError(problem));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-layout">
      <div className="login-theme"><ThemeToggle /></div>
      <div className="login-intro">
        <Brand />
        <span className="eyebrow">سامانهٔ مدیریت</span>
        <h1>همه‌چیز زیر نگاه شما.</h1>
        <p>سفارش‌ها، فروش و وضعیت فروشگاه را در یک نمای روشن دنبال کنید.</p>
        <div className="login-accent" aria-hidden="true">
          <span>۰۱</span>
          <span>نمای کلی فروش</span>
          <span>←</span>
        </div>
      </div>
      <section className="login-card" aria-labelledby="login-title">
        <span className="eyebrow">ورود امن</span>
        <h2 id="login-title">ورود مدیر</h2>
        <p>
          {step === "phone"
            ? "شمارهٔ حساب مدیر را وارد کنید تا کد یک‌بارمصرف دریافت شود."
            : `کد ارسال‌شده به ${phone} را وارد کنید.`}
        </p>
        <form onSubmit={(event) => void submit(event)}>
          {step === "phone" ? (
            <label>
              شمارهٔ موبایل
              <input
                autoComplete="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0912 000 0000"
                aria-invalid={Boolean(error)}
              />
            </label>
          ) : (
            <label>
              کد تأیید
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                dir="ltr"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="کد ۵ یا ۶ رقمی"
                aria-invalid={Boolean(error)}
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="button button--primary"
            disabled={busy}
          >
            {busy
              ? "در حال بررسی…"
              : step === "phone"
                ? "دریافت کد"
                : "ورود به پنل"}
          </button>
          {step === "code" && (
            <button
              type="button"
              className="button button--text"
              onClick={() => {
                setStep("phone");
                setCode("");
                setError("");
              }}
            >
              تغییر شماره
            </button>
          )}
        </form>
      </section>
      <div className="login-foot">
        دسترسی واقعی فقط برای حساب دارای نقش مدیر فعال است.
      </div>
    </main>
  );
}

type AdminSection = "overview" | "products" | "orders" | "people" | "promotions" |
  "care" | "payments" | "reports" | "audit" | "settings";

const navigation: Array<{
  title: string;
  items: Array<{ id: AdminSection; label: string; index: string }>;
}> = [
  { title: "مرکز فرمان", items: [
    { id: "overview", label: "نمای کلی", index: "۰۱" },
    { id: "products", label: "محصولات", index: "۰۲" },
  ] },
  { title: "مدیریت فروشگاه", items: [
    { id: "orders", label: "سفارش‌ها", index: "۰۳" },
    { id: "people", label: "کاربران", index: "۰۴" },
    { id: "promotions", label: "کدهای تخفیف", index: "۰۵" },
    { id: "care", label: "دارو و مراکز", index: "۰۶" },
  ] },
  { title: "پایش و تنظیمات", items: [
    { id: "payments", label: "پرداخت‌ها", index: "۰۷" },
    { id: "reports", label: "گزارش‌ها", index: "۰۸" },
    { id: "audit", label: "لاگ تغییرات", index: "۰۹" },
    { id: "settings", label: "تنظیمات", index: "۱۰" },
  ] },
];

function Sidebar({ active, onSelect, open, onClose }: {
  active: AdminSection;
  onSelect: (value: AdminSection) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <aside className={"sidebar" + (open ? " sidebar--open" : "")} id="admin-navigation">
      <div className="sidebar-brand-row">
      <Brand compact />
        <button type="button" className="sidebar-close" onClick={onClose}
          aria-label="بستن فهرست">×</button>
      </div>
      <nav aria-label="بخش‌های مدیریت">
        {navigation.map((group) => <div className="sidebar-group" key={group.title}>
          <span className="sidebar-label">{group.title}</span>
          {group.items.map((item) => <button type="button" key={item.id}
            className={"sidebar-link" + (active === item.id ? " sidebar-link--active" : "")}
            aria-current={active === item.id ? "page" : undefined}
            onClick={() => onSelect(item.id)}>
            <span className="sidebar-link__index" aria-hidden="true">{item.index}</span>
            <span>{item.label}</span>
          </button>)}
        </div>)}
      </nav>
      <p className="sidebar-note">عملیات این پنل به داده و مجوز واقعی API نیاز دارد.</p>
    </aside>
  );
}

function Metric({
  label,
  value,
  note,
  tone = "normal",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "normal" | "gold";
}) {
  return (
    <article className={`metric metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function SalesChart({
  points,
  label,
}: {
  points: SalesReport["byDay"];
  label: string;
}) {
  const max = Math.max(1, ...points.map((point) => point.revenue));
  return (
    <div
      className="chart"
      role="img"
      aria-label={`روند فروش ${label}`}
      style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
    >
      {points.map((point) => (
        <div
          className="chart-column"
          key={point.date}
          title={`${point.date}: ${money(point.revenue)}`}
        >
          <div className="chart-bar-track">
            <div
              className="chart-bar"
              style={{ height: `${Math.max(4, (point.revenue / max) * 100)}%` }}
            />
          </div>
          <span>{dateFormat.format(new Date(`${point.date}T12:00:00Z`))}</span>
        </div>
      ))}
    </div>
  );
}

function DashboardContent({
  data,
  report,
  period,
  onPeriodChange,
  reportLoading,
  reportError,
  onReportRetry,
}: {
  data: DashboardData;
  report: SalesReport | null;
  period: SalesPeriod;
  onPeriodChange: (period: SalesPeriod) => void;
  reportLoading: boolean;
  reportError: string;
  onReportRetry: () => void;
}) {
  const { totals, recentOrders, topProducts } = data;
  const now = new Date();
  const localToday = tehranDayKey(now);
  const chartPoints = report
    ? period === "today"
      ? [{ date: localToday, orders: report.totals.orders, revenue: report.totals.revenue }]
      : report.byDay
    : [];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">نبض فروشگاه</span>
          <h1>نمای کلی</h1>
          <p>تصویری سریع از فروش، سفارش‌ها و موارد نیازمند توجه.</p>
        </div>
        <div className="period-selector" role="group" aria-label="بازهٔ گزارش فروش">
          {(Object.keys(periodLabels) as SalesPeriod[]).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={period === choice}
              onClick={() => onPeriodChange(choice)}
            >
              {periodLabels[choice]}
            </button>
          ))}
        </div>
      </div>
      <section className="metrics" aria-label="شاخص‌های فروشگاه">
        <Metric
          label={`فروش ${periodLabels[period]}`}
          value={report ? money(report.totals.revenue) : "—"}
          note={report ? `${number.format(report.totals.paidOrders)} سفارش پرداخت‌شده` : "در حال دریافت گزارش"}
          tone="gold"
        />
        <Metric
          label="فروش امروز"
          value={money(totals.revenueToday)}
          note="براساس سفارش‌های پرداخت‌شده"
        />
        <Metric
          label="کاربران"
          value={number.format(totals.users)}
          note={`${number.format(totals.newUsers30d)} نفر جدید در ۳۰ روز`}
        />
        <Metric
          label="در انتظار پرداخت"
          value={number.format(totals.pendingPaymentOrders)}
          note="نیازمند پیگیری"
        />
      </section>
      <div className="dashboard-columns">
        <section className="panel sales-panel" aria-labelledby="sales-title">
          <div className="panel-head">
            <div>
              <span className="eyebrow">روند فروش</span>
              <h2 id="sales-title">{periodLabels[period]}</h2>
            </div>
            <span className="legend">
              <i /> مبلغ فروش
            </span>
          </div>
          {reportError ? (
            <div className="report-error" role="alert">
              <p>{reportError}</p>
              <button type="button" onClick={onReportRetry}>تلاش دوباره</button>
            </div>
          ) : reportLoading ? (
            <p className="loading" role="status">در حال دریافت گزارش فروش…</p>
          ) : chartPoints.length ? (
            <div className="chart-scroll">
              <SalesChart points={chartPoints} label={periodLabels[period]} />
            </div>
          ) : (
            <p className="empty">هنوز داده‌ای برای نمایش نیست.</p>
          )}
        </section>
        <section
          className="panel attention-panel"
          aria-labelledby="attention-title"
        >
          <div className="panel-head">
            <div>
              <span className="eyebrow">عملیاتی</span>
              <h2 id="attention-title">نیازمند توجه</h2>
            </div>
          </div>
          <dl>
            <div>
              <dt>موجودی کم</dt>
              <dd>{number.format(totals.lowStockVariants)}</dd>
            </div>
            <div>
              <dt>ناموجود</dt>
              <dd>{number.format(totals.outOfStockVariants)}</dd>
            </div>
            <div>
              <dt>محصول غیرفعال</dt>
              <dd>{number.format(totals.inactiveProducts)}</dd>
            </div>
            <div>
              <dt>پرداخت ناموفق ۲۴ ساعت</dt>
              <dd>{number.format(totals.failedPayments24h)}</dd>
            </div>
          </dl>
        </section>
      </div>
      <div className="dashboard-columns dashboard-columns--bottom">
        <section className="panel orders-panel" aria-labelledby="orders-title">
          <div className="panel-head">
            <div>
              <span className="eyebrow">تازه‌ترین فعالیت</span>
              <h2 id="orders-title">سفارش‌های اخیر</h2>
            </div>
          </div>
          {recentOrders.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">شماره</th>
                    <th scope="col">مشتری</th>
                    <th scope="col">مبلغ</th>
                    <th scope="col">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td dir="ltr">{order.orderNumber}</td>
                      <td>
                        {[order.user.firstName, order.user.lastName]
                          .filter(Boolean)
                          .join(" ") || order.user.phone}
                      </td>
                      <td>{money(order.finalAmount)}</td>
                      <td>
                        <span
                          className={`status status--${order.status.toLowerCase()}`}
                        >
                          {orderStatus[order.status] || order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">سفارشی ثبت نشده است.</p>
          )}
        </section>
        <section className="panel products-panel" aria-labelledby="top-title">
          <div className="panel-head">
            <div>
              <span className="eyebrow">محبوب مشتری‌ها</span>
              <h2 id="top-title">پرفروش‌ترین‌ها</h2>
            </div>
          </div>
          {topProducts.length ? (
            <ol>
              {topProducts.map((product) => (
                <li key={product.productName}>
                  <span>
                    {product.productName}
                    <small>{number.format(product.quantity)} عدد</small>
                  </span>
                  <strong>{money(product.total)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty">هنوز داده‌ای برای نمایش نیست.</p>
          )}
        </section>
      </div>
    </>
  );
}

function Dashboard() {
  const { read } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [reportRevision, setReportRevision] = useState(0);
  const [period, setPeriod] = useState<SalesPeriod>("14d");
  const [reportState, setReportState] = useState<{
    key: string;
    data: SalesReport | null;
    error: string;
  }>({ key: "", data: null, error: "" });
  const reportKey = `${period}:${reportRevision}`;
  const report = reportState.key === reportKey ? reportState.data : null;
  const reportError = reportState.key === reportKey ? reportState.error : "";
  const reportLoading = reportState.key !== reportKey;

  useEffect(() => {
    let active = true;
    void read<DashboardData>("/admin/dashboard?tz=" + encodeURIComponent(REPORT_TIME_ZONE))
      .then((result) => {
        if (active) setData(result);
      })
      .catch((problem) => {
        if (active) setError(humanError(problem));
      });
    return () => {
      active = false;
    };
  }, [read, revision]);

  useEffect(() => {
    let active = true;
    void read<SalesReport>(periodQuery(period))
      .then((result) => {
        if (active) setReportState({ key: reportKey, data: result, error: "" });
      })
      .catch((problem) => {
        if (active) setReportState({ key: reportKey, data: null, error: humanError(problem) });
      });
    return () => {
      active = false;
    };
  }, [period, read, reportKey]);

  return (
    <>
          {error ? (
            <div className="error-panel" role="alert">
              <h1>دریافت داده انجام نشد</h1>
              <p>{error}</p>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  setError("");
                  setRevision((n) => n + 1);
                }}
              >
                تلاش دوباره
              </button>
            </div>
          ) : data ? (
            <DashboardContent
              data={data}
              report={report}
              period={period}
              onPeriodChange={setPeriod}
              reportLoading={reportLoading}
              reportError={reportError}
              onReportRetry={() => setReportRevision((n) => n + 1)}
            />
          ) : (
            <p className="loading" role="status">
              در حال دریافت نمای کلی…
            </p>
          )}
    </>
  );
}

function Workspace() {
  const { identity, logout } = useAuth();
  const [section, setSection] = useState<AdminSection>("overview");
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    if (!navOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [navOpen]);
  const label = navigation.flatMap((group) => group.items).find((item) => item.id === section)?.label || "نمای کلی";
  return <div className="admin-shell">
    {navOpen && <button type="button" className="sidebar-scrim" aria-label="بستن فهرست"
      onClick={() => setNavOpen(false)} />}
    <Sidebar active={section} open={navOpen} onClose={() => setNavOpen(false)}
      onSelect={(value) => { setSection(value); setNavOpen(false); window.scrollTo(0, 0); }} />
    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-context">
          <button type="button" className="nav-open" aria-label="باز کردن فهرست"
            aria-controls="admin-navigation" aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}>☰</button>
          <span className="topbar-dot" /> پنل مدیریت <span>/</span> {label}
        </div>
        <div className="topbar-user">
          <ThemeToggle />
          <span className="user-avatar" aria-hidden="true">{identity?.firstName?.charAt(0) || "م"}</span>
          <span className="user-name">{identity?.firstName || "مدیر"}</span>
          <button type="button" onClick={logout}>خروج</button>
        </div>
      </header>
      <main className="dashboard-main">
        {section === "overview" ? <Dashboard />
          : section === "products" ? <Catalog />
          : section === "orders" ? <Orders />
          : section === "people" ? <Users />
          : section === "promotions" ? <Promotions />
          : section === "care" ? <Care />
          : section === "reports" ? <Reports />
          : <Operations key={section} initialTab={section === "audit" ? "audit" : section === "settings" ? "settings" : "payments"} />}
      </main>
    </div>
  </div>;
}

function CurrentView() {
  const { mode } = useAuth();
  return mode === "guest" ? <Login /> : <Workspace />;
}

export default function App() {
  return (
    <AuthProvider>
      <CurrentView />
    </AuthProvider>
  );
}
