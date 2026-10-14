import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { AuthProvider, useAuth } from "./auth";
import { ApiError } from "./api/client";
import { Catalog } from "./Catalog";
import { Care } from "./Care";
import { Orders } from "./Orders";
import { Users } from "./Users";
import { Promotions } from "./Promotions";
import { Operations } from "./Operations";
import { Reports } from "./Reports";
import { LandingContent } from "./LandingContent";
import { type DashboardData } from "./dashboard-data";
import { ThemeToggle } from "./ThemeToggle";
import { PasswordInput } from "./PasswordInput";
import { normalizeUsername } from "./password";
import { confirmAction, hasUnsavedDrafts, useDraftProtection } from "./management";
import { parseAdminLocation } from "./navigation";
import { AdminSidebar } from "./AdminSidebar";
import { sidebarGroups as navigation } from "./sidebar-order";
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
type GrowthReport = { totals: { users: number; admins: number; customers: number } };

function ActionRow({ href, label, count, note }: { href: string; label: string; count: number; note?: string }) {
  return <a className="dashboard-action" href={href}>
    <span>{label}{note && <small>{note}</small>}</span>
    <strong>{number.format(count)}</strong>
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
  </a>;
}
const dateFormat = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  timeZone: "Asia/Tehran",
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
    return "اتصال برقرار نشد. ارتباط اینترنت را بررسی کنید و دوباره تلاش کنید.";
  return "درخواست انجام نشد. دوباره تلاش کنید.";
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <img src="/brand/logo.webp" width="48" height="48" alt="" />
      <div>
        <strong>دکتر گوپت</strong>
        <span>مدیریت فروشگاه</span>
      </div>
    </div>
  );
}

