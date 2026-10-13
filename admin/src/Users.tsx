import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./auth";
import { PasswordInput } from "./PasswordInput";
import { credentialError, credentialFieldErrors, normalizePhone, normalizeUsername, passwordHint, usernameHint } from "./password";
import {
  confirmAction, markFormSaved, showFieldErrors,
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

type UserRow = {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  username: string | null;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "BLOCKED";
  deletedAt: string | null;
  createdAt: string;
  isPhoneVerified: boolean;
  _count: {
    orders: number;
    pets: number;
    addresses: number;
    favorites?: number;
  };
};
type UserDetail = UserRow & {
  pets: {
    id: number;
    name: string;
    petType: { name: string };
    breed: { name: string } | null;
  }[];
  addresses: {
    id: number;
    title: string;
    province: string;
    city: string;
    fullAddress: string;
  }[];
  orders: {
    id: number;
    orderNumber: string;
    status: string;
    finalAmount: number;
    createdAt: string;
  }[];
};
const fullName = (user: UserRow) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") || "بدون نام";

function CredentialAssignment({ user, onSaved }: { user: UserRow; onSaved(): void }) {
  const { request, identity, logout } = useAuth();
  const [username, setUsername] = useState(user.username ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (pending.current) return;
    const problem = credentialError(username, password, confirm);
    showFieldErrors(form, credentialFieldErrors(username, password, confirm, "assign"));
    setError(problem); setNotice("");
    if (problem) return;
    pending.current = true; setBusy(true);
    try {
      await request(`/admin/users/${user.id}/password-account`, { method: "POST", body: { username: normalizeUsername(username), password } });
      if (!mounted.current) return;
      markFormSaved(form);
      setPassword(""); setConfirm("");
      if (identity?.id === user.id) { logout(); return; }
      setNotice("اطلاعات ورود ذخیره شد؛ نشست‌های قبلی این کاربر پایان یافتند.");
      onSaved();
    } catch {
      if (mounted.current) setError("ذخیرهٔ اطلاعات ورود انجام نشد. اطلاعات و دسترسی را بررسی کنید یا دوباره تلاش کنید.");
    } finally { pending.current = false; if (mounted.current) setBusy(false); }
  }
  return <section className="credential-panel" aria-label="اطلاعات ورود کاربر">
    <h3>{user.username ? "بازنشانی اطلاعات ورود" : "فعال‌سازی ورود با رمز"}</h3>
    <p>برای همین کاربر با شمارهٔ <bdi>{user.phone}</bdi> ذخیره می‌شود. نشست‌های قبلی پایان می‌یابند.{identity?.id === user.id ? " پس از ذخیره باید دوباره وارد پنل شوید." : ""}</p>
    <form className="manage-form credential-form" onSubmit={(event) => void submit(event)} noValidate>
      <label>نام کاربری<input name="username" dir="ltr" autoComplete="off" autoCapitalize="none" spellCheck={false} value={username} disabled={busy} onChange={(event) => setUsername(event.target.value)} /></label>
      <p className="credential-hint">{usernameHint}</p>
      <div><label htmlFor="assign-password">رمز عبور جدید</label><PasswordInput id="assign-password" value={password} onChange={setPassword} disabled={busy} /></div>
      <div><label htmlFor="assign-confirm">تکرار رمز عبور جدید</label><PasswordInput id="assign-confirm" value={confirm} onChange={setConfirm} disabled={busy} /></div>
      <p className="credential-hint">{passwordHint}</p>
      <div className="manage-actions manage-full"><button className="manage-primary" type="submit" disabled={busy}>{busy ? "در حال ذخیره…" : "ذخیرهٔ اطلاعات ورود"}</button></div>
      <Notice message={error} /><Notice message={notice} kind="success" />
    </form>
  </section>;
}

export function Users() {
  const { request, identity } = useAuth();
  const mutationPending = useRef(false);
  const mounted = useRef(true);
  const selectionVersion = useRef(0);
  const editFieldsRef = useRef<HTMLFieldSetElement | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selectionVersion.current += 1; }; }, []);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [editRole, setEditRole] = useState<"USER" | "ADMIN">("USER");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "BLOCKED">("ACTIVE");
  const [creating, setCreating] = useState(false);
  const { panelRef: createPanelRef, reveal: revealCreate, restore: restoreCreate } = useInlinePanelFocus<HTMLFormElement>();
  const { panelRef: detailPanelRef, reveal: revealDetail, restore: restoreDetail } = useInlinePanelFocus();
  const [newPhone, setNewPhone] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState<"USER" | "ADMIN">("USER");
  const [accountKind, setAccountKind] = useState<"password" | "otp">("password");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const createPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const path = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), limit: "20" });
    if (applied) q.set("search", applied);
    if (role) q.set("role", role);
    if (status) q.set("status", status);
    return `/admin/users?${q}`;
  }, [page, applied, role, status]);
  const list = usePaged<UserRow>(path, revision);
  const detail = useDetail<UserDetail>(
    selected ? `/admin/users/${selected}` : null,
    revision,
  );
  useEffect(() => {
    if (!detail.data) return;
    let current = true;
    queueMicrotask(() => {
      if (!current) return;
      setFirstName(detail.data?.firstName || "");
      setLastName(detail.data?.lastName || "");
      if (detail.data) {
        setEditRole(detail.data.role);
        setEditStatus(detail.data.status);
      }
    });
    return () => { current = false; };
  }, [detail.data]);

  async function mutate(
    method: "PATCH" | "DELETE",
    path: string,
    body: unknown,
    success: string,
    confirmText?: string,
  ) {
    if (mutationPending.current || createPending.current) return;
    mutationPending.current = true;
    const version = selectionVersion.current;
    const owner = editFieldsRef.current;
    try {
      if (confirmText && !await confirmAction(confirmText, "تأیید تغییر حساب")) return;
      if (!mounted.current || version !== selectionVersion.current) return;
      setBusy(true); setError(""); setMessage("");
      await request(path, { method, ...(body === undefined ? {} : { body }) });
      if (!mounted.current) return;
      if (owner) markFormSaved(owner);
      setRevision((value) => value + 1);
      if (version === selectionVersion.current) setMessage(success);
    } catch (problem) {
      if (mounted.current && version === selectionVersion.current) setError(errorMessage(problem));
    } finally {
      mutationPending.current = false; if (mounted.current) setBusy(false);
    }
  }
  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (busy || createPending.current || mutationPending.current) return;
    const errors = accountKind === "password" ? credentialFieldErrors(newUsername, newPassword, newConfirm, "create") : {};
    if (!/^09\d{9}$/.test(normalizePhone(newPhone))) errors.phone = "شمارهٔ موبایل معتبر وارد کنید.";
    showFieldErrors(form, errors);
    if (Object.keys(errors).length) { setError("فیلدهای مشخص‌شده را اصلاح کنید."); return; }
    if (accountKind === "password") {
      const problem = credentialError(newUsername, newPassword, newConfirm);
      if (problem) { setError(problem); return; }
    }
    createPending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(accountKind === "password" ? "/admin/users/password-account" : "/admin/users", {
        method: "POST",
        body: {
          phone: normalizePhone(newPhone),
          ...(accountKind === "password" ? { username: normalizeUsername(newUsername), password: newPassword } : {}),
          role: newRole,
          firstName: newFirstName.trim() || undefined,
          lastName: newLastName.trim() || undefined,
        },
      });
      setRevision((value) => value + 1);
      markFormSaved(form);
      setNewPhone("");
      setNewUsername(""); setNewPassword(""); setNewConfirm("");
      setNewFirstName("");
      setNewLastName("");
      setNewRole("USER");
      setCreating(false);
      setMessage("کاربر تازه ثبت شد.");
    } catch (problem) {
      setError(errorMessage(problem));
    } finally {
      createPending.current = false;
      setBusy(false);
    }
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setApplied(search.trim());
  }
  const user = detail.data;
  return (
    <div className="manage-page">
      <PageHeader
        eyebrow="جامعهٔ مشتریان"
        title="کاربران"
        description="پروندهٔ کاربران، نقش و وضعیت دسترسی را همراه با تاریخچهٔ مرتبط بررسی کنید."
      />
      <section id="user-create-editor" data-draft-region className="manage-card" aria-label="افزودن کاربر">
        <div className="manage-section-heading">
          <div><h2>حساب تازه</h2><p>شمارهٔ یکتا، روش ورود و سطح دسترسی را مشخص کنید.</p></div>
          <div className="manage-actions">
          <button
            type="button"
            className="manage-primary"
            disabled={busy}
            onClick={(event) => {
              if (creating) restoreCreate();
              else revealCreate(event.currentTarget);
              setCreating((value) => !value); setNewPassword(""); setNewConfirm("");
            }}
          >
            {creating ? "بستن فرم" : "افزودن کاربر"}
          </button>
          </div>
        </div>
        {creating && (
          <form ref={createPanelRef} tabIndex={-1} aria-label="ساخت حساب کاربر" className="manage-form credential-form" onSubmit={createUser} noValidate>
            <label>روش ورود حساب
              <select value={accountKind} disabled={busy} onChange={(event) => { setAccountKind(event.target.value as "password" | "otp"); setNewPassword(""); setNewConfirm(""); setError(""); }}>
                <option value="password">نام کاربری و رمز عبور</option><option value="otp">کد پیامکی</option>
              </select>
            </label>
            {accountKind === "password" ? <>
              <label>نام کاربری<input name="username" dir="ltr" autoComplete="off" autoCapitalize="none" spellCheck={false} value={newUsername} disabled={busy} onChange={(event) => setNewUsername(event.target.value)} required /></label>
              <p className="credential-hint">{usernameHint}</p>
              <div><label htmlFor="create-password">رمز عبور</label><PasswordInput id="create-password" value={newPassword} onChange={setNewPassword} disabled={busy} /></div>
              <div><label htmlFor="create-confirm">تکرار رمز عبور</label><PasswordInput id="create-confirm" value={newConfirm} onChange={setNewConfirm} disabled={busy} /></div>
              <p className="credential-hint">{passwordHint}</p>
            </> : null}
            <label>
              شماره موبایل
              <input
                dir="ltr"
                value={newPhone}
                name="phone"
                onChange={(event) => setNewPhone(event.target.value)}
                placeholder="09xxxxxxxxx"
                required
                disabled={busy}
                type="tel"
              />
            </label>
            <label>
              نام
              <input
                value={newFirstName}
                onChange={(event) => setNewFirstName(event.target.value)}
                placeholder="نام"
                maxLength={50}
                disabled={busy}
              />
            </label>
            <label>
              نام خانوادگی
              <input
                value={newLastName}
                onChange={(event) => setNewLastName(event.target.value)}
                placeholder="نام خانوادگی"
                maxLength={50}
                disabled={busy}
              />
            </label>
            <label>
              نقش
              <select
                value={newRole}
                disabled={busy}
                onChange={(event) =>
                  setNewRole(event.target.value as "USER" | "ADMIN")
                }
              >
                <option value="USER">کاربر</option>
                <option value="ADMIN">مدیر</option>
              </select>
            </label>
            <div className="manage-actions manage-full"><button type="submit" className="manage-primary" disabled={busy}>
              ثبت کاربر
            </button></div>
            <Notice message={error} />
            <Notice message={message} kind="success" />
          </form>
        )}
      </section>
      <section className="manage-card" aria-label="فهرست کاربران">
        <form className="manage-toolbar" onSubmit={apply}>
          <label>
            نام، نام کاربری یا شماره
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی کاربر"
            />
          </label>
          <label>
            نقش
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">همه</option>
              <option value="USER">کاربر</option>
              <option value="ADMIN">مدیر</option>
            </select>
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
              <option value="ACTIVE">فعال</option>
              <option value="BLOCKED">مسدود</option>
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
          onRetry={() => setRevision((value) => value + 1)}
        />
        {list.data && list.data.data.length > 0 && (
          <>
            <div className="manage-table-wrap">
              <table className="manage-table manage-table--users">
                <thead>
                  <tr>
                    <th>کاربر</th>
                    <th>شماره / نام کاربری</th>
                    <th>نقش</th>
                    <th>وضعیت</th>
                    <th>سفارش / پت</th>
                    <th>عضویت</th>
                    <th>پرونده</th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.data.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{fullName(item)}</strong><small>شناسهٔ {formatNumber(item.id)}</small></td>
                      <td><bdi>{item.phone}</bdi><small><bdi>{item.username ?? "نام کاربری ثبت نشده"}</bdi></small></td>
                      <td><span className={"manage-badge" + (item.role === "ADMIN" ? " manage-badge--admin" : "")}>{item.role === "ADMIN" ? "مدیر" : "کاربر"}</span></td>
                      <td>
                        <span className={"manage-badge" + (item.deletedAt || item.status === "BLOCKED" ? " manage-badge--warning" : " manage-badge--active")}>
                        {item.deletedAt
                          ? "حذف موقت"
                          : item.status === "BLOCKED"
                            ? "مسدود"
                            : "فعال"}
                        </span>
                      </td>
                      <td>
                        {formatNumber(item._count.orders)} /{" "}
                        {formatNumber(item._count.pets)}
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>
                        <button
                          className="manage-row-button"
                          data-draft-target="user-detail-editor"
                          type="button"
                          onClick={(event) => {
                            revealDetail(event.currentTarget);
                            setSelected(item.id);
                            selectionVersion.current += 1; setError(""); setMessage("");
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
      {selected && (
        <section id="user-detail-editor" data-draft-region ref={detailPanelRef} tabIndex={-1} className="manage-card" aria-label="پروندهٔ کاربر">
          <div className="manage-actions">
            <button type="button" onClick={() => { selectionVersion.current += 1; setSelected(null); restoreDetail(); }}>
              بستن پرونده
            </button>
          </div>
          <QueryState
            loading={detail.loading}
            error={detail.error}
            onRetry={() => setRevision((value) => value + 1)}
          />
          {user && (
            <>
              <h2>
                {fullName(user)} · <span dir="ltr">{user.phone ?? user.username ?? `#${user.id}`}</span>
              </h2>
              <dl className="manage-facts">
                <div><dt>نام کاربری</dt><dd dir="ltr">{user.username ?? "—"}</dd></div>
                <div>
                  <dt>شناسه</dt>
                  <dd>{formatNumber(user.id)}</dd>
                </div>
                <div>
                  <dt>تأیید شماره</dt>
                  <dd>{user.phone ? (user.isPhoneVerified ? "تأییدشده" : "تأییدنشده") : "شماره‌ای ثبت نشده"}</dd>
                </div>
                <div>
                  <dt>سفارش‌ها</dt>
                  <dd>{formatNumber(user._count.orders)}</dd>
                </div>
                <div>
                  <dt>آدرس‌ها</dt>
                  <dd>{formatNumber(user._count.addresses)}</dd>
                </div>
              </dl>
              {!user.deletedAt && <CredentialAssignment key={user.id} user={user} onSaved={() => setRevision((value) => value + 1)} />}
              <div className="manage-columns">
                <div>
                  <h2>پت‌ها</h2>
                  <ul className="manage-sublist">
                    {user.pets.map((pet) => (
                      <li key={pet.id}>
                        {pet.name} · {pet.petType.name}
                        {pet.breed ? ` · ${pet.breed.name}` : ""}
                      </li>
                    ))}
                  </ul>
                  {user.pets.length === 0 && <p>پتی ثبت نشده است.</p>}
                </div>
                <div>
                  <h2>آدرس‌ها</h2>
                  <ul className="manage-sublist">
                    {user.addresses.map((address) => (
                      <li key={address.id}>
                        {address.title} · {address.province}، {address.city}،{" "}
                        {address.fullAddress}
                      </li>
                    ))}
                  </ul>
                  {user.addresses.length === 0 && <p>آدرسی ثبت نشده است.</p>}
                </div>
              </div>
              <h2>سفارش‌های اخیر</h2>
              <ul className="manage-sublist">
                {user.orders.map((order) => (
                  <li key={order.id}>
                    <span dir="ltr">{order.orderNumber}</span> ·{" "}
                    {formatMoney(order.finalAmount)} ·{" "}
                    {formatDate(order.createdAt)}
                  </li>
                ))}
              </ul>
              {user.orders.length === 0 && <p>سفارشی ثبت نشده است.</p>}
              <Notice message={error} />
              <Notice message={message} kind="success" />
              {!user.deletedAt && (
                <div className="manage-card">
                  <h2>ویرایش دسترسی و نام</h2>
                  <fieldset ref={editFieldsRef} className="manage-form manage-fieldset" disabled={busy}>
                    <label>
                      نام
                      <input
                        maxLength={80}
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                      />
                    </label>
                    <label>
                      نام خانوادگی
                      <input
                        maxLength={80}
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                      />
                    </label>
                    <label>
                      نقش
                      <select
                        value={editRole}
                        onChange={(event) =>
                          setEditRole(event.target.value as "USER" | "ADMIN")
                        }
                      >
                        <option value="USER">کاربر</option>
                        <option value="ADMIN">مدیر</option>
                      </select>
                    </label>
                    <label>
                      وضعیت
                      <select
                        value={editStatus}
                        onChange={(event) =>
                          setEditStatus(
                            event.target.value as "ACTIVE" | "BLOCKED",
                          )
                        }
                      >
                        <option value="ACTIVE">فعال</option>
                        <option value="BLOCKED">مسدود</option>
                      </select>
                    </label>
                  </fieldset>
                  <div className="manage-actions">
                    <button
                      type="button"
                      className="manage-primary"
                      disabled={
                        busy ||
                        (identity?.id === user.id &&
                          (editRole !== "ADMIN" || editStatus === "BLOCKED"))
                      }
                      onClick={() =>
                        void mutate(
                          "PATCH",
                          `/admin/users/${user.id}`,
                          {
                            firstName: firstName.trim() || null,
                            lastName: lastName.trim() || null,
                            role: editRole,
                            status: editStatus,
                          },
                          "اطلاعات کاربر ثبت شد.",
                          editRole !== user.role || editStatus !== user.status
                            ? "تغییر نقش یا وضعیت دسترسی این کاربر تأیید شود؟"
                            : undefined,
                        )
                      }
                    >
                      ذخیرهٔ تغییرات
                    </button>
                    <button
                      type="button"
                      className="manage-danger"
                      disabled={busy || identity?.id === user.id}
                      onClick={() =>
                        void mutate(
                          "DELETE",
                          `/admin/users/${user.id}`,
                          undefined,
                          "کاربر به‌صورت موقت حذف شد.",
                          "این کاربر موقتاً حذف و مسدود شود؟",
                        )
                      }
                    >
                      حذف موقت
                    </button>
                  </div>
                  {identity?.id === user.id && (
                    <p className="manage-notice manage-notice--info">
                      نقش و وضعیت حساب مدیر فعلی از این صفحه قابل کاهش نیست.
                    </p>
                  )}
                </div>
              )}
              {user.deletedAt && (
                <div className="manage-actions">
                  <button
                    type="button"
                    className="manage-primary"
                    disabled={busy}
                    onClick={() =>
                      void mutate(
                        "PATCH",
                        `/admin/users/${user.id}/restore`,
                        undefined,
                        "حساب کاربر بازیابی شد.",
                        "حساب کاربر دوباره فعال شود؟",
                      )
                    }
                  >
                    بازیابی حساب
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