function Login() {
  const { requestOtp, verifyOtp, loginPassword } = useAuth();
  const [method, setMethod] = useState<"password" | "otp">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState<{ phone: string; until: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= cooldown.until) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const normalizeDigits = (value: string) =>
    value
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
      .replace(/[\s-]/g, "");

  const remaining = cooldown?.phone === normalizeDigits(phone)
    ? Math.max(0, Math.ceil((cooldown.until - now) / 1000))
    : 0;

  async function sendCode(normalizedPhone: string, resend = false) {
    const result = await requestOtp(normalizedPhone);
    if (!mounted.current) return;
    const seconds = typeof result.cooldownSeconds === "number" &&
      Number.isSafeInteger(result.cooldownSeconds) && result.cooldownSeconds >= 0
      ? result.cooldownSeconds : 60;
    const sentAt = Date.now();
    setNow(sentAt);
    setCooldown({ phone: normalizedPhone, until: sentAt + seconds * 1000 });
    setPhone(normalizedPhone);
    setCode("");
    setStep("code");
    setNotice(resend ? "کد جدید ارسال شد؛ آخرین کد دریافتی را وارد کنید." : "کد تأیید ارسال شد.");
  }

  async function resend() {
    if (pending.current || remaining > 0 || step !== "code") return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sendCode(normalizeDigits(phone), true);
    } catch (problem) {
      if (mounted.current) setError(humanError(problem));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || (method === "otp" && step === "phone" && remaining > 0)) return;
    setError("");
    if (method === "password") {
      if (!/^[a-z0-9_.]{3,32}$/.test(normalizeUsername(username)) || !password) {
        setError("نام کاربری و رمز عبور را وارد کنید."); return;
      }
      pending.current = true; setBusy(true);
      try {
        await loginPassword(normalizeUsername(username), password);
        if (mounted.current) setPassword("");
      } catch {
        if (mounted.current) setError("ورود انجام نشد. اطلاعات و دسترسی حساب را بررسی کنید یا دوباره تلاش کنید.");
      } finally {
        pending.current = false; if (mounted.current) setBusy(false);
      }
      return;
    }
    const normalizedPhone = normalizeDigits(phone);
    if (!/^09\d{9}$/.test(normalizedPhone)) {
      setError("شمارهٔ موبایل را به صورت ۰۹ و ۹ رقم بعدی وارد کنید.");
      return;
    }
    if (step === "code" && !/^\d{5,6}$/.test(normalizeDigits(code))) {
      setError("کد تأیید باید ۵ یا ۶ رقم باشد.");
      return;
    }
    pending.current = true;
    setBusy(true);
    try {
      if (step === "phone") {
        await sendCode(normalizedPhone);
      } else {
        await verifyOtp(normalizedPhone, normalizeDigits(code));
      }
    } catch (problem) {
      if (mounted.current) setError(humanError(problem));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <main className="login-layout">
      <div className="login-theme"><ThemeToggle /></div>
      <div className="login-intro">
        <Brand />
        <span className="eyebrow">سامانهٔ مدیریت</span>
        <h1>یک نگاه روشن.<br />مدیریت دقیق‌تر.</h1>
        <p>سفارش‌ها، فروش و وضعیت فروشگاه را در یک نمای روشن دنبال کنید.</p>
        <div className="login-accent" aria-hidden="true">
          <span>دکتر گوپت</span>
          <span>همراه مراقبت بهتر</span>
        </div>
      </div>
      <section className="login-card" aria-labelledby="login-title">
        <span className="eyebrow">ورود امن</span>
        <h2 id="login-title">ورود مدیر</h2>
        <div className="auth-methods" role="group" aria-label="روش ورود">
          <button type="button" aria-pressed={method === "password"} disabled={busy}
            onClick={() => { setMethod("password"); setError(""); setNotice(""); setCode(""); }}>نام کاربری و رمز</button>
          <button type="button" aria-pressed={method === "otp"} disabled={busy}
            onClick={() => { setMethod("otp"); setPassword(""); setError(""); setNotice(""); }}>کد پیامکی</button>
        </div>
        <p>
          {method === "password" ? "نام کاربری و رمز حساب مدیر را وارد کنید." : step === "phone"
            ? "شمارهٔ حساب مدیر را وارد کنید تا کد یک‌بارمصرف دریافت شود."
            : `کد ارسال‌شده به ${phone} را وارد کنید.`}
        </p>
        <form onSubmit={(event) => void submit(event)} noValidate>
          {method === "password" ? <>
            <label htmlFor="admin-username">نام کاربری</label>
            <input id="admin-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} dir="ltr"
              value={username} disabled={busy} onChange={(event) => setUsername(event.target.value)} />
            <label htmlFor="admin-password">رمز عبور</label>
            <PasswordInput id="admin-password" value={password} onChange={setPassword} disabled={busy} autoComplete="current-password" />
          </> : step === "phone" ? (
            <label>
              شمارهٔ موبایل
              <input
                autoComplete="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                disabled={busy}
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
                disabled={busy}
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
          {notice && <p className="login-notice" role="status">{notice}</p>}
          {method === "password" && <button type="button" className="button button--text" disabled={busy}
            onClick={() => { setMethod("otp"); setPassword(""); setError(""); }}>رمز را فراموش کرده‌اید؟ ورود با کد پیامکی</button>}
          <button
            type="submit"
            className="button button--primary"
            disabled={busy || (method === "otp" && step === "phone" && remaining > 0)}
          >
            {busy
              ? "در حال بررسی…"
              : method === "password" ? "ورود به پنل" : step === "phone"
                ? "دریافت کد"
                : "ورود به پنل"}
          </button>
          {method === "otp" && step === "code" && (
            <button type="button" className="button button--text"
              disabled={busy || remaining > 0} onClick={() => void resend()}>
              {remaining > 0 ? `ارسال مجدد تا ${number.format(remaining)} ثانیه دیگر` : "ارسال مجدد کد"}
            </button>
          )}
          {method === "otp" && step === "phone" && remaining > 0 && (
            <p className="login-notice">ارسال مجدد تا {number.format(remaining)} ثانیه دیگر</p>
          )}
          {method === "otp" && step === "code" && (
            <button
              type="button"
              className="button button--text"
              disabled={busy}
              onClick={() => {
                if (pending.current) return;
                setStep("phone");
                setCode("");
                setError("");
                setNotice("");
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
    <>
    <div
      className="chart"
      aria-hidden="true"
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
              style={{ height: `${(point.revenue / max) * 100}%` }}
            />
          </div>
          <span>{dateFormat.format(new Date(`${point.date}T12:00:00Z`))}</span>
        </div>
      ))}
    </div>
    <div className="chart-data-table"><table>
      <caption>فروش روزانه {label}</caption>
      <thead><tr><th scope="col">تاریخ</th><th scope="col">مبلغ فروش</th><th scope="col">تعداد سفارش</th></tr></thead>
      <tbody>{points.map((point) => (
        <tr key={point.date}>
          <th scope="row"><time dateTime={point.date}>{dateFormat.format(new Date(`${point.date}T12:00:00Z`))}</time></th>
          <td>{money(point.revenue)}</td>
          <td>{number.format(point.orders)}</td>
        </tr>
      ))}</tbody>
    </table></div>
    </>
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
  growth,
  growthError,
  onRefresh,
}: {
  data: DashboardData;
  report: SalesReport | null;
  period: SalesPeriod;
  onPeriodChange: (period: SalesPeriod) => void;
  reportLoading: boolean;
  reportError: string;
  onReportRetry: () => void;
  growth: GrowthReport | null;
  growthError: string;
  onRefresh: () => void;
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
          <p>سفارش‌های قابل پیگیری، وضعیت موجودی و گزارش فعالیت ثبت‌شده.</p>
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
        <button type="button" className="button dashboard-refresh" onClick={onRefresh} aria-label="به‌روزرسانی نمای کلی" title="به‌روزرسانی نمای کلی">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.6-1L20 9M4 15l2.3 3A7 7 0 0 0 17.9 17" /></svg>
        </button>
      </div>
      <section className="metrics" aria-label="شاخص‌های فروشگاه">
        <Metric
          label={`فروش ${periodLabels[period]}`}
          value={report ? money(report.totals.revenue) : "—"}
          note={report ? `${number.format(report.totals.paidOrders)} سفارش پرداخت‌شده` : reportError ? "گزارش دریافت نشد" : "در حال دریافت گزارش"}
          tone="gold"
        />
        <Metric
          label={`سفارش‌های ${periodLabels[period]}`}
          value={report ? number.format(report.totals.orders) : "—"}
          note="همهٔ وضعیت‌ها؛ براساس زمان ثبت سفارش"
        />
        <Metric
          label={`مشتریان جدید ${periodLabels[period]}`}
          value={growth ? number.format(growth.totals.customers) : "—"}
          note={growthError ? "گزارش ثبت‌نام دریافت نشد" : growth ? "حساب‌های مشتری؛ بدون مدیران" : "در حال دریافت گزارش ثبت‌نام"}
        />
        <Metric
          label="در انتظار پرداخت"
          value={number.format(totals.pendingPaymentOrders)}
          note="وضعیت فعلی؛ مستقل از بازهٔ گزارش"
        />
      </section>
      {growthError && <div className="report-error" role="alert"><p>{growthError}</p><button type="button" onClick={onReportRetry}>تلاش دوباره برای گزارش ثبت‌نام</button></div>}
      <section className="panel work-queue" aria-labelledby="queue-title">
        <div className="panel-head"><div><span className="eyebrow">کارهای روزانه</span><h2 id="queue-title">پیگیری سفارش‌ها</h2><p className="dashboard-scope">وضعیت فعلی همهٔ سفارش‌ها؛ پس از دریافت داده از سرور.</p></div><a className="button" href="#orders">همهٔ سفارش‌ها</a></div>
        <div className="work-queue-actions">
          <ActionRow href="#orders?status=PAID" label="آماده‌سازی سفارش" count={totals.orders.PAID || 0} note="پرداخت‌شده" />
          <ActionRow href="#orders?status=PROCESSING" label="ثبت رهگیری و ارسال" count={totals.orders.PROCESSING || 0} note="در حال پردازش" />
          <ActionRow href="#orders?status=SHIPPED" label="پیگیری تحویل" count={totals.orders.SHIPPED || 0} note="ارسال‌شده" />
        </div>
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
          <p className="dashboard-scope">موجودی فعلی و پرداخت‌های ناموفق ۲۴ ساعت گذشته.</p>
          <ActionRow href="#reports?focus=low" label="بررسی موجودی کم" count={totals.lowStockVariants} note="تعداد تنوع‌های محصول" />
          <ActionRow href="#reports?focus=low" label="بررسی کالاهای ناموجود" count={totals.outOfStockVariants} note="در گزارش موجودی" />
          <ActionRow href="#products?active=false" label="بررسی محصولات غیرفعال" count={totals.inactiveProducts} />
          <ActionRow href="#payments?status=FAILED" label="بررسی پرداخت‌های ناموفق" count={totals.failedPayments24h} note="تعداد ۲۴ ساعت گذشته؛ فهرست همهٔ ناموفق‌ها" />
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
                      <td dir="ltr"><a href={`#orders?order=${order.id}`} aria-label={`جزئیات سفارش ${order.orderNumber}`}>{order.orderNumber}</a></td>
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
              <span className="eyebrow">اقلام سفارش‌ها</span>
              <h2 id="top-title">بیشترین مبلغ ثبت‌شده</h2>
              <p className="dashboard-scope">همهٔ زمان‌ها و وضعیت‌ها؛ شامل سفارش‌های پرداخت‌نشده و لغوشده.</p>
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
    growth: GrowthReport | null;
    growthError: string;
  }>({ key: "", data: null, error: "", growth: null, growthError: "" });
  const reportKey = `${period}:${reportRevision}`;
  const report = reportState.key === reportKey ? reportState.data : null;
  const reportError = reportState.key === reportKey ? reportState.error : "";
  const reportLoading = reportState.key !== reportKey;
  const growth = reportState.key === reportKey ? reportState.growth : null;
  const growthError = reportState.key === reportKey ? reportState.growthError : "";

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
    const salesPath = periodQuery(period);
    const range = salesPath.split("?")[1];
    void Promise.allSettled([read<SalesReport>(salesPath), read<GrowthReport>(`/admin/reports/users?${range}`)])
      .then(([sales, users]) => {
        if (active) setReportState({ key: reportKey,
          data: sales.status === "fulfilled" ? sales.value : null,
          error: sales.status === "rejected" ? humanError(sales.reason) : "",
          growth: users.status === "fulfilled" ? users.value : null,
          growthError: users.status === "rejected" ? humanError(users.reason) : "",
        });
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
              growth={growth}
              growthError={growthError}
              onRefresh={() => { setData(null); setError(""); setRevision((n) => n + 1); setReportRevision((n) => n + 1); }}
            />
          ) : (
            <p className="loading" role="status">
              در حال دریافت نمای کلی…
            </p>
          )}
    </>
  );
}

const MOBILE_NAV_QUERY = "(max-width: 850px)";

function mobileNavigationViewport(): boolean {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(MOBILE_NAV_QUERY).matches
    : window.innerWidth <= 850;
}

function Workspace() {
  const { identity, logout } = useAuth();
  const [location, setLocation] = useState(() => parseAdminLocation(window.location.hash));
  const section = location.section;
  const currentLocation = useRef(location.canonical);
  const historyIndex = useRef(0);
  const restoringHistory = useRef(false);
  const navigationPending = useRef(false);
  const pendingTraversal = useRef<{ hash: string; index?: number } | null>(null);
  const navigationGeneration = useRef(0);
  const focusLocation = useRef(location.canonical);
  const [navOpen, setNavOpen] = useState(false);
  useDraftProtection();
  const navigate = useCallback(async (hash: string, push: boolean, targetIndex?: number) => {
    if (!push) pendingTraversal.current = { hash, index: targetIndex };
    if (navigationPending.current || document.querySelector(".admin-confirm")) return;
    let next = parseAdminLocation(hash);
    if (next.canonical === currentLocation.current) return;
    if (push) pendingTraversal.current = null;
    const generation = ++navigationGeneration.current;
    navigationPending.current = true;
    if (hasUnsavedDrafts() && !await confirmAction("تغییرهای ذخیره‌نشده با رفتن به بخش دیگر کنار گذاشته می‌شوند.", "کنار گذاشتن تغییرها")) {
      if (generation === navigationGeneration.current && !push) {
        const index = pendingTraversal.current?.index ?? targetIndex;
        if (index !== undefined && index !== historyIndex.current) {
          restoringHistory.current = true;
          history.go(historyIndex.current - index);
        } else history.replaceState({ adminIndex: historyIndex.current }, "", currentLocation.current);
      }
      navigationPending.current = false;
      pendingTraversal.current = null;
      return;
    }
    navigationPending.current = false;
    if (generation !== navigationGeneration.current) return;
    if (pendingTraversal.current) {
      next = parseAdminLocation(pendingTraversal.current.hash);
      targetIndex = pendingTraversal.current.index;
    }
    pendingTraversal.current = null;
    historyIndex.current = push ? historyIndex.current + 1 : targetIndex ?? historyIndex.current;
    if (push) history.pushState({ adminIndex: historyIndex.current }, "", next.canonical);
    else history.replaceState({ adminIndex: historyIndex.current }, "", next.canonical);
    currentLocation.current = next.canonical;
    setLocation(next); setNavOpen(false); window.scrollTo(0, 0);
  }, []);
  useLayoutEffect(() => {
    if (focusLocation.current !== location.canonical) document.getElementById("admin-content")?.focus({ preventScroll: true });
    focusLocation.current = location.canonical;
  }, [location.canonical]);
  useEffect(() => {
    history.replaceState({ adminIndex: historyIndex.current }, "", currentLocation.current);
    const update = () => {
      if (restoringHistory.current) {
        if (window.location.hash === currentLocation.current) restoringHistory.current = false;
        return;
      }
      const index = history.state?.adminIndex;
      void navigate(window.location.hash, false, Number.isSafeInteger(index) ? index : undefined);
    };
    const followLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href^='#']");
      const hash = link?.getAttribute("href");
      if (!hash || hash === "#admin-content") return;
      event.preventDefault(); void navigate(hash, true);
    };
    const afterConfirmation = () => { queueMicrotask(update); };
    window.addEventListener("admin:confirmationclosed", afterConfirmation);
    document.addEventListener("click", followLink);
    window.addEventListener("popstate", update); window.addEventListener("hashchange", update);
    return () => { window.removeEventListener("admin:confirmationclosed", afterConfirmation); document.removeEventListener("click", followLink); window.removeEventListener("popstate", update); window.removeEventListener("hashchange", update); };
  }, [navigate]);
  const [mobile, setMobile] = useState(mobileNavigationViewport);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<"mobile" | "desktop" | null>(null);
  const drawerLocation = useRef(location.canonical);
  const drawerOpen = mobile && navOpen;

  useEffect(() => {
    const media = typeof window.matchMedia === "function" ? window.matchMedia(MOBILE_NAV_QUERY) : null;
    const update = () => {
      const next = media ? media.matches : window.innerWidth <= 850;
      setMobile(next);
      if (!next) setNavOpen(false);
    };
    if (media) media.addEventListener("change", update);
    else window.addEventListener("resize", update);
    return () => {
      if (media) media.removeEventListener("change", update);
      else window.removeEventListener("resize", update);
    };
  }, []);

  useLayoutEffect(() => {
    if (!drawerOpen) {
      if (restoreFocusRef.current && drawerLocation.current !== currentLocation.current)
        document.getElementById("admin-content")?.focus({ preventScroll: true });
      else if (restoreFocusRef.current === "mobile") openRef.current?.focus();
      else if (restoreFocusRef.current === "desktop")
        sidebarRef.current?.querySelector<HTMLButtonElement>(".sidebar-link--active")?.focus();
      restoreFocusRef.current = null;
      if (mobile && sidebarRef.current?.contains(document.activeElement)) openRef.current?.focus();
      return;
    }
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    drawerLocation.current = currentLocation.current;
    if (closeRef.current) closeRef.current.focus();
    else sidebar.focus();
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector(".admin-confirm")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setNavOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const buttons = Array.from(sidebar.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
      const first = buttons[0];
      const last = buttons.at(-1);
      if (!first || !last) {
        event.preventDefault();
        sidebar.focus();
      } else if (event.shiftKey && (document.activeElement === first || !sidebar.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !sidebar.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = priorOverflow;
      restoreFocusRef.current = mobileNavigationViewport() ? "mobile" : "desktop";
    };
  }, [drawerOpen, mobile]);
  const label = navigation.flatMap((group) => group.items).find((item) => item.id === section)?.label || "نمای کلی";
  return <div className="admin-shell">
    <a className="skip-link" href="#admin-content" onClick={(event) => {
      event.preventDefault();
      document.getElementById("admin-content")?.focus({ preventScroll: true });
    }}>رفتن به محتوای اصلی</a>
    {drawerOpen && <button type="button" className="sidebar-scrim" aria-hidden="true" tabIndex={-1}
      onClick={() => setNavOpen(false)} />}
    <div className="sidebar-viewport"><AdminSidebar accountId={identity?.id ?? null} brand={<Brand compact />} active={section} open={drawerOpen} mobile={mobile} sidebarRef={sidebarRef} closeRef={closeRef}
      onClose={() => setNavOpen(false)}
      onSelect={(value) => { if (value === section) setNavOpen(false); else void navigate(`#${value}`, true); }} /></div>
    <div className="main-shell" inert={drawerOpen}>
      <header className="topbar">
        <div className="topbar-context">
          <button ref={openRef} type="button" className="nav-open" aria-label="باز کردن فهرست"
            aria-controls="admin-navigation" aria-expanded={drawerOpen}
            onClick={() => setNavOpen(true)}>☰</button>
          <span className="topbar-workspace">پنل مدیریت</span><span className="topbar-divider" aria-hidden="true">/</span><strong>{label}</strong>
        </div>
        <div className="topbar-user">
          <ThemeToggle />
          <span className="user-avatar" aria-hidden="true">{identity?.firstName?.charAt(0) || "م"}</span>
          <span className="user-name">{identity?.firstName || "مدیر"}</span>
          <button type="button" onClick={logout}>خروج</button>
        </div>
      </header>
      <main key={location.canonical} id="admin-content" className="dashboard-main" tabIndex={-1}>
        {section === "overview" ? <Dashboard />
          : section === "products" ? <Catalog />
          : section === "orders" ? <Orders />
          : section === "people" ? <Users />
          : section === "promotions" ? <Promotions />
          : section === "care" ? <Care />
          : section === "reports" ? <Reports />
          : section === "landing" ? <LandingContent />
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
